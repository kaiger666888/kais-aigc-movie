/**
 * Jimeng (即梦) image generation service.
 *
 * Generates first/last frame images for each storyboard shot.
 * Features rate-limiting protection (anti-429) and character/style consistency
 * via image-to-image mode with reference images.
 */

import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../config.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface JimengOptions {
  /** Model name (default: jimeng-5.0) */
  model?: string;
  /** Aspect ratio, e.g. "16:9", "9:16" (default: from config) */
  ratio?: string;
  /** Resolution, e.g. "2k" (default: from config) */
  resolution?: string;
  /** Sample strength for image-to-image (0–1) */
  sampleStrength?: number;
}

export interface ImageResult {
  url: string;
  revisedPrompt?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(baseMs: number, rangeMs: number): number {
  return baseMs + Math.random() * rangeMs;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isRateLimited(response: Response, body: string): boolean {
  if (response.status === 429) return true;
  return body.includes("访问量过大");
}

// ---------------------------------------------------------------------------
// JimengService
// ---------------------------------------------------------------------------

export class JimengService {
  private apiUrl: string;
  private sessionId: string;
  private defaultModel: string;
  private defaultRatio: string;
  private defaultResolution: string;
  private baseDelayMs: number;
  private jitterRangeMs: number;
  private maxConcurrent: number;
  private maxRetries: number;
  private requestTimeoutMs: number;
  private backoffBaseMs: number;
  private backoffJitterMs: number;

  constructor(options?: { apiUrl?: string; sessionId?: string }) {
    // Default values — callers can override or use fromConfig()
    this.apiUrl = options?.apiUrl ?? "http://localhost:8000";
    this.sessionId = options?.sessionId ?? "";
    this.defaultModel = "jimeng-5.0";
    this.defaultRatio = "9:16";
    this.defaultResolution = "2k";
    this.baseDelayMs = 8000;
    this.jitterRangeMs = 12000;
    this.maxConcurrent = 3;
    this.maxRetries = 2;
    this.requestTimeoutMs = 120_000;
    this.backoffBaseMs = 60_000;
    this.backoffJitterMs = 30_000;
  }

  /** Create a JimengService pre-configured from the global Config. */
  static fromConfig(cfg: Config): JimengService {
    const svc = new JimengService({
      apiUrl: cfg.jimeng.apiUrl,
      sessionId: cfg.jimeng.sessionId,
    });
    svc.defaultModel = cfg.jimeng.model;
    svc.defaultRatio = cfg.jimeng.ratio;
    svc.defaultResolution = cfg.jimeng.resolution;
    svc.baseDelayMs = cfg.jimeng.baseDelayMs;
    svc.jitterRangeMs = cfg.jimeng.jitterRangeMs;
    svc.maxConcurrent = cfg.jimeng.maxConcurrent;
    svc.maxRetries = cfg.jimeng.maxRetries;
    svc.requestTimeoutMs = cfg.jimeng.requestTimeoutMs;
    svc.backoffBaseMs = cfg.jimeng.backoffBaseMs;
    svc.backoffJitterMs = cfg.jimeng.backoffJitterMs;
    return svc;
  }

  // ---- Health check ----

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(
        `${this.apiUrl}/`,
        { method: "GET", headers: this.headers() },
        5000,
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  // ---- Text-to-Image ----

  async textToImage(prompt: string, options?: JimengOptions): Promise<ImageResult[]> {
    await this.rateLimitDelay();
    const payload = {
      model: options?.model ?? this.defaultModel,
      prompt,
      ratio: options?.ratio ?? this.defaultRatio,
      resolution: options?.resolution ?? this.defaultResolution,
    };

    return this.postWithRetry("/v1/images/generations", payload);
  }

  // ---- Image-to-Image ----

  async imageToImage(
    prompt: string,
    refImages: string[],
    options?: JimengOptions,
  ): Promise<ImageResult[]> {
    await this.rateLimitDelay();
    const payload = {
      model: options?.model ?? this.defaultModel,
      prompt,
      ratio: options?.ratio ?? this.defaultRatio,
      resolution: options?.resolution ?? this.defaultResolution,
      images: refImages,
      sample_strength: options?.sampleStrength ?? 0.6,
    };

    return this.postWithRetry("/v1/images/generations", payload);
  }

  // ---- Batch text-to-image (serial, rate-limited) ----

  async batchTextToImage(
    items: Array<{ id: string; prompt: string; options?: JimengOptions }>,
    outputDir: string,
  ): Promise<Map<string, string>> {
    await mkdir(outputDir, { recursive: true });
    const result = new Map<string, string>();

    for (const item of items) {
      try {
        const images = await this.textToImage(item.prompt, item.options);
        if (images.length > 0) {
          const localPath = await this.downloadImage(
            images[0].url,
            outputDir,
            `${item.id}.png`,
          );
          result.set(item.id, localPath);
        }
      } catch (err) {
        console.error(`[Jimeng] Failed to generate image for ${item.id}:`, err);
      }
    }

    return result;
  }

  // ---- Download image ----

  async downloadImage(url: string, outputDir: string, filename: string): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const res = await fetchWithTimeout(url, { method: "GET" }, this.requestTimeoutMs);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const filePath = join(outputDir, filename);
    await writeFile(filePath, buffer);
    return filePath;
  }

  // ---- AI Image Selection ----

  /**
   * Download all images from a generation batch, use GLM-4V to pick the best,
   * save it as `outputFilename`, and clean up the rest.
   *
   * @param images  Array of {url} from textToImage/imageToImage
   * @param outputDir  Where to save the winner
   * @param outputFilename  e.g. "shot_1_first.png"
   * @param sceneDescription  The shot's imagePrompt for context (what we want)
   * @returns Path to the selected image, or null if all fail
   */
  async selectBestImage(
    images: ImageResult[],
    outputDir: string,
    outputFilename: string,
    sceneDescription: string,
  ): Promise<string | null> {
    if (images.length === 0) return null;
    if (images.length === 1) {
      // Only one image, no need to select
      return await this.downloadImage(images[0].url, outputDir, outputFilename);
    }

    await mkdir(outputDir, { recursive: true });

    // 1. Download all candidates as temp files
    const candidates: string[] = [];
    for (let i = 0; i < images.length; i++) {
      try {
        const tmpPath = join(outputDir, `_candidate_${i}.png`);
        await this.downloadImage(images[i].url, outputDir, `_candidate_${i}.png`);
        candidates.push(tmpPath);
      } catch (err) {
        console.warn(`[Jimeng] Failed to download candidate ${i}:`, err);
      }
    }

    if (candidates.length === 0) return null;

    // 2. Call GLM-4V to pick the best
    try {
      const bestIdx = await this.askVisionModel(candidates, sceneDescription);
      const winnerPath = candidates[bestIdx];

      // 3. Rename winner to output filename
      const finalPath = join(outputDir, outputFilename);
      const { rename } = await import("node:fs/promises");
      await rename(winnerPath, finalPath);

      // 4. Clean up losers
      for (let i = 0; i < candidates.length; i++) {
        if (i !== bestIdx) {
          await unlink(candidates[i]).catch(() => {});
        }
      }

      console.log(`[Jimeng] ✅ Selected image ${bestIdx + 1}/${candidates.length} for ${outputFilename}`);
      return finalPath;
    } catch (err) {
      console.warn(`[Jimeng] Vision model selection failed, using first image:`, err);
      // Fallback: keep first, delete rest
      const finalPath = join(outputDir, outputFilename);
      const { rename } = await import("node:fs/promises");
      await rename(candidates[0], finalPath);
      for (let i = 1; i < candidates.length; i++) {
        await unlink(candidates[i]).catch(() => {});
      }
      return finalPath;
    }
  }

  /**
   * Ask GLM-4V to evaluate and pick the best image.
   * Returns the index of the best image (0-based).
   */
  private async askVisionModel(imagePaths: string[], sceneDescription: string): Promise<number> {
    const apiKey = process.env.ZAI_API_KEY;
    if (!apiKey) throw new Error("ZAI_API_KEY not set");

    // Build multimodal content with all images
    const content: Array<Record<string, unknown>> = [];

    // Add all images as base64
    for (let i = 0; i < imagePaths.length; i++) {
      const buffer = await readFile(imagePaths[i]);
      const base64 = buffer.toString("base64");
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64}` },
      });
    }

    // Add the evaluation prompt
    content.push({
      type: "text",
      text: `你是一个专业的插画艺术总监。以上是同一场景描述生成的 ${imagePaths.length} 张候选图片。

场景描述：${sceneDescription}

请根据以下标准评分并选出最佳的一张：
1. **角色一致性** — 人物外观（发型、服装、面部特征）是否清晰稳定
2. **构图质量** — 画面构图是否专业，主体突出，层次分明
3. **氛围匹配** — 是否符合场景描述的情感氛围
4. **细节完整度** — 人物五官、手部、服饰等细节是否完整（无变形/缺失）

请只回复一个数字（1-${imagePaths.length}），表示第几张图片最佳。不要解释。`,
    });

    const res = await fetchWithTimeout(
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "GLM-4.6V-FlashX",
          messages: [{ role: "user", content }],
          max_tokens: 500,
          temperature: 0.1,
        }),
      },
      30000,
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vision API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = JSON.parse(await res.text()) as Record<string, unknown>;
    const choices = json.choices as Array<{ message: { content: string } }>;
    const reply = choices[0]?.message?.content?.trim() ?? "1";

    // Parse the number from reply
    const match = reply.match(/(\d+)/);
    const idx = match ? parseInt(match[1], 10) - 1 : 0; // Convert 1-based to 0-based
    return Math.max(0, Math.min(idx, imagePaths.length - 1));
  }

  // ---- Internals ----

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.sessionId) {
      h["Authorization"] = `Bearer ${this.sessionId}`;
    }
    return h;
  }

  private async postWithRetry(
    endpoint: string,
    payload: Record<string, unknown>,
  ): Promise<ImageResult[]> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[Jimeng] Retry ${attempt}/${this.maxRetries} for ${endpoint}`);
      }

      try {
        const res = await fetchWithTimeout(
          `${this.apiUrl}${endpoint}`,
          {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(payload),
          },
          this.requestTimeoutMs,
        );

        const body = await res.text();

        // Rate limit detection
        if (isRateLimited(res, body)) {
          const wait = jitter(this.backoffBaseMs, this.backoffJitterMs);
          console.warn(`[Jimeng] Rate limited. Backing off ${Math.round(wait / 1000)}s`);
          await sleep(wait);
          continue;
        }

        if (!res.ok) {
          throw new Error(`Jimeng API error ${res.status}: ${body.slice(0, 200)}`);
        }

        const json = JSON.parse(body) as Record<string, unknown>;
        // OpenAI-compatible format: { data: [{ url, revised_prompt }] }
        const images = (json.data ?? json.images ?? []) as Array<{ url: string; revised_prompt?: string }>;
        return images.map((img) => ({
          url: img.url,
          revisedPrompt: img.revised_prompt,
        }));
      } catch (err) {
        if (attempt === this.maxRetries) throw err;
        await sleep(5000);
      }
    }

    return []; // unreachable but satisfies TS
  }

  private async rateLimitDelay(): Promise<void> {
    const delay = jitter(this.baseDelayMs, this.jitterRangeMs);
    console.log(`[Jimeng] Rate limit delay: ${Math.round(delay / 1000)}s`);
    await sleep(delay);
  }
}

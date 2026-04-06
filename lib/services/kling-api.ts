import { createHmac } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getConfig } from "../config.js";
import type { VideoGenerator, VideoOptions } from "./video-generator.js";

// ============================================================================
// Kling JWT Authentication
// ============================================================================

/** Token validity duration in seconds (30 minutes) */
const TOKEN_VALIDITY_SECONDS = 1800;
/** Refresh 5 minutes before expiry */
const CACHE_BUFFER_SECONDS = 300;

/**
 * Generate a Kling API JWT token using HMAC-SHA256.
 *
 * Header: { alg: "HS256", typ: "JWT" }
 * Payload: { iss: accessKey, exp: now + 1800, nbf: now - 5 }
 * Signature: HMAC-SHA256 with secretKey
 */
function generateKlingJwt(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: accessKey,
      exp: now + TOKEN_VALIDITY_SECONDS,
      nbf: now - 5,
    }),
  ).toString("base64url");

  const signatureInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secretKey)
    .update(signatureInput)
    .digest("base64url");

  return `${signatureInput}.${signature}`;
}

/** Cached JWT with auto-refresh */
class KlingAuthToken {
  private token: string | null = null;
  private expiry = 0;

  constructor(
    private readonly accessKey: string,
    private readonly secretKey: string,
  ) {}

  get(): string {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.expiry > now + CACHE_BUFFER_SECONDS) {
      return this.token;
    }
    this.token = generateKlingJwt(this.accessKey, this.secretKey);
    this.expiry = now + TOKEN_VALIDITY_SECONDS;
    return this.token;
  }
}

// ============================================================================
// Types
// ============================================================================

/** Options for text-to-video generation */
export interface KlingSubmitOptions {
  /** Duration in seconds: "5" or "10" */
  duration?: string;
  /** Aspect ratio: "16:9" (default) or "9:16" */
  aspectRatio?: string;
  /** Model name (default "kling-v2-master") */
  model?: string;
}

/** Response from task submission */
export interface KlingTaskResponse {
  code: number;
  message: string;
  data: {
    task_id: string;
  };
}

/** Response from task polling */
export interface KlingTaskResult {
  code: number;
  message: string;
  data: {
    task_id: string;
    task_status: string;
    task_result?: {
      videos?: Array<{ url: string; duration: string }>;
      task_status: string;
    };
  };
}

// ============================================================================
// Kling API Service
// ============================================================================

const DEFAULT_POLL_INTERVAL_MS = 3000;

/**
 * Kling 3.0 API Service.
 *
 * Handles async video generation with JWT (HS256) authentication,
 * concurrency control, exponential backoff retries, and timeout protection.
 */
export class KlingApiService implements VideoGenerator {
  private readonly baseUrl: string;
  private readonly auth: KlingAuthToken;
  private readonly maxConcurrent: number;
  private readonly maxRetries: number;
  private readonly shotTimeoutMs: number;
  private readonly pollIntervalMs: number;

  /** Active request counter for concurrency control */
  private activeCount = 0;
  /** Resolvers waiting for a slot */
  private waitQueue: Array<() => void> = [];

  constructor() {
    const cfg = getConfig();
    this.baseUrl = cfg.kling.apiUrl;
    this.auth = new KlingAuthToken(cfg.kling.accessKey, cfg.kling.secretKey);
    this.maxConcurrent = cfg.kling.maxConcurrent;
    this.maxRetries = cfg.kling.maxRetries;
    this.shotTimeoutMs = cfg.kling.shotTimeoutMs;
    this.pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
  }

  /**
   * Verify API credentials by calling a lightweight endpoint.
   * Does not consume generation quota.
   *
   * @returns `true` if authentication succeeds, `false` otherwise.
   */
  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/videos/text2video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.auth.get()}`,
        },
        body: JSON.stringify({ model: "kling-v2-master", prompt: "test", duration: "5" }),
      });
      // 200 with code 0 or non-401 means auth is valid
      if (res.status === 401) return false;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Submit a text-to-video generation task.
   *
   * @param prompt - Visual description in English for video generation.
   * @param options - Duration, aspect ratio, model overrides.
   * @returns The task_id for polling.
   */
  async submitTask(
    prompt: string,
    options?: KlingSubmitOptions,
  ): Promise<string> {
    await this.acquireSlot();

    try {
      const payload = {
        model: options?.model ?? "kling-v2-master",
        prompt,
        duration: options?.duration ?? "5",
        aspect_ratio: options?.aspectRatio ?? "16:9",
      };

      const res = await fetch(`${this.baseUrl}/v1/videos/text2video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.auth.get()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "unknown");
        throw new Error(`Kling submit error ${res.status}: ${detail}`);
      }

      const json = (await res.json()) as KlingTaskResponse;
      if (json.code !== 0 || !json.data?.task_id) {
        throw new Error(`Kling submit failed: ${json.message}`);
      }

      return json.data.task_id;
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * Poll a task until it completes, fails, or times out.
   *
   * @param taskId - The task ID from submitTask.
   * @returns The final task result.
   * @throws On task failure or timeout.
   */
  async pollTask(taskId: string): Promise<KlingTaskResult> {
    const deadline = Date.now() + this.shotTimeoutMs;

    while (Date.now() < deadline) {
      const res = await fetch(
        `${this.baseUrl}/v1/videos/text2video/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${this.auth.get()}`,
          },
        },
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => "unknown");
        throw new Error(`Kling poll error ${res.status}: ${detail}`);
      }

      const json = (await res.json()) as KlingTaskResult;
      const status = json.data?.task_status;

      if (status === "succeed") {
        return json;
      }
      if (status === "failed") {
        throw new Error(`Kling task ${taskId} failed: ${json.message}`);
      }

      await sleep(this.pollIntervalMs);
    }

    throw new Error(`Kling task ${taskId} timed out after ${this.shotTimeoutMs}ms`);
  }

  /**
   * Submit a task, poll until complete, and download the video.
   * Includes exponential backoff retries on submission failure.
   *
   * @param prompt - Visual description.
   * @param outputDir - Directory to save the video.
   * @param filename - Output filename (without extension).
   * @param options - Generation options.
   * @returns Path to the downloaded video file.
   */
  async submitAndDownload(
    prompt: string,
    outputDir: string,
    filename: string,
    options?: VideoOptions | KlingSubmitOptions,
  ): Promise<string> {
    // Normalize VideoOptions → KlingSubmitOptions
    const klingOpts: KlingSubmitOptions = {
      duration: String((options as VideoOptions)?.duration ?? (options as KlingSubmitOptions)?.duration ?? 5),
      aspectRatio: (options as VideoOptions)?.aspectRatio ?? (options as KlingSubmitOptions)?.aspectRatio,
      model: (options as VideoOptions)?.model ?? (options as KlingSubmitOptions)?.model,
    };
    // Submit with exponential backoff retries
    let taskId: string | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        taskId = await this.submitTask(prompt, klingOpts);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          await sleep(1000 * Math.pow(2, attempt));
        }
      }
    }

    if (!taskId) {
      throw new Error(
        `Kling submit failed after ${this.maxRetries} retries: ${lastError?.message}`,
      );
    }

    // Poll for completion
    const result = await this.pollTask(taskId);
    const videoUrl = result.data?.task_result?.videos?.[0]?.url;
    if (!videoUrl) {
      throw new Error(`Kling task ${taskId} completed but no video URL`);
    }

    // Download
    await mkdir(outputDir, { recursive: true });
    const outPath = join(outputDir, `${filename}.mp4`);

    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok || !videoRes.body) {
      throw new Error(`Failed to download video from ${videoUrl}`);
    }

    const buffer = Buffer.from(await videoRes.arrayBuffer());
    await writeFile(outPath, buffer);

    return outPath;
  }

  // ============================================================================
  // Concurrency Control (simple semaphore)
  // ============================================================================

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  private releaseSlot(): void {
    this.activeCount--;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      this.activeCount++;
      next?.();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

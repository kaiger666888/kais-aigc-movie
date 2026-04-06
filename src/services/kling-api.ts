import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getConfig } from "../config/default.js";

/** Result of a completed Kling generation task */
export interface TaskResult {
  taskId: string;
  status: "succeeded" | "failed";
  /** URL to download the generated video */
  videoUrl?: string;
  /** Duration of the generated video in seconds */
  duration?: number;
  /** Error message if failed */
  error?: string;
}

/** Options when submitting a generation task */
export interface SubmitOptions {
  /** Desired duration in seconds (default 5) */
  duration?: number;
  /** Aspect ratio, e.g. "16:9" */
  aspectRatio?: string;
}

const POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 300_000;

/**
 * Kling 3.0 async video generation API wrapper.
 *
 * Implements submit → poll → download pattern with concurrency control and retries.
 */
export class KlingApiService {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly maxConcurrent: number;
  private readonly maxRetries: number;
  /** Tracks currently running slots for concurrency control */
  private running = 0;
  private readonly queue: Array<() => void> = [];

  constructor() {
    const cfg = getConfig();
    this.endpoint = cfg.kling.apiEndpoint;
    this.apiKey = cfg.kling.apiKey;
    this.maxConcurrent = cfg.kling.maxConcurrent;
    this.maxRetries = cfg.kling.maxRetries;
  }

  /** Acquire a concurrency slot */
  private acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  /** Release a concurrency slot */
  private release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }

  /**
   * Submit a video generation task.
   *
   * @param prompt - Visual prompt describing the scene.
   * @param options - Duration, aspect ratio, etc.
   * @returns The task ID for polling.
   */
  async submitTask(
    prompt: string,
    options?: SubmitOptions,
  ): Promise<string> {
    const body = JSON.stringify({
      model: "kling-3.0",
      prompt,
      duration: options?.duration ?? 5,
      aspect_ratio: options?.aspectRatio ?? "16:9",
    });

    const res = await fetch(`${this.endpoint}/videos/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "unknown");
      throw new Error(`Kling submit error ${res.status}: ${detail}`);
    }

    const json = (await res.json()) as { data?: { task_id?: string } };
    const taskId = json?.data?.task_id;
    if (!taskId) {
      throw new Error("Kling API did not return a task_id");
    }
    return taskId;
  }

  /**
   * Poll a task until it completes or times out.
   *
   * @param taskId - The task ID returned by submitTask.
   * @param timeoutMs - Maximum time to wait (default 5 min).
   * @returns Final TaskResult.
   */
  async pollTask(
    taskId: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<TaskResult> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const res = await fetch(
        `${this.endpoint}/videos/generations/${taskId}`,
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        },
      );

      if (!res.ok) {
        throw new Error(
          `Kling poll error ${res.status}: ${await res.text().catch(() => "")}`,
        );
      }

      const json = (await res.json()) as {
        data?: {
          task_status?: string;
          task_result?: {
            videos?: Array<{ url: string; duration: number }>;
          };
        };
      };

      const status = json?.data?.task_status;
      if (status === "succeed" || status === "failed") {
        const video = json?.data?.task_result?.videos?.[0];
        return {
          taskId,
          status: status === "succeed" ? "succeeded" : "failed",
          videoUrl: video?.url,
          duration: video?.duration,
          error: status === "failed" ? "Task failed on server" : undefined,
        };
      }

      // Still processing — wait before next poll
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    return { taskId, status: "failed", error: "Polling timed out" };
  }

  /**
   * Download the generated video to a local directory.
   *
   * @param videoUrl - URL returned by pollTask.
   * @param outputDir - Directory to save the file in.
   * @param fileName - File name (default from URL).
   * @returns Absolute path to the saved file.
   */
  async downloadResult(
    videoUrl: string,
    outputDir: string,
    fileName?: string,
  ): Promise<string> {
    await mkdir(outputDir, { recursive: true });

    const res = await fetch(videoUrl);
    if (!res.ok) {
      throw new Error(`Kling download error ${res.status}`);
    }

    const name =
      fileName ??
      new URL(videoUrl).pathname.split("/").pop() ??
      "output.mp4";
    const filePath = join(outputDir, name);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(filePath, buf);
    return filePath;
  }

  /**
   * Submit, poll, and download with concurrency control and retry.
   *
   * @param prompt - Visual prompt.
   * @param outputDir - Where to save the video.
   * @param options - Generation options.
   * @param fileName - Output file name.
   * @returns Path to the downloaded video file.
   */
  async generateWithRetry(
    prompt: string,
    outputDir: string,
    options?: SubmitOptions,
    fileName?: string,
  ): Promise<string> {
    await this.acquire();
    try {
      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const taskId = await this.submitTask(prompt, options);
          const result = await this.pollTask(taskId);

          if (result.status === "succeeded" && result.videoUrl) {
            return await this.downloadResult(
              result.videoUrl,
              outputDir,
              fileName,
            );
          }

          lastError = new Error(
            result.error ?? "Generation failed with no error message",
          );
        } catch (err) {
          lastError =
            err instanceof Error ? err : new Error(String(err));
        }

        // Exponential back-off before retry
        if (attempt < this.maxRetries) {
          const delayMs = 2 ** (attempt - 1) * 1000;
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }

      throw lastError ?? new Error("All retries exhausted");
    } finally {
      this.release();
    }
  }
}

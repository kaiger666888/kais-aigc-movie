import { KlingApiService } from "../services/kling-api.js";
import type { ShotsConfig } from "../types/shots.js";

/** Progress callback type */
export type RenderProgressCallback = (
  completed: number,
  total: number,
  shotId: string,
  status: "started" | "completed" | "failed",
) => void;

/**
 * Kling Renderer Agent — generates video clips for each shot.
 *
 * Uses the Kling 3.0 API with concurrency control and per-shot retry.
 * Each shot is rendered independently — failure only affects that shot.
 */
export class KlingRendererAgent {
  private readonly kling: KlingApiService;

  constructor(kling?: KlingApiService) {
    this.kling = kling ?? new KlingApiService();
  }

  /**
   * Render video clips for all shots.
   *
   * @param shots - Shot configuration with visual prompts.
   * @param outputDir - Directory to save video clips.
   * @param onProgress - Optional progress callback.
   * @returns Map of shotId → video file path.
   */
  async render(
    shots: ShotsConfig,
    outputDir: string,
    onProgress?: RenderProgressCallback,
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const total = shots.shots.length;
    let completed = 0;
    const errors: Array<{ shotId: string; error: string }> = [];

    // Process shots in parallel (concurrency controlled by KlingApiService semaphore)
    const tasks = shots.shots.map(async (shot) => {
      onProgress?.(completed, total, shot.id, "started");

      try {
        const videoPath = await this.kling.submitAndDownload(
          shot.visualPrompt,
          outputDir,
          shot.id,
          {
            duration: String(Math.max(5, Math.min(10, shot.duration))),
            aspectRatio: "16:9",
          },
        );

        completed++;
        results.set(shot.id, videoPath);
        onProgress?.(completed, total, shot.id, "completed");
      } catch (err) {
        completed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ shotId: shot.id, error: msg });
        onProgress?.(completed, total, shot.id, "failed");
      }
    });

    await Promise.all(tasks);

    // Report partial failures but don't throw — let QC handle it
    if (errors.length > 0 && errors.length === total) {
      throw new Error(
        `All ${total} shots failed to render:\n${errors.map((e) => `  ${e.shotId}: ${e.error}`).join("\n")}`,
      );
    }
    if (errors.length > 0) {
      console.warn(
        `⚠️ ${errors.length}/${total} shots failed to render:\n${errors.map((e) => `  ${e.shotId}: ${e.error}`).join("\n")}`,
      );
    }

    return results;
  }
}

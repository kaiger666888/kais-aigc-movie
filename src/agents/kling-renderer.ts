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

    // Process shots in parallel (concurrency controlled by KlingApiService)
    const tasks = shots.shots.map(async (shot) => {
      onProgress?.(completed, total, shot.id, "started");

      try {
        const videoPath = await this.kling.generateWithRetry(
          shot.visualPrompt,
          outputDir,
          { duration: shot.duration, aspectRatio: "16:9" },
          `${shot.id}.mp4`,
        );

        completed++;
        results.set(shot.id, videoPath);
        onProgress?.(completed, total, shot.id, "completed");
      } catch (err) {
        completed++;
        const msg = err instanceof Error ? err.message : String(err);
        onProgress?.(completed, total, shot.id, "failed");
        throw new Error(`Render failed for shot ${shot.id}: ${msg}`);
      }
    });

    await Promise.all(tasks);
    return results;
  }
}

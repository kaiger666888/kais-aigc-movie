import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { concatVideos, addAudio, addSubtitle } from "../utils/ffmpeg.js";
import type { ShotsConfig, Shot } from "../types/shots.js";

/**
 * Editor Agent — composes the final video from shots, audio, and subtitles.
 *
 * Pipeline per shot: video + audio → add subtitle → concat all → rough_cut.mp4
 */
export class EditorAgent {
  /**
   * Compose the rough cut from individual shot videos, audio tracks, and subtitles.
   *
   * @param shots - Shot configuration (provides ordering and subtitle text).
   * @param audioFiles - Map of shotId → audio file path.
   * @param videoFiles - Map of shotId → video file path.
   * @param outputPath - Final output file path (e.g. rough_cut.mp4).
   * @returns Path to the rough cut video.
   */
  async compose(
    shots: ShotsConfig,
    audioFiles: Map<string, string>,
    videoFiles: Map<string, string>,
    outputPath: string,
  ): Promise<string> {
    const workDir = join(tmpdir(), `editor-${Date.now()}`);
    await mkdir(workDir, { recursive: true });

    try {
      const compositedShots: string[] = [];

      // Step 1: For each shot, merge video + audio
      for (const shot of shots.shots) {
        const videoPath = videoFiles.get(shot.id);
        const audioPath = audioFiles.get(shot.id);

        if (!videoPath) {
          throw new Error(`Missing video for shot ${shot.id}`);
        }

        const mergedPath = join(workDir, `${shot.id}_merged.mp4`);

        if (audioPath) {
          await addAudio(videoPath, audioPath, mergedPath);
        } else {
          // No audio — just use the video as-is
          compositedShots.push(videoPath);
          continue;
        }

        compositedShots.push(mergedPath);
      }

      // Step 2: Generate SRT file and add subtitles
      const srtPath = join(workDir, "subtitles.srt");
      await this.generateSrt(shots.shots, srtPath);

      // Step 3: Concatenate all composited shots
      const concatPath = join(workDir, "concat.mp4");
      await concatVideos(compositedShots, concatPath);

      // Step 4: Burn in subtitles
      await addSubtitle(concatPath, srtPath, outputPath);

      return outputPath;
    } finally {
      // Cleanup temp directory
      this.cleanupDir(workDir);
    }
  }

  /**
   * Generate an SRT subtitle file from shot data.
   *
   * Each shot's subtitle is timed to its duration.
   */
  private async generateSrt(
    shots: Shot[],
    srtPath: string,
  ): Promise<void> {
    let offsetMs = 0;
    const entries: string[] = [];

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i]!;
      if (!shot.subtitle?.trim()) {
        offsetMs += shot.duration * 1000;
        continue;
      }

      const startMs = offsetMs;
      const endMs = offsetMs + shot.duration * 1000;

      entries.push(
        `${i + 1}\n${formatSrtTime(startMs)} --> ${formatSrtTime(endMs)}\n${shot.subtitle}\n`,
      );

      offsetMs = endMs;
    }

    await writeFile(srtPath, entries.join("\n"), "utf-8");
  }

  /** Best-effort cleanup of temp work directory. */
  private async cleanupDir(dir: string): Promise<void> {
    try {
      const files = await import("node:fs/promises").then((m) =>
        m.readdir(dir),
      );
      for (const f of files) {
        await unlink(join(dir, f)).catch(() => {});
      }
      await import("node:fs/promises").then((m) => m.rmdir(dir));
    } catch {
      // Ignore cleanup errors
    }
  }
}

/** Format milliseconds as HH:MM:SS,mmm for SRT. */
function formatSrtTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const mil = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad3(mil)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

import { stat } from "node:fs/promises";
import { join } from "node:path";
import { probeVideo } from "../utils/ffmpeg.js";
import type { ShotsConfig } from "../types/shots.js";
import type {
  QCReport,
  ShotQC,
  QCIssue,
} from "../types/qc-report.js";

/**
 * QC Tech Agent — inspects the final output and produces a quality report.
 *
 * Checks file existence, audio/video integrity, duration, encoding, and resolution.
 */
export class QCTechAgent {
  /**
   * Inspect an episode and produce a QC report.
   *
   * @param episodeDir - Root directory of the episode.
   * @param shots - Shot configuration (to know what to expect).
   * @returns A structured QC report with scores and issues.
   */
  async inspect(
    episodeDir: string,
    shots: ShotsConfig,
  ): Promise<QCReport> {
    const shotQCs: ShotQC[] = [];
    const issues: QCIssue[] = [];
    let totalScore = 0;
    const totalShots = shots.shots.length;

    for (const shot of shots.shots) {
      const videoPath = join(episodeDir, "shots", `${shot.id}.mp4`);
      const audioPath = join(episodeDir, "audio", `${shot.id}.mp3`);

      const shotQC: ShotQC = {
        shotId: shot.id,
        duration: 0,
        hasAudio: false,
        hasVideo: false,
        subtitleSync: true,
        score: 10,
        issues: [],
      };

      // Check video
      const videoExists = await fileExists(videoPath);
      if (videoExists) {
        shotQC.hasVideo = true;
        try {
          const probe = await probeVideo(videoPath);
          const streams = (probe as { streams?: Array<Record<string, unknown>> }).streams ?? [];

          for (const stream of streams) {
            if (stream.codec_type === "video") {
              // Check codec
              if (stream.codec_name !== "h264") {
                shotQC.score -= 1;
                shotQC.issues.push(`Non-H264 codec: ${String(stream.codec_name)}`);
              }
              // Check resolution >= 720p
              const height = Number(stream.height ?? 0);
              if (height < 720) {
                shotQC.score -= 2;
                shotQC.issues.push(`Low resolution: ${height}p`);
              }
              // Extract duration
              shotQC.duration = Number(stream.duration ?? 0);
            }
          }
        } catch {
          shotQC.score -= 2;
          shotQC.issues.push("Failed to probe video");
        }
      } else {
        shotQC.hasVideo = false;
        shotQC.score -= 5;
        shotQC.issues.push("Video file missing");
      }

      // Check audio
      const audioExists = await fileExists(audioPath);
      if (audioExists) {
        shotQC.hasAudio = true;
        try {
          const audioStat = await stat(audioPath);
          if (audioStat.size === 0) {
            shotQC.hasAudio = false;
            shotQC.score -= 2;
            shotQC.issues.push("Audio file is empty");
          }
        } catch {
          shotQC.hasAudio = false;
          shotQC.score -= 2;
          shotQC.issues.push("Cannot read audio file");
        }
      } else {
        shotQC.score -= 3;
        shotQC.issues.push("Audio file missing");
      }

      // Clamp score
      shotQC.score = Math.max(0, Math.min(10, shotQC.score));
      totalScore += shotQC.score;

      // Record issues
      for (const issueText of shotQC.issues) {
        issues.push({
          shotId: shot.id,
          severity: shotQC.score < 5 ? "critical" : "warning",
          category: issueText.includes("Audio") || issueText.includes("audio")
            ? "audio"
            : "visual",
          description: issueText,
        });
      }

      shotQCs.push(shotQC);
    }

    // Check overall constraints
    const overallScore = totalShots > 0 ? totalScore / totalShots : 0;
    const passed = overallScore >= 7.0;

    // Check total duration
    const totalDuration = shotQCs.reduce((sum, qc) => sum + qc.duration, 0);
    if (totalDuration < 45 || totalDuration > 60) {
      issues.push({
        severity: "warning",
        category: "timing",
        description: `Total duration ${totalDuration.toFixed(1)}s outside 45-60s range`,
      });
    }

    // Check shot count
    if (totalShots < 6 || totalShots > 8) {
      issues.push({
        severity: "info",
        category: "continuity",
        description: `Shot count ${totalShots} outside recommended 6-8 range`,
      });
    }

    const report: QCReport = {
      episodeId: basename(episodeDir),
      timestamp: new Date().toISOString(),
      passed,
      overallScore: Math.round(overallScore * 10) / 10,
      shots: shotQCs,
      issues,
    };

    // Write report to disk
    const reportPath = join(episodeDir, "qc_report.json");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");

    return report;
  }
}

/** Check if a file exists. */
async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

/** Extract basename helper to avoid top-level import in function */
function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

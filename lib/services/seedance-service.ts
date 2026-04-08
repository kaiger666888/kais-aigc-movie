/**
 * Seedance video generation service (Phase C — stub).
 *
 * Currently only prepares video tasks and ambience track plans.
 * Actual video generation calls are placeholder stubs to be implemented later.
 */

import { join, dirname } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import type { Shot } from "../types/shots.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VideoTask {
  shotId: string;
  /** Video description prompt for Seedance (@1 first frame, @2 last frame) */
  prompt: string;
  /** Local path to first frame image */
  firstFramePath: string;
  /** Local path to last frame image */
  lastFramePath: string;
  /** Local path to ambience audio segment */
  ambienceSegmentPath: string;
  /** Aspect ratio (default 4:3) */
  ratio: string;
  /** Duration in seconds */
  duration: number;
  /** Task status */
  status: "pending" | "submitted" | "done" | "failed";
}

export interface AmbienceTrack {
  /** Scene group ID */
  sceneGroupId: string;
  /** Combined subtitle text for the scene group */
  text: string;
  /** Shot IDs in this group */
  shotIds: string[];
  /** Suggested music style */
  musicStyle: string;
}

export interface VideoResult {
  taskId: string;
  videoUrl: string;
  duration: number;
}

// ---------------------------------------------------------------------------
// SeedanceService
// ---------------------------------------------------------------------------

export class SeedanceService {
  private apiUrl: string;
  private apiKey: string;
  private defaultRatio: string;
  private defaultDuration: number;

  constructor(options?: { apiUrl?: string; apiKey?: string }) {
    this.apiUrl = options?.apiUrl ?? "";
    this.apiKey = options?.apiKey ?? "";
    this.defaultRatio = "4:3";
    this.defaultDuration = 5;
  }

  /** Create from Config. */
  static fromConfig(cfg: { seedance: { apiUrl: string; apiKey: string; ratio: string; duration: number } }): SeedanceService {
    const svc = new SeedanceService({
      apiUrl: cfg.seedance.apiUrl,
      apiKey: cfg.seedance.apiKey,
    });
    svc.defaultRatio = cfg.seedance.ratio;
    svc.defaultDuration = cfg.seedance.duration;
    return svc;
  }

  // ---- Material preparation (Phase A) ----

  /**
   * Prepare video generation tasks from shots.
   * Only dynamic shots get video tasks; static/lipSync are skipped.
   * Called during Phase A to generate video_tasks.json.
   */
  prepareVideoTasks(shots: Shot[], imagesDir: string): VideoTask[] {
    return shots
      .filter((shot) => (shot.shotType ?? "dynamic") === "dynamic")
      .map((shot) => ({
        shotId: shot.id,
        prompt: shot.videoPrompt ?? `@1 @2 画面缓缓过渡，保持构图和色彩一致，avoid jitter and bent limbs`,
        firstFramePath: shot.imageUrl ? shot.imageUrl : join(imagesDir, `${shot.id}_first.png`),
        lastFramePath: shot.lastFrameUrl ? shot.lastFrameUrl : join(imagesDir, `${shot.id}_last.png`),
        ambienceSegmentPath: join(imagesDir, `ambience_${shot.sceneGroupId ?? "default"}_${shot.id}.wav`),
        ratio: this.defaultRatio,
        duration: shot.duration ?? this.defaultDuration,
        status: "pending" as const,
      }));
  }

  /**
   * Plan ambience tracks by grouping shots via sceneGroupId.
   * Shots in the same group share one ambience audio segment.
   */
  prepareAmbienceTrack(shots: Shot[]): AmbienceTrack[] {
    const groups = new Map<string, Shot[]>();

    for (const shot of shots) {
      const gid = shot.sceneGroupId ?? "default";
      const arr = groups.get(gid) ?? [];
      arr.push(shot);
      groups.set(gid, arr);
    }

    return Array.from(groups.entries()).map(([gid, groupShots]) => ({
      sceneGroupId: gid,
      text: groupShots.map((s) => s.subtitle).join(" "),
      shotIds: groupShots.map((s) => s.id),
      musicStyle: groupShots[0]?.musicStyle ?? "",
    }));
  }

  /** Save video tasks to a JSON file. */
  saveTasks(tasks: VideoTask[], filePath: string): void {
    writeFileSync(filePath, JSON.stringify(tasks, null, 2), "utf-8");
  }

  /** Load video tasks from a JSON file. */
  loadTasks(filePath: string): VideoTask[] {
    return JSON.parse(readFileSync(filePath, "utf-8")) as VideoTask[];
  }

  // ---- Phase C stubs (not implemented yet) ----

  /**
   * Submit a video generation task to Seedance.
   * TODO: Implement actual Seedance API call.
   */
  async submitVideoTask(_task: VideoTask): Promise<string> {
    throw new Error(
      "[Seedance] Video generation not yet implemented. " +
      "Phase C will call the Seedance API to generate videos.",
    );
  }

  /**
   * Poll a video generation task until completion.
   * TODO: Implement actual Seedance polling logic.
   */
  async pollVideoTask(_taskId: string): Promise<VideoResult> {
    throw new Error(
      "[Seedance] Video polling not yet implemented. " +
      "Phase C will poll Seedance task status and download results.",
    );
  }

  /** Health check (always false until Phase C is implemented). */
  async testConnection(): Promise<boolean> {
    if (!this.apiUrl) return false;
    try {
      const res = await fetch(this.apiUrl, { method: "GET", signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}



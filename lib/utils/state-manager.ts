import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  EpisodeStateSchema,
  type EpisodeState,
  type EpisodeStatus,
  type EpisodeStep,
} from "../types/episode-state.js";
import type { Shot } from "../types/shots.js";
import { FileManager } from "./file-manager.js";

/**
 * Manages episode lifecycle state — persisted to `episodes/{id}/state.json`.
 *
 * Every mutation writes to disk immediately so the pipeline can be resumed
 * after an interruption.
 */
export class EpisodeStateManager {
  private readonly fm: FileManager;

  constructor(fm?: FileManager) {
    this.fm = fm ?? new FileManager();
  }

  /**
   * Create a new episode and persist its initial state.
   *
   * @returns The newly created EpisodeState.
   */
  async createEpisode(
    id: string,
    topic: string,
    options?: { duration?: number; style?: string; characterCount?: number },
  ): Promise<EpisodeState> {
    await this.fm.createEpisodeDir(id);

    const now = new Date().toISOString();
    const state: EpisodeState = {
      id,
      topic,
      status: "created",
      currentStep: "init",
      progress: 0,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      errors: [],
      audioPaths: {},
      options,
    };

    await this.persist(state);
    return state;
  }

  /** Update an episode's state and persist to disk. */
  async updateState(
    episodeId: string,
    update: {
      status?: EpisodeStatus;
      currentStep?: EpisodeStep;
      progress?: number;
      error?: string;
    },
  ): Promise<EpisodeState> {
    const state = await this.getState(episodeId);
    if (update.status) state.status = update.status;
    if (update.currentStep) state.currentStep = update.currentStep;
    if (update.progress !== undefined) state.progress = update.progress;
    if (update.error) {
      state.errors.push(update.error);
    }
    state.updatedAt = new Date().toISOString();
    await this.persist(state);
    return state;
  }

  /** Read the current state from disk. Throws if not found. */
  async getState(episodeId: string): Promise<EpisodeState> {
    const filePath = this.fm.getStatePath(episodeId);
    const raw = await readFile(filePath, "utf-8");
    const json = JSON.parse(raw) as unknown;
    return EpisodeStateSchema.parse(json);
  }

  /** List all episode IDs. */
  async listEpisodes(): Promise<string[]> {
    return this.fm.listEpisodes();
  }

  /** Get shots that can be retried (status "failed" with retryCount < 3). */
  async getRetryableShots(episodeId: string): Promise<Shot[]> {
    const shotsPath = join(this.fm.getEpisodeDir(episodeId), "shots.json");
    try {
      const raw = await readFile(shotsPath, "utf-8");
      const json = JSON.parse(raw) as { shots: Shot[] };
      return json.shots.filter(
        (s) => s.status === "failed" && s.retryCount < 3,
      );
    } catch {
      return [];
    }
  }

  /** Persist state to disk. */
  private async persist(state: EpisodeState): Promise<void> {
    const dir = this.fm.getEpisodeDir(state.id);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, "state.json");
    await writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
  }
}

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { EpisodeStateSchema, } from "../types/episode-state.js";
import { FileManager } from "./file-manager.js";
/**
 * Manages episode lifecycle state — persisted to `episodes/{id}/state.json`.
 *
 * Every mutation writes to disk immediately so the pipeline can be resumed
 * after an interruption.
 */
export class EpisodeStateManager {
    fm;
    constructor(fm) {
        this.fm = fm ?? new FileManager();
    }
    /**
     * Create a new episode and persist its initial state.
     *
     * @returns The newly created EpisodeState.
     */
    async createEpisode(id, topic, options) {
        await this.fm.createEpisodeDir(id);
        const now = new Date().toISOString();
        const state = {
            id,
            topic,
            status: "created",
            currentStep: "init",
            progress: 0,
            createdAt: now,
            updatedAt: now,
            retryCount: 0,
            errors: [],
            options,
        };
        await this.persist(state);
        return state;
    }
    /** Update an episode's state and persist to disk. */
    async updateState(episodeId, update) {
        const state = await this.getState(episodeId);
        if (update.status)
            state.status = update.status;
        if (update.currentStep)
            state.currentStep = update.currentStep;
        if (update.progress !== undefined)
            state.progress = update.progress;
        if (update.error) {
            state.errors.push(update.error);
        }
        state.updatedAt = new Date().toISOString();
        await this.persist(state);
        return state;
    }
    /** Read the current state from disk. Throws if not found. */
    async getState(episodeId) {
        const filePath = this.fm.getStatePath(episodeId);
        const raw = await readFile(filePath, "utf-8");
        const json = JSON.parse(raw);
        return EpisodeStateSchema.parse(json);
    }
    /** List all episode IDs. */
    async listEpisodes() {
        return this.fm.listEpisodes();
    }
    /** Get shots that can be retried (status "failed" with retryCount < 3). */
    async getRetryableShots(episodeId) {
        const shotsPath = join(this.fm.getEpisodeDir(episodeId), "shots.json");
        try {
            const raw = await readFile(shotsPath, "utf-8");
            const json = JSON.parse(raw);
            return json.shots.filter((s) => s.status === "failed" && s.retryCount < 3);
        }
        catch {
            return [];
        }
    }
    /** Persist state to disk. */
    async persist(state) {
        const dir = this.fm.getEpisodeDir(state.id);
        await mkdir(dir, { recursive: true });
        const filePath = join(dir, "state.json");
        await writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
    }
}
//# sourceMappingURL=state-manager.js.map
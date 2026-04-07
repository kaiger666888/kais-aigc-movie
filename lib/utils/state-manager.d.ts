import { type EpisodeState, type EpisodeStatus, type EpisodeStep } from "../types/episode-state.js";
import type { Shot } from "../types/shots.js";
import { FileManager } from "./file-manager.js";
/**
 * Manages episode lifecycle state — persisted to `episodes/{id}/state.json`.
 *
 * Every mutation writes to disk immediately so the pipeline can be resumed
 * after an interruption.
 */
export declare class EpisodeStateManager {
    private readonly fm;
    constructor(fm?: FileManager);
    /**
     * Create a new episode and persist its initial state.
     *
     * @returns The newly created EpisodeState.
     */
    createEpisode(id: string, topic: string, options?: {
        duration?: number;
        style?: string;
        characterCount?: number;
    }): Promise<EpisodeState>;
    /** Update an episode's state and persist to disk. */
    updateState(episodeId: string, update: {
        status?: EpisodeStatus;
        currentStep?: EpisodeStep;
        progress?: number;
        error?: string;
    }): Promise<EpisodeState>;
    /** Read the current state from disk. Throws if not found. */
    getState(episodeId: string): Promise<EpisodeState>;
    /** List all episode IDs. */
    listEpisodes(): Promise<string[]>;
    /** Get shots that can be retried (status "failed" with retryCount < 3). */
    getRetryableShots(episodeId: string): Promise<Shot[]>;
    /** Persist state to disk. */
    private persist;
}
//# sourceMappingURL=state-manager.d.ts.map
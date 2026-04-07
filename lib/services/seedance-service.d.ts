/**
 * Seedance video generation service (Phase C — stub).
 *
 * Currently only prepares video tasks and ambience track plans.
 * Actual video generation calls are placeholder stubs to be implemented later.
 */
import type { Shot } from "../types/shots.js";
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
export declare class SeedanceService {
    private apiUrl;
    private apiKey;
    private defaultRatio;
    private defaultDuration;
    constructor(options?: {
        apiUrl?: string;
        apiKey?: string;
    });
    /** Create from Config. */
    static fromConfig(cfg: {
        seedance: {
            apiUrl: string;
            apiKey: string;
            ratio: string;
            duration: number;
        };
    }): SeedanceService;
    /**
     * Prepare video generation tasks from shots.
     * Called during Phase A to generate video_tasks.json.
     */
    prepareVideoTasks(shots: Shot[], imagesDir: string): VideoTask[];
    /**
     * Plan ambience tracks by grouping shots via sceneGroupId.
     * Shots in the same group share one ambience audio segment.
     */
    prepareAmbienceTrack(shots: Shot[]): AmbienceTrack[];
    /** Save video tasks to a JSON file. */
    saveTasks(tasks: VideoTask[], filePath: string): void;
    /** Load video tasks from a JSON file. */
    loadTasks(filePath: string): VideoTask[];
    /**
     * Submit a video generation task to Seedance.
     * TODO: Implement actual Seedance API call.
     */
    submitVideoTask(_task: VideoTask): Promise<string>;
    /**
     * Poll a video generation task until completion.
     * TODO: Implement actual Seedance polling logic.
     */
    pollVideoTask(_taskId: string): Promise<VideoResult>;
    /** Health check (always false until Phase C is implemented). */
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=seedance-service.d.ts.map
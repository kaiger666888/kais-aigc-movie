import type { VideoGenerator, VideoOptions } from "./video-generator.js";
/** Options for text-to-video generation */
export interface KlingSubmitOptions {
    /** Duration in seconds: "5" or "10" */
    duration?: string;
    /** Aspect ratio: "16:9" (default) or "9:16" */
    aspectRatio?: string;
    /** Model name (default "kling-v2-master") */
    model?: string;
}
/** Response from task submission */
export interface KlingTaskResponse {
    code: number;
    message: string;
    data: {
        task_id: string;
    };
}
/** Response from task polling */
export interface KlingTaskResult {
    code: number;
    message: string;
    data: {
        task_id: string;
        task_status: string;
        task_result?: {
            videos?: Array<{
                url: string;
                duration: string;
            }>;
            task_status: string;
        };
    };
}
/**
 * Kling 3.0 API Service.
 *
 * Handles async video generation with JWT (HS256) authentication,
 * concurrency control, exponential backoff retries, and timeout protection.
 */
export declare class KlingApiService implements VideoGenerator {
    private readonly baseUrl;
    private readonly auth;
    private readonly maxConcurrent;
    private readonly maxRetries;
    private readonly shotTimeoutMs;
    private readonly pollIntervalMs;
    /** Active request counter for concurrency control */
    private activeCount;
    /** Resolvers waiting for a slot */
    private waitQueue;
    constructor();
    /**
     * Verify API credentials by calling a lightweight endpoint.
     * Does not consume generation quota.
     *
     * @returns `true` if authentication succeeds, `false` otherwise.
     */
    testConnection(): Promise<boolean>;
    /**
     * Submit a text-to-video generation task.
     *
     * @param prompt - Visual description in English for video generation.
     * @param options - Duration, aspect ratio, model overrides.
     * @returns The task_id for polling.
     */
    submitTask(prompt: string, options?: KlingSubmitOptions): Promise<string>;
    /**
     * Poll a task until it completes, fails, or times out.
     *
     * @param taskId - The task ID from submitTask.
     * @returns The final task result.
     * @throws On task failure or timeout.
     */
    pollTask(taskId: string): Promise<KlingTaskResult>;
    /**
     * Submit a task, poll until complete, and download the video.
     * Includes exponential backoff retries on submission failure.
     *
     * @param prompt - Visual description.
     * @param outputDir - Directory to save the video.
     * @param filename - Output filename (without extension).
     * @param options - Generation options.
     * @returns Path to the downloaded video file.
     */
    submitAndDownload(prompt: string, outputDir: string, filename: string, options?: VideoOptions | KlingSubmitOptions): Promise<string>;
    private acquireSlot;
    private releaseSlot;
}
//# sourceMappingURL=kling-api.d.ts.map
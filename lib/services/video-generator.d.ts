/**
 * Unified video generation interface.
 * Implemented by ComfyUIService (Wan2.2) and KlingApiService.
 */
/** Options for video generation */
export interface VideoOptions {
    /** Duration in seconds (default 5) */
    duration?: number;
    /** Aspect ratio: "16:9" (default), "9:16", "1:1" */
    aspectRatio?: string;
    /** Resolution: "480p", "720p" (default), "1080p" */
    resolution?: string;
    /** Model name override */
    model?: string;
}
/**
 * Unified video generator interface.
 * Both ComfyUI and Kling backends implement this.
 */
export interface VideoGenerator {
    /**
     * Submit a text-to-video task, wait for completion, and download the result.
     * @param prompt - Visual description (English).
     * @param outputDir - Directory to save the video.
     * @param filename - Output filename (without extension).
     * @param options - Generation options.
     * @returns Absolute path to the downloaded video file.
     */
    submitAndDownload(prompt: string, outputDir: string, filename: string, options?: VideoOptions): Promise<string>;
    /**
     * Verify connectivity without consuming GPU/API quota.
     * @returns true if the backend is reachable and configured correctly.
     */
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=video-generator.d.ts.map
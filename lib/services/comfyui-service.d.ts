import type { VideoGenerator, VideoOptions } from "./video-generator.js";
export interface ComfyUIOptions {
    host: string;
    port: number;
    workflowPath?: string;
    model?: string;
}
/**
 * ComfyUI backend for video generation using Wan2.2 T2V models.
 *
 * API flow:
 * 1. POST /prompt — submit workflow
 * 2. Poll GET /history/{prompt_id} — wait for completion
 * 3. GET /view?filename=...&type=output — download video
 */
export declare class ComfyUIService implements VideoGenerator {
    private readonly baseUrl;
    private readonly workflowPath?;
    private readonly defaultModel;
    constructor(options: ComfyUIOptions);
    testConnection(): Promise<boolean>;
    submitAndDownload(prompt: string, outputDir: string, filename: string, options?: VideoOptions): Promise<string>;
    private loadWorkflow;
    /**
     * Patch a loaded workflow JSON with the given parameters.
     * Tries to find known node types and update their inputs.
     */
    private patchWorkflow;
    private submitPrompt;
    private pollHistory;
    private downloadOutput;
}
//# sourceMappingURL=comfyui-service.d.ts.map
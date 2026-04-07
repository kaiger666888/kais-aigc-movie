/**
 * Jimeng (即梦) image generation service.
 *
 * Generates first/last frame images for each storyboard shot.
 * Features rate-limiting protection (anti-429) and character/style consistency
 * via image-to-image mode with reference images.
 */
import type { Config } from "../config.js";
export interface JimengOptions {
    /** Model name (default: jimeng-5.0) */
    model?: string;
    /** Aspect ratio, e.g. "16:9", "9:16" (default: from config) */
    ratio?: string;
    /** Resolution, e.g. "2k" (default: from config) */
    resolution?: string;
    /** Sample strength for image-to-image (0–1) */
    sampleStrength?: number;
}
export interface ImageResult {
    url: string;
    revisedPrompt?: string;
}
export declare class JimengService {
    private apiUrl;
    private sessionId;
    private defaultModel;
    private defaultRatio;
    private defaultResolution;
    private baseDelayMs;
    private jitterRangeMs;
    private maxConcurrent;
    private maxRetries;
    private requestTimeoutMs;
    private backoffBaseMs;
    private backoffJitterMs;
    constructor(options?: {
        apiUrl?: string;
        sessionId?: string;
    });
    /** Create a JimengService pre-configured from the global Config. */
    static fromConfig(cfg: Config): JimengService;
    testConnection(): Promise<boolean>;
    textToImage(prompt: string, options?: JimengOptions): Promise<ImageResult[]>;
    imageToImage(prompt: string, refImages: string[], options?: JimengOptions): Promise<ImageResult[]>;
    batchTextToImage(items: Array<{
        id: string;
        prompt: string;
        options?: JimengOptions;
    }>, outputDir: string): Promise<Map<string, string>>;
    downloadImage(url: string, outputDir: string, filename: string): Promise<string>;
    /**
     * Download all images from a generation batch, use GLM-4V to pick the best,
     * save it as `outputFilename`, and clean up the rest.
     *
     * @param images  Array of {url} from textToImage/imageToImage
     * @param outputDir  Where to save the winner
     * @param outputFilename  e.g. "shot_1_first.png"
     * @param sceneDescription  The shot's imagePrompt for context (what we want)
     * @returns Path to the selected image, or null if all fail
     */
    selectBestImage(images: ImageResult[], outputDir: string, outputFilename: string, sceneDescription: string): Promise<string | null>;
    /**
     * Ask GLM-4V to evaluate and pick the best image.
     * Returns the index of the best image (0-based).
     */
    private askVisionModel;
    private headers;
    private postWithRetry;
    private rateLimitDelay;
}
//# sourceMappingURL=jimeng-service.d.ts.map
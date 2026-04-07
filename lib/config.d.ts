import { z } from "zod";
import type { VideoGenerator } from "./services/video-generator.js";
/** Library configuration, validated from environment variables */
declare const ConfigSchema: z.ZodObject<{
    /** Video generation backend */
    videoBackend: z.ZodDefault<z.ZodEnum<["comfyui", "kling"]>>;
    /** GLM-TTS configuration */
    glm: z.ZodObject<{
        /** GLM-TTS API key (Bearer token) */
        ttsApiKey: z.ZodDefault<z.ZodString>;
        /** GLM-TTS endpoint */
        ttsEndpoint: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ttsApiKey: string;
        ttsEndpoint: string;
    }, {
        ttsApiKey?: string | undefined;
        ttsEndpoint?: string | undefined;
    }>;
    /** Kling API configuration */
    kling: z.ZodObject<{
        /** Kling API Access Key */
        accessKey: z.ZodDefault<z.ZodString>;
        /** Kling API Secret Key */
        secretKey: z.ZodDefault<z.ZodString>;
        /** Kling API base URL */
        apiUrl: z.ZodDefault<z.ZodString>;
        /** Max parallel video generation tasks */
        maxConcurrent: z.ZodDefault<z.ZodNumber>;
        /** Max retries per shot */
        maxRetries: z.ZodDefault<z.ZodNumber>;
        /** Per-shot timeout in ms */
        shotTimeoutMs: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        accessKey: string;
        secretKey: string;
        apiUrl: string;
        maxConcurrent: number;
        maxRetries: number;
        shotTimeoutMs: number;
    }, {
        accessKey?: string | undefined;
        secretKey?: string | undefined;
        apiUrl?: string | undefined;
        maxConcurrent?: number | undefined;
        maxRetries?: number | undefined;
        shotTimeoutMs?: number | undefined;
    }>;
    /** Jimeng (即梦) image generation configuration */
    jimeng: z.ZodObject<{
        /** Jimeng API base URL */
        apiUrl: z.ZodDefault<z.ZodString>;
        /** Jimeng session ID (Bearer token) */
        sessionId: z.ZodDefault<z.ZodString>;
        /** Default model */
        model: z.ZodDefault<z.ZodString>;
        /** Default aspect ratio */
        ratio: z.ZodDefault<z.ZodString>;
        /** Default resolution */
        resolution: z.ZodDefault<z.ZodString>;
        /** Base delay between requests in ms (anti-rate-limit) */
        baseDelayMs: z.ZodDefault<z.ZodNumber>;
        /** Jitter range in ms */
        jitterRangeMs: z.ZodDefault<z.ZodNumber>;
        /** Max concurrent requests */
        maxConcurrent: z.ZodDefault<z.ZodNumber>;
        /** Max retries per request */
        maxRetries: z.ZodDefault<z.ZodNumber>;
        /** Request timeout in ms */
        requestTimeoutMs: z.ZodDefault<z.ZodNumber>;
        /** 429 backoff base in ms */
        backoffBaseMs: z.ZodDefault<z.ZodNumber>;
        /** 429 backoff jitter in ms */
        backoffJitterMs: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        apiUrl: string;
        maxConcurrent: number;
        maxRetries: number;
        sessionId: string;
        model: string;
        ratio: string;
        resolution: string;
        baseDelayMs: number;
        jitterRangeMs: number;
        requestTimeoutMs: number;
        backoffBaseMs: number;
        backoffJitterMs: number;
    }, {
        apiUrl?: string | undefined;
        maxConcurrent?: number | undefined;
        maxRetries?: number | undefined;
        sessionId?: string | undefined;
        model?: string | undefined;
        ratio?: string | undefined;
        resolution?: string | undefined;
        baseDelayMs?: number | undefined;
        jitterRangeMs?: number | undefined;
        requestTimeoutMs?: number | undefined;
        backoffBaseMs?: number | undefined;
        backoffJitterMs?: number | undefined;
    }>;
    /** Seedance video generation configuration */
    seedance: z.ZodObject<{
        /** Seedance API base URL */
        apiUrl: z.ZodDefault<z.ZodString>;
        /** Seedance API key */
        apiKey: z.ZodDefault<z.ZodString>;
        /** Default aspect ratio for video */
        ratio: z.ZodDefault<z.ZodString>;
        /** Default duration per shot in seconds */
        duration: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        apiUrl: string;
        ratio: string;
        apiKey: string;
        duration: number;
    }, {
        apiUrl?: string | undefined;
        ratio?: string | undefined;
        apiKey?: string | undefined;
        duration?: number | undefined;
    }>;
    /** ComfyUI configuration */
    comfyui: z.ZodObject<{
        /** ComfyUI host */
        host: z.ZodDefault<z.ZodString>;
        /** ComfyUI port */
        port: z.ZodDefault<z.ZodNumber>;
        /** Optional custom workflow JSON path */
        workflowPath: z.ZodOptional<z.ZodString>;
        /** Model name */
        model: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        model: string;
        host: string;
        port: number;
        workflowPath?: string | undefined;
    }, {
        model?: string | undefined;
        host?: string | undefined;
        port?: number | undefined;
        workflowPath?: string | undefined;
    }>;
    /** File paths */
    paths: z.ZodObject<{
        /** Root directory for episode data */
        episodesDir: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        episodesDir: string;
    }, {
        episodesDir?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    comfyui: {
        model: string;
        host: string;
        port: number;
        workflowPath?: string | undefined;
    };
    kling: {
        accessKey: string;
        secretKey: string;
        apiUrl: string;
        maxConcurrent: number;
        maxRetries: number;
        shotTimeoutMs: number;
    };
    videoBackend: "comfyui" | "kling";
    glm: {
        ttsApiKey: string;
        ttsEndpoint: string;
    };
    jimeng: {
        apiUrl: string;
        maxConcurrent: number;
        maxRetries: number;
        sessionId: string;
        model: string;
        ratio: string;
        resolution: string;
        baseDelayMs: number;
        jitterRangeMs: number;
        requestTimeoutMs: number;
        backoffBaseMs: number;
        backoffJitterMs: number;
    };
    seedance: {
        apiUrl: string;
        ratio: string;
        apiKey: string;
        duration: number;
    };
    paths: {
        episodesDir: string;
    };
}, {
    comfyui: {
        model?: string | undefined;
        host?: string | undefined;
        port?: number | undefined;
        workflowPath?: string | undefined;
    };
    kling: {
        accessKey?: string | undefined;
        secretKey?: string | undefined;
        apiUrl?: string | undefined;
        maxConcurrent?: number | undefined;
        maxRetries?: number | undefined;
        shotTimeoutMs?: number | undefined;
    };
    glm: {
        ttsApiKey?: string | undefined;
        ttsEndpoint?: string | undefined;
    };
    jimeng: {
        apiUrl?: string | undefined;
        maxConcurrent?: number | undefined;
        maxRetries?: number | undefined;
        sessionId?: string | undefined;
        model?: string | undefined;
        ratio?: string | undefined;
        resolution?: string | undefined;
        baseDelayMs?: number | undefined;
        jitterRangeMs?: number | undefined;
        requestTimeoutMs?: number | undefined;
        backoffBaseMs?: number | undefined;
        backoffJitterMs?: number | undefined;
    };
    seedance: {
        apiUrl?: string | undefined;
        ratio?: string | undefined;
        apiKey?: string | undefined;
        duration?: number | undefined;
    };
    paths: {
        episodesDir?: string | undefined;
    };
    videoBackend?: "comfyui" | "kling" | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
/** Check if ffmpeg/ffprobe is available on the system PATH. */
export declare function checkFFmpeg(): Promise<boolean>;
/**
 * Build and validate configuration from environment variables.
 * Throws if required variables are missing.
 */
export declare function loadConfig(): Config;
/** Get the global config instance (lazy-loaded). Warns if ffmpeg is missing. */
export declare function getConfig(): Config;
/**
 * Create a JimengService pre-configured from the global Config.
 */
export declare function createJimengService(): Promise<import("./services/jimeng-service.js").JimengService>;
/**
 * Create a SeedanceService pre-configured from the global Config.
 */
export declare function createSeedanceService(): Promise<import("./services/seedance-service.js").SeedanceService>;
/**
 * Create a VideoGenerator instance based on the VIDEO_BACKEND env var.
 * - "comfyui" → ComfyUIService (Wan2.2, default)
 * - "kling" → KlingApiService
 */
export declare function createVideoGenerator(): VideoGenerator;
export {};
//# sourceMappingURL=config.d.ts.map
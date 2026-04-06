import { z } from "zod";

/** Library configuration, validated from environment variables */
const ConfigSchema = z.object({
  /** GLM-TTS configuration */
  glm: z.object({
    /** GLM-TTS API key (Bearer token) */
    ttsApiKey: z.string().min(1, "GLM_TTS_API_KEY is required"),
    /** GLM-TTS endpoint */
    ttsEndpoint: z.string().default("https://open.bigmodel.cn/api/paas/v4/audio/speech"),
  }),
  /** Kling API configuration */
  kling: z.object({
    /** Kling API Access Key */
    accessKey: z.string().min(1, "KLING_ACCESS_KEY is required"),
    /** Kling API Secret Key */
    secretKey: z.string().min(1, "KLING_SECRET_KEY is required"),
    /** Kling API base URL */
    apiUrl: z.string().default("https://api.klingai.com"),
    /** Max parallel video generation tasks */
    maxConcurrent: z.number().int().min(1).max(5).default(2),
    /** Max retries per shot */
    maxRetries: z.number().int().min(1).max(5).default(3),
    /** Per-shot timeout in ms */
    shotTimeoutMs: z.number().default(300_000),
  }),
  /** File paths */
  paths: z.object({
    /** Root directory for episode data */
    episodesDir: z.string().default("./episodes"),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Check if ffmpeg/ffprobe is available on the system PATH. */
export async function checkFFmpeg(): Promise<boolean> {
  try {
    const { execFile } = await import("node:child_process");
    return await new Promise<boolean>((resolve) => {
      execFile("ffmpeg", ["-version"], (err) => resolve(!err));
    });
  } catch {
    return false;
  }
}

/**
 * Build and validate configuration from environment variables.
 * Throws if required variables are missing.
 */
export function loadConfig(): Config {
  const raw = {
    glm: {
      ttsApiKey: process.env.GLM_TTS_API_KEY ?? "",
      ttsEndpoint: process.env.GLM_TTS_ENDPOINT,
    },
    kling: {
      accessKey: process.env.KLING_ACCESS_KEY ?? "",
      secretKey: process.env.KLING_SECRET_KEY ?? "",
      apiUrl: process.env.KLING_API_URL,
      maxConcurrent: parseInt(process.env.KLING_MAX_CONCURRENT ?? "2", 10),
      maxRetries: parseInt(process.env.KLING_MAX_RETRIES ?? "3", 10),
      shotTimeoutMs: parseInt(process.env.KLING_SHOT_TIMEOUT_MS ?? "300000", 10),
    },
    paths: {
      episodesDir: process.env.EPISODES_DIR ?? "./episodes",
    },
  };

  return ConfigSchema.parse(raw);
}

/** Singleton — loaded once on first access */
let _config: Config | null = null;

/** Get the global config instance (lazy-loaded). Warns if ffmpeg is missing. */
export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
    // Non-blocking ffmpeg check
    checkFFmpeg().then((ok) => {
      if (!ok) {
        console.warn("[kais-aigc-movie] ⚠️  ffmpeg not found on PATH. Video operations will fail.");
        console.warn("[kais-aigc-movie]    Install ffmpeg: https://ffmpeg.org/download.html");
      }
    });
  }
  return _config;
}

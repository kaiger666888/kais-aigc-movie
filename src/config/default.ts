import { z } from "zod";

/** Full application configuration, validated at startup */
const AppConfigSchema = z.object({
  telegram: z.object({
    botToken: z.string().min(1, "BOT_TOKEN is required"),
    chatId: z.string().optional(),
  }),
  glm: z.object({
    /** GLM-TTS API key */
    ttsApiKey: z.string().min(1, "GLM_TTS_API_KEY is required"),
    /** GLM-TTS endpoint */
    ttsEndpoint: z.string().url(),
  }),
  kling: z.object({
    apiKey: z.string().min(1, "KLING_API_KEY is required"),
    apiEndpoint: z.string().url(),
    /** Max parallel video generation tasks */
    maxConcurrent: z.number().int().min(1).max(5).default(2),
    /** Max retries per shot */
    maxRetries: z.number().int().min(1).max(5).default(3),
    /** Per-shot timeout in ms */
    shotTimeoutMs: z.number().default(300_000),
  }),
  episode: z.object({
    maxShots: z.number().int().min(4).max(20).default(8),
    maxDuration: z.number().default(60),
    defaultStyle: z.string().default("comic"),
  }),
  paths: z.object({
    episodesDir: z.string().default("./episodes"),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * Build and validate configuration from environment variables.
 * Throws if required variables are missing.
 */
export function loadConfig(): AppConfig {
  const raw = {
    telegram: {
      botToken: process.env.BOT_TOKEN ?? "",
      chatId: process.env.TELEGRAM_CHAT_ID,
    },
    glm: {
      ttsApiKey: process.env.GLM_TTS_API_KEY ?? "",
      ttsEndpoint:
        process.env.GLM_TTS_ENDPOINT ??
        "https://open.bigmodel.cn/api/paas/v4/audio/speech",
    },
    kling: {
      apiKey: process.env.KLING_API_KEY ?? "",
      apiEndpoint:
        process.env.KLING_API_URL ?? "https://api.klingai.com/v1",
      maxConcurrent: parseInt(process.env.KLING_MAX_CONCURRENT ?? "2", 10),
      maxRetries: parseInt(process.env.KLING_MAX_RETRIES ?? "3", 10),
      shotTimeoutMs: parseInt(
        process.env.KLING_SHOT_TIMEOUT_MS ?? "300000",
        10,
      ),
    },
    episode: {
      maxShots: parseInt(process.env.EPISODE_MAX_SHOTS ?? "8", 10),
      maxDuration: parseInt(process.env.EPISODE_MAX_DURATION ?? "60", 10),
      defaultStyle: process.env.EPISODE_DEFAULT_STYLE ?? "comic",
    },
    paths: {
      episodesDir: process.env.EPISODES_DIR ?? "./episodes",
    },
  };

  return AppConfigSchema.parse(raw);
}

/** Singleton — loaded once at startup */
let _config: AppConfig | null = null;

/** Get the global config instance (lazy-loaded) */
export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

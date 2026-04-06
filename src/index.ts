import { createBot } from "./bot.js";
import { getConfig } from "./config/default.js";
import type { SpawnGlmFn } from "./agents/showrunner.js";

/**
 * Application entry point.
 *
 * Validates configuration and starts the Telegram bot.
 *
 * ## How GLM-5.1 is used
 *
 * The Writer agent needs GLM-5.1 for text generation (story + shots).
 * This is NOT a direct API call — it goes through OpenClaw's sub-agent
 * system via `sessions_spawn` with model `zai/glm-5.1`.
 *
 * When running INSIDE OpenClaw:
 *   The `spawnGlm` function is provided by the OpenClaw runtime.
 *   It calls sessions_spawn to delegate the task to a GLM-5.1 sub-agent.
 *
 * When running STANDALONE (for testing/dev):
 *   Pass a custom `spawnGlm` that calls the GLM API directly,
 *   or use a mock that returns sample data.
 */

/**
 * Default spawnGlm implementation for standalone mode.
 * In production, this is replaced by the OpenClaw sessions_spawn wrapper.
 */
function createStandaloneSpawnGlm(): SpawnGlmFn {
  const endpoint =
    process.env.GLM_CHAT_ENDPOINT ??
    "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const apiKey = process.env.GLM_CHAT_API_KEY ?? "";

  return async (task: string): Promise<string> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "glm-5.1",
        messages: [
          { role: "system", content: "你是一个专业的漫剧编剧。只输出 JSON。" },
          { role: "user", content: task },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "unknown");
      throw new Error(`GLM chat error ${res.status}: ${detail}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error("GLM returned empty content");
    return content;
  };
}

/**
 * Set the spawnGlm function externally (for OpenClaw integration).
 *
 * Usage in OpenClaw:
 * ```ts
 * import { setSpawnGlm } from "./index.js";
 * setSpawnGlm(async (task) => {
 *   // Use OpenClaw sessions_spawn to call GLM-5.1
 *   const session = await sessions_spawn({
 *     task,
 *     model: "zai/glm-5.1",
 *     mode: "run",
 *   });
 *   return session.result;
 * });
 * ```
 */
let _spawnGlm: SpawnGlmFn | null = null;

export function setSpawnGlm(fn: SpawnGlmFn): void {
  _spawnGlm = fn;
}

export function getSpawnGlm(): SpawnGlmFn {
  if (_spawnGlm) return _spawnGlm;
  return createStandaloneSpawnGlm();
}

async function main(): Promise<void> {
  console.log("🎬 kais-aigc-movie — AI Comic Drama Generator\n");

  try {
    getConfig();
    console.log("✅ Configuration loaded");
  } catch (err) {
    console.error(
      "❌ Configuration error:",
      err instanceof Error ? err.message : err,
    );
    console.error(
      "\nPlease set the required environment variables (see .env.example).",
    );
    process.exit(1);
  }

  const spawnGlm = getSpawnGlm();
  const bot = createBot(spawnGlm);

  try {
    await bot.start({
      onStart: (info) => {
        console.log(`🤖 Bot started as @${info.username}`);
        console.log(
          `📝 GLM-5.1: ${_spawnGlm ? "OpenClaw sub-agent" : "standalone API"}`,
        );
      },
    });
  } catch (err) {
    console.error(
      "❌ Failed to start bot:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

export {};

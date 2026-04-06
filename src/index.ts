import { createBot } from "./bot.js";
import { getConfig } from "./config/default.js";

/**
 * Application entry point.
 *
 * Validates configuration and starts the Telegram bot.
 */
async function main(): Promise<void> {
  console.log("🎬 kais-aigc-movie — AI Comic Drama Generator\n");

  // Validate configuration (throws on missing env vars)
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

  // Start the Telegram bot
  const bot = createBot();

  try {
    await bot.start({
      onStart: (info) => {
        console.log(`🤖 Bot started as @${info.username}`);
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

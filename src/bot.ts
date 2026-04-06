import { Bot, InputFile } from "grammy";
import { getConfig } from "./config/default.js";
import { Showrunner, type EpisodeProgressCallback } from "./agents/showrunner.js";

/**
 * Create and configure the Telegram bot.
 *
 * @param spawnGlm - Function to spawn a GLM-5.1 sub-agent via OpenClaw
 *                   sessions_spawn. This is injected by the OpenClaw
 *                   integration layer (index.ts).
 * @returns A configured grammy Bot instance (not yet started).
 */
export function createBot(spawnGlm: (task: string) => Promise<string>): Bot {
  const config = getConfig();
  const bot = new Bot(config.telegram.botToken);
  const showrunner = new Showrunner(spawnGlm);

  // ── /start ────────────────────────────────────────────────────
  bot.command("start", (ctx) => {
    ctx.reply(
      "🎬 *AI 漫剧生成器*\n\n" +
        "使用以下命令开始：\n" +
        "/new <主题> — 生成新的漫剧\n" +
        "/status <ID> — 查询任务状态\n" +
        "/resume <ID> — 恢复中断的任务\n" +
        "/list — 列出所有剧集",
      { parse_mode: "Markdown" },
    );
  });

  // ── /new <topic> ──────────────────────────────────────────────
  bot.command("new", async (ctx) => {
    const topic = ctx.match?.trim();
    if (!topic) {
      void ctx.reply("请提供主题，例如：`/new 一个程序员的一天`", {
        parse_mode: "Markdown",
      });
      return;
    }

    const chatId = ctx.chat.id;

    // Parse optional flags from the topic string
    const { cleanTopic, options } = parseNewCommand(topic);

    const sent = await ctx.reply(
      `🎬 开始生成：*${cleanTopic}*\n\n请稍候，这需要几分钟...`,
      { parse_mode: "Markdown" },
    );

    // Build progress callback that edits the status message
    const progressCb: EpisodeProgressCallback = async (
      step,
      progress,
      detail,
    ) => {
      try {
        const progressBar = buildProgressBar(progress);
        const stepEmoji = stepEmojis[step] ?? "⏳";
        const detailText = detail ? `\n${detail}` : "";
        await bot.api.editMessageText(
          chatId,
          sent.message_id,
          `${stepEmoji} *${cleanTopic}*\n\n${step} ${progressBar}${detailText}`,
          { parse_mode: "Markdown" },
        );
      } catch {
        // Ignore edit errors (rate limiting, message unchanged)
      }
    };

    // Run async — don't block the bot
    showrunner
      .runEpisode(cleanTopic, options, progressCb)
      .then(async (result) => {
        if (result.state.status === "done" && result.outputPath) {
          try {
            await bot.api.sendDocument(
              chatId,
              new InputFile(result.outputPath, "rough_cut.mp4"),
            );
          } catch {
            await bot.api.sendMessage(chatId, "⚠️ 视频生成成功但发送失败");
          }

          const qcSummary = result.qcReport
            ? formatQCSummary(result.qcReport)
            : "";
          await bot.api.sendMessage(
            chatId,
            `✅ *生成完成*\n\nID: \`${result.state.id}\`\n${qcSummary}`,
            { parse_mode: "Markdown" },
          );
        } else {
          await bot.api.sendMessage(
            chatId,
            `❌ *生成失败*\n\nID: \`${result.state.id}\`\n错误: ${result.state.errors.join("; ") || "未知错误"}\n\n使用 /resume ${result.state.id} 重试`,
            { parse_mode: "Markdown" },
          );
        }
      })
      .catch(async (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        await bot.api.sendMessage(chatId, `❌ 系统错误: ${msg}`).catch(() => {});
      });
  });

  // ── /status <episodeId> ───────────────────────────────────────
  bot.command("status", async (ctx) => {
    const episodeId = ctx.match?.trim();
    if (!episodeId) {
      void ctx.reply("请提供 episode ID，例如：`/status abc-123`", {
        parse_mode: "Markdown",
      });
      return;
    }

    try {
      const state = await showrunner.queryStatus(episodeId);
      const progressBar = buildProgressBar(state.progress);
      const statusEmoji = statusEmojis[state.status] ?? "❓";

      await ctx.reply(
        `${statusEmoji} *剧集状态*\n\n` +
          `ID: \`${state.id}\`\n` +
          `主题: ${state.topic}\n` +
          `状态: ${state.status}\n` +
          `步骤: ${state.currentStep}\n` +
          `进度: ${progressBar} ${state.progress}%\n` +
          `重试: ${state.retryCount}\n` +
          `创建: ${state.createdAt}\n` +
          `更新: ${state.updatedAt}` +
          (state.errors.length > 0
            ? `\n\n⚠️ 错误:\n${state.errors.map((e) => `• ${e}`).join("\n")}`
            : ""),
        { parse_mode: "Markdown" },
      );
    } catch {
      void ctx.reply(`未找到剧集: ${episodeId}`);
    }
  });

  // ── /resume <episodeId> ───────────────────────────────────────
  bot.command("resume", async (ctx) => {
    const episodeId = ctx.match?.trim();
    if (!episodeId) {
      void ctx.reply("请提供 episode ID，例如：`/resume abc-123`", {
        parse_mode: "Markdown",
      });
      return;
    }

    const chatId = ctx.chat.id;

    try {
      const state = await showrunner.queryStatus(episodeId);
      if (state.status !== "failed") {
        void ctx.reply(
          `剧集 ${episodeId} 当前状态为 ${state.status}，无需恢复。`,
        );
        return;
      }
    } catch {
      void ctx.reply(`未找到剧集: ${episodeId}`);
      return;
    }

    const sent = await ctx.reply(`🔄 恢复剧集 ${episodeId}...`);

    showrunner
      .resumeEpisode(episodeId, async (step, progress, detail) => {
        try {
          const progressBar = buildProgressBar(progress);
          const detailText = detail ? `\n${detail}` : "";
          await bot.api.editMessageText(
            chatId,
            sent.message_id,
            `🔄 恢复中: ${step} ${progressBar}${detailText}`,
          );
        } catch {
          // Ignore
        }
      })
      .then(async (result) => {
        if (result.state.status === "done" && result.outputPath) {
          try {
            await bot.api.sendDocument(
              chatId,
              new InputFile(result.outputPath, "rough_cut.mp4"),
            );
          } catch {
            // File send failed
          }
          await bot.api.sendMessage(chatId, "✅ 恢复完成！");
        } else {
          await bot.api.sendMessage(
            chatId,
            `❌ 恢复后仍然失败: ${result.state.errors.join("; ")}`,
          );
        }
      })
      .catch(async (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        await bot.api.sendMessage(chatId, `❌ 恢复错误: ${msg}`).catch(() => {});
      });
  });

  // ── /list ─────────────────────────────────────────────────────
  bot.command("list", async (ctx) => {
    try {
      const episodes = await showrunner.listEpisodes();

      if (episodes.length === 0) {
        void ctx.reply("暂无剧集。使用 /new <主题> 开始生成。");
        return;
      }

      const lines = await Promise.all(
        episodes.slice(0, 10).map(async (id) => {
          try {
            const state = await showrunner.queryStatus(id);
            const emoji = statusEmojis[state.status] ?? "❓";
            return `${emoji} \`${id}\` — ${state.topic} (${state.status})`;
          } catch {
            return `❓ \`${id}\` — 状态未知`;
          }
        }),
      );

      const footer =
        episodes.length > 10
          ? `\n\n... 共 ${episodes.length} 个剧集`
          : "";

      await ctx.reply(lines.join("\n") + footer, {
        parse_mode: "Markdown",
      });
    } catch {
      void ctx.reply("获取剧集列表失败");
    }
  });

  return bot;
}

/** Build a text progress bar */
function buildProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, empty));
}

/** Format a QC report summary for Telegram */
function formatQCSummary(report: { passed: boolean; overallScore: number; issues: Array<{ severity: string; description: string }> }): string {
  const lines = [
    `质检: ${report.passed ? "✅ 通过" : "❌ 未通过"}`,
    `评分: ${report.overallScore}/10`,
  ];
  if (report.issues.length > 0) {
    lines.push("问题:");
    for (const issue of report.issues.slice(0, 5)) {
      const icon =
        issue.severity === "critical"
          ? "🔴"
          : issue.severity === "warning"
            ? "🟡"
            : "🔵";
      lines.push(`  ${icon} ${issue.description}`);
    }
  }
  return lines.join("\n");
}

/** Parse /new command flags */
function parseNewCommand(raw: string): {
  cleanTopic: string;
  options: Record<string, number | string>;
} {
  const options: Record<string, number | string> = {};
  const parts = raw.split(/\s+/);
  const topicParts: string[] = [];

  let i = 0;
  while (i < parts.length) {
    const part = parts[i]!;
    if (part === "--duration" && parts[i + 1]) {
      options.duration = parseInt(parts[++i]!, 10);
    } else if (part === "--style" && parts[i + 1]) {
      options.style = parts[++i]!;
    } else if (part === "--characters" && parts[i + 1]) {
      options.characterCount = parseInt(parts[++i]!, 10);
    } else {
      topicParts.push(part);
    }
    i++;
  }

  return { cleanTopic: topicParts.join(" "), options };
}

const stepEmojis: Record<string, string> = {
  writing: "📝",
  voice: "🎙️",
  rendering: "🎥",
  editing: "🎞️",
  qc: "🔍",
  done: "✅",
  failed: "❌",
};

const statusEmojis: Record<string, string> = {
  created: "🆕",
  writing: "📝",
  voice_rendering: "🎙️🎥",
  editing: "🎞️",
  qc: "🔍",
  done: "✅",
  failed: "❌",
};

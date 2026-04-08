#!/usr/bin/env node
/**
 * kais-aigc-movie Pipeline — AI 漫剧全流程生成（三阶段）
 *
 * Usage:
 *   Phase A (素材生成):  node pipeline.mjs --topic "主题" --phase material [--shots 8] [--duration 50]
 *   Phase B (审核):      node pipeline.mjs --phase review --episode-dir ./episodes/xxx [--approve] [--fix-shot shot_id]
 *   Phase C (视频生成):   node pipeline.mjs --phase video --episode-dir ./episodes/xxx
 *
 * Resume:  node pipeline.mjs --phase material --resume ./episodes/xxx
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── CLI Args ──────────────────────────────────────────────

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    const next = process.argv[i + 1];
    if (key === "--topic" && next) args.topic = next;
    if (key === "--shots" && next) args.shotCount = parseInt(next);
    if (key === "--duration" && next) args.duration = parseInt(next);
    if (key === "--voice" && next) args.voice = next;
    if (key === "--style" && next) args.style = next;
    if (key === "--ratio" && next) args.ratio = next;
    if (key === "--phase" && next) args.phase = next;
    if (key === "--episode-dir" && next) args.episodeDir = next;
    if (key === "--resume" && next) args.resume = next;
    if (key === "--approve") args.approve = true;
    if (key === "--fix-shot" && next) args.fixShot = next;
    if (key === "--skip-writer") args.skipWriter = true;
    if (key === "--skip-images") args.skipImages = true;
    if (key === "--skip-voice") args.skipVoice = true;
    if (key === "--skip-music") args.skipMusic = true;
    if (key === "--dry-run") args.dryRun = true;
  }
  return args;
}

// ─── Utilities ─────────────────────────────────────────────

function log(msg) {
  const t = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  console.log(`[${t}] ${msg}`);
}

function genEpisodeId(topic) {
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const slug = topic.slice(0, 20).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_").slice(0, 15);
  return `ep_${ts}_${slug}`;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function saveJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

// ─── Phase A: Material Generation ──────────────────────────

async function phaseA(args) {
  let episodeDir;
  let state;

  if (args.resume) {
    episodeDir = args.resume;
    const statePath = join(episodeDir, "state.json");
    if (!existsSync(statePath)) {
      console.error("No state.json found in", episodeDir);
      process.exit(1);
    }
    state = loadJson(statePath);
    log(`Resuming episode: ${episodeDir}`);
  } else {
    if (!args.topic) {
      console.error("Usage: node pipeline.mjs --topic \"主题\" --phase material");
      process.exit(1);
    }
    const episodesBase = args.episodeDir || join(__dirname, "episodes");
    const episodeId = genEpisodeId(args.topic);
    episodeDir = join(episodesBase, episodeId);

    for (const sub of ["audio", "images", "assets"]) ensureDir(join(episodeDir, sub));

    state = {
      id: episodeId,
      topic: args.topic,
      phase: "material",
      status: "created",
      createdAt: new Date().toISOString(),
      steps: {
        writer: false,
        images: false,
        voice: false,
        music: false,
        subtitles: false,
        videoTasks: false,
        storyHtml: false,
        evaluation: false,
      },
      config: {
        shotCount: args.shotCount || 8,
        duration: args.duration || 50,
        voice: args.voice || "male-narrator",
        style: args.style || "comic",
        ratio: args.ratio || "9:16",
      },
    };
    saveJson(join(episodeDir, "state.json"), state);
    log(`New episode: ${episodeId} — "${args.topic}"`);
  }

  // ── Step 0: Quota Check ──
  if (!state.steps.writer) {
    log("💰 Step 0: Quota check...");
    try {
      const { QuotaManager } = await import("./lib/utils/quota-manager.js");
      const quota = new QuotaManager(join(episodeDir, ".."));
      const estimate = quota.estimateCredits(state.config.shotCount);
      log(`  Estimated: ${estimate.jimengCreditsNeeded} Jimeng credits, ${estimate.seedanceCreditsNeeded} Seedance credits`);
      if (!estimate.canAfford) {
        log(`  ⚠️  ${estimate.reason}`);
        log(`  Continuing anyway (for dry-run / testing)...`);
      }
    } catch (e) {
      log(`  ⚠️  Quota check skipped: ${e.message}`);
    }
  }

  // ── Step 1: Writer ──
  if (!state.steps.writer && !args.skipWriter) {
    log("📝 Step 1: Writer — Generating script...");
    const prompt = readFileSync(join(__dirname, "prompts", "writer-prompt.md"), "utf-8")
      .replace("{TOPIC}", state.topic)
      .replace("{DURATION}", state.config.duration)
      .replace("{SHOT_COUNT}", state.config.shotCount)
      .replace("{STYLE}", state.config.style)
      .replace("{RATIO}", state.config.ratio);

    const writerPrompt = `${prompt}\n\n请严格按照上述 JSON 格式输出，不要添加任何其他文字。将完整的 JSON 写入文件: ${join(episodeDir, "script.json")}`;
    writeFileSync(join(episodeDir, "writer-prompt.txt"), writerPrompt);

    state.status = "writing";
    saveJson(join(episodeDir, "state.json"), state);
    log(`Writer prompt saved. WRITER_PENDING: 请使用 GLM 读取并生成 script.json`);
    log(`预期输出: ${join(episodeDir, "script.json")}`);

    if (!args.dryRun && !existsSync(join(episodeDir, "script.json"))) {
      log("❌ script.json 不存在，无法继续。请先完成 Writer 步骤。");
      process.exit(0);
    }
  }

  // Load script
  const scriptPath = join(episodeDir, "script.json");
  if (!existsSync(scriptPath)) {
    log("❌ script.json 不存在，请先完成 Writer 步骤。");
    process.exit(1);
  }

  let script;
  try {
    script = loadJson(scriptPath);
  } catch (e) {
    log(`❌ script.json parse error: ${e.message}`);
    process.exit(1);
  }

  const storyBible = script.storyBible;
  const shots = script.shots?.shots || script.shots || [];
  log(`📋 Story: "${storyBible?.title}" — ${shots.length} shots`);

  // Save extracted files
  if (!existsSync(join(episodeDir, "story_bible.json"))) {
    saveJson(join(episodeDir, "story_bible.json"), storyBible);
  }
  if (!existsSync(join(episodeDir, "shots.json"))) {
    saveJson(join(episodeDir, "shots.json"), { shots });
  }
  state.steps.writer = true;

  // ── Step 2: Image Generation (Jimeng) ──
  if (!state.steps.images && !args.skipImages) {
    log("🎨 Step 2: Image Generation (Jimeng)...");
    state.status = "generating-images";
    saveJson(join(episodeDir, "state.json"), state);

    try {
      const { createJimengService } = await import("./lib/config.js");
      const { CharacterManager } = await import("./lib/utils/character-manager.js");
      const { StyleManager } = await import("./lib/utils/style-manager.js");

      const jimeng = await createJimengService();
      const charMgr = new CharacterManager();
      const styleMgr = new StyleManager();
      const charRefDir = join(episodeDir, "assets");
      const imagesDir = join(episodeDir, "images");

      // Build character/style prompt suffixes
      const profiles = charMgr.extractCharacterProfiles(shots);
      const charSuffix = charMgr.buildCharacterPromptSuffix(profiles);
      const styleSuffix = styleMgr.buildStylePromptSuffix(state.config.style);

      let isFirstShot = true;
      for (const shot of shots) {
        const firstPath = join(imagesDir, `${shot.id}_first.png`);
        const lastPath = join(imagesDir, `${shot.id}_last.png`);

        if (existsSync(firstPath) && existsSync(lastPath)) {
          log(`  ✅ ${shot.id} images exist, skipping`);
          continue;
        }

        const basePrompt = [shot.imagePrompt ?? "", charSuffix, styleSuffix].filter(Boolean).join("，");

        if (isFirstShot) {
          // First shot: text-to-image (pure text)
          log(`  🖼️  ${shot.id}: text-to-image (first shot, will save as ref)`);
          try {
            const results = await jimeng.textToImage(basePrompt, { ratio: state.config.ratio });
            if (results.length > 0) {
              const selected = await jimeng.selectBestImage(results, imagesDir, `${shot.id}_first.png`, shot.imagePrompt);
              if (selected) {
                // Save as character + style reference
                await charMgr.saveCharacterRef(selected, charRefDir);
                await styleMgr.saveStyleRef(selected, charRefDir);
                log(`  ✅ ${shot.id} first frame + refs saved`);
              }
            }
          } catch (e) {
            log(`  ⚠️  ${shot.id} first frame failed: ${e.message}`);
          }

          // Last frame for first shot
          if (shot.lastFramePrompt) {
            const lastPrompt = [shot.lastFramePrompt, charSuffix, styleSuffix].filter(Boolean).join("，");
            try {
              const results = await jimeng.textToImage(lastPrompt, { ratio: state.config.ratio });
              if (results.length > 0) {
                await jimeng.selectBestImage(results, imagesDir, `${shot.id}_last.png`, shot.lastFramePrompt);
                log(`  ✅ ${shot.id} last frame saved`);
              }
            } catch (e) {
              log(`  ⚠️  ${shot.id} last frame failed: ${e.message}`);
            }
          }

          isFirstShot = false;
        } else {
          // Subsequent shots: text-to-image with character/style prompt suffixes
          log(`  🖼️  ${shot.id}: text-to-image (with character/style prompts)`);

          try {
            const results = await jimeng.textToImage(basePrompt, { ratio: state.config.ratio });
            if (results.length > 0) {
              await jimeng.selectBestImage(results, imagesDir, `${shot.id}_first.png`, shot.imagePrompt);
              log(`  ✅ ${shot.id} first frame saved`);
            }
          } catch (e) {
            log(`  ⚠️  ${shot.id} first frame failed: ${e.message}`);
          }

          // Last frame
          if (shot.lastFramePrompt) {
            const lastPrompt = [shot.lastFramePrompt, charSuffix, styleSuffix].filter(Boolean).join("，");
            try {
              const results = await jimeng.textToImage(lastPrompt, { ratio: state.config.ratio });
              if (results.length > 0) {
                await jimeng.selectBestImage(results, imagesDir, `${shot.id}_last.png`, shot.lastFramePrompt);
                log(`  ✅ ${shot.id} last frame saved`);
              }
            } catch (e) {
              log(`  ⚠️  ${shot.id} last frame failed: ${e.message}`);
            }
          }
        }
      }

      state.steps.images = true;
      log("✅ Image generation complete");
    } catch (e) {
      log(`❌ Image generation failed: ${e.message}`);
    }
  }

  // ── Step 3: Voice (GLM-TTS) ──
  if (!state.steps.voice && !args.skipVoice) {
    log("🎤 Step 3: Voice — GLM-TTS...");
    state.status = "voice";
    saveJson(join(episodeDir, "state.json"), state);

    try {
      const { GlmTtsService } = await import("./lib/services/glm-tts.js");
      const tts = new GlmTtsService();

      // Group shots by sceneGroupId for batch TTS
      const groups = new Map();
      for (const shot of shots) {
        const gid = shot.sceneGroupId ?? "default";
        if (!groups.has(gid)) groups.set(gid, []);
        groups.get(gid).push(shot);
      }

      for (const [gid, groupShots] of groups) {
        const combinedText = groupShots.map((s) => s.subtitle).join(" ");
        const audioDir = join(episodeDir, "audio");

        try {
          log(`  🎙️  Scene group "${gid}": ${groupShots.length} shots → combined TTS`);
          const voiceId = state.config.voice || "male-narrator";
          const buffer = await tts.synthesize(combinedText, { voice: voiceId, speed: 1.0 });
          // Save combined audio for the group
          writeFileSync(join(audioDir, `${gid}_combined.wav`), buffer);
          log(`  ✅ ${gid}_combined.wav: ${(buffer.length / 1024).toFixed(1)}KB`);
        } catch (e) {
          log(`  ⚠️  TTS failed for group "${gid}": ${e.message}`);
          // Fallback: per-shot TTS
          for (const shot of groupShots) {
            if (!shot.subtitle) continue;
            const audioPath = join(audioDir, `${shot.id}.wav`);
            if (existsSync(audioPath)) continue;
            try {
              const buffer = await tts.synthesize(shot.subtitle, { voice: state.config.voice || "male-narrator" });
              writeFileSync(audioPath, buffer);
              log(`  ✅ ${shot.id}: ${(buffer.length / 1024).toFixed(1)}KB`);
            } catch (e2) {
              log(`  ⚠️  ${shot.id} TTS failed: ${e2.message}`);
            }
          }
        }
      }

      state.steps.voice = true;
      log("✅ Voice synthesis complete");
    } catch (e) {
      log(`❌ Voice synthesis failed: ${e.message}`);
    }
  }

  // ── Step 4: Music Search ──
  if (!state.steps.music && !args.skipMusic) {
    log("🎵 Step 4: Music search...");
    try {
      const { MusicService } = await import("./lib/services/music-service.js");
      const music = new MusicService();
      const ms = storyBible?.bgmStyle ?? storyBible?.musicStyle ?? {};
      const musicStyle = typeof ms === "string" ? ms : `${ms.mood || "warm"} ${ms.genre || "piano"} background`;
      const query = music.buildSearchQuery({ style: musicStyle });
      log(`  Search query: ${query}`);
      log(`  ⚠️  MUSIC_SEARCH_PENDING: 请使用 web_search 搜索并下载到 ${join(episodeDir, "assets", "bgm.mp3")}`);

      if (existsSync(join(episodeDir, "assets", "bgm.mp3"))) {
        state.steps.music = true;
        log("  ✅ BGM already exists");
      }
    } catch (e) {
      log(`  ⚠️  Music search skipped: ${e.message}`);
    }
  }

  // ── Step 5: Subtitles ──
  if (!state.steps.subtitles) {
    log("📝 Step 5: Subtitle generation...");
    try {
      const { generateSRT } = await import("./lib/utils/subtitle-generator.js");
      const srtContent = generateSRT(shots);
      const srtPath = join(episodeDir, "subtitles.srt");
      writeFileSync(srtPath, srtContent);
      state.steps.subtitles = true;
      log(`  ✅ Subtitles saved: ${srtPath}`);
    } catch (e) {
      log(`  ⚠️  Subtitle generation failed: ${e.message}`);
    }
  }

  // ── Step 6: Video Tasks (dynamic shots only) ──
  if (!state.steps.videoTasks) {
    log("📋 Step 6: Prepare video tasks...");
    try {
      const { SeedanceService } = await import("./lib/services/seedance-service.js");
      const seedance = new SeedanceService();
      const imagesDir = join(episodeDir, "images");

      // Log shot type distribution
      const dynamicShots = shots.filter((s) => (s.shotType ?? "dynamic") === "dynamic");
      const staticShots = shots.filter((s) => (s.shotType ?? "dynamic") === "static");
      const lipSyncShots = shots.filter((s) => (s.shotType ?? "dynamic") === "lipSync");
      log(`  📊 Shot types: ${dynamicShots.length} dynamic, ${staticShots.length} static, ${lipSyncShots.length} lipSync`);

      const tasks = seedance.prepareVideoTasks(shots, imagesDir);
      seedance.saveTasks(tasks, join(episodeDir, "video_tasks.json"));
      state.steps.videoTasks = true;
      log(`  ✅ ${tasks.length} dynamic video tasks saved (${staticShots.length + lipSyncShots.length} shots skip Seedance)`);
    } catch (e) {
      log(`  ⚠️  Video task prep failed: ${e.message}`);
    }
  }

  // ── Step 7: Story HTML ──
  if (!state.steps.storyHtml) {
    log("🖼️  Step 7: Generate story preview HTML...");
    try {
      const { renderStoryHtml } = await import("./lib/utils/story-renderer.js");
      const imagesDir = join(episodeDir, "images");
      const audioDir = join(episodeDir, "audio");

      const shotData = shots.map((s) => ({
        id: s.id,
        shotType: s.shotType ?? "dynamic",
        imageUrl: s.imageUrl || join(imagesDir, `${s.id}_first.png`),
        lastFrameUrl: s.lastFrameUrl || join(imagesDir, `${s.id}_last.png`),
        subtitle: s.subtitle,
        audioUrl: existsSync(join(audioDir, `${s.id}.wav`)) ? join(audioDir, `${s.id}.wav`) : undefined,
        speaker: s.speaker,
        duration: s.duration,
        imagePrompt: s.imagePrompt,
        lastFramePrompt: s.lastFramePrompt,
        videoPrompt: s.videoPrompt,
      }));

      const videoTasks = existsSync(join(episodeDir, "video_tasks.json"))
        ? loadJson(join(episodeDir, "video_tasks.json"))
        : [];

      await renderStoryHtml({
        title: storyBible?.title ?? state.topic,
        storyBible,
        shots: shotData,
        videoTasks,
        outputPath: join(episodeDir, "story.html"),
        theme: "dark",
        style: state.config.style === "realistic" ? "cinematic" : "comic",
      });

      state.steps.storyHtml = true;
      log(`  ✅ Story preview: ${join(episodeDir, "story.html")}`);
    } catch (e) {
      log(`  ⚠️  Story HTML failed: ${e.message}`);
    }
  }

  // ── Step 8: Evaluation ──
  if (!state.steps.evaluation) {
    log("📊 Step 8: Auto-evaluation...");
    const evaluation = {
      timestamp: new Date().toISOString(),
      imageCount: shots.filter((s) => existsSync(join(episodeDir, "images", `${s.id}_first.png`))).length,
      totalShots: shots.length,
      audioCount: shots.filter((s) => existsSync(join(episodeDir, "audio", `${s.id}.wav`)) || existsSync(join(episodeDir, "audio", `${s.sceneGroupId ?? "default"}_combined.wav`))).length,
      hasSubtitles: existsSync(join(episodeDir, "subtitles.srt")),
      hasVideoTasks: existsSync(join(episodeDir, "video_tasks.json")),
      hasStoryHtml: existsSync(join(episodeDir, "story.html")),
      hasBgm: existsSync(join(episodeDir, "assets", "bgm.mp3")),
      score: {
        completeness: 0, // calculated below
        quality: "pending", // requires AI evaluation
      },
    };
    evaluation.score.completeness = Math.round(
      ((evaluation.imageCount * 2 + evaluation.audioCount + (evaluation.hasSubtitles ? 1 : 0) + (evaluation.hasBgm ? 1 : 0)) /
        (evaluation.totalShots * 2 + evaluation.totalShots + 2)) *
        100,
    );

    saveJson(join(episodeDir, "evaluation.json"), evaluation);
    state.steps.evaluation = true;
    log(`  ✅ Evaluation: ${evaluation.score.completeness}% complete`);
  }

  // ── Done ──
  state.status = "material-done";
  state.updatedAt = new Date().toISOString();
  saveJson(join(episodeDir, "state.json"), state);

  // Generate summary
  const summary = {
    episodeDir,
    episodeId: state.id,
    phase: "material",
    status: state.status,
    storyHtml: join(episodeDir, "story.html"),
    videoTasks: join(episodeDir, "video_tasks.json"),
    evaluation: join(episodeDir, "evaluation.json"),
    steps: state.steps,
  };
  saveJson(join(episodeDir, "summary.json"), summary);

  log("\n═══════════════════════════════════");
  log(`✅ Phase A Complete: ${state.id}`);
  log(`📁 Dir: ${episodeDir}`);
  log(`🖼️  Images: ${state.steps.images ? "✅" : "⏳"}`);
  log(`🎤 Voice: ${state.steps.voice ? "✅" : "⏳"}`);
  log(`🎵 Music: ${state.steps.music ? "✅" : "⏳"}`);
  log(`📝 Subtitles: ${state.steps.subtitles ? "✅" : "⏳"}`);
  log(`📋 Video Tasks: ${state.steps.videoTasks ? "✅" : "⏳"}`);
  log(`🖼️  Story HTML: ${state.steps.storyHtml ? "✅" : "⏳"}`);
  log(`📊 Evaluation: ${state.steps.evaluation ? "✅" : "⏳"}`);
  log(`\n▶️  Next: Open story.html for review, then run --phase review`);
  log("═══════════════════════════════════");

  console.log(`\n__SUMMARY__${JSON.stringify(summary)}__SUMMARY__`);
}

// ─── Phase B: Review ───────────────────────────────────────

async function phaseB(args) {
  if (!args.episodeDir) {
    console.error("Usage: node pipeline.mjs --phase review --episode-dir ./episodes/xxx");
    process.exit(1);
  }

  const episodeDir = args.episodeDir;
  const statePath = join(episodeDir, "state.json");
  const evalPath = join(episodeDir, "evaluation.json");

  if (!existsSync(statePath)) {
    console.error("No state.json found. Run Phase A first.");
    process.exit(1);
  }

  const state = loadJson(statePath);
  const evaluation = existsSync(evalPath) ? loadJson(evalPath) : null;

  log("📋 Phase B: Review");
  log(`═══════════════════════════════════`);
  log(`Episode: ${state.id}`);
  log(`Topic: "${state.topic}"`);
  log(`Dir: ${episodeDir}`);
  log(`\n📊 Completeness: ${evaluation?.score?.completeness ?? "N/A"}%`);

  // Show steps status
  for (const [step, done] of Object.entries(state.steps)) {
    log(`  ${done ? "✅" : "⏳"} ${step}`);
  }

  // Show story.html path
  const storyHtml = join(episodeDir, "story.html");
  if (existsSync(storyHtml)) {
    log(`\n🖼️  Story Preview: ${storyHtml}`);
  }

  // Show video tasks summary
  const tasksPath = join(episodeDir, "video_tasks.json");
  if (existsSync(tasksPath)) {
    const tasks = loadJson(tasksPath);
    log(`\n🎥 Video Tasks: ${tasks.length} shots`);
    tasks.slice(0, 3).forEach((t) => {
      log(`  • ${t.shotId}: ${t.prompt.slice(0, 50)}... (${t.ratio}, ${t.duration}s)`);
    });
    if (tasks.length > 3) log(`  ... and ${tasks.length - 3} more`);
  }

  log("\n═══════════════════════════════════");

  if (args.approve) {
    state.status = "approved";
    state.approvedAt = new Date().toISOString();
    saveJson(statePath, state);
    log("✅ Episode approved! Run --phase video to start video generation.");
  } else if (args.fixShot) {
    log(`🔧 Fix shot: ${args.fixShot}`);
    log(`   Re-run Phase A with --resume to regenerate specific shot images.`);
    log(`   Or manually edit shots.json and script.json, then re-run Phase A from Step 2.`);
  } else {
    log("To approve: node pipeline.mjs --phase review --episode-dir ./episodes/xxx --approve");
  }
}

// ─── Phase C: Video Generation ─────────────────────────────

async function phaseC(args) {
  if (!args.episodeDir) {
    console.error("Usage: node pipeline.mjs --phase video --episode-dir ./episodes/xxx");
    process.exit(1);
  }

  const episodeDir = args.episodeDir;
  const statePath = join(episodeDir, "state.json");
  const tasksPath = join(episodeDir, "video_tasks.json");

  if (!existsSync(statePath) || !existsSync(tasksPath)) {
    console.error("Missing state.json or video_tasks.json. Run Phase A and B first.");
    process.exit(1);
  }

  const state = loadJson(statePath);

  if (state.status !== "approved") {
    log(`⚠️  Episode status is "${state.status}", not "approved". Run Phase B --approve first.`);
  }

  const tasks = loadJson(tasksPath);

  // Load script for shot type info
  const scriptPath = join(episodeDir, "script.json");
  const script = existsSync(scriptPath) ? loadJson(scriptPath) : null;
  const allShots = script?.shots?.shots || script?.shots || [];
  const shotTypeMap = new Map(allShots.map((s) => [s.id, s.shotType ?? "dynamic"]));

  const dynamicShots = allShots.filter((s) => (s.shotType ?? "dynamic") === "dynamic");
  const staticShots = allShots.filter((s) => (s.shotType ?? "dynamic") === "static");
  const lipSyncShots = allShots.filter((s) => (s.shotType ?? "dynamic") === "lipSync");

  log("🎬 Phase C: Video Generation");
  log(`═══════════════════════════════════`);
  log(`📊 Shot types: ${dynamicShots.length} dynamic, ${staticShots.length} static, ${lipSyncShots.length} lipSync`);
  log(`${tasks.length} dynamic video tasks to process`);
  if (staticShots.length > 0) {
    log(`🖼️  ${staticShots.length} static shots → skip Seedance (image + TTS + Ken Burns)`);
    staticShots.forEach((s) => log(`   • ${s.id} [static]`));
  }
  if (lipSyncShots.length > 0) {
    log(`🗣️  ${lipSyncShots.length} lipSync shots → pending Loopy integration`);
    lipSyncShots.forEach((s) => log(`   • ${s.id} [lipSync] ⏳ 待对口型处理`));
  }

  // Phase C is placeholder — actual Seedance API calls will be implemented later
  log("\n⚠️  Phase C (Seedance video generation) is not yet implemented.");
  log("This will be implemented in a future update.");
  log("\nPlanned flow:");
  log("  1. Read video_tasks.json (dynamic shots only)");
  log("  2. For each task: call Seedance API with first frame + last frame + prompt");
  log("  3. Poll for completion, download videos");
  log("  4. Static shots: image + TTS audio + Ken Burns effect");
  log("  5. LipSync shots: placeholder for Loopy integration");
  log("  6. FFmpeg: concat all clips + audio crossfade + subtitle burn + BGM overlay");
  log("  7. Output: rough_cut.mp4 (9:16 vertical)");
  log("  8. QC → qc_report.json");
  log("═══════════════════════════════════");

  state.status = "video-pending";
  state.updatedAt = new Date().toISOString();
  saveJson(statePath, state);
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const phase = args.phase || "material";

  switch (phase) {
    case "material":
      await phaseA(args);
      break;
    case "review":
      await phaseB(args);
      break;
    case "video":
      await phaseC(args);
      break;
    default:
      console.error(`Unknown phase: ${phase}. Use material|review|video.`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error("Pipeline failed:", e);
  process.exit(1);
});

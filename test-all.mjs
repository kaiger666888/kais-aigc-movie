// Load .env manually
import { readFileSync } from "fs";
const envContent = readFileSync("/tmp/crew-kais-aigc-movie/.env", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

const results = [];
function log(section, test, passed, detail = "") {
  const status = passed ? "✅ PASS" : "❌ FAIL";
  results.push({ section, test, passed, detail });
  console.log(`${status} | ${section} > ${test}${detail ? ": " + detail : ""}`);
}

// ========== Phase 1: Module Tests ==========

// 1. Config
try {
  const { loadConfig, getConfig } = await import("/tmp/crew-kais-aigc-movie/dist/config.js");
  const cfg = loadConfig();
  log("Config", "loadConfig() reads .env", cfg.glm.ttsApiKey.length > 0, `key length=${cfg.glm.ttsApiKey.length}`);
  log("Config", "kling accessKey loaded", cfg.kling.accessKey.length > 0);
  log("Config", "kling secretKey loaded", cfg.kling.secretKey.length > 0);
  log("Config", "defaults applied", cfg.kling.maxConcurrent === 2 && cfg.kling.apiUrl === "https://api-singapore.klingai.com");
  const cfg2 = getConfig();
  log("Config", "getConfig() singleton works", cfg === cfg2);
} catch (e) {
  log("Config", "loadConfig()", false, e.message);
}

// 2. Types - Zod schemas
try {
  const {
    StoryBibleSchema, CharacterSchema, SceneSchema,
    ShotSchema, ShotStatusEnum, ShotsConfigSchema,
    EpisodeStateSchema, EpisodeStatusEnum, EpisodeStepEnum,
    QCReportSchema, ShotQCSchema, QCIssueSchema
  } = await import("/tmp/crew-kais-aigc-movie/dist/types/index.js");

  // Valid StoryBible
  const validBible = StoryBibleSchema.parse({
    title: "Test",
    theme: "adventure",
    characters: [{ id: "c1", name: "Hero", description: "brave" }],
    scenes: [{ id: "s1", location: "forest", description: "dark forest" }],
    synopsis: "A hero's journey"
  });
  log("Types", "StoryBibleSchema valid data", validBible.title === "Test");

  // Invalid StoryBible - missing required
  try { StoryBibleSchema.parse({ title: "" }); log("Types", "StoryBibleSchema rejects invalid", false); }
  catch { log("Types", "StoryBibleSchema rejects invalid", true); }

  // Valid Shot
  const shot = ShotSchema.parse({ id: "sh1", sceneId: "s1", duration: 5, visualPrompt: "A cat" });
  log("Types", "ShotSchema defaults work", shot.status === "pending" && shot.speaker === "narrator");

  // Invalid Shot - bad duration
  try { ShotSchema.parse({ id: "sh1", sceneId: "s1", duration: 0, visualPrompt: "A cat" }); log("Types", "ShotSchema rejects duration=0", false); }
  catch { log("Types", "ShotSchema rejects duration=0", true); }

  // EpisodeState
  const ep = EpisodeStateSchema.parse({
    id: "ep1", topic: "test", status: "created", currentStep: "init",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  log("Types", "EpisodeStateSchema works", ep.progress === 0);

  // QCReport
  const qc = QCReportSchema.parse({
    episodeId: "ep1", timestamp: new Date().toISOString(), passed: true,
    overallScore: 8, shots: [], issues: []
  });
  log("Types", "QCReportSchema works", qc.overallScore === 8);

  log("Types", "ShotStatusEnum values", JSON.stringify(ShotStatusEnum.options) === JSON.stringify(["pending","generating","done","failed"]));
  log("Types", "EpisodeStatusEnum values", EpisodeStatusEnum.options.length === 7);
  log("Types", "EpisodeStepEnum values", EpisodeStepEnum.options.length === 6);
} catch (e) {
  log("Types", "schema test", false, e.message);
}

// 3. Kling JWT
try {
  const { KlingApiService } = await import("/tmp/crew-kais-aigc-movie/dist/services/kling-api.js");
  // Can't construct without config loaded, but we can test JWT generation via the service
  // Just verify the service can be constructed
  const svc = new KlingApiService();
  log("KlingAPI", "KlingApiService constructs", true);
  
  // We'll test submit separately below
} catch (e) {
  log("KlingAPI", "construction", false, e.message);
}

// 4. GLM-TTS
try {
  const { GlmTtsService } = await import("/tmp/crew-kais-aigc-movie/dist/services/glm-tts.js");
  const tts = new GlmTtsService();
  log("GLM-TTS", "GlmTtsService constructs", true);
} catch (e) {
  log("GLM-TTS", "construction", false, e.message);
}

// 5. State Manager
try {
  const { EpisodeStateManager } = await import("/tmp/crew-kais-aigc-movie/dist/utils/state-manager.js");
  const testDir = "/tmp/test-aigc-episodes";
  rmSync(testDir, { recursive: true, force: true });
  const { FileManager } = await import("/tmp/crew-kais-aigc-movie/dist/utils/file-manager.js");
  const fm = new FileManager(testDir);
  const sm = new EpisodeStateManager(fm);
  
  const state = await sm.createEpisode("test-ep-1", "A test episode");
  log("StateManager", "createEpisode", state.id === "test-ep-1" && state.status === "created");
  
  const updated = await sm.updateState("test-ep-1", { status: "writing", currentStep: "writing", progress: 30 });
  log("StateManager", "updateState", updated.status === "writing" && updated.progress === 30);
  
  const loaded = await sm.getState("test-ep-1");
  log("StateManager", "getState roundtrip", loaded.status === "writing");
  
  const list = await sm.listEpisodes();
  log("StateManager", "listEpisodes", list.includes("test-ep-1"));
  
  rmSync(testDir, { recursive: true, force: true });
} catch (e) {
  log("StateManager", "test", false, e.message);
}

// 6. File Manager
try {
  const { FileManager } = await import("/tmp/crew-kais-aigc-movie/dist/utils/file-manager.js");
  const testDir = "/tmp/test-fm-episodes";
  rmSync(testDir, { recursive: true, force: true });
  const fm = new FileManager(testDir);
  
  await fm.createEpisodeDir("ep-1");
  log("FileManager", "createEpisodeDir creates dirs", existsSync(join(testDir, "ep-1/audio")) && existsSync(join(testDir, "ep-1/shots")));
  
  log("FileManager", "getAudioPath", fm.getAudioPath("ep-1", "s1") === join(testDir, "ep-1/audio/s1.mp3"));
  log("FileManager", "getShotVideoPath", fm.getShotVideoPath("ep-1", "s1") === join(testDir, "ep-1/shots/s1.mp4"));
  log("FileManager", "getOutputPath", fm.getOutputPath("ep-1") === join(testDir, "ep-1/rough_cut.mp4"));
  log("FileManager", "getStatePath", fm.getStatePath("ep-1") === join(testDir, "ep-1/state.json"));
  
  rmSync(testDir, { recursive: true, force: true });
} catch (e) {
  log("FileManager", "test", false, e.message);
}

// ========== Real API Tests ==========

// 7. Kling API real test
try {
  const { KlingApiService } = await import("/tmp/crew-kais-aigc-movie/dist/services/kling-api.js");
  const kling = new KlingApiService();
  
  // Submit a simple task
  console.log("\n🎬 Submitting Kling text2video task...");
  const taskId = await kling.submitTask("A cat sitting on a windowsill looking at the sunset, cinematic lighting", { duration: "5" });
  log("KlingAPI", "submitTask real API", true, `taskId=${taskId}`);
  
  // Poll for result
  console.log("⏳ Polling Kling task...");
  const result = await kling.pollTask(taskId);
  const videoUrl = result.data?.task_result?.videos?.[0]?.url;
  log("KlingAPI", "pollTask completed", !!videoUrl, videoUrl ? `videoUrl length=${videoUrl.length}` : "no video URL");
} catch (e) {
  log("KlingAPI", "real API test", false, e.message);
}

// 8. GLM-TTS real test
try {
  const { GlmTtsService } = await import("/tmp/crew-kais-aigc-movie/dist/services/glm-tts.js");
  const tts = new GlmTtsService();
  
  console.log("\n🔊 Testing GLM-TTS synthesis...");
  const buf = await tts.synthesize("你好，这是一个测试语音。", { voice: "female" });
  log("GLM-TTS", "synthesize real API", buf.length > 0, `buffer size=${buf.length} bytes`);
  
  // Check if it looks like audio (MP3 starts with 0xFF 0xFB or ID3 tag)
  const isMp3 = buf[0] === 0xFF || (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33);
  log("GLM-TTS", "output is valid MP3", isMp3, `first bytes: ${buf[0]?.toString(16)} ${buf[1]?.toString(16)} ${buf[2]?.toString(16)}`);
  
  // Save test file
  mkdirSync("/tmp/test-tts", { recursive: true });
  writeFileSync("/tmp/test-tts/test.mp3", buf);
  log("GLM-TTS", "saved test file", true, "/tmp/test-tts/test.mp3");
} catch (e) {
  log("GLM-TTS", "real API test", false, e.message);
}

// ========== Generate Report ==========
const passCount = results.filter(r => r.passed).length;
const failCount = results.filter(r => !r.passed).length;

let report = `# Test Report — kais-aigc-movie\n\n`;
report += `**Date:** ${new Date().toISOString()}\n`;
report += `**Total:** ${results.length} | ✅ Passed: ${passCount} | ❌ Failed: ${failCount}\n\n`;
report += `## Results\n\n| Status | Section | Test | Detail |\n|--------|---------|------|--------|\n`;
for (const r of results) {
  report += `| ${r.passed ? "✅" : "❌"} | ${r.section} | ${r.test} | ${r.detail || "-"} |\n`;
}

writeFileSync("/tmp/crew-kais-aigc-movie/TEST_REPORT.md", report);
console.log(`\n📊 Report saved: ${passCount}/${results.length} passed`);

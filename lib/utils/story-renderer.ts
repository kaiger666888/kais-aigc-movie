/**
 * Story preview HTML generator.
 *
 * Generates a single-file HTML page with 3 tabs for review:
 * Tab 1: Story Preview (slideshow)
 * Tab 2: Shot Details (table with prompts)
 * Tab 3: Video Tasks (task list)
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StoryRenderOptions {
  title: string;
  storyBible: Record<string, unknown>;
  shots: Array<{
    id: string;
    imageUrl: string;
    lastFrameUrl?: string;
    subtitle: string;
    audioUrl?: string;
    speaker?: string;
    duration?: number;
    imagePrompt?: string;
    lastFramePrompt?: string;
    videoPrompt?: string;
  }>;
  videoTasks?: Array<{
    shotId: string;
    prompt: string;
    firstFramePath: string;
    lastFramePath: string;
    ratio: string;
    duration: number;
    status: string;
  }>;
  outputPath: string;
  theme?: "dark" | "light";
  style?: "comic" | "cinematic" | "minimal";
}

// ---------------------------------------------------------------------------
// renderStoryHtml
// ---------------------------------------------------------------------------

export async function renderStoryHtml(options: StoryRenderOptions): Promise<string> {
  const theme = options.theme ?? "dark";
  const style = options.style ?? "comic";

  // Read images as base64
  const shotsWithBase64: Array<{
    id: string;
    imageBase64: string;
    lastFrameBase64: string;
    audioBase64: string;
    subtitle: string;
    speaker: string;
    duration: number;
    imagePrompt: string;
    lastFramePrompt: string;
    videoPrompt: string;
  }> = [];

  for (const shot of options.shots) {
    const imageBase64 = await readFileAsBase64(shot.imageUrl);
    const lastFrameBase64 = shot.lastFrameUrl
      ? await readFileAsBase64(shot.lastFrameUrl)
      : "";
    const audioBase64 = shot.audioUrl
      ? await readFileAsBase64(shot.audioUrl)
      : "";

    shotsWithBase64.push({
      id: shot.id,
      imageBase64,
      lastFrameBase64,
      audioBase64,
      subtitle: shot.subtitle,
      speaker: shot.speaker ?? "narrator",
      duration: shot.duration ?? 5,
      imagePrompt: shot.imagePrompt ?? "",
      lastFramePrompt: shot.lastFramePrompt ?? "",
      videoPrompt: shot.videoPrompt ?? "",
    });
  }

  const videoTasksJson = options.videoTasks
    ? JSON.stringify(options.videoTasks, null, 2)
    : "[]";

  const html = generateHtml(options.title, shotsWithBase64, videoTasksJson, theme, style);

  // Ensure output directory exists
  const outputDir = join(options.outputPath, "..");
  await mkdir(outputDir, { recursive: true });
  await writeFile(options.outputPath, html, "utf-8");

  return options.outputPath;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readFileAsBase64(filePath: string): Promise<string> {
  try {
    const buffer = await readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "wav" ? "audio/wav" : ext === "mp3" ? "audio/mpeg" : "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

function generateHtml(
  title: string,
  shots: Array<{
    id: string;
    imageBase64: string;
    lastFrameBase64: string;
    audioBase64: string;
    subtitle: string;
    speaker: string;
    duration: number;
    imagePrompt: string;
    lastFramePrompt: string;
    videoPrompt: string;
  }>,
  videoTasksJson: string,
  theme: "dark" | "light",
  style: "comic" | "cinematic" | "minimal",
): string {
  const isDark = theme === "dark";
  const bg = isDark ? "#1a1a2e" : "#f5f5f5";
  const fg = isDark ? "#e0e0e0" : "#333";
  const cardBg = isDark ? "#16213e" : "#fff";
  const accent = style === "comic" ? "#e94560" : style === "cinematic" ? "#f0c040" : "#4a90d9";
  const border = isDark ? "#0f3460" : "#ddd";

  const shotsDataJson = JSON.stringify(
    shots.map((s) => ({
      id: s.id,
      image: s.imageBase64,
      lastFrame: s.lastFrameBase64,
      audio: s.audioBase64,
      subtitle: s.subtitle,
      speaker: s.speaker,
      duration: s.duration,
      imagePrompt: s.imagePrompt,
      lastFramePrompt: s.lastFramePrompt,
      videoPrompt: s.videoPrompt,
    })),
  );

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)} — 故事预览</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "Microsoft YaHei", sans-serif; background: ${bg}; color: ${fg}; min-height: 100vh; }
  
  /* Tabs */
  .tabs { display: flex; background: ${cardBg}; border-bottom: 2px solid ${border}; position: sticky; top: 0; z-index: 100; }
  .tab { padding: 12px 24px; cursor: pointer; border: none; background: transparent; color: ${fg}; font-size: 15px; opacity: 0.6; transition: all 0.3s; }
  .tab.active { opacity: 1; border-bottom: 3px solid ${accent}; font-weight: bold; }
  .tab:hover { opacity: 0.9; }
  
  /* Tab panels */
  .panel { display: none; padding: 20px; }
  .panel.active { display: block; }
  
  /* Slideshow */
  .slideshow { max-width: 480px; margin: 0 auto; text-align: center; }
  .slide { display: none; }
  .slide.active { display: block; }
  .slide img { width: 100%; border-radius: 12px; ${style === "comic" ? "border: 3px solid " + accent + ";" : "box-shadow: 0 8px 32px rgba(0,0,0,0.4);"} }
  .slide-nav { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 16px; }
  .slide-nav button { background: ${accent}; color: #fff; border: none; border-radius: 50%; width: 48px; height: 48px; font-size: 20px; cursor: pointer; }
  .slide-counter { color: ${fg}; opacity: 0.7; font-size: 14px; }
  .subtitle-box { background: ${isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)"}; border-radius: 12px; padding: 16px; margin-top: 12px; ${style === "comic" ? "border: 2px solid " + accent + "; position: relative;" : ""} }
  ${style === "comic" ? ".subtitle-box::before { content: ''; position: absolute; bottom: -10px; left: 30px; width: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 10px solid " + accent + "; }" : ""}
  .subtitle-text { font-size: 18px; line-height: 1.6; }
  .speaker-tag { display: inline-block; background: ${accent}; color: #fff; padding: 2px 10px; border-radius: 10px; font-size: 12px; margin-bottom: 8px; }
  
  /* Details table */
  .detail-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .detail-table th, .detail-table td { padding: 10px 12px; border: 1px solid ${border}; text-align: left; vertical-align: top; }
  .detail-table th { background: ${cardBg}; font-weight: bold; position: sticky; top: 0; }
  .detail-table img { width: 80px; height: auto; border-radius: 6px; }
  .prompt-text { font-size: 12px; opacity: 0.8; max-width: 300px; word-break: break-all; }
  
  /* Video tasks */
  .task-card { background: ${cardBg}; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 4px solid ${accent}; }
  .task-header { font-weight: bold; margin-bottom: 8px; }
  .task-prompt { font-size: 13px; opacity: 0.8; }
  .task-meta { font-size: 12px; opacity: 0.6; margin-top: 6px; }
  .approve-btn { display: block; margin: 20px auto; padding: 12px 32px; background: ${accent}; color: #fff; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
  .approve-btn:hover { opacity: 0.9; }
  
  /* Responsive */
  @media (max-width: 600px) {
    .tab { padding: 10px 14px; font-size: 13px; }
    .panel { padding: 12px; }
    .detail-table { font-size: 12px; }
    .detail-table img { width: 50px; }
  }
</style>
</head>
<body>

<div class="tabs">
  <button class="tab active" onclick="switchTab('preview')">🎬 故事预览</button>
  <button class="tab" onclick="switchTab('details')">📋 分镜详情</button>
  <button class="tab" onclick="switchTab('tasks')">🎥 视频任务</button>
</div>

<!-- Tab 1: Story Preview -->
<div class="panel active" id="panel-preview">
  <div class="slideshow" id="slideshow"></div>
</div>

<!-- Tab 2: Shot Details -->
<div class="panel" id="panel-details">
  <table class="detail-table">
    <thead>
      <tr><th>#</th><th>首帧</th><th>字幕</th><th>imagePrompt</th><th>videoPrompt</th></tr>
    </thead>
    <tbody id="details-tbody"></tbody>
  </table>
</div>

<!-- Tab 3: Video Tasks -->
<div class="panel" id="panel-tasks">
  <div id="tasks-container"></div>
</div>

<script>
const shots = ${shotsDataJson};
const videoTasks = ${videoTasksJson};
let currentSlide = 0;

// Build slideshow
function buildSlideshow() {
  const container = document.getElementById('slideshow');
  shots.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'slide' + (i === 0 ? ' active' : '');
    div.innerHTML = \`
      <img src="\${s.image}" alt="Shot \${s.id}" onerror="this.style.display='none'">
      <div class="slide-nav">
        <button onclick="prevSlide()">◀</button>
        <span class="slide-counter">\${i + 1} / \${shots.length}</span>
        <button onclick="nextSlide()">▶</button>
      </div>
      <div class="subtitle-box">
        <div class="speaker-tag">\${s.speaker}</div>
        <div class="subtitle-text">\${s.subtitle}</div>
      </div>
    \`;
    container.appendChild(div);
  });
}

// Build details table
function buildDetails() {
  const tbody = document.getElementById('details-tbody');
  shots.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td>\${i + 1}</td>
      <td><img src="\${s.image}" alt="\${s.id}"></td>
      <td>\${s.subtitle}</td>
      <td class="prompt-text">\${s.imagePrompt}</td>
      <td class="prompt-text">\${s.videoPrompt}</td>
    \`;
    tbody.appendChild(tr);
  });
}

// Build video tasks
function buildTasks() {
  const container = document.getElementById('tasks-container');
  if (!videoTasks.length) {
    container.innerHTML = '<p style="opacity:0.6">暂无视频任务</p>';
    return;
  }
  videoTasks.forEach(t => {
    const div = document.createElement('div');
    div.className = 'task-card';
    div.innerHTML = \`
      <div class="task-header">镜头 \${t.shotId} — \${t.status}</div>
      <div class="task-prompt">\${t.prompt}</div>
      <div class="task-meta">比例: \${t.ratio} | 时长: \${t.duration}s | 首帧: \${t.firstFramePath}</div>
    \`;
    container.appendChild(div);
  });
  const btn = document.createElement('button');
  btn.className = 'approve-btn';
  btn.textContent = '✅ 审核通过，开始生成视频';
  container.appendChild(btn);
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
}

function showSlide(n) {
  const slides = document.querySelectorAll('.slide');
  slides.forEach(s => s.classList.remove('active'));
  currentSlide = ((n % slides.length) + slides.length) % slides.length;
  slides[currentSlide].classList.add('active');
  // Auto-play audio
  shots.forEach(s => {
    if (s.audio) {
      const audio = new Audio(s.audio);
      audio.pause();
    }
  });
  if (shots[currentSlide].audio) {
    new Audio(shots[currentSlide].audio).play().catch(() => {});
  }
}

function prevSlide() { showSlide(currentSlide - 1); }
function nextSlide() { showSlide(currentSlide + 1); }

// Keyboard navigation
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') prevSlide();
  if (e.key === 'ArrowRight') nextSlide();
});

buildSlideshow();
buildDetails();
buildTasks();
</script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

# kais-aigc-movie

AI-generated movie production toolkit — types, services, and utilities for OpenClaw Skill.

## Overview

This library provides the core building blocks for an automated AI comic/movie production pipeline:

1. **Story Planning** — Define characters, scenes, and shot lists using Zod-validated TypeScript types
2. **Voice Synthesis** — GLM-TTS integration for narration and dialogue (WAV output) with 10 built-in voice presets
3. **Video Generation** — Dual backend: ComfyUI (Wan2.2, local GPU) or Kling AI (cloud API), unified via `VideoGenerator` interface
4. **Post-Production** — FFmpeg utilities for concatenation, audio overlay, subtitles, and dynamic crossfade transitions
5. **State Management** — Episode lifecycle tracking with disk persistence and resumability

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Writer     │────▶│  Voice +     │────▶│   Editor      │
│ (GLM-5.1)   │     │  Video Gen   │     │  (FFmpeg)     │
│ story_bible  │     │ (TTS+Kling)  │     │  rough_cut    │
│ shots.json   │     │  parallel    │     │               │
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                  │
                                           ┌──────▼──────┐
                                           │   QC Check   │
                                           │  (ffprobe)   │
                                           └─────────────┘
```

```
lib/
├── config.ts              # Env-based config + FFmpeg detection + createVideoGenerator()
├── index.ts               # Public API re-exports
├── types/
│   ├── story-bible.ts     # Characters, scenes, story structure
│   ├── shots.ts           # Shot definitions and status tracking
│   ├── episode-state.ts   # Episode lifecycle state
│   └── qc-report.ts       # Quality control reporting
├── services/
│   ├── video-generator.ts # Unified VideoGenerator interface
│   ├── comfyui-service.ts # ComfyUI backend (Wan2.2 T2V)
│   ├── kling-api.ts       # Kling AI video generation
│   └── glm-tts.ts         # GLM-TTS voice synthesis + voice presets
└── utils/
    ├── ffmpeg.ts          # FFmpeg post-production utilities (dynamic transitions)
    ├── file-manager.ts    # Episode directory management
    └── state-manager.ts   # Episode state persistence
```

## Installation

```bash
# Clone and build
git clone https://github.com/kaiger666888/kais-aigc-movie.git
cd kais-aigc-movie
npm install
npm run build
```

### System Requirements

- **Node.js** ≥ 20
- **FFmpeg** — required for video editing operations. Install from https://ffmpeg.org/download.html

You can programmatically check ffmpeg availability:

```typescript
import { checkFFmpeg } from "kais-aigc-movie";
const available = await checkFFmpeg(); // true/false
```

### Environment Variables

```env
# Video backend: "comfyui" (default) or "kling"
VIDEO_BACKEND=comfyui

# Required
GLM_TTS_API_KEY=your_glm_api_key

# ComfyUI (VIDEO_BACKEND=comfyui)
COMFYUI_HOST=127.0.0.1
COMFYUI_PORT=8188
COMFYUI_MODEL=wan2.2_t2v_5B  # wan2.2_t2v_1.3B or wan2.2_t2v_5B
# COMFYUI_WORKFLOW_PATH=     # Optional: custom workflow JSON

# Kling (VIDEO_BACKEND=kling)
KLING_ACCESS_KEY=your_kling_access_key
KLING_SECRET_KEY=your_kling_secret_key
KLING_API_URL=https://api-beijing.klingai.com
KLING_MAX_CONCURRENT=2
KLING_MAX_RETRIES=3
KLING_SHOT_TIMEOUT_MS=300000

# Optional
GLM_TTS_ENDPOINT=https://open.bigmodel.cn/api/paas/v4/audio/speech
EPISODES_DIR=./episodes
```

## Quick Start

### Standalone Usage

```typescript
import {
  getConfig,
  createVideoGenerator,
  GlmTtsService,
  EpisodeStateManager,
  FileManager,
  checkFFmpeg,
} from "kais-aigc-movie";

// Verify prerequisites
const ffmpegOk = await checkFFmpeg();
if (!ffmpegOk) {
  console.error("FFmpeg is required. Install it first.");
  process.exit(1);
}

// Verify video backend connectivity
const videoGen = createVideoGenerator();
const backendOk = await videoGen.testConnection();
if (!backendOk) {
  console.error("Video backend unreachable. Check your VIDEO_BACKEND config.");
  process.exit(1);
}

// Generate a video from a text prompt (works with both backends)
const videoPath = await videoGen.submitAndDownload(
  "A cat sitting on a windowsill at sunset, cinematic lighting",
  "./output/videos",
  "shot-001",
  { duration: 5, resolution: "720p" },
);

// Synthesize speech with a specific voice
const tts = new GlmTtsService();
const audioBuffer = await tts.synthesize("The cat watched the sunset quietly.", {
  voice: "female-shuangkuaisisi",
  speed: 1.0,
});

// Manage episode state
const fm = new FileManager("./episodes");
const stateManager = new EpisodeStateManager(fm);
const episode = await stateManager.createEpisode("ep-001", "A Cat's Journey");
await stateManager.updateState("ep-001", { status: "writing", progress: 50 });
```

### OpenClaw Skill Integration

When used as an OpenClaw Skill, the pipeline is triggered by user messages like "拍个剧" or "/new 主题".

The skill automatically orchestrates all steps: Writer → Voice/Video (parallel) → Editor → QC → Delivery.

See `skill/SKILL.md` for the full skill documentation.

## API Reference

### Config

| Export | Description |
|--------|-------------|
| `loadConfig()` | Build config from env vars (throws on missing required keys) |
| `getConfig()` | Singleton accessor (lazy-loads, warns if ffmpeg missing) |
| `createVideoGenerator()` | Create VideoGenerator based on `VIDEO_BACKEND` env var |
| `checkFFmpeg()` | `Promise<boolean>` — check if ffmpeg is available on PATH |
| `Config` | Validated config type |

### Types (Zod Schemas)

| Schema | Description |
|--------|-------------|
| `StoryBibleSchema` | Full story definition (characters, scenes, synopsis) |
| `ShotSchema` | Individual shot/frame with prompt, duration, status |
| `ShotsConfigSchema` | Collection of shots for an episode |
| `EpisodeStateSchema` | Episode lifecycle state (persisted to disk) |
| `QCReportSchema` | Quality control report with per-shot scores |

### Video Generation

#### VideoGenerator (unified interface)

| Method | Description |
|--------|-------------|
| `submitAndDownload(prompt, dir, filename, options?)` | Submit → poll → download video |
| `testConnection()` | `Promise<boolean>` — verify backend connectivity |

Both `ComfyUIService` and `KlingApiService` implement this interface. Use `createVideoGenerator()` to auto-select.

#### ComfyUIService

| Method | Description |
|--------|-------------|
| `testConnection()` | GET /system_stats — verify ComfyUI is running |
| `submitAndDownload(prompt, dir, filename, options?)` | Submit Wan2.2 workflow → poll → download |

Supports built-in Wan2.2 T2V workflow or custom workflow via `COMFYUI_WORKFLOW_PATH`.

#### KlingApiService

| Method | Description |
|--------|-------------|
| `testConnection()` | `Promise<boolean>` — verify API credentials without consuming quota |
| `submitTask(prompt, options?)` | Submit text-to-video task, returns task_id |
| `pollTask(taskId)` | Poll until complete, failed, or timeout |
| `submitAndDownload(prompt, dir, filename, options?)` | Full pipeline: submit → poll → download |

Features: JWT (HS256) auth with auto-refresh, semaphore-based concurrency control, exponential backoff retries.

#### GlmTtsService

| Method | Description |
|--------|-------------|
| `synthesize(text, options?)` | Single utterance → WAV Buffer |
| `batchSynthesize(items)` | Parallel synthesis (max 3 concurrent) → Map<id, Buffer> |

#### Voice Presets

| Export | Description |
|--------|-------------|
| `VoicePresets` | `readonly string[]` — all built-in voice identifiers |
| `listVoices()` | Returns the list of available voice presets |
| `VoicePreset` | Type for voice preset strings |

Available voices: `tongtong`, `male-narrator`, `male-qn-qingse`, `male-qn-jingying`, `male-qn-badao`, `female-shuangkuaisisi`, `female-shaonv`, `female-yujie`, `female-chengshu`, `female-tianmei`

### Utils

#### FileManager

Directory structure management for episodes: `audio/`, `shots/`, `state.json`, `rough_cut.mp4`.

#### EpisodeStateManager

CRUD operations on episode state with Zod validation on read.

#### FFmpeg Utilities

| Function | Description |
|----------|-------------|
| `concatVideos(inputs, output)` | Concatenate videos via demuxer |
| `addAudio(video, audio, output)` | Overlay audio track |
| `addSubtitle(video, srt, output)` | Burn SRT subtitles |
| `addTransition(inputs, output, type?)` | Crossfade transitions with **dynamic offsets** based on actual clip durations |
| `probeVideo(path)` | Get duration, codec, resolution via ffprobe |

## Development

```bash
npm run build       # Compile TypeScript
npm run typecheck   # Type-check without emitting
```

## License

MIT

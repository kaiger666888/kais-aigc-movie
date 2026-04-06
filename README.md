# kais-aigc-movie

AI-generated movie production toolkit — types, services, and utilities for OpenClaw Skill.

## Overview

This library provides the core building blocks for an automated AI comic/movie production pipeline:

1. **Story Planning** — Define characters, scenes, and shot lists using Zod-validated TypeScript types
2. **Voice Synthesis** — GLM-TTS integration for narration and dialogue (WAV output) with 10 built-in voice presets
3. **Video Generation** — Kling AI text-to-video with JWT auth, concurrency control, and retry logic
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
├── config.ts              # Env-based configuration with Zod validation + ffmpeg detection
├── index.ts               # Public API re-exports
├── types/
│   ├── story-bible.ts     # Characters, scenes, story structure
│   ├── shots.ts           # Shot definitions and status tracking
│   ├── episode-state.ts   # Episode lifecycle state
│   └── qc-report.ts       # Quality control reporting
├── services/
│   ├── kling-api.ts       # Kling AI video generation + health check
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
# Required
GLM_TTS_API_KEY=your_glm_api_key
KLING_ACCESS_KEY=your_kling_access_key
KLING_SECRET_KEY=your_kling_secret_key

# Optional (with defaults)
KLING_API_URL=https://api.klingai.com
KLING_MAX_CONCURRENT=2
KLING_MAX_RETRIES=3
KLING_SHOT_TIMEOUT_MS=300000
GLM_TTS_ENDPOINT=https://open.bigmodel.cn/api/paas/v4/audio/speech
EPISODES_DIR=./episodes
```

## Quick Start

### Standalone Usage

```typescript
import {
  getConfig,
  KlingApiService,
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

// Verify Kling API credentials
const kling = new KlingApiService();
const authOk = await kling.testAuth();
if (!authOk) {
  console.error("Kling API authentication failed. Check your keys.");
  process.exit(1);
}

// Generate a video from a text prompt
const videoPath = await kling.submitAndDownload(
  "A cat sitting on a windowsill at sunset, cinematic lighting",
  "./output/videos",
  "shot-001"
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

### Services

#### KlingApiService

| Method | Description |
|--------|-------------|
| `testAuth()` | `Promise<boolean>` — verify API credentials without consuming quota |
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

# kais-aigc-movie

AI-generated movie production toolkit — types, services, and utilities for OpenClaw Skill.

## Overview

This library provides the core building blocks for an automated AI comic/movie production pipeline:

1. **Story Planning** — Define characters, scenes, and shot lists using Zod-validated TypeScript types
2. **Voice Synthesis** — GLM-TTS integration for narration and dialogue (WAV output)
3. **Video Generation** — Kling AI text-to-video with JWT auth, concurrency control, and retry logic
4. **Post-Production** — FFmpeg utilities for concatenation, audio overlay, subtitles, and transitions
5. **State Management** — Episode lifecycle tracking with disk persistence and resumability

## Installation

```bash
npm install kais-aigc-movie
```

## Configuration

Create a `.env` file (or set environment variables):

```env
# Required
GLM_TTS_API_KEY=your_glm_api_key
KLING_ACCESS_KEY=your_kling_access_key
KLING_SECRET_KEY=your_kling_secret_key

# Optional (with defaults)
KLING_API_URL=https://api-singapore.klingai.com
KLING_MAX_CONCURRENT=2
KLING_MAX_RETRIES=3
KLING_SHOT_TIMEOUT_MS=300000
EPISODES_DIR=./episodes
```

## Quick Start

```typescript
import { getConfig, KlingApiService, GlmTtsService, EpisodeStateManager, FileManager } from "kais-aigc-movie";

// Load config from .env
const config = getConfig();

// Generate a video from a text prompt
const kling = new KlingApiService();
const videoPath = await kling.submitAndDownload(
  "A cat sitting on a windowsill at sunset, cinematic lighting",
  "./output/videos",
  "shot-001"
);

// Synthesize speech
const tts = new GlmTtsService();
const audioBuffer = await tts.synthesize("The cat watched the sunset quietly.", { voice: "tongtong" });

// Manage episode state
const fm = new FileManager("./episodes");
const stateManager = new EpisodeStateManager(fm);
const episode = await stateManager.createEpisode("ep-001", "A Cat's Journey");
await stateManager.updateState("ep-001", { status: "writing", progress: 50 });
```

## API Reference

### Config

| Export | Description |
|--------|-------------|
| `loadConfig()` | Build config from env vars (throws on missing required keys) |
| `getConfig()` | Singleton accessor (lazy-loads on first call) |
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
| `submitTask(prompt, options?)` | Submit text-to-video task, returns task_id |
| `pollTask(taskId)` | Poll until complete, failed, or timeout |
| `submitAndDownload(prompt, dir, filename, options?)` | Full pipeline: submit → poll → download |

Features: JWT (HS256) auth with auto-refresh, semaphore-based concurrency control, exponential backoff retries.

#### GlmTtsService

| Method | Description |
|--------|-------------|
| `synthesize(text, options?)` | Single utterance → WAV Buffer |
| `batchSynthesize(items)` | Parallel synthesis (max 3 concurrent) → Map<id, Buffer> |

Voice presets: `"tongtong"`, `"male-qn-qingse"`, `"female-shaonv"`, etc.

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
| `addTransition(inputs, output, type?)` | Crossfade transitions |
| `probeVideo(path)` | Get duration, codec, resolution |

## Architecture

```
lib/
├── config.ts              # Env-based configuration with Zod validation
├── index.ts               # Public API re-exports
├── types/
│   ├── story-bible.ts     # Characters, scenes, story structure
│   ├── shots.ts           # Shot definitions and status tracking
│   ├── episode-state.ts   # Episode lifecycle state
│   └── qc-report.ts       # Quality control reporting
├── services/
│   ├── kling-api.ts       # Kling AI video generation service
│   └── glm-tts.ts         # GLM-TTS voice synthesis service
└── utils/
    ├── ffmpeg.ts          # FFmpeg post-production utilities
    ├── file-manager.ts    # Episode directory management
    └── state-manager.ts   # Episode state persistence
```

## Development

```bash
npm run build       # Compile TypeScript
npm run typecheck   # Type-check without emitting
```

## License

MIT

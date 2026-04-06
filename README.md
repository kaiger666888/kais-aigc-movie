# kais-aigc-movie

AI-generated movie production pipeline powered by a multi-agent crew.

## Architecture

```
src/
├── agents/          # Agent definitions (crew members)
│   ├── showrunner.ts      # Orchestrates the full pipeline
│   ├── writer.ts          # Generates scripts and shot lists
│   ├── voice-director.ts  # Manages TTS voiceover production
│   ├── kling-renderer.ts  # Calls Kling AI for video generation
│   ├── editor.ts          # Assembles final episodes via ffmpeg
│   └── qc-tech.ts         # Quality control checks
├── services/        # External API integrations
│   ├── glm-tts.ts         # GLM text-to-speech API client
│   └── kling-api.ts       # Kling AI video generation API client
├── types/           # Zod schemas and TypeScript types
│   ├── story-bible.ts     # Story structure and character definitions
│   ├── shots.ts           # Shot list schema
│   ├── qc-report.ts       # QC report schema
│   └── episode-state.ts   # Episode pipeline state tracking
├── utils/           # Shared utilities
│   ├── ffmpeg.ts           # ffmpeg helpers (concat, mix audio)
│   ├── file-manager.ts     # Episode asset file management
│   └── state-manager.ts    # Persist episode state to disk
├── config/
│   └── default.ts          # Environment-based configuration
└── index.ts               # Entry point
episodes/                   # Generated episode assets (gitignored)
```

## Pipeline Flow

1. **Showrunner** kicks off an episode run
2. **Writer** generates the script + shot list from the story bible
3. **Voice Director** produces voiceover audio via GLM TTS
4. **Kling Renderer** generates video clips for each shot via Kling AI
5. **Editor** assembles clips + audio into a final episode
6. **QC Tech** validates output quality and reports issues

## Setup

```bash
cp .env.example .env   # Fill in API keys
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run with tsx (no compile) |
| `npm run build` | Compile TypeScript to dist/ |
| `npm run typecheck` | Type-check without emitting |
| `npm start` | Run compiled output |

## Environment Variables

See `.env.example` for required configuration.

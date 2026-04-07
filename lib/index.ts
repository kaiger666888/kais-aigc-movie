// Config
export { loadConfig, getConfig, checkFFmpeg, createVideoGenerator, type Config } from "./config.js";

// Types
export {
  VoiceConfigSchema,
  CharacterSchema,
  SceneSchema,
  StoryBibleSchema,
  type VoiceConfig,
  type Character,
  type Scene,
  type StoryBible,

  ShotStatusEnum,
  EmotionEnum,
  PaceEnum,
  ShotSchema,
  ShotsConfigSchema,
  EpisodeConfigSchema,
  CostReportSchema,
  TemplateSchema,
  type ShotStatus,
  type Emotion,
  type Pace,
  type Shot,
  type ShotsConfig,
  type EpisodeConfig,
  type CostReport,
  type Template,

  ShotQCSchema,
  QCIssueSeveritySchema,
  QCIssueSchema,
  QCReportSchema,
  type ShotQC,
  type QCIssueSeverity,
  type QCIssue,
  type QCReport,

  EpisodeStatusEnum,
  EpisodeStepEnum,
  EpisodeStateSchema,
  type EpisodeStatus,
  type EpisodeStep,
  type EpisodeState,
} from "./types/index.js";

// Video generation interface
export {
  type VideoGenerator,
  type VideoOptions,
} from "./services/video-generator.js";

// Services
export {
  ComfyUIService,
  type ComfyUIOptions,
} from "./services/comfyui-service.js";

export {
  KlingApiService,
  type KlingSubmitOptions,
  type KlingTaskResponse,
  type KlingTaskResult,
} from "./services/kling-api.js";

export {
  GlmTtsService,
  VoicePresets,
  listVoices,
  type SynthesizeOptions,
  type SynthesizeItem,
  type VoicePreset,
} from "./services/glm-tts.js";

// Utils
export {
  concatVideos,
  addAudio,
  addSubtitle,
  addTransition,
  probeVideo,
} from "./utils/ffmpeg.js";

export { FileManager } from "./utils/file-manager.js";

export { EpisodeStateManager } from "./utils/state-manager.js";

export {
  JimengService,
  type JimengOptions,
  type ImageResult,
} from "./services/jimeng-service.js";

export {
  SeedanceService,
  type VideoTask,
  type AmbienceTrack,
  type VideoResult,
} from "./services/seedance-service.js";

export {
  QuotaManager,
  type QuotaSnapshot,
  type CreditEstimate,
} from "./utils/quota-manager.js";

export {
  CharacterManager,
  type CharacterProfile,
} from "./utils/character-manager.js";

export { StyleManager } from "./utils/style-manager.js";

export {
  generateSRT,
  generateASS,
  type SubtitleOptions,
} from "./utils/subtitle-generator.js";

export {
  renderStoryHtml,
  type StoryRenderOptions,
} from "./utils/story-renderer.js";

export {
  MusicService,
  type MusicResult,
  type MusicSearchOptions,
} from "./services/music-service.js";

export { createJimengService, createSeedanceService } from "./config.js";

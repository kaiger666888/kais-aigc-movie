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
  ShotSchema,
  ShotsConfigSchema,
  type ShotStatus,
  type Shot,
  type ShotsConfig,

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

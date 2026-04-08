import { z } from "zod";
/** Processing status of a single shot */
export const ShotStatusEnum = z.enum([
    "pending",
    "generating",
    "done",
    "failed",
]);
/** Emotion tag for TTS pacing and video mood */
export const EmotionEnum = z.enum(["warm", "tense", "sad", "excited", "neutral"]);
/** Speech pace for TTS speed control */
export const PaceEnum = z.enum(["slow", "normal", "fast"]);
/** Shot type — determines video generation strategy */
export const ShotTypeEnum = z.enum(["dynamic", "static", "lipSync"]);
/** A single shot / storyboard frame */
export const ShotSchema = z.object({
    id: z.string(),
    /** Reference to a Scene.id */
    sceneId: z.string(),
    /** Shot duration in seconds */
    duration: z.number().min(1).max(15),
    /** Text prompt sent to the image/video generation model (English, reference) */
    visualPrompt: z.string(),
    /** Chinese prompt for Jimeng text-to-image (first frame) */
    imagePrompt: z.string().optional(),
    /** Chinese prompt for Jimeng text-to-image (last frame) */
    lastFramePrompt: z.string().optional(),
    /** Chinese prompt for Seedance video generation (dynamic change description) */
    videoPrompt: z.string().optional(),
    /** Fixed character appearance description for cross-shot consistency */
    characterProfile: z.string().optional(),
    /** Emotion tag */
    emotion: EmotionEnum.default("neutral"),
    /** Speech pace */
    pace: PaceEnum.default("normal"),
    /** Shot type: dynamic=video, static=image+audio, lipSync=reserved for Loopy */
    shotType: ShotTypeEnum.default("dynamic"),
    /** Scene group ID — shots in the same group share TTS context */
    sceneGroupId: z.string().optional(),
    /** BGM style description */
    musicStyle: z.string().optional(),
    /** Narration / dialogue text shown as subtitle */
    subtitle: z.string(),
    /** Character who speaks (references Character.id), or "narrator" */
    speaker: z.string().default("narrator"),
    /** Camera angle instruction */
    cameraAngle: z.string().default("medium"),
    /** Transition to next shot */
    transition: z.enum(["cut", "fade", "dissolve", "wipe"]).default("fade"),
    // --- Asset paths (filled during generation) ---
    /** First frame image local path */
    imageUrl: z.string().optional(),
    /** Last frame image local path */
    lastFrameUrl: z.string().optional(),
    /** First frame image original URL from Jimeng */
    imageAssetUrl: z.string().optional(),
    /** Last frame image original URL from Jimeng */
    lastFrameAssetUrl: z.string().optional(),
    /** Character reference image path (for image-to-image consistency) */
    characterRefPath: z.string().optional(),
    /** Style reference image path (for image-to-image consistency) */
    styleRefPath: z.string().optional(),
    /** Kling task id (filled during rendering) */
    taskId: z.string().optional(),
    /** Seedance task ID (Phase C) */
    videoTaskId: z.string().optional(),
    /** Generated video local path (Phase C) */
    videoUrl: z.string().optional(),
    /** Current processing status */
    status: ShotStatusEnum.default("pending"),
    /** Number of retries attempted */
    retryCount: z.number().default(0),
});
/** Collection of shots for one episode */
export const ShotsConfigSchema = z.object({
    shots: z.array(ShotSchema),
});
// --- Episode-level config types ---
/** Visual style and output settings for an episode */
export const EpisodeConfigSchema = z.object({
    /** Visual style (comic, realistic, watercolor, etc.) */
    style: z.string().default("comic"),
    /** Aspect ratio (default 9:16 for vertical mobile) */
    ratio: z.string().default("9:16"),
    /** BGM style description */
    bgmStyle: z.string().optional(),
});
/** Cost / credit tracking for an episode */
export const CostReportSchema = z.object({
    jimengCreditsUsed: z.number().default(0),
    seedanceCreditsUsed: z.number().default(0),
    totalCreditsUsed: z.number().default(0),
    estimatedCreditsNeeded: z.number().default(0),
});
/** Prompt template for quick-start genres */
export const TemplateSchema = z.object({
    id: z.string(),
    name: z.string(),
    genre: z.string(),
    characterProfileTemplate: z.string(),
    scenePromptTemplate: z.string(),
    stylePromptTemplate: z.string(),
    shotCount: z.number().default(8),
    duration: z.number().default(60),
});
//# sourceMappingURL=shots.js.map
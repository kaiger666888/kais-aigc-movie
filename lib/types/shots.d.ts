import { z } from "zod";
/** Processing status of a single shot */
export declare const ShotStatusEnum: z.ZodEnum<["pending", "generating", "done", "failed"]>;
/** Emotion tag for TTS pacing and video mood */
export declare const EmotionEnum: z.ZodEnum<["warm", "tense", "sad", "excited", "neutral"]>;
/** Speech pace for TTS speed control */
export declare const PaceEnum: z.ZodEnum<["slow", "normal", "fast"]>;
/** Shot type — determines video generation strategy */
export declare const ShotTypeEnum: z.ZodEnum<["dynamic", "static", "lipSync"]>;
/** A single shot / storyboard frame */
export declare const ShotSchema: z.ZodObject<{
    id: z.ZodString;
    /** Reference to a Scene.id */
    sceneId: z.ZodString;
    /** Shot duration in seconds */
    duration: z.ZodNumber;
    /** Text prompt sent to the image/video generation model (English, reference) */
    visualPrompt: z.ZodString;
    /** Chinese prompt for Jimeng text-to-image (first frame) */
    imagePrompt: z.ZodOptional<z.ZodString>;
    /** Chinese prompt for Jimeng text-to-image (last frame) */
    lastFramePrompt: z.ZodOptional<z.ZodString>;
    /** Chinese prompt for Seedance video generation (dynamic change description) */
    videoPrompt: z.ZodOptional<z.ZodString>;
    /** Fixed character appearance description for cross-shot consistency */
    characterProfile: z.ZodOptional<z.ZodString>;
    /** Emotion tag */
    emotion: z.ZodDefault<z.ZodEnum<["warm", "tense", "sad", "excited", "neutral"]>>;
    /** Speech pace */
    pace: z.ZodDefault<z.ZodEnum<["slow", "normal", "fast"]>>;
    /** Shot type: dynamic=video, static=image+audio, lipSync=reserved for Loopy */
    shotType: z.ZodDefault<z.ZodEnum<["dynamic", "static", "lipSync"]>>;
    /** Scene group ID — shots in the same group share TTS context */
    sceneGroupId: z.ZodOptional<z.ZodString>;
    /** BGM style description */
    musicStyle: z.ZodOptional<z.ZodString>;
    /** Narration / dialogue text shown as subtitle */
    subtitle: z.ZodString;
    /** Character who speaks (references Character.id), or "narrator" */
    speaker: z.ZodDefault<z.ZodString>;
    /** Camera angle instruction */
    cameraAngle: z.ZodDefault<z.ZodString>;
    /** Transition to next shot */
    transition: z.ZodDefault<z.ZodEnum<["cut", "fade", "dissolve", "wipe"]>>;
    /** First frame image local path */
    imageUrl: z.ZodOptional<z.ZodString>;
    /** Last frame image local path */
    lastFrameUrl: z.ZodOptional<z.ZodString>;
    /** First frame image original URL from Jimeng */
    imageAssetUrl: z.ZodOptional<z.ZodString>;
    /** Last frame image original URL from Jimeng */
    lastFrameAssetUrl: z.ZodOptional<z.ZodString>;
    /** Character reference image path (for image-to-image consistency) */
    characterRefPath: z.ZodOptional<z.ZodString>;
    /** Style reference image path (for image-to-image consistency) */
    styleRefPath: z.ZodOptional<z.ZodString>;
    /** Kling task id (filled during rendering) */
    taskId: z.ZodOptional<z.ZodString>;
    /** Seedance task ID (Phase C) */
    videoTaskId: z.ZodOptional<z.ZodString>;
    /** Generated video local path (Phase C) */
    videoUrl: z.ZodOptional<z.ZodString>;
    /** Current processing status */
    status: z.ZodDefault<z.ZodEnum<["pending", "generating", "done", "failed"]>>;
    /** Number of retries attempted */
    retryCount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "pending" | "generating" | "done";
    duration: number;
    id: string;
    sceneId: string;
    visualPrompt: string;
    emotion: "warm" | "tense" | "sad" | "excited" | "neutral";
    pace: "normal" | "slow" | "fast";
    shotType: "dynamic" | "static" | "lipSync";
    subtitle: string;
    speaker: string;
    cameraAngle: string;
    transition: "cut" | "fade" | "dissolve" | "wipe";
    retryCount: number;
    imagePrompt?: string | undefined;
    lastFramePrompt?: string | undefined;
    videoPrompt?: string | undefined;
    characterProfile?: string | undefined;
    sceneGroupId?: string | undefined;
    musicStyle?: string | undefined;
    imageUrl?: string | undefined;
    lastFrameUrl?: string | undefined;
    imageAssetUrl?: string | undefined;
    lastFrameAssetUrl?: string | undefined;
    characterRefPath?: string | undefined;
    styleRefPath?: string | undefined;
    taskId?: string | undefined;
    videoTaskId?: string | undefined;
    videoUrl?: string | undefined;
}, {
    duration: number;
    id: string;
    sceneId: string;
    visualPrompt: string;
    subtitle: string;
    status?: "failed" | "pending" | "generating" | "done" | undefined;
    imagePrompt?: string | undefined;
    lastFramePrompt?: string | undefined;
    videoPrompt?: string | undefined;
    characterProfile?: string | undefined;
    emotion?: "warm" | "tense" | "sad" | "excited" | "neutral" | undefined;
    pace?: "normal" | "slow" | "fast" | undefined;
    shotType?: "dynamic" | "static" | "lipSync" | undefined;
    sceneGroupId?: string | undefined;
    musicStyle?: string | undefined;
    speaker?: string | undefined;
    cameraAngle?: string | undefined;
    transition?: "cut" | "fade" | "dissolve" | "wipe" | undefined;
    imageUrl?: string | undefined;
    lastFrameUrl?: string | undefined;
    imageAssetUrl?: string | undefined;
    lastFrameAssetUrl?: string | undefined;
    characterRefPath?: string | undefined;
    styleRefPath?: string | undefined;
    taskId?: string | undefined;
    videoTaskId?: string | undefined;
    videoUrl?: string | undefined;
    retryCount?: number | undefined;
}>;
/** Collection of shots for one episode */
export declare const ShotsConfigSchema: z.ZodObject<{
    shots: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** Reference to a Scene.id */
        sceneId: z.ZodString;
        /** Shot duration in seconds */
        duration: z.ZodNumber;
        /** Text prompt sent to the image/video generation model (English, reference) */
        visualPrompt: z.ZodString;
        /** Chinese prompt for Jimeng text-to-image (first frame) */
        imagePrompt: z.ZodOptional<z.ZodString>;
        /** Chinese prompt for Jimeng text-to-image (last frame) */
        lastFramePrompt: z.ZodOptional<z.ZodString>;
        /** Chinese prompt for Seedance video generation (dynamic change description) */
        videoPrompt: z.ZodOptional<z.ZodString>;
        /** Fixed character appearance description for cross-shot consistency */
        characterProfile: z.ZodOptional<z.ZodString>;
        /** Emotion tag */
        emotion: z.ZodDefault<z.ZodEnum<["warm", "tense", "sad", "excited", "neutral"]>>;
        /** Speech pace */
        pace: z.ZodDefault<z.ZodEnum<["slow", "normal", "fast"]>>;
        /** Shot type: dynamic=video, static=image+audio, lipSync=reserved for Loopy */
        shotType: z.ZodDefault<z.ZodEnum<["dynamic", "static", "lipSync"]>>;
        /** Scene group ID — shots in the same group share TTS context */
        sceneGroupId: z.ZodOptional<z.ZodString>;
        /** BGM style description */
        musicStyle: z.ZodOptional<z.ZodString>;
        /** Narration / dialogue text shown as subtitle */
        subtitle: z.ZodString;
        /** Character who speaks (references Character.id), or "narrator" */
        speaker: z.ZodDefault<z.ZodString>;
        /** Camera angle instruction */
        cameraAngle: z.ZodDefault<z.ZodString>;
        /** Transition to next shot */
        transition: z.ZodDefault<z.ZodEnum<["cut", "fade", "dissolve", "wipe"]>>;
        /** First frame image local path */
        imageUrl: z.ZodOptional<z.ZodString>;
        /** Last frame image local path */
        lastFrameUrl: z.ZodOptional<z.ZodString>;
        /** First frame image original URL from Jimeng */
        imageAssetUrl: z.ZodOptional<z.ZodString>;
        /** Last frame image original URL from Jimeng */
        lastFrameAssetUrl: z.ZodOptional<z.ZodString>;
        /** Character reference image path (for image-to-image consistency) */
        characterRefPath: z.ZodOptional<z.ZodString>;
        /** Style reference image path (for image-to-image consistency) */
        styleRefPath: z.ZodOptional<z.ZodString>;
        /** Kling task id (filled during rendering) */
        taskId: z.ZodOptional<z.ZodString>;
        /** Seedance task ID (Phase C) */
        videoTaskId: z.ZodOptional<z.ZodString>;
        /** Generated video local path (Phase C) */
        videoUrl: z.ZodOptional<z.ZodString>;
        /** Current processing status */
        status: z.ZodDefault<z.ZodEnum<["pending", "generating", "done", "failed"]>>;
        /** Number of retries attempted */
        retryCount: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        status: "failed" | "pending" | "generating" | "done";
        duration: number;
        id: string;
        sceneId: string;
        visualPrompt: string;
        emotion: "warm" | "tense" | "sad" | "excited" | "neutral";
        pace: "normal" | "slow" | "fast";
        shotType: "dynamic" | "static" | "lipSync";
        subtitle: string;
        speaker: string;
        cameraAngle: string;
        transition: "cut" | "fade" | "dissolve" | "wipe";
        retryCount: number;
        imagePrompt?: string | undefined;
        lastFramePrompt?: string | undefined;
        videoPrompt?: string | undefined;
        characterProfile?: string | undefined;
        sceneGroupId?: string | undefined;
        musicStyle?: string | undefined;
        imageUrl?: string | undefined;
        lastFrameUrl?: string | undefined;
        imageAssetUrl?: string | undefined;
        lastFrameAssetUrl?: string | undefined;
        characterRefPath?: string | undefined;
        styleRefPath?: string | undefined;
        taskId?: string | undefined;
        videoTaskId?: string | undefined;
        videoUrl?: string | undefined;
    }, {
        duration: number;
        id: string;
        sceneId: string;
        visualPrompt: string;
        subtitle: string;
        status?: "failed" | "pending" | "generating" | "done" | undefined;
        imagePrompt?: string | undefined;
        lastFramePrompt?: string | undefined;
        videoPrompt?: string | undefined;
        characterProfile?: string | undefined;
        emotion?: "warm" | "tense" | "sad" | "excited" | "neutral" | undefined;
        pace?: "normal" | "slow" | "fast" | undefined;
        shotType?: "dynamic" | "static" | "lipSync" | undefined;
        sceneGroupId?: string | undefined;
        musicStyle?: string | undefined;
        speaker?: string | undefined;
        cameraAngle?: string | undefined;
        transition?: "cut" | "fade" | "dissolve" | "wipe" | undefined;
        imageUrl?: string | undefined;
        lastFrameUrl?: string | undefined;
        imageAssetUrl?: string | undefined;
        lastFrameAssetUrl?: string | undefined;
        characterRefPath?: string | undefined;
        styleRefPath?: string | undefined;
        taskId?: string | undefined;
        videoTaskId?: string | undefined;
        videoUrl?: string | undefined;
        retryCount?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    shots: {
        status: "failed" | "pending" | "generating" | "done";
        duration: number;
        id: string;
        sceneId: string;
        visualPrompt: string;
        emotion: "warm" | "tense" | "sad" | "excited" | "neutral";
        pace: "normal" | "slow" | "fast";
        shotType: "dynamic" | "static" | "lipSync";
        subtitle: string;
        speaker: string;
        cameraAngle: string;
        transition: "cut" | "fade" | "dissolve" | "wipe";
        retryCount: number;
        imagePrompt?: string | undefined;
        lastFramePrompt?: string | undefined;
        videoPrompt?: string | undefined;
        characterProfile?: string | undefined;
        sceneGroupId?: string | undefined;
        musicStyle?: string | undefined;
        imageUrl?: string | undefined;
        lastFrameUrl?: string | undefined;
        imageAssetUrl?: string | undefined;
        lastFrameAssetUrl?: string | undefined;
        characterRefPath?: string | undefined;
        styleRefPath?: string | undefined;
        taskId?: string | undefined;
        videoTaskId?: string | undefined;
        videoUrl?: string | undefined;
    }[];
}, {
    shots: {
        duration: number;
        id: string;
        sceneId: string;
        visualPrompt: string;
        subtitle: string;
        status?: "failed" | "pending" | "generating" | "done" | undefined;
        imagePrompt?: string | undefined;
        lastFramePrompt?: string | undefined;
        videoPrompt?: string | undefined;
        characterProfile?: string | undefined;
        emotion?: "warm" | "tense" | "sad" | "excited" | "neutral" | undefined;
        pace?: "normal" | "slow" | "fast" | undefined;
        shotType?: "dynamic" | "static" | "lipSync" | undefined;
        sceneGroupId?: string | undefined;
        musicStyle?: string | undefined;
        speaker?: string | undefined;
        cameraAngle?: string | undefined;
        transition?: "cut" | "fade" | "dissolve" | "wipe" | undefined;
        imageUrl?: string | undefined;
        lastFrameUrl?: string | undefined;
        imageAssetUrl?: string | undefined;
        lastFrameAssetUrl?: string | undefined;
        characterRefPath?: string | undefined;
        styleRefPath?: string | undefined;
        taskId?: string | undefined;
        videoTaskId?: string | undefined;
        videoUrl?: string | undefined;
        retryCount?: number | undefined;
    }[];
}>;
/** Visual style and output settings for an episode */
export declare const EpisodeConfigSchema: z.ZodObject<{
    /** Visual style (comic, realistic, watercolor, etc.) */
    style: z.ZodDefault<z.ZodString>;
    /** Aspect ratio (default 9:16 for vertical mobile) */
    ratio: z.ZodDefault<z.ZodString>;
    /** BGM style description */
    bgmStyle: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ratio: string;
    style: string;
    bgmStyle?: string | undefined;
}, {
    ratio?: string | undefined;
    style?: string | undefined;
    bgmStyle?: string | undefined;
}>;
/** Cost / credit tracking for an episode */
export declare const CostReportSchema: z.ZodObject<{
    jimengCreditsUsed: z.ZodDefault<z.ZodNumber>;
    seedanceCreditsUsed: z.ZodDefault<z.ZodNumber>;
    totalCreditsUsed: z.ZodDefault<z.ZodNumber>;
    estimatedCreditsNeeded: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    jimengCreditsUsed: number;
    seedanceCreditsUsed: number;
    totalCreditsUsed: number;
    estimatedCreditsNeeded: number;
}, {
    jimengCreditsUsed?: number | undefined;
    seedanceCreditsUsed?: number | undefined;
    totalCreditsUsed?: number | undefined;
    estimatedCreditsNeeded?: number | undefined;
}>;
/** Prompt template for quick-start genres */
export declare const TemplateSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    genre: z.ZodString;
    characterProfileTemplate: z.ZodString;
    scenePromptTemplate: z.ZodString;
    stylePromptTemplate: z.ZodString;
    shotCount: z.ZodDefault<z.ZodNumber>;
    duration: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    duration: number;
    id: string;
    name: string;
    genre: string;
    characterProfileTemplate: string;
    scenePromptTemplate: string;
    stylePromptTemplate: string;
    shotCount: number;
}, {
    id: string;
    name: string;
    genre: string;
    characterProfileTemplate: string;
    scenePromptTemplate: string;
    stylePromptTemplate: string;
    duration?: number | undefined;
    shotCount?: number | undefined;
}>;
export type ShotStatus = z.infer<typeof ShotStatusEnum>;
export type Emotion = z.infer<typeof EmotionEnum>;
export type Pace = z.infer<typeof PaceEnum>;
export type ShotType = z.infer<typeof ShotTypeEnum>;
export type Shot = z.infer<typeof ShotSchema>;
export type ShotsConfig = z.infer<typeof ShotsConfigSchema>;
export type EpisodeConfig = z.infer<typeof EpisodeConfigSchema>;
export type CostReport = z.infer<typeof CostReportSchema>;
export type Template = z.infer<typeof TemplateSchema>;
//# sourceMappingURL=shots.d.ts.map
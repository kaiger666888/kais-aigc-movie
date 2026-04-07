import { z } from "zod";
/** Character voice configuration for TTS */
export const VoiceConfigSchema = z.object({
    /** Voice preset identifier (e.g. "male-narrator", "female-soft") */
    voice: z.string().default("default"),
    /** Speech rate multiplier (0.5 – 2.0) */
    speed: z.number().min(0.5).max(2.0).default(1.0),
});
/** A character in the story */
export const CharacterSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    voiceConfig: VoiceConfigSchema.default({}),
});
/** A scene / location in the story */
export const SceneSchema = z.object({
    id: z.string(),
    location: z.string(),
    description: z.string(),
    mood: z.string().default("neutral"),
    timeOfDay: z.enum(["morning", "afternoon", "evening", "night"]).default("afternoon"),
});
/** The complete story bible for one episode */
export const StoryBibleSchema = z.object({
    title: z.string(),
    theme: z.string(),
    genre: z.string().default("slice-of-life"),
    characters: z.array(CharacterSchema),
    scenes: z.array(SceneSchema),
    synopsis: z.string(),
    /** Target total duration in seconds */
    duration: z.number().min(30).max(120).default(60),
    style: z.string().default("comic"),
});
//# sourceMappingURL=story-bible.js.map
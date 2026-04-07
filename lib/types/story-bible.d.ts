import { z } from "zod";
/** Character voice configuration for TTS */
export declare const VoiceConfigSchema: z.ZodObject<{
    /** Voice preset identifier (e.g. "male-narrator", "female-soft") */
    voice: z.ZodDefault<z.ZodString>;
    /** Speech rate multiplier (0.5 – 2.0) */
    speed: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    voice: string;
    speed: number;
}, {
    voice?: string | undefined;
    speed?: number | undefined;
}>;
/** A character in the story */
export declare const CharacterSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    voiceConfig: z.ZodDefault<z.ZodObject<{
        /** Voice preset identifier (e.g. "male-narrator", "female-soft") */
        voice: z.ZodDefault<z.ZodString>;
        /** Speech rate multiplier (0.5 – 2.0) */
        speed: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        voice: string;
        speed: number;
    }, {
        voice?: string | undefined;
        speed?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    description: string;
    voiceConfig: {
        voice: string;
        speed: number;
    };
}, {
    id: string;
    name: string;
    description: string;
    voiceConfig?: {
        voice?: string | undefined;
        speed?: number | undefined;
    } | undefined;
}>;
/** A scene / location in the story */
export declare const SceneSchema: z.ZodObject<{
    id: z.ZodString;
    location: z.ZodString;
    description: z.ZodString;
    mood: z.ZodDefault<z.ZodString>;
    timeOfDay: z.ZodDefault<z.ZodEnum<["morning", "afternoon", "evening", "night"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    location: string;
    mood: string;
    timeOfDay: "morning" | "afternoon" | "evening" | "night";
}, {
    id: string;
    description: string;
    location: string;
    mood?: string | undefined;
    timeOfDay?: "morning" | "afternoon" | "evening" | "night" | undefined;
}>;
/** The complete story bible for one episode */
export declare const StoryBibleSchema: z.ZodObject<{
    title: z.ZodString;
    theme: z.ZodString;
    genre: z.ZodDefault<z.ZodString>;
    characters: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        voiceConfig: z.ZodDefault<z.ZodObject<{
            /** Voice preset identifier (e.g. "male-narrator", "female-soft") */
            voice: z.ZodDefault<z.ZodString>;
            /** Speech rate multiplier (0.5 – 2.0) */
            speed: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            voice: string;
            speed: number;
        }, {
            voice?: string | undefined;
            speed?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        description: string;
        voiceConfig: {
            voice: string;
            speed: number;
        };
    }, {
        id: string;
        name: string;
        description: string;
        voiceConfig?: {
            voice?: string | undefined;
            speed?: number | undefined;
        } | undefined;
    }>, "many">;
    scenes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        location: z.ZodString;
        description: z.ZodString;
        mood: z.ZodDefault<z.ZodString>;
        timeOfDay: z.ZodDefault<z.ZodEnum<["morning", "afternoon", "evening", "night"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        description: string;
        location: string;
        mood: string;
        timeOfDay: "morning" | "afternoon" | "evening" | "night";
    }, {
        id: string;
        description: string;
        location: string;
        mood?: string | undefined;
        timeOfDay?: "morning" | "afternoon" | "evening" | "night" | undefined;
    }>, "many">;
    synopsis: z.ZodString;
    /** Target total duration in seconds */
    duration: z.ZodDefault<z.ZodNumber>;
    style: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    duration: number;
    style: string;
    genre: string;
    title: string;
    theme: string;
    characters: {
        id: string;
        name: string;
        description: string;
        voiceConfig: {
            voice: string;
            speed: number;
        };
    }[];
    scenes: {
        id: string;
        description: string;
        location: string;
        mood: string;
        timeOfDay: "morning" | "afternoon" | "evening" | "night";
    }[];
    synopsis: string;
}, {
    title: string;
    theme: string;
    characters: {
        id: string;
        name: string;
        description: string;
        voiceConfig?: {
            voice?: string | undefined;
            speed?: number | undefined;
        } | undefined;
    }[];
    scenes: {
        id: string;
        description: string;
        location: string;
        mood?: string | undefined;
        timeOfDay?: "morning" | "afternoon" | "evening" | "night" | undefined;
    }[];
    synopsis: string;
    duration?: number | undefined;
    style?: string | undefined;
    genre?: string | undefined;
}>;
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type StoryBible = z.infer<typeof StoryBibleSchema>;
//# sourceMappingURL=story-bible.d.ts.map
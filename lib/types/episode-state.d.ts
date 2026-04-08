import { z } from "zod";
/** Overall episode lifecycle status */
export declare const EpisodeStatusEnum: z.ZodEnum<["created", "writing", "voice_rendering", "editing", "qc", "done", "failed"]>;
/** Which step the pipeline is currently on */
export declare const EpisodeStepEnum: z.ZodEnum<["init", "writing", "voice", "rendering", "editing", "qc"]>;
/** Full episode state — persisted to disk */
export declare const EpisodeStateSchema: z.ZodObject<{
    /** Unique episode id (uuid) */
    id: z.ZodString;
    /** Original user topic */
    topic: z.ZodString;
    status: z.ZodEnum<["created", "writing", "voice_rendering", "editing", "qc", "done", "failed"]>;
    currentStep: z.ZodEnum<["init", "writing", "voice", "rendering", "editing", "qc"]>;
    progress: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    /** Number of times the episode pipeline has been retried */
    retryCount: z.ZodDefault<z.ZodNumber>;
    /** Accumulated error messages */
    errors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Optional generation options */
    options: z.ZodOptional<z.ZodObject<{
        duration: z.ZodOptional<z.ZodNumber>;
        style: z.ZodOptional<z.ZodString>;
        characterCount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        duration?: number | undefined;
        style?: string | undefined;
        characterCount?: number | undefined;
    }, {
        duration?: number | undefined;
        style?: string | undefined;
        characterCount?: number | undefined;
    }>>;
    /** Per-shot audio paths (for static/lipSync shots using TTS + Ken Burns) */
    audioPaths: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "done" | "created" | "writing" | "voice_rendering" | "editing" | "qc";
    id: string;
    retryCount: number;
    topic: string;
    currentStep: "voice" | "writing" | "editing" | "qc" | "init" | "rendering";
    progress: number;
    createdAt: string;
    updatedAt: string;
    errors: string[];
    audioPaths: Record<string, string>;
    options?: {
        duration?: number | undefined;
        style?: string | undefined;
        characterCount?: number | undefined;
    } | undefined;
}, {
    status: "failed" | "done" | "created" | "writing" | "voice_rendering" | "editing" | "qc";
    id: string;
    topic: string;
    currentStep: "voice" | "writing" | "editing" | "qc" | "init" | "rendering";
    createdAt: string;
    updatedAt: string;
    options?: {
        duration?: number | undefined;
        style?: string | undefined;
        characterCount?: number | undefined;
    } | undefined;
    retryCount?: number | undefined;
    progress?: number | undefined;
    errors?: string[] | undefined;
    audioPaths?: Record<string, string> | undefined;
}>;
export type EpisodeStatus = z.infer<typeof EpisodeStatusEnum>;
export type EpisodeStep = z.infer<typeof EpisodeStepEnum>;
export type EpisodeState = z.infer<typeof EpisodeStateSchema>;
//# sourceMappingURL=episode-state.d.ts.map
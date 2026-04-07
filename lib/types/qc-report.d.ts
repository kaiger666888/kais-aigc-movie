import { z } from "zod";
/** QC result for a single shot */
export declare const ShotQCSchema: z.ZodObject<{
    shotId: z.ZodString;
    /** Video duration in seconds */
    duration: z.ZodNumber;
    hasAudio: z.ZodBoolean;
    hasVideo: z.ZodBoolean;
    /** Whether subtitle is correctly synced */
    subtitleSync: z.ZodBoolean;
    /** Per-shot score 0–10 */
    score: z.ZodNumber;
    issues: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    issues: string[];
    duration: number;
    shotId: string;
    hasAudio: boolean;
    hasVideo: boolean;
    subtitleSync: boolean;
    score: number;
}, {
    issues: string[];
    duration: number;
    shotId: string;
    hasAudio: boolean;
    hasVideo: boolean;
    subtitleSync: boolean;
    score: number;
}>;
/** QC severity levels */
export declare const QCIssueSeveritySchema: z.ZodEnum<["critical", "warning", "info"]>;
/** A structured QC issue */
export declare const QCIssueSchema: z.ZodObject<{
    shotId: z.ZodOptional<z.ZodString>;
    severity: z.ZodEnum<["critical", "warning", "info"]>;
    category: z.ZodEnum<["visual", "audio", "timing", "continuity"]>;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    description: string;
    severity: "critical" | "warning" | "info";
    category: "visual" | "audio" | "timing" | "continuity";
    shotId?: string | undefined;
}, {
    description: string;
    severity: "critical" | "warning" | "info";
    category: "visual" | "audio" | "timing" | "continuity";
    shotId?: string | undefined;
}>;
/** Full QC report for an episode */
export declare const QCReportSchema: z.ZodObject<{
    episodeId: z.ZodString;
    timestamp: z.ZodString;
    passed: z.ZodBoolean;
    overallScore: z.ZodNumber;
    shots: z.ZodArray<z.ZodObject<{
        shotId: z.ZodString;
        /** Video duration in seconds */
        duration: z.ZodNumber;
        hasAudio: z.ZodBoolean;
        hasVideo: z.ZodBoolean;
        /** Whether subtitle is correctly synced */
        subtitleSync: z.ZodBoolean;
        /** Per-shot score 0–10 */
        score: z.ZodNumber;
        issues: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        issues: string[];
        duration: number;
        shotId: string;
        hasAudio: boolean;
        hasVideo: boolean;
        subtitleSync: boolean;
        score: number;
    }, {
        issues: string[];
        duration: number;
        shotId: string;
        hasAudio: boolean;
        hasVideo: boolean;
        subtitleSync: boolean;
        score: number;
    }>, "many">;
    issues: z.ZodArray<z.ZodObject<{
        shotId: z.ZodOptional<z.ZodString>;
        severity: z.ZodEnum<["critical", "warning", "info"]>;
        category: z.ZodEnum<["visual", "audio", "timing", "continuity"]>;
        description: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        description: string;
        severity: "critical" | "warning" | "info";
        category: "visual" | "audio" | "timing" | "continuity";
        shotId?: string | undefined;
    }, {
        description: string;
        severity: "critical" | "warning" | "info";
        category: "visual" | "audio" | "timing" | "continuity";
        shotId?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    issues: {
        description: string;
        severity: "critical" | "warning" | "info";
        category: "visual" | "audio" | "timing" | "continuity";
        shotId?: string | undefined;
    }[];
    shots: {
        issues: string[];
        duration: number;
        shotId: string;
        hasAudio: boolean;
        hasVideo: boolean;
        subtitleSync: boolean;
        score: number;
    }[];
    episodeId: string;
    timestamp: string;
    passed: boolean;
    overallScore: number;
}, {
    issues: {
        description: string;
        severity: "critical" | "warning" | "info";
        category: "visual" | "audio" | "timing" | "continuity";
        shotId?: string | undefined;
    }[];
    shots: {
        issues: string[];
        duration: number;
        shotId: string;
        hasAudio: boolean;
        hasVideo: boolean;
        subtitleSync: boolean;
        score: number;
    }[];
    episodeId: string;
    timestamp: string;
    passed: boolean;
    overallScore: number;
}>;
export type ShotQC = z.infer<typeof ShotQCSchema>;
export type QCIssueSeverity = z.infer<typeof QCIssueSeveritySchema>;
export type QCIssue = z.infer<typeof QCIssueSchema>;
export type QCReport = z.infer<typeof QCReportSchema>;
//# sourceMappingURL=qc-report.d.ts.map
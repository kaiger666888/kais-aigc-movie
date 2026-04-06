import { z } from "zod";

/** QC result for a single shot */
export const ShotQCSchema = z.object({
  shotId: z.string(),
  /** Video duration in seconds */
  duration: z.number(),
  hasAudio: z.boolean(),
  hasVideo: z.boolean(),
  /** Whether subtitle is correctly synced */
  subtitleSync: z.boolean(),
  /** Per-shot score 0–10 */
  score: z.number().min(0).max(10),
  issues: z.array(z.string()),
});

/** QC severity levels */
export const QCIssueSeveritySchema = z.enum(["critical", "warning", "info"]);

/** A structured QC issue */
export const QCIssueSchema = z.object({
  shotId: z.string().optional(),
  severity: QCIssueSeveritySchema,
  category: z.enum(["visual", "audio", "timing", "continuity"]),
  description: z.string(),
});

/** Full QC report for an episode */
export const QCReportSchema = z.object({
  episodeId: z.string(),
  timestamp: z.string(),
  passed: z.boolean(),
  overallScore: z.number().min(0).max(10),
  shots: z.array(ShotQCSchema),
  issues: z.array(QCIssueSchema),
});

export type ShotQC = z.infer<typeof ShotQCSchema>;
export type QCIssueSeverity = z.infer<typeof QCIssueSeveritySchema>;
export type QCIssue = z.infer<typeof QCIssueSchema>;
export type QCReport = z.infer<typeof QCReportSchema>;

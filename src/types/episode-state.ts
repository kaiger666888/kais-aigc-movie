import { z } from "zod";

/** Overall episode lifecycle status */
export const EpisodeStatusEnum = z.enum([
  "created",
  "writing",
  "voice_rendering",
  "editing",
  "qc",
  "done",
  "failed",
]);

/** Which step the pipeline is currently on */
export const EpisodeStepEnum = z.enum([
  "init",
  "writing",
  "voice",
  "rendering",
  "editing",
  "qc",
]);

/** Full episode state — persisted to disk */
export const EpisodeStateSchema = z.object({
  /** Unique episode id (uuid) */
  id: z.string(),
  /** Original user topic */
  topic: z.string(),
  status: EpisodeStatusEnum,
  currentStep: EpisodeStepEnum,
  progress: z.number().min(0).max(100).default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Number of times the episode pipeline has been retried */
  retryCount: z.number().default(0),
  /** Accumulated error messages */
  errors: z.array(z.string()).default([]),
  /** Optional generation options */
  options: z
    .object({
      duration: z.number().optional(),
      style: z.string().optional(),
      characterCount: z.number().optional(),
    })
    .optional(),
});

export type EpisodeStatus = z.infer<typeof EpisodeStatusEnum>;
export type EpisodeStep = z.infer<typeof EpisodeStepEnum>;
export type EpisodeState = z.infer<typeof EpisodeStateSchema>;

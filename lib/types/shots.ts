import { z } from "zod";

/** Processing status of a single shot */
export const ShotStatusEnum = z.enum([
  "pending",
  "generating",
  "done",
  "failed",
]);

/** A single shot / storyboard frame */
export const ShotSchema = z.object({
  id: z.string(),
  /** Reference to a Scene.id */
  sceneId: z.string(),
  /** Shot duration in seconds */
  duration: z.number().min(1).max(15),
  /** Text prompt sent to the image/video generation model */
  visualPrompt: z.string(),
  /** Narration / dialogue text shown as subtitle */
  subtitle: z.string(),
  /** Character who speaks (references Character.id), or "narrator" */
  speaker: z.string().default("narrator"),
  /** Camera angle instruction */
  cameraAngle: z.string().default("medium"),
  /** Transition to next shot */
  transition: z.enum(["cut", "fade", "dissolve", "wipe"]).default("fade"),
  /** Kling task id (filled during rendering) */
  taskId: z.string().optional(),
  /** Current processing status */
  status: ShotStatusEnum.default("pending"),
  /** Number of retries attempted */
  retryCount: z.number().default(0),
});

/** Collection of shots for one episode */
export const ShotsConfigSchema = z.object({
  shots: z.array(ShotSchema),
});

export type ShotStatus = z.infer<typeof ShotStatusEnum>;
export type Shot = z.infer<typeof ShotSchema>;
export type ShotsConfig = z.infer<typeof ShotsConfigSchema>;

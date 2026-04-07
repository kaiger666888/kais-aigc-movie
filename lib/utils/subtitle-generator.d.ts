/**
 * SRT subtitle generator.
 *
 * Generates SRT subtitle files from shot data with proper timing.
 */
import type { Shot } from "../types/shots.js";
export interface SubtitleOptions {
    /** Add a small padding at start/end of each subtitle (seconds, default 0.1) */
    padding?: number;
}
/**
 * Generate SRT subtitle content from shots.
 *
 * @param shots - Array of shots with subtitle text and duration
 * @param audioDurations - Optional map of shot.id → actual audio duration in seconds.
 *                         If provided, uses real audio duration instead of shot.duration.
 * @param options - Subtitle generation options
 * @returns SRT file content string
 */
export declare function generateSRT(shots: Shot[], audioDurations?: Map<string, number>, options?: SubtitleOptions): string;
/**
 * Generate ASS subtitle content with styling.
 */
export declare function generateASS(shots: Shot[], audioDurations?: Map<string, number>, options?: SubtitleOptions): string;
//# sourceMappingURL=subtitle-generator.d.ts.map
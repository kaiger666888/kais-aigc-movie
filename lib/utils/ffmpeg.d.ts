/**
 * Concatenate multiple video files into one using ffmpeg concat demuxer.
 *
 * @param inputPaths - Ordered list of video file paths.
 * @param outputPath - Destination file path.
 */
export declare function concatVideos(inputPaths: string[], outputPath: string): Promise<void>;
/**
 * Overlay an audio track onto a video (replaces existing audio).
 *
 * @param videoPath - Source video.
 * @param audioPath - Audio to overlay.
 * @param outputPath - Destination file.
 */
export declare function addAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void>;
/**
 * Burn subtitles into a video from an SRT file.
 *
 * @param videoPath - Source video.
 * @param srtPath   - SRT subtitle file.
 * @param outputPath - Destination file.
 */
export declare function addSubtitle(videoPath: string, srtPath: string, outputPath: string): Promise<void>;
/**
 * Add crossfade transitions between video clips.
 *
 * @param inputPaths - Ordered video clips.
 * @param outputPath - Destination file.
 * @param type - Transition type (default "fade").
 */
export declare function addTransition(inputPaths: string[], outputPath: string, type?: string): Promise<void>;
/**
 * Probe video metadata using ffprobe.
 *
 * @param filePath - Path to the media file.
 * @returns Object with duration, codec, width, height.
 */
export declare function probeVideo(filePath: string): Promise<{
    duration: number;
    codec: string;
    width: number;
    height: number;
}>;
//# sourceMappingURL=ffmpeg.d.ts.map
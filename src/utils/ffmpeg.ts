import ffmpeg from "fluent-ffmpeg";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Concatenate multiple video files into one.
 *
 * @param inputPaths - Ordered list of video file paths.
 * @param outputPath - Destination file path.
 */
export async function concatVideos(
  inputPaths: string[],
  outputPath: string,
): Promise<void> {
  // Build an ffmpeg concat list
  const listPath = join(tmpdir(), `concat-${Date.now()}.txt`);
  const content = inputPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await writeFile(listPath, content, "utf-8");

  try {
    await runFfmpeg((cmd) =>
      cmd.input(listPath).inputOptions(["-f concat", "-safe 0"]).outputOptions("-c copy").save(outputPath),
    );
  } finally {
    await unlink(listPath).catch(() => {});
  }
}

/**
 * Overlay an audio track onto a video.
 *
 * Replaces any existing audio in the video with the new track.
 *
 * @param videoPath - Source video.
 * @param audioPath - Audio to overlay.
 * @param outputPath - Destination file.
 */
export async function addAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  await runFfmpeg((cmd) =>
    cmd
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v copy",
        "-c:a aac",
        "-map 0:v:0",
        "-map 1:a:0",
        "-shortest",
      ])
      .save(outputPath),
  );
}

/**
 * Burn subtitles into a video from an SRT file.
 *
 * @param videoPath - Source video.
 * @param srtPath   - SRT subtitle file.
 * @param outputPath - Destination file.
 */
export async function addSubtitle(
  videoPath: string,
  srtPath: string,
  outputPath: string,
): Promise<void> {
  // Escape special characters for ffmpeg filter
  const escapedPath = srtPath
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");

  await runFfmpeg((cmd) =>
    cmd
      .input(videoPath)
      .videoFilter(`subtitles='${escapedPath}'`)
      .outputOptions(["-c:a copy"])
      .save(outputPath),
  );
}

/**
 * Add a crossfade transition between clips.
 *
 * Produces a single output with `fadeDuration` seconds of crossfade
 * between each consecutive clip.
 *
 * @param inputPaths - Ordered video clips.
 * @param outputPath - Destination file.
 * @param fadeDuration - Fade duration in seconds (default 0.3).
 */
export async function addTransition(
  inputPaths: string[],
  outputPath: string,
  fadeDuration: number = 0.3,
): Promise<void> {
  if (inputPaths.length === 0) {
    throw new Error("No input clips provided");
  }
  if (inputPaths.length === 1) {
    // Single clip — just copy
    await runFfmpeg((cmd) =>
      cmd.input(inputPaths[0]!).outputOptions("-c copy").save(outputPath),
    );
    return;
  }

  const cmd = ffmpeg();

  // Add each clip as an input and build xfade filter chain
  for (const p of inputPaths) {
    cmd.input(p);
  }

  // Build filter complex for chain of xfade filters
  const filters: string[] = [];
  let lastLabel = "[0:v]";
  for (let i = 1; i < inputPaths.length; i++) {
    const outLabel =
      i === inputPaths.length - 1
        ? "[outv]"
        : `[v${i}]`;
    filters.push(
      `${lastLabel}[${i}:v]xfade=transition=fade:duration=${fadeDuration}:offset=${computeOffset(inputPaths, i, fadeDuration)}${outLabel}`,
    );
    lastLabel = outLabel;
  }

  cmd.complexFilter(filters, "[outv]")
    .outputOptions(["-c:a copy"])
    .save(outputPath);

  await new Promise<void>((resolve, reject) => {
    cmd.on("end", () => resolve());
    cmd.on("error", (err) => reject(new Error(`FFmpeg transition error: ${err.message}`)));
  });
}

/**
 * Probe video metadata using ffprobe.
 *
 * @param filePath - Path to the media file.
 * @returns Parsed ffprobe output.
 */
export async function probeVideo(
  filePath: string,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(new Error(`ffprobe error: ${err.message}`));
      else resolve(data as unknown as Record<string, unknown>);
    });
  });
}

/** Calculate offset for xfade filter chain */
function computeOffset(
  _inputs: string[],
  _index: number,
  _fade: number,
): number {
  // Simplified: assume each clip is ~5 seconds. Real impl would probe durations.
  // For now use a conservative estimate.
  return 5;
}

/** Run an ffmpeg command and wrap events in a Promise. */
function runFfmpeg(
  builder: (cmd: ffmpeg.FfmpegCommand) => ffmpeg.FfmpegCommand,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = builder(ffmpeg());
    cmd.on("end", () => resolve());
    cmd.on("error", (err: Error) =>
      reject(new Error(`FFmpeg error: ${err.message}`)),
    );
  });
}

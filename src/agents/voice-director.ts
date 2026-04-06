import { writeFile, mkdir } from "node:fs/promises";
import { GlmTtsService } from "../services/glm-tts.js";
import type { StoryBible, Character } from "../types/story-bible.js";
import type { ShotsConfig } from "../types/shots.js";

/** Progress callback type */
export type VoiceProgressCallback = (
  completed: number,
  total: number,
  shotId: string,
) => void;

/**
 * Voice Director Agent — generates audio files for each shot.
 *
 * Maps shot subtitles to TTS calls, using per-character voice configurations
 * from the story bible.
 */
export class VoiceDirectorAgent {
  private readonly tts: GlmTtsService;

  constructor(tts?: GlmTtsService) {
    this.tts = tts ?? new GlmTtsService();
  }

  /**
   * Generate audio files for all shots.
   *
   * @param shots - Shot configuration with subtitle text.
   * @param storyBible - Story bible with character voice configs.
   * @param outputDir - Directory to save audio files (usually `audio/`).
   * @param onProgress - Optional progress callback.
   * @returns Map of shotId → audio file path.
   */
  async generate(
    shots: ShotsConfig,
    storyBible: StoryBible,
    outputDir: string,
    onProgress?: VoiceProgressCallback,
  ): Promise<Map<string, string>> {
    await mkdir(outputDir, { recursive: true });

    // Build character voice config lookup
    const voiceMap = new Map<string, Character>();
    for (const char of storyBible.characters) {
      voiceMap.set(char.id, char);
    }

    const results = new Map<string, string>();
    const total = shots.shots.length;
    let completed = 0;

    // Build batch items
    const items = shots.shots.map((shot) => {
      const speaker = shot.speaker ?? "narrator";
      const character = voiceMap.get(speaker);
      return {
        id: shot.id,
        text: shot.subtitle,
        options: {
          voice: character?.voiceConfig.voice ?? "alloy",
          speed: character?.voiceConfig.speed ?? 1.0,
        },
      };
    });

    // Process in batches with progress tracking
    for (const item of items) {
      try {
        const audioBuffer = await this.tts.synthesize(
          item.text,
          item.options,
        );
        const filePath = `${outputDir}/${item.id}.mp3`;
        await writeFile(filePath, audioBuffer);
        results.set(item.id, filePath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Voice synthesis failed for shot ${item.id}: ${msg}`);
      }

      completed++;
      onProgress?.(completed, total, item.id);
    }

    return results;
  }
}

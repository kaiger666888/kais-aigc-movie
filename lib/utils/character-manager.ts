/**
 * Character consistency manager.
 *
 * Saves and retrieves character reference images to maintain
 * cross-shot visual consistency via image-to-image generation.
 */

import { mkdir, copyFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { Shot } from "../types/shots.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CharacterProfile {
  id: string;
  name: string;
  description: string; // Fixed appearance: hair, clothing, body type, etc.
}

// ---------------------------------------------------------------------------
// CharacterManager
// ---------------------------------------------------------------------------

export class CharacterManager {
  /**
   * Extract character profiles from shots.
   * Looks for characterProfile fields and deduplicates by content.
   */
  extractCharacterProfiles(shots: Shot[]): CharacterProfile[] {
    const seen = new Map<string, CharacterProfile>();
    for (const shot of shots) {
      if (!shot.characterProfile) continue;
      const key = shot.characterProfile.slice(0, 50); // dedupe by prefix
      if (!seen.has(key)) {
        seen.set(key, {
          id: `char_${seen.size + 1}`,
          name: shot.speaker ?? "unknown",
          description: shot.characterProfile,
        });
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Save a character reference image for future image-to-image calls.
   * @returns The saved file path.
   */
  async saveCharacterRef(
    sourceImagePath: string,
    outputDir: string,
  ): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const destPath = join(outputDir, "character_ref.png");
    await copyFile(sourceImagePath, destPath);
    return destPath;
  }

  /**
   * Get the character reference image path for an episode.
   */
  getCharacterRefPath(episodeDir: string): string {
    return join(episodeDir, "assets", "character_ref.png");
  }

  /**
   * Check if a character reference image exists.
   */
  async hasCharacterRef(episodeDir: string): Promise<boolean> {
    try {
      await access(this.getCharacterRefPath(episodeDir));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build a character description suffix to append to image prompts.
   * Ensures every prompt includes the fixed character appearance.
   */
  buildCharacterPromptSuffix(profiles: CharacterProfile[]): string {
    if (profiles.length === 0) return "";
    return profiles.map((p) => p.description).join("，");
  }
}

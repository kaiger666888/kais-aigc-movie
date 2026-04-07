/**
 * Character consistency manager.
 *
 * Saves and retrieves character reference images to maintain
 * cross-shot visual consistency via image-to-image generation.
 */
import { mkdir, copyFile, access } from "node:fs/promises";
import { join } from "node:path";
// ---------------------------------------------------------------------------
// CharacterManager
// ---------------------------------------------------------------------------
export class CharacterManager {
    /**
     * Extract character profiles from shots.
     * Looks for characterProfile fields and deduplicates by content.
     */
    extractCharacterProfiles(shots) {
        const seen = new Map();
        for (const shot of shots) {
            if (!shot.characterProfile)
                continue;
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
    async saveCharacterRef(sourceImagePath, outputDir) {
        await mkdir(outputDir, { recursive: true });
        const destPath = join(outputDir, "character_ref.png");
        await copyFile(sourceImagePath, destPath);
        return destPath;
    }
    /**
     * Get the character reference image path for an episode.
     */
    getCharacterRefPath(episodeDir) {
        return join(episodeDir, "assets", "character_ref.png");
    }
    /**
     * Check if a character reference image exists.
     */
    async hasCharacterRef(episodeDir) {
        try {
            await access(this.getCharacterRefPath(episodeDir));
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Build a character description suffix to append to image prompts.
     * Ensures every prompt includes the fixed character appearance.
     */
    buildCharacterPromptSuffix(profiles) {
        if (profiles.length === 0)
            return "";
        return profiles.map((p) => p.description).join("，");
    }
}
//# sourceMappingURL=character-manager.js.map
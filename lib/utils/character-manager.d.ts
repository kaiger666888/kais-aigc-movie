/**
 * Character consistency manager.
 *
 * Saves and retrieves character reference images to maintain
 * cross-shot visual consistency via image-to-image generation.
 */
import type { Shot } from "../types/shots.js";
export interface CharacterProfile {
    id: string;
    name: string;
    description: string;
}
export declare class CharacterManager {
    /**
     * Extract character profiles from shots.
     * Looks for characterProfile fields and deduplicates by content.
     */
    extractCharacterProfiles(shots: Shot[]): CharacterProfile[];
    /**
     * Save a character reference image for future image-to-image calls.
     * @returns The saved file path.
     */
    saveCharacterRef(sourceImagePath: string, outputDir: string): Promise<string>;
    /**
     * Get the character reference image path for an episode.
     */
    getCharacterRefPath(episodeDir: string): string;
    /**
     * Check if a character reference image exists.
     */
    hasCharacterRef(episodeDir: string): Promise<boolean>;
    /**
     * Build a character description suffix to append to image prompts.
     * Ensures every prompt includes the fixed character appearance.
     */
    buildCharacterPromptSuffix(profiles: CharacterProfile[]): string;
}
//# sourceMappingURL=character-manager.d.ts.map
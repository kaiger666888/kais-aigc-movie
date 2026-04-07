/**
 * Visual style consistency manager.
 *
 * Saves and retrieves style reference images to maintain
 * a uniform visual style across all shots.
 */
export declare class StyleManager {
    /**
     * Save a style reference image for future image-to-image calls.
     * @returns The saved file path.
     */
    saveStyleRef(sourceImagePath: string, outputDir: string): Promise<string>;
    /**
     * Get the style reference image path for an episode.
     */
    getStyleRefPath(episodeDir: string): string;
    /**
     * Check if a style reference image exists.
     */
    hasStyleRef(episodeDir: string): Promise<boolean>;
    /**
     * Build a style description suffix to append to image prompts.
     * @param style - Visual style name (comic, realistic, watercolor, etc.)
     */
    buildStylePromptSuffix(style: string): string;
}
//# sourceMappingURL=style-manager.d.ts.map
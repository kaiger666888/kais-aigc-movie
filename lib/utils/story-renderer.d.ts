/**
 * Story preview HTML generator.
 *
 * Generates a single-file HTML page with 3 tabs for review:
 * Tab 1: Story Preview (slideshow)
 * Tab 2: Shot Details (table with prompts)
 * Tab 3: Video Tasks (task list)
 */
export interface StoryRenderOptions {
    title: string;
    storyBible: Record<string, unknown>;
    shots: Array<{
        id: string;
        imageUrl: string;
        lastFrameUrl?: string;
        subtitle: string;
        audioUrl?: string;
        speaker?: string;
        duration?: number;
        imagePrompt?: string;
        lastFramePrompt?: string;
        videoPrompt?: string;
    }>;
    videoTasks?: Array<{
        shotId: string;
        prompt: string;
        firstFramePath: string;
        lastFramePath: string;
        ratio: string;
        duration: number;
        status: string;
    }>;
    outputPath: string;
    theme?: "dark" | "light";
    style?: "comic" | "cinematic" | "minimal";
}
export declare function renderStoryHtml(options: StoryRenderOptions): Promise<string>;
//# sourceMappingURL=story-renderer.d.ts.map
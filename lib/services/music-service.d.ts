/**
 * Free music search service.
 *
 * Searches royalty-free music from public sources (Free Music Archive, Pixabay).
 * Note: Actual web scraping is handled by the calling agent; this service
 * provides the interface and download logic.
 */
export interface MusicResult {
    title: string;
    artist: string;
    url: string;
    duration: number;
    genre: string;
    license: string;
}
export interface MusicSearchOptions {
    /** Style / mood description, e.g. "warm piano background" */
    style: string;
    /** Minimum duration in seconds (default 60) */
    minDuration?: number;
    /** Maximum results to return (default 5) */
    maxResults?: number;
}
export declare class MusicService {
    private cacheDir;
    constructor(cacheDir?: string);
    /**
     * Search for free music matching a style description.
     *
     * Since we can't directly scrape FMA/Pixabay from Node without a browser,
     * this method returns a search URL that the agent can use with web_search.
     * In a future version, we could integrate a proper API.
     *
     * @returns Search query URL and instructions for the agent.
     */
    buildSearchQuery(options: MusicSearchOptions): string;
    /**
     * Parse search results from web_search output into MusicResult[].
     * This is a helper for the agent to structure raw search results.
     */
    parseSearchResults(rawResults: Array<{
        title: string;
        url: string;
        snippet?: string;
    }>): MusicResult[];
    /**
     * Download a music file to the specified directory.
     * @returns Local file path.
     */
    downloadMusic(url: string, outputDir: string): Promise<string>;
    /**
     * Get cached music file path if available.
     */
    getCachedPath(musicKey: string): string | null;
}
//# sourceMappingURL=music-service.d.ts.map
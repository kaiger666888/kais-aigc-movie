/**
 * Free music search service.
 *
 * Searches royalty-free music from public sources (Free Music Archive, Pixabay).
 * Note: Actual web scraping is handled by the calling agent; this service
 * provides the interface and download logic.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MusicResult {
  title: string;
  artist: string;
  url: string;
  duration: number; // seconds
  genre: string;
  license: string; // e.g. "CC0", "CC-BY"
}

export interface MusicSearchOptions {
  /** Style / mood description, e.g. "warm piano background" */
  style: string;
  /** Minimum duration in seconds (default 60) */
  minDuration?: number;
  /** Maximum results to return (default 5) */
  maxResults?: number;
}

// ---------------------------------------------------------------------------
// MusicService
// ---------------------------------------------------------------------------

export class MusicService {
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir ?? ".music-cache";
  }

  /**
   * Search for free music matching a style description.
   *
   * Since we can't directly scrape FMA/Pixabay from Node without a browser,
   * this method returns a search URL that the agent can use with web_search.
   * In a future version, we could integrate a proper API.
   *
   * @returns Search query URL and instructions for the agent.
   */
  buildSearchQuery(options: MusicSearchOptions): string {
    const minDur = options.minDuration ?? 60;
    return (
      `free ${options.style} background music no copyright creative commons ` +
      `mp3 duration >= ${minDur}s site:pixabay.com OR site:freemusicarchive.org`
    );
  }

  /**
   * Parse search results from web_search output into MusicResult[].
   * This is a helper for the agent to structure raw search results.
   */
  parseSearchResults(rawResults: Array<{ title: string; url: string; snippet?: string }>): MusicResult[] {
    return rawResults.map((r) => ({
      title: r.title,
      artist: "",
      url: r.url,
      duration: 0,
      genre: "",
      license: "CC0",
    }));
  }

  /**
   * Download a music file to the specified directory.
   * @returns Local file path.
   */
  async downloadMusic(url: string, outputDir: string): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`Failed to download music: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    // Derive filename from URL or use default
    const urlPath = new URL(url).pathname;
    const ext = urlPath.endsWith(".mp3") ? ".mp3" : ".mp3";
    const filename = `bgm_${Date.now()}${ext}`;
    const filePath = join(outputDir, filename);
    await writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Get cached music file path if available.
   */
  getCachedPath(musicKey: string): string | null {
    // Simple key-based cache lookup — actual caching handled by caller
    return null;
  }
}

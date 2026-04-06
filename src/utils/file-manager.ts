import { mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getConfig } from "../config/default.js";

/**
 * Manages episode directory structure on disk.
 *
 * Each episode lives under `<episodesDir>/<episodeId>/` with sub-directories:
 * - `audio/`   — TTS-generated MP3 files
 * - `shots/`   — Kling-generated video clips
 * - output at  — `rough_cut.mp4`
 */
export class FileManager {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = resolve(baseDir ?? getConfig().paths.episodesDir);
  }

  /** Create the full directory tree for a new episode. */
  async createEpisodeDir(episodeId: string): Promise<string> {
    const epDir = join(this.baseDir, episodeId);
    await mkdir(join(epDir, "audio"), { recursive: true });
    await mkdir(join(epDir, "shots"), { recursive: true });
    return epDir;
  }

  /** Return the episode root directory. */
  getEpisodeDir(episodeId: string): string {
    return join(this.baseDir, episodeId);
  }

  /** Return the audio sub-directory path. */
  getAudioDir(episodeId: string): string {
    return join(this.baseDir, episodeId, "audio");
  }

  /** Return the shots sub-directory path. */
  getShotsDir(episodeId: string): string {
    return join(this.baseDir, episodeId, "shots");
  }

  /** Return the final output file path. */
  getOutputPath(episodeId: string): string {
    return join(this.baseDir, episodeId, "rough_cut.mp4");
  }

  /** Return path to a specific audio file. */
  getAudioPath(episodeId: string, shotId: string): string {
    return join(this.baseDir, episodeId, "audio", `${shotId}.mp3`);
  }

  /** Return path to a specific shot video file. */
  getShotVideoPath(episodeId: string, shotId: string): string {
    return join(this.baseDir, episodeId, "shots", `${shotId}.mp4`);
  }

  /** Return path to the state.json file. */
  getStatePath(episodeId: string): string {
    return join(this.baseDir, episodeId, "state.json");
  }

  /** List all asset files in an episode directory. */
  async listEpisodeAssets(episodeId: string): Promise<string[]> {
    const epDir = this.getEpisodeDir(episodeId);
    try {
      return await readdir(epDir, { recursive: true }) as string[];
    } catch {
      return [];
    }
  }

  /** List all episode IDs in the base directory. */
  async listEpisodes(): Promise<string[]> {
    try {
      const entries = await readdir(this.baseDir);
      return entries;
    } catch {
      return [];
    }
  }
}

import { mkdir, rm, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getConfig } from "../config.js";
/**
 * Manages episode directory structure on disk.
 *
 * Each episode lives under `<episodesDir>/<episodeId>/` with sub-directories:
 * - `audio/` — TTS-generated WAV files
 * - `shots/` — Kling-generated video clips
 * - output at `rough_cut.mp4`
 */
export class FileManager {
    baseDir;
    constructor(baseDir) {
        this.baseDir = resolve(baseDir ?? getConfig().paths.episodesDir);
    }
    /** Create the full directory tree for a new episode. */
    async createEpisodeDir(episodeId) {
        const epDir = join(this.baseDir, episodeId);
        await mkdir(join(epDir, "audio"), { recursive: true });
        await mkdir(join(epDir, "shots"), { recursive: true });
        return epDir;
    }
    /** Return the episode root directory. */
    getEpisodeDir(episodeId) {
        return join(this.baseDir, episodeId);
    }
    /** Return the audio sub-directory path. */
    getAudioDir(episodeId) {
        return join(this.baseDir, episodeId, "audio");
    }
    /** Return the shots sub-directory path. */
    getShotsDir(episodeId) {
        return join(this.baseDir, episodeId, "shots");
    }
    /** Return the final output file path. */
    getOutputPath(episodeId) {
        return join(this.baseDir, episodeId, "rough_cut.mp4");
    }
    /** Return path to a specific audio file (WAV format). */
    getAudioPath(episodeId, shotId) {
        return join(this.baseDir, episodeId, "audio", `${shotId}.wav`);
    }
    /** Return path to a specific shot video file. */
    getShotVideoPath(episodeId, shotId) {
        return join(this.baseDir, episodeId, "shots", `${shotId}.mp4`);
    }
    /** Return path to the state.json file. */
    getStatePath(episodeId) {
        return join(this.baseDir, episodeId, "state.json");
    }
    /** Recursively delete an episode directory. */
    async cleanupEpisode(episodeId) {
        const epDir = this.getEpisodeDir(episodeId);
        await rm(epDir, { recursive: true, force: true });
    }
    /** List all episode IDs in the base directory. */
    async listEpisodes() {
        try {
            return await readdir(this.baseDir);
        }
        catch {
            return [];
        }
    }
}
//# sourceMappingURL=file-manager.js.map
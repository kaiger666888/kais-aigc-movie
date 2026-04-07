/**
 * Manages episode directory structure on disk.
 *
 * Each episode lives under `<episodesDir>/<episodeId>/` with sub-directories:
 * - `audio/` — TTS-generated WAV files
 * - `shots/` — Kling-generated video clips
 * - output at `rough_cut.mp4`
 */
export declare class FileManager {
    private readonly baseDir;
    constructor(baseDir?: string);
    /** Create the full directory tree for a new episode. */
    createEpisodeDir(episodeId: string): Promise<string>;
    /** Return the episode root directory. */
    getEpisodeDir(episodeId: string): string;
    /** Return the audio sub-directory path. */
    getAudioDir(episodeId: string): string;
    /** Return the shots sub-directory path. */
    getShotsDir(episodeId: string): string;
    /** Return the final output file path. */
    getOutputPath(episodeId: string): string;
    /** Return path to a specific audio file (WAV format). */
    getAudioPath(episodeId: string, shotId: string): string;
    /** Return path to a specific shot video file. */
    getShotVideoPath(episodeId: string, shotId: string): string;
    /** Return path to the state.json file. */
    getStatePath(episodeId: string): string;
    /** Recursively delete an episode directory. */
    cleanupEpisode(episodeId: string): Promise<void>;
    /** List all episode IDs in the base directory. */
    listEpisodes(): Promise<string[]>;
}
//# sourceMappingURL=file-manager.d.ts.map
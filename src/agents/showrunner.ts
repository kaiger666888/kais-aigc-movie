import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getConfig } from "../config/default.js";
import type { StoryBible } from "../types/story-bible.js";
import type { ShotsConfig } from "../types/shots.js";
import type { QCReport } from "../types/qc-report.js";
import type { EpisodeState } from "../types/episode-state.js";
import { EpisodeStateManager } from "../utils/state-manager.js";
import { FileManager } from "../utils/file-manager.js";
import { WriterAgent } from "./writer.js";
import { VoiceDirectorAgent } from "./voice-director.js";
import { KlingRendererAgent } from "./kling-renderer.js";
import { EditorAgent } from "./editor.js";
import { QCTechAgent } from "./qc-tech.js";

/** Options for starting a new episode */
export interface EpisodeOptions {
  duration?: number;
  style?: string;
  characterCount?: number;
}

/** Progress callback for the full pipeline */
export type EpisodeProgressCallback = (
  step: string,
  progress: number,
  detail?: string,
) => void;

/** Final result of an episode run */
export interface EpisodeResult {
  state: EpisodeState;
  storyBible: StoryBible | null;
  shots: ShotsConfig | null;
  qcReport: QCReport | null;
  outputPath: string | null;
}

/**
 * Showrunner — the main orchestrator.
 *
 * Drives the full pipeline:
 *   writing → (voice + rendering in parallel) → editing → qc
 *
 * State is persisted after every step so the pipeline can be resumed
 * after a crash.
 */
export class Showrunner {
  private readonly stateManager: EpisodeStateManager;
  private readonly fileManager: FileManager;
  private readonly writer: WriterAgent;
  private readonly voiceDirector: VoiceDirectorAgent;
  private readonly klingRenderer: KlingRendererAgent;
  private readonly editor: EditorAgent;
  private readonly qcTech: QCTechAgent;

  constructor() {
    const fm = new FileManager();
    this.fileManager = fm;
    this.stateManager = new EpisodeStateManager(fm);
    this.writer = new WriterAgent();
    this.voiceDirector = new VoiceDirectorAgent();
    this.klingRenderer = new KlingRendererAgent();
    this.editor = new EditorAgent();
    this.qcTech = new QCTechAgent();
  }

  /**
   * Run a new episode from start to finish.
   *
   * @param topic - User-provided theme.
   * @param options - Optional generation parameters.
   * @param onProgress - Optional progress callback.
   * @returns Final episode result.
   */
  async runEpisode(
    topic: string,
    options?: EpisodeOptions,
    onProgress?: EpisodeProgressCallback,
  ): Promise<EpisodeResult> {
    const episodeId = randomUUID();
    const cfg = getConfig();

    // Cap shots at configured max
    const effectiveOptions = {
      duration: options?.duration ?? cfg.episode.maxDuration,
      style: options?.style ?? cfg.episode.defaultStyle,
      characterCount: options?.characterCount,
    };

    // Create episode state
    await this.stateManager.createEpisode(
      episodeId,
      topic,
      effectiveOptions,
    );
    const episodeDir = this.fileManager.getEpisodeDir(episodeId);

    let storyBible: StoryBible | null = null;
    let shots: ShotsConfig | null = null;
    let qcReport: QCReport | null = null;
    let outputPath: string | null = null;

    try {
      // ── Step 1: Writing ──────────────────────────────────────────
      await this.stateManager.updateState(episodeId, {
        status: "writing",
        currentStep: "writing",
        progress: 5,
      });
      onProgress?.("writing", 5);

      const writerOutput = await this.writer.generate(
        topic,
        effectiveOptions,
        episodeDir,
      );
      storyBible = writerOutput.storyBible;
      shots = writerOutput.shots;

      await this.stateManager.updateState(episodeId, {
        progress: 25,
      });
      onProgress?.("writing", 25, `Generated ${shots.shots.length} shots`);

      // ── Step 2: Voice + Rendering (parallel) ─────────────────────
      await this.stateManager.updateState(episodeId, {
        status: "voice_rendering",
        currentStep: "voice",
        progress: 30,
      });
      onProgress?.("voice_rendering", 30);

      const audioDir = this.fileManager.getAudioDir(episodeId);
      const shotsDir = this.fileManager.getShotsDir(episodeId);

      const [audioFiles, videoFiles] = await Promise.all([
        // Voice Director track
        this.voiceDirector.generate(
          shots,
          storyBible,
          audioDir,
          (completed, total, shotId) => {
            const pct = 30 + Math.round((completed / total) * 15);
            onProgress?.("voice", pct, `Audio ${shotId}`);
          },
        ),
        // Kling Renderer track
        this.klingRenderer.render(shots, shotsDir, (completed, total, shotId, status) => {
          const pct = 30 + Math.round((completed / total) * 20);
          onProgress?.("rendering", pct, `Render ${shotId} ${status}`);
        }),
      ]);

      await this.stateManager.updateState(episodeId, {
        currentStep: "rendering",
        progress: 65,
      });

      // ── Step 3: Editing ──────────────────────────────────────────
      await this.stateManager.updateState(episodeId, {
        status: "editing",
        currentStep: "editing",
        progress: 70,
      });
      onProgress?.("editing", 70);

      outputPath = this.fileManager.getOutputPath(episodeId);
      await this.editor.compose(
        shots,
        audioFiles,
        videoFiles,
        outputPath,
      );

      await this.stateManager.updateState(episodeId, {
        progress: 85,
      });
      onProgress?.("editing", 85, "Rough cut generated");

      // ── Step 4: QC ───────────────────────────────────────────────
      await this.stateManager.updateState(episodeId, {
        status: "qc",
        currentStep: "qc",
        progress: 90,
      });
      onProgress?.("qc", 90);

      qcReport = await this.qcTech.inspect(episodeDir, shots);

      // ── Done ─────────────────────────────────────────────────────
      await this.stateManager.updateState(episodeId, {
        status: qcReport.passed ? "done" : "failed",
        progress: 100,
      });
      onProgress?.("done", 100, qcReport.passed ? "Passed" : "QC issues found");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.stateManager.updateState(episodeId, {
        status: "failed",
        error: msg,
      });
      onProgress?.("failed", -1, msg);
    }

    const finalState = await this.stateManager.getState(episodeId);
    return { state: finalState, storyBible, shots, qcReport, outputPath };
  }

  /**
   * Resume a previously interrupted episode.
   *
   * Reads the current state and re-enters the pipeline at the correct step.
   *
   * @param episodeId - The episode UUID.
   * @param onProgress - Optional progress callback.
   */
  async resumeEpisode(
    episodeId: string,
    onProgress?: EpisodeProgressCallback,
  ): Promise<EpisodeResult> {
    const state = await this.stateManager.getState(episodeId);
    const episodeDir = this.fileManager.getEpisodeDir(episodeId);

    let storyBible: StoryBible | null = null;
    let shots: ShotsConfig | null = null;
    let qcReport: QCReport | null = null;
    let outputPath: string | null = null;

    // Reload persisted artifacts
    try {
      const sbRaw = await readFile(
        `${episodeDir}/story_bible.json`,
        "utf-8",
      );
      storyBible = JSON.parse(sbRaw) as StoryBible;
    } catch {
      // story_bible not available yet
    }

    try {
      const shRaw = await readFile(
        `${episodeDir}/shots.json`,
        "utf-8",
      );
      const parsed = JSON.parse(shRaw) as { shots: ShotsConfig };
      shots = parsed.shots ?? (JSON.parse(shRaw) as ShotsConfig);
    } catch {
      // shots not available yet
    }

    try {
      // Determine where to resume based on current step
      switch (state.currentStep) {
        case "init":
        case "writing": {
          // Re-run from writing
          const newResult = await this.runEpisode(
            state.topic,
            state.options,
            onProgress,
          );
          return newResult;
        }

        case "voice":
        case "rendering": {
          if (!shots || !storyBible) {
            throw new Error("Cannot resume: missing story data");
          }

          const audioDir = this.fileManager.getAudioDir(episodeId);
          const shotsDir = this.fileManager.getShotsDir(episodeId);

          const [audioFiles, videoFiles] = await Promise.all([
            this.voiceDirector.generate(shots, storyBible, audioDir),
            this.klingRenderer.render(shots, shotsDir),
          ]);

          outputPath = this.fileManager.getOutputPath(episodeId);
          await this.editor.compose(shots, audioFiles, videoFiles, outputPath);

          qcReport = await this.qcTech.inspect(episodeDir, shots);

          await this.stateManager.updateState(episodeId, {
            status: qcReport.passed ? "done" : "failed",
            currentStep: "qc",
            progress: 100,
          });
          break;
        }

        case "editing": {
          if (!shots) throw new Error("Cannot resume: missing shots");

          // Re-run editing and QC
          const audioFiles = new Map<string, string>();
          const videoFiles = new Map<string, string>();
          for (const shot of shots.shots) {
            audioFiles.set(
              shot.id,
              `${this.fileManager.getAudioDir(episodeId)}/${shot.id}.mp3`,
            );
            videoFiles.set(
              shot.id,
              `${this.fileManager.getShotsDir(episodeId)}/${shot.id}.mp4`,
            );
          }

          outputPath = this.fileManager.getOutputPath(episodeId);
          await this.editor.compose(shots, audioFiles, videoFiles, outputPath);
          qcReport = await this.qcTech.inspect(episodeDir, shots);

          await this.stateManager.updateState(episodeId, {
            status: qcReport.passed ? "done" : "failed",
            currentStep: "qc",
            progress: 100,
          });
          break;
        }

        case "qc": {
          if (!shots) throw new Error("Cannot resume: missing shots");
          qcReport = await this.qcTech.inspect(episodeDir, shots);

          await this.stateManager.updateState(episodeId, {
            status: qcReport.passed ? "done" : "failed",
            progress: 100,
          });
          break;
        }
      }

      const latestState = await this.stateManager.getState(episodeId);
      return {
        state: latestState,
        storyBible,
        shots,
        qcReport,
        outputPath,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.stateManager.updateState(episodeId, {
        status: "failed",
        error: msg,
      });

      const latestState = await this.stateManager.getState(episodeId);
      return {
        state: latestState,
        storyBible,
        shots,
        qcReport: null,
        outputPath: null,
      };
    }
  }

  /**
   * Query the current state of an episode.
   */
  async queryStatus(episodeId: string): Promise<EpisodeState> {
    return this.stateManager.getState(episodeId);
  }

  /**
   * List all episode IDs.
   */
  async listEpisodes(): Promise<string[]> {
    return this.stateManager.listEpisodes();
  }
}

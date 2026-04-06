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

/**
 * Function signature for spawning a GLM-5.1 sub-agent via OpenClaw.
 *
 * The showrunner does NOT depend on OpenClaw directly — the caller
 * (bot.ts or OpenClaw integration layer) injects this function.
 *
 * @param task - The prompt to send to the GLM-5.1 sub-agent.
 * @returns The raw text response from the sub-agent.
 */
export type SpawnGlmFn = (task: string) => Promise<string>;

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
 * Text generation (writer) is delegated to a GLM-5.1 sub-agent
 * via the injected `spawnGlm` callback. This decouples the
 * showrunner from OpenClaw internals and makes it testable.
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

  /**
   * @param spawnGlm - Function to spawn a GLM-5.1 sub-agent via OpenClaw.
   *                   The bot.ts integration layer provides this by calling
   *                   sessions_spawn with model "zai/glm-5.1".
   */
  constructor(private readonly spawnGlm: SpawnGlmFn) {
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

    const effectiveOptions = {
      duration: options?.duration ?? cfg.episode.maxDuration,
      style: options?.style ?? cfg.episode.defaultStyle,
      characterCount: options?.characterCount,
    };

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
      // ── Step 1: Writing (via GLM-5.1 sub-agent) ─────────────────
      await this.stateManager.updateState(episodeId, {
        status: "writing",
        currentStep: "writing",
        progress: 5,
      });
      onProgress?.("writing", 5);

      const prompt = this.writer.buildPrompt(topic, effectiveOptions);
      const rawResponse = await this.spawnGlm(prompt);
      const writerOutput = this.writer.parseOutput(rawResponse);
      await this.writer.saveArtifacts(writerOutput, episodeDir);

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
        this.voiceDirector.generate(
          shots,
          storyBible,
          audioDir,
          (completed, total, shotId) => {
            const pct = 30 + Math.round((completed / total) * 15);
            onProgress?.("voice", pct, `Audio ${shotId}`);
          },
        ),
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
      await this.editor.compose(shots, audioFiles, videoFiles, outputPath);

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

    try {
      const sbRaw = await readFile(`${episodeDir}/story_bible.json`, "utf-8").catch(() => null);
      if (sbRaw) storyBible = JSON.parse(sbRaw) as StoryBible;

      const shRaw = await readFile(`${episodeDir}/shots.json`, "utf-8").catch(() => null);
      if (shRaw) {
        const parsed = JSON.parse(shRaw) as { shots?: ShotsConfig } & ShotsConfig;
        shots = parsed.shots ?? parsed;
      }

      switch (state.currentStep) {
        case "init":
        case "writing": {
          return this.runEpisode(state.topic, state.options, onProgress);
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
          const audioFiles = new Map<string, string>();
          const videoFiles = new Map<string, string>();
          for (const shot of shots.shots) {
            audioFiles.set(shot.id, `${this.fileManager.getAudioDir(episodeId)}/${shot.id}.mp3`);
            videoFiles.set(shot.id, `${this.fileManager.getShotsDir(episodeId)}/${shot.id}.mp4`);
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
      return { state: latestState, storyBible, shots, qcReport, outputPath };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.stateManager.updateState(episodeId, { status: "failed", error: msg });
      const latestState = await this.stateManager.getState(episodeId);
      return { state: latestState, storyBible, shots, qcReport: null, outputPath: null };
    }
  }

  async queryStatus(episodeId: string): Promise<EpisodeState> {
    return this.stateManager.getState(episodeId);
  }

  async listEpisodes(): Promise<string[]> {
    return this.stateManager.listEpisodes();
  }
}

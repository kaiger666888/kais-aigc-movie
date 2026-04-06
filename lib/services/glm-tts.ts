import { getConfig } from "../config.js";

// ============================================================================
// Voice Presets
// ============================================================================

/** Built-in GLM-TTS voice preset identifiers */
export const VoicePresets = [
  "tongtong",
  "male-narrator",
  "male-qn-qingse",
  "male-qn-jingying",
  "male-qn-badao",
  "female-shuangkuaisisi",
  "female-shaonv",
  "female-yujie",
  "female-chengshu",
  "female-tianmei",
] as const;

/** Voice preset string type */
export type VoicePreset = (typeof VoicePresets)[number];

/** List all available built-in voice presets. */
export function listVoices(): readonly string[] {
  return VoicePresets;
}

/** Options for a single TTS synthesis call */
export interface SynthesizeOptions {
  /** Voice preset name (e.g. "tongtong", "male-qn-qingse", "female-shaonv"). Defaults to "tongtong". */
  voice?: string;
  /** Speech rate multiplier (0.5 – 2.0) */
  speed?: number;
}

/** A batch synthesis item */
export interface SynthesizeItem {
  id: string;
  text: string;
  options?: SynthesizeOptions;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_CONCURRENCY = 3;

/**
 * GLM-TTS API wrapper.
 *
 * Provides single and batch text-to-speech synthesis using the GLM-TTS endpoint.
 * Bearer token authentication.
 */
export class GlmTtsService {
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor() {
    const cfg = getConfig();
    this.endpoint = cfg.glm.ttsEndpoint;
    this.apiKey = cfg.glm.ttsApiKey;
  }

  /**
   * Synthesize a single text utterance to an audio buffer.
   *
   * @param text - Text to convert to speech.
   * @param options - Voice and speed options.
   * @returns MP3 audio buffer.
   */
  async synthesize(
    text: string,
    options?: SynthesizeOptions,
  ): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const body = JSON.stringify({
        model: "glm-tts",
        input: text,
        voice: options?.voice ?? "tongtong",
        speed: options?.speed ?? 1.0,
        response_format: "wav",
      });

      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "unknown");
        throw new Error(
          `GLM-TTS API error ${res.status}: ${detail}`,
        );
      }

      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Synthesize multiple items in parallel (max 3 concurrent).
   *
   * @param items - Array of {id, text, options?} objects.
   * @returns Map of id → audio Buffer.
   */
  async batchSynthesize(
    items: SynthesizeItem[],
  ): Promise<Map<string, Buffer>> {
    const results = new Map<string, Buffer>();
    const queue = [...items];

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const buf = await this.synthesize(item.text, item.options);
        results.set(item.id, buf);
      }
    };

    const workers: Promise<void>[] = [];
    for (
      let i = 0;
      i < Math.min(MAX_CONCURRENCY, items.length);
      i++
    ) {
      workers.push(worker());
    }
    await Promise.all(workers);
    return results;
  }
}

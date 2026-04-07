/** Built-in GLM-TTS voice preset identifiers */
export declare const VoicePresets: readonly ["tongtong", "male-narrator", "male-qn-qingse", "male-qn-jingying", "male-qn-badao", "female-shuangkuaisisi", "female-shaonv", "female-yujie", "female-chengshu", "female-tianmei"];
/** Voice preset string type */
export type VoicePreset = (typeof VoicePresets)[number];
/** List all available built-in voice presets. */
export declare function listVoices(): readonly string[];
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
/**
 * GLM-TTS API wrapper.
 *
 * Provides single and batch text-to-speech synthesis using the GLM-TTS endpoint.
 * Bearer token authentication.
 */
export declare class GlmTtsService {
    private readonly endpoint;
    private readonly apiKey;
    constructor();
    /**
     * Synthesize a single text utterance to an audio buffer.
     *
     * @param text - Text to convert to speech.
     * @param options - Voice and speed options.
     * @returns MP3 audio buffer.
     */
    synthesize(text: string, options?: SynthesizeOptions): Promise<Buffer>;
    /**
     * Synthesize multiple items in parallel (max 3 concurrent).
     *
     * @param items - Array of {id, text, options?} objects.
     * @returns Map of id → audio Buffer.
     */
    batchSynthesize(items: SynthesizeItem[]): Promise<Map<string, Buffer>>;
}
//# sourceMappingURL=glm-tts.d.ts.map
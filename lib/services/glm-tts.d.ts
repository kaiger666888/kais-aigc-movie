/** Official system voice identifiers from GLM-TTS API */
export declare const SystemVoices: {
    /** 彤彤 - 默认音色，温柔女声 */
    readonly tongtong: {
        readonly name: "彤彤";
        readonly gender: "female";
        readonly style: "温柔";
        readonly description: "默认音色，适合旁白和叙述";
    };
    /** 锤锤 - 活泼音色 */
    readonly chuichui: {
        readonly name: "锤锤";
        readonly gender: "male";
        readonly style: "活泼";
        readonly description: "活泼男声，适合轻松场景";
    };
    /** 小陈 - 沉稳音色 */
    readonly xiaochen: {
        readonly name: "小陈";
        readonly gender: "male";
        readonly style: "沉稳";
        readonly description: "沉稳男声，适合讲解和叙事";
    };
    /** 动动动物圈 jam 音色 */
    readonly jam: {
        readonly name: "Jam";
        readonly gender: "male";
        readonly style: "活泼";
        readonly description: "动动动物圈专属音色";
    };
    /** 动动动物圈 kazi 音色 */
    readonly kazi: {
        readonly name: "Kazi";
        readonly gender: "female";
        readonly style: "可爱";
        readonly description: "动动动物圈专属音色";
    };
    /** 动动动物圈 douji 音色 */
    readonly douji: {
        readonly name: "Douji";
        readonly gender: "male";
        readonly style: "可爱";
        readonly description: "动动动物圈专属音色";
    };
    /** 动动动物圈 luodo 音色 */
    readonly luodo: {
        readonly name: "Luodo";
        readonly gender: "male";
        readonly style: "可爱";
        readonly description: "动动动物圈专属音色";
    };
};
export type SystemVoiceId = keyof typeof SystemVoices;
/** List all available system voices */
export declare function listVoices(): readonly string[];
/** Get voice info */
export declare function getVoiceInfo(id: string): {
    name: string;
    gender: string;
    style: string;
    description: string;
};
/** Scene-based voice recommendations */
export declare const VoiceRecommendations: {
    /** 都市治愈/温暖旁白 */
    readonly narrator: "tongtong";
    /** 老年男性角色 */
    readonly elderlyMale: "xiaochen";
    /** 年轻女性角色 */
    readonly youngFemale: "tongtong";
    /** 活泼场景 */
    readonly lively: "chuichui";
};
export interface SynthesizeOptions {
    /**
     * Voice identifier. Supports:
     * - System voices: "tongtong", "chuichui", "xiaochen", "jam", "kazi", "douji", "luodo"
     * - Custom cloned voice IDs from GLM-TTS-Clone API
     * Defaults to "tongtong"
     */
    voice?: string;
    /** Speech rate multiplier, range [0.5, 2.0], default 1.0 */
    speed?: number;
    /** Volume multiplier, range (0, 10], default 1.0 */
    volume?: number;
    /** Output format: "wav" (default) or "pcm" */
    responseFormat?: "wav" | "pcm";
    /** Disable AI watermark. Only works if watermark removal is enabled in account settings */
    disableWatermark?: boolean;
}
export interface SynthesizeItem {
    id: string;
    text: string;
    options?: SynthesizeOptions;
}
/**
 * GLM-TTS API wrapper with voice cloning support.
 *
 * Features:
 * - System voices + custom cloned voices
 * - Speed/volume control
 * - Watermark control
 * - Batch synthesis with concurrency limit
 * - Auto text splitting for long content (>1024 chars)
 */
export declare class GlmTtsService {
    private readonly endpoint;
    private readonly apiKey;
    constructor();
    /**
     * Check if the service is properly configured.
     */
    isConfigured(): boolean;
    /**
     * Synthesize a single text utterance to an audio buffer.
     *
     * @param text - Text to convert (max 1024 chars per call).
     * @param options - Voice, speed, volume, format options.
     * @returns WAV audio buffer.
     */
    synthesize(text: string, options?: SynthesizeOptions): Promise<Buffer>;
    /**
     * Synthesize long text by splitting at sentence boundaries.
     * Concatenates all audio chunks into a single buffer.
     *
     * @param text - Text of any length (will be split at sentence/punctuation boundaries).
     * @param options - Synthesis options.
     * @returns Concatenated WAV audio buffer.
     */
    synthesizeLong(text: string, options?: SynthesizeOptions): Promise<Buffer>;
    /**
     * Synthesize multiple items in parallel (max 3 concurrent).
     *
     * @param items - Array of {id, text, options?} objects.
     * @returns Map of id → audio Buffer.
     */
    batchSynthesize(items: SynthesizeItem[]): Promise<Map<string, Buffer>>;
    /**
     * Split text at sentence/punctuation boundaries.
     */
    private splitText;
}
//# sourceMappingURL=glm-tts.d.ts.map
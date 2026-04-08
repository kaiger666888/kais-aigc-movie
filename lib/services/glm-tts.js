import { getConfig } from "../config.js";
// ============================================================================
// Voice Presets (Official GLM-TTS System Voices)
// ============================================================================
/** Official system voice identifiers from GLM-TTS API */
export const SystemVoices = {
    /** 彤彤 - 默认音色，温柔女声 */
    tongtong: { name: "彤彤", gender: "female", style: "温柔", description: "默认音色，适合旁白和叙述" },
    /** 锤锤 - 活泼音色 */
    chuichui: { name: "锤锤", gender: "male", style: "活泼", description: "活泼男声，适合轻松场景" },
    /** 小陈 - 沉稳音色 */
    xiaochen: { name: "小陈", gender: "male", style: "沉稳", description: "沉稳男声，适合讲解和叙事" },
    /** 动动动物圈 jam 音色 */
    jam: { name: "Jam", gender: "male", style: "活泼", description: "动动动物圈专属音色" },
    /** 动动动物圈 kazi 音色 */
    kazi: { name: "Kazi", gender: "female", style: "可爱", description: "动动动物圈专属音色" },
    /** 动动动物圈 douji 音色 */
    douji: { name: "Douji", gender: "male", style: "可爱", description: "动动动物圈专属音色" },
    /** 动动动物圈 luodo 音色 */
    luodo: { name: "Luodo", gender: "male", style: "可爱", description: "动动动物圈专属音色" },
};
/** List all available system voices */
export function listVoices() {
    return Object.keys(SystemVoices);
}
/** Get voice info */
export function getVoiceInfo(id) {
    return SystemVoices[id] ?? null;
}
// ============================================================================
// Recommended voice mappings for common scenarios
// ============================================================================
/** Scene-based voice recommendations */
export const VoiceRecommendations = {
    /** 都市治愈/温暖旁白 */
    narrator: "tongtong",
    /** 老年男性角色 */
    elderlyMale: "xiaochen",
    /** 年轻女性角色 */
    youngFemale: "tongtong",
    /** 活泼场景 */
    lively: "chuichui",
};
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_CONCURRENCY = 3;
// ============================================================================
// GLM-TTS Service
// ============================================================================
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
export class GlmTtsService {
    endpoint;
    apiKey;
    constructor() {
        const cfg = getConfig();
        this.endpoint = cfg.glm.ttsEndpoint;
        this.apiKey = cfg.glm.ttsApiKey;
    }
    /**
     * Check if the service is properly configured.
     */
    isConfigured() {
        return !!this.apiKey;
    }
    /**
     * Synthesize a single text utterance to an audio buffer.
     *
     * @param text - Text to convert (max 1024 chars per call).
     * @param options - Voice, speed, volume, format options.
     * @returns WAV audio buffer.
     */
    async synthesize(text, options) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
        try {
            // Auto-split long text
            if (text.length > 1024) {
                console.warn(`[GLM-TTS] Text exceeds 1024 chars (${text.length}), truncating`);
                text = text.slice(0, 1024);
            }
            const body = JSON.stringify({
                model: "glm-tts",
                input: text,
                voice: options?.voice ?? "tongtong",
                speed: options?.speed ?? 1.0,
                volume: options?.volume ?? 1.0,
                response_format: options?.responseFormat ?? "wav",
                watermark_enabled: options?.disableWatermark ? false : true,
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
                throw new Error(`GLM-TTS API error ${res.status}: ${detail}`);
            }
            const arrayBuf = await res.arrayBuffer();
            return Buffer.from(arrayBuf);
        }
        finally {
            clearTimeout(timer);
        }
    }
    /**
     * Synthesize long text by splitting at sentence boundaries.
     * Concatenates all audio chunks into a single buffer.
     *
     * @param text - Text of any length (will be split at sentence/punctuation boundaries).
     * @param options - Synthesis options.
     * @returns Concatenated WAV audio buffer.
     */
    async synthesizeLong(text, options) {
        if (text.length <= 1024) {
            return this.synthesize(text, options);
        }
        // Split at sentence boundaries, keeping each chunk ≤ 900 chars (safety margin)
        const chunks = this.splitText(text, 900);
        console.log(`[GLM-TTS] Long text split into ${chunks.length} chunks`);
        const buffers = [];
        for (const chunk of chunks) {
            const buf = await this.synthesize(chunk, options);
            buffers.push(buf);
        }
        // Simple concatenation (WAV headers will need fixing for proper merge)
        // For production, use ffmpeg to concat
        if (buffers.length === 1)
            return buffers[0];
        // Concatenate raw PCM data (skip WAV headers)
        const pcmChunks = [];
        for (const buf of buffers) {
            // WAV header is 44 bytes
            if (buf.length > 44) {
                pcmChunks.push(buf.subarray(44));
            }
        }
        const totalPcmLength = pcmChunks.reduce((sum, b) => sum + b.length, 0);
        const wavBuffer = Buffer.alloc(44 + totalPcmLength);
        // Write WAV header
        wavBuffer.write("RIFF", 0);
        wavBuffer.writeUInt32LE(36 + totalPcmLength, 4);
        wavBuffer.write("WAVE", 8);
        wavBuffer.write("fmt ", 12);
        wavBuffer.writeUInt32LE(16, 16); // chunk size
        wavBuffer.writeUInt16LE(1, 20); // PCM format
        wavBuffer.writeUInt16LE(1, 22); // mono
        wavBuffer.writeUInt32LE(24000, 24); // sample rate
        wavBuffer.writeUInt32LE(48000, 28); // byte rate
        wavBuffer.writeUInt16LE(2, 32); // block align
        wavBuffer.writeUInt16LE(16, 34); // bits per sample
        wavBuffer.write("data", 36);
        wavBuffer.writeUInt32LE(totalPcmLength, 40);
        // Write PCM data
        let offset = 44;
        for (const pcm of pcmChunks) {
            pcm.copy(wavBuffer, offset);
            offset += pcm.length;
        }
        return wavBuffer;
    }
    /**
     * Synthesize multiple items in parallel (max 3 concurrent).
     *
     * @param items - Array of {id, text, options?} objects.
     * @returns Map of id → audio Buffer.
     */
    async batchSynthesize(items) {
        const results = new Map();
        const queue = [...items];
        const worker = async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                if (!item)
                    break;
                const buf = await this.synthesize(item.text, item.options);
                results.set(item.id, buf);
            }
        };
        const workers = [];
        for (let i = 0; i < Math.min(MAX_CONCURRENCY, items.length); i++) {
            workers.push(worker());
        }
        await Promise.all(workers);
        return results;
    }
    // ---- Private helpers ----
    /**
     * Split text at sentence/punctuation boundaries.
     */
    splitText(text, maxLen) {
        const sentences = [];
        let current = "";
        // Split by common sentence-ending punctuation
        const parts = text.split(/([。！？\n.!?；;，,、])/);
        for (const part of parts) {
            if (current.length + part.length > maxLen && current.length > 0) {
                sentences.push(current.trim());
                current = part;
            }
            else {
                current += part;
            }
        }
        if (current.trim()) {
            sentences.push(current.trim());
        }
        return sentences;
    }
}
//# sourceMappingURL=glm-tts.js.map
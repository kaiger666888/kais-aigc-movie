import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
// ============================================================================
// Default Wan2.2 T2V Workflow (ComfyUI)
// ============================================================================
/** Resolution presets: [width, height] */
const RESOLUTION_MAP = {
    "480p": [480, 272],
    "720p": [832, 480],
    "1080p": [1280, 720],
};
/** Wan2.2 uses ~8 fps; for smooth playback we target ~4 fps for generation */
const FPS = 8;
/**
 * Build a default Wan2.2 T2V workflow JSON for ComfyUI.
 * Node IDs are stable so we can patch parameters programmatically.
 */
function buildDefaultWorkflow(opts) {
    return {
        "1": {
            class_type: "KSampler",
            inputs: {
                seed: Math.floor(Math.random() * 2_147_483_647),
                steps: 30,
                cfg: 7.5,
                sampler_name: "uni_pc_bh2",
                scheduler: "normal",
                denoise: 1.0,
                model: ["11", 0],
                positive: ["6", 0],
                negative: ["7", 0],
                latent_image: ["5", 0],
            },
        },
        "3": {
            class_type: "SaveVideoComfyUI",
            inputs: {
                filename_prefix: "Wan2",
                video_codec: "h264",
                video_pixel_format: "yuv420p",
                video_quality: 18,
                crf: 18,
                images: ["9", 0],
                fps: FPS,
            },
        },
        "4": {
            class_type: "UNETLoader",
            inputs: {
                unet_name: `${opts.model}.safetensors`,
                weight_dtype: "fp8_e4m3fn",
            },
        },
        "5": {
            class_type: "EmptyHunyuanLatentVideo",
            inputs: {
                width: opts.width,
                height: opts.height,
                length: opts.numFrames,
                batch_size: 1,
            },
        },
        "6": {
            class_type: "CLIPTextEncode",
            inputs: {
                text: opts.prompt,
                clip: ["10", 0],
            },
        },
        "7": {
            class_type: "CLIPTextEncode",
            inputs: {
                text: "",
                clip: ["10", 0],
            },
        },
        "9": {
            class_type: "VAEDecode",
            inputs: {
                samples: ["1", 0],
                vae: ["11", 0],
            },
        },
        "10": {
            class_type: "CLIPLoader",
            inputs: {
                clip_name: "umt5_xl.safetensors",
                type: "wan",
            },
        },
        "11": {
            class_type: "VAELoader",
            inputs: {
                vae_name: "wan_2.1_vae.safetensors",
            },
        },
    };
}
/**
 * ComfyUI backend for video generation using Wan2.2 T2V models.
 *
 * API flow:
 * 1. POST /prompt — submit workflow
 * 2. Poll GET /history/{prompt_id} — wait for completion
 * 3. GET /view?filename=...&type=output — download video
 */
export class ComfyUIService {
    baseUrl;
    workflowPath;
    defaultModel;
    constructor(options) {
        this.baseUrl = `http://${options.host}:${options.port}`;
        this.workflowPath = options.workflowPath;
        this.defaultModel = options.model ?? "wan2.2_t2v_5B";
    }
    async testConnection() {
        try {
            const res = await fetch(`${this.baseUrl}/system_stats`, {
                signal: AbortSignal.timeout(5000),
            });
            return res.ok;
        }
        catch {
            return false;
        }
    }
    async submitAndDownload(prompt, outputDir, filename, options) {
        const duration = options?.duration ?? 5;
        const resolution = options?.resolution ?? "720p";
        const model = options?.model ?? this.defaultModel;
        const [width, height] = RESOLUTION_MAP[resolution] ?? RESOLUTION_MAP["720p"];
        const numFrames = duration * FPS + 1; // Wan convention: frames = duration * fps + 1
        // Load or build workflow
        const workflow = await this.loadWorkflow({
            prompt,
            width,
            height,
            numFrames,
            model,
        });
        // Submit
        const promptId = await this.submitPrompt(workflow);
        // Poll until done
        const outputs = await this.pollHistory(promptId);
        // Download first video output
        const videoInfo = outputs[0];
        if (!videoInfo) {
            throw new Error(`ComfyUI: no video output found for prompt ${promptId}`);
        }
        await mkdir(outputDir, { recursive: true });
        const outPath = join(outputDir, `${filename}.mp4`);
        await this.downloadOutput(videoInfo.filename, videoInfo.subfolder, outPath);
        return outPath;
    }
    // ---- Internal ----
    async loadWorkflow(params) {
        // If a workflow file is provided, load and patch it
        if (this.workflowPath && existsSync(this.workflowPath)) {
            const raw = await readFile(this.workflowPath, "utf-8");
            const wf = JSON.parse(raw);
            return this.patchWorkflow(wf, params);
        }
        // Otherwise use built-in default
        return buildDefaultWorkflow(params);
    }
    /**
     * Patch a loaded workflow JSON with the given parameters.
     * Tries to find known node types and update their inputs.
     */
    patchWorkflow(wf, params) {
        for (const node of Object.values(wf)) {
            const ct = node.class_type;
            if (!ct)
                continue;
            const inputs = node.inputs;
            if (!inputs)
                continue;
            switch (ct) {
                case "CLIPTextEncode":
                    // First CLIPTextEncode = positive prompt
                    if (typeof inputs.text === "string" && inputs.text.length > 0 && !inputs._patched) {
                        inputs.text = params.prompt;
                        inputs._patched = true;
                    }
                    break;
                case "EmptyHunyuanLatentVideo":
                    if (typeof inputs.width === "number")
                        inputs.width = params.width;
                    if (typeof inputs.height === "number")
                        inputs.height = params.height;
                    if (typeof inputs.length === "number")
                        inputs.length = params.numFrames;
                    break;
                case "UNETLoader":
                    if (typeof inputs.unet_name === "string") {
                        inputs.unet_name = `${params.model}.safetensors`;
                    }
                    break;
                case "KSampler":
                    // Re-seed for variety
                    inputs.seed = Math.floor(Math.random() * 2_147_483_647);
                    break;
            }
        }
        return wf;
    }
    async submitPrompt(workflow) {
        const res = await fetch(`${this.baseUrl}/prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: workflow }),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => "unknown");
            throw new Error(`ComfyUI submit error ${res.status}: ${detail}`);
        }
        const json = (await res.json());
        if (!json.prompt_id) {
            throw new Error("ComfyUI: no prompt_id in response");
        }
        return json.prompt_id;
    }
    async pollHistory(promptId, timeoutMs = 600_000) {
        const deadline = Date.now() + timeoutMs;
        const pollInterval = 3000;
        while (Date.now() < deadline) {
            const res = await fetch(`${this.baseUrl}/history/${promptId}`);
            if (!res.ok) {
                throw new Error(`ComfyUI history error ${res.status}`);
            }
            const history = (await res.json());
            const entry = history[promptId];
            if (!entry) {
                await sleep(pollInterval);
                continue;
            }
            // Check for errors
            if (entry.status?.status_str === "error") {
                throw new Error(`ComfyUI: workflow execution failed for ${promptId}`);
            }
            // Check outputs
            if (entry.outputs) {
                const outputs = [];
                for (const nodeOutput of Object.values(entry.outputs)) {
                    const videos = nodeOutput.videos ?? [];
                    for (const v of videos) {
                        if (v.type === "output") {
                            outputs.push({ filename: v.filename, subfolder: v.subfolder ?? "" });
                        }
                    }
                }
                if (outputs.length > 0) {
                    return outputs;
                }
            }
            await sleep(pollInterval);
        }
        throw new Error(`ComfyUI: timed out waiting for ${promptId} (${timeoutMs}ms)`);
    }
    async downloadOutput(filename, subfolder, outPath) {
        const params = new URLSearchParams({
            filename,
            subfolder,
            type: "output",
        });
        const res = await fetch(`${this.baseUrl}/view?${params}`);
        if (!res.ok || !res.body) {
            throw new Error(`ComfyUI: failed to download ${filename} (${res.status})`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        await writeFile(outPath, buffer);
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=comfyui-service.js.map
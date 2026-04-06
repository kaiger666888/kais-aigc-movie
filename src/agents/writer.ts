import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfig } from "../config/default.js";
import {
  StoryBibleSchema,
  type StoryBible,
} from "../types/story-bible.js";
import {
  ShotsConfigSchema,
  type ShotsConfig,
} from "../types/shots.js";
import { z } from "zod";

/** Options for the writer generation */
export interface WriterOptions {
  /** Target total duration in seconds (default 60) */
  duration?: number;
  /** Visual style (default "comic") */
  style?: string;
  /** Number of characters (default 2) */
  characterCount?: number;
  /** GLM-5.1 model alias for OpenClaw sub-agent */
  model?: string;
}

/** Output of the writer agent */
export interface WriterOutput {
  storyBible: StoryBible;
  shots: ShotsConfig;
}

/** Structured output schema from the LLM */
const LlmOutputSchema = z.object({
  storyBible: StoryBibleSchema,
  shots: ShotsConfigSchema,
});

/**
 * Writer Agent — generates story_bible.json and shots.json from a topic.
 *
 * Uses OpenClaw sessions_spawn to call GLM-5.1 as a sub-agent,
 * producing a structured story with storyboard shots in the
 * "comic, low-action, narration-driven" style.
 *
 * This runs INSIDE OpenClaw, so the spawn is done by the showrunner
 * which has access to the OpenClaw runtime. The writer can also be
 * used standalone with a provided generateFn callback.
 */
export class WriterAgent {
  private readonly maxShots: number;

  constructor() {
    const cfg = getConfig();
    this.maxShots = cfg.episode.maxShots;
  }

  /**
   * Build the prompt for GLM-5.1 sub-agent.
   *
   * @param topic - User-provided theme or story idea.
   * @param options - Duration, style, character count overrides.
   * @returns The prompt string to send to the GLM-5.1 sub-agent.
   */
  buildPrompt(topic: string, options?: WriterOptions): string {
    const duration = options?.duration ?? 60;
    const style = options?.style ?? "comic";
    const charCount = options?.characterCount ?? 2;

    return `你是一个专业的漫剧编剧。根据用户给出的主题，生成一份完整的剧本档案（story_bible）和分镜表（shots）。

风格要求：
- 漫画风、低动作、旁白主导
- 每个镜头时长 5-8 秒
- 总镜头数 6-${this.maxShots} 个
- 总时长控制在 ${duration} 秒以内
- 视觉风格：${style}
- 角色数量：${charCount} 个

用户主题：${topic}

只输出严格 JSON，不要添加任何其他文字。结构如下：
{
  "storyBible": {
    "title": "标题",
    "theme": "主题",
    "genre": "类型",
    "characters": [
      {
        "id": "c1",
        "name": "名字",
        "description": "角色描述",
        "voiceConfig": { "voice": "male-narrator", "speed": 1.0 }
      }
    ],
    "scenes": [
      {
        "id": "s1",
        "location": "地点",
        "description": "场景描述",
        "mood": "氛围",
        "timeOfDay": "day"
      }
    ],
    "synopsis": "故事梗概（100字以内）",
    "duration": ${duration},
    "style": "${style}"
  },
  "shots": {
    "shots": [
      {
        "id": "shot_1",
        "sceneId": "s1",
        "duration": 6,
        "visualPrompt": "英文视觉描述，用于 AI 视频生成",
        "subtitle": "中文旁白/对话文本",
        "speaker": "narrator",
        "cameraAngle": "medium",
        "transition": "fade"
      }
    ]
  }
}`;
  }

  /**
   * Parse and validate the LLM output JSON string.
   *
   * @param content - Raw JSON string from GLM-5.1 sub-agent.
   * @returns Validated WriterOutput.
   */
  parseOutput(content: string): WriterOutput {
    // Strip markdown code fences if present
    const cleaned = content
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    const raw = JSON.parse(cleaned);
    return LlmOutputSchema.parse(raw);
  }

  /**
   * Save story_bible.json and shots.json to the episode directory.
   *
   * @param output - Validated WriterOutput.
   * @param outputDir - Episode directory path.
   */
  async saveArtifacts(output: WriterOutput, outputDir: string): Promise<void> {
    await writeFile(
      join(outputDir, "story_bible.json"),
      JSON.stringify(output.storyBible, null, 2),
      "utf-8",
    );
    await writeFile(
      join(outputDir, "shots.json"),
      JSON.stringify(output.shots, null, 2),
      "utf-8",
    );
  }
}

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
 * Calls GLM-5.1 to produce a structured story with storyboard shots
 * in the "comic, low-action, narration-driven" style.
 */
export class WriterAgent {
  private readonly chatEndpoint: string;
  private readonly apiKey: string;
  private readonly maxShots: number;

  constructor() {
    const cfg = getConfig();
    this.chatEndpoint = cfg.glm.chatEndpoint;
    this.apiKey = cfg.glm.apiKey;
    this.maxShots = cfg.episode.maxShots;
  }

  /**
   * Generate a story bible and shot list from a topic.
   *
   * @param topic - User-provided theme or story idea.
   * @param options - Duration, style, character count overrides.
   * @param outputDir - Episode directory to save JSON artifacts.
   * @returns Validated StoryBible and ShotsConfig.
   */
  async generate(
    topic: string,
    options?: WriterOptions,
    outputDir?: string,
  ): Promise<WriterOutput> {
    const duration = options?.duration ?? 60;
    const style = options?.style ?? "comic";
    const charCount = options?.characterCount ?? 2;

    const systemPrompt = `你是一个专业的漫剧编剧。你的任务是根据用户给出的主题，生成一份完整的剧本档案（story_bible）和分镜表（shots）。

风格要求：
- 漫画风、低动作、旁白主导
- 每个镜头时长 5-8 秒
- 总镜头数 6-${this.maxShots} 个
- 总时长控制在 ${duration} 秒以内
- 视觉风格：${style}

输出格式必须是严格的 JSON，结构如下：
{
  "storyBible": {
    "title": "标题",
    "theme": "主题",
    "genre": "类型",
    "characters": [{ "id": "c1", "name": "名字", "description": "描述", "voiceConfig": { "voice": "male-narrator", "speed": 1.0 } }],
    "scenes": [{ "id": "s1", "location": "地点", "description": "描述", "mood": "氛围", "timeOfDay": "day" }],
    "synopsis": "故事梗概",
    "duration": ${duration},
    "style": "${style}"
  },
  "shots": {
    "shots": [
      {
        "id": "shot_1",
        "sceneId": "s1",
        "duration": 6,
        "visualPrompt": "英文视觉描述，用于 AI 图像生成",
        "subtitle": "中文旁白/对话文本",
        "speaker": "narrator",
        "cameraAngle": "medium",
        "transition": "fade"
      }
    ]
  }
}

角色数量：${charCount} 个。
只输出 JSON，不要添加任何其他文字。`;

    const result = await this.callLlm(systemPrompt, topic);

    // Validate with Zod
    const parsed = LlmOutputSchema.parse(result);

    // Save artifacts if outputDir is provided
    if (outputDir) {
      await writeFile(
        join(outputDir, "story_bible.json"),
        JSON.stringify(parsed.storyBible, null, 2),
        "utf-8",
      );
      await writeFile(
        join(outputDir, "shots.json"),
        JSON.stringify(parsed.shots, null, 2),
        "utf-8",
      );
    }

    return parsed;
  }

  /**
   * Call the GLM-5.1 chat completion API.
   */
  private async callLlm(
    systemPrompt: string,
    userMessage: string,
  ): Promise<unknown> {
    const body = JSON.stringify({
      model: "glm-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch(this.chatEndpoint, {
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
        throw new Error(`GLM chat error ${res.status}: ${detail}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("GLM returned empty content");
      }

      return JSON.parse(content);
    } finally {
      clearTimeout(timer);
    }
  }
}

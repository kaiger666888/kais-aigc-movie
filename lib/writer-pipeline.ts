/**
 * Writer Pipeline — AI 编剧流水线编排模块
 *
 * 流程: Oracle路由 → Genre Writer → Technique Writers(并行) → Assembler → Evaluator → (循环修正)
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

// ─── Types ─────────────────────────────────────────────────

export interface WriterConfig {
  /** 写作模式: quick(单次), standard(1轮修正), premium(多轮修正) */
  mode: "quick" | "standard" | "premium";
  /** 强制指定题材, 跳过oracle */
  genre?: string;
  /** 强制指定技法 */
  techniques?: string[];
  /** 最大评估修正轮数 (default 3) */
  maxEvalRounds?: number;
  /** 总镜头数 */
  shotCount?: number;
  /** 总时长(秒) */
  duration?: number;
  /** 视觉风格 */
  style?: string;
  /** 画面比例 */
  ratio?: string;
}

export interface WriterResult {
  script: unknown;
  evaluation: EvaluationResult;
  iterations: number;
  oracleOutput?: OracleResult;
}

interface OracleResult {
  genre: string;
  techniques: string[];
  tone: string;
  targetAudience: string;
}

interface EvaluationResult {
  scores: Record<string, number>;
  total: number;
  feedback: string;
  pass: boolean;
}

interface GlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GlmResponse {
  choices?: Array<{
    message?: { content?: string; reasoning_content?: string };
    finish_reason?: string;
  }>;
}

// ─── Config ────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const GLM_API_KEY = process.env.ZAI_API_KEY || "0097ad556273473983815ca61b096ae5.nRjTsEDSuTs53aIQ";
const GLM_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const GLM_MODEL = "glm-5-turbo";

/** Temperature presets per pipeline stage */
const TEMPERATURES: Record<string, number> = {
  oracle: 0.3,
  writer: 0.8,
  technique: 0.5,
  assembler: 0.3,
  evaluator: 0.1,
};

/** Max token presets per pipeline stage */
const MAX_TOKENS: Record<string, number> = {
  oracle: 1000,     // Oracle 只需要路由结果，不需要长输出
  writer: 8000,     // Genre Writer 需要输出完整剧本 + reasoning
  technique: 4000,  // Technique Writer 需要 reasoning + modifications
  assembler: 8000,  // Assembler 需要输出完整 script.json + reasoning
  evaluator: 4000,  // Evaluator 需要 reasoning + scores
};

/** Rate limit base delay (ms) between API calls */
const RATE_LIMIT_DELAY = 3000;

// ─── GLM API Client ────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Low-level HTTP POST using https module (avoids Node 24 fetch memory issues) */
function httpPost(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: "POST",
      headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
      timeout: 300_000,  // 5 min timeout for large responses
    };

    const req = https.request(opts, (res) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      res.on("data", (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > 2_000_000) { // 2MB safety limit
          req.destroy(new Error("Response too large (>2MB)"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf-8") });
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("HTTP timeout (300s)")); });
    req.write(body);
    req.end();
  });
}

async function callGlm(
  prompt: string,
  stage: string,
  systemPrompt?: string,
): Promise<string> {
  const messages: GlmMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const body = JSON.stringify({
    model: GLM_MODEL,
    messages,
    temperature: TEMPERATURES[stage] ?? 0.5,
    max_tokens: MAX_TOKENS[stage] ?? 2000,
  });

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${GLM_API_KEY}`,
  };

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { status, body: respBody } = await httpPost(GLM_ENDPOINT, headers, body);

    if (status === 429 && attempt < maxRetries - 1) {
      const delay = 8000 * Math.pow(2, attempt);
      console.log(`[writer-pipeline]   Rate limited, retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(delay);
      continue;
    }

    if (status !== 200) {
      throw new Error(`GLM API error ${status}: ${respBody.slice(0, 300)}`);
    }

    const data = JSON.parse(respBody) as GlmResponse;
    const choice = data.choices?.[0];
    const content = choice?.message?.content || choice?.message?.reasoning_content;
    if (!content) {
      throw new Error("GLM API returned empty content (finish_reason: " + (choice?.finish_reason ?? "unknown") + ")");
    }
    if (!choice?.message?.content && choice?.message?.reasoning_content) {
      console.log(`[writer-pipeline]   Warning: content empty, using reasoning_content (finish_reason: ${choice?.finish_reason})`);
    }
    return content;
  }

  throw new Error("GLM API: max retries exceeded");
}

// ─── Prompt Loader ─────────────────────────────────────────

function loadPrompt(relativePath: string): string {
  return readFileSync(join(PROJECT_ROOT, "prompts", "writers", relativePath), "utf-8");
}

// ─── JSON Extractor ────────────────────────────────────────

function extractJson(text: string): string {
  // Try to find JSON block in markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find raw JSON object/array
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) return jsonMatch[1].trim();

  // Return as-is and let JSON.parse handle it
  return text.trim();
}

/** Strip trailing commas and JS-style comments from JSON-like text */
function cleanJson(raw: string): string {
  // Remove single-line comments (// ...)
  let cleaned = raw.replace(/\/\/.*$/gm, "");
  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  return cleaned;
}

function parseJsonResponse<T>(text: string): T {
  const raw = extractJson(text);
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Try cleaning the JSON (trailing commas, comments)
    const cleaned = cleanJson(raw);
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Try to fix truncated JSON by closing open brackets
      let fixed = cleaned;
      const opens = (fixed.match(/{/g) || []).length;
      const closes = (fixed.match(/}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/]/g) || []).length;
      // Remove trailing comma if present
      fixed = fixed.replace(/,\s*$/, "");
      // Close unclosed brackets
      while (closeBrackets < openBrackets) { fixed += "]"; }
      while (closes < opens) { fixed += "}"; }
      try {
        return JSON.parse(fixed) as T;
      } catch {
        throw new Error(`Failed to parse JSON response: ${raw.slice(0, 200)}...`);
      }
    }
  }
}

// ─── Pipeline Steps ────────────────────────────────────────

/** Step 1: Oracle — 分析主题, 路由到合适的genre和techniques */
async function runOracle(topic: string, config: WriterConfig): Promise<OracleResult> {
  if (config.genre && config.techniques) {
    return {
      genre: config.genre,
      techniques: config.techniques,
      tone: "用户指定",
      targetAudience: "通用",
    };
  }

  const oraclePrompt = loadPrompt("writer-oracle.md").replace("{TOPIC}", topic);
  const raw = await callGlm(oraclePrompt, "oracle");
  const result = parseJsonResponse<OracleResult>(raw);

  // Override if user specified genre
  if (config.genre) result.genre = config.genre;
  if (config.techniques) result.techniques = config.techniques;

  return result;
}

/** Step 2: Genre Writer — 生成故事大纲和镜头列表 */
async function runGenreWriter(
  topic: string,
  oracle: OracleResult,
  config: WriterConfig,
): Promise<unknown> {
  const genrePrompt = loadPrompt(`genre-writers/${oracle.genre}.md`);
  const prompt = genrePrompt
    .replace("{TOPIC}", topic)
    .replace("{TONE}", oracle.tone)
    .replace("{TARGET_AUDIENCE}", oracle.targetAudience)
    .replace("{CREATIVITY_LEVEL}", "3")
    .replace("{SHOT_COUNT}", String(config.shotCount ?? 8))
    .replace("{DURATION}", String(config.duration ?? 50))
    .replace("{STYLE}", config.style ?? "comic")
    .replace("{RATIO}", config.ratio ?? "9:16")
    + "\n\n只输出严格 JSON，不要添加任何其他文字。";

  const raw = await callGlm(prompt, "writer");
  return parseJsonResponse<unknown>(raw);
}

/** Step 3: Technique Writers — 顺序调用所有technique进行优化 */
async function runTechniqueWriters(
  genreOutput: unknown,
  oracle: OracleResult,
  techniques: string[],
): Promise<Record<string, unknown>> {
  const validTechniques = ["emotion", "visual", "dialogue", "pace"];
  const filtered = techniques.filter((t) => validTechniques.includes(t));

  const results: Record<string, unknown> = {};

  // Run sequentially to avoid rate limits and memory issues
  for (const technique of filtered) {
    const promptTemplate = loadPrompt(`technique-writers/${technique}.md`);
    const context = JSON.stringify({
      genre: oracle.genre,
      tone: oracle.tone,
      synopsis: (genreOutput as Record<string, Record<string, string>>)?.storyBible?.synopsis ?? "",
      shots: (genreOutput as Record<string, unknown>)?.shots ?? [],
      characters: (genreOutput as Record<string, Record<string, unknown>>)?.storyBible?.characters ?? [],
      scenes: (genreOutput as Record<string, Record<string, unknown>>)?.storyBible?.scenes ?? [],
    });

    const prompt = promptTemplate + "\n\n## 输入数据\n\n" + context + "\n\n只输出严格 JSON，不要添加任何其他文字。";
    await sleep(RATE_LIMIT_DELAY);  // Rate limit between technique calls
    console.log(`[writer-pipeline]   Running technique: ${technique}...`);
    const raw = await callGlm(prompt, "technique");
    results[technique] = parseJsonResponse<unknown>(raw);
  }

  return results;
}

/** Step 4: Assembler — 合并所有输出为完整script.json */
async function runAssembler(
  genreOutput: unknown,
  oracle: OracleResult,
  techniqueOutputs: Record<string, unknown>,
  config: WriterConfig,
): Promise<unknown> {
  const assemblerPrompt = loadPrompt("writer-assembler.md");
  const input = JSON.stringify({
    genreOutput,
    oracleOutput: oracle,
    techniqueOutputs,
  });

  const prompt = assemblerPrompt
    + "\n\n## 输入数据\n\n" + input
    + "\n\n只输出严格 JSON，不要添加任何其他文字。确保格式与 writer-prompt.md 完全一致。";

  const raw = await callGlm(prompt, "assembler");
  return parseJsonResponse<unknown>(raw);
}

/** Step 5: Evaluator — 评估script.json质量 */
async function runEvaluator(script: unknown, genre: string): Promise<EvaluationResult> {
  const evaluatorPrompt = loadPrompt("writer-evaluator.md");
  const input = JSON.stringify({ genre, script });

  const prompt = evaluatorPrompt
    + "\n\n## 输入数据\n\n" + input
    + "\n\n只输出严格 JSON，不要添加任何其他文字。";

  const raw = await callGlm(prompt, "evaluator");
  return parseJsonResponse<EvaluationResult>(raw);
}

// ─── Main Pipeline ─────────────────────────────────────────

/**
 * 生成完整的漫剧剧本
 *
 * @param topic 用户主题
 * @param config 写作配置
 * @returns 剧本、评估结果和迭代次数
 */
export async function generateScript(
  topic: string,
  config: WriterConfig,
): Promise<WriterResult> {
  const maxRounds = config.maxEvalRounds ?? (config.mode === "premium" ? 3 : config.mode === "standard" ? 1 : 0);
  const shotCount = config.shotCount ?? 8;
  const duration = config.duration ?? 50;

  const fullConfig: WriterConfig = {
    ...config,
    shotCount,
    duration,
    style: config.style ?? "comic",
    ratio: config.ratio ?? "9:16",
  };

  // Step 1: Oracle routing
  console.log("[writer-pipeline] Step 1: Oracle routing...");
  const oracle = await runOracle(topic, fullConfig);
  console.log(`[writer-pipeline]   genre=${oracle.genre}, techniques=[${oracle.techniques.join(",")}]`);

  let currentScript: unknown;
  let evaluation: EvaluationResult;
  let iterations = 0;

  for (let round = 0; round <= maxRounds; round++) {
    iterations++;

    // Step 2: Genre Writer
    await sleep(RATE_LIMIT_DELAY);
    console.log(`[writer-pipeline] Step 2: Genre Writer (${oracle.genre}) [round ${iterations}]...`);
    const genreOutput = await runGenreWriter(topic, oracle, fullConfig);

    // Step 3: Technique Writers (serial with delay to avoid 429)
    console.log(`[writer-pipeline] Step 3: Technique Writers [${oracle.techniques.join(", ")}]...`);
    const techniqueOutputs = await runTechniqueWriters(genreOutput, oracle, oracle.techniques);

    // Step 4: Assembler
    await sleep(RATE_LIMIT_DELAY);
    console.log("[writer-pipeline] Step 4: Assembler...");
    currentScript = await runAssembler(genreOutput, oracle, techniqueOutputs, fullConfig);

    // Step 5: Evaluator
    await sleep(RATE_LIMIT_DELAY);
    console.log("[writer-pipeline] Step 5: Evaluator...");
    evaluation = await runEvaluator(currentScript, oracle.genre);
    console.log(`[writer-pipeline]   Score: ${evaluation.total.toFixed(1)}/10, pass=${evaluation.pass}`);

    if (evaluation.pass || round >= maxRounds) {
      return {
        script: currentScript,
        evaluation,
        iterations,
        oracleOutput: oracle,
      };
    }

    // Not passed — incorporate feedback into next round
    console.log(`[writer-pipeline]   Not passed. Feedback: ${evaluation.feedback.slice(0, 200)}...`);
  }

  // Should not reach here, but TypeScript needs the return
  return {
    script: currentScript!,
    evaluation: evaluation!,
    iterations,
    oracleOutput: oracle,
  };
}

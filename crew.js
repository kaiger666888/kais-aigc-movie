module.exports = {
  name: "kais-aigc-movie",
  goal: "基于 OpenClaw + Telegram + GLM-5.1 + GLM-TTS + Kling 3.0 搭建 AI 漫剧自动生成系统，实现从用户输入主题到输出粗成片的全自动流水线",
  workdir: "/tmp/crew-kais-aigc-movie",
  project: {
    lang: "node",
    github: true,
    githubAccount: "kaiger666888",
    repo: "kais-aigc-movie",
    description: "AI Comic Drama Auto-Generation Pipeline — OpenClaw + Telegram + GLM-5.1 + GLM-TTS + Kling 3.0"
  },

  architectureDiagrams: {
    enabled: true,
    notionPageId: "33911082af8e8058b90ac50f7984193e",
    diagrams: ["system", "dag", "sequence", "state"]
  },

  steps: [
    // === Layer 0: 项目基础 ===
    {
      id: "project-init",
      skill: "claude-code-via-openclaw",
      params: {
        task: `初始化 kais-aigc-movie 项目：
1. 创建 Node.js 项目结构（ESM，TypeScript）
2. 初始化 git + GitHub repo: kaiger666888/kais-aigc-movie
3. 设置项目目录结构：
   - src/agents/ (showrunner, writer, voice-director, kling-renderer, editor, qc-tech)
   - src/services/ (glm-tts.ts, kling-api.ts)
   - src/types/ (story-bible.ts, shots.ts, qc-report.ts)
   - src/utils/ (ffmpeg.ts, file-manager.ts, state-manager.ts)
   - src/config/ (default.ts)
   - episodes/ (存放剧集资产)
4. 安装核心依赖：grammy (Telegram bot), fluent-ffmpeg, zod (schema validation)
5. 创建 README.md 描述项目架构和用法
6. 确保 TypeScript 编译通过`
      },
      output: "project-initialized",
      timeout: 300
    },

    // === Layer 1: 类型定义 & 配置 ===
    {
      id: "types-schema",
      skill: "claude-code-via-openclaw",
      input: "project-init",
      params: {
        task: `定义核心 TypeScript 类型（src/types/）：

1. story-bible.ts:
   - StoryBible: { title, theme, genre, characters: Character[], scenes: Scene[], duration }
   - Character: { id, name, description, voiceConfig }
   - Scene: { id, location, description, mood, timeOfDay }

2. shots.ts:
   - ShotsConfig: { shots: Shot[] }
   - Shot: { id, sceneId, duration, visualPrompt, subtitle, cameraAngle, transition }
   - ShotStatus: 'pending' | 'generating' | 'done' | 'failed'

3. qc-report.ts:
   - QCReport: { episodeId, shots: ShotQC[], overallScore, issues }
   - ShotQC: { shotId, duration, hasAudio, hasVideo, subtitleSync, score }

4. episode-state.ts:
   - EpisodeState: { id, topic, status, currentStep, createdAt, updatedAt, retryCount }
   - EpisodeStatus: 'created' | 'writing' | 'voice' | 'rendering' | 'editing' | 'qc' | 'done' | 'failed'

使用 Zod 进行运行时验证。所有类型都要有 fromJSON/toJSON 方法。`
      },
      output: "src/types/",
      timeout: 180
    },

    {
      id: "config-setup",
      skill: "claude-code-via-openclaw",
      input: "project-init",
      params: {
        task: `创建配置系统（src/config/）：

1. default.ts: 导出 AppConfig 类型
   - telegram: { botToken: env('BOT_TOKEN') }
   - glm: { ttsApiKey: env('GLM_TTS_API_KEY'), ttsEndpoint: '...' }
   - kling: { apiKey: env('KLING_API_KEY'), apiEndpoint: '...', maxConcurrent: 2, maxRetries: 3 }
   - episode: { maxShots: 8, maxDuration: 60, defaultStyle: 'comic' }
   - paths: { episodesDir: './episodes' }

2. 从环境变量读取敏感配置，提供 .env.example

3. 使用 zod 验证配置完整性，启动时检查必要环境变量`
      },
      output: "src/config/",
      timeout: 120
    },

    // === Layer 2: 外部服务封装 ===
    {
      id: "glm-tts-service",
      skill: "claude-code-via-openclaw",
      input: ["project-init", "types-schema", "config-setup"],
      params: {
        task: `实现 GLM-TTS 服务封装（src/services/glm-tts.ts）：

功能：
1. synthesize(text: string, options?: { voice?: string, speed?: number }): Promise<Buffer>
2. batchSynthesize(items: {id: string, text: string}[]): Promise<Map<string, Buffer>>
3. 支持 voice 配置（角色声音选择）
4. 错误处理和重试逻辑
5. 并发限制（最多 3 个并发请求）

技术约束：
- 使用 GLM-TTS API（endpoint 从配置读取）
- API Key 通过 header 传递
- 返回音频 Buffer（mp3 格式）
- 超时 30 秒
- 写入单元测试`
      },
      output: "src/services/glm-tts.ts",
      timeout: 180
    },

    {
      id: "kling-api-service",
      skill: "claude-code-via-openclaw",
      input: ["project-init", "types-schema", "config-setup"],
      params: {
        task: `实现 Kling 3.0 API 服务封装（src/services/kling-api.ts）：

功能：
1. submitTask(prompt: string, options?: { duration?: number, aspectRatio?: string }): Promise<string> 返回 task_id
2. pollTask(taskId: string): Promise<TaskResult> 异步轮询结果
3. downloadResult(taskId: string, outputDir: string): Promise<string> 下载视频到本地
4. 并发控制：最多 maxConcurrent 个同时生成任务
5. 自动重试：失败后指数退避重试

技术约束：
- Kling 3.0 异步任务模式（submit → callback/poll → download）
- task_id 追踪
- 支持按镜头独立生成
- 超时 5 分钟，重试 3 次
- 保存中间状态到文件
- 写入单元测试（mock API）`
      },
      output: "src/services/kling-api.ts",
      timeout: 240
    },

    // === Layer 3: Sub-Agent 实现 ===
    {
      id: "writer-agent",
      skill: "claude-code-via-openclaw",
      input: ["types-schema", "config-setup"],
      params: {
        task: `实现 Writer Sub-Agent（src/agents/writer.ts）：

职责：根据主题生成 story_bible.json 和 shots.json

输入：
- topic: string（用户输入的主题）
- options?: { duration?: number, style?: string, characterCount?: number }

输出：
- story_bible.json（StoryBible 类型）
- shots.json（ShotsConfig 类型，6-8 个镜头）

实现要求：
1. 使用 GLM-5.1 API 生成结构化内容（通过 OpenClaw sessions_spawn 调用）
2. 生成的内容必须通过 Zod schema 验证
3. story_bible 包含：标题、主题、角色（1-2个）、场景（1-2个）、剧情梗概
4. shots 包含每个镜头的：视觉提示词、字幕文本、镜头角度、转场方式、时长
5. 风格固定为"漫画风、低动作、旁白主导"
6. 总时长控制在 45-60 秒
7. 生成失败自动重试 1 次
8. 写入测试用例`
      },
      output: "src/agents/writer.ts",
      timeout: 240
    },

    {
      id: "voice-agent",
      skill: "claude-code-via-openclaw",
      input: ["types-schema", "glm-tts-service", "writer-agent"],
      params: {
        task: `实现 Voice-Director Sub-Agent（src/agents/voice-director.ts）：

职责：根据 shots.json 中的字幕文本，调用 GLM-TTS 生成音频文件

输入：
- shots.json（ShotsConfig）
- story_bible.json（角色声音配置）
- outputDir: string

输出：
- audio/ 目录下的 mp3 文件，按 shot_id 命名

实现要求：
1. 遍历 shots，提取字幕文本
2. 按角色配置不同的 voice 参数
3. 调用 glmTtsService.batchSynthesize()
4. 保存到 episode 目录的 audio/ 子目录
5. 返回音频文件路径映射 { shotId: audioPath }
6. 超时或失败时记录日志，支持单镜头重试
7. 写入测试用例`
      },
      output: "src/agents/voice-director.ts",
      timeout: 180
    },

    {
      id: "kling-agent",
      skill: "claude-code-via-openclaw",
      input: ["types-schema", "kling-api-service", "writer-agent"],
      params: {
        task: `实现 Kling-Renderer Sub-Agent（src/agents/kling-renderer.ts）：

职责：根据 shots.json 的视觉提示词，调用 Kling 3.0 API 逐镜头生成视频

输入：
- shots.json（ShotsConfig）
- outputDir: string

输出：
- shots/ 目录下的 mp4 文件，按 shot_id 命名

实现要求：
1. 遍历 shots，提取 visualPrompt
2. 并发控制（最多 2 个同时生成）
3. 异步任务模式：submit → poll → download
4. 每个镜头独立生成，失败只重试当前镜头（不重跑整集）
5. 超时 5 分钟/镜头
6. 保存中间状态（shot_id → task_id 映射）
7. 进度回调（当前/总数）
8. 写入测试用例（mock Kling API）`
      },
      output: "src/agents/kling-renderer.ts",
      timeout: 240
    },

    // === Layer 4: 后期制作 ===
    {
      id: "editor-agent",
      skill: "claude-code-via-openclaw",
      input: ["types-schema", "voice-agent", "kling-agent"],
      params: {
        task: `实现 Editor Sub-Agent（src/agents/editor.ts）：

职责：拼接音视频、添加字幕和转场，输出粗成片

输入：
- shots.json（ShotsConfig）
- audio/ 目录（音频文件）
- shots/ 目录（视频文件）
- outputPath: string

输出：
- rough_cut.mp4

实现要求：
1. 使用 fluent-ffmpeg 拼接视频
2. 每个镜头：叠加对应音频 → 添加字幕（ass/srt 格式） → 添加转场效果
3. 转场效果：简单淡入淡出（0.3s）
4. 字幕：从 shots.json 的 subtitle 字段生成
5. 总时长验证（45-60秒）
6. 输出 1080p mp4（H.264）
7. 失败时输出详细 ffmpeg 日志
8. 写入测试用例（使用测试视频片段）`
      },
      output: "src/agents/editor.ts",
      timeout: 240
    },

    {
      id: "qc-agent",
      skill: "claude-code-via-openclaw",
      input: ["types-schema", "editor-agent"],
      params: {
        task: `实现 QC-Tech Sub-Agent（src/agents/qc-tech.ts）：

职责：执行技术质检并输出报告

输入：
- rough_cut.mp4
- shots.json
- audio/ 目录
- shots/ 目录

输出：
- qc_report.json（QCReport 类型）

质检项：
1. 文件完整性：所有镜头视频存在且可读
2. 音频完整性：所有镜头音频存在且时长 > 0
3. 总时长：45-60 秒范围
4. 镜头数：6-8 个
5. 视频编码：H.264
6. 音频编码：AAC
7. 分辨率：≥720p
8. 每项评分 0-10，汇总为 overallScore
9. issues 数组记录所有问题

实现要求：
- 使用 ffprobe 获取音视频元数据
- 输出结构化 JSON 报告
- 写入测试用例`
      },
      output: "src/agents/qc-tech.ts",
      timeout: 180
    },

    // === Layer 5: 状态管理 ===
    {
      id: "state-manager",
      skill: "claude-code-via-openclaw",
      input: ["types-schema"],
      params: {
        task: `实现状态管理器（src/utils/state-manager.ts）：

职责：管理剧集任务状态，支持断点续传

功能：
1. createEpisode(topic, options): 创建新剧集目录和状态文件
2. updateEpisodeState(episodeId, step, status): 更新状态
3. getEpisodeState(episodeId): 获取当前状态
4. listEpisodes(): 列出所有剧集
5. getRetryableShots(episodeId): 获取可重试的镜头

实现要求：
- 状态持久化到 episodes/{id}/state.json
- 每次状态变更写磁盘
- 支持中断恢复（从 state.json 读取上次进度）
- 自动清理过期状态
- 写入测试用例`
      },
      output: "src/utils/state-manager.ts",
      timeout: 120
    },

    // === Layer 6: Showrunner 主控 ===
    {
      id: "showrunner",
      skill: "claude-code-via-openclaw",
      input: ["writer-agent", "voice-agent", "kling-agent", "editor-agent", "qc-agent", "state-manager"],
      params: {
        task: `实现 Showrunner 主控 Agent（src/agents/showrunner.ts）：

职责：统一调度所有 Sub-Agent，管理完整流水线

流程：
1. 接收用户主题 → 创建剧集目录 → 保存状态
2. 调用 writer → 生成 story_bible.json + shots.json
3. 并行调用 voice-director + kling-renderer（两者独立）
4. 等待音视频全部完成 → 调用 editor → 生成 rough_cut.mp4
5. 调用 qc-tech → 生成 qc_report.json
6. 汇总结果，返回最终状态

关键设计：
- 使用 sessions_spawn 调用 sub-agents
- 状态机驱动：created → writing → voice+rendering → editing → qc → done
- 失败处理：单镜头失败自动重试，整体失败保存状态等待恢复
- 进度回调：每步完成后更新状态
- 超时保护：整集最多 30 分钟
- 配额友好：控制 Kling 并发数和镜头数

实现要求：
- 导出 async function runEpisode(topic, options): Promise<EpisodeResult>
- 导出 async function resumeEpisode(episodeId): Promise<EpisodeResult>
- 导出 async function queryStatus(episodeId): Promise<EpisodeState>
- 完整的错误处理和日志
- 写入集成测试（mock 所有 sub-agents）`
      },
      output: "src/agents/showrunner.ts",
      timeout: 300
    },

    // === Layer 7: Telegram Bot 入口 ===
    {
      id: "telegram-bot",
      skill: "claude-code-via-openclaw",
      input: ["showrunner", "config-setup"],
      params: {
        task: `实现 Telegram Bot 入口（src/bot.ts）：

职责：提供 Telegram 单入口，接收用户指令

功能：
1. /start - 欢迎消息，说明用法
2. /new <主题> - 创建新剧集任务
   - 例：/new 一个程序员的一天
   - 支持可选参数：/new --duration 60 --style comic 一个程序员的一天
3. /status <episodeId> - 查询任务状态
   - 显示当前步骤、进度百分比、已完成镜头数
4. /resume <episodeId> - 恢复中断的任务
5. /list - 列出所有剧集

实现要求：
- 使用 grammy 框架
- 长任务异步执行，不阻塞 bot 响应
- 发送进度更新消息（每步完成后通知）
- 最终结果：发送 rough_cut.mp4 + qc_report 摘要
- 错误友好提示
- 导出 main() 函数作为入口
- 写入测试用例`
      },
      output: "src/bot.ts",
      timeout: 240
    },

    // === Layer 8: 集成 & 验证 ===
    {
      id: "integration",
      skill: "claude-code-via-openclaw",
      input: ["telegram-bot", "showrunner"],
      params: {
        task: `最终集成和验证：

1. 创建 src/index.ts 作为统一入口
2. 确保 TypeScript 编译无错误（tsc --noEmit）
3. 确保 ESLint 检查通过
4. 更新 README.md：
   - 项目架构说明
   - 安装步骤
   - 环境变量配置
   - 使用方法
   - Sub-Agent 架构图（Mermaid）
   - 开发指南
5. 创建 docker-compose.yml（可选，包含 ffmpeg）
6. 确保 git push 到 GitHub: kaiger666888/kais-aigc-movie
7. 验证所有测试通过（npm test）`
      },
      output: "final-package",
      timeout: 300,
      await: "human"
    }
  ]
};

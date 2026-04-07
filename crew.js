module.exports = {
  name: "kais-aigc-movie-v2",
  goal: "将 kais-aigc-movie skill 升级为「AI 漫剧制作工坊」：用户输入主题 → Writer 生成剧本分镜（含首帧/尾帧/视频提示词）→ 即梦文生图生成每个镜头的首帧和尾帧 → GLM-TTS 配音 → 生成故事预览 HTML（供审核）→ 人工审核通过后一键触发 Seedance 视频生成（首帧+尾帧驱动）。视频后端保持可插拔（ComfyUI/Kling 保留），即梦作为图片素材层新增。",
  workdir: "/tmp/crew-kais-aigc-movie-v2",
  project: {
    lang: "node",
    github: true,
    githubAccount: "kaiger666888",
    repo: "kais-aigc-movie",
    description: "AI Comic Story Pipeline — 即梦文生图 + GLM-TTS + OpenClaw"
  },

  architectureDiagrams: {
    enabled: true,
    notionPageId: "33911082af8e8058b90ac50f7984193e",
    diagrams: ["system", "dag", "sequence"]
  },

  steps: [
    // === Phase 1: 架构重构 ===

    {
      id: "refactor-arch",
      skill: "claude-code-via-openclaw",
      params: {
        task: `重构 kais-aigc-movie 项目架构，从"视频生成管线"转向"漫剧制作工坊"。

项目位置：~/.openclaw/workspace/skills/kais-aigc-movie/

## 核心理念

这个 skill 不是"生成漫画"工具，而是**AI 漫剧全流程制作工坊**：
- 当前阶段：用即梦文生图生成每个镜头的画面素材
- 同时准备好视频生成所需的提示词和素材引用
- 生成预览 HTML 供人工审核
- 审核通过后一键触发 Seedance 视频生成
- 每个镜头的图片就是视频素材，提示词就是视频 prompt

## 核心变更

1. **保留视频后端，改为可插拔架构**：
   - 保留 lib/services/comfyui-service.ts、kling-api.ts、video-generator.ts
   - 保留 lib/config.ts 中所有视频后端配置
   - 新增即梦作为**图片素材后端**，与视频后端独立
   - VideoGenerator 接口不变，未来视频生成仍可选 ComfyUI/Kling
   - 架构：图片素材（即梦）+ 视频生成（ComfyUI/Kling/Seedance）= 两个独立可插拔层

2. **新增即梦图片服务**（lib/services/jimeng-service.ts）：
   - 依赖即梦 free API（http://localhost:8000）
   - 功能：
     - textToImage(prompt, options?): Promise<ImageResult[]> — 文生图，返回图片URL数组
     - imageToImage(prompt, refImages, options?): Promise<ImageResult[]> — 图生图
     - downloadImage(url, outputDir, filename): Promise<string> — 下载图片到本地
     - testConnection(): Promise<boolean> — 健康检查
   - 配置：JIMENG_API_URL, JIMENG_SESSION_ID, JIMENG_MODEL, JIMENG_RATIO
   - 错误处理：超时120s，重试2次
   - **防限流策略**：
     - 默认并发上限 1（同一时间只发 1 个请求）
     - 请求间隔：基础 8s + 随机 0-12s（避免固定频率被识别）
     - 每次请求前 sleep 随机时间
     - 429 响应时自动退避：等待 60s + 随机 0-30s 后重试
     - 单批次（8个镜头）预计耗时 2-3 分钟

3. **新增 Seedance 视频服务**（lib/services/seedance-service.ts）：
   - 预留接口，当前只做素材准备，不做实际视频生成
   - 功能：
     - prepareVideoTasks(shots, imagesDir): VideoTask[] — 根据镜头信息准备视频生成任务
     - prepareAmbienceTrack(shots): AmbienceTrack — 规划统一环境音轨（参考 audio-continuity-guide.md 方案 A）
     - submitVideoTask(task): Promise<string> — 提交 Seedance 异步任务（实际调用时启用）
     - pollVideoTask(taskId): Promise<VideoResult> — 轮询视频任务结果
   - VideoTask 包含：prompt（视频描述）、firstFramePath、lastFramePath、ambienceSegmentPath（环境音片段）、ratio、duration
   - **关键设计**：
     - 每个镜头的首帧+尾帧+环境音片段同时传入 Seedance（@1 @2 @3）
     - 同场景的镜头共享同一条环境音轨的不同片段 → Seedance 生成的音频基底一致
     - 接缝处做音频 crossfade（0.5-1s）+ 全局 BGM 铺底遮盖

4. **更新 pipeline.mjs 为三阶段**：

   **Phase A — 素材生成**（自动）：
   - Step 1: Writer → story_bible.json + shots.json
   - Step 2: 即梦文生图 → images/{id}_first.png + images/{id}_last.png（每个镜头首帧+尾帧，共 2×N 张）
   - Step 3: GLM-TTS → 按 sceneGroupId 合并同场景字幕，一次性合成，保证配音连贯 → 按 shot 切分保存 audio/{id}.wav
   - Step 4: 生成预览 story.html + video_tasks.json（视频任务清单）

   **Phase B — 人工审核**（门控）：
   - 展示 story.html 预览
   - 展示 video_tasks.json 清单
   - 人工确认/修改/调整顺序

   **Phase C — 视频生成**（审核通过后触发）：
   - 读取 video_tasks.json
   - 逐镜头调用 Seedance 生成视频
   - FFmpeg 拼接 + 配音 + 字幕 → rough_cut.mp4
   - QC 质检 → 交付

   **当前实现重点：Phase A + Phase B**，Phase C 预留接口。

5. **更新 types/shots.ts**：
   - Shot 新增字段：
     - imagePrompt?: string — 即梦文生图用的中文提示词
     - lastFramePrompt?: string — 尾帧提示词（描述镜头结束时的画面状态）
     - videoPrompt?: string — Seedance 视频生成用的提示词（描述动态变化）
     - characterProfile?: string — 角色固定外观描述（发色、服装、体型），保证跨镜头一致
     - emotion?: string — 情感标注（warm/tense/sad/excited/neutral）
     - pace?: string — 语速（slow/normal/fast）
     - sceneGroupId?: string — 同场景分组 ID
     - musicStyle?: string — BGM 风格描述（情绪/节奏/乐器）
     - subtitle?: string — 字幕文本
     - speaker?: string — 旁白或角色 ID
     - imageUrl?: string — 首帧图片本地路径
     - lastFrameUrl?: string — 尾帧图片本地路径
     - imageAssetUrl?: string — 首帧图片原始 URL
     - lastFrameAssetUrl?: string — 尾帧图片原始 URL
     - characterRefPath?: string — 角色参考图路径（图生图时传入保持一致性）
     - styleRefPath?: string — 风格参考图路径（图生图时传入保持一致性）
     - videoTaskId?: string — Seedance 任务 ID
     - videoUrl?: string — 生成的视频本地路径
     - retryCount?: number — 重试次数
   - 新增 EpisodeConfig 类型：
     - style: string — 视觉风格（漫画/写实/水彩等）
     - ratio: string — 默认 "9:16"（竖屏）
     - bgmStyle?: string — BGM 风格描述
   - 新增 CostReport 类型：
     - jimengCreditsUsed: number
     - seedanceCreditsUsed: number
     - totalCreditsUsed: number
     - estimatedCreditsNeeded: number
   - 新增 Template 类型：
     - id, name, genre, characterProfileTemplate, scenePromptTemplate, stylePromptTemplate, shotCount, duration

6. **更新 writer-prompt.md**（同时参考 prompts/seedance-guide.md 中的 Seedance 使用经验）：
   - 每个镜头输出 4 种提示词：
     - visualPrompt（英文，保留，参考用）
     - imagePrompt（中文，给即梦文生图，描述静态画面 — 这个就是首帧）
     - lastFramePrompt（中文，给即梦文生图，描述镜头结束时的画面状态 — 尾帧）
     - videoPrompt（中文，给 Seedance，描述从首帧到尾帧的动态变化，如 "@1 @2 画面中的人物缓缓转头，从左侧走到右侧"）
   - imagePrompt 描述镜头开始时的画面（首帧）
   - lastFramePrompt 描述镜头结束时的画面（尾帧），与首帧有连贯性但有明显变化（人物位置/表情/光线等）
   - videoPrompt 同时用 @1 引用首帧、@2 引用尾帧
   
   **Seedance 2.0 首尾帧模式 Prompt 经验（必须遵守）**：
   - videoPrompt 只描述动态变化，不重复描述画面内容（画面已在首尾帧中）
   - 必须包含"保持构图和色彩一致"
   - 只用一个主镜头指令（如"镜头缓慢推进"），不要多个冲突
   - 速度用 slow/smooth/gentle，避免 fast
   - 长度 60-100 词
   - 结尾加 avoid jitter and bent limbs
   - 光线描述是杠杆最高的元素（如"柔光从侧面照亮"）
   - 示例："@1 @2 画面中的人物缓缓转头，微风吹过头发，从左侧走到右侧，保持构图和色彩一致，镜头缓慢推进，电影级质感，avoid jitter and bent limbs"
   
   - imagePrompt 和 lastFramePrompt 都要适合即梦文生图（构图、色彩、风格、细节）
   - 首帧和尾帧要有视觉连贯性：同一场景、同一角色、同一视角，但有状态变化
   - 镜头间要有叙事连贯性

   **音频连贯性设计（参考 prompts/audio-continuity-guide.md）**：
   - 每个镜头新增 emotion 字段（warm/tense/sad/excited/neutral），用于 TTS 语速微调
   - 每个镜头新增 pace 字段（slow/normal/fast），用于 TTS 速度控制
   - 每个镜头新增 sceneGroupId 字段，同场景的镜头归为一组
   - sceneGroupId 的用途：同组镜头的 subtitle 合并为一段文本，一次性 TTS 合成，保证语速和情感连贯
   - Writer 要确保同 sceneGroupId 内的镜头叙事连贯（同场景、同角色、同情绪）

7. **新增音频混音指南**（prompts/audio-continuity-guide.md）：
   - 多段视频音频连贯性：保留 Seedance 音频，利用音频参考输入统一基底
   - 同场景镜头共享同一条环境音轨的不同片段 → Seedance 生成的音频基底一致
   - 接缝处音频 crossfade（0.5-1s）+ 全局 BGM 铺底遮盖
   - 配音连贯：按 sceneGroupId 合并 TTS，保证语速情感连贯

8. **新增评估体系**（prompts/evaluation-guide.md）：
   - 5 阶段评估：Writer → 图片 → 视频 → 混音 → 综合
   - 自动检查：JSON 合规、CLIP 对齐度、首尾帧差异度、光流流畅度、音量一致性
   - AI 评分（GLM-5.1）：各阶段 0-10 分多维度评分
   - **评估驱动修正**：低分镜头单独重新生成，不重跑整集

9. **角色一致性保障**（关键！）：
   - Writer 输出角色固定描述（characterProfile）：外观、发色、服装、体型，每次文生图 prompt 都携带
   - 第一张角色图作为参考图，后续镜头用图生图模式（传入角色参考图 + 场景描述）
   - 即梦 imageToImage：将角色参考图作为 images 参数，确保同一角色外观一致
   - Shot 新增 characterRefPath 字段：角色参考图路径（第一个镜头生成后保存）
   - 评估体系中角色一致性作为关键指标（人脸特征匹配）

10. **视觉风格一致性保障**：
    - 固定风格参数：漫画风/写实/水彩等，写入 config，所有镜头统一
    - 第一张图作为风格参考，后续图生图时传入风格参考图
    - Shot 新增 styleRefPath 字段：风格参考图路径（第一个镜头生成后保存）
    - Writer prompt 中包含统一风格描述（如"日式漫画风、暖色调、柔和线条"）
    - 评估中检查风格一致性（CLIP 相似度 > 0.7）

11. **BGM 音乐库**（prompts/music-guide.md）：
    - 建立免费音乐资源筛选机制
    - 搜索来源：Free Music Archive、Pixabay Music、YouTube Audio Library
    - 筛选标准：无版权限制、情绪匹配、时长 ≥60s、质量高
    - Writer 输出 musicStyle 字段（情绪/节奏/乐器），用于音乐搜索
    - 音乐文件存入 episodes/{id}/assets/bgm.mp3
    - 后期混音时自动铺底（-18dB）

12. **输出规格**：
    - 默认比例：9:16 竖屏（适配抖音/小红书）
    - Writer prompt 中固定 ratio:"9:16"
    - 即梦文生图 ratio 固定为 9:16
    - Seedance ratio 固定为 4:3（竖屏视频）
    - 字幕样式：中文字体（思源黑体或系统默认），底部居中，半透明黑底，白色文字

13. **修正闭环**：
    - 评估发现低分 → 自动定位问题阶段 → 生成修正方案
    - 图片低分：重新生成（传入角色参考图+风格参考图保持一致）
    - 视频低分：人工评估后决定是否重新生成（消耗积分，需谨慎）
    - 每镜头最多重试 2 次（防止无限循环）
    - 重试记录写入 retry_log.json

14. **成本/积分追踪**（lib/utils/quota-manager.ts）：
    - 即梦：每次文生图消耗 1 积分，每日 66 积分免费
    - Seedance：每次视频消耗更多积分（具体数值需实测）
    - 预生成前检查剩余积分是否足够
    - 每集生成后记录消耗到 episodes/{id}/cost.json
    - 生成预估报告：本集预计消耗 N 积分

15. **Prompt 模板库**（prompts/templates/）：
    - 搜索优秀模板库案例：漫画短剧、悬疑、爱情、科普、历史等
    - 提取通用 prompt 模式（角色描述模板、场景描述模板、运镜模板）
    - 初始提供 3-5 个热门题材模板
    - 后续新生成的优质资产迭代添加到模板库
    - Writer 可选"基于模板"或"从零创作"

16. **多集管理**（lib/utils/episode-manager.ts）：
    - 同一主题的多集管理：shared character profiles, shared style reference
    - 第一集生成的角色图和风格图作为后续集的参考
    - 跨集角色一致性：共享 characterProfile
    - 集数编号和目录组织：ep_01_xxx/, ep_02_xxx/
    - 支持"基于第 N 集创建第 N+1 集"（继承角色和风格）

17. **字幕系统**（lib/utils/subtitle-generator.ts）：
    - 从 shots.json 的 subtitle 字段自动生成 SRT 字幕文件
    - 字幕时间轴对齐：根据每个镜头的实际时长自动计算开始/结束时间
    - 样式：中文字体、底部居中、半透明黑底白字
    - FFmpeg 烧录字幕到视频（ass/srt 格式）

18. **新增参考文档**：
    - prompts/seedance-guide.md（已有）— Seedance 2.0 首尾帧使用指南
    - prompts/audio-continuity-guide.md（已有）— 多段视频音频连贯性方案
    - prompts/evaluation-guide.md（已有）— 5 阶段评估体系
    - prompts/music-guide.md（新增）— 免费音乐库筛选指南
    - prompts/templates/（新增目录）— Prompt 模板库

19. **更新 SKILL.md**：
    - 移除 ComfyUI/Kling 双后端说明（保留可插拔架构说明）
    - 新增三阶段流程说明（素材生成 → 审核 → 视频生成）
    - 新增角色一致性、风格一致性方案说明
    - 新增 BGM 筛选和使用说明
    - 新增成本追踪说明
    - 新增多集管理说明
    - 新增模板库说明
    - 新增评估体系说明

20. **更新 package.json**：保持 TypeScript 编译通过`
      },
      output: "lib/",
      timeout: 600
    },

    // === Phase 2: 即梦集成 ===

    {
      id: "jimeng-integration",
      skill: "claude-code-via-openclaw",
      input: "refactor-arch",
      params: {
        task: `实现即梦图片服务 + Seedance 视频服务骨架 + pipeline 三阶段。

项目位置：~/.openclaw/workspace/skills/kais-aigc-movie/

## 重要约束

1. **不删除任何现有文件**：comfyui-service.ts、kling-api.ts、video-generator.ts 全部保留
2. **即梦防限流**：并发上限1，请求间隔 8s+随机0-12s，429退避60s+随机0-30s
3. **素材双用途**：生成的图片同时用于（a）故事预览 HTML（b）Seedance 视频素材

## 任务

### 1. 实现 lib/services/jimeng-service.ts

参考即梦 API（http://localhost:8000）：

\`\`\`typescript
interface JimengOptions {
  model?: string;        // 默认 jimeng-5.0
  ratio?: string;        // 默认 16:9
  resolution?: string;   // 默认 2k
  sampleStrength?: number;
}

interface ImageResult {
  url: string;
  revisedPrompt?: string;
}

class JimengService {
  constructor(options?: { apiUrl?: string; sessionId?: string })
  async testConnection(): Promise<boolean>
  async textToImage(prompt: string, options?: JimengOptions): Promise<ImageResult[]>
  async imageToImage(prompt: string, refImages: string[], options?: JimengOptions): Promise<ImageResult[]>
  async downloadImage(url: string, outputDir: string, filename: string): Promise<string>
  async batchTextToImage(items: { id: string; prompt: string; options?: JimengOptions }[], outputDir: string): Promise<Map<string, string>>
}
\`\`\`

实现要求：
- 使用原生 fetch（Node 18+ 内置）
- Authorization: Bearer <sessionid>
- 超时 120 秒
- **防限流（关键）**：
  - 并发上限：3（最多 3 个同时请求）
  - 请求间隔：baseDelay(8s) + Math.random() * jitterRange(12s)
  - 实现 sleep(ms) 工具函数
  - batchTextToImage 内部串行循环，每次请求前 await sleep
  - 429 响应检测：解析响应体含"访问量过大"或 HTTP 429 → 等待 60s + random(0-30s) 后重试
  - 最大重试 2 次（不含 429 退避重试）
  - 日志：每次请求打印等待时间和请求序号

### 2. 实现 lib/services/seedance-service.ts（骨架）

预留 Seedance 视频生成接口，当前只实现素材准备：

\`\`\`typescript
interface VideoTask {
  shotId: string;
  prompt: string;           // 视频描述（含 @1 引用素材）
  imagePath: string;        // 本地素材图片路径
  imageAssetUrl: string;    // 图片原始 URL（用于 file_paths）
  ratio: string;
  duration: number;
  status: 'prepared' | 'submitted' | 'processing' | 'done' | 'failed';
  videoUrl?: string;
  taskId?: string;
}

class SeedanceService {
  constructor(options?: { apiUrl?: string; sessionId?: string; model?: string })
  
  // 从 shots.json 准备视频任务清单（首帧+尾帧作为 Seedance 素材）
  prepareVideoTasks(shots: Shot[], imagesDir: string): VideoTask[]
  
  // 保存/加载视频任务清单
  saveTasks(tasks: VideoTask[], filePath: string): void
  loadTasks(filePath: string): VideoTask[]
  
  // 以下方法预留，当前 throw "not implemented"
  async submitVideoTask(task: VideoTask): Promise<string>
  async pollVideoTask(taskId: string): Promise<VideoResult>
}
\`\`\`

### 3. 更新 lib/config.ts

新增即梦配置（**不修改现有视频后端配置**）：
\`\`\`typescript
jimeng: z.object({
  apiUrl: z.string().default("http://localhost:8000"),
  sessionId: z.string().min(1, "JIMENG_SESSION_ID is required"),
  model: z.string().default("jimeng-5.0"),
  ratio: z.string().default("16:9"),
  resolution: z.string().default("2k"),
  // 防限流参数
  maxConcurrent: z.number().int().default(3),
  baseDelayMs: z.number().default(8000),
  jitterMs: z.number().default(12000),
  rateLimitBackoffMs: z.number().default(60000),
})
\`\`\`

新增 createJimengService() 和 createSeedanceService() 工厂函数。
保留 createVideoGenerator() 不变。

### 4. 新增 lib/services/music-service.ts（免费音乐库）

功能：
- searchMusic(style: string, duration?: number): Promise<MusicResult[]> — 搜索免费音乐
- 搜索来源：Free Music Archive (https://freemusicarchive.org/)、Pixabay Music (https://pixabay.com/music/)
- 搜索方式：使用 web_search 搜索 "free [genre] background music [mood] no copyright creative commons"
- 筛选标准：无版权限制（CC0/CC-BY）、mp3 格式、时长 ≥ 60s
- downloadMusic(url, outputDir): Promise<string> — 下载音乐文件
- 缓存已下载音乐到 episodes/.music-cache/ 避免重复下载

### 5. 新增 lib/utils/character-manager.ts（角色一致性）

功能：
- extractCharacterProfile(shots): CharacterProfile — 从 shots 中提取角色固定描述
- saveCharacterRef(firstShotImage: string, outputDir: string): Promise<string> — 保存角色参考图
- getCharacterRefPath(episodeDir: string): string — 获取角色参考图路径
- 角色参考图用途：图生图时作为 images 参数传入即梦，保证角色外观一致

### 6. 新增 lib/utils/style-manager.ts（风格一致性）

功能：
- saveStyleRef(firstShotImage: string, outputDir: string): Promise<string> — 保存风格参考图
- getStyleRefPath(episodeDir: string): string — 获取风格参考图路径
- 风格参考图用途：图生图时作为 images 参数传入即梦，保证视觉风格一致

### 7. 新增 lib/utils/subtitle-generator.ts（字幕生成）

功能：
- generateSRT(shots, audioDurations): string — 从 shots 生成 SRT 字幕文件
  - 自动计算每条字幕的开始/结束时间（基于镜头时长累加）
- 样式：中文字体，底部居中，半透明黑底白字
- 输出 episodes/{id}/subtitles.srt

### 8. 新增 lib/utils/quota-manager.ts（积分追踪）

功能：
- estimateCredits(shots): { jimeng: number, seedance: number } — 预估本集消耗
- checkQuota(estimated: number): boolean — 检查剩余积分是否足够
- recordUsage(episodeDir, usage): void — 记录实际消耗
- generateCostReport(episodeDir): CostReport — 生成成本报告
- 积分消耗参考：即梦文生图 1 积分/次，Seedance 视频需实测

### 9. 重写 pipeline.mjs 为三阶段

**Phase A — 素材生成**（默认执行）：
\`\`\`
node pipeline.mjs --topic "主题" --phase material
\`\`\`
- Step 0: 积分预算检查（quota-manager.estimateCredits → quota-manager.checkQuota）
- Step 1: Writer（输出 script.json，含 characterProfile + emotion/pace/sceneGroupId + musicStyle）
- Step 2: 即梦文生图（角色一致性 + 风格一致性）：
  - 第 1 个镜头：textToImage（纯文生图）→ 保存为 characterRef + styleRef
  - 后续镜头：imageToImage（传入 characterRef + styleRef + 场景描述）
- Step 3: GLM-TTS（按 sceneGroupId 合并同场景字幕，一次性合成保证连贯）
- Step 4: 音乐搜索（根据 musicStyle 搜索免费 BGM）→ 下载到 assets/bgm.mp3
- Step 5: 生成 SRT 字幕（subtitle-generator）
- Step 6: 准备视频任务（SeedanceService.prepareVideoTasks → video_tasks.json）
- Step 7: 生成预览 story.html（图片+字幕+音频的三页 Tab 审核界面）
- Step 8: 自动评估（evaluation-guide.md 中的自动检查 + AI 评分）
- 输出 summary.json 含所有文件路径 + 评分卡 + 成本报告

**Phase B — 审核**（人工触发）：
\`\`\`
node pipeline.mjs --phase review --episode-dir ./episodes/xxx
\`\`\`
- 展示综合评分卡（各维度 0-10 分 + 总分）
- 展示故事预览 HTML（3 Tab）
- 展示问题镜头列表（低分项标注原因）
- 支持 --approve 直接进入 Phase C
- 支持 --edit 修改后重新生成
- 支持 --fix-shot <shot_id> 只修正单个镜头

**Phase C — 视频生成**（审核通过后触发）：
\`\`\`
node pipeline.mjs --phase video --episode-dir ./episodes/xxx
\`\`\`
- 读取 video_tasks.json
- 逐镜头调用 Seedance（预留，当前打印 TODO）
- FFmpeg 拼接（视频 crossfade + 音频 crossfade + 字幕烧录 + BGM 铺底）
- 最终输出 9:16 竖屏 rough_cut.mp4
- QC → qc_report.json

**断点续传**：所有阶段都支持 --resume，跳过已完成的步骤。

### 5. 更新 lib/index.ts

导出所有新增服务。

### 6. 编译验证
- npm run build 通过
- npm run typecheck 通过`
      },
      output: "lib/services/jimeng-service.ts",
      timeout: 480
    },

    // === Phase 3: 故事漫画 HTML 生成 ===

    {
      id: "story-html-generator",
      skill: "claude-code-via-openclaw",
      input: "jimeng-integration",
      params: {
        task: `实现故事预览 HTML 生成器 + 视频任务清单展示。

项目位置：~/.openclaw/workspace/skills/kais-aigc-movie/

## 任务

### 1. 创建 lib/utils/story-renderer.ts

生成精美的故事预览 HTML 页面（用于审核）：

\`\`\`typescript
interface StoryRenderOptions {
  title: string;
  storyBible: any;
  shots: Array<{
    id: string;
    imageUrl: string;        // 首帧图片路径
    lastFrameUrl?: string;   // 尾帧图片路径
    subtitle: string;
    audioUrl?: string;
    speaker?: string;
    duration?: number;
    imagePrompt?: string;    // 即梦文生图提示词（首帧）
    lastFramePrompt?: string;// 即梦文生图提示词（尾帧）
    videoPrompt?: string;    // Seedance 视频提示词（@1首帧 @2尾帧）
  }>;
  videoTasks?: Array<{       // 视频任务清单
    shotId: string;
    prompt: string;
    firstFramePath: string;
    lastFramePath: string;
    ratio: string;
    duration: number;
    status: string;
  }>;
  outputPath: string;
  theme?: 'dark' | 'light';
  style?: 'comic' | 'cinematic' | 'minimal';
}

async function renderStoryHtml(options: StoryRenderOptions): Promise<string>
\`\`\`

### 2. HTML 设计要求

**页面结构**（3 个 Tab）：

**Tab 1 — 故事预览**（默认）：
- 全屏幻灯片，每个镜头一页
- 图片占满屏幕 60-70%
- 底部字幕区域（半透明背景）
- 如果有音频：自动播放当前页音频
- 键盘/触摸翻页

**Tab 2 — 分镜详情**：
- 表格展示所有镜头信息
- 列：编号、图片缩略图、字幕、imagePrompt、videoPrompt、音频状态
- 可编辑（方便审核时调整）
- 导出修改后的 JSON

**Tab 3 — 视频任务**：
- 展示 video_tasks.json 内容
- 每个任务一行：镜头编号、视频提示词、比例、时长、状态
- 底部有「审核通过，开始生成视频」按钮（当前只是 UI，不实际触发）
- 支持单选/全选跳过某些镜头

**样式**：
- 暗色主题（默认）
- 漫画风：圆角边框、漫画气泡式字幕
- 响应式设计（桌面+移动）

**技术**：
- 纯 HTML + CSS + vanilla JS
- 图片和音频用 base64 data URL 嵌入
- 单文件，离线可用

### 3. 更新 pipeline.mjs

在 Phase A 的 Step 5 中：
- 调用 renderStoryHtml() 生成 story.html
- 同时生成 video_tasks.json（由 SeedanceService.prepareVideoTasks 生成）
- summary.json 包含 story.html 和 video_tasks.json 路径

### 4. 导出
- 在 lib/index.ts 导出 renderStoryHtml 和 StoryRenderOptions

### 5. 编译验证
- npm run build 通过
- npm run typecheck 通过`
      },
      output: "lib/utils/story-renderer.ts",
      timeout: 360
    },

    // === Phase 4: 端到端集成测试 ===

    {
      id: "e2e-test",
      skill: "claude-code-via-openclaw",
      input: "story-html-generator",
      params: {
        task: `端到端集成测试和文档更新。

项目位置：~/.openclaw/workspace/skills/kais-aigc-movie/

## 任务

### 1. 端到端测试脚本

创建 test/e2e-test.mjs：
- 模拟 Phase A 完整流程：创建测试 episode → mock Writer 输出 script.json → mock 即梦图片 → mock TTS → 生成 story.html + video_tasks.json
- 使用临时目录
- 验证所有中间文件生成正确
- 验证 story.html 包含 3 个 Tab（故事预览、分镜详情、视频任务）
- 验证 video_tasks.json 格式正确
- 输出测试报告

### 2. 更新 README.md

新标题：AI 漫剧制作工坊 (AI Comic Drama Workshop)

新架构说明：
- 三阶段流程：素材生成 → 审核 → 视频生成
- 当前实现：Phase A（素材生成）+ Phase B（审核预览）
- Phase C（Seedance 视频生成）预留接口

新架构图（Mermaid）：
\`\`\`
用户输入主题 → Writer(GLM-5.1) → script.json
  → 即梦文生图(并行) + GLM-TTS(并行)
  → story.html 预览 + video_tasks.json
  → [人工审核]
  → Seedance 视频生成(逐镜头)
  → FFmpeg 拼接 → rough_cut.mp4
  → QC → 交付
\`\`\`

移除 ComfyUI/Kling 说明。新增即梦 + Seedance 说明。保留视频后端可插拔架构说明。

### 3. 更新 skill/SKILL.md

与实际代码一致：
- 三阶段流程说明
- Phase A/B/C 分别描述
- video_tasks.json 格式
- 审核流程（agent 读取 summary.json → 展示预览 → 等待确认 → Phase C）
- 保留视频后端可插拔说明（ComfyUI/Kling/Seedance）

### 4. 更新 .env.example

\`\`\`env
# 必填
GLM_TTS_API_KEY=your_glm_api_key
JIMENG_SESSION_ID=your_jimeng_session_id

# 即梦配置
JIMENG_API_URL=http://localhost:8000
JIMENG_MODEL=jimeng-5.0
JIMENG_RATIO=16:9
JIMENG_RESOLUTION=2k

# Seedance（Phase C 视频生成时需要）
SEEDANCE_MODEL=jimeng-video-seedance-2.0-fast
SEEDANCE_RATIO=4:3
SEEDANCE_DURATION=4

# 通用
EPISODES_DIR=./episodes
\`\`\`

### 5. Git 提交和推送
- git add -A
- git commit -m "feat: 漫剧制作工坊 — 三阶段流程（素材生成→审核→视频生成）"
- git push origin master

### 6. 验证
- npm run build 通过
- npm run typecheck 通过
- git status clean`
      },
      output: "final-package",
      timeout: 300,
      await: "human"
    }
  ]
};

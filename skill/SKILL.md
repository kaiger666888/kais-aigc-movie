---
name: kais-aigc-movie
description: "AI 漫剧自动生成系统。通过 Telegram 输入主题，自动完成剧本→配音→视频生成→剪辑→质检全流程。触发词：拍个剧、生成漫剧、aigc movie、/new 剧本主题。"
---

# AI 漫剧自动生成 Skill

基于 OpenClaw + GLM-5.1 + GLM-TTS + Kling 3.0 的全自动漫剧生成流水线。

## 触发条件

用户说以下任意一种时激活：
- "拍个剧"、"生成漫剧"、"AI漫剧"
- "/new <主题>"
- "aigc movie"、"make a comic drama"
- 任何要求自动生成短视频/漫剧的指令

## 项目位置

- **代码库**: `~/.openclaw/workspace/skills/kais-aigc-movie/`
- **剧集输出**: `~/.openclaw/workspace/skills/kais-aigc-movie/episodes/`

## 依赖

- Node.js ≥ 20
- FFmpeg（系统已安装）
- GLM-TTS API Key（环境变量）
- Kling 3.0 API Access Key + Secret Key（环境变量）
- TypeScript 编译：`npm run build`

## 执行流程

### 1. 初始化

```bash
cd ~/.openclaw/workspace/skills/kais-aigc-movie
npm install && npm run build
```

### 2. 生成剧集

当用户触发时，按以下步骤执行：

#### Step 1: 剧本生成（Writer）
- 使用 `sessions_spawn` 调用 GLM-5.1 sub-agent
- Prompt 见 `prompts/writer-prompt.md`
- 输出：`story_bible.json` + `shots.json`
- 保存到 `episodes/{id}/`

```
sessions_spawn({
  model: "zai/glm-5.1",
  mode: "run",
  task: "<writer prompt + topic>"
})
```

#### Step 2: 语音合成（Voice Director）— 与 Step 3 并行
- 读取 `shots.json` 中的 subtitle 字段
- 调用 GLM-TTS API 批量合成
- 保存到 `episodes/{id}/audio/`

```bash
node dist/services/glm-tts.js --input episodes/{id}/shots.json --output episodes/{id}/audio/
```

#### Step 3: 视频生成（Kling Renderer）— 与 Step 2 并行
- 读取 `shots.json` 中的 visualPrompt 字段
- 按镜头调用 Kling 3.0 API 异步生成
- 并发控制（最多 2 个），每个镜头独立重试
- 保存到 `episodes/{id}/shots/`

```bash
node dist/services/kling-api.js --input episodes/{id}/shots.json --output episodes/{id}/shots/
```

#### Step 4: 后期剪辑（Editor）
- 等待 Step 2 + Step 3 全部完成
- FFmpeg 拼接：每个镜头叠加音频 → 添加字幕 → 添加转场
- 输出：`episodes/{id}/rough_cut.mp4`

```bash
node dist/utils/ffmpeg.js --compose episodes/{id}
```

#### Step 5: 质量检测（QC）
- 使用 ffprobe 检查成片
- 验证：时长、编码、分辨率、音视频完整性
- 输出：`episodes/{id}/qc_report.json`

#### Step 6: 交付
- 发送 `rough_cut.mp4` 给用户
- 附上质检摘要

### 3. 状态管理

- 每个剧集有独立目录 `episodes/{id}/`
- `state.json` 记录当前步骤和进度
- 支持中断恢复：检查 state.json，跳过已完成步骤

### 4. 错误处理

- 单镜头视频生成失败：重试当前镜头（不重跑整集）
- Writer 生成 JSON 格式错误：重新生成
- FFmpeg 合成失败：输出详细日志
- 全部失败：保存 state.json，告知用户可用 /resume 重试

## MVP 边界

- 单集时长：45-60 秒
- 角色数：1-2
- 场景数：1-2
- 镜头数：6-8
- 风格：固定漫画风、低动作、旁白主导

## 环境变量

```
GLM_TTS_API_KEY=xxx
KLING_ACCESS_KEY=xxx
KLING_SECRET_KEY=xxx
```

## 目录结构

```
kais-aigc-movie/
├── lib/                    # Node.js 工具库
│   ├── types/              # TypeScript 类型定义
│   ├── services/           # 外部 API 封装（Kling, GLM-TTS）
│   ├── utils/              # FFmpeg, 状态管理, 文件管理
│   └── config.ts           # 环境变量配置
├── skill/                  # OpenClaw Skill 定义
│   └── SKILL.md            # 本文件
├── prompts/                # Prompt 模板
│   └── writer-prompt.md    # Writer sub-agent prompt
├── episodes/               # 剧集输出目录
├── package.json
└── tsconfig.json
```

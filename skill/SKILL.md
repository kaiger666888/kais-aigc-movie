---
name: kais-aigc-movie
description: "AI 漫剧自动生成系统。通过 Telegram 输入主题，自动完成剧本→配音→视频生成→剪辑→质检全流程。触发词：拍个剧、生成漫剧、aigc movie、/new 剧本主题。"
---

# AI 漫剧自动生成 Skill

基于 OpenClaw + GLM-5.1 + GLM-TTS + 双视频后端的全自动漫剧生成流水线。

## 触发条件

用户说以下任意一种时激活：
- "拍个剧"、"生成漫剧"、"AI漫剧"
- "/new <主题>"
- "aigc movie"、"make a comic drama"
- 任何要求自动生成短视频/漫剧的指令

## 双视频后端架构

支持两种视频生成后端，通过 `VIDEO_BACKEND` 环境变量切换：

### ComfyUI (Wan2.2) — 默认主后端
- **优点**：本地 GPU 运行，无 API 调用费用，高吞吐
- **要求**：NVIDIA GPU（推荐 3060Ti 8GB+）、ComfyUI 服务运行中
- **模型**：wan2.2_t2v_1.3B（快速）或 wan2.2_t2v_5B（高质量）

### Kling 3.0 API — 备选后端
- **优点**：无需 GPU，云端生成
- **要求**：Kling API Access Key + Secret Key

### 切换方法

```env
# 使用 ComfyUI（默认）
VIDEO_BACKEND=comfyui

# 使用 Kling API
VIDEO_BACKEND=kling
```

### ComfyUI 安装指引

1. **安装 ComfyUI**
   ```bash
   git clone https://github.com/comfyanonymous/ComfyUI.git
   cd ComfyUI
   pip install -r requirements.txt
   ```

2. **下载 Wan2.2 模型**
   - [wan2.2_t2v_5B](https://huggingface.co/Comfy-Org/Wan2.2-T2V-5B_comfyui_repackaged) → `models/diffusion_models/`
   - [umt5_xl](https://huggingface.co/Comfy-Org/umt5_xl_comfyui) → `models/text_encoders/`
   - [wan_2.1_vae](https://huggingface.co/Comfy-Org/wan_2.1_vae_comfyui) → `models/vae/`

3. **启动 ComfyUI**
   ```bash
   python main.py --listen 0.0.0.0 --port 8188
   ```

4. **配置环境变量**
   ```env
   COMFYUI_HOST=127.0.0.1  # 或 GPU 机器 IP
   COMFYUI_PORT=8188
   COMFYUI_MODEL=wan2.2_t2v_5B
   ```

5. **验证连通性**
   ```typescript
   import { ComfyUIService } from "kais-aigc-movie";
   const svc = new ComfyUIService({ host: "127.0.0.1", port: 8188 });
   const ok = await svc.testConnection(); // true = 连通
   ```

## 项目位置

- **代码库**: `~/.openclaw/workspace/skills/kais-aigc-movie/`
- **剧集输出**: `~/.openclaw/workspace/skills/kais-aigc-movie/episodes/`

## 依赖

- Node.js ≥ 20
- FFmpeg（系统已安装 — `checkFFmpeg()` 可检测）
- GLM-TTS API Key（环境变量）
- **视频后端二选一**：
  - ComfyUI + Wan2.2 模型（本地 GPU）
  - Kling 3.0 API Key（云端）
- TypeScript 编译：`npm run build`

## 环境变量

```env
# --- 必填 ---
GLM_TTS_API_KEY=your_glm_api_key

# --- 视频后端（二选一）---
VIDEO_BACKEND=comfyui

# ComfyUI（VIDEO_BACKEND=comfyui 时需要）
COMFYUI_HOST=127.0.0.1
COMFYUI_PORT=8188
COMFYUI_MODEL=wan2.2_t2v_5B

# Kling（VIDEO_BACKEND=kling 时需要）
KLING_ACCESS_KEY=your_kling_access_key
KLING_SECRET_KEY=your_kling_secret_key

# --- 可选 ---
COMFYUI_WORKFLOW_PATH=         # 自定义工作流 JSON（默认内置 Wan2.2 T2V）
KLING_API_URL=https://api-beijing.klingai.com
KLING_MAX_CONCURRENT=2
KLING_MAX_RETRIES=3
KLING_SHOT_TIMEOUT_MS=300000
GLM_TTS_ENDPOINT=https://open.bigmodel.cn/api/paas/v4/audio/speech
EPISODES_DIR=./episodes
```

## Writer Prompt 模板使用说明

Writer prompt 模板位于 `prompts/writer-prompt.md`，用于指导 GLM-5.1 生成结构化剧本。

### 模板变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `{{topic}}` | 用户提供的主题 | "一只猫的冒险" |
| `{{duration}}` | 目标时长（秒） | 60 |
| `{{shotCount}}` | 镜头数量 | 8 |
| `{{characterCount}}` | 角色数量 | 2 |
| `{{style}}` | 视觉风格 | comic |

### 输出格式

Writer 必须输出两个 JSON 文件：

1. **story_bible.json** — 角色定义、场景、剧情大纲（符合 `StoryBibleSchema`）
2. **shots.json** — 逐镜头脚本，包含视觉提示词、字幕、角色分配（符合 `ShotsConfigSchema`）

### 调用方式

```
sessions_spawn({
  model: "zai/glm-5.1",
  mode: "run",
  task: "<writer prompt 填入 topic>"
})
```

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

#### Step 2: 语音合成（Voice Director）— 与 Step 3 并行
- 读取 `shots.json` 中的 subtitle 字段
- 调用 GLM-TTS API 批量合成
- 支持音色：`tongtong`, `male-narrator`, `female-shuangkuaisisi` 等（见 `listVoices()`）
- 保存到 `episodes/{id}/audio/`

#### Step 3: 视频生成（Video Renderer）— 与 Step 2 并行
- 读取 `shots.json` 中的 visualPrompt 字段
- 根据 `VIDEO_BACKEND` 选择 ComfyUI 或 Kling 后端
- 调用 `createVideoGenerator()` 获取统一接口
- ComfyUI: 本地 GPU 异步生成，内置 Wan2.2 T2V 工作流
- Kling: 云端 API 异步生成，并发控制 + 重试
- 保存到 `episodes/{id}/shots/`

#### Step 4: 后期剪辑（Editor）
- 等待 Step 2 + Step 3 全部完成
- FFmpeg 拼接：每个镜头叠加音频 → 添加字幕 → 添加转场
- 转场偏移量根据 ffprobe 获取的实际视频时长动态计算
- 输出：`episodes/{id}/rough_cut.mp4`

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

## 健康检查

```typescript
import { createVideoGenerator, checkFFmpeg } from "kais-aigc-movie";

// 自动根据 VIDEO_BACKEND 创建对应后端
const videoGen = createVideoGenerator();
const videoOk = await videoGen.testConnection();  // true = 后端可达
const ffmpegOk = await checkFFmpeg();              // true = ffmpeg 已安装
```

## MVP 边界

- 单集时长：45-60 秒
- 角色数：1-2
- 场景数：1-2
- 镜头数：6-8
- 风格：固定漫画风、低动作、旁白主导

## 目录结构

```
kais-aigc-movie/
├── lib/                    # Node.js 工具库
│   ├── types/              # TypeScript 类型定义
│   ├── services/           # 外部 API 封装（ComfyUI, Kling, GLM-TTS）
│   ├── utils/              # FFmpeg, 状态管理, 文件管理
│   ├── config.ts           # 环境变量配置 + FFmpeg 检测
│   └── index.ts            # 公共 API re-exports
├── skill/                  # OpenClaw Skill 定义
│   └── SKILL.md            # 本文件
├── prompts/                # Prompt 模板
│   └── writer-prompt.md    # Writer sub-agent prompt
├── episodes/               # 剧集输出目录
├── package.json
├── tsconfig.json
└── README.md
```

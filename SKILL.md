# kais-aigc-movie — AI 短片制作全流程

激活条件：用户提到 "AI电影"、"AI短片"、"做个视频"、"AIGC电影"、"kais-aigc-movie" 等关键词时激活。

## 定位

基于 `kais-jimeng`（即梦 API）的底层能力，提供**脚本 → 素材 → 分镜 → 成片 → 后期**的一站式 AI 短片制作流程。

## 依赖

| 依赖 | 说明 | 必需 |
|------|------|------|
| kais-jimeng | 即梦图片/视频生成 | ✅ |
| ffmpeg | 视频拼接、转场、字幕 | ✅ |
| curl | API 调用 | ✅ |
| jq | JSON 处理 | 推荐 |

## 核心能力

| 阶段 | 说明 | 底层依赖 |
|------|------|----------|
| 📝 脚本编写 | 根据主题生成分镜脚本（场景、描述、台词、时长） | LLM |
| 🎨 素材生成 | 每个分镜生成图片素材 | kais-jimeng 文生图 |
| 🎬 视频生成 | 素材图片 → Seedance 视频片段 | kais-jimeng Seedance |
| 🔊 配音/TTS | 台词转语音（可选） | tts |
| ✂️ 剪辑合成 | ffmpeg 拼接片段 + 配音 + 字幕 | ffmpeg |
| 📤 发布 | 发送到聊天/上传平台 | message / bilibili-upload |

## 工作流程（Agent 执行指南）

### Phase 1: 需求确认
1. 向用户确认：主题、风格、时长（建议 30s-2min）、目标比例（16:9 / 9:16）
2. 如果用户说"别问我了"，跳过确认，自行决策

### Phase 2: 脚本生成
1. 根据主题生成分镜脚本，格式保存为 JSON：
```json
{
  "title": "短片标题",
  "style": "视觉风格描述",
  "ratio": "9:16",
  "scenes": [
    {
      "id": 1,
      "description": "画面描述（英文，用于生成图片）",
      "prompt_cn": "中文描述（用于理解）",
      "duration": 4,
      "dialogue": "可选台词",
      "subtitle": "可选字幕",
      "shot": "镜头类型"
    }
  ]
}
```
2. 片段时长建议：每个场景 3-5 秒（Seedance 默认 4 秒）
3. 总时长控制：场景数 × 4 秒 + 转场
4. **保存脚本到 `/tmp/openclaw/aigc-movie/<项目名>/script.json`**

### Phase 3: 素材生成
1. 对每个场景调用 `kais-jimeng` 文生图：
   - model: `jimeng-5.0`
   - ratio: 用户指定（默认 `9:16`）
   - resolution: `2k`
   - prompt: 场景 description（英文）
2. 下载图片到 `/tmp/openclaw/aigc-movie/<项目名>/assets/scene_<id>.png`
3. **注意积分消耗**：每个场景 1 积分，提前估算总量
4. 如果积分不足，提示用户

### Phase 4: 视频生成（串行，每个 10-15 分钟）
1. 对每个场景的素材图调用 Seedance：
   - model: `jimeng-video-seedance-2.0-fast`
   - **必须用异步接口**（同步容易超时）
   - prompt: `@1 <场景视频描述>`
   - file_paths: `[素材图URL]`
   - ratio: 与素材一致
   - duration: 4
2. 轮询 task_id 等待完成
3. 下载视频到 `/tmp/openclaw/aigc-movie/<项目名>/clips/scene_<id>.mp4`
4. **建议**：先用 2-3 个场景测试流程，确认满意后再全量生成

### Phase 5: 后期合成（可选）
1. **拼接**：用 scripts/concat.sh
2. **转场**：用 scripts/xfade.sh
3. **字幕**：用 scripts/subtitle.sh
4. **配音**：用 tts 为台词生成语音

### Phase 6: 交付
1. 最终视频保存到 `/tmp/openclaw/aigc-movie/<项目名>/final.mp4`
2. 用 `message` tool 发送（`asDocument: true` 避免压缩）
3. 如需上传 B 站：调用 `bilibili-upload` skill

## 重要约束

### 积分预算
- 文生图：1 积分/次
- 视频生成：积分消耗更高
- 每日免费 66 积分 → 建议 5-8 个场景以内
- **Phase 3 前必须告知用户预估积分消耗**

### Seedance 规则
- 必须有素材文件（不能纯文本生成视频）
- 必须用异步接口
- prompt 中用 `@1` 引用素材
- 生成时间 10-15 分钟/片段

## 项目结构

```
/tmp/openclaw/aigc-movie/<项目名>/
├── script.json          # 分镜脚本
├── assets/              # 素材图片
├── clips/               # 视频片段
├── audio/               # 配音（可选）
├── final.mp4            # 最终成片
└── concat.txt           # 拼接清单
```

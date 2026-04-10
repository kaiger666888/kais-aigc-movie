# kais-aigc-movie — AI 短片制作全流程

激活条件：用户提到 "AI电影"、"AI短片"、"做个视频"、"AIGC电影"、"kais-aigc-movie" 等关键词时激活。

## 定位

基于 `kais-jimeng`（即梦 API）的底层能力，提供**脚本 → 素材 → 分镜 → 成片 → 后期**的一站式 AI 短片制作流程。

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
1. 根据主题生成分镜脚本，格式：
```json
{
  "title": "短片标题",
  "style": "视觉风格描述",
  "scenes": [
    {
      "id": 1,
      "description": "画面描述（英文，用于生成图片）",
      "prompt_cn": "中文描述（用于理解）",
      "duration": 4,
      "dialogue": "可选台词",
      "transition": "fade/cut/zoom"
    }
  ]
}
```
2. 片段时长建议：每个场景 3-5 秒（Seedance 默认 4 秒）
3. 总时长控制：场景数 × 4 秒 + 转场
4. **保存脚本到 `/tmp/openclaw/aigc-movie/<项目名>/script.json`**

### Phase 3: 素材生成（并行）
1. 对每个场景调用 `kais-jimeng` 文生图：
   - model: `jimeng-5.0`
   - ratio: 用户指定（默认 `16:9`）
   - resolution: `2k`
   - prompt: 场景 description（英文）
2. 下载图片到 `/tmp/openclaw/aigc-movie/<项目名>/assets/scene_<id>.png`
3. **注意积分消耗**：每个场景 1 积分，提前估算总量
4. 如果积分不足，提示用户

### Phase 3.5: 素材评价（自动）
> **每个生图环节都必须执行，不跳过。** 使用 `lib/scripts/scene-evaluator.py` 自动检查逻辑一致性。

1. 为每个场景定义评价规格（`eval-spec.json`）：
```json
{
  "shots": [
    {
      "id": "scene_1",
      "description": "场景中文描述",
      "constraints": [
        "手里有筷子（不应同时在口袋里出现）",
        "屏幕显示代码",
        "表情符合场景情绪"
      ]
    }
  ]
}
```

2. 运行评价：
```bash
python3 lib/scripts/scene-evaluator.py eval-spec.json assets/
```

3. **自动处理结果**：
   - ✅ PASS → 进入 Phase 4
   - ❌ FAIL → 分析失败原因，**修改 prompt 后重跑**（最多 2 次）
   - ⚠️ ERROR → 检查 API 或图片大小

4. **高频检查项**（根据经验积累）：
   - **物品重复**：同一物品出现在多个不合理位置（如筷子在手+口袋）
   - **关键道具缺失**：场景要求的道具未出现（如分析仪、屏幕）
   - **物理不合理**：物品悬浮、动作不可能、重力方向错误
   - **表情不符**：表情与场景情绪不匹配（如震惊场景表情平淡）
   - **构图/景别错误**：要求的景别（远景/特写）与实际不符
   - **角色一致性**：同一角色在不同场景中外貌明显不同

5. **评价器位置**：`lib/scripts/scene-evaluator.py`
   - 使用智谱 `glm-4v-flash`（免费视觉模型）
   - 自动压缩过大图片（>4MB）
   - 输出 `eval-result.json` 供后续流程使用

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
1. **配音**：用 tts 为每个场景台词生成语音
2. **字幕**：用 ffmpeg drawtext 添加字幕
3. **拼接**：
```bash
# 创建 concat 文件
cat > /tmp/openclaw/aigc-movie/<项目名>/concat.txt << EOF
file 'clips/scene_1.mp4'
file 'clips/scene_2.mp4'
file 'clips/scene_3.mp4'
EOF

# 拼接
ffmpeg -f concat -safe 0 -i concat.txt -c copy output.mp4

# 加转场（可选）
# ffmpeg -i scene_1.mp4 -i scene_2.mp4 -filter_complex "[0][1]xfade=transition=fade:duration=0.5:offset=3.5" out.mp4
```
4. **添加背景音乐**（如果有音频文件）

### Phase 6: 交付
1. 最终视频保存到 `/tmp/openclaw/aigc-movie/<项目名>/final.mp4`
2. 用 `message` tool 发送：
   - `media: "/tmp/openclaw/aigc-movie/<项目名>/final.mp4"`
   - `asDocument: true`（避免 Telegram 压缩）
3. 如需上传 B 站：调用 `bilibili-upload` skill

## 重要约束

### 积分预算
- 文生图：1 积分/次（每场景 1 次 = N 场景消耗 N 积分）
- 视频生成：积分消耗更高（具体视模型而定）
- 每日免费 66 积分 → 建议 5-8 个场景以内
- **Phase 3 前必须告知用户预估积分消耗**

### Seedance 规则
- 必须有素材文件（不能纯文本生成视频）
- 必须用异步接口（`/v1/videos/generations/async`）
- prompt 中用 `@1` 引用素材
- 生成时间 10-15 分钟/片段

### 失败处理
- 素材生成失败：重试 1 次，仍失败跳过该场景
- 视频生成失败：记录 task_id，后续可恢复查询
- 服务不可用：`kais-jimeng` skill 中的启动流程

## 快速命令

```
用户: "帮我做一个 30 秒的 AI 短片，主题是赛博朋克城市"
→ Phase 1: 确认（或跳过）
→ Phase 2: 生成分镜脚本（~6 个场景）
→ Phase 3: 生成 6 张素材图
→ Phase 4: 生成 6 个视频片段（串行，约 60-90 分钟）
→ Phase 5: 拼接合成
→ Phase 6: 交付视频
```

## 项目结构

```
/tmp/openclaw/aigc-movie/<项目名>/
├── script.json          # 分镜脚本
├── assets/              # 素材图片
│   ├── scene_1.png
│   └── scene_2.png
├── clips/               # 视频片段
│   ├── scene_1.mp4
│   └── scene_2.mp4
├── audio/               # 配音（可选）
├── final.mp4            # 最终成片
└── concat.txt           # 拼接清单
```

## 待扩展

- [ ] 角色一致性（ControlNet / IP-Adapter 风格锁定）
- [ ] 自动背景音乐匹配
- [ ] 批量场景并行生成（多账号）
- [ ] 模板库（常用风格预设）
- [ ] 字幕自动生成

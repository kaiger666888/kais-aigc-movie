# 多段视频音频连贯性解决方案

基于 Seedance 2.0 首尾帧模式生成多段视频后，背景音/音效/配音不连贯的完整解决策略。

## 问题分析

多段视频拼接后，音频连贯性问题分为三层：

| 层级 | 问题 | 表现 |
|------|------|------|
| **L1 配音层** | 每段视频自带随机生成的环境音/音效 | 段落切换时环境音突然变化（鸟叫→车流→风声） |
| **L2 BGM 层** | 每段视频没有统一背景音乐 | 段落之间音乐断裂或风格不一致 |
| **L3 人声层** | GLM-TTS 逐镜头生成，音色/语速/情感不连贯 | 角色声音在不同镜头间突变 |

## 核心策略：利用 Seedance 音频能力，而非去除

**Seedance 2.0 的原生音画同步是核心优势，应该利用而非丢弃。**

### 推荐架构

```
1. 生成统一环境音轨（60秒完整环境音，如"咖啡馆：爵士乐+杯碟声+低语"）
2. 按镜头时长切分环境音轨
3. Seedance 生成视频时，每段都传入对应的环境音片段作为 @音频参考
   → Seedance 会生成匹配这条音频的视频+音效
   → 所有镜头共享同一个声音基底 → 音频自然连贯
4. 后期处理：
   - 视频接缝处：音频 crossfade（0.5-1s）
   - 场景切换处：铺全局 BGM 桥接 + 转场镜头
   - 配音层：GLM-TTS 按 sceneGroupId 合并合成
```

---

## L1 解决方案：保留并利用 Seedance 音频

### ⚠️ 重要：Seedance 2.0 默认带音频

Seedance 2.0 的核心卖点就是**原生音画同步**（双分支扩散变换器同时生成画面和音频）。
- 官方确认：**音频默认开启**
- 如果不输入音频参考，模型会根据画面**自动生成环境音效**
- 自动生成的音效在多段拼接时可能不连贯（段落切换时环境音突变）

### 方案 A：音频参考输入统一基底（推荐 ⭐）

**核心思路**：给所有镜头传入同一条环境音轨的对应片段，让 Seedance 在同一声音基底上生成。

#### Step 1：生成统一环境音轨

根据剧本主题，用 TTS 或音效库生成一条 60 秒的环境音：

```
示例（咖啡馆场景）：
- 用 AI 音乐生成工具生成一条轻柔爵士乐（60秒）
- 或用 GLM-TTS 生成一段环境描述，然后用音效工具转为音频
- 或从免费音效库下载合适的环境音

示例（森林场景）：
- 鸟鸣+风声+树叶沙沙声（60秒循环）
```

#### Step 2：按镜头时长切分

```bash
# 假设镜头时长分布：[6s, 5s, 7s, 5s, 6s, 5s, 7s, 5s] = 46s
# 从 60s 环境音中依次切分

ffmpeg -i ambience_60s.mp3 -ss 0 -t 6 ambience_shot1.mp3
ffmpeg -i ambience_60s.mp3 -ss 6 -t 5 ambience_shot2.mp3
# ... 依次切分
```

#### Step 3：Seedance 生成时传入音频参考

```
Seedance API 调用时：
- file_paths: ["首帧图片URL", "尾帧图片URL", "环境音片段URL"]
- prompt: "@1 @2 画面中的人物缓缓转头... @3 作为环境音参考"
```

**效果**：所有镜头的 Seedance 生成都会匹配同一条环境音 → 声音基底一致 → 接缝处即使有微小差异，crossfade 就能平滑过渡。

#### Step 4：场景切换处理

如果剧本有多个不同场景（咖啡馆 → 街道 → 家），每个场景用不同的环境音轨，但在场景切换处：

1. 插入 1-2 秒转场镜头（如门关上、画面模糊、黑屏过渡）
2. 转场镜头的环境音是上一场景的尾段 → crossfade 到下一场景的环境音
3. 铺一层全局 BGM 遮盖切换点

### 方案 B：Prompt 音频意识设计（辅助）

Writer 设计相邻镜头时，让 prompt 中隐含的声音描述保持延续性：

```
✅ 好的设计（同场景内）：
镜头1：...背景有轻柔的爵士乐和咖啡机嗡嗡声
镜头2：...爵士乐继续，远处传来咖啡杯碰撞声
镜头3：...音乐渐渐变弱，门铃声响起

❌ 差的设计（同场景内声音突变）：
镜头1：...安静的书房，只有翻书声
镜头2：...热闹的街道，车流喧嚣  ← 同场景内不应该突变
```

**注意**：Prompt 中不需要显式描述声音，Seedance 会根据画面内容自动生成。但如果画面有声音暗示（如翻书、关门、下雨），Seedance 会生成对应音效。所以关键是**画面内容的连贯性** → 声音自然连贯。

### 方案 C：后期音频 crossfade（兜底）

即使用了方案 A/B，在接缝处仍建议做音频 crossfade：

```bash
# 两段视频的音频 crossfade（保留视频画面，只处理音频）
# Step 1: 提取两段视频的音频
ffmpeg -i shot1.mp4 -vn -acodec pcm_s16le shot1_audio.wav
ffmpeg -i shot2.mp4 -vn -acodec pcm_s16le shot2_audio.wav

# Step 2: 音频 crossfade（1秒交叉淡化）
ffmpeg -i shot1_audio.wav -i shot2_audio.wav \
  -filter_complex "acrossfade=d=1:c1=tri:c2=tri" \
  crossfade_audio.wav

# Step 3: 拼接视频画面 + 替换为 crossfade 后的音频
# （这部分在 Editor Agent 的 FFmpeg 拼接中统一处理）
```

### 方案 D：全局 BGM 桥接（增强）

在所有镜头的音频之上，铺一条全局 BGM（音量较低 -20dB）：
- BGM 是连续的，不会断裂
- 能遮盖 Seedance 自带音频在接缝处的微小不连贯
- 提供整体情绪基调

如果某些段自带音频，后期统一静音：

```bash
ffmpeg -i input.mp4 -an -c:v copy output_silent.mp4
```

### 方案 C：环境音统一铺底

如果需要环境氛围音（如雨声、风声、城市噪音），**全局铺一条统一的环境音轨**，而不是依赖每段视频自带的环境音：

```bash
# 全局环境音铺底（音量 -20dB，不干扰配音）
ffmpeg -i video_silent.mp4 -i ambience_rain.mp3 \
  -filter_complex "[1:a]volume=-20dB[amb];[0:a][amb]amix=inputs=2:duration=first" \
  -c:v copy output.mp4
```

---

## L2 解决方案：统一 BGM（不变）

全局铺一条 BGM 遮盖接缝，同时提供情绪基调。与方案 A 的环境音参考互不冲突。

```bash
# BGM 铺底（音量 -18dB）
ffmpeg -i video_silent.mp4 -i bgm.mp3 \
  -filter_complex "[1:a]volume=-18dB[bgm];[0:a][bgm]amix=inputs=2:duration=shortest" \
  -c:v copy -shortest output_with_bgm.mp4
```

### BGM 与配音的平衡

- 配音（人声）：0dB（主音轨）
- BGM：-18dB ~ -22dB（背景）
- 环境音效：-20dB ~ -25dB（氛围）

```bash
# 三轨混音：配音 + BGM + 环境音
ffmpeg -i video.mp4 -i voiceover.mp3 -i bgm.mp3 -i ambience.mp3 \
  -filter_complex "\
    [1:a]volume=0dB[voice];\
    [2:a]volume=-18dB[bgm];\
    [3:a]volume=-22dB[amb];\
    [0:a][voice][bgm][amb]amix=inputs=4:duration=first:dropout_transition=3" \
  -c:v copy output_final.mp4
```

---

## L3 解决方案：配音连贯性

### 问题根因

GLM-TTS 逐镜头独立生成，存在三个不连贯来源：
1. **音色差异**：同一次 TTS 调用通常一致，但不同 session 可能不同
2. **语速差异**：短文本 vs 长文本的语速可能不同
3. **情感差异**：没有上下文，每句都是"平静起手"

### 解决方案

#### 方案 1：统一 TTS 参数（基础）

所有镜头使用**同一个 voice preset + 同一个 speed**：

```typescript
// 所有镜头统一参数
const ttsOptions = {
  voice: "male-narrator",  // 固定音色
  speed: 1.0,             // 固定语速
};
```

#### 方案 2：情感标注（进阶）

Writer 在生成剧本时，为每句字幕标注情感：

```json
{
  "subtitle": "你看，这就是我们的新家。",
  "speaker": "narrator",
  "emotion": "warm",       // warm / tense / sad / excited / neutral
  "pace": "slow"           // slow / normal / fast
}
```

TTS 调用时根据情感微调 speed：

```typescript
const emotionSpeedMap = {
  warm: 0.9,
  tense: 1.1,
  sad: 0.85,
  excited: 1.15,
  neutral: 1.0,
};
```

#### 方案 3：段落内连贯合成（高级）

不是逐镜头单独合成，而是**按场景段落合并文本后一次性合成**：

```
场景 1（镜头 1-3）：
  "清晨的阳光洒进窗台，一只橘猫懒洋洋地伸了个懒腰。
   它跳下窗台，轻巧地落在柔软的地毯上。
   慢悠悠地走向厨房，尾巴微微摇摆。"
→ 一次性 TTS 合成为一段连续音频
→ 在后期按镜头时长切分
```

**优点**：语速、情感自然连贯，像真人说话
**缺点**：需要后期精确切分，对齐每个镜头

#### 方案 4：后期音频 crossfade（兜底）

即使逐镜头生成，在镜头切换处加音频 crossfade，消除硬切：

```bash
# 两段音频 crossfade（0.5秒交叉淡化）
ffmpeg -i shot1_audio.wav -i shot2_audio.wav \
  -filter_complex "acrossfade=d=0.5:c1=tri:c2=tri" \
  output_crossfade.wav
```

多段连续 crossfade（使用脚本）：

```bash
# N 段音频依次 crossfade
# 第一段 → 第二段（crossfade 0.3s）→ 第三段（crossfade 0.3s）→ ...
```

---

## 完整混音流程

### Phase A：素材生成（已有）

```
Writer → shots.json（含 emotion/pace 标注）
即梦 → 首帧/尾帧图片
Seedance → 视频片段（静音）
GLM-TTS → 每镜头配音
```

### Phase B：音频预处理

```
1. 所有 Seedance 视频静音处理（-an）
2. GLM-TTS 配音按镜头对齐时间轴
3. 准备统一 BGM（一首完整曲子）
4. 准备环境音效（可选）
```

### Phase C：混音合成

```
FFmpeg 多轨混音：
  - 视频轨：静音视频片段拼接（带转场）
  - 配音轨：GLM-TTS 音频按时间轴排列
  - BGM 轨道：全局铺底（-18dB）
  - 环境音轨：全局铺底（-22dB）
  - 转场处理：视频 crossfade + 音频 crossfade
```

### Phase D：最终输出

```
rough_cut.mp4 — 带配音 + BGM + 环境音的完整粗成片
```

---

## FFmpeg 混音模板

### 多视频片段拼接 + 多音频轨混音

```bash
# 输入
# - shot1.mp4, shot2.mp4, ... (静音视频)
# - voice1.wav, voice2.wav, ... (配音)
# - bgm.mp3 (背景音乐)
# - ambience.mp3 (环境音)

# Step 1: 拼接静音视频（带视频 crossfade 转场）
# Step 2: 拼接配音音频（带音频 crossfade）
# Step 3: 混音（配音 + BGM + 环境音）
# Step 4: 合并视频和混音
```

### 简化版（单命令）

```bash
# 假设视频已拼接为 video_silent.mp4
# 配音已拼接为 voiceover.wav

ffmpeg -i video_silent.mp4 -i voiceover.wav -i bgm.mp3 \
  -filter_complex "\
    [1:a]adelay=0|0[voice];\
    [2:a]volume=-18dB,afade=t=in:st=0:d=2,afade=t=out:st=55:d=2[bgm];\
    [voice][bgm]amix=inputs=2:duration=first[aout]" \
  -map 0:v -map "[aout]" \
  -c:v copy -c:a aac -b:a 192k \
  rough_cut.mp4
```

---

## 设计决策：我们的 Pipeline 采用什么方案？

### 推荐：方案 3（段落连贯合成）+ 方案 1（统一参数）+ 全局 BGM

| 层级 | 方案 | 理由 |
|------|------|------|
| Seedance 环境音 | **音频参考输入统一基底**（所有镜头共享同一条环境音） | 利用而非丢弃，Seedance 生成的音频匹配参考音 → 自然连贯 |
| Seedance 接缝 | 音频 crossfade（0.5-1s）+ 全局 BGM 遮盖 | 即使有微小差异也能平滑过渡 |
| 配音 | **按 sceneGroupId 合并 TTS** | 连贯性最好，语速自然 |
| BGM | 全局铺一条统一 BGM | 情绪一致 + 遮盖接缝 |
| 环境音 | 同场景共享环境音参考输入 | Seedance 匹配生成，基底一致 |
| 场景切换 | 转场镜头 + 环境音 crossfade | 不同场景间的声音自然过渡 |

### Writer 需要输出的额外字段

```json
{
  "shots": [{
    "id": "shot_1",
    "subtitle": "清晨的阳光洒进窗台",
    "speaker": "narrator",
    "emotion": "warm",
    "pace": "slow",
    "sceneGroupId": "scene_1"  // 同场景的镜头合并 TTS
  }]
}
```

- `emotion`: warm/tense/sad/excited/neutral
- `pace`: slow/normal/fast
- `sceneGroupId`: 同场景的镜头 ID 归为一组，合并文本后一次性 TTS

---

## 来源

- [Seedance 2.0 全能参考完全指南](https://adg.csdn.net/69a2877254b52172bc5e15b2.html) — 长视频拼接三条路径
- [Seedance 2.0 评测](https://zhuanlan.zhihu.com/p/2004299402022507617) — 多镜头衔接技巧
- [Videodance.cc 工作流](https://www.v2ex.com/t/1204043) — Seedance 音频参考输入
- [FFmpeg crossfade](https://superuser.com/questions/1363461/crossfade-many-audio-files-into-one-with-ffmpeg) — 多段音频交叉淡化

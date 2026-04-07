# kais-aigc-movie 评估体系

基于学术研究（GMI Cloud 6维评估、VideoScore、NTIRE 2025、CVPR 2025）和实战经验，
为漫剧制作工坊的每个阶段设计的质量评估指标和自动化检查方案。

## 评估维度总览

```
Writer → 图片生成 → 视频生成 → 后期混音 → 最终成片
  ↓         ↓          ↓          ↓          ↓
剧本质量  画面质量  视频+音频  混音质量   综合评分
```

---

## Stage 1: Writer（剧本质量评估）

### 自动检查（代码级）

| 指标 | 方法 | 阈值 | 说明 |
|------|------|------|------|
| JSON Schema 合规 | Zod 验证 | 100% | 所有字段符合类型定义 |
| 镜头数 | 计数 | 6-8 | 控制在合理范围 |
| 总时长 | 求和 duration | 45-60s | 不超不短 |
| 视觉提示词完整度 | 检查非空+长度 | >20字/条 | imagePrompt/lastFramePrompt 有实质内容 |
| 视频提示词格式 | 正则检查 @1 @2 | 必须包含 | videoPrompt 遵循首尾帧公式 |
| 首尾帧差异度 | 文本相似度 < 0.7 | 余弦相似度 | 首帧和尾帧描述要有明显变化 |
| 叙事连贯性 | 相邻镜头场景匹配 | 同 sceneGroupId | 相邻镜头应属于同一场景组 |
| 情感标注完整 | 检查 emotion/pace | 100% | 每个镜头都有标注 |

### AI 评估（GLM-5.1 评分）

| 维度 | 评分标准 | 权重 |
|------|---------|------|
| 剧情吸引力 | 0-10，故事是否有吸引力、开头是否抓人 | 25% |
| 角色一致性 | 0-10，角色描述是否前后矛盾 | 20% |
| 场景合理性 | 0-10，场景切换是否自然 | 20% |
| 镜头多样性 | 0-10，运镜/角度是否有变化 | 15% |
| 可拍摄性 | 0-10，AI 是否能准确生成描述的画面 | 20% |

**总分 = 各维度加权平均，≥ 7.0 通过，< 7.0 重写**

---

## Stage 2: 图片生成（即梦文生图质量评估）

### 自动检查（代码级）

| 指标 | 方法 | 阈值 | 说明 |
|------|------|------|------|
| 文件完整性 | 检查文件存在+大小 | >100KB | 确认图片成功下载 |
| 分辨率 | ffprobe/exif | ≥720p | 最低质量要求 |
| 首尾帧视觉差异 | CLIP 余弦相似度 | 0.5-0.85 | 太高=没变化，太低=不连贯 |
| CLIP 对齐度 | CLIP(imagePrompt, image) | >0.25 | 图片与 prompt 匹配度 |

### AI 评估（GLM-5.1 视觉分析）

| 维度 | 评分标准 | 权重 |
|------|---------|------|
| Prompt 匹配度 | 0-10，图片是否符合 imagePrompt 描述 | 30% |
| 美学质量 | 0-10，构图、色彩、光线是否专业 | 25% |
| 首尾帧连贯性 | 0-10，两帧是否属于同一场景同一时刻 | 25% |
| 角色一致性 | 0-10，相邻镜头角色外观是否一致 | 20% |

**首尾帧连贯性检查**：将首帧的尾帧和下一镜头的首帧做 CLIP 相似度，>0.7 为连贯。

---

## Stage 3: 视频生成（Seedance 质量评估）

基于 GMI Cloud 6 维评估框架 + VideoScore 5 维评估框架。

### 自动检查（代码级）

| 指标 | 方法 | 阈值 | 说明 |
|------|------|------|------|
| 文件完整性 | 检查文件存在+大小 | >500KB | 视频成功生成 |
| 时长 | ffprobe duration | 与 shot.duration 偏差 <2s | 时长匹配 |
| 分辨率 | ffprobe | ≥720p | 最低质量 |
| 编码 | ffprobe | H.264 | 兼容性 |
| 运动流畅度 | RAFT 光流 | 帧间位移平滑 | 无跳帧/卡顿 |
| 闪烁检测 | 帧间亮度方差 | 方差 < 5% | 无闪烁 |

### 多镜头连续性检查（关键）

| 指标 | 方法 | 说明 |
|------|------|------|
| 首帧匹配度 | CLIP(shot_N_last_frame, shot_N+1_first_frame) | 尾帧与下一镜头首帧的视觉匹配度 |
| 背景一致性 | DINO 特征余弦相似度 | 背景环境是否稳定 |
| 角色一致性 | 人脸特征匹配 | 跨镜头角色是否一致 |
| 音频基底一致性 | 音频特征余弦相似度 | 同场景音频是否连贯 |

### AI 评估（GLM-5.1 视频分析）

| 维度 | 评分标准 | 权重 | 对应学术指标 |
|------|---------|------|-----------|
| 运动自然度 | 0-10，动作是否物理合理、无扭曲 | 20% | Dynamic Degree |
| 背景一致性 | 0-10，背景是否稳定无突变 | 20% | Background Consistency |
| 角色一致性 | 0-10，角色外观是否跨帧一致 | 20% | Subject Consistency |
| 运动流畅度 | 0-10，运动是否平滑无卡顿 | 15% | Motion Smoothness |
| Prompt 匹配度 | 0-10，视频是否符合 videoPrompt | 15% | Text-Video Alignment |
| 音频质量 | 0-10，音效是否自然、无杂音 | 10% | Audio Quality |

---

## Stage 4: 后期混音（音频质量评估）

### 自动检查（代码级）

| 指标 | 方法 | 阈值 | 说明 |
|------|------|------|------|
| 音频存在性 | 检查音频轨 | 有音频 | 视频不是静音 |
| 音量范围 | ffmpeg volumedetect | -20dB ~ -6dB | 不爆音不静音 |
| 音量一致性 | 多段音频 RMS 对比 | 差异 < 3dB | 配音音量稳定 |
| 接缝检测 | 音频波形差异 | crossfade 区域波形连续 | 无硬切 |

### AI 评估（GLM-5.1 + 音频特征）

| 维度 | 评分标准 | 权重 |
|------|---------|------|
| 配音清晰度 | 0-10，人声是否清晰可辨 | 30% |
| 配音连贯性 | 0-10，语速/音色/情感是否连贯 | 25% |
| BGM 适配度 | 0-10，背景音乐是否匹配情绪 | 20% |
| 环境音自然度 | 0-10，环境音效是否自然 | 15% |
| 接缝平滑度 | 0-10，段与段之间过渡是否自然 | 10% |

---

## Stage 5: 最终成片（综合评估）

### 自动检查

| 指标 | 方法 | 阈值 |
|------|------|------|
| 总时长 | ffprobe | 45-60s |
| 分辨率 | ffprobe | ≥720p |
| 编码 | ffprobe | H.264 + AAC |
| 字幕存在 | 检查字幕轨 | 有字幕 |
| 音频多轨 | ffprobe | ≥2 轨（配音+BGM） |

### 综合评分卡

| 维度 | 权重 | 数据来源 |
|------|------|---------|
| 剧本质量 | 15% | Stage 1 评分 |
| 画面质量 | 25% | Stage 2 评分 |
| 视频质量 | 25% | Stage 3 评分 |
| 音频质量 | 20% | Stage 4 评分 |
| 连续性 | 15% | 跨镜头连续性指标 |

**总分 ≥ 7.0 → 通过交付**
**6.0-7.0 → 标记问题，人工审核决定**
**< 6.0 → 返回对应阶段修正**

---

## 实现方案

### 快速检查（每次生成后自动执行）

```bash
# 1. 文件完整性 + 技术规格
node pipeline.mjs --phase check --episode-dir ./episodes/xxx
```

输出：pass/fail for each check + overall score

### AI 评分（人工审核前自动执行）

```bash
# 2. GLM-5.1 视觉分析评分
node pipeline.mjs --phase evaluate --episode-dir ./episodes/xxx
```

输出：每个维度的 0-10 评分 + 总分 + 问题列表

### 人工审核（Phase B）

- 展示综合评分卡
- 标注问题镜头（低分项）
- 支持"修正此镜头"→ 重新生成单个镜头

---

## 关键技术：连续性检查的具体实现

### 首尾帧匹配（跨镜头连贯性核心）

```python
# 伪代码
for i in range(len(shots) - 1):
    last_frame = shots[i].lastFrame  # 当前镜头的尾帧
    first_frame = shots[i+1].firstFrame  # 下一镜头的首帧
    
    # 视觉相似度（应该中等，不能太高也不能太低）
    similarity = clip_similarity(last_frame, first_frame)
    if similarity < 0.3:
        warning(f"镜头{i}→{i+1} 视觉跳跃过大，可能不连贯")
    if similarity > 0.9:
        warning(f"镜头{i}→{i+1} 几乎相同，可能缺乏变化")
    # 理想范围：0.5-0.85
```

### 音频基底连贯性

```python
# 比较相邻镜头的 Seedance 自带音频特征
for i in range(len(shots) - 1):
    audio_i = extract_audio_features(shots[i].video)
    audio_j = extract_audio_features(shots[i+1].video)
    
    similarity = audio_cosine_similarity(audio_i, audio_j)
    if similarity < 0.5:
        warning(f"镜头{i}→{i+1} 音频基底差异大，可能需要 crossfade 加长")
```

---

## 评估驱动的工作流

```
生成 → 自动检查(fail?) → AI评分(低分?) → 问题定位 → 修正 → 重新评估
  ✅ pass              ⚠️ <7.0              ↓
                                            重新生成问题镜头
```

### 修正策略

| 问题 | 定位 | 修正方案 |
|------|------|---------|
| 图片与 prompt 不匹配 | Stage 2 CLIP 低分 | 重新生成该图片 |
| 首尾帧差异过大 | Stage 2 相似度 >0.9 | 调整 lastFramePrompt |
| 视频运动扭曲 | Stage 3 光流异常 | 调整 videoPrompt（加 avoid jitter）|
| 跨镜头不连贯 | Stage 3 连续性低 | 调整首尾帧使其更连贯 |
| 配音不连贯 | Stage 4 评分低 | 检查 sceneGroupId 合并 |
| 接缝硬切 | Stage 4 波形突变 | 加长 crossfade 时间 |

---

## 来源

- [GMI Cloud 6维评估框架](https://www.gmicloud.ai/blog/modelmatch-technical-overview) — 美学质量/背景一致性/动态度/成像质量/运动流畅度/主体一致性
- [VideoScore 5维评估](https://tiger-ai-lab.github.io/VideoScore/) — 视觉质量/时间一致性/动态度/文本对齐/事实一致性
- [AI视频质量评估综述 (MDPI)](https://www.mdpi.com/1424-8220/25/15/4668) — CNN+MLLM 评估方法对比
- [CVPR 2025 NTIRE](https://openaccess.thecvf.com/content/CVPR2025W/NTIRE/papers/) — LLM 多维评估模型
- [AI视频评估综述 (arXiv)](https://arxiv.org/html/2410.19884v1) — AIGVE 综合评估框架
- [Video Storyboarding 多镜头连贯性](https://arxiv.org/html/2412.07750v1) — Video Storyboarding 角色一致性方法

# 免费音乐库筛选指南

## 推荐音乐源（按优先级排序）

### 1. Pixabay Music ⭐ 首选
- **URL**: https://pixabay.com/music/
- **授权**: 免版税，商用无需署名，CC0
- **格式**: MP3
- **API**: 有官方 API（https://pixabay.com/api/docs/）
  - 免费注册获取 API Key
  - 100 次/分钟 限流
  - 搜索参数：q（关键词）、category、min_duration、max_duration
  - 返回 JSON，含 downloadURL
- **搜索方式**:
  - API: `GET https://pixabay.com/api/?key={KEY}&q=emotional+piano&category=music&min_duration=60`
  - 手动: 网站搜索 "emotional piano"、"suspense thriller"、"romantic acoustic"
- **优点**: 曲库大、API 稳定、质量高、完全免费
- **缺点**: API 不直接支持音乐搜索（仅图片/视频），音乐需网站手动下载或爬取

### 2. Free Music Archive (FMA)
- **URL**: https://freemusicarchive.org/
- **授权**: 多种许可证（CC0/CC-BY/CC-BY-NC），需逐曲检查
- **格式**: MP3
- **API**: 无官方 API，需爬取
- **优点**: 分类详细、独立音乐人多
- **缺点**: 许可证不统一，部分需署名

### 3. Mixkit
- **URL**: https://mixkit.co/free-stock-music/
- **授权**: 免版税，免费商用
- **格式**: MP3/WAV
- **API**: 无官方 API
- **优点**: 按情绪分类（Happy/Sad/Epic/Calm）、质量高
- **缺点**: 曲库相对较小

### 4. YouTube Audio Library
- **URL**: https://studio.youtube.com/channel/UC/music
- **授权**: 需 YouTube 创作者账号，免费使用
- **格式**: MP3
- **API**: 无
- **优点**: Google 出品，质量可靠
- **缺点**: 需要 YouTube 账号，无法 API 自动化

## 实际方案

### 推荐实现：Pixabay 网站搜索 + 手动下载

由于 Pixabay API 不直接支持音乐搜索，采用以下方案：

```typescript
// music-service.ts 实现思路

// 方案 A（推荐）：使用 web_search + web_fetch 搜索 Pixabay
// 1. 构造搜索 URL
// 2. 用 web_fetch 获取页面
// 3. 解析音乐列表（标题、时长、下载链接）

// 方案 B：直接构造 Pixabay 搜索 URL
// https://pixabay.com/music/search/{keywords}/
// 然后解析页面获取下载链接

// 方案 C：维护本地音乐库
// 预先下载一批高质量 BGM 到本地
// 按情绪/风格分类
// 每次生成时从中选择最匹配的
```

### 方案 C：本地音乐库（最稳定）⭐ 推荐

预建本地音乐库，按情绪分类，避免每次搜索的网络依赖。

```
skills/kais-aigc-movie/assets/music/
├── warm/          # 温暖、治愈
│   ├── piano_soft_01.mp3
│   └── acoustic_gentle_01.mp3
├── tense/         # 紧张、悬疑
│   ├── dark_suspense_01.mp3
│   └── thriller_heartbeat_01.mp3
├── sad/           # 悲伤、忧郁
│   ├── melancholy_piano_01.mp3
│   └── rain_cello_01.mp3
├── excited/       # 激动、欢快
│   ├── upbeat_pop_01.mp3
│   └── adventure_energetic_01.mp3
├── neutral/       # 平静、叙事
│   ├── ambient_calm_01.mp3
│   └── lofi_chill_01.mp3
└── index.json     # 音乐索引（名称、时长、情绪标签）
```

**index.json 格式**:
```json
[
  {
    "id": "piano_soft_01",
    "filename": "warm/piano_soft_01.mp3",
    "mood": ["warm", "neutral"],
    "genre": "piano",
    "duration": 120,
    "bpm": 70,
    "source": "pixabay",
    "sourceUrl": "https://pixabay.com/music/..."
  }
]
```

**使用流程**:
1. Writer 输出 musicStyle（如 { mood: "tense", genre: "electronic", bpm: "fast" }）
2. music-service.ts 根据 mood 匹配本地音乐
3. 如无匹配，用 web_search 搜索 Pixabay + 下载到对应目录 + 更新 index.json
4. FFmpeg 铺底（-18dB）

## 音乐选择标准

| 情绪 | 推荐风格 | BPM | 乐器 |
|------|---------|-----|------|
| warm | 钢琴/吉他、轻柔 | 60-80 | 钢琴、木吉他 |
| tense | 电子/管弦、紧张 | 100-140 | 合成器、弦乐 |
| sad | 钢琴/弦乐、忧郁 | 50-70 | 大提琴、钢琴 |
| excited | 流行/摇滚、欢快 | 120-160 | 鼓、贝斯、吉他 |
| neutral | 氛围/Lo-fi、平静 | 70-90 | 钢琴、合成器 |

## 首批音乐来源（待下载）

从 Pixabay 手动下载以下高质量 BGM：

1. **温暖**: 搜索 "soft piano emotional" → 选 3 首
2. **紧张**: 搜索 "dark suspense thriller" → 选 3 首
3. **悲伤**: 搜索 "sad melancholy cello" → 选 3 首
4. **激动**: 搜索 "upbeat energetic adventure" → 选 3 首
5. **平静**: 搜索 "ambient calm lofi" → 选 3 首

每首时长 ≥ 60s，MP3 格式，商用免费。

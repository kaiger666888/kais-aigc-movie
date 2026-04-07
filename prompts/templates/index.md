# Prompt 模板库

> 基于行业优秀案例提取的通用 prompt 模式，供 Writer sub-agent 使用和迭代升级。
> 来源：Gemini Nano Banana Pro 漫画 prompt、知乎 AI 短剧 prompt、Jellyfish 短剧工具、即梦官方提示词

## 模板格式

每个模板包含：
- `genre`: 题材类型
- `shotCount`: 推荐镜头数
- `duration`: 推荐总时长
- `characterProfileTemplate`: 角色描述模板
- `scenePromptTemplate`: 场景描述模板
- `stylePromptTemplate`: 风格描述模板（所有镜头统一）
- `videoPromptTemplate`: Seedance 视频提示词模板
- `cameraWork`: 推荐运镜列表
- `musicStyle`: 推荐 BGM 风格

---

## Template 1: 悬疑推理

```json
{
  "id": "suspense",
  "genre": "悬疑推理",
  "shotCount": 8,
  "duration": "45-60s",
  "characterProfileTemplate": "一位{年龄}的{职业}，{发型}，穿着{服装}，眼神{特征}，面部轮廓{描述}",
  "scenePromptTemplate": "场景提示词：{时间}的{地点}，{光线}，{氛围描述}，{关键道具}，{构图方式}",
  "stylePromptTemplate": "暗调电影风格，冷色调为主，高对比度，阴影层次丰富，景深效果突出，9:16竖屏构图",
  "videoPromptTemplate": "@1 @2 {角色动作}，{环境变化}，保持构图和色彩一致，镜头{运镜}，电影级质感，avoid jitter and bent limbs",
  "cameraWork": ["缓慢推进", "缓慢拉远", "缓慢平移", "低角度仰拍", "特写", "过肩镜头"],
  "musicStyle": { "mood": "tense", "genre": "electronic/orchestral", "bpm": "100-120" },
  "emotionProgression": ["neutral", "curious", "tense", "shocked", "resolved"],
  "example": {
    "character": "一位30岁的女侦探，黑色短发，穿着米色风衣，眼神锐利，面部轮廓分明",
    "scene": "深夜的废弃仓库，月光透过破窗照入，阴冷潮湿，散落的旧报纸，俯拍全景",
    "videoPrompt": "@1 @2 女侦探缓缓转身，手电筒光束划过墙壁，照亮角落里的线索，保持构图和色彩一致，镜头缓慢推进，电影级质感，avoid jitter and bent limbs"
  }
}
```

### 悬疑专用技巧
- **光线**：大量使用侧光、逆光、局部照明，营造阴影
- **构图**：偏好不对称构图，利用门框/窗户/镜子制造框架感
- **运镜**：缓慢为主，配合偶尔的快速推拉制造惊吓
- **色彩**：冷色调（蓝/灰/绿），关键线索用暖色点缀
- **节奏**：前半段慢节奏铺垫，后半段快速推进

---

## Template 2: 都市爱情

```json
{
  "id": "romance",
  "genre": "都市爱情",
  "shotCount": 8,
  "duration": "45-60s",
  "characterProfileTemplate": "一位{年龄}的{性别}，{发型}，穿着{时尚服装}，表情{特征}，{气质描述}",
  "scenePromptTemplate": "场景提示词：{时间}的{浪漫地点}，{光线}，{氛围描述}，{细节元素}，{构图方式}",
  "stylePromptTemplate": "日系胶片风格，暖色调柔和，低饱和度，柔和光线，梦幻虚化效果，9:16竖屏构图",
  "videoPromptTemplate": "@1 @2 {角色动作}，{环境互动}，保持构图和色彩一致，镜头{运镜}，唯美浪漫质感，avoid jitter and bent limbs",
  "cameraWork": ["缓慢推进", "侧面跟随", "俯拍", "特写（眼神/手部）", "逆光剪影", "缓慢拉远"],
  "musicStyle": { "mood": "warm", "genre": "piano/acoustic", "bpm": "60-80" },
  "emotionProgression": ["neutral", "happy", "warm", "tender", "romantic"],
  "example": {
    "character": "一位25岁的女生，及肩棕色卷发，穿着白色连衣裙，笑容温暖甜美，气质清新",
    "scene": "黄昏的咖啡馆露台，金色夕阳透过玻璃，花瓣飘落，咖啡杯冒着热气，中景构图",
    "videoPrompt": "@1 @2 女生轻轻端起咖啡杯，微风吹动头发，嘴角上扬，保持构图和色彩一致，镜头缓慢推进，唯美浪漫质感，avoid jitter and bent limbs"
  }
}
```

### 爱情专用技巧
- **光线**：黄金时段光线（日落前1小时）、柔光箱效果
- **构图**：大量使用特写（眼神、手部、嘴唇），利用前景虚化
- **运镜**：缓慢跟随、环绕、推近，避免快速切换
- **色彩**：暖色调（粉/橙/金），高光偏黄
- **节奏**：均匀节奏，高潮处用慢动作

---

## Template 3: 科普知识

```json
{
  "id": "education",
  "genre": "科普知识",
  "shotCount": 6,
  "duration": "45-60s",
  "characterProfileTemplate": "一位{年龄}的讲解者，{发型}，穿着{职业装}，表情{专业/亲切}，{气质描述}",
  "scenePromptTemplate": "场景提示词：{科学概念}的可视化场景，{环境描述}，{光线}，{信息图表/模型}，{构图方式}",
  "stylePromptTemplate": "扁平化插画风格，色彩鲜明饱满，简洁线条，信息图表元素融入，9:16竖屏构图",
  "videoPromptTemplate": "@1 @2 {知识演示动作}，{视觉效果变化}，保持构图和色彩一致，镜头{运镜}，清晰教学质感，avoid jitter and bent limbs",
  "cameraWork": ["缓慢推进", "俯拍全景", "特写（重点元素）", "平移展示", "固定机位"],
  "musicStyle": { "mood": "neutral", "genre": "lofi/ambient", "bpm": "70-90" },
  "emotionProgression": ["neutral", "curious", "amazed", "understanding"],
  "example": {
    "character": "一位30岁的科学讲解者，戴眼镜，短发利落，穿着白衬衫，表情专业而亲切",
    "scene": "太空站内部，蓝绿色全息投影展示太阳系模型，柔和LED灯光，信息图表元素，广角构图",
    "videoPrompt": "@1 @2 全息投影中的地球缓缓旋转，讲解者伸手指向月球，数据标注浮现，保持构图和色彩一致，镜头缓慢推进，清晰教学质感，avoid jitter and bent limbs"
  }
}
```

### 科普专用技巧
- **视觉**：信息图表、数据可视化、3D模型融入画面
- **节奏**：每个知识点停留 5-8 秒，配合字幕标注
- **运镜**：以固定机位+缓慢推进为主，避免花哨
- **色彩**：蓝色系（科技感）+ 亮色点缀（重点信息）

---

## Template 4: 奇幻冒险

```json
{
  "id": "fantasy",
  "genre": "奇幻冒险",
  "shotCount": 8,
  "duration": "45-60s",
  "characterProfileTemplate": "一位{年龄}的{角色类型}，{发型/特征}，穿着{奇幻装备}，{魔法/武器}，{气质描述}",
  "scenePromptTemplate": "场景提示词：{奇幻世界}的场景，{环境描述}，{魔法效果}，{光线}，{构图方式}",
  "stylePromptTemplate": "史诗奇幻插画风格，色彩绚丽，光影戏剧性，细节丰富，9:16竖屏构图",
  "videoPromptTemplate": "@1 @2 {角色冒险动作}，{魔法/环境效果变化}，保持构图和色彩一致，镜头{运镜}，史诗电影质感，avoid jitter and bent limbs",
  "cameraWork": ["航拍俯冲", "缓慢环绕", "快速推进", "低角度仰拍", "特写", "全景"],
  "musicStyle": { "mood": "excited", "genre": "orchestral/epic", "bpm": "100-140" },
  "emotionProgression": ["neutral", "wonder", "tense", "excited", "triumphant"],
  "example": {
    "character": "一位20岁的少年剑士，银色短发，穿着深蓝色铠甲，手持发光的长剑，眼神坚毅",
    "scene": "古老森林深处，巨大的发光蘑菇，萤火虫飞舞，魔法光束穿透树冠，仰拍构图",
    "videoPrompt": "@1 @2 少年拔出长剑，剑刃发出蓝光，萤火虫被光芒吸引聚拢，保持构图和色彩一致，镜头缓慢环绕，史诗电影质感，avoid jitter and bent limbs"
  }
}
```

### 奇幻专用技巧
- **光线**：戏剧性光源（魔法光、生物光、天体光）
- **特效**：粒子效果、光晕、雾气、魔法涟漪
- **运镜**：航拍+环绕为主，配合快速推拉制造冲击
- **色彩**：高饱和度，冷暖对比（魔法蓝 vs 暖色场景）

---

## Template 5: 职场励志

```json
{
  "id": "workplace",
  "genre": "职场励志",
  "shotCount": 6,
  "duration": "45-60s",
  "characterProfileTemplate": "一位{年龄}的职场人，{发型}，穿着{商务装}，表情{特征}，{气质描述}",
  "scenePromptTemplate": "场景提示词：{职场环境}，{时间}，{光线}，{氛围描述}，{道具细节}，{构图方式}",
  "stylePromptTemplate": "现代商业摄影风格，明亮清爽，自然光为主，简洁构图，9:16竖屏构图",
  "videoPromptTemplate": "@1 @2 {角色工作动作}，{环境互动}，保持构图和色彩一致，镜头{运镜}，专业质感，avoid jitter and bent limbs",
  "cameraWork": ["中景", "特写", "过肩镜头", "缓慢推进", "固定机位"],
  "musicStyle": { "mood": "neutral", "genre": "upbeat/corporate", "bpm": "80-100" },
  "emotionProgression": ["frustrated", "determined", "working", "breakthrough", "confident"],
  "example": {
    "character": "一位28岁的女性产品经理，黑色马尾，穿着白色衬衫+黑色西装外套，眼神坚定",
    "scene": "现代办公室落地窗前，晨光洒入，笔记本电脑屏幕亮着数据报表，咖啡杯旁放着笔记本，侧光构图",
    "videoPrompt": "@1 @2 她紧盯着屏幕，突然露出微笑，快速敲击键盘，窗外阳光逐渐明亮，保持构图和色彩一致，镜头缓慢推进，专业质感，avoid jitter and bent limbs"
  }
}
```

---

## 通用 Prompt 模式提取

### 角色描述公式
```
一位{年龄}的{性别/职业}，{发型}+{发色}，穿着{服装}，{面部特征}，{气质/性格描述}
```

### 场景描述公式
```
{时间}的{地点}，{光线描述}，{氛围关键词}，{关键道具}，{构图方式}
```

### 首帧→尾帧变化公式
```
首帧：{初始状态}（角色位置A，表情X，光线M）
尾帧：{结束状态}（角色位置B，表情Y，光线N）
变化：位置移动 + 表情转变 + 光线变化（至少2项有明显变化）
```

### Seedance VideoPrompt 公式
```
@1 @2 {核心动作}，{环境微变化}，保持构图和色彩一致，镜头{单个运镜}，{风格词}，avoid jitter and bent limbs
```

### 运镜选择原则
- **推进**：角色做出重要决定、发现关键信息
- **拉远**：揭示全景、场景转换、结尾收束
- **平移**：展示环境、角色移动
- **环绕**：展示360°场景、角色站在场景中心
- **特写**：情绪高潮、关键道具、眼神变化
- **固定**：对话、文字说明、需要稳定画面

---

## 参考来源

- [Gemini Nano Banana Pro 漫画 Prompt 合集](https://docs.mew.design/blog/gemini-nano-banana-pro-manga-prompts/) — 20+ 漫画/角色/分镜 prompt
- [知乎：AI短剧官方 Prompt 教程](https://zhuanlan.zhihu.com/p/1893351501025489868) — 从故事概要到分镜到提示词的完整流程
- [Jellyfish 一站式 AI 短剧工具](https://github.com/Forget-C/Jellyfish) — 角色/场景/道具一致性管理 + 提示词模板
- [CSDN：AI漫剧分镜提示词模板](https://blog.csdn.net/luluoluoa/article/details/150589759) — Coze 工作流 + 批量出图 prompt
- [OpenArt：Midjourney 漫画风格 Prompt](https://openart.ai/blog/post/midjourney-prompts-for-comic-style) — 25 个漫画风格 prompt

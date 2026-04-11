# kais-aigc-movie — AI 短片制作全流程

基于 [kais-jimeng](https://github.com/kaiger666888/kais-jimeng) 的 AI 短片制作技能，提供从脚本到成片的一站式流程。

## 功能

- 📝 **分镜脚本生成** — 主题 → 结构化分镜 JSON
- 🎨 **素材生成** — 每个场景自动生成图片素材
- 🎬 **视频生成** — Seedance 素材 → 视频片段
- ✂️ **后期合成** — 拼接、转场、字幕
- 📤 **一键发布** — 聊天发送 / B 站上传

## 依赖

- [kais-jimeng](https://github.com/kaiger666888/kais-jimeng) — 即梦 API
- ffmpeg — 视频处理

## 安装

```bash
# OpenClaw 一键安装
clawhub install kais-aigc-movie

# 或手动
git clone https://github.com/kaiger666888/kais-aigc-movie.git
cp -r kais-aigc-movie ~/.openclaw/workspace/skills/
```

## 使用示例

```
用户: "帮我做一个 30 秒的 AI 短片，主题是赛博朋克城市"
→ 自动执行: 确认需求 → 生成分镜 → 生成素材 → Seedance 视频 → 合成 → 交付
```

## 项目结构

```
kais-aigc-movie/
├── SKILL.md           # 技能定义
├── README.md          # 说明文档
├── CHANGELOG.md       # 变更记录
└── scripts/
    ├── concat.sh      # 视频拼接
    ├── xfade.sh       # 转场效果
    └── subtitle.sh    # 字幕叠加
```

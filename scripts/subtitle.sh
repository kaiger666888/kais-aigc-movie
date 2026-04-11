#!/usr/bin/env bash
set -euo pipefail

# AI短片字幕叠加脚本
# 用法: bash subtitle.sh <视频文件> <SRT字幕文件> [输出文件]

INPUT="${1:?用法: subtitle.sh <视频> <字幕.srt> [输出.mp4]}"
SRT="${2:?}"
OUTPUT="${3:-${INPUT%.mp4}_subtitled.mp4}"

ffmpeg -y -i "$INPUT" -vf "subtitles='$SRT':force_style='FontName=Noto Sans CJK SC,FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2'" -c:a copy "$OUTPUT"
echo "✅ 字幕版: $OUTPUT"

#!/usr/bin/env bash
set -euo pipefail

# AI短片拼接脚本
# 用法: bash concat.sh <项目目录>

PROJECT_DIR="${1:?用法: concat.sh <项目目录>}"
CLIPS_DIR="$PROJECT_DIR/clips"
OUTPUT="$PROJECT_DIR/final.mp4"
CONCAT_FILE="$PROJECT_DIR/concat.txt"

# 生成 concat 文件
> "$CONCAT_FILE"
for f in "$CLIPS_DIR"/scene_*.mp4; do
  [ -f "$f" ] && echo "file '$f'" >> "$CONCAT_FILE"
done

echo "拼接 $(wc -l < "$CONCAT_FILE") 个片段..."
ffmpeg -y -f concat -safe 0 -i "$CONCAT_FILE" -c copy "$OUTPUT"
echo "✅ 成片: $OUTPUT"

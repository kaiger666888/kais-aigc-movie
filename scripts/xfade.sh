#!/usr/bin/env bash
set -euo pipefail

# AI短片转场脚本
# 用法: bash xfade.sh <项目目录> [转场类型] [转场时长]
# 转场类型: fade, slideleft, slideup, circleopen, dissolve

PROJECT_DIR="${1:?用法: xfade.sh <项目目录>}"
TRANSITION="${2:-fade}"
DURATION="${3:-0.5}"

CLIPS_DIR="$PROJECT_DIR/clips"
OUTPUT="$PROJECT_DIR/final.mp4"

# 收集片段
mapfile -t clips < <(find "$CLIPS_DIR" -name "scene_*.mp4 | sort -V")
CLIP_COUNT=${#clips[@]}

if [ "$CLIP_COUNT" -lt 2 ]; then
  echo "至少需要2个片段"
  exit 1
fi

echo "使用 $TRANSITION 转场拼接 $CLIP_COUNT 个片段..."

# 构建 ffmpeg 命令
INPUT_ARGS=""
FILTER=""
for i in "${!clips[@]}"; do
  INPUT_ARGS+=" -i '${clips[$i]}'"
done

# 简单方案：用 xchain 滤镜
python3 -c "
import subprocess, json
clips = sorted(__import__('glob').glob('${CLIPS_DIR}/scene_*.mp4'))
if len(clips) < 2:
    print('至少需要2个片段'); exit(1)
inputs = ' '.join(f'-i {c}' for c in clips)
n = len(clips)
dur = ${DURATION}
filter_parts = []
offset = 0
for i in range(n - 1):
    clip_dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', clips[i]]))
    offset += clip_dur - dur
    filter_parts.append(f'[{i}:v][{i+1}:v]xfade=transition=${TRANSITION}:duration={dur}:offset={offset}[v{i}]')
filter_str = ';'.join(filter_parts)
cmd = f'ffmpeg -y {inputs} -filter_complex \"{filter_str}\" -map \"[v{n-2}]\" -c:v libx264 \"{OUTPUT}\"'
subprocess.run(cmd, shell=True)
print(f'✅ 成片: ${OUTPUT}')
"

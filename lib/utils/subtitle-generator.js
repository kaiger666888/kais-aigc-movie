/**
 * SRT subtitle generator.
 *
 * Generates SRT subtitle files from shot data with proper timing.
 */
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatSrtTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return (`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:` +
        `${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`);
}
/**
 * Generate SRT subtitle content from shots.
 *
 * @param shots - Array of shots with subtitle text and duration
 * @param audioDurations - Optional map of shot.id → actual audio duration in seconds.
 *                         If provided, uses real audio duration instead of shot.duration.
 * @param options - Subtitle generation options
 * @returns SRT file content string
 */
export function generateSRT(shots, audioDurations, options) {
    const padding = options?.padding ?? 0.1;
    const lines = [];
    let timeOffset = 0;
    let index = 1;
    for (const shot of shots) {
        if (!shot.subtitle) {
            timeOffset += shot.duration ?? 5;
            continue;
        }
        const duration = audioDurations?.get(shot.id) ?? shot.duration ?? 5;
        const start = timeOffset + padding;
        const end = timeOffset + duration - padding;
        if (end <= start) {
            timeOffset += duration;
            continue;
        }
        lines.push(`${index}`);
        lines.push(`${formatSrtTime(start)} --> ${formatSrtTime(end)}`);
        lines.push(shot.subtitle);
        lines.push("");
        index++;
        timeOffset += duration;
    }
    return lines.join("\n");
}
/**
 * Generate ASS subtitle content with styling.
 */
export function generateASS(shots, audioDurations, options) {
    const padding = options?.padding ?? 0.1;
    const header = [
        "[Script Info]",
        "Title: AI Comic Drama",
        "ScriptType: v4.00+",
        "PlayResX: 1080",
        "PlayResY: 1920",
        "WrapStyle: 0",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Default,Microsoft YaHei,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,20,20,40,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ];
    const events = [];
    let timeOffset = 0;
    for (const shot of shots) {
        if (!shot.subtitle) {
            timeOffset += shot.duration ?? 5;
            continue;
        }
        const duration = audioDurations?.get(shot.id) ?? shot.duration ?? 5;
        const start = timeOffset + padding;
        const end = timeOffset + duration - padding;
        if (end <= start) {
            timeOffset += duration;
            continue;
        }
        const startStr = formatAssTime(start);
        const endStr = formatAssTime(end);
        events.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${shot.subtitle}`);
        timeOffset += duration;
    }
    return [...header, ...events].join("\n");
}
function formatAssTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);
    return `${String(h).padStart(1, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
//# sourceMappingURL=subtitle-generator.js.map
/**
 * Visual style consistency manager.
 *
 * Saves and retrieves style reference images to maintain
 * a uniform visual style across all shots.
 */

import { mkdir, copyFile, access } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// StyleManager
// ---------------------------------------------------------------------------

export class StyleManager {
  /**
   * Save a style reference image for future image-to-image calls.
   * @returns The saved file path.
   */
  async saveStyleRef(
    sourceImagePath: string,
    outputDir: string,
  ): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const destPath = join(outputDir, "style_ref.png");
    await copyFile(sourceImagePath, destPath);
    return destPath;
  }

  /**
   * Get the style reference image path for an episode.
   */
  getStyleRefPath(episodeDir: string): string {
    return join(episodeDir, "assets", "style_ref.png");
  }

  /**
   * Check if a style reference image exists.
   */
  async hasStyleRef(episodeDir: string): Promise<boolean> {
    try {
      await access(this.getStyleRefPath(episodeDir));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build a style description suffix to append to image prompts.
   * @param style - Visual style name (comic, realistic, watercolor, etc.)
   */
  buildStylePromptSuffix(style: string): string {
    const styleMap: Record<string, string> = {
      comic: "日式漫画风，清晰线条，平涂上色，暖色调",
      realistic: "写实摄影风格，电影级质感，自然光线",
      watercolor: "水彩画风格，柔和边缘，淡雅色彩",
      anime: "日式动画风格，赛璐璐上色，鲜艳色彩",
      pixel: "像素艺术风格，复古游戏感",
    };
    return styleMap[style] ?? `${style}风格`;
  }
}

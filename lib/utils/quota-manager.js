/**
 * Quota / credit tracking for Jimeng and Seedance.
 *
 * Jimeng: ~1 credit per text-to-image, ~66 free credits/day.
 * Seedance: TBD (higher cost per video).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const JIMENG_CREDITS_PER_IMAGE = 1;
const JIMENG_DAILY_FREE = 66;
const SEEDANCE_CREDITS_PER_VIDEO = 5; // placeholder
// ---------------------------------------------------------------------------
// QuotaManager
// ---------------------------------------------------------------------------
export class QuotaManager {
    episodesDir;
    used = { jimeng: 0, seedance: 0 };
    constructor(episodesDir) {
        this.episodesDir = episodesDir;
    }
    // ---- Estimation ----
    /**
     * Estimate credits needed for an episode.
     * @param shotCount - Number of shots
     * @param firstFrameOnly - If true, only first frames (not first+last per shot)
     */
    estimateCredits(shotCount, firstFrameOnly = false) {
        const imagesPerShot = firstFrameOnly ? 1 : 2;
        const jimengNeeded = shotCount * imagesPerShot * JIMENG_CREDITS_PER_IMAGE;
        const seedanceNeeded = shotCount * SEEDANCE_CREDITS_PER_VIDEO;
        const total = jimengNeeded + seedanceNeeded;
        const jimengRemaining = JIMENG_DAILY_FREE - this.used.jimeng;
        return {
            jimengCreditsNeeded: jimengNeeded,
            seedanceCreditsNeeded: seedanceNeeded,
            totalCreditsNeeded: total,
            canAfford: jimengNeeded <= jimengRemaining,
            reason: jimengNeeded > jimengRemaining
                ? `Need ${jimengNeeded} Jimeng credits but only ${jimengRemaining} remaining today.`
                : undefined,
        };
    }
    /** Check if there are enough credits for the planned generation. */
    checkQuota(estimate) {
        if (!estimate.canAfford) {
            throw new Error(`[Quota] Insufficient credits: ${estimate.reason}`);
        }
    }
    // ---- Recording ----
    /** Record credits used after generation. */
    recordUsage(jimengCredits, seedanceCredits) {
        this.used.jimeng += jimengCredits;
        this.used.seedance += seedanceCredits;
    }
    /** Save cost report for an episode. */
    async saveCostReport(episodeDir, jimengUsed, seedanceUsed) {
        await mkdir(episodeDir, { recursive: true });
        const report = {
            jimengCreditsUsed: jimengUsed,
            seedanceCreditsUsed: seedanceUsed,
            totalCreditsUsed: jimengUsed + seedanceUsed,
            estimatedCreditsNeeded: 0, // filled by caller
            timestamp: new Date().toISOString(),
        };
        await writeFile(join(episodeDir, "cost.json"), JSON.stringify(report, null, 2), "utf-8");
    }
    /** Load cost report for an episode. */
    async loadCostReport(episodeDir) {
        try {
            const data = await readFile(join(episodeDir, "cost.json"), "utf-8");
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=quota-manager.js.map
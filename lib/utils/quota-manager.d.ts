/**
 * Quota / credit tracking for Jimeng and Seedance.
 *
 * Jimeng: ~1 credit per text-to-image, ~66 free credits/day.
 * Seedance: TBD (higher cost per video).
 */
export interface QuotaSnapshot {
    jimengCreditsUsed: number;
    seedanceCreditsUsed: number;
    jimengCreditsRemaining: number;
    seedanceCreditsRemaining: number;
    timestamp: string;
}
export interface CreditEstimate {
    jimengCreditsNeeded: number;
    seedanceCreditsNeeded: number;
    totalCreditsNeeded: number;
    canAfford: boolean;
    reason?: string;
}
export declare class QuotaManager {
    private episodesDir;
    private used;
    constructor(episodesDir: string);
    /**
     * Estimate credits needed for an episode.
     * @param shotCount - Number of shots
     * @param firstFrameOnly - If true, only first frames (not first+last per shot)
     */
    estimateCredits(shotCount: number, firstFrameOnly?: boolean): CreditEstimate;
    /** Check if there are enough credits for the planned generation. */
    checkQuota(estimate: CreditEstimate): void;
    /** Record credits used after generation. */
    recordUsage(jimengCredits: number, seedanceCredits: number): void;
    /** Save cost report for an episode. */
    saveCostReport(episodeDir: string, jimengUsed: number, seedanceUsed: number): Promise<void>;
    /** Load cost report for an episode. */
    loadCostReport(episodeDir: string): Promise<QuotaSnapshot | null>;
}
//# sourceMappingURL=quota-manager.d.ts.map
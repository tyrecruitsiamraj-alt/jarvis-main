import { bangkokBusinessDateYmd } from './businessDate.js';
import { recalculateRiskScores } from './driverCareRisk.js';

export type ScheduledRecalcResult = {
  ok: boolean;
  scoreDate: string;
  recalculated: number;
  error?: string;
};

/**
 * Callable from a future Vercel Cron / external scheduler.
 * Wire with DRIVER_CARE_CRON_SECRET when exposing a dedicated cron route.
 */
export async function runScheduledDriverCareRecalculation(
  scoreDate?: string,
): Promise<ScheduledRecalcResult> {
  const date = scoreDate?.trim() || bangkokBusinessDateYmd();
  try {
    const recalculated = await recalculateRiskScores(date);
    return { ok: true, scoreDate: date, recalculated };
  } catch (e) {
    return {
      ok: false,
      scoreDate: date,
      recalculated: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

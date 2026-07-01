import { dbQuery } from './postgres.js';
import { bangkokBusinessDateYmd } from './businessDate.js';
import { DomainError } from './domainErrors.js';
import { riskT } from './driverCareRisk.js';

export type DriverCareReadMeta = {
  scoreDate: string | null;
  businessDate: string;
  hasScores: boolean;
  needsRecalculation: boolean;
};

async function countScoresForDate(scoreDate: string): Promise<number> {
  const { rows } = await dbQuery<{ cnt: string }>(
    `select count(*)::text as cnt from ${riskT} where score_date = $1::date`,
    [scoreDate],
  );
  return Number(rows[0]?.cnt || 0);
}

async function latestScoreDateOnOrBefore(upperBound: string): Promise<string | null> {
  const { rows } = await dbQuery<{ score_date: string }>(
    `select score_date::text
     from ${riskT}
     where score_date <= $1::date
     order by score_date desc
     limit 1`,
    [upperBound],
  );
  return rows[0]?.score_date ?? null;
}

/** Read-only: resolve which score_date to display (never recalculates). */
export async function resolveReadScoreDate(requestedDate?: string): Promise<DriverCareReadMeta> {
  const businessDate = bangkokBusinessDateYmd();

  if (requestedDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      throw new DomainError(400, 'Bad request', 'scoreDate must be YYYY-MM-DD');
    }
    const count = await countScoresForDate(requestedDate);
    return {
      scoreDate: count > 0 ? requestedDate : null,
      businessDate,
      hasScores: count > 0,
      needsRecalculation: count === 0 && requestedDate === businessDate,
    };
  }

  const todayCount = await countScoresForDate(businessDate);
  if (todayCount > 0) {
    return {
      scoreDate: businessDate,
      businessDate,
      hasScores: true,
      needsRecalculation: false,
    };
  }

  const latest = await latestScoreDateOnOrBefore(businessDate);
  if (latest) {
    return {
      scoreDate: latest,
      businessDate,
      hasScores: true,
      needsRecalculation: latest < businessDate,
    };
  }

  return {
    scoreDate: null,
    businessDate,
    hasScores: false,
    needsRecalculation: true,
  };
}

export function emptyOverviewMetrics() {
  return {
    activeDrivers: 0,
    highRisk: 0,
    mediumRisk: 0,
    watchRisk: 0,
    lowRisk: 0,
    pendingAction: 0,
    inProgressAction: 0,
    overdueAction: 0,
  };
}

export function emptyOverviewPayload(meta: DriverCareReadMeta) {
  return {
    ...meta,
    metrics: emptyOverviewMetrics(),
    riskByLevel: ['high', 'medium', 'watch', 'low'].map((level) => ({ level, count: 0 })),
    topSites: [] as { siteName: string; count: number }[],
    topReasons: [] as { reason: string; count: number }[],
    actionStatus: ['pending', 'in_progress', 'closed'].map((status) => ({ status, count: 0 })),
  };
}

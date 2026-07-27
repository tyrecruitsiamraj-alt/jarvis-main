/**
 * Background precompute worker — consumer-queue pattern
 *
 * Scanner loop: ทุก MATCH_PRECOMPUTE_INTERVAL_MS → scan ใบขอเปิดทั้งหมด
 *               → เพิ่ม missing / stale ลง shared queue (ไม่มี batch limit)
 *
 * Consumer loop: drain queue ต่อเนื่อง + throttle ทีละใบ
 *                → sleep 2s เมื่อ queue ว่าง แล้ว poll ใหม่
 *
 * HTTP handlers เรียก enqueuePrecomputeJobs() ได้เพื่อ push งานเข้า queue ทันที
 * (เช่น หลัง fetch matching list) → ผล AI พร้อมก่อน user กดเปิด job card
 *
 * รันเฉพาะใน process API on-prem (server/local-api.ts)
 * ปิดโดยค่าเริ่มต้น เปิดด้วย MATCH_PRECOMPUTE_ENABLED=true เท่านั้น
 */
import { getSiamrajSqlServerConfig } from './siamrajSqlServer.js';
import { getOllamaConfig } from './ollamaClient.js';
import { listSiamrajUnitRequests, isSiamrajUnitRequestsEnabled } from './siamrajUnitRequests.js';
import { loadBoardMatchTierMap, getStoredBoardMatch, type BoardMatchTierEntry } from './boardMatchStore.js';
import { matchBoardCandidatesForJob } from './boardCandidateMatcher.js';
import { logInfo, logWarn, logError } from './logger.js';

export type PrecomputeJob = Record<string, unknown> & { id: string };

// ─── Shared queue ─────────────────────────────────────────────────────────────
// Map preserves insertion order → FIFO. Dedupes by job ID.
type QueueEntry = { job: PrecomputeJob; refresh: boolean };
const queue = new Map<string, QueueEntry>();

function enqueue(items: Array<{ job: PrecomputeJob; refresh: boolean }>): number {
  let added = 0;
  for (const { job, refresh } of items) {
    const id = typeof job.id === 'string' ? job.id.trim() : '';
    if (!id || queue.has(id)) continue;
    queue.set(id, { job, refresh });
    added++;
  }
  return added;
}

// ─── Priority ─────────────────────────────────────────────────────────────────
// 0 = highest (SLA exceeded urgent) … 5 = lowest (normal advance)
function priorityScore(job: Record<string, unknown>): number {
  const isUrgent = String(job.urgency || '').trim() === 'urgent';
  const reqDate = String(job.required_date || '');
  const todayMs = Date.now();
  const reqMs = reqDate ? new Date(reqDate).getTime() : NaN;
  const isOverdue = Number.isFinite(reqMs) && reqMs < todayMs;
  const daysUntil = Number.isFinite(reqMs) ? Math.floor((reqMs - todayMs) / 86_400_000) : 999;

  if (isUrgent && isOverdue) return 0;      // ด่วน + SLA เกินแล้ว
  if (isUrgent && daysUntil <= 3) return 1; // ด่วน + เสี่ยง (≤ 3 วัน)
  if (isUrgent) return 2;                   // ด่วนอื่น
  if (isOverdue) return 3;                  // ไม่ด่วน แต่ SLA เกิน
  if (daysUntil <= 7) return 4;             // ใกล้กำหนด
  return 5;
}

function sortByPriority(
  items: Array<{ job: PrecomputeJob; refresh: boolean }>,
): Array<{ job: PrecomputeJob; refresh: boolean }> {
  return [...items].sort((a, b) => {
    const diff = priorityScore(a.job) - priorityScore(b.job);
    if (diff !== 0) return diff;
    // เรียง required_date ASC (เกินก่อน หรือใกล้สุดก่อน) ภายในกลุ่มเดียวกัน
    const da = String(a.job.required_date || '');
    const db = String(b.job.required_date || '');
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

/**
 * Push jobs into the precompute queue proactively.
 * Call from HTTP handlers after fetching unit requests so AI results are
 * ready before the user opens a job card.
 * Jobs are inserted in SLA/urgency priority order so the most critical
 * cards get their AI results first.
 */
export function enqueuePrecomputeJobs(
  jobs: Array<Record<string, unknown> & { id: string }>,
): void {
  if (!workerStarted) return;
  const sorted = sortByPriority(
    jobs.map((job) => ({ job: job as PrecomputeJob, refresh: false })),
  );
  const added = enqueue(sorted);
  if (added > 0) logInfo('match-precompute.push', { added, queueSize: queue.size });
}

// ─── selectPrecomputeQueue (kept for existing tests) ─────────────────────────
export type PrecomputePlan = {
  queue: PrecomputeJob[];
  missing: number;
  stale: number;
};

export function selectPrecomputeQueue(
  jobs: PrecomputeJob[],
  tierMap: Map<string, BoardMatchTierEntry>,
  opts: { staleMs: number; batch: number; nowMs: number },
): PrecomputePlan {
  const missing: PrecomputeJob[] = [];
  const stale: Array<{ job: PrecomputeJob; age: number }> = [];

  for (const job of jobs) {
    const id = typeof job.id === 'string' ? job.id.trim() : '';
    if (!id) continue;
    const entry = tierMap.get(id);
    if (!entry) {
      missing.push(job);
      continue;
    }
    if (opts.staleMs > 0) {
      const computedMs = new Date(entry.computedAt).getTime();
      const age = opts.nowMs - computedMs;
      if (Number.isFinite(computedMs) && age >= opts.staleMs) stale.push({ job, age });
    }
  }

  stale.sort((a, b) => b.age - a.age);
  const result = [...missing, ...stale.map((s) => s.job)].slice(0, Math.max(0, opts.batch));
  return { queue: result, missing: missing.length, stale: stale.length };
}

// ─── Config ───────────────────────────────────────────────────────────────────
type WorkerConfig = {
  scanIntervalMs: number;
  throttleMs: number;
  staleMs: number;
  scanLimit: number;
  startupDelayMs: number;
};

function parseIntEnv(raw: string | undefined, def: number, min: number): number {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.floor(n));
}

function isEnabled(): boolean {
  const v = String(process.env.MATCH_PRECOMPUTE_ENABLED || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function readConfig(): WorkerConfig {
  return {
    scanIntervalMs: parseIntEnv(process.env.MATCH_PRECOMPUTE_INTERVAL_MS, 300_000, 10_000),
    throttleMs: parseIntEnv(process.env.MATCH_PRECOMPUTE_THROTTLE_MS, 2_000, 0),
    staleMs: parseIntEnv(process.env.MATCH_PRECOMPUTE_STALE_HOURS, 0, 0) * 3_600_000,
    scanLimit: parseIntEnv(process.env.MATCH_PRECOMPUTE_SCAN_LIMIT, 2000, 1),
    startupDelayMs: parseIntEnv(process.env.MATCH_PRECOMPUTE_STARTUP_DELAY_MS, 15_000, 0),
  };
}

function gatesOk(): boolean {
  return isSiamrajUnitRequestsEnabled() && !!getSiamrajSqlServerConfig() && !!getOllamaConfig();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}

// Sleeps in 1-second chunks so the loop can react to isStopped() quickly
async function sleepInterruptible(ms: number, isStopped: () => boolean): Promise<void> {
  const end = Date.now() + ms;
  while (!isStopped() && Date.now() < end) {
    await sleep(Math.min(1_000, end - Date.now()));
  }
}

// ─── Scanner loop ─────────────────────────────────────────────────────────────
async function runScan(cfg: WorkerConfig): Promise<void> {
  if (!gatesOk()) {
    logWarn('match-precompute.scan.skip');
    return;
  }

  try {
    const [jobs, tierMap] = await Promise.all([
      listSiamrajUnitRequests({ limit: cfg.scanLimit, mode: 'all' }) as Promise<PrecomputeJob[]>,
      loadBoardMatchTierMap(),
    ]);

    const nowMs = Date.now();
    const items: Array<{ job: PrecomputeJob; refresh: boolean }> = [];

    for (const job of jobs) {
      const id = typeof job.id === 'string' ? job.id.trim() : '';
      if (!id) continue;
      const entry = tierMap.get(id);
      if (!entry) {
        items.push({ job, refresh: false });
      } else if (cfg.staleMs > 0) {
        const age = nowMs - new Date(entry.computedAt).getTime();
        if (Number.isFinite(age) && age >= cfg.staleMs) items.push({ job, refresh: true });
      }
    }

    const missing = items.filter((i) => !i.refresh).length;
    const stale = items.filter((i) => i.refresh).length;
    const added = enqueue(items);
    // scanOpen/dbStored = what the DB scanner sees (may differ from HTTP-pushed queue)
    logInfo('match-precompute.scan', {
      scanOpen: jobs.length,      // ใบขอเปิดที่ scanner เห็นจาก DB
      dbStored: tierMap.size,     // ผลที่เคยบันทึกใน board_match_results
      scanMissing: missing,       // scanner-discovered ที่ยังไม่มีผล
      scanStale: stale,
      scanEnqueued: added,        // scanner เพิ่มเข้า queue รอบนี้
      queueTotal: queue.size,     // queue ทั้งหมด รวม HTTP-push ด้วย
    });
  } catch (e) {
    logError('match-precompute.scan.fail', {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

async function scannerLoop(cfg: WorkerConfig, isStopped: () => boolean): Promise<void> {
  await sleep(cfg.startupDelayMs);
  while (!isStopped()) {
    await runScan(cfg);
    await sleepInterruptible(cfg.scanIntervalMs, isStopped);
  }
}

// ─── Consumer loop ─────────────────────────────────────────────────────────────
async function consumerLoop(cfg: WorkerConfig, isStopped: () => boolean): Promise<void> {
  logInfo('match-precompute.consumer.ready');
  let loggedIdle = false;
  let totalProcessed = 0;
  let totalStored = 0;
  let totalFailed = 0;

  while (!isStopped()) {
    if (queue.size === 0) {
      if (!loggedIdle) {
        logInfo('match-precompute.idle', { totalProcessed, totalStored, totalFailed });
        loggedIdle = true;
      }
      await sleep(2_000);
      continue;
    }
    loggedIdle = false;

    if (!gatesOk()) {
      await sleep(10_000);
      continue;
    }

    // Pop oldest item (Map iteration is FIFO)
    const first = queue.entries().next();
    if (first.done) continue;
    const [id, entry] = first.value;
    queue.delete(id);

    try {
      await matchBoardCandidatesForJob(id, entry.job, { refresh: entry.refresh });
      totalProcessed++;

      // saveBoardMatchResult catches its own errors — verify the row was actually written
      const saved = await getStoredBoardMatch(id);
      if (saved) {
        totalStored++;
        logInfo('match-precompute.job.done', {
          jobId: id,
          matches: saved.result.matches?.length ?? 0,
          queueRemaining: queue.size,
        });
      } else {
        // matchBoardCandidatesForJob succeeded but DB write was silently dropped
        logWarn('match-precompute.job.not-stored', { jobId: id, queueRemaining: queue.size });
      }
    } catch (e) {
      totalProcessed++;
      totalFailed++;
      logError('match-precompute.job.fail', {
        jobId: id,
        message: e instanceof Error ? e.message : String(e),
      });
    }

    if (cfg.throttleMs > 0 && !isStopped()) {
      await sleep(cfg.throttleMs);
    }
  }

  logInfo('match-precompute.consumer.stop', { totalProcessed, totalStored, totalFailed });
}

// ─── Entry point ──────────────────────────────────────────────────────────────
let workerStarted = false;

export function startMatchPrecomputeWorker(): () => void {
  if (workerStarted) return () => {};
  if (!isEnabled()) {
    logInfo('match-precompute.disabled');
    return () => {};
  }
  workerStarted = true;

  const cfg = readConfig();
  logInfo('match-precompute.start', {
    scanIntervalMs: cfg.scanIntervalMs,
    throttleMs: cfg.throttleMs,
    staleHours: cfg.staleMs / 3_600_000,
    scanLimit: cfg.scanLimit,
    startupDelayMs: cfg.startupDelayMs,
  });

  let stopped = false;
  const isStopped = () => stopped;

  // Both loops run concurrently — scanner fills the queue, consumer drains it
  void scannerLoop(cfg, isStopped);
  void consumerLoop(cfg, isStopped);

  return () => {
    stopped = true;
  };
}

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
import { APP_DEPARTMENT_CODES } from './departmentScope.js';
import { loadBoardMatchTierMap, getStoredBoardMatch, type BoardMatchTierEntry } from './boardMatchStore.js';
import { matchBoardCandidatesForJob } from './boardCandidateMatcher.js';
import { logInfo, logWarn, logError } from './logger.js';

export type PrecomputeJob = Record<string, unknown> & { id: string };

// ─── Shared queue ─────────────────────────────────────────────────────────────
// Map preserves insertion order → FIFO. Dedupes by job ID.
export type QueueEntry = { job: PrecomputeJob; refresh: boolean };
const queue = new Map<string, QueueEntry>();

// ─── Known-stored guard ────────────────────────────────────────────────────────
// job IDs ที่มีผล AI เก็บใน DB แล้ว — populated by scanner (tierMap) + consumer (on store)
// enqueuePrecomputeJobs ใช้ set นี้กรองออกก่อน เพื่อไม่ re-queue งานที่ทำแล้ว
// (ยกเว้น refresh:true = user สั่ง re-match ใหม่)
const knownStoredIds = new Set<string>();

/**
 * Insert items into a FIFO queue map. Exported (pure on `target`) for tests.
 * - dedupe by job id — ใบที่อยู่ในคิวแล้วคงตำแหน่งเดิม แต่อัปเกรดเป็น refresh ได้
 * - front: แทรกรายการใหม่ไว้หัวคิว (ใบที่ผู้ใช้เปิดอยู่ ต้องได้คิดก่อน scan ปกติ)
 */
export function applyEnqueue(
  target: Map<string, QueueEntry>,
  items: Array<{ job: PrecomputeJob; refresh: boolean }>,
  opts: { front?: boolean } = {},
): number {
  const fresh: Array<[string, QueueEntry]> = [];
  for (const { job, refresh } of items) {
    const id = typeof job.id === 'string' ? job.id.trim() : '';
    if (!id) continue;
    const existing = target.get(id);
    if (existing) {
      if (refresh && !existing.refresh) existing.refresh = true;
      continue;
    }
    if (fresh.some(([k]) => k === id)) continue;
    fresh.push([id, { job, refresh }]);
  }
  if (fresh.length === 0) return 0;
  if (opts.front && target.size > 0) {
    const rest = [...target];
    target.clear();
    for (const [k, v] of fresh) target.set(k, v);
    for (const [k, v] of rest) target.set(k, v);
  } else {
    for (const [k, v] of fresh) target.set(k, v);
  }
  return fresh.length;
}

function enqueue(
  items: Array<{ job: PrecomputeJob; refresh: boolean }>,
  opts: { front?: boolean } = {},
): number {
  return applyEnqueue(queue, items, opts);
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
  // รับแค่ { id } — interface อย่าง JobRequest ไม่มี index signature จึง assign เข้า
  // Record<string, unknown> ตรง ๆ ไม่ได้ · ฟิลด์อื่นถูกอ่านแบบ dynamic ผ่าน PrecomputeJob อยู่แล้ว
  jobs: Array<{ id: string }>,
  opts: { refresh?: boolean; front?: boolean } = {},
): void {
  if (!workerStarted) return;
  const isRefresh = opts.refresh === true;

  // กรองงานที่มีผลแล้วออก เพื่อไม่วนซ้ำเมื่อ user refresh หน้า
  // refresh:true = user สั่ง re-match ใหม่ → ไม่กรอง
  const eligible = isRefresh
    ? jobs
    : jobs.filter((job) => {
        const id = typeof job.id === 'string' ? job.id.trim() : '';
        return id && !knownStoredIds.has(id);
      });

  const skipped = jobs.length - eligible.length;
  if (eligible.length === 0) {
    if (skipped > 0) logInfo('match-precompute.push.skip', { skipped, reason: 'already-stored' });
    return;
  }

  const sorted = sortByPriority(
    eligible.map((job) => ({ job: job as PrecomputeJob, refresh: isRefresh })),
  );
  const added = enqueue(sorted, { front: opts.front === true });
  if (added > 0)
    logInfo('match-precompute.push', {
      added,
      skipped,
      queueSize: queue.size,
      refresh: isRefresh,
      front: opts.front === true,
    });
}

/** หน้าเว็บไม่รัน AI เองแล้ว — handler ใช้เช็คว่ามี worker หลังบ้านรับงานต่อจริงไหม */
export function isMatchPrecomputeWorkerActive(): boolean {
  return workerStarted;
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

export function parseIntEnv(raw: string | undefined, def: number, min: number): number {
  const s = String(raw ?? '').trim();
  // ⚠️ ว่าง = ไม่ได้ตั้ง → ใช้ default — ห้ามปล่อยไป Number('') ซึ่งได้ 0 (finite!)
  // บั๊กเดิม: env ที่ไม่ได้ตั้งทุกตัวตกไปที่ค่า min แทน default → scan ได้แค่ 1 ใบ/แผนก
  // ทุก 10 วิ แทน 2,000 ใบทุก 5 นาที (เจอตอนเปิด precompute ครั้งแรก 12 ส.ค. 2569)
  if (!s) return def;
  const n = Number(s);
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
    throttleMs: parseIntEnv(process.env.MATCH_PRECOMPUTE_THROTTLE_MS, 30_000, 0),
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

// ─── Scanner helpers ──────────────────────────────────────────────────────────
// Fetching with mode:'all' + no departmentScope hits a SQL BETWEEN range filter
// in env vars that returns only 1 row. Iterating per department code matches
// exactly what the HTTP handler does and sees all 221+ open requests.
async function scanAllDepartments(limit: number): Promise<PrecomputeJob[]> {
  const seen = new Set<string>();
  const all: PrecomputeJob[] = [];
  for (const code of APP_DEPARTMENT_CODES) {
    try {
      const jobs = (await listSiamrajUnitRequests({
        limit,
        departmentScope: { mode: 'code', code },
      })) as PrecomputeJob[];
      for (const job of jobs) {
        const id = typeof job.id === 'string' ? job.id.trim() : '';
        if (id && !seen.has(id)) {
          seen.add(id);
          all.push(job);
        }
      }
    } catch (e) {
      logError('match-precompute.scan.dept.fail', {
        code,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return all;
}

// ─── Scanner loop ─────────────────────────────────────────────────────────────
async function runScan(cfg: WorkerConfig): Promise<void> {
  if (!gatesOk()) {
    logWarn('match-precompute.scan.skip');
    return;
  }

  try {
    const [jobs, tierMap] = await Promise.all([
      scanAllDepartments(cfg.scanLimit),
      loadBoardMatchTierMap(),
    ]);

    const nowMs = Date.now();
    const items: Array<{ job: PrecomputeJob; refresh: boolean }> = [];

    // อัปเดต knownStoredIds จาก DB ทุกรอบ scan → HTTP-push จะกรองงานที่ทำแล้วออก
    for (const id of tierMap.keys()) knownStoredIds.add(id);

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

  while (!isStopped()) {
    if (queue.size === 0) {
      if (!loggedIdle) {
        logInfo('match-precompute.idle', workerStats);
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
      workerStats.totalProcessed++;
      workerStats.lastJobAt = Date.now();

      // saveBoardMatchResult catches its own errors — verify the row was actually written
      const saved = await getStoredBoardMatch(id);
      if (saved) {
        workerStats.totalStored++;
        knownStoredIds.add(id); // mark ไม่ให้ HTTP-push วนซ้ำ
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
      workerStats.totalProcessed++;
      workerStats.totalFailed++;
      logError('match-precompute.job.fail', {
        jobId: id,
        message: e instanceof Error ? e.message : String(e),
      });
    }

    if (cfg.throttleMs > 0 && !isStopped()) {
      await sleep(cfg.throttleMs);
    }
  }

  logInfo('match-precompute.consumer.stop', workerStats);
}

// ─── Module-level stats (readable via getWorkerStatus) ───────────────────────
const workerStats = {
  totalProcessed: 0,
  totalStored: 0,
  totalFailed: 0,
  lastJobAt: null as number | null,
};

export type WorkerStatus = {
  enabled: boolean;
  started: boolean;
  queueSize: number;
  totalProcessed: number;
  totalStored: number;
  totalFailed: number;
  lastJobAt: number | null;
  isIdle: boolean;
};

export function getWorkerStatus(): WorkerStatus {
  return {
    enabled: isEnabled(),
    started: workerStarted,
    queueSize: queue.size,
    totalProcessed: workerStats.totalProcessed,
    totalStored: workerStats.totalStored,
    totalFailed: workerStats.totalFailed,
    lastJobAt: workerStats.lastJobAt,
    isIdle: workerStarted && queue.size === 0,
  };
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

  // โหลด tierMap ทันทีที่ worker start เพื่อ populate knownStoredIds ก่อนที่ HTTP handlers
  // จะเริ่ม push งาน — กันกรณี deploy ใหม่แต่ผลเก่ายังอยู่ใน DB
  void loadBoardMatchTierMap()
    .then((m) => { for (const id of m.keys()) knownStoredIds.add(id); })
    .catch(() => { /* non-critical — scanner will populate on first run */ });

  // Both loops run concurrently — scanner fills the queue, consumer drains it
  void scannerLoop(cfg, isStopped);
  void consumerLoop(cfg, isStopped);

  return () => {
    stopped = true;
  };
}

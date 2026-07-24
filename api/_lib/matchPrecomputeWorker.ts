/**
 * Background precompute worker — คิด AI board-match ล่วงหน้าเก็บลง store
 * เพื่อให้หน้า Matching ดึงผลได้ทันทีโดยไม่ต้องรอ LLM
 *
 * รันเฉพาะใน process API on-prem (server/local-api.ts) — Vercel ใช้ catch-all
 * ต่างหากและเข้าไม่ถึง Ollama/MSSQL (ดู memory deploy-topology) จึงไม่มี worker.
 * ปิดโดยค่าเริ่มต้น เปิดด้วย MATCH_PRECOMPUTE_ENABLED=true เท่านั้น
 *
 * แต่ละรอบ: list ใบขอเปิด → เทียบกับผลที่เก็บไว้ → คิดเฉพาะใบที่ "ยังไม่เคยคิด"
 * (และใบที่ "เก่าเกิน" ถ้าเปิด TTL) แบบ throttle ทีละใบ กันถล่ม Ollama
 */
import { getSiamrajSqlServerConfig } from './siamrajSqlServer.js';
import { getOllamaConfig } from './ollamaClient.js';
import { listSiamrajUnitRequests } from './siamrajUnitRequests.js';
import { loadBoardMatchTierMap, type BoardMatchTierEntry } from './boardMatchStore.js';
import { matchBoardCandidatesForJob } from './boardCandidateMatcher.js';
import { logInfo, logWarn, logError } from './logger.js';

type PrecomputeJob = Record<string, unknown> & { id: string };

export type PrecomputePlan = {
  /** ใบที่ต้องคิดรอบนี้ (missing ก่อน แล้วตามด้วย stale ที่เก่าสุด) จำกัดด้วย batch */
  queue: PrecomputeJob[];
  missing: number;
  stale: number;
};

/**
 * เลือกใบขอที่ต้องคิดรอบนี้ — pure function (ทดสอบได้ ไม่แตะ DB/LLM)
 * - missing = ใบเปิดที่ยังไม่มีผลเก็บไว้ → คิดก่อนเสมอ
 * - stale   = ใบที่มีผลแล้วแต่เก่ากว่า staleMs (0 = ปิด ไม่ถือว่าเก่า) เรียงเก่าสุดก่อน
 * รวมแล้วตัดเหลือ batch ใบ
 */
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

  // เก่าสุดก่อน — ใบที่ค้างนานสุดได้อัปเดตก่อน
  stale.sort((a, b) => b.age - a.age);

  const queue = [...missing, ...stale.map((s) => s.job)].slice(0, Math.max(0, opts.batch));
  return { queue, missing: missing.length, stale: stale.length };
}

type WorkerConfig = {
  intervalMs: number;
  batch: number;
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
    intervalMs: parseIntEnv(process.env.MATCH_PRECOMPUTE_INTERVAL_MS, 300_000, 10_000),
    batch: parseIntEnv(process.env.MATCH_PRECOMPUTE_BATCH, 5, 1),
    throttleMs: parseIntEnv(process.env.MATCH_PRECOMPUTE_THROTTLE_MS, 2_000, 0),
    // ชั่วโมง → ms; 0 = ปิด staleness (คิดเฉพาะใบที่ยังไม่เคยคิด)
    staleMs: parseIntEnv(process.env.MATCH_PRECOMPUTE_STALE_HOURS, 0, 0) * 3_600_000,
    scanLimit: parseIntEnv(process.env.MATCH_PRECOMPUTE_SCAN_LIMIT, 2000, 1),
    startupDelayMs: parseIntEnv(process.env.MATCH_PRECOMPUTE_STARTUP_DELAY_MS, 15_000, 0),
  };
}

let started = false;
let running = false;

async function runCycle(cfg: WorkerConfig): Promise<void> {
  if (running) {
    logWarn('match-precompute.skip.overlap');
    return;
  }
  running = true;
  const startedAt = Date.now();
  try {
    // gate ซ้ำอีกชั้น — on-prem เท่านั้นที่มี MSSQL + Ollama; ถ้าขาดให้ข้ามเงียบ ๆ
    if (!getSiamrajSqlServerConfig()) {
      logWarn('match-precompute.skip.no-sqlserver');
      return;
    }
    if (!getOllamaConfig()) {
      logWarn('match-precompute.skip.no-ollama');
      return;
    }

    const jobs = (await listSiamrajUnitRequests({ limit: cfg.scanLimit })) as PrecomputeJob[];
    const tierMap = await loadBoardMatchTierMap();

    const { queue, missing, stale } = selectPrecomputeQueue(jobs, tierMap, {
      staleMs: cfg.staleMs,
      batch: cfg.batch,
      nowMs: Date.now(),
    });

    if (queue.length === 0) {
      logInfo('match-precompute.idle', { open: jobs.length, stored: tierMap.size });
      return;
    }

    logInfo('match-precompute.begin', {
      open: jobs.length,
      stored: tierMap.size,
      missing,
      stale,
      batch: queue.length,
    });

    let ok = 0;
    let fail = 0;
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i];
      const id = String(job.id);
      // ใบที่มีผลอยู่แล้ว (stale) → refresh สเปคด้วย; ใบใหม่ → ใช้สเปคที่ cache ไว้ได้
      const refresh = tierMap.has(id);
      try {
        await matchBoardCandidatesForJob(id, job, { refresh });
        ok++;
      } catch (e) {
        fail++;
        logError('match-precompute.job.fail', {
          jobId: id,
          message: e instanceof Error ? e.message : String(e),
        });
      }
      if (i < queue.length - 1 && cfg.throttleMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, cfg.throttleMs));
      }
    }

    logInfo('match-precompute.done', { ok, fail, ms: Date.now() - startedAt });
  } catch (e) {
    logError('match-precompute.cycle.fail', {
      message: e instanceof Error ? e.message : String(e),
    });
  } finally {
    running = false;
  }
}

/**
 * เริ่ม worker (idempotent) — คืนฟังก์ชัน stop
 * ใช้ setTimeout วนซ้ำ (ไม่ใช่ setInterval) เพื่อไม่ให้รอบใหม่ทับรอบเก่า
 * และ unref() ไม่ให้ worker กันไม่ให้ process ปิด
 */
export function startMatchPrecomputeWorker(): () => void {
  if (started) return () => {};
  if (!isEnabled()) {
    logInfo('match-precompute.disabled');
    return () => {};
  }
  started = true;

  const cfg = readConfig();
  logInfo('match-precompute.start', {
    intervalMs: cfg.intervalMs,
    batch: cfg.batch,
    throttleMs: cfg.throttleMs,
    staleHours: cfg.staleMs / 3_600_000,
    scanLimit: cfg.scanLimit,
    startupDelayMs: cfg.startupDelayMs,
  });

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const loop = async () => {
    if (stopped) return;
    await runCycle(cfg);
    if (stopped) return;
    timer = setTimeout(loop, cfg.intervalMs);
    timer.unref?.();
  };

  timer = setTimeout(loop, cfg.startupDelayMs);
  timer.unref?.();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

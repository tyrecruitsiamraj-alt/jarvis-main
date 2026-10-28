/**
 * ═══ ตัวจดแรม/โหลดของเครื่องจริงทุก 1 นาที (เจ้าของ 28 ต.ค. 2569 "เช็ค performance issue ให้ทีมันน่าจะชอบทำให้ล่ม") ═══
 * 27 ต.ค. 20:37–21:22 เครื่องค้างทั้งเครื่องตอน build แต่ไม่มีตัวเลขเหลือให้ดู ⇒ จดลงฐานไว้เป็นหลักฐาน
 * คอนเทนเนอร์ไม่ได้จำกัดแรม ⇒ /proc/meminfo กับ loadavg ที่อ่านได้คือของทั้งเครื่อง
 *
 * 🔴 เปิดเฉพาะเครื่องจริง — ใช้สวิตช์เดียวกับยามเฝ้า `SYSTEM_HEALTH_WATCH_ENABLED` (ฐาน dev = production
 *    ถ้าจดจากเครื่องนักพัฒนา ตัวเลขของ Mac จะปนกับของเครื่องจริง) · ปิดเฉพาะตัวนี้ด้วย SYSTEM_RESOURCE_SAMPLER_ENABLED=false
 * ตัวคิด/ตัวหาช่วงเงียบอยู่ `src/lib/systemResources.ts` · การ์ดอยู่ ตั้งค่า › สถานะระบบ
 */
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError, logInfo } from './logger.js';
import {
  findGaps,
  KEEP_DAYS,
  parseMeminfo,
  peakOf,
  SAMPLE_EVERY_MS,
  type ResourceSample,
  type ResourceSummary,
} from '../../src/lib/systemResources.js';

const table = tableInAppSchema('system_resource_samples');
const PRUNE_EVERY_MS = 60 * 60_000;

let running = false;
let stopped = false;

const isOn = (raw: string | undefined) => ['true', '1', 'yes', 'on'].includes(String(raw ?? '').trim().toLowerCase());

function isEnabled(): boolean {
  if (String(process.env.SYSTEM_RESOURCE_SAMPLER_ENABLED ?? '').trim().toLowerCase() === 'false') return false;
  return isOn(process.env.SYSTEM_HEALTH_WATCH_ENABLED);
}

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

async function readMem(): Promise<{ totalMb: number | null; availableMb: number | null; swapTotalMb: number | null; swapFreeMb: number | null }> {
  try {
    return parseMeminfo(await readFile('/proc/meminfo', 'utf8'));
  } catch {
    // ไม่ใช่ Linux — freemem ต่ำกว่าความจริง (ไม่นับ cache) แต่ยังดีกว่าไม่มี
    return { totalMb: mb(os.totalmem()), availableMb: mb(os.freemem()), swapTotalMb: null, swapFreeMb: null };
  }
}

async function sampleOnce(loopDelayMaxMs: number | null): Promise<void> {
  const mem = await readMem();
  const [load1, load5] = os.loadavg();
  const usage = process.memoryUsage();
  await dbQuery(
    `insert into ${table}
       (mem_total_mb, mem_available_mb, swap_total_mb, swap_free_mb, load1, load5, cpu_count, api_rss_mb, api_heap_mb, loop_delay_max_ms, host_uptime_s)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      mem.totalMb,
      mem.availableMb,
      mem.swapTotalMb,
      mem.swapFreeMb,
      Math.round(load1 * 100) / 100,
      Math.round(load5 * 100) / 100,
      os.cpus().length,
      mb(usage.rss),
      mb(usage.heapUsed),
      loopDelayMaxMs,
      Math.round(os.uptime()),
    ],
  );
}

async function sleepInterruptible(ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (!stopped && Date.now() < end) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, Math.min(1_000, end - Date.now()));
      t.unref?.();
    });
  }
}

export function startSystemResourceSampler(): boolean {
  if (!isEnabled()) {
    logInfo('systemResource.sampler.disabled');
    return false;
  }
  if (running) return true;
  running = true;
  stopped = false;
  logInfo('systemResource.sampler.start', { everyMs: SAMPLE_EVERY_MS, keepDays: KEEP_DAYS });

  // หน่วงสูงสุดของ event loop ในแต่ละนาที — API ค้างเพราะงานหนักในตัวเองจะเห็นที่ตัวนี้
  const loop = monitorEventLoopDelay({ resolution: 50 });
  loop.enable();

  void (async () => {
    let lastPrune = 0;
    while (!stopped) {
      try {
        const maxMs = Number.isFinite(loop.max) && loop.max > 0 ? Math.round(loop.max / 1e6) : null;
        loop.reset();
        await sampleOnce(maxMs);
        if (Date.now() - lastPrune > PRUNE_EVERY_MS) {
          await dbQuery(`delete from ${table} where sampled_at < now() - make_interval(days => $1)`, [KEEP_DAYS]);
          lastPrune = Date.now();
        }
      } catch (e) {
        logError('systemResource.sampler.failed', e);
      }
      await sleepInterruptible(SAMPLE_EVERY_MS);
    }
    loop.disable();
    running = false;
  })();
  return true;
}

export function stopSystemResourceSampler(): void {
  stopped = true;
}

type Row = {
  sampled_at: Date | string;
  mem_total_mb: number | null;
  mem_available_mb: number | null;
  swap_total_mb: number | null;
  swap_free_mb: number | null;
  load1: string | number | null;
  load5: string | number | null;
  cpu_count: number | null;
  api_rss_mb: number | null;
  api_heap_mb: number | null;
  loop_delay_max_ms: number | null;
  host_uptime_s: number | null;
};

const num = (v: string | number | null) => (v == null ? null : Number(v));

function toSample(r: Row): ResourceSample {
  return {
    sampledAt: new Date(r.sampled_at).toISOString(),
    memTotalMb: r.mem_total_mb,
    memAvailableMb: r.mem_available_mb,
    swapTotalMb: r.swap_total_mb,
    swapFreeMb: r.swap_free_mb,
    load1: num(r.load1),
    load5: num(r.load5),
    cpuCount: r.cpu_count,
    apiRssMb: r.api_rss_mb,
    apiHeapMb: r.api_heap_mb,
    loopDelayMaxMs: r.loop_delay_max_ms,
    hostUptimeS: r.host_uptime_s,
  };
}

/** การ์ดหน้าสถานะระบบ: ค่าล่าสุด · จุดหนักสุด 24 ชม. · ช่วงที่ตัวจดเงียบ 7 วัน (อ่านอย่างเดียว) */
export async function readResourceSummary(): Promise<ResourceSummary> {
  const [{ rows: day }, { rows: week }] = await Promise.all([
    dbQuery<Row>(`select * from ${table} where sampled_at > now() - interval '24 hours' order by sampled_at`),
    dbQuery<{ sampled_at: Date | string }>(`select sampled_at from ${table} where sampled_at > now() - interval '7 days' order by sampled_at`),
  ]);
  const samples = day.map(toSample);
  return {
    latest: samples.at(-1) ?? null,
    peak24h: peakOf(samples),
    gaps: findGaps(week.map((r) => new Date(r.sampled_at).toISOString())),
    samples24h: samples.length,
  };
}

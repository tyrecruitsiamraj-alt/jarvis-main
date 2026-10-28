/**
 * ═══ แรม/โหลดของเครื่องจริง — ตัวคิดล้วน (เจ้าของ 28 ต.ค. 2569 "เช็ค performance issue ให้ทีมันน่าจะชอบทำให้ล่ม") ═══
 * ตัวจดอยู่ `api/_lib/systemResourceSampler.ts` (ทุก 1 นาที) · การ์ดอยู่ ตั้งค่า › สถานะระบบ
 * ช่วงที่ไม่มีแถวเกิน `GAP_MINUTES` = เครื่องค้าง ล่ม หรือกำลัง deploy (ตัวจดหยุดตอนคอนเทนเนอร์สร้างใหม่)
 */

export const SAMPLE_EVERY_MS = 60_000;
export const KEEP_DAYS = 14;
/** ห่างกันเกินนี้ = ช่วงที่ตัวจดไม่ได้ทำงาน (deploy ปกติหายไม่ถึง 2 นาที) */
export const GAP_MINUTES = 3;

export type ResourceSample = {
  sampledAt: string;
  memTotalMb: number | null;
  memAvailableMb: number | null;
  swapTotalMb: number | null;
  swapFreeMb: number | null;
  load1: number | null;
  load5: number | null;
  cpuCount: number | null;
  apiRssMb: number | null;
  apiHeapMb: number | null;
  loopDelayMaxMs: number | null;
  hostUptimeS: number | null;
};

export type ResourceGap = { from: string; to: string; minutes: number };

export type ResourcePeak = {
  minAvailableMb: number | null;
  minAvailableAt: string | null;
  maxLoad1: number | null;
  maxLoad1At: string | null;
  maxApiRssMb: number | null;
  maxLoopDelayMs: number | null;
};

export type ResourceSummary = {
  latest: ResourceSample | null;
  peak24h: ResourcePeak;
  gaps: ResourceGap[];
  samples24h: number;
};

/** อ่าน /proc/meminfo (หน่วย kB) → MB · ไม่มีค่า = null */
export function parseMeminfo(text: string): { totalMb: number | null; availableMb: number | null; swapTotalMb: number | null; swapFreeMb: number | null } {
  const kb = (key: string): number | null => {
    const m = new RegExp(`^${key}:\\s+(\\d+)\\s*kB`, 'm').exec(text);
    return m ? Math.round(Number(m[1]) / 1024) : null;
  };
  return { totalMb: kb('MemTotal'), availableMb: kb('MemAvailable'), swapTotalMb: kb('SwapTotal'), swapFreeMb: kb('SwapFree') };
}

/** ช่วงที่ตัวจดเงียบเกิน `gapMinutes` (เรียงใหม่สุดก่อน) · ไม่นับก่อนแถวแรกของช่วงที่ดู */
export function findGaps(sampledAt: string[], gapMinutes = GAP_MINUTES): ResourceGap[] {
  const ts = sampledAt.map((s) => new Date(s).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
  const out: ResourceGap[] = [];
  for (let i = 1; i < ts.length; i++) {
    const minutes = Math.round((ts[i] - ts[i - 1]) / 60_000);
    if (minutes > gapMinutes) out.push({ from: new Date(ts[i - 1]).toISOString(), to: new Date(ts[i]).toISOString(), minutes });
  }
  return out.reverse();
}

/** จุดหนักสุดของช่วงที่ให้มา */
export function peakOf(samples: ResourceSample[]): ResourcePeak {
  const peak: ResourcePeak = { minAvailableMb: null, minAvailableAt: null, maxLoad1: null, maxLoad1At: null, maxApiRssMb: null, maxLoopDelayMs: null };
  for (const s of samples) {
    if (s.memAvailableMb != null && (peak.minAvailableMb == null || s.memAvailableMb < peak.minAvailableMb)) {
      peak.minAvailableMb = s.memAvailableMb;
      peak.minAvailableAt = s.sampledAt;
    }
    if (s.load1 != null && (peak.maxLoad1 == null || s.load1 > peak.maxLoad1)) {
      peak.maxLoad1 = s.load1;
      peak.maxLoad1At = s.sampledAt;
    }
    if (s.apiRssMb != null && (peak.maxApiRssMb == null || s.apiRssMb > peak.maxApiRssMb)) peak.maxApiRssMb = s.apiRssMb;
    if (s.loopDelayMaxMs != null && (peak.maxLoopDelayMs == null || s.loopDelayMaxMs > peak.maxLoopDelayMs)) peak.maxLoopDelayMs = s.loopDelayMaxMs;
  }
  return peak;
}

export type ResourceLevel = 'ok' | 'warn' | 'danger';

/** แรมเหลือ: ต่ำกว่า 10% = ใกล้หมด · ต่ำกว่า 25% = เหลือน้อย */
export function memLevelOf(availableMb: number | null, totalMb: number | null): { level: ResourceLevel; word: string } | null {
  if (availableMb == null || !totalMb) return null;
  const share = availableMb / totalMb;
  if (share < 0.1) return { level: 'danger', word: 'ใกล้หมด' };
  if (share < 0.25) return { level: 'warn', word: 'เหลือน้อย' };
  return { level: 'ok', word: 'ปกติ' };
}

/** โหลด 1 นาที เทียบจำนวน CPU: เกิน 2 เท่า = หนักมาก · เกินจำนวน CPU = หนัก */
export function loadLevelOf(load1: number | null, cpuCount: number | null): { level: ResourceLevel; word: string } | null {
  if (load1 == null || !cpuCount) return null;
  if (load1 > cpuCount * 2) return { level: 'danger', word: 'หนักมาก' };
  if (load1 > cpuCount) return { level: 'warn', word: 'หนัก' };
  return { level: 'ok', word: 'ปกติ' };
}

import { describe, expect, it } from 'vitest';
import { findGaps, loadLevelOf, memLevelOf, parseMeminfo, peakOf, type ResourceSample } from '../../src/lib/systemResources';

const MEMINFO = `MemTotal:        8030716 kB
MemFree:          214632 kB
MemAvailable:    1536000 kB
Buffers:           81236 kB
SwapTotal:       2097148 kB
SwapFree:         524288 kB
`;

const sample = (at: string, over: Partial<ResourceSample> = {}): ResourceSample => ({
  sampledAt: at,
  memTotalMb: 7843,
  memAvailableMb: 3000,
  swapTotalMb: 2048,
  swapFreeMb: 2048,
  load1: 0.5,
  load5: 0.4,
  cpuCount: 4,
  apiRssMb: 400,
  apiHeapMb: 200,
  loopDelayMaxMs: 30,
  hostUptimeS: 86_400,
  ...over,
});

describe('แรม/โหลดเครื่องจริง (28 ต.ค. 2569 เครื่องค้างตอน build)', () => {
  it('อ่าน /proc/meminfo เป็น MB · ใช้ MemAvailable ไม่ใช่ MemFree', () => {
    expect(parseMeminfo(MEMINFO)).toEqual({ totalMb: 7842, availableMb: 1500, swapTotalMb: 2048, swapFreeMb: 512 });
    expect(parseMeminfo('')).toEqual({ totalMb: null, availableMb: null, swapTotalMb: null, swapFreeMb: null });
  });

  it('ช่วงที่ตัวจดเงียบเกิน 3 นาที = ช่วงที่เครื่องค้าง/ล่ม/deploy · ใหม่สุดก่อน', () => {
    const ts = ['2026-10-27T13:35:00Z', '2026-10-27T13:36:00Z', '2026-10-27T13:37:00Z', '2026-10-27T14:22:30Z', '2026-10-27T14:23:30Z', '2026-10-27T14:25:30Z'];
    expect(findGaps(ts)).toEqual([{ from: '2026-10-27T13:37:00.000Z', to: '2026-10-27T14:22:30.000Z', minutes: 46 }]);
    expect(findGaps([])).toEqual([]);
  });

  it('จุดหนักสุด: แรมเหลือน้อยสุด โหลดสูงสุด พร้อมเวลา', () => {
    const p = peakOf([
      sample('2026-10-27T13:30:00Z'),
      sample('2026-10-27T13:36:00Z', { memAvailableMb: 120, load1: 9.5, apiRssMb: 1300, loopDelayMaxMs: 4000 }),
      sample('2026-10-27T14:30:00Z', { memAvailableMb: null, load1: null }),
    ]);
    expect(p).toEqual({ minAvailableMb: 120, minAvailableAt: '2026-10-27T13:36:00Z', maxLoad1: 9.5, maxLoad1At: '2026-10-27T13:36:00Z', maxApiRssMb: 1300, maxLoopDelayMs: 4000 });
  });

  it('บอกสถานะเป็นคำ ไม่ใช่สีอย่างเดียว', () => {
    expect(memLevelOf(500, 8000)).toEqual({ level: 'danger', word: 'ใกล้หมด' });
    expect(memLevelOf(1500, 8000)).toEqual({ level: 'warn', word: 'เหลือน้อย' });
    expect(memLevelOf(4000, 8000)).toEqual({ level: 'ok', word: 'ปกติ' });
    expect(memLevelOf(null, 8000)).toBeNull();
    expect(loadLevelOf(9, 4)).toEqual({ level: 'danger', word: 'หนักมาก' });
    expect(loadLevelOf(5, 4)).toEqual({ level: 'warn', word: 'หนัก' });
    expect(loadLevelOf(1, 4)).toEqual({ level: 'ok', word: 'ปกติ' });
  });
});

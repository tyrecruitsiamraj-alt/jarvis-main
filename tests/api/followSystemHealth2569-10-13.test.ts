/**
 * กันไม่โทร รอบ 3 (เจ้าของ 13 ต.ค. 2569 "จะกันให้หมด"): เตือนบนหน้าติดตามเมื่อระบบเบื้องหลังหยุด
 */
import { describe, expect, it } from 'vitest';
import { followHealthWarnings } from '@/lib/followSystemHealth';

const NOW = new Date('2026-10-13T03:00:00Z'); // 10:00 ไทย
const ok = {
  enabled: true,
  unavailableReason: null,
  followWorkerAt: '2026-10-13T02:59:00Z',
  lastRun: { at: '2026-10-13T02:56:00Z' } as never,
};

describe('เตือนระบบเบื้องหลังหยุด', () => {
  it('ปกติ = ไม่เตือน · อ่านสถานะไม่ได้ = ไม่เตือน', () => {
    expect(followHealthWarnings(ok, 'replace', NOW)).toEqual([]);
    expect(followHealthWarnings(null, 'replace', NOW)).toEqual([]);
  });

  it('ตัวทำงานทุกนาทีไม่เดินเกิน 5 นาที = เตือนทุกแท็บ · ไม่เคยเดิน = เตือน', () => {
    expect(followHealthWarnings({ ...ok, followWorkerAt: '2026-10-13T02:50:00Z' }, 'list', NOW)).toEqual([
      'ระบบส่งสายอัตโนมัติหยุดทำงานตั้งแต่ 09:50 น.',
    ]);
    expect(followHealthWarnings({ ...ok, followWorkerAt: null }, 'list', NOW)).toEqual(['ระบบส่งสายอัตโนมัติไม่ทำงาน']);
  });

  it('iRecruit ดึงไม่ได้ / ไม่ได้ดึงเกิน 20 นาที = เตือนเฉพาะแท็บส่งคนแทน · ปิดดึงอยู่ = ไม่เตือน', () => {
    const failed = { ...ok, lastRun: { at: '2026-10-13T02:58:00Z', error: 'timeout' } as never };
    expect(followHealthWarnings(failed, 'replace', NOW)).toEqual(['ดึงงานจาก iRecruit ไม่ได้ (ลองล่าสุด 09:58 น.)']);
    expect(followHealthWarnings(failed, 'list', NOW)).toEqual([]);
    const stale = { ...ok, lastRun: { at: '2026-10-13T02:30:00Z' } as never };
    expect(followHealthWarnings(stale, 'replace', NOW)).toEqual(['ไม่ได้ดึงงานจาก iRecruit มาตั้งแต่ 09:30 น.']);
    expect(followHealthWarnings({ ...stale, enabled: false }, 'replace', NOW)).toEqual([]);
  });
});

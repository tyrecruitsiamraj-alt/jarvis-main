import { describe, expect, it } from 'vitest';
import { tbdPlaceholderAts } from '@/lib/followTbd';

describe('ยังไม่ชัวร์เวลา — เวลาแทนไม่ชนกัน (เจ้าของเจอ 5 ต.ค. 2569)', () => {
  it('🔴 สองสายวันเดียวกัน = เวลาแทนคนละนาที เรียงตามลำดับช่อง · ไม่ถูกตัดเป็นสายเดียว', () => {
    const out = tbdPlaceholderAts(['2026-10-06', '2026-10-06'], ['tbd', 'tbd']);
    expect(out).toEqual(['2026-10-06T00:00', '2026-10-06T00:01']);
    expect(new Set(out).size).toBe(2);
  });
  it('สายที่มีเวลาจริงไม่แตะ', () => {
    expect(tbdPlaceholderAts(['2026-10-06T08:00', '2026-10-06'], ['ai', 'tbd'])).toEqual([
      '2026-10-06T08:00',
      '2026-10-06T00:01',
    ]);
  });
});

describe('ตารางหลายวัน: ยังไม่ชัวร์เวลาเลือกได้ทีละสาย (เจ้าของ Choice 5 ต.ค. 2569)', () => {
  it('🔴 สายที่ติ๊กยังไม่ชัวร์เวลา = คนโทร + ธง · ลำดับสายตามแถว (สาย 1 ยังเป็นสาย 1)', async () => {
    const { buildScheduleCalls, SCHEDULE_TBD } = await import('@/lib/followWizard');
    const calls = buildScheduleCalls({
      days: ['2026-10-06', '2026-10-07'],
      modeOfDay: () => 'ai',
      timesOfDay: () => [SCHEDULE_TBD, '09:00'],
      staffPhoneOfDay: () => '0812345678',
    });
    expect(calls.map((c) => [c.day, c.callRound, c.callMode, c.timeTbd ?? false])).toEqual([
      ['2026-10-06', 1, 'manual', true],
      ['2026-10-06', 2, 'ai', false],
      ['2026-10-07', 3, 'manual', true],
      ['2026-10-07', 4, 'ai', false],
    ]);
    expect(new Set(calls.map((c) => c.scheduledAt)).size).toBe(4);
  });

  it('ไม่มีสายยังไม่ชัวร์เวลา = กติกาเดิม (ตัดซ้ำ · เรียงตามเวลา) · ยังไม่ชัวร์เวลาอย่างเดียวก็ผ่านการตรวจฟอร์ม', async () => {
    const { scheduleDaySlots, SCHEDULE_TBD } = await import('@/lib/followWizard');
    expect(scheduleDaySlots(['18:00', '07:00', '07:00'])).toEqual([
      { time: '07:00', tbd: false },
      { time: '18:00', tbd: false },
    ]);
    expect(scheduleDaySlots([SCHEDULE_TBD, SCHEDULE_TBD]).map((s) => s.tbd)).toEqual([true, true]);
  });
});

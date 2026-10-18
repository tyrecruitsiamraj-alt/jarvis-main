/**
 * สายที่ระบบหยุดเองเพราะสายก่อนหน้าวันเดียวกันได้คำตอบแล้ว (เจ้าของ 16 ต.ค. 2569 "แก้ป้ายตามนี้เลย")
 * เคสจริง 15 ต.ค. (พนักงานคนหนึ่ง): 07:00 ตอบ AI ว่าวันนี้วันหยุด → ระบบถอนคิว 08:00 (หยุดแค่วันนั้น ถูกต้อง)
 * แต่จอขึ้น "AI เลยเวลาไม่มีผล" + อยู่กอง "สายที่จะไม่ถูกโทร" เหมือนระบบพัง
 * ⇒ ป้าย "ไม่โทร · สาย 07:00 ตอบ…แล้ว" · จบ (ไม่นับในกองเสี่ยง) · สายที่เสียจริง (ไม่มีคำตอบก่อนหน้า) ยังเห็นเหมือนเดิม
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '@/lib/followApi';
import { followAtRiskCalls } from '@/lib/followCallQueue';
import { groupFollowEntries } from '@/lib/followGrouping';
import { buildFollowPlanningRows, followRoundLabel, stoppedLabel } from '@/lib/followPlanning';

const NOW = new Date('2026-10-15T03:00:00Z'); // 10:00 ไทย

function entry(over: Partial<FollowEntry>): FollowEntry {
  return {
    id: over.id ?? 'e',
    recipient_name: 'พนักงานทดสอบ',
    recipient_phone: '0811111111',
    topic: 'ติดตามเริ่มงาน',
    group_id: 'g1',
    scheduled_at: '2026-10-15T00:00:00Z',
    cancelled: false,
    call_mode: 'ai',
    call_status: 'pending',
    call_outcome: null,
    ...over,
  } as FollowEntry;
}

const rowsOf = (entries: FollowEntry[]) => buildFollowPlanningRows(groupFollowEntries(entries), NOW);

describe('🔴 สายที่ระบบหยุดเพราะสาย 07:00 ตอบแล้ว', () => {
  const answered = entry({ id: 'a', scheduled_at: '2026-10-15T00:00:00Z', call_status: 'completed', call_outcome: 'declined' });
  const stopped = entry({ id: 'b', scheduled_at: '2026-10-15T01:00:00Z', call_status: 'cancelled' });

  it('ป้าย "ไม่โทร · สาย 07:00 ไม่ไปแล้ว" · state จบ (ยกเลิก)', () => {
    const [row] = rowsOf([answered, stopped]);
    const r = row.rounds.find((x) => x.entry.id === 'b')!;
    expect(r.state).toBe('cancelled');
    expect(followRoundLabel(r)).toBe('ไม่โทร · สาย 07:00 ตอบว่าไม่ไปแล้ว');
  });

  it('ไม่อยู่ในกอง "สายที่จะไม่ถูกโทร" (AI เลยเวลาไม่มีผล)', () => {
    expect(followAtRiskCalls(rowsOf([answered, stopped]), NOW).map((x) => x.call.round.entry.id)).not.toContain('b');
  });

  it('ป้ายวันหยุด/ลางาน อ่านเป็นประโยค', () => {
    expect(stoppedLabel({ time: '07:00', category: 'dayOff' })).toBe('ไม่โทร · สาย 07:00 ตอบวันหยุดแล้ว');
    expect(stoppedLabel({ time: '07:00', category: 'leave' })).toBe('ไม่โทร · สาย 07:00 ตอบลางานแล้ว');
  });
});

describe('🔴 สายที่เสียจริงยังเห็นเหมือนเดิม', () => {
  it('คิวถูกยกเลิกแต่ไม่มีสายก่อนหน้าที่ได้คำตอบ = ยังเลยเวลา (อยู่กองเสี่ยง)', () => {
    const lone = entry({ id: 'x', scheduled_at: '2026-10-15T01:00:00Z', call_status: 'cancelled' });
    const [row] = rowsOf([lone]);
    expect(row.rounds[0].state).toBe('overdue');
    expect(row.rounds[0].stoppedBy ?? null).toBeNull();
  });

  it('สายก่อนหน้าไม่รับสาย (ไม่ใช่คำตอบ) = ไม่หยุด · คำตอบหลังเวลาสายนี้ = ไม่หยุด · คนละวัน = ไม่หยุด', () => {
    const noPick = entry({ id: 'n', scheduled_at: '2026-10-15T00:00:00Z', call_status: 'completed', call_outcome: 'no_answer' });
    const later = entry({ id: 'l', scheduled_at: '2026-10-15T02:00:00Z', call_status: 'completed', call_outcome: 'declined' });
    const yesterday = entry({ id: 'y', scheduled_at: '2026-10-14T00:00:00Z', call_status: 'completed', call_outcome: 'declined' });
    const target = entry({ id: 't', scheduled_at: '2026-10-15T01:00:00Z', call_status: 'cancelled' });
    const [row] = rowsOf([noPick, later, yesterday, target]);
    expect(row.rounds.find((x) => x.entry.id === 't')!.state).toBe('overdue');
  });

  it('คิวยังรอ (pending) = ไม่แตะ แม้สายก่อนหน้าตอบแล้ว (Lumos โทรครบทุก step ตามปกติ)', () => {
    const answered = entry({ id: 'a', scheduled_at: '2026-10-15T00:00:00Z', call_status: 'completed', call_outcome: 'confirmed' });
    const pending = entry({ id: 'p', scheduled_at: '2026-10-15T01:00:00Z', call_status: 'pending' });
    const [row] = rowsOf([answered, pending]);
    expect(row.rounds.find((x) => x.entry.id === 'p')!.stoppedBy ?? null).toBeNull();
  });
});

describe('🔴 แผง "ผลของวันที่เลือก" + ตัวนับฝั่งเซิร์ฟเวอร์ ใช้กติกาเดียวกัน (ไม่ขึ้นรอโทร)', () => {
  const answered = entry({ id: 'a', scheduled_at: '2026-10-15T00:00:00Z', call_status: 'completed', call_outcome: 'declined' });
  const stopped = entry({ id: 'b', scheduled_at: '2026-10-15T01:00:00Z', call_status: 'cancelled' });

  it('แผงสาย: สาย 08:00 อยู่ช่องยกเลิก ไม่ใช่รอโทร', async () => {
    const { buildFollowCallMatrix } = await import('@/lib/followCallMatrix');
    const m = buildFollowCallMatrix([answered, stopped], NOW);
    expect(m.all.waiting.map((e) => e.id)).not.toContain('b');
    expect(m.all.cancelled.map((e) => e.id)).toContain('b');
  });

  it('คิวยกเลิกแต่ไม่มีสายก่อนหน้าที่ได้คำตอบ = ยังรอโทร (ไม่ซ่อนสายที่เสียจริง)', async () => {
    const { buildFollowCallMatrix } = await import('@/lib/followCallMatrix');
    const lone = entry({ id: 'x', scheduled_at: '2026-10-15T01:00:00Z', call_status: 'cancelled' });
    expect(buildFollowCallMatrix([lone], NOW).all.waiting.map((e) => e.id)).toContain('x');
  });

  it('เซิร์ฟเวอร์ (หน้าหลัก/Dashboard) อ่านด้วยตัวเดียวกัน', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('api/_lib/followCategory.ts', 'utf8');
    expect(src).toContain('const stopped = followStoppedEntries(entries, now);');
    expect(src).toContain("state: stopped.has(e) && !verdict ? 'cancelled' : followRoundState(e, now),");
  });
});

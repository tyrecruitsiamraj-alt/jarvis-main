/**
 * QA 15 พ.ย. 2569 เรื่องที่ 3 "งานค้างที่จอไม่เตือน" — แท็บส่งคนแทน สาย AI 05:00–07:45 ขึ้น
 * "ส่งให้ AI แล้ว ยังไม่มีผลกลับ" ค้าง 10 ชม. ไม่มีป้ายเลยเวลา
 * ไล่ฐานจริง: 19 สาย คิวถูกยกเลิกตั้งแต่เย็นวันก่อน เพราะสายคอนเฟิร์ม 16:00 ตอบแล้ว (เซิร์ฟเวอร์หยุดสายของใบงานเดียวกัน)
 * แต่จอดูคำตอบแค่วันเดียวกัน ⇒ ต้องใช้กติกาเดียวกับเซิร์ฟเวอร์ (`followSameStopUnitSql`: คนแทน = ใบงานเดียวกัน)
 * + สาย AI ไม่มีผลหลายสายของคนเดียวกันเคยกันกันเองไม่ให้ขึ้นกองคนตาม
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '@/lib/followApi';
import { buildFollowCallQueue, followAtRiskCalls } from '@/lib/followCallQueue';
import { groupFollowEntries } from '@/lib/followGrouping';
import { buildFollowDayPeople, buildFollowPlanningRows, followRoundLabel } from '@/lib/followPlanning';

const NOW = new Date('2026-11-15T03:00:00Z'); // 10:00 ไทย

function entry(over: Partial<FollowEntry>): FollowEntry {
  return {
    id: over.id ?? 'e',
    recipient_name: 'ชิตชล ทดสอบ',
    recipient_phone: '0811111111',
    topic: 'ติดตามส่งคนแทน',
    group_id: 'g-replace',
    follow_team: 'replacement',
    cancelled: false,
    call_mode: 'ai',
    call_status: 'pending',
    call_outcome: null,
    ...over,
  } as FollowEntry;
}

const rowsOf = (entries: FollowEntry[]) => buildFollowPlanningRows(groupFollowEntries(entries), NOW);

describe('คนแทน: ตอบตอนคอนเฟิร์มวันก่อน → สายเช้าของใบงานเดียวกันจบ', () => {
  const confirm = entry({ id: 'c', source_ref: 'irecruit-replace:SQT-0662E9470:confirm:bef0f5f3a0', scheduled_at: '2026-11-14T09:00:00Z', call_status: 'completed', call_outcome: 'confirmed' });
  const lead60 = entry({ id: 'l60', source_ref: 'irecruit-replace:SQT-0662E9470:lead60:bef0f5f3a0', scheduled_at: '2026-11-14T22:00:00Z', call_status: 'cancelled' });
  const lead15 = entry({ id: 'l15', source_ref: 'irecruit-replace:SQT-0662E9470:lead15:bef0f5f3a0', scheduled_at: '2026-11-14T22:45:00Z', call_status: 'cancelled' });

  it('สาย 05:00 / 05:45 = ยกเลิก ป้ายบอกว่าสายคอนเฟิร์มวันก่อนตอบแล้ว', () => {
    const [row] = rowsOf([confirm, lead60, lead15]);
    for (const id of ['l60', 'l15']) {
      const r = row.rounds.find((x) => x.entry.id === id)!;
      expect(r.state, id).toBe('cancelled');
      expect(followRoundLabel(r)).toMatch(/^ไม่โทร · สาย 16:00 วันก่อน ตอบ/);
    }
  });
  it('ไม่อยู่กอง "สายที่จะไม่ถูกโทร"', () => {
    expect(followAtRiskCalls(rowsOf([confirm, lead60, lead15]), NOW)).toEqual([]);
  });
  it('ใบงานอื่นของคนเดียวกัน (คนละ SQT) ไม่ถูกหยุด · คิวยังรอ (pending) ไม่แตะ', () => {
    const other = entry({ id: 'o', source_ref: 'irecruit-replace:SQT-794C11224:lead60:bef0f5f3a0', scheduled_at: '2026-11-14T22:00:00Z', call_status: 'cancelled' });
    const pending = entry({ id: 'p', source_ref: 'irecruit-replace:SQT-0662E9470:lead15:bef0f5f3a0', scheduled_at: '2026-11-14T22:45:00Z', call_status: 'pending' });
    const [row] = rowsOf([confirm, other, pending]);
    expect(row.rounds.find((x) => x.entry.id === 'o')!.state).toBe('overdue');
    expect(row.rounds.find((x) => x.entry.id === 'p')!.stoppedBy ?? null).toBeNull();
  });
  it('คนเริ่มงานยังดูวันเดียวกันตามเดิม (คำตอบเมื่อวานไม่หยุดสายวันนี้)', () => {
    const y = entry({ id: 'y', follow_team: null, source_ref: null, scheduled_at: '2026-11-14T00:00:00Z', call_status: 'completed', call_outcome: 'confirmed' });
    const t = entry({ id: 't', follow_team: null, source_ref: null, scheduled_at: '2026-11-15T00:00:00Z', call_status: 'cancelled' });
    const [row] = rowsOf([y, t]);
    expect(row.rounds.find((x) => x.entry.id === 't')!.state).toBe('overdue');
  });
});

describe('สาย AI ไม่มีผลหลายสายของคนเดียวกัน ไม่กันกันเอง', () => {
  it('เลยเวลาเกิน 15 นาทีทั้งคู่ = ขึ้นกองคนตามทั้งคู่ · อีกสายเพิ่งเลยไม่ถึง 15 นาที = ยังรอ AI', () => {
    const a = entry({ id: 'a', follow_team: null, source_ref: null, scheduled_at: '2026-11-15T00:00:00Z', call_status: 'pending' }); // 07:00
    const b = entry({ id: 'b', follow_team: null, source_ref: null, scheduled_at: '2026-11-15T01:00:00Z', call_status: 'pending' }); // 08:00
    const q = buildFollowCallQueue(buildFollowDayPeople(rowsOf([a, b]), '2026-11-15', 'all'), NOW);
    expect(q.staff.map((x) => x.call.round.entry.id).sort()).toEqual(['a', 'b']);
    const soon = new Date('2026-11-15T01:05:00Z'); // 08:05 — สาย 08:00 เพิ่งเลย 5 นาที
    const q2 = buildFollowCallQueue(buildFollowDayPeople(buildFollowPlanningRows(groupFollowEntries([a, b]), soon), '2026-11-15', 'all'), soon);
    expect(q2.staff.map((x) => x.call.round.entry.id)).toEqual([]);
  });
});

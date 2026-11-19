/**
 * ก้อนใบขอภาพรวม (19 พ.ย. 2569): เส้น recruit-stuck ส่งชนิดใบ + id คน AI สนใจ/นัดได้ ต่อใบ
 * id ต้องเป็นชุดเดียวกับตัวนับ `countsOf` (aiYes · appointed) ⇒ เลขในตารางกับรายชื่อที่เด้งขึ้นเท่ากัน
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { aiResultOf, countsOf } from '@/lib/requestPipeline';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

const fact = (id: string, o: Partial<RecruitAppFact>): RecruitAppFact =>
  ({ id, createdAt: '2026-11-05T03:00:00Z', jobId: 'siamraj-sql:OPL6911020', calledByAi: false, calledByStaff: false, aiAnswer: null, appointmentAt: null, ...o }) as RecruitAppFact;

describe('recruit-stuck: ชนิดใบ + id AI สนใจ/นัดได้', () => {
  it('ตัวเลือก id เดียวกับตัวนับ countsOf', () => {
    const fs = [
      fact('app-1a2b', { calledByAi: true, aiAnswer: 'said_yes' }),
      fact('app-3c4d', { calledByAi: true, aiAnswer: 'said_yes', appointmentAt: '2026-11-20T02:00:00Z' }),
      fact('app-5e6f', { calledByAi: true, aiAnswer: 'no_pickup' }),
      fact('app-7a8b', { calledByStaff: true, appointmentAt: '2026-11-21T02:00:00Z' }),
    ];
    const c = countsOf(fs, 0, 0);
    const yes = fs.filter((f) => f.calledByAi && aiResultOf(f) === 'yes').map((f) => f.id);
    const appt = fs.filter((f) => f.appointmentAt).map((f) => f.id);
    expect(yes).toEqual(['app-1a2b', 'app-3c4d']);
    expect(yes.length).toBe(c.aiYes);
    expect(appt.length).toBe(c.appointed);
  });
  it('handler ใช้ตัวเลือกเดียวกัน + ชนิดใบจากใบเปิด/สมุดใบขอ', () => {
    const src = readFileSync('api/_handlers/recruit-stuck.ts', 'utf8');
    expect(src).toContain("aiYesIds: fs.filter((f) => f.calledByAi && aiResultOf(f) === 'yes')");
    expect(src).toContain('apptIds: fs.filter((f) => f.appointmentAt)');
    expect(src).toContain('leadKind: j ? computeJobUrgency(j).kind : ledgerOf(id) ? requestLeadKindFromYmd(');
  });
});

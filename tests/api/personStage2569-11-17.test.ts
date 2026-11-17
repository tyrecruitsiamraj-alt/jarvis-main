import { describe, expect, it } from 'vitest';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { PERSON_GROUPS, PERSON_GROUP_OF, PERSON_STAGES, personStageOf, personStagesOf } from '@/lib/personStage';

const NOW = new Date('2026-11-17T20:00:00+07:00');
let seq = 0;
/** ใบสมัครหน้าตาเหมือนของจริง (id uuid · เวลา ISO) */
function app(p: Partial<RecruitAppFact>): RecruitAppFact {
  seq += 1;
  return {
    id: `5f0c8a1e-3b2d-4c7a-9e11-${String(seq).padStart(12, '0')}`,
    createdAt: '2026-11-03T02:15:00.000Z',
    jobId: 'siamraj-sql:OPL6808001',
    bu: 'LBD',
    channelLabel: 'Facebook · Facebook Group · หางานขับรถ',
    referralSource: null,
    position: null,
    phoneOk: true,
    calledByAi: false,
    calledByStaff: false,
    firstCalledAt: null,
    aiAnswer: null,
    aiAnswerAt: null,
    staffAnswer: null,
    staffAnswerAt: null,
    staffLastAt: null,
    contact: null,
    contactBy: null,
    logOk: null,
    logReason: null,
    logAt: null,
    appointmentAt: null,
    attendance: null,
    onBoard: null,
    informed: false,
    ...p,
  };
}
const interested = { calledByAi: true, aiAnswer: 'said_yes' as const, aiAnswerAt: '2026-11-03T03:00:00.000Z' };

describe('สถานะผู้สมัครรายคน (ใบที่มีชื่อติดตรงไหน · 17 พ.ย. 2569)', () => {
  it('ทางหลักตามที่เจ้าของเล่า', () => {
    expect(personStageOf(app({}), NOW)).toBe('noQueue');
    expect(personStageOf(app({ ...interested }), NOW)).toBe('unclaimed');
    expect(personStageOf(app({ ...interested, claimedBy: 'แบงค์' }), NOW)).toBe('claimedNotCalled');
    expect(personStageOf(app({ ...interested, calledByStaff: true, logOk: false }), NOW)).toBe('unreachable');
    expect(personStageOf(app({ ...interested, calledByStaff: true, logOk: true, contact: 'success', contactBy: 'staff' }), NOW)).toBe('undecided');
    expect(personStageOf(app({ ...interested, calledByStaff: true, logOk: true, appointmentAt: '2026-11-10T02:00:00.000Z' }), NOW)).toBe('overdue');
    expect(personStageOf(app({ ...interested, appointmentAt: '2026-11-25T02:00:00.000Z' }), NOW)).toBe('upcoming');
    expect(personStageOf(app({ appointmentAt: '2026-11-10T02:00:00.000Z', attendance: 'no_show' }), NOW)).toBe('noShow');
    expect(personStageOf(app({ appointmentAt: '2026-11-10T02:00:00.000Z', attendance: 'showed' }), NOW)).toBe('screening');
    expect(personStageOf(app({ informed: true }), NOW)).toBe('informed');
  });
  it('คนหนึ่งอยู่สถานะเดียว · 17 สถานะอยู่ใน 8 ขั้นหลักครบ · รวมกันเท่าจำนวนคน', () => {
    const list = [app({}), app({ ...interested }), app({ informed: true }), app({ ...interested, claimedBy: 'คิว' })];
    const stages = personStagesOf(list, NOW);
    expect(Object.values(stages).reduce((n, l) => n + (l?.length ?? 0), 0)).toBe(list.length);
    for (const k of PERSON_STAGES) expect(PERSON_GROUPS).toContain(PERSON_GROUP_OF[k]);
  });
});

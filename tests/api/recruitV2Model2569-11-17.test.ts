import { describe, expect, it } from 'vitest';
import type { RecruitAppFact, RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import { buildV2Model, V2_METRICS } from '@/components/dashboard-trends/v2/v2Model';

let seq = 0;
/** ใบสมัครหน้าตาเหมือนของจริง (id uuid · เวลา ISO · ช่องทางแบบ "Facebook · Facebook Group · <กลุ่ม>") */
function app(p: Partial<RecruitAppFact>): RecruitAppFact {
  seq += 1;
  const n = String(seq).padStart(12, '0');
  return {
    id: `7c1e0a55-2b1f-4d0e-8a3c-${n}`,
    createdAt: '2026-11-03T02:15:00.000Z',
    jobId: 'siamraj-sql:OPL6911056',
    bu: 'LBD',
    channelLabel: 'Facebook · Facebook Group · พนักงานขับรถมืออาชีพ (หางานขับรถ,หาคนขับรถ)',
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
    age: 38,
    homeProvince: 'กรุงเทพมหานคร',
    ...p,
  };
}
const interested = { calledByAi: true, aiAnswer: 'said_yes' as const, aiAnswerAt: '2026-11-03T03:00:00.000Z' };
const viaAi = { ...interested, calledByStaff: true, logOk: true, contact: 'success' as const, contactBy: 'staff' as const };
const staffOnly = { calledByStaff: true, logOk: true, contact: 'success' as const, contactBy: 'staff' as const };

function response(apps: RecruitAppFact[]): RecruitOverviewResponse {
  return {
    apps,
    generatedAt: '2026-11-17T08:55:00.000+07:00',
    window: { from: '2026-11-01', to: '2026-11-17', all: false, asOf: null },
  } as unknown as RecruitOverviewResponse;
}

describe('ภาพรวม v2: ยอดย่อยของทุกขั้นรวมกันเท่ายอดขั้นนั้น (ACCEPTANCE A2 · 17 พ.ย. 2569)', () => {
  const list = [
    app({ ...viaAi, appointmentAt: '2026-11-10T02:00:00.000Z', attendance: 'showed', screening: 'passed' } as Partial<RecruitAppFact>),
    app({ ...viaAi, appointmentAt: '2026-11-11T02:00:00.000Z', attendance: 'no_show' }),
    // คนโทรเองนัดได้ — ไม่ผ่าน AI แต่ต้องอยู่ในผลนัด
    app({ ...staffOnly, appointmentAt: '2026-11-12T02:00:00.000Z', attendance: 'showed' }),
    app({ ...staffOnly, appointmentAt: '2026-11-20T02:00:00.000Z' }),
    app({ ...staffOnly, appointmentAt: '2026-11-13T02:00:00.000Z' }),
    app({ ...interested }),
    app({}),
  ];
  const m = buildV2Model(response(list));

  it('นัดได้ทั้งหมด: ที่มา และ ผลนัด ต่างรวมได้เท่านัดได้ (ผลนัดไม่ได้นับแค่สาย AI)', () => {
    const st = m.stages.allBooked;
    const ids = new Set(st.ids ?? []);
    expect(ids.size).toBe(5);
    const attend = st.parts.filter((p) => p.key.startsWith('attend:'));
    const source = st.parts.filter((p) => !p.key.startsWith('attend:'));
    for (const group of [attend, source]) {
      const flat = group.flatMap((p) => p.ids);
      expect(flat.length).toBe(ids.size);
      expect(new Set(flat)).toEqual(ids);
    }
    expect(Object.fromEntries(attend.map((p) => [p.key, p.ids.length]))).toEqual({
      'attend:showed': 2,
      'attend:noShow': 1,
      'attend:upcoming': 1,
      'attend:overdue': 1,
    });
  });

  it('มาตามนัด: ผลคัดเลือกรวมได้เท่าคนที่มา (รวมคนโทรเองนัด)', () => {
    const st = m.stages.showed;
    expect(st.ids).toHaveLength(2);
    expect(st.parts.flatMap((p) => p.ids).sort()).toEqual([...(st.ids ?? [])].sort());
  });

  it('ทุกขั้นที่มียอดย่อย: ผลรวมยอดย่อย = ยอดขั้น ไม่ซ้อนไม่ตกหล่น', () => {
    for (const k of V2_METRICS) {
      const st = m.stages[k];
      if (!st.ids || st.parts.length === 0 || k === 'allBooked') continue;
      const flat = st.parts.flatMap((p) => p.ids);
      expect(flat.length, k).toBe(st.ids.length);
      expect(new Set(flat), k).toEqual(new Set(st.ids));
    }
  });

  it('ตัวกรองบนสุด (keep) ตัดรายชื่อทั้งชุดก่อนคิดทุกขั้น', () => {
    const only = buildV2Model(response(list), (f) => f.contactBy === 'staff');
    expect(only.cohort).toHaveLength(5);
    expect(only.stages.apps.ids).toHaveLength(5);
  });
});

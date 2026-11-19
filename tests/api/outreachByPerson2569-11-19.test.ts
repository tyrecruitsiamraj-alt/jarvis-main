/**
 * การสั่งงานรายคน (เจ้าของ 19 พ.ย. 2569 "Autopost เท่าไหร่ โพสต์เองเท่าไหร่ แล้วโพสต์เองอะเป็น Genlink หรือ โพสต์")
 */
import { describe, expect, it } from 'vitest';
import { outreachByPerson, outreachTotals } from '@/lib/outreachByPerson';
import type { StaffActivityRow } from '@/lib/staffActivity';
import type { ManualLinkRow } from '@/lib/jobPostActions';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

const staff = (name: string, p: Partial<StaffActivityRow>): StaffActivityRow => ({ userId: `u-${name}`, name, bu: 'LBD', day: '2026-11-18', autopost: 0, scrap: 0, links: 0, manualPosted: 0, contacts: 0, appts: 0, ...p });
const link = (by: string, p: Partial<ManualLinkRow>): ManualLinkRow => ({ linkId: `${by}-${Math.random()}`, jobId: 'siamraj-sql:OPL6911001', day: '2026-11-18', place: 'Facebook · Facebook Group · กลุ่มคนขับรถ', by, posted: false, clicks: 0, applicants: 0, ...p });

describe('การสั่งงานรายคน', () => {
  it('Autopost/Scrap จากงานรายคน (รวมหลายวัน) · โพสต์เองแยก Gen link / โพสต์แล้ว + คลิก/กรอก · คนที่ไม่ได้สั่งอะไรไม่ขึ้น · รวมลงตัว', () => {
    const rows = outreachByPerson(
      [staff('เจมส์', { autopost: 3 }), staff('เจมส์', { autopost: 2, scrap: 1, day: '2026-11-19' }), staff('ครีม', { contacts: 6 })],
      [link('ใหม่', { posted: true, clicks: 10, applicants: 2 }), link('ใหม่', { clicks: 5 }), link('เจมส์', { clicks: 1 })],
    );
    // ไม่มีรายชื่อ = เรียงตามงานรวม (เจมส์ 7 · ครีม 6 · ใหม่ 2) · 19 พ.ย. 2569 รวมงานรายคนเข้ามา: คนที่ลงผลติดต่ออย่างเดียว (ครีม) ขึ้นด้วย
    expect(rows.map((r) => r.name)).toEqual(['เจมส์', 'ครีม', 'ใหม่']);
    expect(rows[2]).toMatchObject({ autopost: 0, gen: 1, posted: 1, clicks: 15, applicants: 2 });
    expect(rows[0]).toMatchObject({ autopost: 5, scrap: 1, gen: 1, posted: 0, clicks: 1 });
    expect(rows[1]).toMatchObject({ contacts: 6, appts: 0 });
    expect(rows[1].userId).toBeTruthy();
    expect(outreachTotals(rows)).toMatchObject({ autopost: 5, scrap: 1, gen: 2, posted: 1, clicks: 16, applicants: 2, contacts: 6 });
  });

  it('รายชื่อของคนนั้น → สนใจ → นัด → มาจริง ใช้กล่องชุดเดียวกับรายชื่อเข้ามาไปถึงไหน · รวมทุกแถว = รายชื่อทั้งหมด (เจ้าของ "เจมส์รายชื่อทั้งหมดเท่าไหร่ ไปจนถึงนัดแล้วมา")', () => {
    let n = 0;
    const f = (p: Partial<RecruitAppFact>): RecruitAppFact =>
      ({ id: `5c1d${String((n += 1)).padStart(4, '0')}-6b2e-4c1a-9d3e-2a7b5c8e1f00`, createdAt: '2026-11-17T03:00:00Z', jobId: 'siamraj-sql:OPL6911059', calledByAi: false, calledByStaff: false, aiAnswer: null, appointmentAt: null, attendance: null, postSource: 'manual', ...p }) as RecruitAppFact;
    const cohort = [
      f({ bringer: 'เจมส์' }),
      f({ bringer: 'เจมส์', calledByAi: true, aiAnswer: 'said_yes', appointmentAt: '2026-11-18T02:00:00Z', attendance: 'showed' }),
      f({ bringer: 'เจมส์', calledByAi: true, aiAnswer: 'said_yes' }),
      f({ bringer: 'ว่าน' }),
    ];
    const rows = outreachByPerson([], [], cohort);
    const james = rows.find((r) => r.name === 'เจมส์');
    expect([james?.names.length, james?.interested.length, james?.booked.length, james?.showed.length]).toEqual([3, 2, 1, 1]);
    expect(rows.map((r) => r.name)).toEqual(['เจมส์', 'ว่าน']);
    expect(outreachTotals(rows).names).toHaveLength(cohort.length);
  });
});

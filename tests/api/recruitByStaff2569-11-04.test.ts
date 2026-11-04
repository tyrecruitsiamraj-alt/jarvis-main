/**
 * ภาพรวมงานสรรหา รายคน (เจ้าของ 4 พ.ย. 2569)
 * 1) "รายชื่อที่เข้ามาเนี่ย เป็นงานใครเท่าไหร่ แล้วเป็นงานไหนบ้าง เช่น แบงค์ เข้ามา 50 คน แบ่งเป็น งาน ก 5 ข 5 ค 40"
 * 2) "แบงค์เก็บไปหน้าการติดต่อ 30 โทรแล้ว 30 ติดต่อได้เท่าไหร่ ติดต่อไม่ได้เท่าไหร่ รอโทรเท่าไหร่ … นัดได้เท่าไหร่"
 * 🔴 ทุกชั้นบวกกันเท่าแม่
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NO_RECRUITER, NO_REQUEST, appsByRecruiter, recruiterJobLabel } from '@/lib/recruitByRecruiter';
import { buildClaimRows } from '@/lib/recruitContactTab';
import type { RecruitAppFact, RecruitAppJob } from '@/lib/recruitOverviewTypes';

const fact = (id: string, p: Partial<RecruitAppFact>): RecruitAppFact =>
  ({
    id,
    createdAt: '2026-11-03T03:00:00Z',
    jobId: null,
    channelLabel: null,
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
    ...p,
  }) as RecruitAppFact;

const JOBS: Record<string, RecruitAppJob> = {
  'siamraj-sql:OPL6911008': { requestNo: 'OPL6911008', unitName: 'หลักทรัพย์ภัทร', position: 'พนักงานขับรถผู้บริหาร', recruiter: 'แบงค์' },
  'siamraj-sql:OPL6911011': { requestNo: 'OPL6911011', unitName: 'krungsri', position: 'พนักงานขับรถ', recruiter: 'แบงค์' },
  'siamraj-sql:LMO6801013': { requestNo: 'LMO6801013', unitName: null, position: 'คนสวน', recruiter: 'ตังเมย์' },
  'siamraj-pre:LBM6910004': { requestNo: 'LBM6910004', unitName: null, position: null, recruiter: null },
};

describe('รายชื่อที่กรอกมา แยกตามเจ้าหน้าที่สรรหา → ใบขอ', () => {
  const apps = [
    ...['a1', 'a2', 'a3'].map((id) => fact(id, { jobId: 'siamraj-sql:OPL6911008' })),
    fact('a4', { jobId: 'siamraj-sql:OPL6911011' }),
    fact('a5', { jobId: 'siamraj-sql:LMO6801013' }),
    fact('a6', { jobId: 'siamraj-pre:LBM6910004' }),
    fact('a7', { jobId: 'siamraj-sql:OPL6999999' }), // ไม่อยู่ในดัชนี
    fact('a8', { jobId: null }),
  ];
  const rows = appsByRecruiter(apps, JOBS);

  it('คนเรียงมากไปน้อย · ยังไม่ได้ตั้งเจ้าหน้าที่ / ไม่ผูกใบขอ อยู่ท้าย', () => {
    expect(rows.map((r) => [r.name, r.count])).toEqual([
      ['แบงค์', 4],
      ['ตังเมย์', 1],
      [NO_RECRUITER, 2],
      [NO_REQUEST, 1],
    ]);
  });

  it('แตกเป็นรายใบ มากไปน้อย · ป้าย = เลขที่ใบ · ตำแหน่ง · หน่วยงาน', () => {
    expect(rows[0].jobs.map((j) => [j.label, j.count, j.ids])).toEqual([
      ['OPL6911008 · พนักงานขับรถผู้บริหาร · หลักทรัพย์ภัทร', 3, ['a1', 'a2', 'a3']],
      ['OPL6911011 · พนักงานขับรถ · krungsri', 1, ['a4']],
    ]);
    // ใบที่ไม่อยู่ในดัชนี = เลขที่ใบจาก id ไม่เดาชื่องาน
    expect(recruiterJobLabel('siamraj-sql:OPL6999999', undefined)).toBe('OPL6999999');
    expect(rows[2].jobs.map((j) => j.label).sort()).toEqual(['LBM6910004', 'OPL6999999']);
  });

  it('🔴 ลูกรวมเท่าแม่ · ทุกคนรวมเท่ารายชื่อทั้งหมด', () => {
    for (const r of rows) expect(r.jobs.reduce((s, j) => s + j.count, 0)).toBe(r.count);
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(apps.length);
  });

  it('อ่านใบขอไม่ได้ (null) = ทุกใบเป็น "ยังไม่ได้ตั้งเจ้าหน้าที่" ไม่หาย', () => {
    const r = appsByRecruiter(apps, null);
    expect(r.reduce((s, x) => s + x.count, 0)).toBe(apps.length);
  });
});

describe('เก็บไปหน้าการติดต่อ แยกรายคน', () => {
  const now = new Date('2026-11-04T07:00:00Z');
  const apps = [
    fact('c1', { claimedBy: 'แบงค์' }), // รอโทร
    fact('c2', { claimedBy: 'แบงค์', logOk: false }), // ติดต่อไม่ได้
    fact('c3', { claimedBy: 'แบงค์', logOk: true }), // ติดต่อได้ ยังไม่ลงนัด
    fact('c4', { claimedBy: 'แบงค์', logOk: true, appointmentAt: '2026-11-05T02:00:00Z' }), // นัดได้
    fact('c5', { claimedBy: 'ตังเมย์', contactBy: 'staff', contact: 'success', appointmentAt: '2026-11-01T02:00:00Z', attendance: 'showed' }),
    fact('c6', { claimedBy: null, logOk: true }), // ไม่มีใครเก็บ = ไม่นับ
  ];
  const { total, people } = buildClaimRows(apps, now);

  it('ต่อคน: เก็บไป · รอโทร · โทรแล้ว · ติดต่อไม่ได้ · ติดต่อได้ · นัดได้ · มา', () => {
    const bank = people[0];
    expect([bank.name, bank.total, bank.counts.waiting, bank.called, bank.counts.fail, bank.ok, bank.booked]).toEqual(['แบงค์', 4, 1, 3, 1, 2, 1]);
    expect(people[1].name).toBe('ตังเมย์');
    expect(people[1].counts.showed).toBe(1);
  });

  it('🔴 เก็บไป = รอโทร + โทรแล้ว · โทรแล้ว = ติดต่อไม่ได้ + ติดต่อได้ · คนรวมเท่าแถวรวม · ใบที่ไม่มีใครเก็บไม่นับ', () => {
    for (const r of [...people, total]) {
      expect(r.counts.waiting + r.called).toBe(r.total);
      expect(r.counts.fail + r.ok).toBe(r.called);
      expect(r.ids.called).toHaveLength(r.called);
    }
    expect(total.total).toBe(5);
    expect(people.reduce((s, p) => s + p.total, 0)).toBe(total.total);
  });
});

describe('ต่อสาย', () => {
  it('API ส่งใบขอ + เจ้าหน้าที่สรรหา และชื่อคนเก็บ · หน้าวางการ์ดทั้งสอง', () => {
    const api = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
    expect(api).toContain('body.appJobs = await loadAppJobs(');
    expect(api).toContain("end as claimed_by");
    expect(api).toContain('claimedBy: text(r.claimed_by),');
    expect(api).toContain('const assigned = await getUnitAssignmentsMap(');
    expect(readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8')).toContain('<RecruiterAppsCard');
    expect(readFileSync('src/components/dashboard-trends/ContactTab.tsx', 'utf8')).toContain('<ClaimCard total={claims.total} people={claims.people}');
  });
});

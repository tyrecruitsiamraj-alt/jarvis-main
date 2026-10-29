// @vitest-environment node
/**
 * QA 17 ต.ค. 2569 กลุ่ม "ตัวเลขไม่ตรงกัน" (docs/qa-2569-10-17.md หัวข้อ ข.) — เจ้าของเลือกแก้ 18 ต.ค. 2569
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mergeRequestControlJobs } from '../../src/lib/requestControl';
import { trimLastDayToNow, type RecruitAppFact } from '../../src/lib/recruitOverview';
import type { JobRequest } from '../../src/types';

const read = (p: string) => readFileSync(p, 'utf8');

describe('26 · หน้าหลักไม่นับใบที่ยกเลิกข้อมูลแล้ว (กติกาเดียวกับทีม Online)', () => {
  it('homeAiShareSql ตัดใบใน application_cancellations', () => {
    const src = read('api/_lib/homeAiShareSql.ts');
    expect(src).toContain("tableInAppSchema('application_cancellations')");
    expect(src).toContain('and not exists (select 1 from ${CANCELLATIONS} c where c.application_id = a.id)');
  });
});

describe('22 · Dashboard เรียก "หาได้แล้ว" ไม่ใช่ "ปิดแล้ว" (ห้ามปนกับปิดครบใบขอ)', () => {
  it('ป้ายการ์ด/กราฟ/ตาราง ไม่มี "ปิดแล้ว" สำหรับยอดหาได้', () => {
    for (const p of [
      'src/lib/dashboard/throughput.ts',
      'src/lib/dashboard/buildDashboardData.ts',
      'src/lib/dashboard/lifecycle.ts',
      'src/components/dashboard/analytics/DashboardThroughputChart.tsx',
      'src/components/dashboard/analytics/DashboardLifecycleBoard.tsx',
      'src/components/dashboard/analytics/DashboardLifecycleMonthlyPanel.tsx',
    ]) {
      expect(read(p), p).not.toMatch(/label: 'ปิดแล้ว'|filled: 'ปิดแล้ว'|'filled', 'ปิดแล้ว'|>ปิดแล้ว<| · ปิดแล้ว\{/);
    }
  });
});

describe('21 · ไม่มีป้าย "(= การ์ดคงเหลือ)" ที่เขียนตายตัวแล้ว', () => {
  it('ทุกไฟล์ Dashboard', () => {
    for (const p of [
      'src/lib/dashboard/buildDashboardData.ts',
      'src/components/dashboard/analytics/DashboardThroughputChart.tsx',
      'src/components/dashboard/analytics/DashboardLifecycleBoard.tsx',
    ]) {
      expect(read(p), p).not.toContain('(= การ์ดคงเหลือ)');
    }
  });
});

describe('20 · ตาราง SLA เลือกช่วงแล้วใบเปิดตัดตามช่วง', () => {
  it('slaControlRecords ใช้ scopedJobs เมื่อมี period', () => {
    const src = read('src/pages/dashboard/SupervisorDashboard.tsx');
    expect(src).toContain('if (period) return jobsToRequestControlRecords(mergeRequestControlJobs(scopedJobs, scopedClosedJobs));');
  });
});

describe('29 · ใบขอชั่วคราวเลขซ้ำใบจริง ไม่ถูกรวมเป็นใบเดียว', () => {
  it('คีย์ใบพรีด้วย id · ใบจริงเลขเดียวกันยังรวมกับชุดใบปิดได้', () => {
    const real = { id: 'siamraj-sql:OPL1', request_no: 'OPL1' } as JobRequest;
    const pre = { id: 'siamraj-pre:OPL1', request_no: 'OPL1' } as JobRequest;
    const closed = { id: 'siamraj-sql:OPL1', request_no: 'OPL1', filled_positions: 2 } as JobRequest;
    const out = mergeRequestControlJobs([real, pre], [closed]);
    expect(out).toHaveLength(2);
    expect(out.find((j) => j.id === 'siamraj-sql:OPL1')?.filled_positions).toBe(2);
  });
});

describe('23 · Rate ผลการโทร Lumos', () => {
  const src = read('api/_handlers/lumos-call-funnel.ts');
  it('มีต้นทาง "ผู้สมัคร" (app-) · ชิปบนแผงครบ', () => {
    expect(src).toContain("applicant: `q.person_ref like 'app-%'`");
  });
  it('"ยังไม่ถึงมือ Lumos" ไม่นับสายที่นัดโทรทีหลัง', () => {
    expect(src).toContain('count(*) filter (where ${pend} and ${due})::text as not_delivered');
    expect(src).toContain('count(*) filter (where ${pend} and not (${due}))::text as scheduled_later');
  });
});

describe('33 · ภาพรวม "วันนี้" เทียบเมื่อวานถึงเวลาเดียวกัน', () => {
  const fact = (createdAt: string) => ({ createdAt }) as RecruitAppFact;
  it('วันท้ายของช่วงก่อนตัดที่เวลาเดียวกับตอนนี้ (เวลาไทย) · วันอื่นไม่แตะ', () => {
    const apps = [
      fact('2026-10-17T02:00:00Z'), // 09:00 ไทย 17 ต.ค.
      fact('2026-10-17T08:00:00Z'), // 15:00 ไทย 17 ต.ค. — หลังเวลาตอนนี้ ตัดออก
      fact('2026-10-16T10:00:00Z'), // 17:00 ไทย 16 ต.ค. — คนละวัน คงไว้
    ];
    const out = trimLastDayToNow(apps, '2026-10-17', '2026-10-18T05:00:00Z'); // ตอนนี้ 12:00 ไทย
    expect(out.map((f) => f.createdAt)).toEqual(['2026-10-17T02:00:00Z', '2026-10-16T10:00:00Z']);
  });
});

describe('30 · ติดตาม › เลขบนตัวเลือก "ใครโทร" กรองช่วงเวลาเหมือนตาราง + บอกหน่วย', () => {
  it('ใช้ fBand และต่อท้าย "สาย"', () => {
    const src = read('src/pages/follow/FollowPage.tsx');
    expect(src).toContain("filterFollowEntries(panelByOwner, { date: '', band: fBand, caller: 'all' })");
    expect(src).toContain("${callerCounts[c].toLocaleString('th-TH')} สาย`");
  });
});

describe('25 · หน้าหลัก › ติดตาม: กล่อง AI/คน = ป๊อป', () => {
  it('SQL ใครโทรตัดสายที่ยกเลิกเหมือน followCallerOf', () => {
    expect(read('api/_lib/homeAiShareSql.ts')).toMatch(/FOLLOW_MANUAL_BUT_AI_CALLED_SQL = `\(f\.call_mode = 'manual'[^`]*f\.cancelled_at is null/);
    expect(read('api/_lib/homeLumosSummarySql.ts')).toMatch(/FOLLOW_EFFECTIVE_MODE_SQL = `case[^`]*f\.cancelled_at is null/);
  });
  it('ลำดับแถวผลโทรบนจอ มีสมาชิกครบเท่าชุดกลาง', async () => {
    const { FOLLOW_CALLED_KEYS, FOLLOW_CALLED_DISPLAY_ORDER } = await import('../../src/lib/homeLumosSummary');
    expect([...FOLLOW_CALLED_DISPLAY_ORDER].sort()).toEqual([...FOLLOW_CALLED_KEYS].sort());
  });
});

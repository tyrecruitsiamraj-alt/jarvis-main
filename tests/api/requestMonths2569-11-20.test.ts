/**
 * กราฟรายเดือนของก้อนใบขอ (เจ้าของ 20 พ.ย. 2569 "ถ้าฉันเลือก ตุลา พฤจิกา ก็เห็นว่าจากตุลามาพฤศจิกา มันลดลงหรือเพิ่มขึ้น")
 * เดือนในช่วงตัดหัวท้ายตามช่วงที่เลือก ⇒ ทุกเดือนต่อกันพอดีช่วง ไม่มีวันซ้ำ ไม่มีวันหาย
 * เส้น `part=months` ใช้ตัวโหลดเดียวกับใบของหน้า (เลขของเดือน = เลขที่ได้เมื่อเลือกเดือนนั้นเดือนเดียว)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { STUCK_MONTHS_MAX, monthWindowLabel, monthWindowsOf } from '@/lib/recruitStuck';

describe('monthWindowsOf', () => {
  it('ช่วงข้ามเดือน: เดือนหัว/ท้ายตัดตามช่วง ทุกเดือนต่อกันพอดี', () => {
    expect(monthWindowsOf('2026-10-15', '2026-11-20')).toEqual([
      { month: '2026-10', from: '2026-10-15', to: '2026-10-31' },
      { month: '2026-11', from: '2026-11-01', to: '2026-11-20' },
    ]);
  });
  it('ช่วงในเดือนเดียว = เดือนเดียว เท่าช่วงที่เลือก', () => {
    expect(monthWindowsOf('2026-11-01', '2026-11-20')).toEqual([{ month: '2026-11', from: '2026-11-01', to: '2026-11-20' }]);
  });
  it('ข้ามปี + กุมภาพันธ์ปีอธิกสุรทิน', () => {
    const w = monthWindowsOf('2027-12-01', '2028-02-29');
    expect(w.map((x) => x.month)).toEqual(['2027-12', '2028-01', '2028-02']);
    expect(w[2].to).toBe('2028-02-29');
  });
  it(`ยาวเกิน ${STUCK_MONTHS_MAX} เดือน = เอาเดือนล่าสุด`, () => {
    const w = monthWindowsOf('2024-08-05', '2026-11-20');
    expect(w.length).toBe(STUCK_MONTHS_MAX);
    expect(w[0].month).toBe('2025-12');
    expect(w.at(-1)).toEqual({ month: '2026-11', from: '2026-11-01', to: '2026-11-20' });
  });
  it('ช่วงกลับหัว = ไม่มีเดือน', () => {
    expect(monthWindowsOf('2026-11-20', '2026-11-01')).toEqual([]);
  });
});

describe('monthWindowLabel', () => {
  it('เต็มเดือน = ชื่อเดือน · ไม่เต็มเดือนบอกช่วงวัน · วันเดียวบอกวัน · ข้ามปีต่อท้ายปี พ.ศ.', () => {
    expect(monthWindowLabel({ month: '2026-10', from: '2026-10-01', to: '2026-10-31' })).toBe('ต.ค.');
    expect(monthWindowLabel({ month: '2026-11', from: '2026-11-01', to: '2026-11-20' })).toBe('1–20 พ.ย.');
    expect(monthWindowLabel({ month: '2026-11', from: '2026-11-20', to: '2026-11-20' })).toBe('20 พ.ย.');
    expect(monthWindowLabel({ month: '2026-12', from: '2026-12-01', to: '2026-12-31' }, true)).toBe('ธ.ค. 69');
  });
});

describe('recruit-stuck part=months', () => {
  const src = readFileSync('api/_handlers/recruit-stuck.ts', 'utf8');
  it('ใช้ตัวโหลดใบขอตัวเดียวกับของหน้า ทีละเดือนของช่วง', () => {
    expect(src).toContain('monthWindowsOf(win.from, win.to)');
    expect(src).toContain('loadStuckRequests(departmentScope, buSet, { from: w.from, to: w.to }, today, { lite: true })');
    expect(src).toContain("q === 'monthly' || q === 'daily' || q === 'months' ? q : 'requests'");
  });
  it('โหมด lite ข้ามเฉพาะส่วนที่ไม่กระทบตัวเลขของใบ (ผู้สมัคร · ทะเบียนประกาศ · ลิงก์ · คำขอโพสต์)', () => {
    expect(src).toContain('opts.lite ? [] : loadFactsForJobs(jobIds, null)');
    expect(src).toContain('opts.lite ? [] : listLatestJobPostingsForBoard()');
    // ตัวเลข/สถานะ/ยกมา-ขอใหม่ ของใบ มาจาก base ชุดเดิม ไม่มีทางแยกตาม lite
    expect(src).not.toMatch(/opts\.lite[^\n]*(roleById|requestFlowRole|onlineRowOf)/);
  });
  it('หน้าเว็บ: ช่วงในเดือนเดียวใช้ใบของหน้า ไม่ยิงเพิ่ม', () => {
    const page = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    expect(page).toContain('if (monthWins.length < 2) return;');
    expect(page).toContain("fetchRecruitStuck(data.bu, { from: win.from, to: win.to }, 'months')");
  });
});

describe('ช่วงของโหมดเทียบเดือน', () => {
  it('เทียบเดือนเลือกได้ถึง 12 เดือน · ช่วงวันที่แบบเดิมยังตัดที่ 62 วัน', async () => {
    const { COMPARE_MAX_DAYS, RANGE_MAX_DAYS, rangeWindow } = await import('@/lib/recruitOverviewWindow');
    expect(rangeWindow('2026-09-01', '2026-11-20', '2026-11-20', false, true)?.from).toBe('2026-09-01');
    expect(rangeWindow('2026-09-01', '2026-11-20', '2026-11-20')?.from).not.toBe('2026-09-01');
    expect(RANGE_MAX_DAYS).toBe(62);
    expect(COMPARE_MAX_DAYS).toBeGreaterThanOrEqual(365);
    const src = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
    expect(src).toContain("compare: req.query?.cmp === '1'");
  });
});

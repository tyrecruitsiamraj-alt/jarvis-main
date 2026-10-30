/**
 * หน้าหลักนับ BU ชุดเดียวกันทุกการ์ด · ค่าเริ่ม = รวมทุก BU ในสิทธิ์ (QA 30 ต.ค. 2569 · เจ้าของเลือก "หน้าหลัก BU ตรงกันทั้งหน้า")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buMatchSql, inBuSet, pickDashboardBuSet } from '../../api/_lib/homeBuSql';

describe('pickDashboardBuSet', () => {
  it('หลาย BU: ไม่ขอ = รวมทุก BU ในสิทธิ์ · ขอในสิทธิ์ = BU นั้น · ขอนอกสิทธิ์ = รวมในสิทธิ์', () => {
    const scope = { mode: 'code', code: 'SN', codes: ['SN', 'LBD'] } as never;
    expect(pickDashboardBuSet(scope, undefined)).toMatchObject({ bu: null, buSet: ['SN', 'LBD'] });
    expect(pickDashboardBuSet(scope, 'LBD')).toMatchObject({ bu: 'LBD', buSet: ['LBD'] });
    expect(pickDashboardBuSet(scope, 'LM').buSet).toEqual(['SN', 'LBD']);
  });
  it('BU เดียว = ล็อก · แอดมิน = ตามที่ขอ (ไม่ขอ = ไม่กรอง) · ไม่มีสิทธิ์ = ชุดว่าง', () => {
    expect(pickDashboardBuSet({ mode: 'code', code: 'LBD', codes: ['LBD'] } as never, 'SN')).toMatchObject({ bu: 'LBD', buSet: ['LBD'], forcedBu: 'LBD' });
    expect(pickDashboardBuSet({ mode: 'all' } as never, undefined).buSet).toBeNull();
    expect(pickDashboardBuSet({ mode: 'all' } as never, 'LBD').buSet).toEqual(['LBD']);
    expect(pickDashboardBuSet({ mode: 'none' } as never, undefined).buSet).toEqual([]);
  });
  it('ตัวกรอง SQL/Node ชุดเดียวกัน', () => {
    expect(buMatchSql('x', '$3')).toBe('($3::text[] is null or x = any($3::text[]))');
    expect([inBuSet('SN', null), inBuSet('SN', ['SN']), inBuSet('LM', ['SN']), inBuSet(null, ['SN'])]).toEqual([true, true, false, false]);
  });
});

describe('หน้าหลัก', () => {
  const page = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
  it('ตัวเลือก BU มี "ทุก BU" · ใบขอชั่วคราวกรองตาม BU · เปลี่ยน BU ล้างเลขเก่า', () => {
    expect(page).toMatch(/<BuChoiceSelect value=\{bu\} [^>]*allOption/);
    expect(page).toContain('ใบขอชั่วคราวอีก');
    expect(page).not.toContain('ล่วงหน้าอีก');
    expect(page).toContain('(trendBuFromSiteCode(j.site_code) ?? normalizeTrendBu(j.department_code)) === bu');
    expect(page).toContain('ro.bu === bu');
  });
  it('เส้นข้อมูลหน้าหลักทั้ง 3 ใช้ตัวเลือก BU ตัวเดียวกัน', () => {
    for (const f of ['api/_handlers/home-money.ts', 'api/_handlers/home-ai-share.ts', 'api/_handlers/recruit-overview.ts']) {
      expect(readFileSync(f, 'utf8'), f).toContain('pickDashboardBuSet(');
    }
  });
});

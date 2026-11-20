/**
 * แท็บงานรายคน (เจ้าของ 20 พ.ย. 2569) — ตัวคำนวณ + เส้นอ่านอย่างเดียว + การวางแท็บ
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { defaultStaffPerson, emptyStaffKinds, emptyStaffPersonDay, staffPersonOptions, staffWorkTotal, ymdAddDays, type StaffActivityRow } from '@/lib/staffActivity';

const row = (userId: string, name: string, day: string, o: Partial<StaffActivityRow> = {}): StaffActivityRow => ({ userId, name, bu: 'LBD', day, ...emptyStaffKinds(), ...o });

describe('ตัวคำนวณงานรายคน', () => {
  it('งานทั้งหมดไม่บวกลงนัดซ้ำ (ลงนัดเป็นส่วนหนึ่งของลงผลติดต่อ)', () => {
    expect(staffWorkTotal({ autopost: 2, scrap: 80, links: 161, manualPosted: 125, contacts: 0, appts: 0 })).toBe(368);
    expect(staffWorkTotal({ ...emptyStaffKinds(), contacts: 12, appts: 3 })).toBe(12);
  });
  it('คนเริ่มต้น = งานมากสุดของวันที่ดู › ของช่วง › ไม่มี', () => {
    const rows = [row('u-a1', 'เจมส์', '2026-11-19', { links: 50 }), row('u-b2', 'ใหม่', '2026-11-20', { scrap: 3 }), row('u-a1', 'เจมส์', '2026-11-20', { scrap: 1 })];
    expect(defaultStaffPerson(rows, '2026-11-20')).toBe('u-b2');
    expect(defaultStaffPerson(rows, '2026-11-18')).toBe('u-a1');
    expect(defaultStaffPerson([], '2026-11-20')).toBeNull();
  });
  it('ชื่อซ้ำกันในรายการเลือกคน ต่อท้ายชื่ออีเมลหน้า @', () => {
    const o = staffPersonOptions([row('u-a1', 'เจมส์', '2026-11-20', { links: 1, login: 'pakkorn.k' }), row('u-a2', 'เจมส์', '2026-11-20', { links: 1, login: 'pakorn.k' }), row('u-b2', 'ใหม่', '2026-11-20', { scrap: 1, login: 'kanyanat.y' })]);
    expect(o.map((x) => x.label)).toEqual(['เจมส์ (pakkorn.k) · LBD', 'เจมส์ (pakorn.k) · LBD', 'ใหม่ · LBD']);
  });
  it('ว่าง = 7 วันครบ ทุกช่อง 0 · วันก่อนหน้าข้ามเดือนได้', () => {
    const e = emptyStaffPersonDay('2026-10-26', '2026-11-01', '2026-11-01');
    expect(e.week.map((w) => w.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(e.prevDay).toBe('2026-10-31');
    expect(ymdAddDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('เส้น staff-activity person=1', () => {
  const src = readFileSync('api/_handlers/staff-activity.ts', 'utf8');
  it('อ่านอย่างเดียว · นิยามงานชุดเดียวกับตารางรายคน (EVENTS) · เจ้าของลิงก์ตัวเดียว (LINK_OWNER)', () => {
    const fn = src.slice(src.indexOf('export function personDaySql'), src.indexOf('async function loadPersonDay'));
    expect(fn).not.toMatch(/\b(insert|update|delete|truncate|alter|drop)\b/i);
    expect(fn).toContain('${EVENTS[k]}');
    expect(fn.match(/\$\{LINK_OWNER\}/g)?.length).toBeGreaterThanOrEqual(6);
    // ใบสมัครที่นับตัด Lead/ยกเลิกข้อมูล ทั้งยอดรวมและรายใบ
    expect(fn.match(/\$\{APP_COUNTED\}/g)?.length).toBe(2);
  });
  it('ใบขอใช้คีย์เต็ม (ใบขอชั่วคราวเลขซ้ำใบจริงได้) · คนนอก BU ไม่เห็น · ช่วงยาวเกินไม่รับ', () => {
    expect(src).toContain("const JOB_KEY = `coalesce(p.job_id, 'standalone:' || p.standalone_kind, '—')`;");
    expect(src).toContain("if (!(await userInBu(user, buSet))) return res.status(200).json({ person: null });");
    expect(src).toContain("if (ymdAddDays(from, 31) < to) return sendError(res, 400, 'bad_request', 'ช่วงวันที่ยาวเกินไป');");
  });
  it('รายการที่กดมีเวลาที่ทำ + คีย์ใบขอ ทุกชนิดงาน', () => {
    expect(src).toContain('d(day, title, sub, application_id, request_no, at, job_id)');
  });
});

describe('แท็บของหน้าภาพรวม', () => {
  const page = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
  it('ภาพรวม | งานรายคน · ภาพรวมค้างไว้ตอนสลับแท็บ · กดชื่อในตารางรายคน = ไปแท็บงานรายคนของคนนั้น (ไม่เปิดแผงข้าง)', () => {
    expect(page).toContain('data-testid="ov-tab-staff"');
    expect(page).toContain('<TabsContent value="overview" forceMount className="mt-6 space-y-8 data-[state=inactive]:hidden">');
    expect(page).toContain("setStaffWho(userId);\n            setTab('staff');");
    expect(page).not.toContain('staff:${');
    expect(page).not.toContain('StaffActivityPanel');
  });
});

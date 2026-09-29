/**
 * ═══ BU ของ Dashboard แนวโน้ม = รหัสแผนกชุดเดียว (LBD · LBA · LM · DS · SN · CR) ═══
 *
 * 🔴 ปัญหา: บ้านนี้มี BU สองชุดรหัส
 * - ใบขอ ERP + แผนกของผู้ใช้ = `department_code` → **LBD · LBA · LM · DS · SN · CR**
 * - ใบสมัคร/ประกาศ/ติดตาม (ทางถอย) แปลจาก `site_code` (`homeBu.ts`) → **LBD · LBA · LML · DSL · SNJ · CRS**
 * กรอง "LM" แล้วใบสมัครของไซต์ LML หายเงียบ ๆ ⇒ Dashboard แปลงทุกแหล่งมาเป็นรหัสแผนกก่อนเสมอ
 *
 * ✅ ตารางจับคู่ **วัดจากข้อมูลจริง** ไม่ได้เดา — 28 ก.ย. 2569 ใบขอ ERP 1,168 แถว (เม.ย.–ก.ย. 2569)
 * ที่มีทั้ง site_code และ department_code: LBD→LBD 846 · LBA→LBA 168 · LML→LM 95 · DSL→DS 53 ·
 * SNJ→SN 5 · CRS→CR 1 — **ขัดกัน 0 แถว** · รหัสที่ไม่อยู่ในตาราง = คืนตามเดิม (ห้ามยัดลงถังอื่น)
 */
import { buFromSiteCode, buLabel } from '@/lib/homeBu';

/** ตารางจับคู่ BU ไซต์ → แผนก — ตัวเดียวของทั้งระบบ (ฝั่ง SQL สร้างจากตารางนี้: `trendBuSql` ใน `api/_lib/siteBuSql.ts`) */
export const SITE_BU_TO_DEPT: Readonly<Record<string, string>> = {
  LBD: 'LBD',
  LBA: 'LBA',
  LML: 'LM',
  DSL: 'DS',
  SNJ: 'SN',
  CRS: 'CR',
};

const DEPT_TO_SITE_BU: Record<string, string> = Object.fromEntries(
  Object.entries(SITE_BU_TO_DEPT).map(([site, dept]) => [dept, site]),
);

/** รหัส BU ใด ๆ (แผนก หรือ BU จากไซต์) → รหัสแผนก · ว่าง = null (ไม่รู้ ≠ BU อื่น) */
export function normalizeTrendBu(code: string | null | undefined): string | null {
  const c = String(code ?? '').trim().toUpperCase();
  if (!c) return null;
  return SITE_BU_TO_DEPT[c] ?? c;
}

/**
 * รหัส BU ใด ๆ → **รหัส BU จากไซต์** (LBD · LBA · LML · DSL · SNJ · CRS) — ชุดเดียวกับตัวกรอง BU หน้าแรก
 * ใช้กับของที่ BU มาจากแผนกของคน (งานติดตาม = แผนกของคนคีย์) ให้ไปรวมถังเดียวกับของที่มาจากไซต์
 * ตารางจับคู่ตัวเดียวกับ `normalizeTrendBu` (กลับทิศ) · ว่าง = null · รหัสนอกตาราง = คืนตามเดิม
 */
export function siteBuOf(code: string | null | undefined): string | null {
  const dept = normalizeTrendBu(code);
  if (!dept) return null;
  return DEPT_TO_SITE_BU[dept] ?? dept;
}

/** BU จากรหัสไซต์ แปลงเป็นรหัสแผนกแล้ว */
export function trendBuFromSiteCode(siteCode: string | null | undefined): string | null {
  return normalizeTrendBu(buFromSiteCode(siteCode));
}

/** ป้าย "LM · ดูแลสวน / ภูมิทัศน์" — ชื่อเอาจาก `homeBu.ts` ที่เดียว (ไม่ตั้งชื่อใหม่) */
export function trendBuLabel(dept: string | null | undefined): string {
  const code = normalizeTrendBu(dept);
  if (!code) return 'ไม่ระบุ BU';
  const site = DEPT_TO_SITE_BU[code];
  const full = site ? buLabel(site) : code;
  const name = full.includes(' · ') ? full.slice(full.indexOf(' · ') + 3) : '';
  return name ? `${code} · ${name}` : code;
}

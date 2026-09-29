/**
 * ═══ BU จากรหัสไซต์ ฝั่ง SQL — ตัวเดียวของทุกเส้น ═══
 *
 * BU = ตัวอักษร 3 ตัวหลังเลขปี 2 หลักของรหัสไซต์ (`65LBDL0143` → LBD · `66LML0011` → LML)
 * 🔴 ต้องตรงกับ `buFromSiteCode` ใน `src/lib/homeBu.ts` เป๊ะ (มีเทสต์คุมที่ `tests/api/siteBuSql.test.ts`)
 * 🔴 BU ไม่ได้อยู่ใน prefix เลขที่ใบขอ (prefix = ชนิดใบขอ) — ห้ามแปลจากเลขที่ใบขอ
 * อ่านไม่ออก = NULL (ไม่รู้ ≠ BU อื่น · ห้ามยัดลงถังไหน)
 *
 * เดิมแต่ละเส้นเขียนนิพจน์นี้เอง (home-kpis · dashboard-trends) — ยกมาไว้ที่เดียว 28 ก.ย. 2569
 * ตอนบอร์ดทีมหน้าแรกต้องใช้เป็นเส้นที่สาม
 */
import { SITE_BU_TO_DEPT } from '../../src/lib/trends/bu.js';

export function siteBuSql(col: string): string {
  return `case when ${col} ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(${col} from 3 for 3)) end`;
}

/**
 * ═══ BU กลาง (ชุดรหัสแผนก) ฝั่ง SQL — หน้าหลักโฉม 3 ก้อน + Dashboard (29 ก.ย. 2569) ═══
 *
 * บ้านนี้มี BU สองชุดรหัส (ไซต์ LML/DSL/SNJ/CRS · แผนก LM/DS/SN/CR) — เดิมบางเส้นเทียบข้ามชุด
 * (ติดตาม = แผนกของคนคีย์ `LM` เทียบกับตัวเลือกจากไซต์ `LML` ⇒ ไม่มีวันตรง) ⇒ แปลงทุกแหล่งมาชุดแผนกก่อนเทียบ
 * 🔴 CASE สร้างจากตาราง `SITE_BU_TO_DEPT` ตัวเดียวกับ `normalizeTrendBu` (มีเทสต์เทียบผลทุกค่า)
 * รับได้ทั้งรหัสไซต์และรหัสแผนก · ว่าง = NULL · รหัสนอกตาราง = คืนตามเดิม (ตัวพิมพ์ใหญ่ · ห้ามยัดลงถังอื่น)
 */
export function trendBuSql(codeExpr: string): string {
  const whens = Object.entries(SITE_BU_TO_DEPT)
    .filter(([site, dept]) => site !== dept)
    .map(([site, dept]) => `when '${site}' then '${dept}'`)
    .join(' ');
  return `(case upper(btrim(${codeExpr})) ${whens} else nullif(upper(btrim(${codeExpr})), '') end)`;
}

/** BU กลางจากรหัสไซต์ (`65LBDL0143` → LBD · `66LML0011` → LM) — ตัวเดียวกับ `trendBuFromSiteCode` */
export function trendBuOfSiteSql(siteCol: string): string {
  return trendBuSql(siteBuSql(siteCol));
}

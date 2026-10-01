/**
 * ═══ แยก BU ในตั้งค่า › ผู้ใช้งาน (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * > *"หน้า ผู้ใช้งาน … แยก Bu ให้หน่อย"* → Choice **"ปุ่มเลือก BU"** — แถวปุ่มเหนือตาราง
 * > ทรงเดียวกับปุ่ม Online/Offline · กดแล้วเหลือแค่คนใน BU นั้น
 *
 * 🔴 BU ของบัญชี = แผนกของบัญชี (`department_code`) ผ่าน `normalizeTrendBu` — **นิยามเดียวกับสถานะ Online**
 *    (`api/_handlers/home-presence.ts` ใช้ตัวเดียวกัน) ⇒ ปุ่ม BU กับปุ่ม Online/Offline นับคนชุดเดียวกัน
 * · ลำดับ = ชุดแผนกของบริษัท (`compareBu` · ชุดเดียวกับกราฟหน้าหลัก) · ยังไม่ตั้ง = ท้ายสุด
 * · คำว่า "ยังไม่ตั้ง" = คำเดียวกับช่องแผนกในตารางเดียวกัน
 * ไฟล์นี้ pure — เทสต์ที่ `src/lib/userBuFilter.test.ts`
 */
import { normalizeTrendBu } from '@/lib/trends/bu';
import { compareBu } from '@/lib/homePresence';

/** `'all'` = ทุก BU · `''` = ยังไม่ตั้ง BU · อื่น ๆ = รหัสแผนก (LBD · LBA · LM · DS · SN) */
export type UserBuFilter = string;

export const USER_BU_ALL = 'all';
export const USER_NO_BU_LABEL = 'ยังไม่ตั้ง';

type HasDepartment = { department_code?: string | null };

/** BU ของบัญชี · '' = ยังไม่ตั้ง */
export function userBuOf(u: HasDepartment): string {
  return normalizeTrendBu(u.department_code) ?? '';
}

export function matchesUserBu(u: HasDepartment, filter: UserBuFilter): boolean {
  return filter === USER_BU_ALL || userBuOf(u) === filter;
}

export type UserBuChip = { key: UserBuFilter; label: string; count: number };

/**
 * ปุ่มของแถว BU — "ทั้งหมด" + BU ที่มีคนจริง (ตามลำดับแผนก) + ยังไม่ตั้ง (ถ้ามี)
 * · BU ที่กดค้างอยู่แต่เหลือ 0 คน (เพิ่งย้ายแผนกคนสุดท้ายออก) ยังโชว์ไว้ — ปุ่มที่กดอยู่ต้องไม่หายจากจอ
 * · รวมทุกปุ่ม BU = ยอด "ทั้งหมด" เสมอ (ไม่มีคนหล่นหาย)
 */
export function userBuChips(users: readonly HasDepartment[], selected: UserBuFilter): UserBuChip[] {
  const counts = new Map<string, number>();
  for (const u of users) {
    const k = userBuOf(u);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  if (selected !== USER_BU_ALL && !counts.has(selected)) counts.set(selected, 0);
  return [
    { key: USER_BU_ALL, label: 'ทั้งหมด', count: users.length },
    ...[...counts.keys()].sort(compareBu).map((k) => ({ key: k, label: k || USER_NO_BU_LABEL, count: counts.get(k) ?? 0 })),
  ];
}

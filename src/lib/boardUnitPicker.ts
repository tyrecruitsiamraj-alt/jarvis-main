import type { JobRequest } from '@/types';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';

/**
 * ตัวเลือก **หน่วยงานจากบอร์ด** ของหน้า Follow
 * (เจ้าของสั่ง 18 ส.ค. 2569: *"หน่วยงานก็ทำเหมือนปุ่มเลือกชื่อจากบอร์ด
 * แต่เป็น เลือกหน่วยงานจากบอร์ด"*)
 *
 * เดิมหน่วยงานเป็น `<select>` ยาวเหยียดจากใบขอเปิด 500 ใบ — เลื่อนหาไม่เจอ
 * ตัวนี้ยุบเป็น **รายหน่วยงาน** (หนึ่งไซต์ = หนึ่งแถว) แล้วให้ค้นได้เหมือน picker ชื่อคน
 *
 * 🔴 **คีย์คือ `site_code` ไม่ใช่เลขที่ใบขอ** — งาน Follow เก็บหน่วยงานเป็น snapshot
 * ข้อความ ไม่ใช่ FK ไปใบขอ (ใบขออยู่คนละฐาน · เลขที่ใบซ้ำกันได้ทั้งข้าม BU และ
 * ระหว่างใบขอปกติ/ล่วงหน้า) · ใบขอที่ไม่มีรหัสไซต์ตกไป เพราะเลือกไปก็ระบุหน่วยงานไม่ได้
 */

export type BoardUnitOption = {
  /** รหัสไซต์ — คีย์ของหน่วยงาน (ไม่ซ้ำในลิสต์) */
  siteCode: string;
  unitName: string;
  /** จำนวนใบขอที่ยังเปิดของหน่วยงานนี้ */
  openRequests: number;
  /** อัตราที่ยังต้องหารวมทุกใบของหน่วยงานนี้ */
  remainingPositions: number;
  /** เลขที่ใบขอล่าสุดไว้ให้คนกวาดตายืนยันว่าใช่หน่วยงานที่คิด */
  sampleRequestNo: string | null;
  /** ตำแหน่งที่หน่วยงานนี้กำลังหา (ไม่เกิน 3 ชื่อ) */
  roles: string[];
};

function cleanText(v?: string | null): string {
  return (v || '').trim();
}

/** ยุบใบขอเปิดเป็นรายหน่วยงาน — เรียงตามอัตราที่ยังต้องหามากสุดก่อน */
export function buildBoardUnitOptions(jobs: JobRequest[]): BoardUnitOption[] {
  const byCode = new Map<string, BoardUnitOption & { roleSet: Set<string> }>();

  for (const j of jobs) {
    const siteCode = cleanText(j.site_code);
    // ไม่มีรหัสไซต์ = ระบุหน่วยงานให้งาน Follow ไม่ได้ ข้ามไป (ฟอร์มยังพิมพ์เองได้)
    if (!siteCode) continue;

    let row = byCode.get(siteCode);
    if (!row) {
      row = {
        siteCode,
        unitName: jobBoardCardTitle(j),
        openRequests: 0,
        remainingPositions: 0,
        sampleRequestNo: null,
        roles: [],
        roleSet: new Set<string>(),
      };
      byCode.set(siteCode, row);
    }

    row.openRequests += 1;
    row.remainingPositions += Number(j.position_units) || 0;
    if (!row.sampleRequestNo) row.sampleRequestNo = cleanText(j.request_no) || null;
    const role = cleanText(j.job_description_code_1);
    if (role) row.roleSet.add(role);
  }

  return Array.from(byCode.values())
    .map(({ roleSet, ...row }) => ({ ...row, roles: Array.from(roleSet).slice(0, 3) }))
    .sort((a, b) =>
      b.remainingPositions === a.remainingPositions
        ? a.unitName.localeCompare(b.unitName, 'th')
        : b.remainingPositions - a.remainingPositions,
    );
}

/** ข้อความที่ใช้ค้นฝั่ง client — ชื่อหน่วยงาน / รหัสไซต์ / เลขที่ใบ / ตำแหน่ง */
export function unitSearchBlob(u: BoardUnitOption): string {
  return [u.unitName, u.siteCode, u.sampleRequestNo, ...u.roles]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * กรองหน่วยงานด้วยคำค้น — ทุกคำต้องเจอ (AND) เหมือน picker ชื่อคน
 * คำค้นว่าง = คืนทั้งหมด (ตัดที่ `limit`)
 */
export function filterBoardUnits(
  units: BoardUnitOption[],
  query: string,
  limit = 100,
): BoardUnitOption[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return units.slice(0, limit);
  const out: BoardUnitOption[] = [];
  for (const u of units) {
    const blob = unitSearchBlob(u);
    if (terms.every((t) => blob.includes(t))) out.push(u);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * แปลงแถว audit ของใบขอเป็นข้อความ "ใครแก้อะไรไป" อ่านรู้เรื่อง
 * (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ: *"เพิ่ม log การแก้ไขไว้ด้วยนะหน้ากล่องงาน ว่าใครแก้อะไรไป"*)
 *
 * ข้อจำกัดที่ต้องรู้:
 * - **ผู้รับผิดชอบ/สถานะทำงาน** audit เก็บทั้ง before และ after → diff ได้จริง
 *   โชว์เฉพาะช่องที่เปลี่ยน ("สรรหา: คิว → บี")
 * - **หมายเหตุ/ตัวเลือกใบขอ** audit เก็บแค่ after (ค่าปัจจุบันหลังแก้ ครบทุกช่อง)
 *   → บอกไม่ได้ว่าช่องไหนถูกแตะ โชว์เป็น "ค่าหลังแก้" ตามจริง ไม่เดา
 */

import {
  UNIT_REQUEST_WORK_STATUS_LABELS,
  type UnitRequestWorkStatus,
} from '@/lib/unitRequestWorkStatus';

export type UnitEditLogItem = {
  id: string;
  user_name: string;
  action: string;
  entity_type: string;
  before: unknown;
  after: unknown;
  created_at: string;
};

/** ป้ายหัวรายการต่อ entity — เพิ่ม entity ใหม่ในเส้นประวัติเมื่อไหร่ต้องเติมที่นี่ */
export const UNIT_EDIT_TITLE: Record<string, string> = {
  siamraj_unit_assignment: 'ผู้รับผิดชอบ',
  siamraj_unit_work_status: 'สถานะทำงาน',
  siamraj_unit_note: 'หมายเหตุ/ตัวเลือกใบขอ',
};

const FIELD_LABEL: Record<string, string> = {
  // ผู้รับผิดชอบ (4 บทบาท — online เพิ่มเมื่อ migration 097)
  recruiter_name: 'สรรหา',
  screener_name: 'คัดสรร',
  opl_name: 'OPL',
  online_name: 'ทีม online',
  // สถานะทำงาน
  status: 'สถานะ',
  persons: 'รายชื่อคน',
  person_first_name: 'ชื่อ',
  person_last_name: 'นามสกุล',
  status_date: 'วันที่สถานะ',
  // หมายเหตุ/ตัวเลือกใบขอ
  note: 'โน้ต',
  send_replacement: 'ส่งคนแทน',
  parser_override_text: 'ข้อความที่ใช้แทนใบขอ',
  field_overrides: 'ค่าที่แก้ทับจากใบขอ',
};

/**
 * ค่าว่างทุกแบบเท่ากัน — null/undefined/'' คือ "ไม่ระบุ" เหมือนกัน อย่านับเป็นการเปลี่ยน
 *
 * ⚠️ **สถานะทำงานต้องแปลเป็นไทย** — audit เก็บรหัสดิบ (`waiting_inform`)
 * ปล่อยขึ้นจอคือคนอ่าน log ไม่รู้ว่าคืออะไร (เจอจริงตอนตรวจกับข้อมูลจริง 18 ส.ค. 2569)
 * ⚠️ `persons` เป็น **array ของคน** — นับเป็น "N คน" ไม่ใช่ "N ช่อง"
 */
function norm(key: string, v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่';
  if (key === 'status' && typeof v === 'string') {
    const code = v.trim();
    if (!code) return null;
    return UNIT_REQUEST_WORK_STATUS_LABELS[code as UnitRequestWorkStatus] ?? code;
  }
  if (Array.isArray(v)) {
    // รายชื่อคนบนสถานะทำงาน — โชว์ชื่อถ้าอ่านได้ ไม่งั้นบอกจำนวน
    if (v.length === 0) return null;
    const names = v
      .map((p) =>
        typeof p === 'object' && p !== null
          ? `${(p as Record<string, unknown>).first_name ?? ''} ${(p as Record<string, unknown>).last_name ?? ''}`.trim()
          : String(p).trim(),
      )
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : `${v.length} คน`;
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>);
    return keys.length === 0 ? null : `${keys.length} ช่อง`;
  }
  const s = String(v).trim();
  return s === '' ? null : s;
}

const show = (v: string | null): string => v ?? '—';

/**
 * บรรทัดสรุปการแก้ครั้งนั้น — คืน [] เมื่ออ่านไม่ออก (payload ไม่ใช่ object)
 * ให้ฝั่ง UI ถอยไปโชว์แค่หัวข้อ+คน+เวลา ดีกว่าพัง
 */
export function describeUnitEdit(item: UnitEditLogItem): string[] {
  const after = item.after;
  if (typeof after !== 'object' || after === null) return [];
  const a = after as Record<string, unknown>;
  const b =
    typeof item.before === 'object' && item.before !== null
      ? (item.before as Record<string, unknown>)
      : null;

  const lines: string[] = [];
  for (const key of Object.keys(a)) {
    const label = FIELD_LABEL[key];
    if (!label) continue; // ช่องที่ไม่รู้จัก (เช่น updated_at ที่ติดมากับ row) ข้าม
    const next = norm(key, a[key]);
    if (b) {
      const prev = norm(key, b[key]);
      if (prev === next) continue; // ไม่เปลี่ยน = ไม่ต้องพูดถึง
      lines.push(`${label}: ${show(prev)} → ${show(next)}`);
    } else if (next !== null) {
      // ไม่มี before (เส้นหมายเหตุ) — บอกเป็นค่าหลังแก้ ไม่เดาว่าช่องไหนถูกแตะ
      lines.push(`${label}: ${show(next)}`);
    }
  }
  return lines;
}

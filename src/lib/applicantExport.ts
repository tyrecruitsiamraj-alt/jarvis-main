/**
 * ═══ ปุ่ม "รายงาน" ของแท็บผู้สมัคร — ส่งออกรายชื่อชุดที่กรองอยู่เป็นไฟล์ (เติมจาก iRecruit 4 ต.ค. 2569) ═══
 * ไฟล์ .csv มี BOM ⇒ เปิดใน Excel ภาษาไทยไม่เพี้ยน · ส่งออก **ทุกแถวที่กรองอยู่** ไม่ใช่แค่หน้าที่เห็น
 * ⚠️ มีชื่อ/เบอร์ (ข้อมูลส่วนบุคคล) — ปุ่มอยู่หลังล็อกอินเจ้าหน้าที่เท่านั้น
 */
import type { PublicApplication } from '@/lib/publicApplicationsApi';
import { GENDER_LABEL, REFERRAL_SOURCE_LABEL } from '@/lib/publicApplicationsApi';
import { applicationJobLabel, applicationUnitLabel } from '@/lib/recruitRm';
import {
  CONTACT_STATE_LABEL,
  PROCESS_STATE_LABEL,
  PROCESS_STEP_LABEL,
  applicantContactStateOf,
  applicantProcessOf,
} from '@/lib/applicantProcess';
import { formatYmdDmyBe, toYmdBangkok } from '@/lib/dateTh';

export const APPLICANT_EXPORT_HEADERS = [
  'ชื่อ-นามสกุล',
  'เบอร์โทร',
  'ตำแหน่ง',
  'หน่วยงาน',
  'วันที่สมัคร',
  'สถานะ',
  'ขั้นตอน',
  'สถานะการติดต่อ',
  'ช่องทาง',
  'จังหวัด',
  'อำเภอ/เขต',
  'อายุ',
  'เพศ',
  'ข้อมูลผู้สรรหา',
  'ผู้รับผิดชอบ',
] as const;

/** BOM ให้ Excel อ่านไทยถูก */
const BOM = String.fromCharCode(0xfeff);

function cell(v: string | number | null | undefined): string {
  const t = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function applicantExportRows(rows: readonly PublicApplication[]): string[][] {
  return rows.map((r) => {
    const p = applicantProcessOf(r);
    return [
      r.full_name ?? '',
      r.phone ?? '',
      applicationJobLabel(r) ?? '',
      applicationUnitLabel(r) ?? '',
      r.created_at ? formatYmdDmyBe(toYmdBangkok(new Date(r.created_at))) : '',
      PROCESS_STATE_LABEL[p.state],
      PROCESS_STEP_LABEL[p.step],
      CONTACT_STATE_LABEL[applicantContactStateOf(r)],
      r.channel_label?.trim() || (r.referral_source ? REFERRAL_SOURCE_LABEL[r.referral_source] : ''),
      r.province ?? '',
      r.district ?? '',
      typeof r.age === 'number' ? String(r.age) : '',
      r.gender ? (GENDER_LABEL[r.gender] ?? '') : '',
      r.specific_type ?? '',
      r.responsible_name ?? '',
    ];
  });
}

export function applicantExportCsv(rows: readonly PublicApplication[]): string {
  const lines = [[...APPLICANT_EXPORT_HEADERS], ...applicantExportRows(rows)].map((l) => l.map(cell).join(','));
  return `${BOM}${lines.join('\r\n')}`;
}

/** ดาวน์โหลดไฟล์ — ชื่อไฟล์บอกวันที่ (เวลาไทย) */
export function downloadApplicantExport(rows: readonly PublicApplication[], now: Date = new Date()): void {
  const url = URL.createObjectURL(new Blob([applicantExportCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `รายชื่อผู้สมัคร-${toYmdBangkok(now)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

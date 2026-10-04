/**
 * ═══ รายชื่อซ้ำตอนนำเข้า Excel (เจ้าของ 4 ต.ค. 2569) ═══
 * *"พอนำเข้ารายชื่อไหนซ้ำ เด้ง Popup บอกว่ารายชื่อเหล่านี้ซ้ำ บอกว่าสมัครล่าสุดวันไหน พร้อมสถานะล่าสุด
 * และให้โหลดเป็นไฟล์กลุ่มคนที่ซ้ำออกไปได้"*
 *
 * ซ้ำ = เบอร์นี้มีใบสมัครในระบบแล้ว (ทุกช่วงเวลา) หรือเบอร์ซ้ำกับแถวก่อนหน้าในไฟล์เดียวกัน
 * จะนำเข้าได้ไหมยังเป็นกติกาเดิม: สมัครภายใน 14 วัน / ซ้ำในไฟล์ = ข้าม · เกิน 14 วัน = นำเข้าได้ (บอกว่าเคยสมัคร)
 * ⚠️ ไฟล์นี้ใช้ทั้งหน้าเว็บและ API — ห้าม import อะไรที่ใช้ `@/` หรือของฝั่ง browser
 */

export type ImportDuplicate = {
  /** แถวในไฟล์ (ตามที่ Excel นับ) */
  row: number;
  name: string;
  phone: string;
  /** สมัครล่าสุด (ISO) — `null` = ซ้ำในไฟล์อย่างเดียว ยังไม่เคยมีในระบบ */
  lastAppliedAt: string | null;
  /** สถานะของใบล่าสุด (คีย์ของระบบ: new/contacted/converted/rejected) */
  lastStatus: string | null;
  /** งานของใบล่าสุด */
  lastJob: string | null;
  /** เคยสมัครกี่ใบในระบบ */
  applications: number;
  /** แถวนี้จะถูกข้าม (ไม่นำเข้า) */
  skipped: boolean;
  /** เหตุผลที่ข้าม หรือบอกว่าเคยสมัคร */
  note: string;
};

export const IMPORT_STATUS_LABEL: Record<string, string> = {
  new: 'ใหม่',
  contacted: 'ติดต่อแล้ว',
  converted: 'รับเข้าทำงาน',
  rejected: 'ปฏิเสธ',
};

export function importStatusLabel(s: string | null): string {
  if (!s) return '—';
  return IMPORT_STATUS_LABEL[s] ?? s;
}

/** วันที่ไทย 4/10/2569 (เวลาไทย) */
export function importDateTh(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'numeric', year: 'numeric' })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, x) => ({ ...acc, [x.type]: x.value }), {});
  return `${Number(p.day)}/${Number(p.month)}/${Number(p.year) + 543}`;
}

export const DUPLICATE_SHEET_HEADERS = [
  'แถวในไฟล์',
  'ชื่อ',
  'เบอร์โทร',
  'สมัครล่าสุด',
  'สถานะล่าสุด',
  'งานล่าสุด',
  'เคยสมัคร (ใบ)',
  'ผลนำเข้า',
] as const;

/** แถวของไฟล์รายชื่อซ้ำที่ให้ดาวน์โหลด — ลำดับคอลัมน์ตาม `DUPLICATE_SHEET_HEADERS` */
export function duplicateSheetRows(list: readonly ImportDuplicate[]): (string | number)[][] {
  return [
    [...DUPLICATE_SHEET_HEADERS],
    ...list.map((d) => [
      d.row,
      d.name,
      d.phone,
      importDateTh(d.lastAppliedAt),
      importStatusLabel(d.lastStatus),
      d.lastJob ?? '—',
      d.applications,
      d.skipped ? `ข้าม · ${d.note}` : `นำเข้า · ${d.note}`,
    ]),
  ];
}

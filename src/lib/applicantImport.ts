/**
 * ═══ นำเข้าผู้สมัครจาก Excel (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * เจ้าของ (Choice): *"ทำ Excel ตัวอย่าง + อัปโหลด"* — ดาวน์โหลดไฟล์ตัวอย่าง (ช่องเดียวกับ "เพิ่มข้อมูลผู้สมัคร")
 * → กรอก → อัปโหลด → ดูตัวอย่างก่อนบันทึก · เบอร์ที่มีในระบบแล้วข้าม (กติกาเบอร์เดียว 132) ·
 * นำเข้าแล้ว **AI ยังไม่โทร** (เลือกส่งเองจากแท็บผู้สมัคร — fail-safe ไปทางไม่ส่ง)
 *
 * ตรรกะล้วน (ไม่อ่านไฟล์/DB เอง) — API แปลงไฟล์เป็นแถวด้วย SheetJS แล้วส่งเข้ามาที่นี่
 * กติกาต่อแถว = `parseStaffApplication` ตัวเดียวกับปุ่มเพิ่มผู้สมัคร (ข้อความ error เดิม)
 */
import {
  RM_EDUCATION_LEVELS,
  RM_LICENSE_TYPES,
  RM_SPECIFIC_TYPES,
  isRmLicenseType,
  isRmSpecificType,
} from './recruitRmMasters';
import { parseStaffApplication, type StaffApplicationValue } from './staffApplicationInput';

export type ImportColumnKey =
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'age'
  | 'gender'
  | 'line_id'
  | 'province'
  | 'district'
  | 'position_interest'
  | 'specific_type'
  | 'education'
  | 'license_types';

/** คอลัมน์ของไฟล์ตัวอย่าง — ลำดับเดียวกับฟอร์ม "เพิ่มข้อมูลผู้สมัคร" · `*` = ต้องกรอก */
export const IMPORT_COLUMNS: ReadonlyArray<{ key: ImportColumnKey; header: string; required: boolean }> = [
  { key: 'first_name', header: 'ชื่อ', required: true },
  { key: 'last_name', header: 'นามสกุล', required: true },
  { key: 'phone', header: 'เบอร์โทร', required: true },
  { key: 'age', header: 'อายุ', required: true },
  { key: 'gender', header: 'เพศ', required: true },
  { key: 'line_id', header: 'LINE ID', required: false },
  { key: 'province', header: 'จังหวัด', required: false },
  { key: 'district', header: 'อำเภอ/เขต', required: false },
  { key: 'position_interest', header: 'ตำแหน่งงานที่สนใจ', required: false },
  { key: 'specific_type', header: 'ประเภทเจาะจง', required: false },
  { key: 'education', header: 'วุฒิการศึกษา', required: false },
  { key: 'license_types', header: 'ประเภทใบขับขี่', required: false },
];

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_SHEET_NAME = 'ผู้สมัคร';
export const IMPORT_VALUES_SHEET_NAME = 'ค่าที่ใช้ได้';
export const IMPORT_TEMPLATE_FILENAME = 'นำเข้าผู้สมัคร.xlsx';

/** หัวคอลัมน์บนไฟล์ตัวอย่าง — ช่องที่ต้องกรอกต่อท้ายด้วย " *" */
export function importTemplateHeaders(): string[] {
  return IMPORT_COLUMNS.map((c) => (c.required ? `${c.header} *` : c.header));
}

/** ชีต "ค่าที่ใช้ได้" — ตารางค่า ไม่ใช่ประโยคอธิบาย */
export function importValuesSheet(): string[][] {
  const lists = [['ชาย', 'หญิง'], [...RM_SPECIFIC_TYPES], [...RM_EDUCATION_LEVELS], [...RM_LICENSE_TYPES]];
  const height = Math.max(...lists.map((l) => l.length));
  const rows: string[][] = [['เพศ', 'ประเภทเจาะจง', 'วุฒิการศึกษา', 'ประเภทใบขับขี่ (หลายใบคั่นด้วย ,)']];
  for (let i = 0; i < height; i += 1) rows.push(lists.map((l) => l[i] ?? ''));
  return rows;
}

const normalizeHeader = (v: unknown): string =>
  String(v ?? '')
    .replace(/\*/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

/** หาว่าคอลัมน์ไหนอยู่ช่องที่เท่าไหร่ (ทนช่องว่าง/ดอกจัน/ตัวพิมพ์) · ขาดคอลัมน์ที่ต้องมี = บอกชื่อ */
export function mapImportHeader(row: readonly unknown[]): {
  index: Partial<Record<ImportColumnKey, number>>;
  missing: string[];
} {
  const index: Partial<Record<ImportColumnKey, number>> = {};
  const normalized = row.map(normalizeHeader);
  for (const c of IMPORT_COLUMNS) {
    const at = normalized.indexOf(normalizeHeader(c.header));
    if (at >= 0) index[c.key] = at;
  }
  const missing = IMPORT_COLUMNS.filter((c) => c.required && index[c.key] === undefined).map((c) => c.header);
  return { index, missing };
}

/**
 * เบอร์จากเซลล์ Excel — 🔴 Excel ตัดเลข 0 หน้าเบอร์ทิ้งเมื่อเซลล์เป็นตัวเลข (812345678)
 * ⇒ 9 หลักขึ้นต้น 6/8/9 เติม 0 · ขึ้นต้น 66 (11 หลัก) แปลงเป็น 0 · ที่เหลือส่งตามที่เห็น (ตัวตรวจกลางตัดสิน)
 */
export function normalizeImportPhone(v: unknown): string {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (digits.length === 9 && /^[689]/.test(digits)) return `0${digits}`;
  if (digits.length === 11 && digits.startsWith('66')) return `0${digits.slice(2)}`;
  return digits;
}

export function normalizeImportGender(v: unknown): '' | 'male' | 'female' {
  const t = String(v ?? '').trim().toLowerCase();
  if (t === 'ชาย' || t === 'male' || t === 'm' || t === 'ช') return 'male';
  if (t === 'หญิง' || t === 'female' || t === 'f' || t === 'ญ') return 'female';
  return '';
}

export function splitImportLicenses(v: unknown): string[] {
  return String(v ?? '')
    .split(/[,\n;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const cell = (cells: readonly unknown[], at: number | undefined): unknown => (at === undefined ? '' : cells[at]);
const isBlankRow = (cells: readonly unknown[]): boolean => cells.every((c) => String(c ?? '').trim() === '');

export type ImportRowPlan =
  | { row: number; ok: true; value: StaffApplicationValue }
  | { row: number; ok: false; reason: string; name: string; phone: string };

/** ค่าที่ใส่ให้ทุกแถวของไฟล์ (เลือกบนป๊อป ไม่ใช่ในไฟล์ — ตรงกับรายการจริงในระบบ) */
export type ImportShared = {
  responsible_name?: string | null;
  channel_id?: string | null;
  channel_label?: string | null;
};

/**
 * แถวข้อมูล (ไม่รวมหัว) → แผนต่อแถว · `row` = เลขแถวบน Excel (หัว = แถว 1)
 * แถวว่างทั้งแถวข้ามเงียบ ๆ (คนชอบเว้นบรรทัด) · เบอร์ซ้ำในไฟล์ = ใช้แถวแรก แถวหลังข้าม
 * ⚠️ ยังไม่รู้ว่าเบอร์มีในระบบแล้วไหม — API เช็คกับ DB ต่อเอง (`markExistingPhones`)
 */
export function planImportRows(
  rows: ReadonlyArray<readonly unknown[]>,
  index: Partial<Record<ImportColumnKey, number>>,
  shared: ImportShared = {},
): ImportRowPlan[] {
  const out: ImportRowPlan[] = [];
  const seen = new Map<string, number>();
  rows.forEach((cells, i) => {
    if (isBlankRow(cells)) return;
    const row = i + 2;
    const name = [cell(cells, index.first_name), cell(cells, index.last_name)]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ');
    const phone = normalizeImportPhone(cell(cells, index.phone));
    const fail = (reason: string) => out.push({ row, ok: false, reason, name, phone });

    const specific = String(cell(cells, index.specific_type) ?? '').trim();
    if (specific && !isRmSpecificType(specific)) return fail(`ประเภทเจาะจง "${specific}" ไม่อยู่ในรายการ`);
    const licenses = splitImportLicenses(cell(cells, index.license_types));
    const badLicense = licenses.find((x) => !isRmLicenseType(x));
    if (badLicense) return fail(`ไม่รู้จักใบขับขี่ "${badLicense}"`);

    const parsed = parseStaffApplication({
      first_name: cell(cells, index.first_name),
      last_name: cell(cells, index.last_name),
      phone,
      age: cell(cells, index.age),
      gender: normalizeImportGender(cell(cells, index.gender)),
      line_id: cell(cells, index.line_id),
      province: cell(cells, index.province),
      district: cell(cells, index.district),
      position_interest: cell(cells, index.position_interest),
      specific_type: specific,
      education: cell(cells, index.education),
      license_types: licenses,
      responsible_name: shared.responsible_name ?? null,
      channel_id: shared.channel_id ?? null,
      channel_label: shared.channel_label ?? null,
    });
    if ('message' in parsed) return fail(parsed.message);

    const firstRow = seen.get(parsed.value.phone);
    if (firstRow !== undefined) return fail(`เบอร์ซ้ำกับแถว ${firstRow} ในไฟล์`);
    seen.set(parsed.value.phone, row);
    out.push({ row, ok: true, value: parsed.value });
  });
  return out;
}

/** แถวที่เบอร์มีในระบบแล้ว → ข้าม (กติกาเบอร์เดียว) · `toKey` = ตัวแปลงเบอร์เป็นคีย์เดียวกับ DB (E.164) */
export function markExistingPhones(
  plans: ImportRowPlan[],
  existingKeys: ReadonlySet<string>,
  toKey: (phone: string) => string | null,
  reason: string,
): ImportRowPlan[] {
  return plans.map((p) => {
    if (!('value' in p)) return p;
    const key = toKey(p.value.phone);
    if (key && existingKeys.has(key)) {
      return { row: p.row, ok: false, reason, name: p.value.full_name, phone: p.value.phone };
    }
    return p;
  });
}

/** ผลที่ส่งกลับหน้าเว็บ (ตัวอย่างก่อนบันทึก / ผลหลังบันทึก) */
export type ImportPreviewRow = { row: number; name: string; phone: string; ok: boolean; reason: string | null };

export function toPreviewRows(plans: readonly ImportRowPlan[]): ImportPreviewRow[] {
  // narrow ด้วย `in` — tsconfig ฝั่งหน้าเว็บไม่ strict (narrow ด้วย ok: true/false ไม่ได้)
  return plans.map((p) =>
    'value' in p
      ? { row: p.row, name: p.value.full_name, phone: p.value.phone, ok: true, reason: null }
      : { row: p.row, name: p.name, phone: p.phone, ok: false, reason: p.reason },
  );
}

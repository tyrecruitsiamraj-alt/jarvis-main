import type { JobRequest } from '@/types';

/** ทำความสะอาดชื่อหน่วยงานก่อนรวมกลุ่ม */
function cleanUnitName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/\u0E4D\u0E32/g, '\u0E33')
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
}

const LEGAL_PREFIX_RE =
  /^(?:บริษัท|บจก\.?|ห้างหุ้นส่วนจำกัด|หจก\.?|บริษัทมหาชนจำกัด|บมจ\.?)\s+/iu;

/** ตัดคำนำหน้านิติบุคคล — บริษัท / บจก. / หจก. */
function stripLegalPrefixes(name: string): string {
  let n = name;
  let prev = '';
  while (n !== prev) {
    prev = n;
    n = n.replace(LEGAL_PREFIX_RE, '').trim();
  }
  return n;
}

/** ตัดส่วนสาขา / นิติบุคคลท้ายชื่อ — ใช้รวมกลุ่มลูกค้าเดียวกัน */
function stripBranchAndLegalSuffix(name: string): string {
  let n = stripLegalPrefixes(name);
  let prev = '';
  while (n !== prev) {
    prev = n;
    n = n
      .replace(/\s*จำกัด(\s*\(มหาชน\))?$/iu, '')
      .replace(/\s*จ\.?\s*ก\.?(\s*\(มหาชน\))?$/iu, '')
      .replace(/\s*\(มหาชน\)$/iu, '')
      .replace(/\s+บมจ\.?$/iu, '')
      .replace(/\s+สำนักงาน.*$/iu, '')
      .replace(/\s+สาขา.*$/iu, '')
      .trim();
    n = stripLegalPrefixes(n);
  }
  return n;
}

/** คีย์รวมกลุ่ม — ไม่สนช่องว่าง ตัวพิมพ์ จำกัด หรือคำว่า บริษัท */
function compactOrganizationKey(name: string): string {
  return stripBranchAndLegalSuffix(name).replace(/\s+/g, '').toLowerCase();
}

/** คีย์รวมกลุ่มหน่วยงาน/ลูกค้า */
export function unitOrganizationKey(name?: string | null): string {
  const raw = cleanUnitName(name ?? '');
  if (!raw || raw === '—') return '—';
  const compact = compactOrganizationKey(raw);
  return compact || raw.toLowerCase();
}

/** ชื่อแสดงของกลุ่ม — ตัดสาขา/นิติบุคคลออกให้เหลือชื่อองค์กร */
export function unitOrganizationLabel(name?: string | null): string {
  const raw = cleanUnitName(name ?? '');
  if (!raw || raw === '—') return '—';
  const base = stripBranchAndLegalSuffix(raw);
  return base || raw;
}

/** เลือกชื่อแสดงที่ดีที่สุดจากสมาชิกในกลุ่ม */
export function pickUnitOrganizationDisplayName(names: string[]): string {
  const labels = names.map(unitOrganizationLabel).filter((n) => n && n !== '—');
  if (labels.length === 0) return '—';

  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()].sort(
    (a, b) =>
      b[1] - a[1] ||
      a[0].length - b[0].length ||
      a[0].localeCompare(b[0], 'th'),
  )[0]![0];
}

/** รายการหน่วยงานสำหรับตัวกรอง — รวมชื่อเดียวกัน (มี/ไม่มี จำกัด) */
export function groupedUnitFilterOptions(jobs: JobRequest[]): string[] {
  const byKey = new Map<string, string[]>();
  for (const j of jobs) {
    const raw = j.unit_name?.trim();
    if (!raw) continue;
    const key = unitOrganizationKey(raw);
    const list = byKey.get(key) ?? [];
    list.push(raw);
    byKey.set(key, list);
  }
  return [...byKey.values()]
    .map((names) => pickUnitOrganizationDisplayName(names))
    .sort((a, b) => a.localeCompare(b, 'th'));
}

/** กรองหน่วยงาน — จับคู่ตามกลุ่มชื่อ ไม่ใช่ข้อความตรงตัว */
export function matchesUnitOrganizationFilter(
  unitName: string | undefined,
  filterLabel: string,
): boolean {
  if (!filterLabel || filterLabel === 'all') return true;
  return unitOrganizationKey(unitName) === unitOrganizationKey(filterLabel);
}

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

/** รวมชื่อย่อที่เป็นคำนำหน้าของชื่อเต็ม — เช่น บำรุงราษ + บำรุงราษฎร์ */
const ORG_PREFIX_MERGE_MIN = 7;

export function buildOrganizationKeyResolver(
  unitNames: Array<string | null | undefined>,
): (name?: string | null) => string {
  const keys = [
    ...new Set(
      unitNames
        .map((n) => unitOrganizationKey(n))
        .filter((k) => k && k !== '—'),
    ),
  ];
  const parent = new Map<string, string>();
  for (const k of keys) parent.set(k, k);

  const find = (k: string): string => {
    let root = k;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let curr = k;
    while (parent.get(curr) !== curr) {
      const next = parent.get(curr)!;
      parent.set(curr, root);
      curr = next;
    }
    return root;
  };

  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (ra.length >= rb.length) parent.set(rb, ra);
    else parent.set(ra, rb);
  };

  const sorted = [...keys].sort((a, b) => a.length - b.length);
  for (const short of sorted) {
    if (short.length < ORG_PREFIX_MERGE_MIN) continue;
    for (const long of keys) {
      if (long.length > short.length && long.startsWith(short)) union(short, long);
    }
  }

  return (name) => {
    const key = unitOrganizationKey(name);
    if (!key || key === '—') return '—';
    return find(key);
  };
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
  const names = jobs.map((j) => j.unit_name?.trim()).filter(Boolean) as string[];
  const resolve = buildOrganizationKeyResolver(names);
  const byKey = new Map<string, string[]>();
  for (const raw of names) {
    const key = resolve(raw);
    const list = byKey.get(key) ?? [];
    list.push(raw);
    byKey.set(key, list);
  }
  return [...byKey.values()]
    .map((group) => pickUnitOrganizationDisplayName(group))
    .sort((a, b) => a.localeCompare(b, 'th'));
}

/** กรองหน่วยงาน — จับคู่ตามกลุ่มชื่อ ไม่ใช่ข้อความตรงตัว */
export function matchesUnitOrganizationFilter(
  unitName: string | undefined,
  filterLabel: string,
  scopeNames: Array<string | null | undefined> = [],
): boolean {
  if (!filterLabel || filterLabel === 'all') return true;
  const resolve = buildOrganizationKeyResolver([unitName, filterLabel, ...scopeNames]);
  return resolve(unitName) === resolve(filterLabel);
}

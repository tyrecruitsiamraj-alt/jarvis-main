/** ทำความสะอาดชื่อหน่วยงานก่อนรวมกลุ่ม */
function cleanUnitName(name: string): string {
  return name
    .normalize('NFKC')
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
}

/** ตัดส่วนสาขา / นิติบุคคลท้ายชื่อ — ใช้รวมกลุ่มลูกค้าเดียวกัน */
function stripBranchAndLegalSuffix(name: string): string {
  return name
    .replace(/\s+จ[ำํ]ากัด(\s*\(มหาชน\))?$/iu, '')
    .replace(/\s+บมจ\.?$/iu, '')
    .replace(/\s+ส[ำํ]านักงาน\s*.+$/iu, '')
    .replace(/\s+สาขา\s*.+$/iu, '')
    .trim();
}

/** คีย์รวมกลุ่ม — ไม่สนช่องว่างและตัวพิมพ์ */
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

/** ชื่อแสดงของกลุ่ม — ตัดสาขาออกให้เหลือชื่อองค์กร */
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
    (a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0], 'th'),
  )[0]![0];
}

/**
 * ═══ เครื่องกรองแบบ iRecruit — ตัวกลางที่ใช้ร่วมกันทุกหน้า (ตรรกะล้วน) ═══
 *
 * แยกออกมาจาก `boardFilters.ts` 27 ก.ย. 2569 — เจ้าของอยากได้หลักการเดียวกันที่แท็บ
 * รายชื่อผู้สมัคร / การโทรของฉัน / ติดตามนัดหมาย (*"เอาตามร่างเลย"*) · ก๊อปอัลกอริทึมไปอีกชุด
 * = วันหน้าสองหน้านับเลขคนละแบบ (บทเรียนซ้ำของบ้านนี้) ⇒ **ทุกหน้าเรียกตัวนี้**
 *
 * หลักการ (แผน `docs/plan-board-irecruit-filter-2569-09-26.md`):
 * - OR ในหัวข้อเดียวกัน · AND ข้ามหัวข้อ
 * - เลขต่อท้ายแต่ละค่า = นับจากชุดที่ผ่าน **หัวข้ออื่น** (เลือกจังหวัดแล้วจังหวัดอื่นไม่กลายเป็น 0)
 * - ห้ามปุ่มหลอก: ซ่อนเฉพาะหัวข้อที่ข้อมูลจริงว่างทั้งหมด · หัวข้อแบบตายตัว (`order`) โชว์ครบ เลข 0 จาง
 * - หัวข้อที่เส้นข้อมูลยังไม่พร้อม (`available` = false) ต้องไม่โชว์ **และห้ามตัดแถวทิ้ง**
 * - เก็บใน URL ต่อยอด params เดิม (แต่ละหน้าใช้ prefix ของตัวเอง ไม่ชนกัน)
 */

/** คำกลางของ "ไม่มีข้อมูลช่องนี้" — ให้กดกรองได้ (กติกาในแผน: ฟิลด์ไม่มีค่า = มีค่า "ไม่ระบุ") */
export const UNSPECIFIED = '__none__';

export type FacetUi = 'chip' | 'check';

/** สถานะขั้นต่ำที่เครื่องกรองต้องรู้ — หน้าไหนมีของเพิ่ม (ช่วงวันที่ ฯลฯ) ขยายเอาเอง */
export type FacetState<K extends string> = {
  selection: Partial<Record<K, string[]>>;
};

export type FacetDef<T, K extends string, F, S extends FacetState<K> = FacetState<K>> = {
  key: K;
  label: string;
  ui: FacetUi;
  /** หัวข้อค่าเยอะ — มีช่องค้นหาในหัวข้อ */
  searchable?: boolean;
  /** ลำดับตายตัวของตัวเลือก (หัวข้อ enum) — ไม่มี = เรียงตามจำนวน · มี = โชว์ครบทุกตัวแม้เป็น 0 */
  order?: readonly string[];
  /** คำบนจอของค่า — ไม่มี = ใช้ค่านั้นเป็นคำ */
  labelOf?: (value: string) => string;
  /** หัวข้อนี้พร้อมโชว์ไหม (ขึ้นกับเส้นข้อมูล) */
  available?: (facts: F) => boolean;
  /** แถวนี้มีค่าอะไรบ้าง — คืนได้หลายค่า · คืน [] = แถวนี้ไม่อยู่ในหัวข้อนี้ (หัวข้อลูกก่อนเลือกแม่) */
  values: (row: T, facts: F, state: S) => string[];
};

export type FacetOption = { value: string; label: string; count: number; selected: boolean };
export type FacetView<K extends string = string> = {
  key: K;
  label: string;
  ui: FacetUi;
  searchable: boolean;
  options: FacetOption[];
  selectedCount: number;
};

/** ค่าที่ติ๊กจริงของหัวข้อนั้น (กรองของว่างออก) */
export function selectedOf<K extends string>(state: FacetState<K>, key: K): string[] {
  return (state.selection[key] ?? []).filter((v) => typeof v === 'string' && v !== '');
}

/** หัวข้อที่ใช้กรองได้จริงตอนนี้ — เส้นข้อมูลยังไม่พร้อม = ไม่กรอง (ห้ามตัดแถวทิ้งเพราะยังไม่รู้) */
function activeDefs<T, K extends string, F, S extends FacetState<K>>(
  defs: readonly FacetDef<T, K, F, S>[],
  facts: F,
): FacetDef<T, K, F, S>[] {
  return defs.filter((d) => !d.available || d.available(facts));
}

type ValueTable<K extends string> = Map<K, string[][]>;

function buildValueTable<T, K extends string, F, S extends FacetState<K>>(
  rows: readonly T[],
  defs: readonly FacetDef<T, K, F, S>[],
  facts: F,
  state: S,
): ValueTable<K> {
  const table: ValueTable<K> = new Map();
  for (const d of defs) table.set(d.key, rows.map((row) => d.values(row, facts, state)));
  return table;
}

function rowPasses<T, K extends string, F, S extends FacetState<K>>(
  i: number,
  table: ValueTable<K>,
  defs: readonly FacetDef<T, K, F, S>[],
  state: S,
  skip: K | null,
): boolean {
  for (const d of defs) {
    if (d.key === skip) continue;
    const want = selectedOf(state, d.key);
    if (want.length === 0) continue;
    const have = table.get(d.key)?.[i] ?? [];
    if (!have.some((v) => want.includes(v))) return false;
  }
  return true;
}

/** กรองแถวตามหัวข้อที่ติ๊ก — OR ในหัวข้อ · AND ข้ามหัวข้อ */
export function applyFacetDefs<T, K extends string, F, S extends FacetState<K>>(
  rows: readonly T[],
  defs: readonly FacetDef<T, K, F, S>[],
  state: S,
  facts: F,
): T[] {
  const active = activeDefs(defs, facts);
  if (active.every((d) => selectedOf(state, d.key).length === 0)) return [...rows];
  const table = buildValueTable(rows, active, facts, state);
  return rows.filter((_, i) => rowPasses(i, table, active, state, null));
}

/**
 * หัวข้อ + ตัวเลือก + เลขต่อท้าย สำหรับวาดแถบซ้าย
 * @param valueLabel คำบนจอของค่าหนึ่ง (รวมคำของ "ไม่ระบุ" ต่อหัวข้อ) — หน้าเป็นคนกำหนด
 */
export function buildFacetViews<T, K extends string, F, S extends FacetState<K>>(
  rows: readonly T[],
  defs: readonly FacetDef<T, K, F, S>[],
  state: S,
  facts: F,
  valueLabel: (key: K, value: string) => string,
): FacetView<K>[] {
  const active = activeDefs(defs, facts);
  const table = buildValueTable(rows, active, facts, state);
  const out: FacetView<K>[] = [];

  for (const d of active) {
    const selected = selectedOf(state, d.key);
    const universe = new Set<string>();
    for (const vals of table.get(d.key) ?? []) for (const v of vals) universe.add(v);
    // 🔴 ห้ามปุ่มหลอก: ข้อมูลจริงว่างทั้งหมด (มีแต่ "ไม่ระบุ" หรือไม่มีเลย) และไม่ได้ติ๊กอะไร = ซ่อน
    const hasRealValue = [...universe].some((v) => v !== UNSPECIFIED);
    if (!hasRealValue && selected.length === 0) continue;
    if (d.order) for (const v of d.order) universe.add(v);
    for (const v of selected) universe.add(v);

    const counts = new Map<string, number>();
    rows.forEach((_, i) => {
      if (!rowPasses(i, table, active, state, d.key)) return;
      for (const v of new Set(table.get(d.key)?.[i] ?? [])) counts.set(v, (counts.get(v) ?? 0) + 1);
    });

    const options: FacetOption[] = [...universe].map((value) => ({
      value,
      label: valueLabel(d.key, value),
      count: counts.get(value) ?? 0,
      selected: selected.includes(value),
    }));

    if (d.order) {
      const order = d.order;
      const rank = (v: string) => {
        const idx = order.indexOf(v);
        return idx === -1 ? order.length + (v === UNSPECIFIED ? 1 : 0) : idx;
      };
      options.sort((a, b) => rank(a.value) - rank(b.value));
    } else {
      // ค่าเยอะ: จำนวนมากก่อน · "ไม่ระบุ" ไปท้ายเสมอ (ไม่ใช่ค่าที่คนตั้งใจหา)
      options.sort((a, b) => {
        if (a.value === UNSPECIFIED) return 1;
        if (b.value === UNSPECIFIED) return -1;
        return b.count - a.count || a.label.localeCompare(b.label, 'th');
      });
    }

    out.push({
      key: d.key,
      label: d.label,
      ui: d.ui,
      searchable: Boolean(d.searchable),
      options,
      selectedCount: selected.length,
    });
  }
  return out;
}

/**
 * ตัวเลือกที่จะโชว์ในหัวข้อค่าเยอะ (กติกาในแผน ข้อ 4)
 * ค่าที่ติ๊กแล้วลอยขึ้นบนสุด · ยังไม่พิมพ์ค้นหา = โชว์ 10 ค่าแรก · พิมพ์แล้ว = ทุกค่าที่ตรง
 */
export function visibleFacetOptions(
  options: readonly FacetOption[],
  query: string,
  limit = 10,
): { shown: FacetOption[]; hiddenCount: number } {
  const q = query.trim().toLowerCase();
  const selected = options.filter((o) => o.selected);
  const rest = options.filter((o) => !o.selected);
  if (q) {
    const hits = rest.filter((o) => o.label.toLowerCase().includes(q));
    return { shown: [...selected, ...hits], hiddenCount: 0 };
  }
  const head = rest.slice(0, Math.max(limit - selected.length, 0));
  return { shown: [...selected, ...head], hiddenCount: rest.length - head.length };
}

/** นับค่าที่ติ๊กอยู่ทั้งแถบ (ปุ่ม "ตัวกรอง (N)" บนมือถือ) */
export function countSelectedValues<K extends string>(state: FacetState<K>, keys: readonly K[]): number {
  return keys.reduce((n, k) => n + selectedOf(state, k).length, 0);
}

/** สลับค่าหนึ่งในหัวข้อ (หน้าที่มีหัวข้อแม่-ลูกจัดการลูกเองต่อจากนี้) */
export function toggleSelection<K extends string>(
  selection: Partial<Record<K, string[]>>,
  key: K,
  value: string,
): Partial<Record<K, string[]>> {
  const cur = (selection[key] ?? []).filter((v) => typeof v === 'string' && v !== '');
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  return { ...selection, [key]: next };
}

/** สรุปสั้นสำหรับแถบ "กำลังดู" — `หัวข้อ: ค่า, ค่า · หัวข้อ: ค่า` (เกิน 3 ค่าขึ้น +N) */
export function describeSelection<K extends string>(
  state: FacetState<K>,
  keys: readonly K[],
  facetLabel: (key: K) => string,
  valueLabel: (key: K, value: string) => string,
): string {
  const parts: string[] = [];
  for (const key of keys) {
    const vals = selectedOf(state, key);
    if (vals.length === 0) continue;
    const labels = vals.map((v) => valueLabel(key, v));
    const shown = labels.length > 3 ? `${labels.slice(0, 3).join(', ')} +${labels.length - 3}` : labels.join(', ');
    parts.push(`${facetLabel(key)}: ${shown}`);
  }
  return parts.join(' · ');
}

// ── URL ──────────────────────────────────────────────────────────────────────

/** อ่านค่าที่ติ๊กจาก URL — `<prefix><หัวข้อ>` ซ้ำได้หลายค่า · คีย์ที่ไม่รู้จักไม่อ่าน */
export function readSelectionParams<K extends string>(
  params: URLSearchParams,
  prefix: string,
  keys: readonly K[],
): Partial<Record<K, string[]>> {
  const selection: Partial<Record<K, string[]>> = {};
  for (const key of keys) {
    const vals = params
      .getAll(`${prefix}${key}`)
      .map((v) => v.trim())
      .filter(Boolean);
    if (vals.length > 0) selection[key] = [...new Set(vals)];
  }
  return selection;
}

/** เขียนค่าที่ติ๊กลง params ชุดใหม่ — ลบของเดิมที่ขึ้นต้นด้วย prefix นี้ก่อน · params อื่นอยู่ครบ */
export function writeSelectionParams<K extends string>(
  params: URLSearchParams,
  prefix: string,
  keys: readonly K[],
  selection: Partial<Record<K, string[]>>,
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const k of [...next.keys()]) {
    if (k.startsWith(prefix)) next.delete(k);
  }
  for (const key of keys) {
    for (const v of (selection[key] ?? []).filter((x) => typeof x === 'string' && x !== '')) {
      next.append(`${prefix}${key}`, v);
    }
  }
  return next;
}

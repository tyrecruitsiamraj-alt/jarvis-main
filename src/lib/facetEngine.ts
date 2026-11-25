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
 * - 🔴 หัวข้อมีไว้รอเสมอ ไม่รอข้อมูลค่อยโผล่ (เจ้าของ 11 พ.ย. 2569 "filter ให้มันมีไว้รอเลย … มันงง") — ไม่มีค่า = หัวข้อว่าง
 *   (เดิมซ่อนหัวข้อที่ข้อมูลว่าง = หัวข้อโผล่/หายตอนโหลดเสร็จหรือกดกรอง) · หัวข้อแบบตายตัว (`order`) โชว์ครบ เลข 0 จาง
 * - 🔴 ตัวเลือกอยู่ที่เดิมตอนติ๊ก (เจ้าของ "เวลาเลือกก็ไม่ต้องเด้งสิ่งที่เลือกมาข้างบน … ตอนนี้กดอะไรเด้งสลับไปสลับมา")
 *   ลำดับคิดจากทั้งชุด ไม่ขึ้นกับสิ่งที่ติ๊ก · ค่าที่ติ๊กไม่ลอยขึ้นบน
 * - หัวข้อที่เส้นข้อมูลยังไม่พร้อม (`available` = false) ต้องไม่โชว์ **และห้ามตัดแถวทิ้ง**
 * - เก็บใน URL ต่อยอด params เดิม (แต่ละหน้าใช้ prefix ของตัวเอง ไม่ชนกัน)
 */

/** คำกลางของ "ไม่มีข้อมูลช่องนี้" — ให้กดกรองได้ (กติกาในแผน: ฟิลด์ไม่มีค่า = มีค่า "ไม่ระบุ") */
export const UNSPECIFIED = '__none__';

/**
 * วิธีเลือก — chip ปุ่มวางต่อกัน · check รายการเรียงลงมา · range แถบลากช่วงตัวเลข (ค่า `ต่ำ-สูง`) ·
 * tree รายการเป็นชั้น (ค่า = เส้นทาง `หลัก › รอง › …` · แถวมีค่าทุกชั้นของตัวเอง ⇒ ติ๊กแม่ = ได้ลูกทั้งหมด)
 * (เจ้าของ 25 พ.ย. 2569 "เรียงลงมา … แบบลาก 0 ถึง n … ช่องทางหลัก เลือกแล้วค่อยโชว์ช่องทางรอง")
 */
export type FacetUi = 'chip' | 'check' | 'range' | 'tree';

/** ตัวคั่นชั้นของหัวข้อแบบ tree */
export const TREE_SEP = ' › ';

/** ค่าของหัวข้อแบบ range = `ต่ำ-สูง` (จำนวนเต็ม) · อ่านไม่ออก = null (ไม่กรอง — URL เก่าแบบช่วงตายตัว เช่น `46+`) */
export function parseRangeValue(v: string): [number, number] | null {
  const m = /^(\d+)-(\d+)$/.exec(String(v).trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a <= b ? [a, b] : [b, a];
}
export const rangeValue = (from: number, to: number): string => `${Math.min(from, to)}-${Math.max(from, to)}`;

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
  /** หัวข้อนี้มีในหน้านี้ไหม (เช่น เฉพาะแท็บนัดหมาย) — false = ไม่มีหัวข้อนี้เลย */
  available?: (facts: F) => boolean;
  /** เส้นข้อมูลของหัวข้อนี้ยังโหลดไม่เสร็จ — หัวข้อยังอยู่ (ขึ้นกำลังโหลด) แต่ยังไม่กรอง (ห้ามตัดแถวทิ้งเพราะยังไม่รู้) */
  pending?: (facts: F) => boolean;
  /** หน่วยของหัวข้อแบบ range (เช่น "ปี" "วัน") */
  unit?: string;
  /** แถวนี้มีค่าอะไรบ้าง — คืนได้หลายค่า · คืน [] = แถวนี้ไม่อยู่ในหัวข้อนี้ (หัวข้อลูกก่อนเลือกแม่) */
  values: (row: T, facts: F, state: S) => string[];
};

export type FacetOption = {
  value: string;
  label: string;
  count: number;
  selected: boolean;
  /** ชั้นของหัวข้อแบบ tree (0 = ชั้นบนสุด) */
  depth?: number;
};
export type FacetView<K extends string = string> = {
  key: K;
  label: string;
  ui: FacetUi;
  searchable: boolean;
  options: FacetOption[];
  selectedCount: number;
  /** เส้นข้อมูลยังโหลดไม่เสร็จ */
  pending?: boolean;
  /** หัวข้อแบบ range — ขอบของแถบลาก (0 ถึงค่าสูงสุดในชุด) + ช่วงที่เลือกอยู่ + หน่วย */
  range?: { min: number; max: number; from: number; to: number; unit: string };
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
  return defs.filter((d) => (!d.available || d.available(facts)) && !d.pending?.(facts));
}

type ValueTable<K extends string> = Map<K, string[][]>;

/**
 * ค่าของแถวที่ไม่ขึ้นกับสิ่งที่ติ๊ก (หัวข้อที่ `values` รับแค่ row + facts) — จำไว้ข้ามการติ๊ก
 * แถว/facts เป็นก้อนเดิมระหว่างกดตัวกรอง ⇒ ไม่ต้องแยกที่อยู่/คิดความพร้อมซ้ำทุกคลิก
 * (ตัวกรองหน้างานสรรหาเคยหน่วง ~2 วินาทีต่อการติ๊ก · วัดจริง 4 ต.ค. 2569) · facts ก้อนใหม่ = แคชใหม่เอง
 */
const valueCache = new WeakMap<object, WeakMap<object, Map<string, string[]>>>();

function cachedValues<T, K extends string, F, S extends FacetState<K>>(
  d: FacetDef<T, K, F, S>,
  row: T,
  facts: F,
  state: S,
): string[] {
  const usesState = d.values.length >= 3;
  if (usesState || typeof row !== 'object' || row === null || typeof facts !== 'object' || facts === null) {
    return d.values(row, facts, state);
  }
  let byRow = valueCache.get(facts);
  if (!byRow) {
    byRow = new WeakMap();
    valueCache.set(facts, byRow);
  }
  let byKey = byRow.get(row);
  if (!byKey) {
    byKey = new Map();
    byRow.set(row, byKey);
  }
  const hit = byKey.get(d.key);
  if (hit) return hit;
  const vals = d.values(row, facts, state);
  byKey.set(d.key, vals);
  return vals;
}

function buildValueTable<T, K extends string, F, S extends FacetState<K>>(
  rows: readonly T[],
  defs: readonly FacetDef<T, K, F, S>[],
  facts: F,
  state: S,
): ValueTable<K> {
  const table: ValueTable<K> = new Map();
  for (const d of defs) table.set(d.key, rows.map((row) => cachedValues(d, row, facts, state)));
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
    if (d.ui === 'range') {
      const ranges = want.map(parseRangeValue).filter((x): x is [number, number] => x !== null);
      if (ranges.length === 0) continue;
      const inRange = have.some((v) => {
        if (v === UNSPECIFIED) return false;
        const n = Number(v);
        return Number.isFinite(n) && ranges.some(([a, b]) => n >= a && n <= b);
      });
      if (!inRange) return false;
      continue;
    }
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

  for (const d of defs) {
    if (d.available && !d.available(facts)) continue;
    const selected = selectedOf(state, d.key);
    if (!active.includes(d)) {
      out.push({ key: d.key, label: d.label, ui: d.ui, searchable: Boolean(d.searchable), options: [], selectedCount: selected.length, pending: true });
      continue;
    }
    if (d.ui === 'range') {
      // แถบลาก 0 ถึงค่าสูงสุดในทั้งชุด (ไม่ขึ้นกับสิ่งที่ติ๊ก — ขอบแถบไม่ขยับตอนกรอง)
      let max = 0;
      for (const vals of table.get(d.key) ?? []) {
        for (const v of vals) {
          const n = Number(v);
          if (v !== UNSPECIFIED && Number.isFinite(n)) max = Math.max(max, Math.ceil(n));
        }
      }
      const picked = selected.map(parseRangeValue).find((x): x is [number, number] => x !== null) ?? null;
      const from = picked ? Math.max(0, Math.min(picked[0], max)) : 0;
      const to = picked ? Math.max(from, Math.min(picked[1], max)) : max;
      out.push({
        key: d.key,
        label: d.label,
        ui: d.ui,
        searchable: false,
        options: [],
        selectedCount: picked ? 1 : 0,
        range: { min: 0, max, from, to, unit: d.unit ?? '' },
      });
      continue;
    }
    const universe = new Set<string>();
    // ลำดับของค่าเยอะ = จำนวนในทั้งชุด (ไม่ขึ้นกับสิ่งที่ติ๊ก) — ติ๊กแล้วตัวเลือกไม่สลับที่
    const baseCounts = new Map<string, number>();
    for (const vals of table.get(d.key) ?? []) {
      for (const v of new Set(vals)) {
        universe.add(v);
        baseCounts.set(v, (baseCounts.get(v) ?? 0) + 1);
      }
    }
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

    if (d.ui === 'tree') {
      // เรียงแบบต้นไม้: แม่ตามด้วยลูกของตัวเอง · พี่น้องเรียงตามจำนวนในทั้งชุด · "ไม่ระบุ" ท้ายสุด
      const parentOf = (v: string) => (v.includes(TREE_SEP) ? v.slice(0, v.lastIndexOf(TREE_SEP)) : '');
      const kids = new Map<string, FacetOption[]>();
      for (const o of options) {
        o.depth = o.value === UNSPECIFIED ? 0 : o.value.split(TREE_SEP).length - 1;
        const p = o.value === UNSPECIFIED ? '' : parentOf(o.value);
        kids.set(p, [...(kids.get(p) ?? []), o]);
      }
      const bySize = (a: FacetOption, b: FacetOption) => {
        if (a.value === UNSPECIFIED) return 1;
        if (b.value === UNSPECIFIED) return -1;
        return (baseCounts.get(b.value) ?? 0) - (baseCounts.get(a.value) ?? 0) || a.label.localeCompare(b.label, 'th');
      };
      const ordered: FacetOption[] = [];
      const walk = (p: string) => {
        for (const o of [...(kids.get(p) ?? [])].sort(bySize)) {
          ordered.push(o);
          if (o.value !== UNSPECIFIED) walk(o.value);
        }
      };
      walk('');
      out.push({ key: d.key, label: d.label, ui: d.ui, searchable: false, options: ordered, selectedCount: selected.length });
      continue;
    }

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
        return (baseCounts.get(b.value) ?? 0) - (baseCounts.get(a.value) ?? 0) || a.label.localeCompare(b.label, 'th');
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
 * ยังไม่พิมพ์ค้นหา = 10 ค่าแรก · พิมพ์แล้ว = ทุกค่าที่ตรง · ค่าที่ติ๊กไว้โชว์เสมอ **ที่ตำแหน่งเดิม** (ไม่ลอยขึ้นบน · เจ้าของ 11 พ.ย. 2569)
 */
export function visibleFacetOptions(
  options: readonly FacetOption[],
  query: string,
  limit = 10,
): { shown: FacetOption[]; hiddenCount: number } {
  const q = query.trim().toLowerCase();
  if (q) return { shown: options.filter((o) => o.selected || o.label.toLowerCase().includes(q)), hiddenCount: 0 };
  const shown = options.filter((o, i) => i < limit || o.selected);
  return { shown, hiddenCount: options.length - shown.length };
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

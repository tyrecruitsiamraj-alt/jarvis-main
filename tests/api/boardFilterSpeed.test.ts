/**
 * ตัวกรองหน้างานสรรหาเคยหน่วง ~2 วินาทีต่อการติ๊ก (วัดจริง 4 ต.ค. 2569 · เจ้าของ "ช่องเลือก Filter แล้วไม่ไป")
 * ต้นเหตุ: หัวข้ออำเภอแยกที่อยู่ใบเดิมซ้ำทุกอำเภอ (กรุงเทพฯ 50 เขต) + ทุกหัวข้อคิดค่าของแถวใหม่ทุกคลิก
 * 🔴 ด่าน: ผลต้องเหมือนเดิมเป๊ะ · ค่าของแถวคิดครั้งเดียวต่อ facts ก้อนเดียว
 */
import { describe, expect, it, vi } from 'vitest';
import { districtMatcherFor, districtMatchesFilter } from '@/lib/districtMatch';
import { applyFacetDefs, buildFacetViews, type FacetDef } from '@/lib/facetEngine';

describe('districtMatcherFor = districtMatchesFilter ทุกเคส', () => {
  const addrs = [
    'แขวงคลองเตยเหนือ เขตวัฒนา กรุงเทพมหานคร',
    'ต.บางโฉลง อ.บางพลี จ.สมุทรปราการ',
    'ถนนพระราม 3 บางโคล่ บางคอแหลม',
    '',
  ];
  const districts = ['เขตวัฒนา', 'วัฒนา', 'อำเภอบางพลี', 'บางคอแหลม', 'บางนา', ''];
  it('ทุกคู่ที่อยู่ × อำเภอ ให้ผลเท่ากัน', () => {
    for (const a of addrs) {
      const m = districtMatcherFor(a);
      for (const d of districts) expect(m(d), `${a} / ${d}`).toBe(districtMatchesFilter(a, d));
    }
  });
  it('ที่อยู่เดิม = ตัวเทียบตัวเดิม (ไม่แยกซ้ำ)', () => {
    expect(districtMatcherFor(addrs[0])).toBe(districtMatcherFor(addrs[0]));
  });
});

describe('facetEngine จำค่าของแถวข้ามการติ๊ก', () => {
  type Row = { id: number; p: string };
  type K = 'p' | 'q';
  const rows: Row[] = [
    { id: 1, p: 'ก' },
    { id: 2, p: 'ข' },
    { id: 3, p: 'ก' },
  ];
  it('หัวข้อที่ไม่ใช้ state คิดครั้งเดียวต่อแถว · ผลกรองยังถูก', () => {
    const spy = vi.fn((r: Row) => [r.p]);
    const defs: FacetDef<Row, K, object>[] = [{ key: 'p', label: 'P', ui: 'check', values: (r) => spy(r) }];
    const facts = {};
    const a = applyFacetDefs(rows, defs, { selection: { p: ['ก'] } }, facts);
    const b = applyFacetDefs(rows, defs, { selection: { p: ['ข'] } }, facts);
    buildFacetViews(rows, defs, { selection: { p: ['ก', 'ข'] } }, facts, (_k, v) => v);
    expect(a.map((r) => r.id)).toEqual([1, 3]);
    expect(b.map((r) => r.id)).toEqual([2]);
    expect(spy).toHaveBeenCalledTimes(3);
    // facts ก้อนใหม่ = คิดใหม่
    applyFacetDefs(rows, defs, { selection: { p: ['ก'] } }, {});
    expect(spy).toHaveBeenCalledTimes(6);
  });
  it('หัวข้อที่ใช้ state (เช่นอำเภอที่ขึ้นกับจังหวัดที่ติ๊ก) คิดใหม่ทุกครั้ง', () => {
    const spy = vi.fn();
    const defs: FacetDef<Row, K, object>[] = [
      {
        key: 'q',
        label: 'Q',
        ui: 'check',
        values: (r, _f, s) => {
          spy();
          return (s.selection.p ?? []).includes(r.p) ? ['in'] : ['out'];
        },
      },
    ];
    const facts = {};
    applyFacetDefs(rows, defs, { selection: { q: ['in'], p: ['ก'] } }, facts);
    const r = applyFacetDefs(rows, defs, { selection: { q: ['in'], p: ['ข'] } }, facts);
    expect(r.map((x) => x.id)).toEqual([2]);
    expect(spy).toHaveBeenCalledTimes(6);
  });
});

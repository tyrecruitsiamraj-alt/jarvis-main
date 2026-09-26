import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import {
  applyBoardFilters,
  boardFacetValueLabel,
  buildBoardFacets,
  clearBoardFacets,
  countSelectedFacetValues,
  describeBoardFilters,
  EMPTY_BOARD_FILTER_STATE,
  hasAnyBoardFilter,
  knownMonthlyIncome,
  readBoardFilterState,
  readBoardSort,
  sortBoardJobs,
  toggleBoardFacetValue,
  UNSPECIFIED,
  visibleFacetOptions,
  writeBoardFilterState,
  type BoardFacetFacts,
  type BoardFilterState,
} from '@/lib/boardFilters';

/**
 * แถบกรองแบบ iRecruit บนกล่องงาน (เจ้าของสั่ง 26 ก.ย. 2569 — แผน
 * `docs/plan-board-irecruit-filter-2569-09-26.md`)
 *
 * ด่านที่ห้ามหลุด:
 * 1. OR ในหัวข้อเดียวกัน · AND ข้ามหัวข้อ
 * 2. เลขต่อท้ายนับจากชุดที่ผ่าน **หัวข้ออื่น** — เลือกจังหวัดแล้วจังหวัดอื่นไม่กลายเป็น 0
 * 3. ห้ามปุ่มหลอก — ข้อมูลจริงมีค่าเดียว = ไม่โชว์หัวข้อ (เว้นแต่ติ๊กค้างอยู่)
 * 4. เส้นข้อมูลที่ยังไม่พร้อม (ทะเบียนปล่อย/ยอด AI) ห้ามทั้งโชว์และห้ามตัดใบทิ้ง
 * 5. URL เขียนทับเฉพาะของตัวเอง — `view` `lane` `step` ต้องอยู่ครบ
 */

const addrChon = 'เลขที่ 1 ต.หนองปรือ อ.บางละมุง จ.ชลบุรี 20150';
const addrBkk = 'แขวงสีลม เขตบางรัก กรุงเทพมหานคร 10500';

let seq = 0;
function job(over: Partial<JobRequest> = {}): JobRequest {
  seq += 1;
  return {
    id: `siamraj-sql:T${seq}`,
    request_no: `T${seq}`,
    unit_name: 'หน่วย A',
    location_address: addrChon,
    job_type: 'central',
    urgency: 'advance',
    request_date: '2026-09-01',
    required_date: '2026-10-01',
    total_income: 0,
    gender_requirement: 'ชาย',
    age_range_min: 25,
    age_range_max: 40,
    recruiter_name: 'คิว',
    contract_type_name: 'คนอย่างเดียว',
    unit_sector: 'private',
    ...over,
  } as JobRequest;
}

function facts(over: Partial<{
  countsReady: boolean;
  applicants: Record<string, number>;
  leads: Record<string, number>;
  released: Set<string> | null;
  ai: Record<string, number> | null;
}> = {}): BoardFacetFacts {
  const applicants = over.applicants ?? {};
  const leads = over.leads ?? {};
  const released = over.released === undefined ? new Set<string>() : over.released;
  const ai = over.ai === undefined ? {} : over.ai;
  return {
    countsReady: over.countsReady ?? true,
    applicants: (j) => applicants[j.id] ?? 0,
    leads: (j) => leads[j.id] ?? 0,
    isReleased: released === null ? null : (j) => released.has(j.id),
    aiSent: ai === null ? null : (j) => ai[j.id] ?? 0,
  };
}

const state = (selection: BoardFilterState['selection'], dates: BoardFilterState['dates'] = null) =>
  ({ selection, dates }) as BoardFilterState;

describe('applyBoardFilters — OR ในหัวข้อ · AND ข้ามหัวข้อ', () => {
  const a = job({ unit_name: 'A', recruiter_name: 'คิว' });
  const b = job({ unit_name: 'B', recruiter_name: 'คิว' });
  const c = job({ unit_name: 'C', recruiter_name: 'แบงค์' });
  const rows = [a, b, c];

  it('ไม่ติ๊กอะไร = ได้ทุกใบ', () => {
    expect(applyBoardFilters(rows, EMPTY_BOARD_FILTER_STATE, facts())).toEqual(rows);
  });

  it('ติ๊กสองค่าในหัวข้อเดียวกัน = ใบที่ตรงค่าใดค่าหนึ่ง', () => {
    expect(applyBoardFilters(rows, state({ unit: ['A', 'C'] }), facts()).map((j) => j.unit_name)).toEqual(['A', 'C']);
  });

  it('ติ๊กข้ามหัวข้อ = ต้องตรงทุกหัวข้อ', () => {
    expect(
      applyBoardFilters(rows, state({ unit: ['A', 'C'], recruiter: ['คิว'] }), facts()).map((j) => j.unit_name),
    ).toEqual(['A']);
  });

  it('ใบที่ไม่มีเจ้าหน้าที่ กรองด้วย "ไม่มีผู้รับผิดชอบ" ได้', () => {
    const none = job({ recruiter_name: '' });
    expect(applyBoardFilters([a, none], state({ recruiter: [UNSPECIFIED] }), facts())).toEqual([none]);
    expect(boardFacetValueLabel('recruiter', UNSPECIFIED)).toBe('ไม่มีผู้รับผิดชอบ');
  });
});

describe('จำนวนผู้สมัคร', () => {
  const zero = job();
  const few = job();
  const many = job();
  const f = facts({
    applicants: { [few.id]: 3, [many.id]: 7 },
    leads: { [zero.id]: 1 },
  });

  it('ยังไม่มีคนสมัคร / 1–4 / 5+ แบ่งตามยอดจริง', () => {
    expect(applyBoardFilters([zero, few, many], state({ applicants: ['none'] }), f)).toEqual([zero]);
    expect(applyBoardFilters([zero, few, many], state({ applicants: ['few'] }), f)).toEqual([few]);
    expect(applyBoardFilters([zero, few, many], state({ applicants: ['many'] }), f)).toEqual([many]);
  });

  it('"มี Lead" เป็นค่าคู่ขนาน — ใบที่ยังไม่มีคนสมัครแต่มี Lead ติดทั้งสองชิป', () => {
    expect(applyBoardFilters([zero, few, many], state({ applicants: ['lead'] }), f)).toEqual([zero]);
    const view = buildBoardFacets([zero, few, many], EMPTY_BOARD_FILTER_STATE, f).find((v) => v.key === 'applicants')!;
    expect(view.options.map((o) => [o.value, o.count])).toEqual([
      ['none', 1],
      ['few', 1],
      ['many', 1],
      ['lead', 1],
    ]);
    expect(view.ui).toBe('chip');
  });
});

describe('buildBoardFacets — เลขต่อท้าย', () => {
  it('🔴 เลขของหัวข้อตัวเองไม่ถูกหัวข้อตัวเองกรอง (เลือกจังหวัดแล้วจังหวัดอื่นยังมีเลข)', () => {
    const rows = [job({ location_address: addrChon }), job({ location_address: addrChon }), job({ location_address: addrBkk })];
    const view = buildBoardFacets(rows, state({ province: ['ชลบุรี'] }), facts()).find((v) => v.key === 'province')!;
    const byValue = Object.fromEntries(view.options.map((o) => [o.value, o.count]));
    expect(byValue['ชลบุรี']).toBe(2);
    expect(byValue['กรุงเทพมหานคร']).toBe(1);
    expect(view.selectedCount).toBe(1);
  });

  it('เลขของหัวข้ออื่นถูกกรองด้วยค่าที่เลือก', () => {
    const rows = [
      job({ location_address: addrChon, recruiter_name: 'คิว' }),
      job({ location_address: addrBkk, recruiter_name: 'แบงค์' }),
      job({ location_address: addrBkk, recruiter_name: 'คิว' }),
    ];
    const rec = buildBoardFacets(rows, state({ province: ['กรุงเทพมหานคร'] }), facts()).find((v) => v.key === 'recruiter')!;
    expect(Object.fromEntries(rec.options.map((o) => [o.value, o.count]))).toEqual({ คิว: 1, แบงค์: 1 });
  });

  it('ค่าที่ติ๊กไว้ยังอยู่ในรายการแม้เลขเป็น 0', () => {
    const rows = [job({ unit_name: 'A' }), job({ unit_name: 'B' })];
    const unit = buildBoardFacets(rows, state({ unit: ['Z'] }), facts()).find((v) => v.key === 'unit')!;
    const z = unit.options.find((o) => o.value === 'Z')!;
    expect(z).toMatchObject({ count: 0, selected: true });
  });
});

describe('🔴 ห้ามปุ่มหลอก', () => {
  it('ความเร่งด่วนหายไปเมื่อทุกใบเป็น "ล่วงหน้า" (ข้อมูลจริง 26 ก.ย.: 316/316)', () => {
    const rows = [job(), job(), job()];
    expect(buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).some((v) => v.key === 'urgency')).toBe(false);
  });

  it('โผล่กลับมาเองเมื่อมีใบด่วนจริง', () => {
    const rows = [job(), job({ urgency: 'urgent' })];
    const v = buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).find((x) => x.key === 'urgency');
    expect(v?.options.map((o) => o.label)).toEqual(['ด่วน', 'ล่วงหน้า']);
  });

  it('ค่าเดียวแต่ติ๊กค้างอยู่ (จากลิงก์เก่า) ยังต้องโชว์ ไม่งั้นล้างไม่ได้', () => {
    const rows = [job(), job()];
    expect(buildBoardFacets(rows, state({ urgency: ['urgent'] }), facts()).some((v) => v.key === 'urgency')).toBe(true);
  });

  it('รายได้: ค่าแรงดิบจาก ERP ไม่รู้หน่วย ⇒ ไม่เอาไปจัดช่วง', () => {
    expect(knownMonthlyIncome(job({ total_income: 400 }))).toBeNull();
    expect(knownMonthlyIncome(job({ total_income: 12000 }))).toBeNull();
    // ฟีดจริงมีแต่ total_income ⇒ ทุกใบ "ไม่ทราบหน่วย" ⇒ หัวข้อรายได้ซ่อนเอง
    const rows = [job({ total_income: 400 }), job({ total_income: 12000 })];
    expect(buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).some((v) => v.key === 'income')).toBe(false);
  });

  it('รายได้ที่รู้หน่วยต่อเดือนจริง จัดช่วงได้', () => {
    expect(knownMonthlyIncome(job({ monthly_income: 15500 }))).toBe(15500);
    expect(
      knownMonthlyIncome(job({ income_display: { period: 'monthly', total: 18000, lines: [] } })),
    ).toBe(18000);
    const rows = [job({ monthly_income: 11000 }), job({ monthly_income: 21000 })];
    const v = buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).find((x) => x.key === 'income')!;
    expect(v.options.filter((o) => o.count > 0).map((o) => o.value)).toEqual(['lt12k', '20k+']);
  });
});

describe('เส้นข้อมูลที่ยังไม่พร้อม', () => {
  const a = job();
  const b = job();

  it('ทะเบียนปล่อยยังไม่มา = ไม่มีหัวข้อสถานะประกาศ และติ๊กค้างก็ไม่ตัดใบทิ้ง', () => {
    const f = facts({ released: null });
    expect(buildBoardFacets([a, b], EMPTY_BOARD_FILTER_STATE, f).some((v) => v.key === 'release')).toBe(false);
    expect(applyBoardFilters([a, b], state({ release: ['released'] }), f)).toEqual([a, b]);
  });

  it('พร้อมแล้ว = กรองได้จริง', () => {
    const f = facts({ released: new Set([a.id]) });
    expect(applyBoardFilters([a, b], state({ release: ['unreleased'] }), f)).toEqual([b]);
  });

  it('🔴 ยอดผู้สมัครยังไม่มา = ไม่มีหัวข้อจำนวนผู้สมัคร (ไม่งั้นขึ้น "ยังไม่มีคนสมัคร" ทั้งกอง)', () => {
    const f = facts({ countsReady: false });
    expect(buildBoardFacets([a, b], EMPTY_BOARD_FILTER_STATE, f).some((v) => v.key === 'applicants')).toBe(false);
    expect(applyBoardFilters([a, b], state({ applicants: ['many'] }), f)).toEqual([a, b]);
  });

  it('ยอด AI ยังไม่มา = ไม่มีหัวข้อ AI โทร', () => {
    expect(buildBoardFacets([a, b], EMPTY_BOARD_FILTER_STATE, facts({ ai: null })).some((v) => v.key === 'ai')).toBe(false);
    const f = facts({ ai: { [a.id]: 2 } });
    expect(applyBoardFilters([a, b], state({ ai: ['sent'] }), f)).toEqual([a]);
  });
});

describe('ช่วงอายุ — ใบที่ช่วงทับกับที่เลือก', () => {
  it('ใบ 22–40 ติดทั้ง 18–25 · 26–35 · 36–45 แต่ไม่ติด 46+', () => {
    const j = job({ age_range_min: 22, age_range_max: 40 });
    for (const band of ['18-25', '26-35', '36-45']) {
      expect(applyBoardFilters([j], state({ age: [band] }), facts())).toEqual([j]);
    }
    expect(applyBoardFilters([j], state({ age: ['46+'] }), facts())).toEqual([]);
  });

  it('ไม่มีช่วงอายุเลย = "ไม่ระบุ"', () => {
    const j = job({ age_range_min: undefined, age_range_max: undefined });
    expect(applyBoardFilters([j], state({ age: [UNSPECIFIED] }), facts())).toEqual([j]);
  });
});

describe('จังหวัด → อำเภอ', () => {
  it('ยังไม่เลือกจังหวัด = ไม่มีหัวข้ออำเภอ', () => {
    const rows = [job(), job({ location_address: addrBkk })];
    expect(buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).some((v) => v.key === 'district')).toBe(false);
  });

  it('เลือกจังหวัดแล้ว อำเภอของใบขอโผล่ให้กรอง', () => {
    const chon = job({ location_address: addrChon });
    const chon2 = job({ location_address: 'ต.แสนสุข อ.เมืองชลบุรี จ.ชลบุรี' });
    const s = state({ province: ['ชลบุรี'] });
    const view = buildBoardFacets([chon, chon2], s, facts()).find((v) => v.key === 'district');
    expect(view?.options.map((o) => o.value)).toContain('บางละมุง');
    expect(applyBoardFilters([chon, chon2], state({ province: ['ชลบุรี'], district: ['บางละมุง'] }), facts())).toEqual([chon]);
  });

  it('เอาจังหวัดออก = อำเภอของจังหวัดนั้นที่ติ๊กไว้หลุดตาม', () => {
    const s = state({ province: ['ชลบุรี'], district: ['บางละมุง'] });
    const next = toggleBoardFacetValue(s, 'province', 'ชลบุรี');
    expect(next.selection.province).toEqual([]);
    expect(next.selection.district).toEqual([]);
  });
});

describe('ช่วงวันที่ (แถบบน)', () => {
  const early = job({ required_date: '2026-09-05', request_date: '2026-08-01' });
  const late = job({ required_date: '2026-11-01', request_date: '2026-09-20' });

  it('กรองตามวันที่ต้องการ (ค่าตั้งต้น)', () => {
    expect(applyBoardFilters([early, late], state({}, { field: 'required', from: '2026-10-01', to: '' }), facts())).toEqual([late]);
  });

  it('สลับไปกรองวันที่ขอได้', () => {
    expect(applyBoardFilters([early, late], state({}, { field: 'request', from: '', to: '2026-08-31' }), facts())).toEqual([early]);
  });

  it('ใบที่ไม่มีวันที่ในช่องนั้น ไม่ถูกแอบปล่อยผ่าน', () => {
    const blank = job({ required_date: '' });
    expect(applyBoardFilters([blank], state({}, { field: 'required', from: '2026-01-01', to: '' }), facts())).toEqual([]);
  });
});

describe('visibleFacetOptions — ช่องค้นหาในหัวข้อค่าเยอะ', () => {
  const opts = Array.from({ length: 15 }, (_, i) => ({
    value: `u${i}`,
    label: `หน่วย ${i}`,
    count: 15 - i,
    selected: i === 12,
  }));

  it('ยังไม่พิมพ์ = 10 ค่า โดยค่าที่ติ๊กลอยขึ้นบนสุด', () => {
    const { shown, hiddenCount } = visibleFacetOptions(opts, '');
    expect(shown).toHaveLength(10);
    expect(shown[0].value).toBe('u12');
    expect(hiddenCount).toBe(5);
  });

  it('พิมพ์แล้ว = ทุกค่าที่ตรง (ค่าที่ติ๊กยังอยู่บนสุด)', () => {
    const { shown } = visibleFacetOptions(opts, 'หน่วย 1');
    expect(shown.map((o) => o.value)).toEqual(['u12', 'u1', 'u10', 'u11', 'u13', 'u14']);
  });
});

describe('URL', () => {
  it('🔴 เขียนตัวกรองแล้ว params อื่น (view/lane/step/job) อยู่ครบ', () => {
    const base = new URLSearchParams('view=board&lane=unreleased&step=2&job=X1');
    const next = writeBoardFilterState(base, state({ unit: ['A', 'B'], applicants: ['none'] }, { field: 'required', from: '2026-10-01', to: '' }));
    expect(next.get('view')).toBe('board');
    expect(next.get('lane')).toBe('unreleased');
    expect(next.get('step')).toBe('2');
    expect(next.get('job')).toBe('X1');
    expect(next.getAll('f.unit')).toEqual(['A', 'B']);
  });

  it('อ่านกลับได้ครบ (กดย้อนกลับแล้วตัวกรองอยู่)', () => {
    const s = state({ unit: ['หน่วย, จำกัด'], province: ['ชลบุรี'] }, { field: 'request', from: '2026-09-01', to: '2026-09-30' });
    expect(readBoardFilterState(writeBoardFilterState(new URLSearchParams(), s))).toEqual(s);
  });

  it('ล้างแล้ว URL กลับเป็นเหมือนไม่เคยกรอง', () => {
    const base = new URLSearchParams('view=board');
    const dirty = writeBoardFilterState(base, state({ unit: ['A'] }));
    expect(writeBoardFilterState(dirty, EMPTY_BOARD_FILTER_STATE).toString()).toBe('view=board');
  });

  it('วันที่รูปแบบเพี้ยนไม่ถูกเอามาใช้', () => {
    expect(readBoardFilterState(new URLSearchParams('dfrom=26/09/2569')).dates).toBeNull();
  });

  it('ค่าเรียงไม่รู้จัก = ค่าเดิมของบอร์ด', () => {
    expect(readBoardSort(new URLSearchParams('sort=xxx'))).toBe('age');
    expect(readBoardSort(new URLSearchParams('sort=newest'))).toBe('newest');
  });
});

describe('สรุปและปุ่มล้าง', () => {
  it('แถบ "กำลังดู" สรุปด้วยคำบนจอ ไม่ใช่รหัส', () => {
    const text = describeBoardFilters(state({ applicants: ['none'], recruiter: [UNSPECIFIED] }));
    expect(text).toBe('จำนวนผู้สมัคร: ยังไม่มีคนสมัคร · เจ้าหน้าที่สรรหา: ไม่มีผู้รับผิดชอบ');
  });

  it('ช่วงวันที่ในแถบ "กำลังดู" ใช้รูปวันที่เดียวกับทั้งระบบ (ไม่ใช่ 2026-10-01)', () => {
    const text = describeBoardFilters(state({}, { field: 'required', from: '2026-10-01', to: '2026-10-31' }));
    expect(text).toBe('วันที่ต้องการ: 1/10/2569 – 31/10/2569');
    expect(describeBoardFilters(state({}, { field: 'request', from: '', to: '2026-09-30' }))).toBe(
      'วันที่ขอ: … – 30/9/2569',
    );
  });

  it('ล้างแถบซ้าย = ช่วงวันที่ (แถบบน) คงอยู่', () => {
    const s = state({ unit: ['A'] }, { field: 'required', from: '2026-10-01', to: '' });
    const cleared = clearBoardFacets(s);
    expect(countSelectedFacetValues(cleared)).toBe(0);
    expect(hasAnyBoardFilter(cleared)).toBe(true);
  });
});

describe('ปุ่มเรียงการ์ด', () => {
  const byAge = () => 0;
  const a = job({ request_date: '2026-09-01' });
  const b = job({ request_date: '2026-09-20' });
  const c = job({ request_date: '2026-08-15' });
  const apps: Record<string, number> = { [a.id]: 5, [b.id]: 0, [c.id]: 2 };

  it('ผู้สมัครน้อย → มาก', () => {
    expect(sortBoardJobs([a, b, c], 'fewest_applicants', (j) => apps[j.id], byAge)).toEqual([b, c, a]);
  });

  it('ใบใหม่ → เก่า (ตามวันที่ขอ)', () => {
    expect(sortBoardJobs([a, b, c], 'newest', (j) => apps[j.id], byAge)).toEqual([b, a, c]);
  });
});

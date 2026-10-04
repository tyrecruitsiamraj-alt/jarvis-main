import { describe, expect, it } from 'vitest';
import type { PublishReadiness } from '@/lib/publishReadiness';
import type { JobRequest } from '@/types';
import {
  applyBoardFilters,
  boardFacetValueLabel,
  buildBoardFacets,
  drivingSubtypeOf,
  clearBoardFacets,
  countSelectedFacetValues,
  describeBoardFilters,
  EMPTY_BOARD_FILTER_STATE,
  hasAnyBoardFilter,
  onlineIncomeValue,
  readBoardFilterState,
  readBoardSearch,
  readBoardSort,
  sortBoardJobs,
  toggleBoardFacetValue,
  UNSPECIFIED,
  visibleFacetOptions,
  writeBoardFilterState,
  writeBoardSearch,
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
 * 3. ห้ามปุ่มหลอก — ข้อมูลจริงว่างทั้งหมด = ไม่โชว์หัวข้อ · หัวข้อชิปตายตัวโชว์ครบ เลข 0 จาง
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

describe('🔴 ห้ามปุ่มหลอก · หัวข้อตายตัวโชว์ครบ', () => {
  it('ความเร่งด่วน: ทุกใบ "ล่วงหน้า" (ข้อมูลจริง 26 ก.ย.: 316/316) ก็ยังโชว์ครบ — ด่วน 0 จาง', () => {
    const rows = [job(), job(), job()];
    const v = buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).find((x) => x.key === 'urgency')!;
    expect(v.options.map((o) => [o.label, o.count])).toEqual([
      ['ด่วน', 0],
      ['ล่วงหน้า', 3],
    ]);
  });

  it('หัวข้อค่าเยอะที่ข้อมูลว่างทั้งหมด = ไม่โชว์ (ไม่มีอะไรให้กด)', () => {
    const rows = [job({ recruiter_name: '' }), job({ recruiter_name: '' })];
    expect(buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).some((v) => v.key === 'recruiter')).toBe(false);
  });

  it('หัวข้อค่าเยอะที่มีค่าเดียวก็ยังโชว์ (ไม่ใช่ปุ่มหลอก — บอกว่าทั้งกองเป็นของใคร)', () => {
    const rows = [job({ recruiter_name: 'คิว' }), job({ recruiter_name: 'คิว' })];
    expect(buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).some((v) => v.key === 'recruiter')).toBe(true);
  });

  it('ค่าที่ติ๊กค้างอยู่ (จากลิงก์เก่า) ยังต้องโชว์ ไม่งั้นล้างไม่ได้', () => {
    const rows = [job({ recruiter_name: '' })];
    expect(buildBoardFacets(rows, state({ recruiter: ['คิว'] }), facts()).some((v) => v.key === 'recruiter')).toBe(true);
  });

  it('หัวข้อ "ประเภทงาน" ถูกถอดแล้ว (เจ้าของเคาะ 26 ก.ย.)', () => {
    const rows = [job({ job_type: 'central' }), job({ job_type: 'valet_parking' })];
    expect(buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).some((v) => (v.key as string) === 'jobType')).toBe(false);
  });
});

describe('รายได้บนประกาศ — ค่าที่ทีม Online ตั้งเท่านั้น', () => {
  it('🔴 ยังไม่ตั้ง = "ยังไม่ตั้งรายได้" · ห้ามเอาเลข ERP มาอุด', () => {
    expect(onlineIncomeValue(job({ total_income: 12000 }))).toBe('unset');
    expect(onlineIncomeValue(job({ monthly_income: 15500 }))).toBe('unset');
    expect(boardFacetValueLabel('income', 'unset')).toBe('ยังไม่ตั้งรายได้');
  });

  it('ตั้งแบบแยกรายการต่อเดือน = จัดช่วงตามยอดรวมที่ผู้สมัครเห็น', () => {
    const j = job({ field_overrides: { income: { period: 'monthly', lines: [{ label: 'ฐาน', amount: 16000 }], total: null } } });
    expect(onlineIncomeValue(j)).toBe('15-20k');
  });

  it('ตั้งเป็นรายวัน = "ตั้งเป็นรายวัน" (ไม่แปลงเอง) · เลขเดี่ยวแบบเก่า = ตั้งแล้วแต่ไม่รู้หน่วย', () => {
    const daily = job({ field_overrides: { income: { period: 'daily', lines: [{ label: 'ค่าแรง', amount: 450 }], total: null } } });
    expect(onlineIncomeValue(daily)).toBe('daily');
    expect(onlineIncomeValue(job({ field_overrides: { total_income: 14000 } }))).toBe(UNSPECIFIED);
  });

  it('หัวข้อโชว์เสมอแม้ทุกใบยังไม่ตั้ง — ช่วงเงินเป็น 0 จาง ๆ ให้เห็นว่ามีตัวกรองนี้', () => {
    const rows = [job(), job()];
    const v = buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).find((x) => x.key === 'income')!;
    expect(v.options.map((o) => o.value)).toEqual(['unset', 'lt12k', '12-15k', '15-20k', '20k+', 'daily']);
    expect(v.options[0].count).toBe(2);
  });
});

describe('เพศที่รับ', () => {
  it('🔴 รหัส O ขึ้น "ไม่ระบุ" ไม่ใช่ตัว O ดิบ · ตัวเลือกตายตัวโชว์ครบ', () => {
    const rows = [job({ gender_requirement: 'O' }), job({ gender_requirement: 'ชาย' })];
    const v = buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).find((x) => x.key === 'gender')!;
    expect(v.options.map((o) => [o.label, o.count])).toEqual([
      ['ชาย', 1],
      ['หญิง', 0],
      ['ไม่จำกัด', 0],
      ['ไม่ระบุ', 1],
    ]);
  });

  it('ค่าที่ทีม Online เลือก "ไม่จำกัด" กรองได้', () => {
    const any = job({ gender_requirement: 'ไม่จำกัด' });
    expect(applyBoardFilters([any, job()], state({ gender: ['ไม่จำกัด'] }), facts())).toEqual([any]);
  });
});

describe('ตำแหน่งงาน → งานย่อย (เฉพาะงานขับรถ)', () => {
  const central = job({ job_description_code_1: 'ขับรถ', job_description_code_2: 'ส่วนกลาง' });
  const boss = job({ job_description_code_1: 'ขับรถ', job_description_code_2: 'รถผู้บริหารคนไทย' });
  const valet = job({ job_description_code_1: 'ขับรถ', job_description_code_2: 'Valet Parking' });
  const other = job({ job_description_code_1: 'ขับรถ', job_description_code_2: 'ชนิดที่ 2' });
  const garden = job({ job_description_code_1: 'คนสวน', job_description_code_2: '1' });
  const rows = [central, boss, valet, other, garden];

  it('ยังไม่เลือกตำแหน่ง = ไม่มีหัวข้องานย่อย', () => {
    expect(buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).some((v) => v.key === 'subtype')).toBe(false);
  });

  it('เลือกตำแหน่งที่ไม่ใช่งานขับรถ = ไม่มีงานย่อย', () => {
    expect(buildBoardFacets(rows, state({ position: ['คนสวน'] }), facts()).some((v) => v.key === 'subtype')).toBe(false);
  });

  it('เลือก "ขับรถ" แล้ว งานย่อยโผล่: ส่วนกลาง · นายไทย · นายต่างชาติ · Valet · อื่น ๆ (4 ต.ค. 2569)', () => {
    const v = buildBoardFacets(rows, state({ position: ['ขับรถ'] }), facts()).find((x) => x.key === 'subtype')!;
    expect(v.options.map((o) => [o.label, o.count])).toEqual([
      ['ส่วนกลาง', 1],
      ['นายไทย', 1],
      ['นายต่างชาติ', 0],
      ['นาย (ไม่ระบุสัญชาติ)', 0],
      ['Valet', 1],
      ['อื่น ๆ', 1],
    ]);
    expect(applyBoardFilters(rows, state({ position: ['ขับรถ'], subtype: ['boss_th'] }), facts())).toEqual([boss]);
  });

  it('นายแยกสัญชาติจากชนิดงานหรือช่องสัญชาติของนาย · "-" = ไม่ระบุ (ห้ามเดา)', () => {
    const at = (code2: string, nat: string | null) =>
      drivingSubtypeOf(job({ job_description_code_1: 'ขับรถ', job_description_code_2: code2, boss_nationality: nat }));
    expect(at('รถผู้บริหาร', 'คนไทย')).toBe('boss_th');
    expect(at('รถผู้บริหาร', 'ญี่ปุ่น')).toBe('boss_foreign');
    expect(at('รถผู้บริหารต่างชาติ', null)).toBe('boss_foreign');
    expect(at('รถผู้บริหาร', '-')).toBe('boss');
    expect(at('ส่วนกลาง', 'ญี่ปุ่น')).toBe('central');
  });

  it('เอาตำแหน่งขับรถออก = งานย่อยที่ติ๊กไว้หลุดตาม', () => {
    const next = toggleBoardFacetValue(state({ position: ['ขับรถ'], subtype: ['valet'] }), 'position', 'ขับรถ');
    expect(next.selection.subtype).toEqual([]);
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

  it('🔴 จังหวัด/อำเภอที่ทีม Online กรอกเองชนะที่อยู่ใบขอ (ไม่เติมจากจังหวัดของไซต์)', () => {
    const typed = job({ location_address: addrBkk, override_province: 'ลพบุรี', override_district: 'เมืองลพบุรี' });
    expect(applyBoardFilters([typed], state({ province: ['ลพบุรี'] }), facts())).toEqual([typed]);
    expect(applyBoardFilters([typed], state({ province: ['กรุงเทพมหานคร'] }), facts())).toEqual([]);
    expect(
      applyBoardFilters([typed], state({ province: ['ลพบุรี'], district: ['เมืองลพบุรี'] }), facts()),
    ).toEqual([typed]);
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

  it('คำค้นอยู่ใน URL (?q=) · ล้างแล้วหายจาก URL · params อื่นอยู่ครบ', () => {
    const base = new URLSearchParams('view=board&lane=unreleased');
    const withQ = writeBoardSearch(base, 'กรุงศรี');
    expect(readBoardSearch(withQ)).toBe('กรุงศรี');
    expect(withQ.get('view')).toBe('board');
    expect(writeBoardSearch(withQ, '   ').toString()).toBe('view=board&lane=unreleased');
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

describe('🔴 พร้อมประกาศไหม — แทนหัวข้อ "ติดขั้น" (เจ้าของเลือก B 2 ต.ค. 2569)', () => {
  const a = job();
  const b = job();
  const c = job();
  const released = job();
  const readinessById: Record<string, PublishReadiness> = {
    [a.id]: { kind: 'gaps', gaps: ['place', 'gender'] },
    [b.id]: { kind: 'ready' },
    [c.id]: { kind: 'moved', box: 'waiting' },
    [released.id]: { kind: 'released' }, // ประกาศแล้ว = ไม่อยู่ในหัวข้อนี้
  };
  const rows = [a, b, c, released];
  const withReadiness = (): BoardFacetFacts => ({ ...facts(), readinessOf: (j) => readinessById[j.id] ?? { kind: 'ready' } });

  it('บอกจำนวนครบทุกค่าตามลำดับ (0 ก็โชว์) · ใบที่ขาดหลายช่องนับทุกช่อง · ใบที่ประกาศแล้วไม่ถูกนับ', () => {
    const facet = buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, withReadiness()).find((f) => f.key === 'ready');
    expect(facet?.label).toBe('พร้อมประกาศไหม');
    expect(facet?.options.map((o) => [o.label, o.count])).toEqual([
      ['พร้อมประกาศ', 1],
      ['ขาดสถานที่', 1],
      ['ขาดรายได้', 0],
      ['ขาดเพศ', 1],
      ['มีคนเริ่มงานแล้ว', 1],
      ['ตั้งไม่ประกาศไว้', 0],
    ]);
  });

  it('ติ๊ก "ขาดสถานที่" = เหลือแต่ใบที่ขาดสถานที่ · ใบที่ประกาศแล้วหลุด', () => {
    const st = toggleBoardFacetValue(EMPTY_BOARD_FILTER_STATE, 'ready', 'gap_place');
    expect(applyBoardFilters(rows, st, withReadiness()).map((j) => j.id)).toEqual([a.id]);
  });

  it('ทะเบียนการประกาศยังไม่พร้อม = ไม่มีหัวข้อนี้ และค่าที่ค้างใน URL ต้องไม่ตัดใบทิ้ง', () => {
    expect(buildBoardFacets(rows, EMPTY_BOARD_FILTER_STATE, facts()).some((f) => f.key === 'ready')).toBe(false);
    const st = toggleBoardFacetValue(EMPTY_BOARD_FILTER_STATE, 'ready', 'ready');
    expect(applyBoardFilters(rows, st, { ...facts(), readinessOf: null })).toHaveLength(rows.length);
  });

  it('อยู่ใน URL เป็น f.ready และขึ้นก่อนหัวข้ออื่น', () => {
    const p = writeBoardFilterState(
      new URLSearchParams('view=board&lane=unreleased'),
      toggleBoardFacetValue(EMPTY_BOARD_FILTER_STATE, 'ready', 'ready'),
    );
    expect(p.getAll('f.ready')).toEqual(['ready']);
    expect(p.get('lane')).toBe('unreleased');
    expect(readBoardFilterState(p).selection.ready).toEqual(['ready']);
  });
});

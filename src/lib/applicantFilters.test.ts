import { describe, expect, it } from 'vitest';
import type { PublicApplication } from '@/lib/publicApplicationsApi';
import {
  applicantCallValue,
  applicantFacetValueLabel,
  applyApplicantFilters,
  buildApplicantFacets,
  describeApplicantFilters,
  EMPTY_APPLICANT_FILTER_STATE,
  readApplicantFilterState,
  toggleApplicantFacetValue,
  writeApplicantFilterState,
  type ApplicantFacetFacts,
  type ApplicantFilterState,
} from '@/lib/applicantFilters';
import { UNSPECIFIED } from '@/lib/facetEngine';

/**
 * แถบกรองแท็บฝั่งผู้สมัคร (เจ้าของเคาะแบบร่าง 27 ก.ย. 2569: "เอาตามร่างเลย")
 * ด่านที่ห้ามหลุด:
 * 1. สนใจ/ไม่สนใจ ตัดสินด้วยกติกาเดียวกับแท็บย่อย (ผลติดต่อที่ใหม่กว่าชนะ)
 * 2. หัวข้อนัดหมายโผล่เฉพาะแท็บติดตามนัดหมาย
 * 3. อำเภอโผล่หลังเลือกจังหวัด · เอาจังหวัดออก อำเภอหลุดตาม
 * 4. URL ใช้ prefix `a.` ไม่ชนกับ `f.` ของกล่องงาน และ params อื่นอยู่ครบ
 */

const NOW = new Date('2026-09-27T03:00:00Z'); // 27 ก.ย. 2569 10:00 น. เวลาไทย
const facts = (over: Partial<ApplicantFacetFacts> = {}): ApplicantFacetFacts => ({
  tab: 'candidates',
  now: NOW,
  ...over,
});
const state = (selection: ApplicantFilterState['selection']): ApplicantFilterState => ({ selection });

let seq = 0;
const app = (over: Partial<PublicApplication> = {}): PublicApplication =>
  ({
    id: `A${++seq}`,
    full_name: `ผู้สมัคร ${seq}`,
    phone: '0800000000',
    status: 'new',
    created_at: '2026-09-26T02:00:00Z',
    province: 'ลพบุรี',
    district: 'เมืองลพบุรี',
    age: 30,
    gender: 'male',
    education: 'ม.ปลาย/ปวช.',
    referral_source: 'facebook',
    job_title: 'ขับรถผู้บริหาร · กรุงศรี ลพบุรี',
    position_interest: 'พนักงานขับรถ',
    ...over,
  }) as PublicApplication;

describe('ผลโทรล่าสุด — กติกาเดียวกับแท็บย่อย', () => {
  it('สนใจ / ไม่สนใจ / ยังติดต่อไม่ได้ / ยังไม่โทร', () => {
    expect(applicantCallValue(app({ last_call_outcome: 'confirmed', last_call_at: '2026-09-26T05:00:00Z' }))).toBe('interested');
    expect(applicantCallValue(app({ last_call_outcome: 'declined', last_call_at: '2026-09-26T05:00:00Z' }))).toBe('not_interested');
    expect(applicantCallValue(app({ last_call_outcome: 'no_answer', last_call_at: '2026-09-26T05:00:00Z' }))).toBe('pending');
    expect(applicantCallValue(app({ dial_count: 1 }))).toBe('pending');
    expect(applicantCallValue(app())).toBe('none');
  });

  it('🔴 ผลติดต่อ "ไม่สำเร็จ" ที่ใหม่กว่าผลโทร = ไม่สนใจ (เหมือนแท็บย่อย)', () => {
    const a = app({
      last_call_outcome: 'confirmed',
      last_call_at: '2026-09-25T05:00:00Z',
      last_contact_ok: false,
      last_contact_at: '2026-09-26T05:00:00Z',
    });
    expect(applicantCallValue(a)).toBe('not_interested');
  });

  it('ชิปโชว์ครบ 4 ตัวแม้บางตัวเป็น 0', () => {
    const v = buildApplicantFacets([app(), app()], EMPTY_APPLICANT_FILTER_STATE, facts()).find((f) => f.key === 'call')!;
    expect(v.options.map((o) => [o.label, o.count])).toEqual([
      ['สนใจ', 0],
      ['ยังติดต่อไม่ได้', 0],
      ['ไม่สนใจ', 0],
      ['ยังไม่โทร', 2],
    ]);
  });
});

describe('หัวข้อนัดหมาย — เฉพาะแท็บติดตามนัดหมาย', () => {
  const rows = [
    app({ status: 'converted', appointment_at: '2026-09-27T03:00:00Z', appointment_place: 'สาขาลพบุรี' }),
    app({ status: 'converted', appointment_at: '2026-09-25T03:00:00Z', attendance_result: 'showed' }),
    app({ status: 'converted', appointment_at: '2026-10-02T03:00:00Z' }),
  ];

  it('แท็บอื่นไม่มีหัวข้อนัด', () => {
    const keys = buildApplicantFacets(rows, EMPTY_APPLICANT_FILTER_STATE, facts()).map((f) => f.key);
    expect(keys).not.toContain('apptWhen');
    expect(keys).not.toContain('attendance');
  });

  it('วันนัดแบ่ง เลยแล้ว / วันนี้ / 7 วันข้างหน้า · ผลมา/ไม่มา · ติ๊กแล้วกรองได้', () => {
    const f = facts({ tab: 'appointments' });
    const when = buildApplicantFacets(rows, EMPTY_APPLICANT_FILTER_STATE, f).find((x) => x.key === 'apptWhen')!;
    expect(when.options.map((o) => [o.label, o.count])).toEqual([
      ['เลยวันนัดแล้ว', 1],
      ['วันนี้', 1],
      ['7 วันข้างหน้า', 1],
      ['หลังจากนั้น', 0],
    ]);
    expect(applyApplicantFilters(rows, state({ apptWhen: ['today'] }), f)).toEqual([rows[0]]);
    expect(applyApplicantFilters(rows, state({ attendance: [UNSPECIFIED] }), f)).toHaveLength(2);
    expect(applicantFacetValueLabel('attendance', UNSPECIFIED)).toBe('ยังไม่บันทึก');
  });
});

describe('จังหวัด → อำเภอ', () => {
  const lop = app({ province: 'ลพบุรี', district: 'ชัยบาดาล' });
  const bkk = app({ province: 'กรุงเทพมหานคร', district: 'บางรัก' });

  it('ยังไม่เลือกจังหวัด = ไม่มีหัวข้ออำเภอ · เลือกแล้วโผล่เฉพาะอำเภอของจังหวัดนั้น', () => {
    expect(buildApplicantFacets([lop, bkk], EMPTY_APPLICANT_FILTER_STATE, facts()).some((f) => f.key === 'district')).toBe(false);
    const d = buildApplicantFacets([lop, bkk], state({ province: ['ลพบุรี'] }), facts()).find((f) => f.key === 'district')!;
    expect(d.options.map((o) => o.value)).toEqual(['ชัยบาดาล']);
  });

  it('เอาจังหวัดออก = อำเภอที่ติ๊กไว้หลุดตาม', () => {
    const next = toggleApplicantFacetValue(state({ province: ['ลพบุรี'], district: ['ชัยบาดาล'] }), 'province', 'ลพบุรี');
    expect(next.selection.district).toEqual([]);
  });
});

describe('หัวข้ออื่นตามแบบร่าง', () => {
  it('สมัครมาแล้วกี่วัน นับวันตามเวลาไทย', () => {
    const fresh = app({ created_at: '2026-09-26T02:00:00Z' });
    const old = app({ created_at: '2026-08-01T02:00:00Z' });
    expect(applyApplicantFilters([fresh, old], state({ days: ['0-3'] }), facts())).toEqual([fresh]);
    expect(applyApplicantFilters([fresh, old], state({ days: ['30+'] }), facts())).toEqual([old]);
  });

  it('ช่องทาง: ตารางช่องทางก่อน ไม่มีค่อยใช้ที่ผู้สมัครเลือก · เพศเป็นภาษาไทย', () => {
    const v = buildApplicantFacets([app({ channel_label: 'LINE OA' }), app()], EMPTY_APPLICANT_FILTER_STATE, facts());
    expect(v.find((x) => x.key === 'channel')!.options.map((o) => o.label).sort()).toEqual(['Facebook', 'LINE OA']);
    expect(v.find((x) => x.key === 'gender')!.options.map((o) => o.label)).toEqual(['ชาย', 'หญิง', 'อื่น ๆ']);
  });

  it('OR ในหัวข้อ · AND ข้ามหัวข้อ', () => {
    const a = app({ age: 24, province: 'ลพบุรี' });
    const b = app({ age: 40, province: 'ลพบุรี' });
    const c = app({ age: 40, province: 'ชลบุรี' });
    expect(applyApplicantFilters([a, b, c], state({ age: ['18-25', '36-45'], province: ['ลพบุรี'] }), facts())).toEqual([a, b]);
  });

  it('สรุปแถบ "กำลังดู" ด้วยคำบนจอ', () => {
    expect(describeApplicantFilters(state({ call: ['interested'], province: ['ลพบุรี'] }))).toBe(
      'ผลโทรล่าสุด: สนใจ · จังหวัดผู้สมัคร: ลพบุรี',
    );
  });
});

describe('URL', () => {
  it('🔴 prefix a. ไม่ชนกับ f. ของกล่องงาน · params อื่นอยู่ครบ · อ่านกลับได้', () => {
    const base = new URLSearchParams('view=list&list=interested&f.unit=A');
    const s = state({ province: ['ลพบุรี'], call: ['interested', 'none'] });
    const next = writeApplicantFilterState(base, s);
    expect(next.get('view')).toBe('list');
    expect(next.get('list')).toBe('interested');
    expect(next.getAll('f.unit')).toEqual(['A']);
    expect(next.getAll('a.call')).toEqual(['interested', 'none']);
    expect(readApplicantFilterState(next)).toEqual({ selection: { call: ['interested', 'none'], province: ['ลพบุรี'] } });
    expect(writeApplicantFilterState(next, EMPTY_APPLICANT_FILTER_STATE).toString()).toBe('view=list&list=interested&f.unit=A');
  });
});

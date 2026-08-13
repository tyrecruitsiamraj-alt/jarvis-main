// @vitest-environment node
/**
 * `src/lib/recruitRm.ts` — ตรรกะของหน้า "งานสรรหา (RM)"
 *
 * หัวใจของหน้า (เจ้าของย้ำ 11 ส.ค. 2569): ต้องรู้เสมอว่า **ใครสมัครมางานไหน**
 * และ 3 แท็บต้องเป็น 3 มุมของข้อมูลชุดเดียว ไม่ใช่ข้อมูลสามชุดที่นับกันคนละแบบ
 */
import { describe, expect, it } from 'vitest';
import {
  canHoldApplication,
  RM_TABS,
  RM_TAB_STATUSES,
  applicationJobLabel,
  countActiveRmFilters,
  EMPTY_RM_FILTERS,
  filterApplications,
  provincesFromApplications,
  rmTabHasLeadTools,
  splitApplicantName,
  toggleInList,
} from '../../src/lib/recruitRm';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

const app = (over: Partial<PublicApplication> = {}): PublicApplication => ({
  id: over.id ?? 'a1',
  full_name: 'สมชาย ใจดี',
  phone: '0812345678',
  status: 'new',
  created_at: '2026-08-11T02:00:00.000Z',
  ...over,
});

describe('แท็บ = สถานะใบสมัคร (ข้อมูลชุดเดียว สามมุมมอง)', () => {
  const rows = [
    app({ id: 'n1', status: 'new' }),
    app({ id: 'c1', status: 'contacted' }),
    app({ id: 'v1', status: 'converted' }),
    app({ id: 'r1', status: 'rejected' }),
  ];

  it('ข้อมูลผู้สมัคร = ใบที่ยังไม่ถูกเก็บ · การติดต่อ = ใบที่ฉันเก็บ · นัดหมาย = รับเข้าทำงาน', () => {
    // เจ้าของเปลี่ยนนิยาม 13 ส.ค. 2569: การติดต่อไม่ใช่ "สถานะ new+contacted" แล้ว
    // แต่คือ "ใบที่ฉันเก็บมาติดต่อ" (เลือกจากกล่องงาน) — ของใครของมัน
    expect(filterApplications(rows, 'candidates', EMPTY_RM_FILTERS, '').map((r) => r.id)).toEqual([
      'n1',
      'c1',
      'v1',
      'r1',
    ]);
    // ยังไม่มีใครเก็บ = แท็บการติดต่อว่าง
    expect(filterApplications(rows, 'contact', EMPTY_RM_FILTERS, '')).toEqual([]);
    expect(filterApplications(rows, 'appointments', EMPTY_RM_FILTERS, '').map((r) => r.id)).toEqual(['v1']);
  });

  it('ใบที่ฉันเก็บ: ออกจากข้อมูลผู้สมัคร → เข้าการติดต่อ (ไม่โผล่สองที่)', () => {
    const claimed = rows.map((r) => (r.id === 'c1' ? { ...r, claimed: true, claimed_by_me: true } : r));
    expect(filterApplications(claimed, 'candidates', EMPTY_RM_FILTERS, '').map((r) => r.id)).toEqual([
      'n1',
      'v1',
      'r1',
    ]);
    expect(filterApplications(claimed, 'contact', EMPTY_RM_FILTERS, '').map((r) => r.id)).toEqual(['c1']);
  });

  it('ใบที่คนอื่นเก็บ (claimed แต่ไม่ใช่ของฉัน) ไม่โผล่ในการติดต่อของฉัน', () => {
    // server กรองใบของคนอื่นออกจาก feed อยู่แล้ว — เทสต์นี้กันชั้นที่สอง
    // เผื่อแถวหลุดมา (เช่นจาก ?job_id= ที่ไม่กรอง)
    const claimed = rows.map((r) => (r.id === 'c1' ? { ...r, claimed: true, claimed_by_me: false } : r));
    expect(filterApplications(claimed, 'contact', EMPTY_RM_FILTERS, '')).toEqual([]);
  });

  it('คนที่ถูกปฏิเสธต้องไม่โผล่ในแท็บงาน (การติดต่อ/นัดหมาย) — จบแล้วคือจบ', () => {
    for (const tab of ['contact', 'appointments'] as const) {
      expect(filterApplications(rows, tab, EMPTY_RM_FILTERS, '').some((r) => r.id === 'r1')).toBe(false);
    }
  });

  it('ทุกแท็บมีนิยามสถานะครบ — เพิ่มแท็บใหม่แล้วลืมนิยามจะพัง', () => {
    for (const t of RM_TABS) expect(RM_TAB_STATUSES[t] !== undefined).toBe(true);
  });

  it('เครื่องมือ Lead มีเฉพาะแท็บแรก (ตาม HTML ระบบเดิม)', () => {
    expect(rmTabHasLeadTools('candidates')).toBe(true);
    expect(rmTabHasLeadTools('contact')).toBe(false);
    expect(rmTabHasLeadTools('appointments')).toBe(false);
  });
});

describe('คนที่ตอบ "ไม่สนใจ" กลับเข้าคลังกลาง (เจ้าของสั่ง 13 ส.ค. 2569)', () => {
  // "กรณีคนไม่สนใจให้ไปอยู่ในนี้" — ชี้ที่แท็บรายชื่อผู้สมัคร
  // เหตุผล: งานใบนั้นจบแล้ว แต่ **คนยังอยู่ในระบบ** เอาไปเสนองานอื่นได้
  // ถ้าปล่อยค้างในถัง "การติดต่อ" ของคนเก็บ = งานค้างที่ไม่มีวันจบ และคนหายจากคลัง
  const declined = app({
    id: 'd1',
    status: 'contacted',
    claimed: true,
    claimed_by_me: true,
    last_call_outcome: 'declined',
  });

  it('ใบที่ฉันเก็บไว้ แต่โทรแล้วได้ "ไม่สนใจ" → ออกจากการติดต่อ กลับเข้ารายชื่อผู้สมัคร', () => {
    expect(filterApplications([declined], 'contact', EMPTY_RM_FILTERS, '')).toEqual([]);
    expect(filterApplications([declined], 'candidates', EMPTY_RM_FILTERS, '').map((r) => r.id)).toEqual(['d1']);
  });

  it('⚠️ "ไม่รับสาย/ขอเลื่อน" ยังไม่จบ — ต้องค้างอยู่ในถังคนตามต่อเหมือนเดิม', () => {
    for (const outcome of ['no_answer', 'reschedule_requested', 'busy']) {
      const pending = { ...declined, last_call_outcome: outcome };
      expect(filterApplications([pending], 'contact', EMPTY_RM_FILTERS, '').map((r) => r.id)).toEqual(['d1']);
      expect(filterApplications([pending], 'candidates', EMPTY_RM_FILTERS, '')).toEqual([]);
    }
  });

  it('⚠️ คนที่รับเข้าทำงานแล้วยังอยู่แท็บนัดหมาย แม้ผลโทรจะเป็นไม่สนใจ', () => {
    const converted = { ...declined, status: 'converted' as const };
    expect(filterApplications([converted], 'appointments', EMPTY_RM_FILTERS, '').map((r) => r.id)).toEqual(['d1']);
  });

  it('ไม่มีผลโทร = พฤติกรรมเดิมทุกอย่าง', () => {
    const noCall = { ...declined, last_call_outcome: undefined };
    expect(filterApplications([noCall], 'contact', EMPTY_RM_FILTERS, '').map((r) => r.id)).toEqual(['d1']);
  });
});

describe('applicationJobLabel — "ใครสมัครมางานไหน" ห้ามว่างเงียบ', () => {
  it('มีทั้งงานและหน่วยงาน → ต่อกันให้อ่านรวดเดียว', () => {
    expect(applicationJobLabel(app({ job_title: 'พนักงานขับรถ', unit_name: 'รพ.รามคำแหง' }))).toBe(
      'พนักงานขับรถ — รพ.รามคำแหง',
    );
  });

  it('ไม่มี job_title → ถอยไปใช้ตำแหน่งที่ผู้สมัครกรอกเอง', () => {
    expect(applicationJobLabel(app({ position_interest: 'แม่บ้าน' }))).toBe('แม่บ้าน');
  });

  it('ใบสมัครทั่วไปที่ไม่ผูกงาน → บอกตรง ๆ ไม่ปล่อยช่องว่าง', () => {
    // ช่องว่างในคอลัมน์หัวใจของหน้าอ่านเหมือนข้อมูลพัง ทั้งที่จริงคือ "สมัครแบบไม่ระบุงาน"
    expect(applicationJobLabel(app({}))).toBe('สมัครทั่วไป (ไม่ระบุงาน)');
  });
});

describe('filterApplications — กรอง+ค้น', () => {
  const rows = [
    app({ id: 'a', referral_source: 'facebook', province: 'ชลบุรี', job_title: 'ขับรถ' }),
    app({ id: 'b', referral_source: 'tiktok', province: 'ระยอง', full_name: 'มานี รักงาน', phone: '0999999999' }),
    app({ id: 'c', province: 'ชลบุรี' }), // ไม่มี referral_source
  ];

  it('กรองช่องทาง — แถวที่ไม่มีช่องทางต้องไม่ติดมากับตัวกรอง', () => {
    const out = filterApplications(rows, 'candidates', { ...EMPTY_RM_FILTERS, channels: ['facebook'] }, '');
    expect(out.map((r) => r.id)).toEqual(['a']);
  });

  it('กรองจังหวัด', () => {
    const out = filterApplications(rows, 'candidates', { ...EMPTY_RM_FILTERS, provinces: ['ชลบุรี'] }, '');
    expect(out.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('ค้นด้วยชื่อ เบอร์ และชื่องาน (หัวใจของหน้า: หาว่าใครสมัครงาน X)', () => {
    expect(filterApplications(rows, 'candidates', EMPTY_RM_FILTERS, 'มานี').map((r) => r.id)).toEqual(['b']);
    expect(filterApplications(rows, 'candidates', EMPTY_RM_FILTERS, '0999999999').map((r) => r.id)).toEqual(['b']);
    expect(filterApplications(rows, 'candidates', EMPTY_RM_FILTERS, 'ขับรถ').map((r) => r.id)).toEqual(['a']);
  });

  it('ไม่ติ๊กอะไรเลย = ไม่กรอง (ไม่ใช่กรองจนหมด)', () => {
    expect(filterApplications(rows, 'candidates', EMPTY_RM_FILTERS, '')).toHaveLength(3);
    expect(countActiveRmFilters(EMPTY_RM_FILTERS)).toBe(0);
  });
});

describe('ตัวช่วยเล็ก', () => {
  it('splitApplicantName — ใบเก่าที่มีแต่ full_name ต้องถอยไปตัดเอง', () => {
    expect(splitApplicantName(app({ first_name: 'สมชาย', last_name: 'ใจดี' }))).toEqual({
      firstName: 'สมชาย',
      lastName: 'ใจดี',
    });
    expect(splitApplicantName(app({ full_name: 'มานี รัก งาน' }))).toEqual({
      firstName: 'มานี',
      lastName: 'รัก งาน',
    });
  });

  it('provincesFromApplications — เอาเฉพาะจังหวัดที่มีคนสมัครจริง ไม่ซ้ำ เรียงไทย', () => {
    const out = provincesFromApplications([
      app({ province: 'ชลบุรี' }),
      app({ province: 'ชลบุรี' }),
      app({ province: 'กระบี่' }),
      app({ province: '' }),
      app({}),
    ]);
    expect(out).toEqual(['กระบี่', 'ชลบุรี']);
  });

  it('toggleInList — ติ๊กซ้ำ = เอาออก', () => {
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('ดึงไปโทร (call hold) จากแถวรายชื่อ — เงื่อนไขที่จับได้', () => {
  it('มีทั้งเบอร์และใบขอ = จับได้', () => {
    expect(canHoldApplication({ phone: '0812345678', job_id: 'siamraj-sql:X1' })).toEqual({ ok: true });
  });

  it('ไม่มีเบอร์ = จับไม่ได้ พร้อมเหตุผล', () => {
    const r = canHoldApplication({ phone: '  ', job_id: 'siamraj-sql:X1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('เบอร์');
  });

  it('ใบคีย์เอง (job_id ว่าง) = จับไม่ได้ — ห้ามผ่อน ไม่งั้นล็อกเบอร์ข้ามแผนกได้', () => {
    for (const job_id of [null, undefined, '', '  ']) {
      const r = canHoldApplication({ phone: '0812345678', job_id });
      expect(r.ok, String(job_id)).toBe(false);
      if (!r.ok) expect(r.reason).toContain('ใบขอ');
    }
  });
});

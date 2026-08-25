// @vitest-environment node
/**
 * KPI แถวบนหน้าหลัก + ตัวแปล BU (Phase 10 · เจ้าของเคาะ 24 ส.ค. 2569)
 *
 * ด่านที่ห้ามหลุด:
 * 1. เทียบวันต่อวันได้จริงเฉพาะตัวที่เป็นเหตุการณ์ — ไม่มีของให้เทียบ = `delta` เป็น null
 *    (ห้ามตอบ 0 ซึ่งคนอ่านว่า "เท่าเดิม")
 * 2. วันที่ยังไม่มีอะไรเกิด ต้องติดธง `quiet` ให้จอเลี่ยงการแปะ 0
 * 3. อัตรา % ที่ตัวอย่างน้อยกว่า MIN_RATE_SAMPLE ห้ามเอาไปอวด
 * 4. 🔴 BU ต้องมาจาก site_code ไม่ใช่ prefix เลขที่ใบขอ (วัดจริง: prefix ไม่มี LBA/LBD เลย)
 */
import { describe, expect, it } from 'vitest';
import {
  MIN_RATE_SAMPLE,
  buildKpiCard,
  buildKpiCards,
  buildOpenRequestsCard,
  deltaIsGood,
  deltaText,
  ratePct,
  KPI_ORDER,
} from '../../src/lib/homeKpi.js';
import { buFromSiteCode, buLabel, normalizeBu, sortBuOptions } from '../../src/lib/homeBu.js';

describe('KPI ที่เป็นจำนวนนับ', () => {
  it('ต่างจากเมื่อวานคิดตรง ๆ', () => {
    const c = buildKpiCard('newApplicants', { today: 12, yesterday: 8 });
    expect(c.value).toBe(12);
    expect(c.delta).toBe(4);
    expect(c.quiet).toBe(false);
    expect(c.sub).toContain('8');
  });

  it('ลดลงก็บอกว่าลด', () => {
    const c = buildKpiCard('callResults', { today: 3, yesterday: 9 });
    expect(c.delta).toBe(-6);
    expect(deltaText(c.delta, c.unit)).toBe('−6 สาย จากเมื่อวาน');
    expect(deltaIsGood(c.delta)).toBe(false);
  });

  it('🔴 วันนี้ 0 และเมื่อวาน 0 = เทียบไม่ได้ ไม่ใช่ "เท่าเดิม"', () => {
    const c = buildKpiCard('interested', { today: 0, yesterday: 0 });
    expect(c.delta).toBeNull();
    expect(c.quiet).toBe(true);
    expect(deltaText(c.delta, c.unit)).toBeNull();
    expect(deltaIsGood(c.delta)).toBeNull();
  });

  it('วันนี้ 0 แต่เมื่อวานมี = ต้องเห็นว่าหายไป', () => {
    const c = buildKpiCard('appointments', { today: 0, yesterday: 4 });
    expect(c.delta).toBe(-4);
    expect(c.quiet).toBe(true);
  });

  it('เท่าเมื่อวานพอดี บอกเป็นคำ ไม่ใช่ลูกศร', () => {
    const c = buildKpiCard('newApplicants', { today: 5, yesterday: 5 });
    expect(c.delta).toBe(0);
    expect(deltaText(c.delta, c.unit)).toBe('เท่าเมื่อวาน');
    expect(deltaIsGood(c.delta)).toBeNull();
  });

  it('เลขติดลบ/เศษจากฐานไม่ทำการ์ดเพี้ยน', () => {
    const c = buildKpiCard('newApplicants', { today: -3 as number, yesterday: 2.7 as number });
    expect(c.value).toBe(0);
    expect(c.delta).toBe(-2);
  });
});

describe('KPI ที่เป็นอัตรา', () => {
  it('ตัวหาร 0 ไม่ใช่ 0% — คืน null', () => {
    expect(ratePct(0, 0)).toBeNull();
    expect(ratePct(3, 0)).toBeNull();
  });

  it('ตัวอย่างพอ คิด % และเทียบเมื่อวานได้', () => {
    const c = buildKpiCard('connectRate', {
      today: 7,
      yesterday: 4,
      todayBase: 10,
      yesterdayBase: 10,
    });
    expect(c.value).toBe(70);
    expect(c.delta).toBe(30);
    expect(c.isRate).toBe(true);
    expect(c.sub).toContain('10');
  });

  it(`🔴 ตัวอย่างน้อยกว่า ${MIN_RATE_SAMPLE} สาย ห้ามเอา % ไปอวด`, () => {
    const c = buildKpiCard('connectRate', {
      today: 1,
      yesterday: 5,
      todayBase: 1,
      yesterdayBase: 10,
    });
    expect(c.quiet).toBe(true);
    expect(c.delta).toBeNull();
    expect(c.sub).toContain('ยังน้อยเกินตัดสิน');
  });

  it('เมื่อวานตัวอย่างน้อย = เทียบไม่ได้ แม้วันนี้พอ', () => {
    const c = buildKpiCard('connectRate', {
      today: 6,
      yesterday: 1,
      todayBase: 10,
      yesterdayBase: 2,
    });
    expect(c.value).toBe(60);
    expect(c.delta).toBeNull();
  });
});

describe('แถว KPI', () => {
  it('เรียงตามลำดับงานจริง 8 ใบ ไม่ขาดไม่เกิน', () => {
    expect(KPI_ORDER).toHaveLength(8);
    const cards = buildKpiCards({
      newRequests: { today: 1, yesterday: 0 },
      newApplicants: { today: 1, yesterday: 0 },
      callResults: { today: 1, yesterday: 0 },
      interested: { today: 1, yesterday: 0 },
      appointments: { today: 1, yesterday: 0 },
      apptToday: { today: 1, yesterday: 0 },
      followToday: { today: 1, yesterday: 0 },
      connectRate: { today: 1, yesterday: 0, todayBase: 10, yesterdayBase: 10 },
    });
    expect(cards.map((c) => c.key)).toEqual([...KPI_ORDER]);
    expect(cards.every((c) => c.unit.length > 0)).toBe(true);
    expect(cards.every((c) => c.href.startsWith('/'))).toBe(true);
  });

  it('ช่องที่ API ไม่ส่งมาก็ไม่ระเบิด', () => {
    const cards = buildKpiCards({} as never);
    expect(cards).toHaveLength(8);
    expect(cards.every((c) => c.delta === null && c.quiet)).toBe(true);
  });
});

describe('BU มาจาก site_code เท่านั้น', () => {
  it('อ่าน BU จากรหัสไซต์จริงที่วัดมาได้', () => {
    expect(buFromSiteCode('65LBDL0143')).toBe('LBD');
    expect(buFromSiteCode('66LML0011')).toBe('LML');
    expect(buFromSiteCode('67LBAL0019')).toBe('LBA');
    expect(buFromSiteCode('67DSL0044')).toBe('DSL');
    expect(buFromSiteCode('69SNJ0002')).toBe('SNJ');
    expect(buFromSiteCode('99LBDL0003')).toBe('LBD');
  });

  it('🔴 อ่านไม่ออก = null ห้ามยัดลงถังใดถังหนึ่ง', () => {
    expect(buFromSiteCode(null)).toBeNull();
    expect(buFromSiteCode('')).toBeNull();
    expect(buFromSiteCode('OPL6908026')).toBeNull(); // เลขที่ใบขอ ไม่ใช่รหัสไซต์
    expect(buFromSiteCode('7LBD0001')).toBeNull(); // ปีหลักเดียว
  });

  it('ป้ายไม่รู้จักโชว์รหัสเปล่า ไม่เดาคำไทย', () => {
    expect(buLabel('LBD')).toContain('LBD');
    expect(buLabel('ZZZ')).toBe('ZZZ');
    expect(buLabel(null)).toBe('ไม่ระบุ BU');
  });

  it('เรียงตัวเลือกของมากก่อน · ยอดเท่ากันเรียงรหัสคงที่', () => {
    const opts = sortBuOptions([
      { bu: 'LBA', count: 22 },
      { bu: 'LBD', count: 170 },
      { bu: 'SNJ', count: 3 },
      { bu: 'DSL', count: 3 },
      { bu: '', count: 99 },
    ]);
    expect(opts.map((o) => o.bu)).toEqual(['LBD', 'LBA', 'DSL', 'SNJ']);
  });

  it('ค่ามั่วจาก URL ถูกปัดตกเป็นดูทั้งหมด', () => {
    const allowed = ['LBD', 'LBA'];
    expect(normalizeBu('lbd', allowed)).toBe('LBD');
    expect(normalizeBu('all', allowed)).toBeNull();
    expect(normalizeBu('DROP TABLE', allowed)).toBeNull();
    expect(normalizeBu(undefined, allowed)).toBeNull();
  });
});

/**
 * ตัวแยกย่อยบนการ์ด (เจ้าของสั่ง 25 ส.ค. 2569: นัดวันนี้แยก มา/ไม่มา ·
 * Follow แยก ต้องโทร/โทรแล้ว/สำเร็จ)
 */
describe('ตัวแยกย่อยใต้ตัวเลขหลัก', () => {
  it('มี parts = sub เป็นตัวแยกย่อย ไม่ใช่บรรทัด "เมื่อวาน N"', () => {
    const c = buildKpiCard('apptToday', {
      today: 5,
      yesterday: 2,
      parts: [
        { label: 'มาแล้ว', value: 3 },
        { label: 'ไม่มา', value: 1 },
      ],
    });
    expect(c.sub).toBe('มาแล้ว 3 · ไม่มา 1');
    // ตัวเทียบเมื่อวานต้องไม่หาย — ย้ายไปอยู่ที่ delta ซึ่งจอวาดเป็นชิปแยก
    expect(c.delta).toBe(3);
  });

  it('ไม่มี parts = ยังใช้บรรทัดเมื่อวานเหมือนเดิม', () => {
    expect(buildKpiCard('newRequests', { today: 2, yesterday: 1 }).sub).toBe('เมื่อวาน 1 ใบ');
  });

  it('parts ที่เป็น 0 ต้องยังโชว์ — 0 คนมาคือข่าว ไม่ใช่ความว่างเปล่า', () => {
    const c = buildKpiCard('apptToday', {
      today: 4,
      yesterday: 0,
      parts: [
        { label: 'มาแล้ว', value: 0 },
        { label: 'ไม่มา', value: 4 },
      ],
    });
    expect(c.sub).toContain('มาแล้ว 0');
  });
});

/** 🔴 SLA ต้องมาคู่กันเสมอ — ตัวเดียวทำให้เข้าใจผิด (ใกล้หลุด 15 vs หลุดแล้ว 199) */
describe('การ์ดใบขอ — บรรทัด SLA', () => {
  it('รู้ทั้งคู่ = โชว์ทั้งคู่', () => {
    const c = buildOpenRequestsCard(292, 199, { breached: 199, atRisk: 15 });
    expect(c.sla).toBe('หลุด SLA 199 ใบ · ใกล้หลุด 15 ใบ');
  });

  it('รู้แค่ตัวเดียว = ไม่วาดบรรทัดนี้เลย', () => {
    expect(buildOpenRequestsCard(292, 199, { breached: 199 }).sla).toBeNull();
    expect(buildOpenRequestsCard(292, 199, { atRisk: 15 }).sla).toBeNull();
  });

  it('API รุ่นเก่าไม่ส่ง SLA มา = ไม่วาด ไม่ใช่โชว์ 0', () => {
    expect(buildOpenRequestsCard(292, 199).sla).toBeNull();
  });

  it('ไม่มีใบหลุดเลยก็ยังโชว์ (0 ที่รู้จริง ต่างจากไม่รู้)', () => {
    expect(buildOpenRequestsCard(10, 0, { breached: 0, atRisk: 0 }).sla).toBe(
      'หลุด SLA 0 ใบ · ใกล้หลุด 0 ใบ',
    );
  });
});

/** 🔴 ยอดคงค้างห้ามมีลูกศรเทียบเมื่อวาน (กติกาข้อ 1 ของ homeKpi.ts) */
describe('ยอดคงค้างเทียบวันต่อวันไม่ได้', () => {
  it('comparable:false ⇒ delta เป็น null แม้วันนี้มีเลข', () => {
    const c = buildKpiCard('followToday', { today: 7, yesterday: 0, comparable: false });
    expect(c.value).toBe(7);
    expect(c.delta).toBeNull();
  });

  it('ไม่ระบุ comparable = เทียบได้เหมือนเดิม', () => {
    expect(buildKpiCard('newRequests', { today: 7, yesterday: 2 }).delta).toBe(5);
  });
});

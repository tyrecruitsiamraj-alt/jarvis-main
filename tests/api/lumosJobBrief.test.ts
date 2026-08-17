// @vitest-environment node
/**
 * `api/_lib/lumosJobBrief.ts` — ย่อใบขอให้ AI พูดทางโทรศัพท์
 *
 * ⚠️ **ทุกอย่างในไฟล์นี้คือบทที่ AI จะพูดใส่หูผู้สมัครจริง** ไม่ใช่ข้อความบนหน้าจอ
 * ที่คนกวาดตาข้ามได้ · พังแล้วไม่มี error ไม่มี log — รู้ตอนผู้สมัครโทรมาถามว่า
 * "เมื่อกี้ระบบพูดอะไรไม่รู้เรื่องเลย" ซึ่งอาจไม่มีใครโทรมาบอกด้วยซ้ำ
 */
import { describe, it, expect } from 'vitest';
import { buildJobBrief, speakableDate } from '../../api/_lib/lumosJobBrief';
import { buildInterviewPayload, buildReminderPayload } from '../../api/_lib/lumosDispatch';

const RESULT = { jobId: 'siamraj-sql:J1', request_no: 'J1', job_family_label: null };
const CARD = { card_id: 1, full_name: 'สมชาย', mobile: '0812345678' };
const IR = { id: 2, full_name: 'สมหญิง', phone_number: '0812345678', job_name_th: null, position_name: null };

describe('buildJobBrief — เลือกว่าจะพูดอะไรบ้าง', () => {
  it('บอกสถานที่ทำงาน เวลาทำงาน และช่วงอายุที่รับ', () => {
    const b = buildJobBrief({
      unit_name: 'ลูกค้า ก',
      work_place: 'โรงพยาบาลรามคำแหง 1',
      work_schedule: 'วันจันทร์ - วันศุกร์ • 08:00 - 17:00 น.',
      age_range_min: 25,
      age_range_max: 50,
    });
    expect(b.detail).toContain('สถานที่ทำงาน โรงพยาบาลรามคำแหง 1');
    expect(b.detail).toContain('เวลาทำงาน วันจันทร์ - วันศุกร์ 08:00 - 17:00 น.');
    expect(b.detail).toContain('รับอายุ 25-50 ปี');
  });

  it('สถานที่ทำงานซ้ำกับชื่อหน่วยงาน → ไม่พูดซ้ำ', () => {
    // ข้อมูลจริงหลายใบใส่ชื่อลูกค้าเป๊ะ ๆ ในช่อง work_place (บางใบมีที่อยู่ต่อท้าย)
    // พูดสองรอบติดกันฟังเหมือนระบบค้าง
    const same = buildJobBrief({ unit_name: 'บริษัท ก จำกัด', work_place: 'บริษัท ก จำกัด' });
    expect(same.detail).not.toContain('สถานที่ทำงาน');

    const prefixed = buildJobBrief({
      unit_name: 'บริษัท ก จำกัด',
      work_place: 'บริษัท ก จำกัด เลขที่ 89 ถนนรัชดาภิเษก',
    });
    expect(prefixed.detail).not.toContain('สถานที่ทำงาน');
  });

  it('ค่าที่ ERP กรอกขีดไว้แทนช่องว่าง → ไม่เอามาพูด', () => {
    for (const mark of ['-', '--', '.', 'ไม่ระบุ', 'N/A']) {
      const b = buildJobBrief({ unit_name: 'ลูกค้า ก', work_place: mark, work_schedule: mark });
      expect(b.detail).toBe('');
    }
  });

  it('ไม่มีข้อมูลอะไรเลย → คืนสตริงว่าง (ข้อความหลักต้องไม่มีเศษต่อท้าย)', () => {
    expect(buildJobBrief({}).detail).toBe('');
  });

  describe('"คน+รถ" — เงื่อนไขที่ผู้สมัครตัดสินใจได้ทันที', () => {
    it('บอกตรง ๆ ว่าต้องใช้รถของตัวเอง', () => {
      const b = buildJobBrief({ contract_type_name: 'คน+รถ' });
      expect(b.needsOwnVehicle).toBe(true);
      expect(b.detail).toContain('ต้องใช้รถของตัวเอง');
    });

    it('"คนอย่างเดียว" ต้องไม่ขึ้นประโยคนี้', () => {
      // พูดผิดทางนี้คือไล่คนที่ไม่มีรถออกจากงานที่เขาทำได้
      const b = buildJobBrief({ contract_type_name: 'คนอย่างเดียว' });
      expect(b.needsOwnVehicle).toBe(false);
      expect(b.detail).not.toContain('รถ');
    });

    it('ประโยคเรื่องรถต้องไม่ถูกตัดความยาวทิ้ง', () => {
      const b = buildJobBrief({
        contract_type_name: 'คน+รถ',
        work_place: 'ก'.repeat(500),
        work_schedule: 'ข'.repeat(500),
      });
      expect(b.detail).toContain('งานนี้ต้องใช้รถของตัวเองในการทำงาน');
    });
  });

  describe('ตารางเวลาที่ยาวมาก', () => {
    // work_schedule = "work_date • work_time" — ท่อนแรกเป็นข้อความบรรยายยาวได้
    const LONG =
      'ตามแผนการจดหน่วย และประสานงานหลังเสร็จสิ้นการจดหน่วยเมื่องานมีปัญหาตามที่ลูกค้ากำหนด • 06:00 - 15:00 น.';

    it('⚠️ ต้องเก็บ "เวลาจริง" ไว้เสมอ ไม่ใช่ตัดเหลือแต่ท่อนบรรยาย', () => {
      // ตัดรวมเป็นก้อนเดียวจะได้แต่ท่อนแรก แล้วเวลาที่ผู้สมัครอยากรู้ที่สุดหายทั้งท่อน
      // (เจอกับข้อมูลจริง 2 ใน 3 ใบที่สุ่มดู)
      const b = buildJobBrief({ work_schedule: LONG });
      expect(b.workSchedule).toContain('06:00 - 15:00');
    });

    it('ยังต้องสั้นพอที่จะพูดจบ', () => {
      const b = buildJobBrief({ work_schedule: LONG });
      expect(b.workSchedule.length).toBeLessThan(LONG.length);
      expect(b.workSchedule.length).toBeLessThanOrEqual(95);
    });

    it('⚠️ ตัดแล้วต้องไม่เหลือวรรคตอนห้อย — "08.30 -…" AI อ่านว่า "ลบ" แล้วเงียบ', () => {
      // ของจริงจากใบ LAO6908007 (16 ส.ค. 2569) ตัดตรงกลางวงเล็บพอดี
      const b = buildJobBrief({
        work_schedule:
          '5 วัน/สัปดาห์ วันจันทร์ - วันศุกร์ บังคับทำงานล่วงเวลา • 9 ชม. รวมพัก ตามตารางกะ (ในช่วงเวลา 08.30 - 20.30 น.)',
      });
      expect(b.workSchedule).not.toMatch(/[-–—·,;:/(]…/);
      expect(b.workSchedule).not.toMatch(/\s…/);
    });

    it('ไม่มีตัวคั่น • ก็ยังตัดได้ ไม่พัง', () => {
      const b = buildJobBrief({ work_schedule: 'ก'.repeat(400) });
      expect(b.workSchedule.length).toBeLessThanOrEqual(95);
      expect(b.workSchedule.endsWith('…')).toBe(true);
    });
  });
});

describe('speakableDate — วันที่ที่พูดออกเสียงแล้วเข้าใจ', () => {
  it('แปลงเป็นวันที่ไทย พ.ศ.', () => {
    // เดิมส่ง "2026-08-01" ดิบ AI จึงอ่านเป็นตัวเลขเรียงให้ผู้สมัครฟัง
    const out = speakableDate('2026-08-01');
    expect(out).toContain('2569');
    expect(out).not.toContain('2026-08-01');
  });

  it('อ่านไม่ออก → คืนค่าเดิม (ดีกว่าตัดวันเริ่มงานทิ้งเงียบ ๆ)', () => {
    expect(speakableDate('เริ่มทันที')).toBe('เริ่มทันที');
    expect(speakableDate('')).toBe('');
    expect(speakableDate(null)).toBe('');
  });

  it('ตัวจัดรูปต้องประกาศระดับโมดูล — เรียก 30,000 ครั้งต้องไม่เกิน 1.5 วินาที', () => {
    // กติกาเดียวกับ businessDate.ts: `new Intl.*` ในฟังก์ชันที่ถูกเรียกต่อแถวแพงมาก
    // ตรงนี้ถูกเรียกทุกคนที่เข้าคิว (เข้าคิวทีละ 50 คน × หลายใบขอ)
    const t0 = Date.now();
    for (let i = 0; i < 30_000; i += 1) speakableDate('2026-08-01');
    expect(Date.now() - t0).toBeLessThan(1500);
  });
});

describe('ต่อเข้า payload จริง', () => {
  const JOB = {
    unit_name: 'ลูกค้า ก',
    job_description_code_1: 'ขับรถ',
    required_date: '2026-08-10',
    total_income: 13000,
    work_place: 'สนง.จังหวัดตาก',
    work_schedule: 'วันจันทร์ - วันศุกร์ • 08:00 - 17:00 น.',
    contract_type_name: 'คน+รถ',
  };

  it('reminder — รายละเอียดอยู่ในข้อความที่ AI พูด', () => {
    const p = buildReminderPayload(JOB, RESULT, CARD)!;
    const msg = p.steps[0].message;
    expect(msg).toContain('สนง.จังหวัดตาก');
    expect(msg).toContain('08:00 - 17:00');
    expect(msg).toContain('ต้องใช้รถของตัวเอง');
    expect(msg).toContain('2569');
    // ท้ายประโยคเดิมต้องยังอยู่ — ไม่งั้นผู้สมัครไม่รู้ว่าต้องทำอะไรต่อ
    expect(msg).toContain('ทีมสรรหาจะติดต่อ');
  });

  it('reminder — ใบขอที่ไม่มีรายละเอียด ข้อความต้องไม่มีเศษช่องว่างค้าง', () => {
    const p = buildReminderPayload({ unit_name: 'ลูกค้า ก' }, RESULT, CARD)!;
    expect(p.steps[0].message).not.toMatch(/\s{2,}/);
  });

  it('interview — รายละเอียดกลายเป็นคำถามที่บอกข้อมูลไปในตัว', () => {
    const p = buildInterviewPayload(JOB, RESULT, IR)!;
    expect(p.questions.some((q) => q.includes('สนง.จังหวัดตาก'))).toBe(true);
    expect(p.questions.some((q) => q.includes('08:00 - 17:00'))).toBe(true);
    expect(p.questions.some((q) => q.includes('มีรถพร้อมใช้'))).toBe(true);
  });

  it('interview — จำนวนคำถามต้องอยู่ในช่วงที่ schema รับ (1–15)', () => {
    for (const job of [JOB, {}, { contract_type_name: 'คนอย่างเดียว' }]) {
      const p = buildInterviewPayload(job, RESULT, IR)!;
      expect(p.questions.length).toBeGreaterThanOrEqual(1);
      expect(p.questions.length).toBeLessThanOrEqual(15);
    }
  });

  it('interview — ไม่มีข้อมูลเวลา/รถ ก็ไม่ถามคำถามลอย ๆ', () => {
    const p = buildInterviewPayload({ unit_name: 'ลูกค้า ก' }, RESULT, IR)!;
    // ⚠️ เทียบหัวข้อ ไม่ใช่ substring — "เวลาทำงานไม่สะดวก" เป็นหนึ่งในช้อยส์เหตุผล
    // ที่บทใหม่อ่านให้ฟังตอนปฏิเสธ (ML ขั้น 1) assert หลวมจะล้มทั้งที่ถูก
    expect(p.questions.some((q) => q.startsWith('เวลาทำงาน '))).toBe(false);
    expect(p.questions.some((q) => q.includes('มีรถ'))).toBe(false);
  });

  it('⚠️ ห้ามหลุดข้อมูลติดต่อภายในเข้าไปในบท', () => {
    // ชื่อ/เบอร์ผู้ประสานงานฝั่งลูกค้าเป็นข้อมูลภายใน ไม่ใช่ของที่ AI ควรบอกผู้สมัคร
    //
    // ⚠️ fixture ต้อง**ยิงครบทุกสาขา**ของ buildJobBrief (สถานที่ · เวลา · รถ · อายุ)
    // รอบแรกเขียนโดยไม่มี age_range แล้ว mutation test หลุด: จงใจแทรกชื่อผู้ติดต่อ
    // ลงในสาขา "รับอายุ" แต่สาขานั้นไม่เคยถูกเรียกเลย เทสต์เลยผ่านหน้าตาเฉย
    const withContact = {
      ...JOB,
      age_range_min: 25,
      age_range_max: 50,
      contact_name: 'คุณสมศรี',
      contact_phone: '021234567',
      resigned_employee_name: 'คนเก่า ลาออกแล้ว',
      resigned_reason: 'ลาออกเอง',
    };
    const brief = buildJobBrief(withContact);
    // ยืนยันว่าทุกสาขาทำงานจริง ไม่งั้นเทสต์นี้กลับไปอ่อนเหมือนเดิมโดยไม่มีใครรู้
    expect(brief.detail).toContain('สถานที่ทำงาน');
    expect(brief.detail).toContain('เวลาทำงาน');
    expect(brief.detail).toContain('รถ');
    expect(brief.detail).toContain('รับอายุ');

    const msg = buildReminderPayload(withContact, RESULT, CARD)!.steps[0].message;
    const qs = buildInterviewPayload(withContact, RESULT, IR)!.questions.join(' ');
    for (const text of [brief.detail, msg, qs]) {
      for (const secret of ['คุณสมศรี', '021234567', 'คนเก่า ลาออกแล้ว', 'ลาออกเอง']) {
        expect(text).not.toContain(secret);
      }
    }
  });
});

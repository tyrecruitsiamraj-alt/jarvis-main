// @vitest-environment node
/**
 * 🔴 Script งานสรรหาที่ส่งให้ Lumos (เจ้าของ 6 ต.ค. 2569 → Choice "แก้บทเสนองาน" + "ใบที่ข้อมูลไม่ครบ ไม่ให้ตัดบรรทัดทิ้ง")
 * วัดจริงก่อนแก้ (7 วัน 114 สาย): บทเสนองาน 91 สายพูด "งานนี้ทำที่ หน่วยงานของเรา" · ตำแหน่งเป็นหัวข้อประกาศทั้งก้อน · ไม่บอกรายได้
 * บทสมัครผ่านลิงก์ใบที่ข้อมูลไม่ครบเหลือ 3 ข้อ
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApplicationInterviewPayload, FACTS_UNREAD_REASON, NO_INCOME_REASON } from '../../api/_lib/lumosDispatch';
import { buildAppliedQuestions, buildOfferQuestions, KNOWN_PLACEHOLDERS, speakableWorkTime } from '../../api/_lib/lumosCallScript';
import { EDITABLE_SCRIPT_KEYS } from '../../api/_lib/callScriptStore';
import { CALL_SCRIPT_TEMPLATES } from '../../api/_lib/lumosCallScript.templates';

const code = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const APP = {
  id: 'a1',
  full_name: 'นายทดสอบ ระบบ',
  phone: '0812345678',
  job_id: 'siamraj-sql:OPL6909071',
  job_title: 'ขับรถผู้บริหารญี่ปุ่น รับนายแถวสุขุมวิท ส่งแถวถ.ปู่เจ้าฯ สำโรง (หน่วยงาน อีซูซุมอเตอร์ฯ)',
  unit_name: null,
};
const FACTS = {
  loaded: true,
  unitName: 'อีซูซุมอเตอร์',
  positionTitle: 'พนักงานขับรถ ผู้บริหาร',
  workArea: 'ตำบลสำโรง อำเภอพระประแดง จังหวัดสมุทรปราการ',
  ageRange: '30 ถึง 50 ปี',
  monthlyIncome: 17000,
  benefitLine: 'มีเบี้ยขยัน ค่าครองชีพให้ด้วย',
};

describe('บทผู้สมัครที่เจ้าหน้าที่คีย์/นำเข้า (applied)', () => {
  const p = buildApplicationInterviewPayload(APP, new Date('2026-10-06T03:00:00Z'), null, FACTS)!;
  const all = p.questions.join(' | ');
  it('ไม่มี "หน่วยงานของเรา" · ตำแหน่งสั้นจากใบขอ ไม่ใช่หัวข้อประกาศทั้งก้อน', () => {
    expect(all).not.toContain('หน่วยงานของเรา');
    expect(all).not.toContain('รับนายแถวสุขุมวิท');
    expect(p.position).toBe('พนักงานขับรถ ผู้บริหาร');
    expect(p.questions[0]).toContain('เคยฝากใบสมัครไว้กับเรา');
    expect(p.questions[0]).toContain('ที่ อีซูซุมอเตอร์');
  });
  /** 🔴 17 ต.ค. 2569 ลำดับใหม่ของเจ้าของ (ชุดเดียวกับบทสมัครผ่านลิงก์ ต่างแค่ประโยคแรก) */
  it('🔴 ลำดับเจ้าของ 17 ต.ค.: สนใจงาน → เพศ → อายุ → วันเริ่มงาน → ที่อยู่ → บอกสถานที่ → ไม่ติดค่อยบอกรายได้ → ไม่สนใจก็จบ', () => {
    expect(p.questions).toEqual([
      'โทรมาเรื่องที่คุณทดสอบ ระบบ เคยฝากใบสมัครไว้กับเรานะคะ ตอนนี้มีงานตำแหน่งพนักงานขับรถ ผู้บริหาร ที่ อีซูซุมอเตอร์ สนใจงานนี้ไหมคะ',
      'ขอทราบเพศค่ะ เป็นผู้ชายหรือผู้หญิงคะ',
      'งานนี้รับอายุ 30 ถึง 50 ปี ตอนนี้อายุเท่าไหร่คะ',
      'ถ้าได้งานนี้ สะดวกเริ่มงานได้วันไหนคะ',
      'ตอนนี้พักอยู่ที่ไหนคะ อำเภออะไร จังหวัดอะไรคะ',
      'งานนี้ปฏิบัติงานที่ ตำบลสำโรง อำเภอพระประแดง จังหวัดสมุทรปราการ ค่ะ',
      'สถานที่นี้ สะดวกเดินทางไปทำงานไหมคะ',
      'ถ้าไม่ติดอะไร ขอแจ้งรายละเอียดรายได้นะคะ',
      'งานนี้รายได้ประมาณเดือนละ 17,000 บาทค่ะ',
      'มีเบี้ยขยัน ค่าครองชีพให้ด้วยค่ะ',
      'ถ้ายังไม่สนใจงานนี้ ไม่เป็นไรค่ะ ขอบคุณที่สละเวลาค่ะ',
    ]);
    // ใบนี้ไม่มีเวลาทำงาน = ไม่พูดถึงเวลา · คำถามที่เจ้าของไม่ได้สั่งยังห้ามมี
    for (const extra of ['เวลาทำงาน', 'รถของตัวเอง', 'ขอทราบเหตุผล', 'นัดวันสัมภาษณ์', 'ยังหางานอยู่ไหม', 'สวัสดี', 'ครับ']) {
      expect(all).not.toContain(extra);
    }
  });
  /**
   * 🔴 เวลาทำงาน (เจ้าของ 6 ต.ค. 2569 ค่ำ · Choice "เพิ่มแค่เวลาทำงาน" — คุณสมบัติไม่พูด)
   * พูดต่อจากสวัสดิการ เป็นประโยคบอก ไม่ใช่คำถาม · ใบไม่มีเวลาทำงาน = บรรทัดหาย (เคสข้างบน)
   */
  /** 🔴 17 ต.ค. 2569 เจ้าของ "แจ้ง วันเวลา ทำงานเลยไม่ต้องรอเขาถาม" ⇒ บอกต่อจากสถานที่ แล้วถามว่าสะดวกไหม (ก่อนบอกรายได้) */
  it('มีเวลาทำงาน = บอกต่อจากสถานที่แล้วถามว่าสะดวกไหม ทั้งบทคีย์เองและบทสมัครผ่านลิงก์ · ไม่พูดคุณสมบัติ', () => {
    const withTime = { ...FACTS, workSchedule: 'วันจันทร์ถึงวันเสาร์ 08:00 ถึง 17:00 น.' };
    for (const q of [
      buildApplicationInterviewPayload(APP, new Date('2026-10-06T03:00:00Z'), null, withTime)!.questions,
      buildApplicationInterviewPayload({ ...APP, unit_name: null }, new Date('2026-10-06T03:00:00Z'), withTime, withTime)!
        .questions,
    ]) {
      const i = q.findIndex((x) => x.startsWith('งานนี้ปฏิบัติงานที่'));
      expect(q[i + 1]).toBe('เวลาทำงาน วันจันทร์ถึงวันเสาร์ 08:00 ถึง 17:00 น. ค่ะ สถานที่กับเวลาทำงานแบบนี้ สะดวกไหมคะ');
      expect(q[i + 2]).toBe('ถ้าไม่ติดอะไร ขอแจ้งรายละเอียดรายได้นะคะ');
      expect(q.join(' ')).not.toContain('สถานที่นี้ สะดวกเดินทาง');
      expect(q.join(' ')).not.toContain('คุณสมบัติ');
    }
    expect(code('api/_lib/applyScriptFacts.ts')).toContain('speakableWorkTime(job.work_schedule');
  });
  it('ไม่มีช่วงอายุ = ถามอายุตรง ๆ (ไม่ตัดบรรทัด) · ไม่มีพื้นที่ = ใช้ชื่อหน่วยงาน', () => {
    const q = buildAppliedQuestions({ candidateName: 'ทดสอบ', position: 'แม่บ้าน', unit: 'สยามพารากอน', monthlyIncome: 12000 });
    expect(q).toContain('ตอนนี้อายุเท่าไหร่คะ');
    expect(q.join(' ')).toContain('งานนี้ปฏิบัติงานที่ สยามพารากอน');
  });
  it('ไม่รู้ชื่อหน่วยงานด้วย = ไม่พูด "ปฏิบัติงานที่ หน่วยงานของเรา"', () => {
    const q = buildAppliedQuestions({ candidateName: 'ทดสอบ', position: 'แม่บ้าน', unit: '' });
    expect(q.join(' ')).not.toContain('ปฏิบัติงานที่ หน่วยงานของเรา');
  });
  it('บทในไฟล์: ตัวแปรลงทะเบียนครบ · ไม่เกิน 14 ข้อ · ไม่พิมพ์เลขรายได้เอง · แก้ได้จากหน้าตั้งค่า', () => {
    expect(KNOWN_PLACEHOLDERS).toContain('ไม่มีช่วงอายุ');
    // 28 ต.ค. 2569 เพิ่มบรรทัดค่าแรงรายวัน — ไม่ขึ้นพร้อมบรรทัดรายเดือน/ฐาน ⇒ วัดจากบทที่ประกอบจริง (เพดาน 14 = ตัดท้าย)
    expect(CALL_SCRIPT_TEMPLATES.ผู้สมัครคีย์เอง.length).toBeLessThanOrEqual(15);
    const full = { candidateName: 'ก', position: 'ขับรถ', unit: 'x', workArea: 'ต.ก อ.ข จ.ค', ageRange: '20 ถึง 55 ปี', workSchedule: 'จันทร์ ถึง ศุกร์ 08:00 ถึง 17:00 น.', benefitLine: 'มีโอที' };
    for (const money of [{ monthlyIncome: 18000, baseSalary: 12000 }, { dailyWage: 500 }]) {
      const q = buildAppliedQuestions({ ...full, ...money } as never);
      expect(q.length).toBeLessThanOrEqual(14);
      expect(q[q.length - 1]).toContain('ถ้ายังไม่สนใจงานนี้');
    }
    for (const line of CALL_SCRIPT_TEMPLATES.ผู้สมัครคีย์เอง) expect(line).not.toMatch(/\d[\d,]*\s*บาท/);
    expect(EDITABLE_SCRIPT_KEYS).toContain('applied');
  });
  it('🔴 บทเสนองาน (เส้นชวนกลับ เลนคัดสรร) ไม่ถูกแตะ — ยังถาม "ยังหางานอยู่ไหม" + เหตุผล + นัดโทรกลับเหมือนเดิม', () => {
    const q = buildOfferQuestions({ candidateName: 'ทดสอบ', position: 'แม่บ้าน', unit: 'สยามพารากอน' }, { askStillLooking: true });
    const all = q.join(' ');
    expect(all).toContain('ยังหางานอยู่ไหม');
    expect(all).toContain('ขอทราบเหตุผล');
    expect(q[q.length - 1]).toContain('นัดวันสัมภาษณ์');
  });
});

describe('🔴 ไม่มีรายได้ = ไม่ส่ง AI (ทุกใบสมัคร)', () => {
  const src = code('api/_lib/lumosDispatch.ts');
  const fn = src.slice(src.indexOf('export async function enqueueLumosInterviewForApplications'));
  it('คอขวดเดียวของใบสมัคร ตัดก่อนประกอบ payload · อ่านไม่ทัน กับ ไม่มีรายได้ คนละเหตุ', () => {
    const gate = fn.indexOf('applyFacts?.loaded');
    const income = fn.indexOf('NO_INCOME_REASON');
    const build = fn.indexOf('buildApplicationInterviewPayload(');
    expect(gate).toBeGreaterThan(0);
    expect(income).toBeGreaterThan(gate);
    expect(build).toBeGreaterThan(income);
    expect(fn).toContain('FACTS_UNREAD_REASON');
    expect(NO_INCOME_REASON).toContain('ตั้งรายได้');
    expect(FACTS_UNREAD_REASON).toContain('ลองกดส่ง AI ใหม่');
  });
  it('ตัวโหลดใบขอบอกว่าอ่านได้จริงไหม (loaded) · พื้นที่ถอยไปจังหวัด', () => {
    const facts = code('api/_lib/applyScriptFacts.ts');
    expect(facts).toContain('loaded: true');
    expect(facts).toContain('boardProvinceOf');
    expect(facts).toContain('positionTitle');
  });
});

describe('พื้นที่พูดได้ — ข้อมูลที่อยู่สะกดผิด/ปนกัน (เจอในใบจริง 6 ต.ค. 2569)', () => {
  it('ช่องตำบลกลืนชื่อเขต ("แขวงจตุจักร แขตจตุจักร") = ไม่พูดซ้ำ', async () => {
    const { speakableWorkArea } = await import('../../api/_lib/lumosCallScript');
    expect(speakableWorkArea({ province: 'กรุงเทพมหานคร', district: 'เขตจตุจักร', subdistrict: 'แขวงจตุจักร แขตจตุจักร' })).toBe(
      'แขวงจตุจักร เขตจตุจักร กรุงเทพมหานคร',
    );
    expect(speakableWorkArea({ province: 'กรุงเทพมหานคร', district: 'แขตจตุจักร', subdistrict: '' })).toBe('เขตจตุจักร กรุงเทพมหานคร');
    expect(speakableWorkArea({ province: 'ปทุมธานี' })).toBe('จังหวัดปทุมธานี');
  });
});

/** เวลาทำงานจากช่องจริงของใบขอ (ข้อความดิบที่เจอในระบบ 6 ต.ค. 2569) */
describe('speakableWorkTime', () => {
  it.each([
    ['วันจันทร์ - วันศุกร์ • 08.00 - 17.00 น. (หากมีการเข้าหรือออกก่อนเวลา ลูกค้าจะเซ็นต์เอกสารกำกับให้ทุกครั้ง) (9 ชั่วโมงรวมพัก)', 'วันจันทร์ถึงวันศุกร์ 08:00 ถึง 17:00 น.'],
    ['จันทร์-ศุกร์ • 8:00-17:00 น.', 'วันจันทร์ถึงวันศุกร์ 08:00 ถึง 17:00 น.'],
    ['วันจันทร์ - วันศุกร์ หรือ 5 วัน/สัปดาห์ ตามธนาคารฯกำหนด • เวลา 8.30 - 17.30 หรือ 9 ชม./วัน รวมพัก หรือตามธนาคารฯกำหนด', 'วันจันทร์ถึงวันศุกร์ 08:30 ถึง 17:30 น.'],
    // 🔴 17 ต.ค. 2569 "แจ้ง วันเวลา ทำงานเลยไม่ต้องรอเขาถาม" — ใบที่เขียนเวลารายกะ อ่านทุกกะ · กรอบรวมช่วงเดียวยังไม่อ่าน
    ['ทำงาน 6 วัน/สัปดาห์ตามตารางกะ • แบ่งออกเป็น 3 กะ เวลา 09.30-18.30 , 11.00-19.00 , 13.30-22.30 น.', 'สัปดาห์ละ 6 วัน ทำงานเป็นกะ 09:30 ถึง 18:30 น. หรือ 11:00 ถึง 19:00 น. หรือ 13:30 ถึง 22:30 น.'],
    ['ปฏิบัติงาน 6 วัน/สัปดาห์ ตามตารางกะ • กะละ 9 ชม./วัน ( กะที่ 1 11.00 - 20.00 น. 4 คน,กะที่ 2 13.00 - 22.00 น. 2 คน, กะที่ 3 14.00-23.00 น. 2 คน)', 'สัปดาห์ละ 6 วัน ทำงานเป็นกะ 11:00 ถึง 20:00 น. หรือ 13:00 ถึง 22:00 น. หรือ 14:00 ถึง 23:00 น.'],
    ['วันจันทร์ - วันศุกร์ • 9 ชม. ตามตารางกะ ในช่วง 08.30 - 20.00', 'วันจันทร์ถึงวันศุกร์ ทำงานเป็นกะ'],
    ['จันทร์ - อาทิตย์ (พนักงาน 1 คน ทำ 6 วัน หยุด 1 วัน) • 07.00 - 16.00 น.', 'สัปดาห์ละ 6 วัน 07:00 ถึง 16:00 น.'],
    ['วันจันทร - วันเสาร์ • ตามที่หน่วยงานที่กำหนด', 'วันจันทร์ถึงวันเสาร์'],
    ['ปฏิบัติงาน 5 วัน/สัปดาห์ วันจันทร์ - ศุกร์ • 9.00 น. - 18.00 น. ( รวมพัก 1 ชม. )', 'วันจันทร์ถึงวันศุกร์ 09:00 ถึง 18:00 น.'],
    ['วันจันทร์ - วันศุกร์ , วันเสาร์ (ครึ่งวันเช้า) • วันจันทร์ - วันศุกร์ 08.00 - 17.00 น. , วันเสาร์ 08.00 - 12.00 น.', 'วันจันทร์ถึงวันศุกร์'],
    ['ตามตารางลูกค้ากำหนด • ตามตารางลูกค้ากำหนด', ''],
    ['', ''],
  ])('%s', (raw, want) => {
    expect(speakableWorkTime(raw)).toBe(want);
  });
});

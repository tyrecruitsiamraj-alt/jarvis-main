// @vitest-environment node
/**
 * 🔴 Script งานสรรหาที่ส่งให้ Lumos (เจ้าของ 6 ต.ค. 2569 → Choice "แก้บทเสนองาน" + "ใบที่ข้อมูลไม่ครบ ไม่ให้ตัดบรรทัดทิ้ง")
 * วัดจริงก่อนแก้ (7 วัน 114 สาย): บทเสนองาน 91 สายพูด "งานนี้ทำที่ หน่วยงานของเรา" · ตำแหน่งเป็นหัวข้อประกาศทั้งก้อน · ไม่บอกรายได้
 * บทสมัครผ่านลิงก์ใบที่ข้อมูลไม่ครบเหลือ 3 ข้อ
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApplicationInterviewPayload, FACTS_UNREAD_REASON, NO_INCOME_REASON } from '../../api/_lib/lumosDispatch';
import { buildAppliedQuestions, buildOfferQuestions, KNOWN_PLACEHOLDERS } from '../../api/_lib/lumosCallScript';
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
  it('🔴 ลำดับ Journey ของเจ้าของ (5 ต.ค.): ชื่อ → สนใจงาน → พื้นที่ → อายุ → วันเริ่มงาน → รายได้ → ไม่สนใจก็จบ · ไม่มีคำถามที่ไม่ได้สั่ง', () => {
    expect(p.questions).toEqual([
      'สวัสดีครับ คุณทดสอบ ระบบ ผมติดต่อจากสยามราชธานีนะครับ คุณเคยฝากใบสมัครไว้กับเรา ตอนนี้มีงานตำแหน่งพนักงานขับรถ ผู้บริหาร ที่ อีซูซุมอเตอร์ สนใจงานนี้ไหมครับ',
      'งานนี้อยู่ที่ ตำบลสำโรง อำเภอพระประแดง จังหวัดสมุทรปราการ สะดวกเดินทางไปทำงานไหมครับ',
      'งานนี้รับอายุ 30 ถึง 50 ปี ตอนนี้คุณอายุเท่าไหร่ครับ',
      'ถ้าได้งานนี้ สะดวกเริ่มงานได้วันไหนครับ',
      'งานนี้รายได้ประมาณเดือนละ 17,000 บาทครับ',
      'มีเบี้ยขยัน ค่าครองชีพให้ด้วยครับ',
      'ถ้ายังไม่สนใจงานนี้ ไม่เป็นไรครับ ขอบคุณที่สละเวลาครับ',
    ]);
    // เมื่อวานไม่ได้สั่ง (เจ้าของ 6 ต.ค. "เมื่อวานฉันไม่ได้สั่งไว้แบบนี้หนิ")
    for (const extra of ['เวลาทำงาน', 'รถของตัวเอง', 'ขอทราบเหตุผล', 'นัดวันสัมภาษณ์', 'ยังหางานอยู่ไหม']) {
      expect(all).not.toContain(extra);
    }
  });
  it('ไม่มีช่วงอายุ = ถามอายุตรง ๆ (ไม่ตัดบรรทัด) · ไม่มีพื้นที่ = ใช้ชื่อหน่วยงาน', () => {
    const q = buildAppliedQuestions({ candidateName: 'ทดสอบ', position: 'แม่บ้าน', unit: 'สยามพารากอน', monthlyIncome: 12000 });
    expect(q).toContain('ตอนนี้คุณอายุเท่าไหร่ครับ');
    expect(q.join(' ')).toContain('งานนี้อยู่ที่ สยามพารากอน');
  });
  it('ไม่รู้ชื่อหน่วยงานด้วย = ไม่พูด "อยู่ที่ หน่วยงานของเรา"', () => {
    const q = buildAppliedQuestions({ candidateName: 'ทดสอบ', position: 'แม่บ้าน', unit: '' });
    expect(q.join(' ')).not.toContain('อยู่ที่ หน่วยงานของเรา');
  });
  it('บทในไฟล์: ตัวแปรลงทะเบียนครบ · ไม่เกิน 14 ข้อ · ไม่พิมพ์เลขรายได้เอง · แก้ได้จากหน้าตั้งค่า', () => {
    expect(KNOWN_PLACEHOLDERS).toContain('ไม่มีช่วงอายุ');
    expect(CALL_SCRIPT_TEMPLATES.ผู้สมัครคีย์เอง.length).toBeLessThanOrEqual(14);
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

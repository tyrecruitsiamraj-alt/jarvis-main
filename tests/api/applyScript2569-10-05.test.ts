// @vitest-environment node
/**
 * บทผู้สมัครผ่านลิงก์ (เจ้าของ 5 ต.ค. 2569 · Journey งานสรรหา ข้อ 3 + Choice "ทำบทใหม่เฉพาะคนสมัครผ่านลิงก์")
 * ลำดับ: เรียกชื่อ → งานที่สมัคร → พื้นที่ → อายุ → วันเริ่มงาน → รายได้ → ไม่สนใจก็จบ
 */
import { describe, expect, it } from 'vitest';
import {
  EDITABLE_SCRIPT_DEFAULTS,
  KNOWN_PLACEHOLDERS,
  buildApplyQuestions,
  speakableAgeRange,
  speakableWorkArea,
} from '../../api/_lib/lumosCallScript';
import { EDITABLE_SCRIPT_KEYS } from '../../api/_lib/callScriptStore';
import { buildApplicationInterviewPayload } from '../../api/_lib/lumosDispatch';

const APP = {
  id: '11111111-1111-1111-1111-111111111111',
  full_name: 'นายสมชาย ใจดี',
  phone: '0812345678',
  job_id: 'siamraj-sql:LBM6909001',
  job_title: 'พนักงานขับรถ นายไทย',
  unit_name: 'KYE',
};

describe('ตัวช่วยพูด', () => {
  it('ช่วงอายุ', () => {
    expect(speakableAgeRange(20, 55)).toBe('20 ถึง 55 ปี');
    expect(speakableAgeRange(null, 50)).toBe('ไม่เกิน 50 ปี');
    expect(speakableAgeRange(25, null)).toBe('ตั้งแต่ 25 ปีขึ้นไป');
    expect(speakableAgeRange(null, null)).toBe('');
  });
  it('พื้นที่ใช้คำเต็ม (ไม่ใช่ ต./อ.) · กรุงเทพฯ ใช้ แขวง/เขต', () => {
    expect(speakableWorkArea({ province: 'สมุทรปราการ', district: 'อ.บางพลี', subdistrict: 'ตำบลบางพลีใหญ่' })).toBe(
      'ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ',
    );
    expect(speakableWorkArea({ province: 'กรุงเทพมหานคร', district: 'เขตสาทร', subdistrict: 'ยานนาวา' })).toBe(
      'แขวงยานนาวา เขตสาทร กรุงเทพมหานคร',
    );
    expect(speakableWorkArea({})).toBe('');
  });
});

describe('บทผู้สมัครผ่านลิงก์', () => {
  it('🔴 ลำดับตามเจ้าของ · ตัดคำนำหน้าชื่อ · ไม่มีคำว่า "ฝากใบสมัคร" ของบทเสนองาน', () => {
    const q = buildApplyQuestions({
      candidateName: APP.full_name,
      position: APP.job_title,
      unit: APP.unit_name,
      workArea: 'ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ',
      ageRange: '20 ถึง 55 ปี',
      monthlyIncome: 15500,
      benefitLine: 'มีเบี้ยขยัน ค่าโทรศัพท์ให้ด้วย',
    });
    expect(q[0]).toContain('คุณสมชาย');
    expect(q[0]).not.toContain('นายสมชาย');
    expect(q[0]).toContain('สมัครงานตำแหน่งพนักงานขับรถ นายไทย ที่ KYE');
    expect(q[1]).toContain('ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ');
    expect(q[2]).toContain('รับอายุ 20 ถึง 55 ปี');
    expect(q[3]).toContain('เริ่มงานได้วันไหน');
    expect(q[4]).toContain('เดือนละ 15,500 บาท');
    expect(q[5]).toContain('เบี้ยขยัน');
    expect(q[6]).toContain('ไม่สนใจ');
    expect(q.join(' ')).not.toContain('ฝากใบสมัคร');
  });

  /**
   * 🔴 6 ต.ค. 2569 (เจ้าของ Choice "ใบที่ข้อมูลไม่ครบ ไม่ให้ตัดบรรทัดทิ้ง") — เดิมตัดบรรทัดพื้นที่/อายุทิ้ง เหลือ 3 ข้อ
   * พื้นที่ไม่มี = ใช้ชื่อหน่วยงาน · ช่วงอายุไม่มี = ถามอายุตรง ๆ · รายได้ไม่มี = ยังไม่พูดเลข (ตัวส่งไม่ส่งใบแบบนี้ให้ AI อยู่แล้ว)
   */
  it('ข้อมูลไม่ครบ = ใช้ค่าแทน ไม่ตัดบรรทัด · ไม่พูดเลขที่ไม่รู้', () => {
    const q = buildApplyQuestions({ candidateName: APP.full_name, position: APP.job_title, unit: APP.unit_name });
    const all = q.join(' ');
    expect(all).not.toContain('บาท');
    expect(all).not.toContain('รับอายุ');
    expect(all).toContain(`อยู่ที่ ${APP.unit_name}`);
    expect(q).toContain('ตอนนี้คุณอายุเท่าไหร่ครับ');
    expect(q.length).toBe(5);
  });

  it('แก้ได้จากหน้าตั้งค่า (ลิสต์บทครบ) · ตัวแปรใหม่ลงทะเบียนกันพิมพ์ผิด', () => {
    expect(EDITABLE_SCRIPT_KEYS).toContain('apply');
    expect(EDITABLE_SCRIPT_DEFAULTS.apply.length).toBeGreaterThan(0);
    expect(KNOWN_PLACEHOLDERS).toEqual(expect.arrayContaining(['พื้นที่ทำงาน', 'ช่วงอายุ']));
  });
});

describe('🔴 ใบไหนได้บทไหน', () => {
  it('กรอกเองผ่านลิงก์ (ส่ง applyFacts) = บทผู้สมัครผ่านลิงก์ · ไม่ส่ง = บทเสนองานเดิม', () => {
    const viaLink = buildApplicationInterviewPayload(APP, new Date('2026-10-05T03:00:00Z'), { ageRange: '20 ถึง 55 ปี' });
    const keyed = buildApplicationInterviewPayload(APP, new Date('2026-10-05T03:00:00Z'), null);
    expect(viaLink?.questions.join(' ')).toContain('รับอายุ 20 ถึง 55 ปี');
    expect(viaLink?.questions.join(' ')).not.toContain('ฝากใบสมัคร');
    expect(keyed?.questions.join(' ')).toContain('ฝากใบสมัคร');
  });

  it('คอขวดเลือกบทจาก created_by_name === null และส่งมาครบทุกเส้น', async () => {
    const { readFileSync } = await import('node:fs');
    const code = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
    const d = code('api/_lib/lumosDispatch.ts');
    expect(d).toContain("app.created_by_name === null ? (applyFacts ?? {}) : null");
    expect(code('api/_handlers/public/apply.ts')).toContain('created_by_name: null,');
    for (const f of ['api/_handlers/application-dispatch.ts', 'api/_lib/callChoiceWorker.ts', 'api/_handlers/application-call-choice.ts']) {
      expect(code(f), f).toContain('a.created_by_name');
    }
  });
});

describe('🔴 บทที่ส่งจริง 5 ต.ค. 2569 เจอ "ที่ หน่วยงานของเรา" + อิโมจิในตำแหน่ง', () => {
  it('ใบสมัครไม่มีชื่อหน่วยงาน = ใช้ชื่อจุดทำงานจากใบขอ · ตำแหน่งตัดอิโมจิ (ทั้งสองบท)', async () => {
    const { speechText } = await import('../../api/_lib/lumosDispatch');
    expect(speechText('พนักงานรับรถลานจอด 📍รพ.สมิติเวช ซ.สุขุมวิท 49')).toBe('พนักงานรับรถลานจอด รพ.สมิติเวช ซ.สุขุมวิท 49');
    const noUnit = { ...APP, unit_name: null, job_title: 'พนักงานรับรถลานจอด 📍รพ.สมิติเวช' };
    for (const apply of [{}, null]) {
      const p = buildApplicationInterviewPayload(noUnit, new Date(), apply, { unitName: 'สมิติเวช สุขุมวิท' });
      const all = p?.questions.join(' ') ?? '';
      expect(all).toContain('สมิติเวช สุขุมวิท');
      expect(all).not.toContain('หน่วยงานของเรา');
      expect(all).not.toContain('📍');
    }
  });
});

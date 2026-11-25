// @vitest-environment node
/**
 * จับคู่งาน 25 พ.ย. 2569 — เจ้าของ: "คนที่สมัครมาก็มีชื่อ นามสกุล เพศ ที่อยู่หมดหนิ นายอ่านค่าจากไหนถึงไม่เจอ"
 * · "ใบขอเราจะไม่เดาไรนะ เราจะเอาตาม erp เท่านั้น ผิดบอกเลยว่าผิดที่ไหน ขาดอะไร … เลยทำให้ไม่ match"
 *
 * วัดจริง (อ่านอย่างเดียว): ผลจับคู่ 862 รายการขึ้น "ไม่มีที่อยู่" ทั้งที่มีที่อยู่พิมพ์ครบทุกราย
 * (802 ช่องรหัสจังหวัดว่าง · 60 เขียน "อยุธยา") · ใบขอ 69 ใบอ่านจังหวัดงานไม่ออก (ERP เขียนชื่อบริษัท)
 * แต่ ms_site.province_code มีจังหวัด 280/308 ใบเปิด · บทโทรพูด "เริ่มงาน 10 ส.ค. 2569" ทั้งที่เลยมาแล้ว
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  areaRankOf,
  candidateAreaOf,
  canonProvince,
  jobAreaForMatch,
  matchBlockedText,
  matchBlockersOf,
} from '../../src/lib/matchProximity';
import { SPOKEN_START_DATE } from '../../api/_lib/lumosJobBrief';
import { CALL_SCRIPT_TEMPLATES } from '../../api/_lib/lumosCallScript.templates';

/** หน้าตาใบจริง: OPL6911035 — ERP สถานที่เป็นชื่อบริษัท แต่ไซต์ 69LBDL0094 มีจังหวัด */
const MG = {
  id: 'siamraj-sql:OPL6911035',
  request_no: 'OPL6911035',
  // "สถานที่ทำงาน (ที่อยู่เต็ม)" ของ ERP — ตัวอย่างใบที่เขียนจังหวัดครบ
  location_address: '209 อาคารเคเคพี ทาวเวอร์ ถ.สุขุมวิท 21 (อโศก) แขวงคลองเตยเหนือ เขตวัฒนา กทม',
  gender_requirement: 'ชาย',
  age_range_min: 25,
  age_range_max: 50,
  total_income: 15000,
};

describe('ที่อยู่คน — ช่องจังหวัดว่าง อ่านจากที่อยู่ที่พิมพ์ไว้', () => {
  it('ช่องรหัสจังหวัดว่าง แต่ที่อยู่พิมพ์ "…เขตราชเทวี กรุงเทพมหานคร 10400" = กรุงเทพ', () => {
    const a = candidateAreaOf({ province_name: null, amphur_name: null, full_address: '552/30 ม.5 แขวงมักกะสัน เขตราชเทวี กรุงเทพมหานคร    10400' });
    expect(a.province).toBe('กรุงเทพมหานคร');
  });
  it('"อ.ขลุง จ.จันทบุรี" = จันทบุรี', () => {
    expect(candidateAreaOf({ full_address: '26/11 ม.10 ถ.ขลุง-พริ้ว ต.เกวียนหัก อ.ขลุง จ.จันทบุรี    22110' }).province).toBe('จันทบุรี');
  });
  it('"อยุธยา" (ชื่อย่อจาก iRecruit) = พระนครศรีอยุธยา', () => {
    expect(canonProvince('อยุธยา')).toBe('พระนครศรีอยุธยา');
    expect(candidateAreaOf({ province_name: 'อยุธยา', amphur_name: 'อ.บางปะอิน' }).province).toBe('พระนครศรีอยุธยา');
  });
  it('ไม่มีทั้งช่องและข้อความ = ไม่รู้ (ไม่เดา)', () => {
    expect(candidateAreaOf({ province_name: '', full_address: '' }).province).toBeNull();
  });
  it('คนกรุงเทพที่ช่องจังหวัดว่าง ได้ "จังหวัดเดียวกับงาน" ไม่ใช่ "ไม่มีที่อยู่"', () => {
    const job = jobAreaForMatch(MG);
    expect(areaRankOf(job, { province_name: null, full_address: '138 ซอยเทอดไทย11 แขวงบางยี่เรือ เขตธนบุรี กรุงเทพมหานคร 10600' })).toBe(1);
    expect(areaRankOf(job, { province_name: null, full_address: '' })).toBe(3);
  });
});

describe('ที่ตั้งงาน = "สถานที่ทำงาน (ที่อยู่เต็ม)" ของ ERP เท่านั้น (เจ้าของ 25 พ.ย. 2569)', () => {
  it('อ่านจังหวัด/เขตจากที่อยู่เต็ม', () => {
    expect(jobAreaForMatch(MG)).toEqual({ province: 'กรุงเทพมหานคร', district: 'วัฒนา' });
  });
  it('ไม่มีจังหวัดในที่อยู่ = ไม่รู้ (ไม่เดาจากชื่อบริษัท ไม่ใช้ค่าที่ทีมแก้ ไม่ใช้จังหวัดของไซต์)', () => {
    expect(jobAreaForMatch({ location_address: 'บริษัท เอ็มจี เซลส์ (ประเทศไทย) จำกัด' }).province).toBeNull();
    expect(jobAreaForMatch({ location_address: 'ตามที่ได้รับมอบหมาย' }).province).toBeNull();
    expect(
      jobAreaForMatch({ location_address: 'TMA บางบ่อ', override_province: 'สมุทรปราการ', erp_site_province: 'สมุทรปราการ' } as never).province,
    ).toBeNull();
  });
});

describe('ใบขอ ERP ไม่ครบ = ไม่จับคู่ + บอกว่าขาดอะไร', () => {
  it('ครบ = ไม่ติดอะไร', () => {
    expect(matchBlockersOf(MG)).toEqual([]);
    expect(matchBlockedText([])).toBeNull();
  });
  it('สถานที่ทำงานไม่มีจังหวัด → ขาดจังหวัดในสถานที่ทำงาน', () => {
    expect(matchBlockersOf({ ...MG, location_address: 'ตามที่ได้รับมอบหมาย' })).toEqual(['place']);
    expect(matchBlockedText(['place'])).toBe('ไม่จับคู่ · ขาดในใบขอ ERP: จังหวัดในสถานที่ทำงาน');
  });
  it('เพศว่าง/ไม่ระบุ · อายุไม่มีทั้งสองขั้น · รายได้ 0 → ขาด', () => {
    expect(matchBlockersOf({ ...MG, gender_requirement: 'ไม่ระบุ', age_range_min: null, age_range_max: null, total_income: 0 })).toEqual([
      'gender',
      'age',
      'income',
    ]);
    expect(matchBlockedText(['gender', 'age', 'income'])).toBe('ไม่จับคู่ · ขาดในใบขอ ERP: เพศ · อายุ · รายได้');
  });
  it('เพศ "ไม่จำกัด" = ใบขอเลือกแล้ว ไม่ขาด · อายุมีขั้นเดียวก็พอ', () => {
    expect(matchBlockersOf({ ...MG, gender_requirement: 'ไม่จำกัด', age_range_min: null })).toEqual([]);
  });
  it('ทีมแก้ทับแล้วก็ยังตัดสินจากค่า ERP เดิม (erp_*)', () => {
    expect(matchBlockersOf({ ...MG, gender_requirement: 'ชาย', erp_gender_requirement: 'ไม่ระบุ' })).toEqual(['gender']);
    expect(matchBlockersOf({ ...MG, total_income: 15000, erp_total_income: 0 })).toEqual(['income']);
  });
  it('ตัวจับคู่ทั้งสองเส้นกันก่อนเรียก AI', () => {
    const board = readFileSync('api/_lib/boardCandidateMatcher.ts', 'utf8');
    expect(board.indexOf('matchBlockersOf(job)')).toBeGreaterThan(-1);
    expect(board.indexOf('matchBlockersOf(job)')).toBeLessThan(board.indexOf('analyzeCandidateSpecForJob(jobId, job'));
    const ir = readFileSync('api/_handlers/matching-irecruit-candidates.ts', 'utf8');
    expect(ir.indexOf('matchBlockersOf(')).toBeLessThan(ir.indexOf('matchIrecruitCandidatesForJob(jobId'));
  });
});

describe('ไม่พูดวันเริ่มงานของใบขอ — ถามว่าเริ่มงานได้วันไหนทุกบท (เจ้าของ 25 พ.ย. 2569)', () => {
  it('ทุกเส้นที่ส่ง Lumos ส่งวันเริ่มงานว่าง', () => {
    expect(SPOKEN_START_DATE).toBe('');
    const src = readFileSync('api/_lib/lumosDispatch.ts', 'utf8');
    expect(src).not.toContain('speakableDate(job.required_date)');
    expect(src.match(/startDate: (requiredDate|SPOKEN_START_DATE)/g)?.length).toBe(4);
  });
  it('บทในไฟล์ไม่มีบรรทัดบอกวันที่ของใบขอ · บทถามมีคำถาม "เริ่มงานได้วันไหน"', () => {
    const all = JSON.stringify(CALL_SCRIPT_TEMPLATES);
    expect(all).not.toContain('{วันเริ่มงาน}');
    for (const key of ['สัมภาษณ์เบื้องต้น', 'เสนองาน', 'ผู้สมัครคีย์เอง', 'เรซูเม่เว็บหางาน', 'สมัครผ่านลิงก์'] as const) {
      expect((CALL_SCRIPT_TEMPLATES[key] as readonly string[]).some((l) => l.includes('เริ่มงานได้วันไหน'))).toBe(true);
    }
  });
});

describe('ที่อยู่ผู้สมัคร ERP มีรหัส 2 ชุด (เจ้าของ "ที่อยู่คนฉันว่าบน erp มีนะ")', () => {
  it('ตัดสินชุดด้วยคู่ (จังหวัด, อำเภอ) · ชุดเก่าอ่านชื่อจาก hr_ms_province / hr_ms_amphur', async () => {
    const m = await import('../../api/_lib/recruitAddressSql');
    expect(m.RECRUIT_ADDRESS_JOINS_SQL).toContain('dbo.hr_ms_province');
    expect(m.RECRUIT_ADDRESS_JOINS_SQL).toContain('dbo.hr_ms_amphur');
    expect(m.RECRUIT_PROVINCE_NAME_SQL).toContain('am.amphur_code IS NULL AND ham.amphur_code IS NOT NULL');
    expect(m.RECRUIT_PROVINCE_NAME_SQL).toContain('hpv.province_name');
  });
  it('ทุกคิวรีที่อ่านที่อยู่ผู้สมัครใช้ชุดเดียวกัน — ห้าม join ms_province ตรง ๆ', () => {
    for (const f of ['api/_lib/boardCandidatesSql.ts', 'api/_lib/selectionContacts.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src).toContain('RECRUIT_ADDRESS_JOINS_SQL');
      expect(src).not.toMatch(/JOIN dbo\.ms_province\s+AS pv/);
    }
  });
});

describe('ปุ่มยกเลิกสาย ต้องยกเลิกที่ Lumos ด้วย (25 พ.ย. 2569)', () => {
  it('แถวที่ส่งถึง Lumos แล้ว → DELETE ที่ Lumos · เฉพาะแถวที่ยังไม่มีผล', () => {
    const src = readFileSync('api/_lib/lumosDispatch.ts', 'utf8');
    const fn = src.slice(src.indexOf('export async function cancelLumosQueueItem'), src.indexOf('// ─── Follow (คนกรอกรายชื่อเอง'));
    expect(fn).toContain('result is null');
    expect(fn).toContain("push_state = 'pushed'");
    expect(fn).toContain('cancelPushedInterview(');
    expect(fn).toContain('cancelPushedReminderIgnoringMissing(');
  });
});

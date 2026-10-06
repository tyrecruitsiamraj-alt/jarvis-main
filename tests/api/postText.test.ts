// @vitest-environment node
/**
 * ข้อความโพสต์ประกาศ — วางแล้วเติมช่อง + สร้างข้อความให้คัดลอก (เจ้าของ 6 ต.ค. 2569 → Choice "ทำทั้งสองอย่าง")
 * ตัวอย่างจริงที่เจ้าของวางมา
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildPostText,
  cleanRequirementLines,
  parsePostText,
  parsedPostHasData,
  postTextOverridesPatch,
  POST_REQUIREMENT_MAX,
} from '../../src/lib/postText';
import { cleanFieldOverrides } from '../../api/_lib/siamrajUnitNotes';
import { buildIncomeDisplay } from '../../src/lib/incomeBreakdown';
import type { JobRequest } from '../../src/types';

const SAMPLE = `พขร.ส่วนกลาง ประจำสำโรง เงินเดือน 11,160 (รายได้รวม 17000++) (ไม่ใส่ชื่อหน่วยงาน  TMT)
เงินเดือน 11,160, เบี้ยขยัน 500, ครองชีพ 300, เบี้ยเลี้ยงนอกเขตกทม.และปริมณฑล 110, แท๊กซี่ 110
ทำงาน จ.-ศ. และส.ตามปฏิทิน เวลา 7.30-16.30 น.
เพศชาย อายุ 30-50 ปี, มีประสบการณ์ขับรถนาย 1 ปีขึ้นไป, ชำนาญเส้นทางกรุงเทพและปริมณฑล, ไม่มีประวัติอาชญากรรมและโรคประจำตัว, สามารถขับรถตู้ได้`;

describe('parsePostText — ตัวอย่างของเจ้าของ', () => {
  const p = parsePostText(SAMPLE);
  it('รายได้แยกรายการ 5 บรรทัด · เงินเดือน = ฐานเงินเดือน · ป้ายยาวตัดที่จุด ไม่ตัดกลางคำ', () => {
    expect(p.incomeLines).toEqual([
      { label: 'ฐานเงินเดือน', amount: 11160 },
      { label: 'เบี้ยขยัน', amount: 500 },
      { label: 'ครองชีพ', amount: 300 },
      { label: 'เบี้ยเลี้ยงนอกเขตกทม.และปริมณฑล', amount: 110 },
      { label: 'แท๊กซี่', amount: 110 },
    ]);
  });
  it('รายได้รวม 17000 · วันเวลาทำงาน · เพศชาย · อายุ 30–50', () => {
    expect(p.total).toBe(17000);
    expect(p.schedule).toBe('ทำงาน จ.-ศ. และส.ตามปฏิทิน เวลา 7.30-16.30 น.');
    expect(p.gender).toBe('ชาย');
    expect(p.ageMin).toBe(30);
    expect(p.ageMax).toBe(50);
  });
  it('คุณสมบัติ 4 ข้อ — ไม่มีเพศ/อายุปน · ไม่เอาโน้ตภายใน/หัวโพสต์', () => {
    expect(p.requirements).toEqual([
      'มีประสบการณ์ขับรถนาย 1 ปีขึ้นไป',
      'ชำนาญเส้นทางกรุงเทพและปริมณฑล',
      'ไม่มีประวัติอาชญากรรมและโรคประจำตัว',
      'สามารถขับรถตู้ได้',
    ]);
    expect(JSON.stringify(p)).not.toContain('TMT');
    expect(JSON.stringify(p)).not.toContain('ไม่ใส่ชื่อหน่วยงาน');
  });
  it('อ่านได้ = มีข้อมูล · ข้อความว่าง = ไม่มี', () => {
    expect(parsedPostHasData(p)).toBe(true);
    expect(parsedPostHasData(parsePostText(''))).toBe(false);
    expect(parsedPostHasData(parsePostText('สวัสดีครับ'))).toBe(false);
  });
});

describe('parsePostText — แบบอื่น', () => {
  it('ไม่จำกัดเพศ · อายุ 25 ปีขึ้นไป · เลขไทย', () => {
    const p = parsePostText('แม่บ้าน\nเงินเดือน ๑๒,๐๐๐, ค่าเดินทาง ๕๐๐\nไม่จำกัดเพศ, อายุ 25 ปีขึ้นไป, รักความสะอาด');
    expect(p.gender).toBe('ไม่จำกัด');
    expect(p.ageMin).toBe(25);
    expect(p.ageMax).toBeNull();
    expect(p.incomeLines).toEqual([
      { label: 'ฐานเงินเดือน', amount: 12000 },
      { label: 'ค่าเดินทาง', amount: 500 },
    ]);
    expect(p.requirements).toEqual(['รักความสะอาด']);
  });
  it('ไม่มีบรรทัดแยกรายการ = ใช้เงินเดือนของหัวโพสต์', () => {
    const p = parsePostText('รปภ. ประจำบางนา เงินเดือน 13,500\nเพศชาย อายุ 25-45 ปี');
    expect(p.incomeLines).toEqual([{ label: 'ฐานเงินเดือน', amount: 13500 }]);
    expect(p.requirements).toEqual([]);
  });
  it('คุณสมบัติเพดาน', () => {
    expect(cleanRequirementLines(Array.from({ length: 20 }, (_, i) => `ข้อ ${i}`))).toHaveLength(POST_REQUIREMENT_MAX);
    expect(cleanRequirementLines(['ก', 'ก', ' ', 1])).toEqual(['ก']);
  });
});

describe('postTextOverridesPatch → API รับได้ครบ ไม่โดนตัดทิ้ง', () => {
  const patch = postTextOverridesPatch({ province: 'สมุทรปราการ', benefits: ['ชุดฟอร์ม'] }, parsePostText(SAMPLE));
  it('คงค่าเดิมที่ไม่ได้แตะ · รายได้แยกรายการ + ยอดรวม 17,000', () => {
    expect(patch.province).toBe('สมุทรปราการ');
    expect(patch.benefits).toEqual(['ชุดฟอร์ม']);
    expect(patch.total_income).toBeNull();
    const display = buildIncomeDisplay(patch.income as never);
    expect(display?.total).toBe(17000);
  });
  it('sanitizer ฝั่ง API เก็บ work_schedule + requirements + อายุ/เพศ', () => {
    const clean = cleanFieldOverrides(patch)!;
    expect(clean.work_schedule).toBe('ทำงาน จ.-ศ. และส.ตามปฏิทิน เวลา 7.30-16.30 น.');
    expect(clean.requirements).toHaveLength(4);
    expect(clean.gender).toBe('ชาย');
    expect(clean.age_min).toBe(30);
    expect(clean.age_max).toBe(50);
    expect(clean.income?.lines).toHaveLength(5);
  });
});

describe('buildPostText — ข้อความให้คัดลอก', () => {
  const income = { period: 'monthly' as const, lines: parsePostText(SAMPLE).incomeLines, total: 17000 };
  const job = {
    id: 'siamraj-sql:X1',
    unit_name: 'บริษัท ลับ จำกัด',
    work_site_name: 'TMT',
    job_description_code_1: 'พนักงานขับรถ',
    override_province: 'สมุทรปราการ',
    override_district: 'พระประแดง',
    work_schedule: 'ทำงาน จ.-ศ. เวลา 7.30-16.30 น.',
    gender_requirement: 'ชาย',
    age_range_min: 30,
    age_range_max: 50,
    requirements: ['สามารถขับรถตู้ได้'],
    field_overrides: { income, gender: 'ชาย' },
    income_display: buildIncomeDisplay(income),
    extra_benefits: ['ประกันสังคม'],
  } as unknown as JobRequest;
  const text = buildPostText(job, 'https://example.test/s/abc');
  it('หัวโพสต์ = ตำแหน่ง + ประจำพื้นที่ + เงินเดือน + รายได้รวม++', () => {
    const head = text.split('\n')[0];
    expect(head).toContain('ประจำพระประแดง');
    expect(head).toContain('เงินเดือน 11,160');
    expect(head).toContain('(รายได้รวม 17,000++)');
  });
  it('มีรายการรายได้ · เวลา · เพศ/อายุ/คุณสมบัติ · สวัสดิการ · ลิงก์ — ไม่มีชื่อหน่วยงาน', () => {
    expect(text).toContain('เงินเดือน 11,160, เบี้ยขยัน 500');
    expect(text).toContain('ทำงาน จ.-ศ. เวลา 7.30-16.30 น.');
    expect(text).toContain('เพศชาย, อายุ 30–50 ปี, สามารถขับรถตู้ได้');
    expect(text).toContain('สวัสดิการ ประกันสังคม');
    expect(text.split('\n').pop()).toBe('สมัครงาน https://example.test/s/abc');
    expect(text).not.toContain('บริษัท ลับ');
  });
});

describe('buildPostText — ไม่มีรายได้แยกรายการ', () => {
  it('เงินเดือนรวมก้อนเดียว = "เงินเดือน 12,000" · ไม่มีบรรทัดรายการ · ไม่มีลิงก์ = ไม่มีบรรทัดสมัคร', () => {
    const job = {
      id: 'siamraj-sql:X2',
      job_description_code_1: 'คนสวน',
      monthly_income_base: 12000,
      work_schedule: 'จันทร์ - เสาร์ • 6.00 - 15.00 น.',
      gender_requirement: 'ชาย',
      age_range_min: 20,
      age_range_max: 55,
    } as unknown as JobRequest;
    const text = buildPostText(job, null);
    expect(text.split('\n')[0]).toContain('เงินเดือน 12,000');
    expect(text).not.toContain('สมัครงาน');
    expect(text).toContain('เพศชาย, อายุ 20–55 ปี');
  });
});

describe('การ์ดหน้าสมัคร — ฐานเงินเดือนไม่ใช่ยอดรวม (6 ต.ค. 2569)', () => {
  it('มีบรรทัดฐานเงินเดือน = ขึ้นฐาน + รายได้รวมในวงเล็บ', async () => {
    const { jobBaseIncome } = await import('../../src/lib/jobPublicFacts');
    const income = { period: 'monthly' as const, lines: parsePostText(SAMPLE).incomeLines, total: 17000 };
    const r = jobBaseIncome({ income_display: buildIncomeDisplay(income) } as never);
    expect(r?.text).toBe('11,160 บาท/เดือน (รายได้รวม 17,000)');
  });
  it('ไม่มีบรรทัดฐาน = ยอดรวมแบบเดิม', async () => {
    const { jobBaseIncome } = await import('../../src/lib/jobPublicFacts');
    const r = jobBaseIncome({ income_display: buildIncomeDisplay({ period: 'monthly', lines: [{ label: 'รายได้', amount: 15000 }], total: null }) } as never);
    expect(r?.text).toBe('15,000 บาท/เดือน');
  });
});

describe('วางข้อความที่ระบบพิมพ์เองกลับเข้าไป (6 ต.ค. 2569 ลองป๊อป 2 จอ)', () => {
  it('บรรทัดสวัสดิการ + บรรทัดลิงก์สมัคร ไม่ลงช่องคุณสมบัติ', () => {
    const p = parsePostText(
      'คนสวน ประจำบางพลี เงินเดือน 13,000\nจันทร์ - ศุกร์ 07.00-16.00 น.\nเพศชาย, อายุ 25-50 ปี, ขยัน\nสวัสดิการ ประกันสังคม, ชุดฟอร์ม\nสมัครงาน https://so.example/apply/p/abc',
    );
    expect(p.requirements).toEqual(['ขยัน']);
    expect(p.schedule).toBe('จันทร์ - ศุกร์ 07.00-16.00 น.');
    expect(p.ageMin).toBe(25);
  });
});

/**
 * โพสต์คนขับรถจริง 3 ใบที่เจ้าของให้ลอง (6 ต.ค. 2569) — บรรทัดละรายการ · จุดรับ/ส่งนาย · รถที่ใช้ · รายรับคนเก่า
 * เดิมอ่านได้แค่เงินเดือนบรรทัดเดียว · วันกับเวลาแยกบรรทัดได้ครึ่งเดียว · จุดรับนาย/รถ/ค่าตำแหน่งไปปนในคุณสมบัติ
 */
describe('โพสต์คนขับรถ 3 ใบ (6 ต.ค. 2569)', () => {
  const read = (n: number) =>
    parsePostText(readFileSync(new URL(`./fixtures/post-driver-${n}.txt`, import.meta.url), 'utf8'));
  it('ใบ 1: รายได้บรรทัดละรายการ 4 รายการ · รายรับคนเก่า = รายได้รวม · วัน+เวลา+วันหยุดรวมกัน', () => {
    const p = read(1);
    expect(p.incomeLines.map((l) => [l.label, l.amount])).toEqual([
      ['ฐานเงินเดือน', 13000],
      ['ค่าตำแหน่ง', 3000],
      ['ค่าโทรศัพท์', 1000],
      ['โอที การันตรี', 2844],
    ]);
    expect(p.total).toBe(22000);
    expect(p.schedule).toBe('ทำงาน จันทร์-ศุกร์ เวลาปฎิบัติงาน 09.00-18.00 หยุดเสาร์-อาทิตย์');
    expect([p.gender, p.ageMin, p.ageMax]).toEqual(['ชาย', 25, 50]);
    expect(p.details).toEqual(['รับนาย นาคนิวาส 48 ลาดพร้าว', 'ส่งนาย อาคารเอ็มเอส ทาวเวอร์ พหลโยธิน', 'รถที่ใช้งาน Toyota Velifire']);
    expect(p.requirements).toHaveLength(5);
    expect(p.requirements.join(' ')).not.toMatch(/รายรับ|ค่าตำแหน่ง|รับนาย|รถที่ใช้งาน|หยุด/);
  });
  it('ใบ 2: บรรทัดรายได้คั่นจุลภาค + โน้ตในวงเล็บ · กม.21 ไม่ใช่เงิน · รถซ้ำสองบรรทัดเหลือบรรทัดเดียว', () => {
    const p = read(2);
    expect(p.incomeLines.map((l) => l.label)).toEqual(['ฐานเงินเดือน', 'เบี้ยขยัน', 'ครองชีพ', 'เบี้ยเลี้ยงนอกเขตกทม.และปริมณฑล', 'แท๊กซี่']);
    expect(p.total).toBe(21000);
    expect(p.details).toEqual(['รับนายไทย อ่างศิลา ชลบุรี', 'ส่งนาย นิสสัน บางนาตราด กม.21', 'รถที่ใช้งาน นิสสัน เซเรน่า']);
    expect(p.requirements).toHaveLength(3);
  });
  it('ใบ 3: "ฐาน" = ฐานเงินเดือน · เพศหญิง · เวลามาก่อนวันในโพสต์ก็เรียงวันก่อน', () => {
    const p = read(3);
    expect(p.incomeLines[0]).toEqual({ label: 'ฐานเงินเดือน', amount: 13000 });
    expect(p.incomeLines).toHaveLength(5);
    expect(p.gender).toBe('หญิง');
    expect(p.schedule).toBe('จันทร์-เสาร์ เวลา 08.00-17.00 หยุด อาทิตย์ และตามปฎิทินบริษัท');
    expect(postTextOverridesPatch(null, p).job_details).toEqual(p.details);
  });
  it('รายละเอียดงานขึ้นข้อความโพสต์ · API เก็บ job_details', () => {
    const src = readFileSync(new URL('../../api/_lib/siamrajUnitNotes.ts', import.meta.url), 'utf8');
    expect(src).toContain("if ('job_details' in o)");
    expect(readFileSync(new URL('../../src/components/jobs/JobPublicFacts.tsx', import.meta.url), 'utf8')).toContain('job-public-details');
  });
});

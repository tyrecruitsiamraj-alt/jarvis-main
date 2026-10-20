/**
 * Autopost: แคปชั่นแบบประกาศจริงของทีมสรรหา + ช่องบังคับ (เจ้าของ 20 ต.ค. 2569) — ข้อตรวจรับ 11–15
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import { autopostIncome, autopostMissing, buildAutopostCaption, captionLeaks } from '@/lib/autopostCaption';
import { soScrapSnapshot, soSnapshotError } from '@/lib/soScraping';
import { publicJobTitle } from '@/lib/publicJobTitle';

const read = (p: string) => readFileSync(p, 'utf8');
const JOB = {
  id: 'siamraj-sql:OPL6910068',
  request_no: 'OPL6910068',
  unit_name: 'บริษัทเค เอช เมทัลโปรดักส์',
  staff_title_name: 'พนักงาน',
  request_action_name: 'พนักงานขับรถนายไทย',
  override_province: 'สมุทรปราการ',
  override_district: 'บางบ่อ',
  location_address: 'อ.บางบ่อ จ.สมุทรปราการ',
  request_positions: 2,
  age_range_min: 28,
  age_range_max: 45,
  work_schedule: 'จันทร์–เสาร์ • 08.00–17.00 น., ขอให้ OPL เป็นผู้ดำเนินการจัดตารางให้ผู้ที่เกี่ยวข้องทราบ',
  job_details: ['รับนาย บางบ่อ สมุทรปราการ'],
  requirements: ['มีประสบการณ์ขับรถ 2 ปีขึ้นไป', 'ขับได้ทั้งเกียร์ธรรมดา ออโต้ และรถตู้'],
  benefits: ['กองทุนประกันสังคม', 'ค่าโทรศัพท์', 'ชุดยูนิฟอร์ม ปีละ 3 ชุด'],
  income_display: {
    period: 'monthly',
    total: 22000,
    lines: [
      { label: 'ฐานเงินเดือน', amount: 13000 },
      { label: 'ค่าตำแหน่ง', amount: 4000 },
      { label: 'OT การันตี', amount: 4000 },
      { label: 'เบี้ยขยัน', amount: 500 },
      { label: 'ค่าโทรศัพท์', amount: 500 },
    ],
  },
  list_note: 'หมายเหตุภายใน ห้ามหลุด',
} as unknown as JobRequest;
const LINK = 'https://jarvis.siamrajathanee.dev/apply/p/64gxf5x';
const CONTACT = { name: 'แบงค์', phone: '090-197-8522' };

describe('แคปชั่น Autopost ตามแบบทีมสรรหา', () => {
  const cap = buildAutopostCaption(JOB, { contact: CONTACT, link: LINK });
  it('ข้อ 11: รายได้ = ฐาน + ทุกรายการ (4 รายการ) ++ · รายการรายได้ไม่ซ้ำในสวัสดิการ', () => {
    expect(autopostIncome(JOB)).toMatchObject({ base: 13000, total: 22000 });
    expect(cap).toContain('💰 รายได้ 22,000++ บาท/เดือน');
    expect(cap).toContain('- ฐานเงินเดือน 13,000 บาท/เดือน');
    for (const l of ['- ค่าตำแหน่ง 4,000 บาท/เดือน', '- OT การันตี 4,000 บาท/เดือน', '- เบี้ยขยัน 500 บาท/เดือน', '- ค่าโทรศัพท์ 500 บาท/เดือน']) {
      expect(cap).toContain(l);
    }
    const benefits = cap.split('สวัสดิการเพิ่มเติม')[1] ?? '';
    expect(benefits).toContain('- กองทุนประกันสังคม');
    expect(benefits).not.toContain('ค่าโทรศัพท์');
  });
  it('ข้อ 12: จุดเริ่มงานซ้ำกับสถานที่ทำงาน = 📍 บรรทัดเดียว', () => {
    expect(cap.match(/📍/g)).toHaveLength(1);
    expect(cap).toContain('📍 รับนาย บางบ่อ สมุทรปราการ');
    const noDetail = buildAutopostCaption({ ...JOB, job_details: [] } as JobRequest, { contact: CONTACT, link: LINK });
    expect(noDetail).toContain('📍 บางบ่อ สมุทรปราการ');
  });
  it('ข้อ 13: ไม่มีเลขใบขอ ไม่มีคำสั่งงานภายใน ไม่มีหมายเหตุภายใน', () => {
    expect(cap).not.toMatch(/OPL\d/);
    expect(cap).not.toContain('OPL');
    expect(cap).not.toContain('ผู้ที่เกี่ยวข้อง');
    expect(cap).not.toContain('หมายเหตุภายใน');
    expect(cap).toContain('⏰ ทำงาน จันทร์–เสาร์ เวลา 08.00–17.00 น.');
    expect(captionLeaks(cap)).toEqual([]);
    expect(captionLeaks('รับสมัคร OPL6910068')).toEqual(['เลขใบขอ']);
  });
  it('ข้อ 14: โทรติดต่อ + ลิงก์ /apply/p/{code} ท้ายโพสต์ · server บังคับว่าข้อความต้องมีลิงก์ที่เลือก', () => {
    expect(cap).toContain('โทรติดต่อ : 0901978522 (คุณแบงค์)');
    expect(cap.endsWith(`หรือสมัครงานได้ที่ : ${LINK}`)).toBe(true);
    const snap = { post_mode: 'caption_only', caption: cap, group_ids: ['g'], account_id: 'a', apply_link: LINK, link_code: '64gxf5x' };
    expect(soSnapshotError('content', snap)).toBeNull();
    expect(soSnapshotError('content', { ...snap, apply_link: undefined })).toBe('เลือกลิงก์สมัครก่อนส่ง');
    expect(soSnapshotError('content', { ...snap, caption: 'ไม่มีลิงก์' })).toBe('ข้อความประกาศต้องมีลิงก์สมัครที่เลือก');
    const read2 = read('api/_handlers/matching-job-postings.ts');
    expect(read2).toContain("where l.code = $1 and p.job_id = $2 and p.status = 'open' limit 1");
  });
  it('ข้อ 15: ขอ Scrap ส่งชื่อตำแหน่งที่โชว์บนประกาศ ไม่ใช่ "พนักงาน"', () => {
    const title = publicJobTitle(JOB);
    expect(title).not.toBe('พนักงาน');
    expect(soScrapSnapshot(JOB, title).position).toBe(title);
    expect(read('src/components/jobs/OrderPostButton.tsx')).toContain('jobSnapshot: soScrapSnapshot(job, title),');
  });
  it('บรรทัดที่ไม่มีข้อมูลไม่ขึ้น · ไม่เกิน 2,000 ตัวอักษร', () => {
    const bare = buildAutopostCaption({ ...JOB, requirements: [], benefits: [], age_range_min: null, age_range_max: null } as unknown as JobRequest, {
      contact: null,
      link: LINK,
    });
    expect(bare).not.toContain('สวัสดิการเพิ่มเติม');
    expect(bare).not.toContain('โทรติดต่อ');
    expect(bare).toContain(`สมัครงานได้ที่ : ${LINK}`);
    expect(cap.length).toBeLessThanOrEqual(2000);
  });
});

describe('ขาดแล้วกดส่งไม่ได้', () => {
  it('ตำแหน่ง · สถานที่ · ฐานเงินเดือน · วันเวลาทำงาน · ลิงก์สมัคร', () => {
    const titled = { ...JOB, job_description_code_1: 'พนักงานขับรถ' } as JobRequest;
    expect(autopostMissing(titled, { hasLink: true }).filter((m) => m !== 'ตำแหน่ง')).toEqual([]);
    expect(autopostMissing({ ...JOB, staff_title_name: 'อื่นๆ', request_action_name: 'อื่นๆ' } as JobRequest, { hasLink: true })).toContain('ตำแหน่ง');
    expect(autopostMissing({ ...JOB, work_schedule: 'ขอให้ OPL เป็นผู้ดำเนินการ' } as JobRequest, { hasLink: true })).toContain('วันเวลาทำงาน');
    expect(autopostMissing({ ...JOB, income_display: null, monthly_income_base: null } as unknown as JobRequest, { hasLink: true })).toContain('ฐานเงินเดือน');
    expect(autopostMissing(JOB, { hasLink: false })).toContain('ลิงก์สมัคร (ประกาศก่อน)');
    expect(autopostMissing(JOB, { hasLink: true })).not.toContain('สถานที่');
  });
  it('ป๊อปบอกปัญหาเป็นรายการ ปุ่มส่งกดไม่ได้จนครบ · ปุ่มอยู่บนการ์ด · ป๊อปอยู่นอกการ์ด', () => {
    const dlg = read('src/components/jobs/AutopostDialog.tsx');
    expect(dlg).toContain("disabled={busy !== null || problems.length > 0 || openOrder !== null}");
    expect(dlg).toContain('data-testid="autopost-problems"');
    expect(read('src/components/jobs/BoardJobCard.tsx')).toContain('data-testid="board-card-autopost"');
    expect(read('src/components/jobs/JobBoardView.tsx')).toContain('onAutopost={setAutopostJob}');
  });
});

describe('ข้อมูลจริงที่ทีมวางมา (OPL6910006 · 20 ต.ค. 2569)', () => {
  const real = {
    ...JOB,
    income_display: null,
    monthly_income_base: 13000,
    benefits: ['ค่าเดินทาง', 'ค่าโทรศัพท์', 'ประกันสังคม'],
    extra_benefits: ['ค่าตำแหน่ง 3,000 บาท', 'ค่าโทรศัพท์ 1,000 บาท'],
    requirements: ['คุณสมบัติ', '- เพศชายอายุ 25-50 ปี', '- มีประสบการณ์ขับรถ 2 ปีขึ้นไป', '- มีประสบการณ์ขับรถ 2 ปีขึ้นไป'],
  } as unknown as JobRequest;
  const cap = buildAutopostCaption(real, { contact: CONTACT, link: LINK });
  it('สวัสดิการที่มียอดเงิน = รายการรายได้ (บวกเข้ายอดรวม) · ไม่ซ้ำในสวัสดิการ', () => {
    expect(cap).toContain('💰 รายได้ 17,000++ บาท/เดือน');
    expect(cap).toContain('- ค่าตำแหน่ง 3,000 บาท/เดือน');
    expect(cap).toContain('- ค่าโทรศัพท์ 1,000 บาท/เดือน');
    const benefits = cap.split('สวัสดิการเพิ่มเติม')[1].split('โทรติดต่อ')[0];
    expect(benefits).not.toContain('ค่าโทรศัพท์');
    expect(benefits).not.toContain('ค่าตำแหน่ง');
    expect(benefits).toContain('- ค่าเดินทาง');
  });
  it('คุณสมบัติ: ตัดหัว · ตัด "- " ซ้อน · ตัดเพศ/อายุซ้ำ · ตัดบรรทัดซ้ำ', () => {
    const part = cap.split('คุณสมบัติ\n')[1].split('สวัสดิการเพิ่มเติม')[0];
    expect(part).not.toMatch(/- -|- คุณสมบัติ/);
    expect(part.match(/มีประสบการณ์ขับรถ/g)).toHaveLength(1);
    expect(part).not.toContain('เพศชายอายุ 25-50');
  });
});

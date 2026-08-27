/**
 * ═══ ชื่อหัวหน้าจอต้องตรงกับชื่อเมนูเสมอ ═══
 *
 * 🔴 audit มุมพนักงานใหม่ 26 ส.ค. 2569 พบว่า **ไม่ตรง 4 ใน 6 ขั้น**:
 * เมนู `ใบขอ` → หน้าเขียน "หน่วยงาน" · `จับคู่ & โทร` → "Matching — คนของเรา" ·
 * `ติดตาม` → "Follow" · `ประกาศรับ`/`ผู้สมัคร` → "งานสรรหา" หัวเดียวกันทั้งสองขั้น
 * ⇒ คนใหม่กดเมนูแล้วไม่แน่ใจว่ามาถูกหน้าไหม (และเป็นที่มาของ "ชื่อเรียก 3 ชุด"
 * ที่ audit 25 ส.ค. เคยจับได้แต่ยังไม่ได้แก้)
 *
 * เทสต์นี้สแกนไฟล์หน้าจริง — ห้ามพิมพ์ชื่อขั้นเป็นสตริงตายในหัวหน้า
 * ต้องเรียก `conveyorLabel()` จาก `soRecruitNav` ซึ่งเป็นแหล่งเดียวกับเมนู
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CONVEYOR_STEPS, conveyorLabel } from '@/lib/soRecruitNav';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** หน้าที่เป็นเจ้าของขั้นในสายพาน → ต้องตั้งหัวจากคีย์นี้ */
const STEP_PAGES: Array<{ file: string; key: string }> = [
  { file: 'src/pages/jobs/JobListPage.tsx', key: 'requests' },
  { file: 'src/pages/matching/MatchingPage.tsx', key: 'matching' },
  { file: 'src/pages/follow/FollowPage.tsx', key: 'follow' },
];

describe('ชื่อหัวหน้าจอ = ชื่อเมนู', () => {
  it('conveyorLabel คืนชื่อเดียวกับที่เมนูใช้ทุกขั้น', () => {
    for (const step of CONVEYOR_STEPS) {
      expect(conveyorLabel(step.key), step.key).toBe(step.label);
    }
  });

  it.each(STEP_PAGES)('$file ตั้งหัวจาก conveyorLabel ไม่ใช่สตริงตาย', ({ file, key }) => {
    const src = read(file);
    expect(src, `${file} ต้อง import conveyorLabel`).toContain('conveyorLabel');
    expect(src).toContain(`conveyorLabel('${key}')`);
  });

  it('บอร์ดรับสมัครเปลี่ยนหัวตาม ?view= — ขั้น 2 กับ 3 ต้องไม่ได้หัวเดียวกัน', () => {
    const src = read('src/components/jobs/JobBoardView.tsx');
    expect(src).toContain("conveyorLabel('postings')");
    expect(src).toContain("conveyorLabel('applicants')");
    // มุมมองกล่องงาน (ไม่มี ?view=) ใช้ชื่อของตัวเอง — ตรงกับเมนูคลังข้อมูล
    expect(src).toContain("'กล่องงาน'");
    // ชื่อเก่าที่เคยชนกันทั้งสองขั้นต้องหายไป
    expect(src).not.toContain('title="งานสรรหา"');
  });

  it('ชื่อเก่าที่ทำให้คนใหม่งงต้องไม่หลงเหลือในหัวหน้าจอ', () => {
    const BANNED: Array<[string, string]> = [
      ['src/pages/jobs/JobListPage.tsx', 'title="หน่วยงาน"'],
      ['src/pages/matching/MatchingPage.tsx', 'title="Matching — คนของเรา"'],
      ['src/pages/follow/FollowPage.tsx', 'title="Follow"'],
    ];
    for (const [file, banned] of BANNED) {
      expect(read(file), `${file} ยังมี ${banned}`).not.toContain(banned);
    }
  });
});

/**
 * ผลโทรบนหน้าติดตามต้องเป็นคำไทย — เดิมพ่นรหัสดิบ (declined / wrong_person /
 * reschedule_requested / unresponsive / busy / confirmed / acknowledged) ขึ้นจอ
 * ทั้งที่ `CALL_OUTCOME_LABEL` มีคำไทยครบอยู่แล้ว
 */
describe('หน้าติดตามแสดงผลโทรเป็นคำไทย', () => {
  const src = read('src/pages/follow/FollowPage.tsx');

  it('เรียกใช้ตารางคำแปลกลาง ไม่พ่นรหัสดิบ', () => {
    expect(src).toContain('CALL_OUTCOME_LABEL');
    expect(src).toContain('callOutcomeText(');
    expect(src).not.toContain('` (${it.call_outcome})`');
  });
});

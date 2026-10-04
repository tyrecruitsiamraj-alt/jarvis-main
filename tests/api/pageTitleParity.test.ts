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

  it('บอร์ดรับสมัครเปลี่ยนหัวตาม ?view= · แท็บคำขอโพสต์ถอดแล้ว (27 ก.ย. 2569)', () => {
    const src = read('src/components/jobs/JobBoardView.tsx');
    // 🔴 แท็บ "คำขอโพสต์งานใหม่" ถอดทั้งแท็บ (เจ้าของสั่ง) — ห้ามมีหัว/แท็บของมันกลับมา
    expect(src).not.toContain("conveyorLabel('postings')");
    expect(src).not.toContain("{ id: 'postings'");
    // 🔴 หัวของแท็บฝั่งผู้สมัครเคยว่างเปล่า เพราะเรียกชื่อขั้น "ผู้สมัคร" ที่ถอดจากสายพานไปแล้ว
    //    (เจอ 27 ก.ย. 2569) ⇒ หัวต้องมาจากชุดแท็บเดียวกับแถบแท็บ
    expect(src).not.toContain("conveyorLabel('applicants')");
    expect(src).toContain('BOARD_VIEW_TABS.find((t) => t.id === view)');
    expect(src).toContain('BOARD_VIEW_TABS.map(');
    // ชื่อ + ลำดับที่เจ้าของเรียงเอง 30 ก.ย. 2569 (แบบ iRecruit)
    for (const label of ['งานสรรหา', 'ผู้สมัคร', 'การติดต่อ', 'ติดตามนัดหมาย', 'ภาพรวม']) {
      expect(src).toContain(`label: '${label}'`);
    }
    // ชื่อเก่าที่เคยชนกันทั้งสองขั้นต้องหายไป
    expect(src).not.toContain('title="งานสรรหา"');
  });

  it('🔴 ทุกที่ที่เรียก conveyorLabel ต้องได้ชื่อจริง ไม่ใช่สตริงว่าง (หัวหน้าจอหาย)', () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
        const rel = `${dir}/${d.name}`;
        if (d.isDirectory()) return walk(rel);
        return /\.(tsx?|jsx?)$/.test(d.name) ? [rel] : [];
      });
    const calls: Array<[string, string]> = [];
    for (const file of walk('src')) {
      for (const m of read(file).matchAll(/conveyorLabel\('([^']+)'\)/g)) calls.push([file, m[1]]);
    }
    expect(calls.length).toBeGreaterThan(0);
    for (const [file, key] of calls) {
      expect(conveyorLabel(key as Parameters<typeof conveyorLabel>[0]), `${file} → '${key}'`).not.toBe('');
    }
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
  // ผลการโทรย้ายไปวาดที่ป๊อปของช่องปฏิทินแล้ว (1 ก.ย. 2569) — ด่านนี้ต้องตามไปเฝ้าที่นั่น
  const src = read('src/components/follow/FollowRoundsDialog.tsx');

  it('เรียกใช้ตารางคำแปลกลาง ไม่พ่นรหัสดิบ', () => {
    // ใช้ชุดคำ "ฉบับงานติดตาม" (1 ก.ย. 2569) — ทับเฉพาะคำที่ความหมายเพี้ยนในบริบทนี้
    // แล้วถอยไปใช้ตารางกลางเป็นค่าตั้งต้น (ดู followCallOutcomeText)
    expect(src).toContain('followCallOutcomeText(');
    expect(src).not.toContain('` (${it.call_outcome})`');
  });
});

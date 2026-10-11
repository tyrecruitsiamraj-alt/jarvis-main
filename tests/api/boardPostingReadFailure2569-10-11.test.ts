// @vitest-environment node
/**
 * QA รอบ 3 ข้อสูง 1–2 (11 ต.ค. 2569) — ป๊อปประกาศค่าเริ่ม (`BoardPostingPage`) อ่านลิงก์/ทะเบียนประกาศไม่ได้
 * เดิมถือว่า "ยังไม่มี" ⇒ จอขึ้นยังไม่มีลิงก์ + กางฟอร์ม Gen link เอง (เสี่ยงลิงก์ซ้ำ) และใบที่ประกาศอยู่ขึ้นปุ่ม "ส่งประกาศ"
 * 🔴 อ่านไม่ได้ ≠ ไม่มี: จอบอกตรง ๆ + ปุ่มลองใหม่ · ปิด Gen link · ซ่อนปุ่มประกาศ/ดึงลง
 * (รอบก่อนแก้แค่ BoardPublishSheet ซึ่งเป็นทางถอย — ป๊อปที่คนใช้จริงคือไฟล์นี้)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/pages/jobs/BoardPostingPage.tsx', 'utf8');

describe('BoardPostingPage — อ่านไม่ได้ ≠ ไม่มี', () => {
  it('ล้มแล้วจำว่าล้ม (ไม่ใช่แค่ตั้งรายการว่าง)', () => {
    expect(src).toMatch(/catch \{\s*setPostings\(\[\]\);[^\n]*\n\s*setPostingsFailed\(true\);/);
    expect(src).toMatch(/catch \{\s*setReleases\(\[\]\);[^\n]*\n\s*setReleasesFailed\(true\);/);
  });

  it('🔴 อ่านลิงก์ไม่ได้ = ไม่กางฟอร์ม Gen link เอง + ปุ่ม Gen link กดไม่ได้ + มีลองใหม่', () => {
    expect(src).toContain('const noLinkYet = !postingsFailed && linkCount === 0;');
    expect(src).toContain('<Collapsible open={wantLink && !postingsFailed}');
    expect(src).toMatch(/data-testid="gen-link-toggle" disabled=\{postingsFailed\}/);
    expect(src).toMatch(/data-testid="links-failed"[\s\S]{0,200}อ่านลิงก์ไม่ได้[\s\S]{0,200}loadPostings\(\)[\s\S]{0,80}ลองใหม่/);
  });

  it('🔴 อ่านทะเบียนประกาศไม่ได้ = ไม่โชว์ปุ่มส่งประกาศ/ดึงลง (เช็คก่อนสาขา released)', () => {
    expect(src).toMatch(/\{releasesFailed \? \([\s\S]{0,300}อ่านสถานะประกาศไม่ได้[\s\S]{0,300}\) : released === null \?/);
  });
});

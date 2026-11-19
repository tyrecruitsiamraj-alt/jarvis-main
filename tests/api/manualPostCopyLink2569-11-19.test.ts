/**
 * เตรียมโพสต์ (โพสต์เอง) — คัดลอกลิงก์สมัครอย่างเดียว ส่งให้ผู้สมัครกรอกเข้ามา (เจ้าของ 19 พ.ย. 2569)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('ปุ่มคัดลอกลิงก์ในแถวเตรียมโพสต์', () => {
  it('ทุกแถวมีปุ่มคัดลอกลิงก์ · คัดลอกลิงก์สมัครเปล่า ๆ · นับเป็นคัดลอกแล้ว + จดการโพสต์เหมือนคัดลอกข้อความ', () => {
    const src = readFileSync('src/components/jobs/ManualPostPanel.tsx', 'utf8');
    expect(src).toContain('data-testid="manual-post-copy-link"');
    expect(src).toContain("const urlOf = (r: Row) => `${window.location.origin}${applyLinkPath(r.link.code)}`;");
    expect(src).toContain('await copyText(onlyLink ? urlOf(r) : textOf(r));');
    expect(src).toContain("{linkCopied.has(r.key) ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์'}");
    const fn = src.slice(src.indexOf('const copy = async'), src.indexOf('/** บันทึกลิงก์โพสต์ของแถว'));
    expect(fn).toContain('markManualPosted(r.link.id)');
  });
});

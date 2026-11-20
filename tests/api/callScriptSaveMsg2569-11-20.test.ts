/**
 * บทโทร: ผลบันทึกขึ้นในการ์ดของบทนั้น (เจ้าของ 20 พ.ย. 2569 "ฉันแก้แล้วมันไม่บันทึกให้")
 * เดิมข้อความไม่ผ่านขึ้นบนสุดของหน้า การ์ดยาว 15 บรรทัด กดบันทึกท้ายการ์ดแล้วไม่เห็นว่าไม่ได้บันทึก
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('CallScriptsTab ผลบันทึกในการ์ด', () => {
  const src = readFileSync('src/pages/settings/CallScriptsTab.tsx', 'utf8');
  it('ข้อความผล บันทึก/คืนค่า อยู่ในการ์ดของบทที่กด', () => {
    expect(src).toContain('data-testid={`script-msg-${s.key}`}');
    expect(src).toContain("text: `ยังไม่ได้บันทึก — ");
    expect(src).not.toContain('setNotice(');
  });
  it('เพดานบรรทัดบนจอ = เพดานแม่แบบของ API', () => {
    expect(readFileSync('api/_handlers/call-scripts.ts', 'utf8')).toContain('max_lines: MAX_SCRIPT_LINES');
  });
});

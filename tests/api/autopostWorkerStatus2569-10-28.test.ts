import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// So Scraping 28 ต.ค. 2569: ช่อง "เครื่อง" เน้นสถานะด้วยสี + คำเสมอ · ออฟไลน์เลือกไม่ได้ · ใช้ Select ของ shadcn
describe('Autopost ช่องเครื่อง: ออนไลน์เขียว · ออฟไลน์เทาเลือกไม่ได้', () => {
  const src = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
  it('ใช้ Select ของ shadcn · ออฟไลน์ disabled', () => {
    expect(src).toContain('<SelectItem key={w.name} value={w.name} disabled={!w.online}>');
    expect(src).toContain('data-testid="autopost-worker"');
  });
  it('จุดสี + คำบอกสถานะคู่กัน', () => {
    expect(src).toContain('const tone = w.online ? TONE.success : TONE.neutral;');
    expect(src).toContain("{w.online ? 'ออนไลน์' : 'ออฟไลน์'}");
    expect(src).toContain("cn('h-2 w-2 shrink-0 rounded-full', tone.dot)");
  });
});

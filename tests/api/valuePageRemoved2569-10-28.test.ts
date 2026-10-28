/**
 * หน้าความคุ้มค่าระบบถอดทั้งหน้า (เจ้าของ 28 ต.ค. 2569 "เอาออกเลย" → Choice "ลบทั้งหน้า")
 * ไม่มีเมนู · ไม่มี route · ไม่มี API — ตาราง app_value_case เหลือในฐาน (migration เพิ่มอย่างเดียว)
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('หน้าความคุ้มค่าระบบ ถอดแล้ว', () => {
  it('ไม่มีเมนู ไม่มี route ไม่มี API', () => {
    expect(read('src/components/layout/AppNavDrawer.tsx')).not.toContain('ความคุ้มค่าระบบ');
    expect(read('src/App.tsx')).not.toContain('path="/value"');
    const reg = read('api/_handlers/registry.ts');
    expect(reg).not.toContain('/api/value-case');
    expect(reg).not.toContain('/api/value-pipeline');
    for (const f of ['src/pages/value/ValueCasePage.tsx', 'src/lib/valueCase.ts', 'api/_handlers/value-case.ts', 'api/_handlers/value-pipeline.ts']) {
      expect(existsSync(f)).toBe(false);
    }
  });
});

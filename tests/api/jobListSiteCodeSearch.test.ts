/**
 * หน้าใบขอ: ค้นด้วย Code site ได้ (เจ้าของสั่ง 1 ต.ค. 2569: "หน้าใบขอ ทำให้ ตอนค้นหา ค้นด้วย Code site ได้หน่อย")
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.resolve(__dirname, '../../src/pages/jobs/JobListPage.tsx'), 'utf8');

describe('JobListPage — ค้นหา', () => {
  it('🔴 ข้อความที่ค้นรวม site_code ของใบขอ', () => {
    expect(page).toContain("${j.site_code || ''}");
  });
  it('ช่องค้นหาบอกว่าค้น Code site ได้', () => {
    expect(page).toMatch(/JOB_LIST_SEARCH_PLACEHOLDER = '[^']*Code site/);
  });
});

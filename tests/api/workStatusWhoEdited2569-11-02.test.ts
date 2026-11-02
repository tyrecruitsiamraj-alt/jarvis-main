/**
 * กดป้ายสถานะทำงานหน้ารายการใบขอ = ป๊อป "ใครแก้สถานะ" ทุกครั้ง แบ่งหน้า (เจ้าของ 2 พ.ย. 2569)
 * "กดก็เด้ง Popup ขึ้นมา โชว์ไว้มันเกะกะ" · "เอาทุกครั้งเลยแต่ทำเป็น pagination"
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../', p), 'utf8');

describe('ใครแก้สถานะทำงาน', () => {
  it('เส้นประวัติรับ type= ชนิดเดียวแล้วเอาทุกครั้ง · ชื่อคนแก้เป็นชื่อเล่นไม่ใช่อีเมล', () => {
    const api = read('api/_handlers/siamraj-unit-history.ts');
    expect(api).toContain("const limit = type ? 2000 : 50;");
    expect(api).toContain('(BOARD_EDIT_ENTITY_TYPES as readonly string[]).includes(type)');
    expect(api).toContain("coalesce(nullif(btrim(u.nickname), ''), nullif(btrim(u.full_name), ''), split_part(a.user_name, '@', 1)) as user_name");
  });

  it('หน้ารายการใบขอ: ป้ายสถานะกดได้ทั้งตารางและการ์ดมือถือ · ไม่เปิดใบขอ · ป๊อปใช้ส่วนประวัติเดิมที่แบ่งหน้าแล้ว', () => {
    const page = read('src/pages/jobs/JobListPage.tsx');
    expect(page.match(/title="ดูว่าใครแก้สถานะ"/g)).toHaveLength(2);
    expect(page.match(/e\.stopPropagation\(\);\s+setStatusLogJob\(j\);/g)?.length).toBeGreaterThanOrEqual(2);
    expect(page).toContain('<UnitEditLogSection job={statusLogJob} entityType="siamraj_unit_work_status"');
    const section = read('src/components/jobs/UnitEditLogSection.tsx');
    expect(section).toContain('fetchUnitEditLog(unitRequestNoteKey(job), entityType)');
    expect(section).toContain('<ListPaginationBar');
  });
});

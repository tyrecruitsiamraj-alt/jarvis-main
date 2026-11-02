/**
 * ประวัติการแก้ไขใบขออยู่ใต้หมายเหตุในหน้าใบขอ ทุกครั้ง แบ่งหน้า (เจ้าของ 2 พ.ย. 2569)
 * "log แก้ไขขอเอามาไว้ใต้ตรงนี้เลยว่าใบนี้มีการแก้ไขอะไรไปบ้างทำเป็น pagination นะ ไม่ต้องกดตรงนั้นแล้วเด้งมาและ"
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../', p), 'utf8');

describe('ประวัติการแก้ไขใบขอ', () => {
  it('เส้นประวัติเอาทุกครั้งทุกชนิด · ชื่อคนแก้เป็นชื่อเล่นไม่ใช่อีเมล', () => {
    const api = read('api/_handlers/siamraj-unit-history.ts');
    expect(api).toContain('const limit = 2000;');
    expect(api).toContain("coalesce(nullif(btrim(u.nickname), ''), nullif(btrim(u.full_name), ''), split_part(a.user_name, '@', 1)) as user_name");
  });

  it('หน้าใบขอ: ประวัติอยู่ใต้หมายเหตุ แบ่งหน้า · หน้ารายการใบขอไม่มีป๊อปตอนกดป้ายสถานะแล้ว', () => {
    const detail = read('src/pages/jobs/SiamrajUnitRequestDetailPage.tsx');
    const note = detail.indexOf('<UnitRequestNoteDetail');
    const log = detail.indexOf('<UnitEditLogSection job={data} />');
    expect(note).toBeGreaterThan(0);
    expect(log).toBeGreaterThan(note);
    // พับไว้ กดค่อยกาง (เจ้าของ 2 พ.ย. 2569 "ย่อไว้ถ้ากดค่อยขยาย ไม่งั้นเกะกะ") — ค่าเริ่มพับ · ประวัติอยู่ใน CollapsibleContent (ไม่กาง = ไม่โหลด)
    expect(detail).toContain('const [historyOpen, setHistoryOpen] = useState(false);');
    expect(detail).toMatch(/<CollapsibleContent>\s*<UnitEditLogSection job=\{data\} \/>\s*<\/CollapsibleContent>/);
    expect(read('src/components/jobs/UnitEditLogSection.tsx')).toContain('<ListPaginationBar');
    const list = read('src/pages/jobs/JobListPage.tsx');
    expect(list).not.toContain('ดูว่าใครแก้สถานะ');
    expect(list).not.toContain('statusLogJob');
  });
});

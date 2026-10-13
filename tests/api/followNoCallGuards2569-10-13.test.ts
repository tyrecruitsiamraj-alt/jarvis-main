// @vitest-environment node
/**
 * กันไม่โทร รอบ 2 (เจ้าของ 13 ต.ค. 2569 "อะไรที่จะไม่โทร และมีโอกาสจะไม่โทร จะกันให้หมด") — ต้นเหตุฝั่ง AI ที่ทำให้สายหายเงียบ
 * A9 push ล้มเร็วโดนเขียน "queued" ทับ · A12/A13 ส่งล้มกลางทางหลังบันทึก · B6 แท็บส่งคนแทนไม่เช็กเบอร์ซ้ำเจ้าหน้าที่ · A1 จอเสร็จสิ้นไม่เตือน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KEEP_PUSH_FAILED_SQL } from '../../src/lib/followDispatchState';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('A9: push_failed ห้ามถูกเขียนทับเป็น queued', () => {
  it('ทุกที่ที่จดสถานะหลังส่งใช้ด่านเดียวกัน', () => {
    expect(KEEP_PUSH_FAILED_SQL).toBe(`not ($2 = 'queued' and dispatch_state is not distinct from 'push_failed')`);
    for (const f of ['api/_handlers/follow.ts', 'api/_lib/irecruitReplaceSync.ts', 'api/_lib/lumosDispatch.ts']) {
      const src = read(f);
      expect(src).not.toMatch(/set dispatch_state = \$2 where id = \$1`/);
      expect(src).toContain('${KEEP_PUSH_FAILED_SQL}');
    }
  });
  it('ธง push_failed ติดได้แม้แถวยังไม่ได้จดสถานะ (null) — ทุกจุดที่ส่งล้ม', () => {
    const src = read('api/_lib/lumosDispatch.ts');
    expect(src).toContain('(dispatch_state = $3 or ($5::boolean and dispatch_state is null))');
    expect(src.match(/'push_failed', 'queued', pushErrorText\(e\), true\)/g)?.length).toBe(3);
  });
});

describe('A12/A13: ส่งล้มกลางทางหลังบันทึก = guarded ให้ตัวกู้ส่ง (ไม่ใช่ 500 / ไม่ใช่ "ปิดส่งอัตโนมัติ")', () => {
  it('ฟอร์มเพิ่มคน (สายเดียว + หลายสาย) และรอบดึง iRecruit', () => {
    const follow = read('api/_handlers/follow.ts');
    expect(follow).toContain("dispatchState = 'guarded';");
    expect(follow).toContain("(enqueueFailed ? 'guarded' : 'off')");
    expect(read('api/_lib/irecruitReplaceSync.ts')).toContain("for (const it of inputs) out.set(it.id, 'guarded');");
  });
});

describe('B6 + A1: แท็บส่งคนแทน', () => {
  it('เพิ่มคนเช็กเบอร์ซ้ำเจ้าหน้าที่ · จอเสร็จสิ้นเตือนเมื่อส่งไม่ได้', () => {
    const page = read('src/pages/follow/FollowPage.tsx');
    const replaceBlock = page.slice(page.indexOf('if (replaceView) {'), page.indexOf('const incomplete = firstIncompleteStep'));
    expect(replaceBlock).toContain('staffPhoneMatchesApplicant(phone, staffPhones)');
    expect(replaceBlock).toContain('summarizeDispatchResults(');
    expect(replaceBlock).not.toMatch(/warn: null,/);
  });
});

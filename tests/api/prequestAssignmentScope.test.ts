// @vitest-environment node
/**
 * ═══ ใบขอชั่วคราวต้องบันทึกผู้รับผิดชอบ/หมายเหตุได้ (21 ก.ย. 2569) ═══
 *
 * เจ้าของถาม: *"งานชั่วคราวมันแอดผู้รับผิดชอบไม่ได้หรอ ทำไมยังแอดไม่ได้ หรือบันทึกได้แล้วหาย"*
 *
 * ต้นเหตุ: ใบขอชั่วคราวอยู่คนละตาราง (`st_prequest_head`) และ `id` มี prefix `siamraj-pre:`
 * แต่หน้ารายละเอียดส่ง **`externalId` ซึ่งเป็นเลขเปล่า ๆ** ไปให้เส้นบันทึก
 * ⇒ `isPrequestId()` เป็น false ⇒ ไปหาในตารางใบขอจริง ⇒ ไม่เจอ ⇒ 404 "ไม่พบใบขอ"
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. หาในตารางใบขอจริงก่อนเสมอ (เลขเดียวกันอาจมีทั้งสองที่หลังแปลงเป็นใบจริง — ของจริงชนะ)
 * 2. ไม่เจอค่อยถอยไปหาที่ตารางใบชั่วคราว
 * 3. หน้าจอต้องแยก "บันทึกสำเร็จ" กับ "บันทึกล้ม" ด้วยสายตา — ของเดิมสีเทาเหมือนกันทั้งคู่
 *    ทำให้คนคิดว่าบันทึกแล้ว แล้วมาเจอทีหลังว่าไม่มีค่า
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('หาใบขอรายใบ', () => {
  const src = read('api/_lib/siamrajUnitRequests.ts');

  it('🔴 หาไม่เจอในตารางใบขอจริง ⇒ ถอยไปหาที่ตารางใบขอชั่วคราว', () => {
    expect(src).toMatch(/if \(!item && source === 'sqlserver' && !isPrequestId\(id\)\)/);
    expect(src).toContain('getSiamrajSqlServerPrequestById(normalizeLookupId(id))');
  });

  it('🔴 ลำดับต้องเป็น "ใบจริงก่อน" — ตัวถอยอยู่หลังการค้นปกติเสมอ', () => {
    const normalAt = src.indexOf('getSiamrajSqlServerUnitRequestById(normalizeLookupId(id)');
    const fallbackAt = src.indexOf("if (!item && source === 'sqlserver' && !isPrequestId(id))");
    expect(normalAt).toBeGreaterThan(0);
    expect(fallbackAt).toBeGreaterThan(normalAt);
  });
});

describe('หน้ารายละเอียดใบขอ', () => {
  const page = read('src/pages/jobs/SiamrajUnitRequestDetailPage.tsx');

  it('🔴 บันทึกล้มต้องขึ้นสีเตือน ไม่ใช่สีเทาเหมือนตอนสำเร็จ', () => {
    expect(page).toContain('setSaveFailed(true)');
    expect(page).toMatch(/saveFailed \? TONE\.danger\.value : TONE\.success\.value/);
  });

  it('ทุกครั้งที่เริ่มบันทึกใหม่ ต้องล้างธงล้มเหลวก่อน', () => {
    expect(page).toContain('setSaveFailed(false)');
  });
});

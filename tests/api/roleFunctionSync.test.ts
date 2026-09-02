// @vitest-environment node
/**
 * **สองรายชื่อฟังก์ชันต้องตรงกันเสมอ**
 *
 * ฝั่งจออยู่ที่ `src/lib/roleFunctions.ts` · ฝั่ง API อยู่ที่ `api/_lib/roleFunctionGrants.ts`
 * 🔴 เพิ่มฟังก์ชันใหม่แล้วลืมเติมฝั่ง API = **PATCH ถูกปฏิเสธเงียบ ๆ**
 * admin กดสวิตช์ในหน้าตั้งค่าแล้วเหมือนไม่มีอะไรเกิดขึ้น
 * (เจอจริง: `aftercare_read` ตกหล่นมานาน · เจอตอนเพิ่มฟังก์ชันช่องทาง 2 ก.ย. 2569)
 */
import { describe, expect, it } from 'vitest';
import { APP_FUNCTIONS } from '../../src/lib/roleFunctions';
import { FUNCTION_DEFAULT_MIN_ROLE } from '../../api/_lib/roleFunctionGrants';

describe('รายชื่อฟังก์ชันสองฝั่ง', () => {
  it('ฝั่งจอมีอะไร ฝั่ง API ต้องมีครบ', () => {
    const missing = APP_FUNCTIONS.map((f) => f.id).filter((id) => !(id in FUNCTION_DEFAULT_MIN_ROLE));
    expect(missing).toEqual([]);
  });

  it('ฝั่ง API มีอะไร ฝั่งจอต้องมีครบ (ไม่มีฟังก์ชันผีที่ตั้งค่าไม่ได้)', () => {
    const ids = new Set(APP_FUNCTIONS.map((f) => f.id as string));
    expect(Object.keys(FUNCTION_DEFAULT_MIN_ROLE).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('ระดับสิทธิ์ขั้นต่ำต้องตรงกันทุกตัว', () => {
    for (const fn of APP_FUNCTIONS) {
      expect([fn.id, FUNCTION_DEFAULT_MIN_ROLE[fn.id]]).toEqual([fn.id, fn.minimumRole]);
    }
  });
});

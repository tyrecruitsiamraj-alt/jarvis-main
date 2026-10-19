// @vitest-environment node
/**
 * วันเริ่มงานว่างเกือบทุกคน (4 จาก 206) — เจ้าของเคาะ "วันแจ้งเข้าใน ERP" (17 ต.ค. 2569)
 * วัดจริง: เจอวันแจ้งเข้า 135 จาก 257 เบอร์ที่ปิดงานติดตามแต่ไม่มีวันเริ่มงาน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { phoneLast9 } from '../../api/_lib/erpInformDates';

const read = (p: string) => readFileSync(p, 'utf8');

describe('หาวันแจ้งเข้าจาก ERP', () => {
  it('จับคู่ด้วยเบอร์ 9 ตัวท้าย (+66 / ขีด / ช่องว่าง ได้ค่าเดียวกัน)', () => {
    expect(phoneLast9('+66812345678')).toBe('812345678');
    expect(phoneLast9('081-234-5678')).toBe('812345678');
    expect(phoneLast9('12345')).toBeNull();
  });
  it('🔴 นับเฉพาะใบแจ้งเข้าที่ไม่ถูกยกเลิก และไม่เก่าเกิน 120 วัน · อ่านอย่างเดียว', () => {
    const src = read('api/_lib/erpInformDates.ts');
    expect(src).toContain("${activeInformWhereSql('IH')}");
    expect(src).toContain('DATEADD(day, -120');
    expect(src).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
    expect(read('api/_lib/rbac.ts')).toMatch(/case 'erp-inform-dates':[\s\S]*?return 'staff';/);
  });
});

describe('หน้าจอ', () => {
  it('ป๊อปย้ายไปดูแล: ไม่มีวันเริ่มงาน = เติมจาก ERP พร้อมป้าย · เปลี่ยนวันแล้วรอบแรกคิดใหม่ (ถ้ายังไม่แตะรอบ)', () => {
    const c = read('src/components/follow/FollowCompletedCard.tsx');
    expect(c).toContain('if (alive && d) changeStart(d, true);');
    // ฟอร์มรอบแยกเป็น MoveRoundsEditor (19 ต.ค. 2569 · ใช้ร่วมกับป๊อปตั้งรอบหน้าดูแล)
    const editor = read('src/components/follow/MoveRoundsEditor.tsx');
    expect(editor).toContain('วันแจ้งเข้าจาก ERP');
    expect(c).toContain('if (!roundsTouched) setRounds([firstMoveRoundFor(v || null, now())]);');
    expect(editor).toContain("{i === 0 ? 'ครบ' : 'ต่ออีก'}");
  });
  it('ดูแลหลังเริ่มงาน: ปุ่ม "ใช้วันแจ้งเข้า ERP" ให้คนกด · ไม่เขียนเอง', () => {
    const p = read('src/pages/aftercare/AftercarePage.tsx');
    expect(p).toContain('ใช้วันแจ้งเข้า ERP {formatYmdTh(erpInformDateOf(erpDates, p.phone_e164)!)}');
    expect(p).toContain('onClick={() => void saveStartDate(p.phone_e164, erpInformDateOf(erpDates, p.phone_e164)!)}');
  });
});

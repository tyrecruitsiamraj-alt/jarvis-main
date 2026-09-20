// @vitest-environment node
/**
 * ═══ วางแผนยาว ๆ แล้วเลือกรายวันว่า **ใครโทร** (เจ้าของสั่ง 20 ก.ย. 2569) ═══
 *
 * > *"ฉันต้องการให้ลงคิวยาว ๆ ได้ เช่น บอกว่าจะลงตั้งแต่ 1-7 วันที่ 1-3 กำหนดเองอะนะ
 * > ว่าจะโทรเองหรือส่ง lumos โทร และต้องวางแพลนยาวได้"*
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. วันที่เลือกว่า "เราโทรเอง" **ห้ามหลุดเข้าคิว AI** — หลุดเมื่อไหร่คนจริงโดนโทรซ้อน
 * 2. ไม่ส่ง `call_mode` มา = `ai` เหมือนเดิม (ของเก่าทุกเส้นต้องไม่เปลี่ยนพฤติกรรม)
 * 3. ค่าที่อ่านไม่ออก = **ปฏิเสธ** ห้ามเดาเป็น ai (เดาผิด = โทรหาคนจริงโดยไม่ตั้งใจ)
 */
import { describe, expect, it } from 'vitest';
import { parseFollowRounds, parseFollowInput } from '../../api/_handlers/follow.js';
import { FOLLOW_DISPATCH_META, isFollowDispatchState } from '../../src/lib/followDispatchState.js';

const base = {
  recipient_name: 'สมชาย ใจดี',
  recipient_phone: '0812345678',
  topic: 'ติดตามเริ่มงาน',
  scheduled_at: new Date(Date.now() + 3_600_000).toISOString(),
};

describe('อ่าน call_mode จากคำขอ', () => {
  it('ไม่ส่งมา ⇒ ai (ของเดิมไม่เปลี่ยนพฤติกรรม)', () => {
    const p = parseFollowInput(base);
    expect(p.error).toBeNull();
    expect(p.value?.callMode).toBe('ai');
  });

  it('ส่ง manual ⇒ manual', () => {
    expect(parseFollowInput({ ...base, call_mode: 'manual' }).value?.callMode).toBe('manual');
  });

  it('🔴 ค่าที่อ่านไม่ออก ⇒ ปฏิเสธ ไม่ใช่ปัดเป็น ai เงียบ ๆ', () => {
    const p = parseFollowInput({ ...base, call_mode: 'lumos' });
    expect(p.error).toMatch(/call_mode/);
    expect(p.value).toBeFalsy();
  });
});

describe('call_mode รายรอบ (rounds[])', () => {
  const primary = { when: new Date('2026-09-21T08:00:00+07:00'), staffPhone: null, callRound: 1 };

  it('ระบุรายรอบได้ — รอบไหนโทรเอง รอบนั้นเป็น manual', () => {
    const rounds = parseFollowRounds(
      {
        rounds: [
          { scheduled_at: '2026-09-21T08:00:00+07:00', call_mode: 'manual' },
          { scheduled_at: '2026-09-22T08:00:00+07:00', call_mode: 'ai' },
          { scheduled_at: '2026-09-23T08:00:00+07:00' },
        ],
      },
      primary,
    );
    expect(rounds.map((r) => r.callMode)).toEqual(['manual', 'ai', undefined]);
  });

  it('ค่าที่อ่านไม่ออกในรอบ ⇒ undefined (ตกไปใช้ค่าของทั้งคำขอ ไม่ใช่เดาเอง)', () => {
    const rounds = parseFollowRounds(
      { rounds: [{ scheduled_at: '2026-09-21T08:00:00+07:00', call_mode: 'ลูมอส' }] },
      primary,
    );
    expect(rounds[0].callMode).toBeUndefined();
  });
});

describe('สถานะ "เจ้าหน้าที่โทรเอง" บนจอ', () => {
  it('เป็นสถานะที่ระบบรู้จัก', () => {
    expect(isFollowDispatchState('manual')).toBe(true);
  });

  it('🔴 ไม่ใช่งานค้าง — ห้ามขึ้นเตือนแดงเหมือนสายที่ส่งไม่สำเร็จ', () => {
    expect(FOLLOW_DISPATCH_META.manual.needsAction).toBe(false);
    expect(FOLLOW_DISPATCH_META.off.needsAction).toBe(true);
  });
});

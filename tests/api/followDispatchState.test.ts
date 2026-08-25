// @vitest-environment node
/**
 * สถานะ "ส่งให้ AI โทรหรือยัง" ของรายการติดตาม
 *
 * 🔴 ด่านที่ห้ามหลุด (มาจากของจริง 24 ส.ค. 2569 ที่งานหายเงียบ):
 * 1. ไม่มีแถวในคิว + ไม่มีบันทึกเหตุผล = **ต้องบอกว่าไม่ได้ส่ง** ห้ามเงียบ ห้ามเดาว่าส่งแล้ว
 * 2. "กันไว้ก่อนเพราะตรวจไม่ได้" ต้องแยกจาก "มีคนจองเบอร์" — อันแรกกดส่งใหม่ได้ อันหลังไม่ได้
 * 3. สถานะสดของคิวชนะเหตุผลตอนส่งเสมอ (คิวเดินต่อได้หลังส่ง)
 */
import { describe, expect, it } from 'vitest';
import {
  FOLLOW_DISPATCH_META,
  FOLLOW_DISPATCH_STATES,
  followDispatchLabel,
  isFollowDispatchState,
  summarizeDispatchResults,
} from '../../src/lib/followDispatchState.js';

describe('followDispatchLabel', () => {
  it('🔴 ไม่มีคิว + ไม่มีบันทึก = บอกว่าไม่ได้ส่ง และต้องมีคนลงมือ', () => {
    const m = followDispatchLabel({ state: null, callStatus: null });
    expect(m.label).toContain('ไม่ได้ส่ง');
    expect(m.needsAction).toBe(true);
  });

  it('🔴 "ตรวจไม่ได้" ต่างจาก "มีคนจองเบอร์" — อันแรกลองใหม่ได้', () => {
    expect(FOLLOW_DISPATCH_META.guarded.retryable).toBe(true);
    expect(FOLLOW_DISPATCH_META.held.retryable).toBe(false);
    expect(FOLLOW_DISPATCH_META.guarded.label).not.toBe(FOLLOW_DISPATCH_META.held.label);
  });

  it('มีคนจองเบอร์ = ไม่ต้องมีใครลงมือ (ระบบทำถูกแล้ว)', () => {
    expect(followDispatchLabel({ state: 'held', callStatus: null }).needsAction).toBe(false);
  });

  it('สถานะสดของคิวชนะเหตุผลตอนส่ง', () => {
    // เคยกันไว้ แต่ต่อมาส่งเข้าคิวได้แล้ว → ต้องอ่านว่ากำลังโทร ไม่ใช่ค้างอยู่
    const m = followDispatchLabel({ state: 'guarded', callStatus: 'delivered' });
    expect(m.needsAction).toBe(false);
    expect(m.label).toContain('AI');
  });

  it('อยู่ในคิวแล้ว = ไม่ต้องเตือน', () => {
    expect(followDispatchLabel({ state: 'queued', callStatus: 'pending' }).needsAction).toBe(false);
  });

  it('ยกเลิกแล้ว = ไม่ใช่ของค้าง', () => {
    expect(followDispatchLabel({ state: 'queued', callStatus: 'cancelled' }).needsAction).toBe(false);
  });

  it('ค่าเพี้ยนจากฐานไม่ทำให้พัง — ตกไปที่ "ไม่ได้ส่ง"', () => {
    expect(followDispatchLabel({ state: 'ค่ามั่ว', callStatus: null }).needsAction).toBe(true);
    expect(isFollowDispatchState('ค่ามั่ว')).toBe(false);
  });

  it('ทุกสถานะมีคำไทยและคำอธิบายครบ', () => {
    for (const s of FOLLOW_DISPATCH_STATES) {
      expect(FOLLOW_DISPATCH_META[s].label.length).toBeGreaterThan(0);
      expect(FOLLOW_DISPATCH_META[s].hint.length).toBeGreaterThan(0);
    }
  });
});

describe('summarizeDispatchResults', () => {
  it('เข้าคิวครบ = ไม่ต้องเตือน', () => {
    expect(summarizeDispatchResults(['queued', 'queued'])).toBeNull();
  });

  it('ไม่เข้าบางรายการ = บอกว่ากี่จากกี่', () => {
    const r = summarizeDispatchResults(['queued', 'guarded'])!;
    expect(r.text).toContain('1 จาก 2');
    expect(r.retryable).toBe(true);
  });

  it('ไม่เข้าทั้งหมด = บอกว่าทั้งหมด', () => {
    const r = summarizeDispatchResults(['guarded', 'guarded'])!;
    expect(r.text).toContain('ทั้งหมด');
  });

  it('เหตุผลซ้ำกันยุบเป็นบรรทัดเดียว ไม่พ่นซ้ำทุกแถว', () => {
    const r = summarizeDispatchResults(['guarded', 'guarded', 'guarded'])!;
    expect(r.text.match(/ระบบตรวจไม่ได้/g)).toHaveLength(1);
  });

  it('มีตัวที่ลองใหม่ไม่ได้ปน = ไม่บอกว่าลองใหม่ได้', () => {
    expect(summarizeDispatchResults(['guarded', 'suppressed'])!.retryable).toBe(false);
  });

  it('"มีคนจองเบอร์" ไม่นับเป็นของค้าง (ระบบทำถูก)', () => {
    expect(summarizeDispatchResults(['held'])).toBeNull();
  });
});

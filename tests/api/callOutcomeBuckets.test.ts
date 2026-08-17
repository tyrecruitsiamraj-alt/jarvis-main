// @vitest-environment node
/**
 * ถังผลโทร — นิยามกลางที่ฝั่ง API (นับใน SQL) และหน้าเว็บ (จัดกลุ่มรายชื่อ) ใช้ร่วมกัน
 *
 * ทำไมต้องมีเทสต์: แผงหน้าหลักโชว์**ยอด**จาก funnel แต่ตอนกดดู**รายชื่อ**จัดกลุ่มฝั่งหน้าเว็บ
 * สองฝั่งเพี้ยนกันเมื่อไหร่ = "ยอดบอก 5 แต่กดเข้าไปเห็น 3" โดยไม่มีอะไรเตือน
 */
import { describe, expect, it } from 'vitest';
import {
  bucketOfCall,
  callAttemptSlot,
  CONNECTED_CALL_OUTCOMES,
  UNREACHED_CALL_OUTCOMES,
} from '../../src/lib/callOutcomeBuckets';

describe('ถังผลโทร', () => {
  it('🔴 "ปฏิเสธ" อยู่ถังโทรติด — คุยกับคนได้แล้วถือว่าติดต่อถึงตัว', () => {
    expect(bucketOfCall('completed', 'declined')).toBe('connected');
    expect([...CONNECTED_CALL_OUTCOMES]).toContain('declined');
  });

  it('ผลที่แปลว่าคุยได้ = โทรติดทุกตัว', () => {
    for (const o of CONNECTED_CALL_OUTCOMES) expect(bucketOfCall('completed', o)).toBe('connected');
  });

  it('ผลที่แปลว่าสายไม่ถึงตัว = ไม่ติดทุกตัว', () => {
    for (const o of UNREACHED_CALL_OUTCOMES) expect(bucketOfCall('delivered', o)).toBe('unreached');
  });

  it('🔴 ยกเลิกต้องตัดสินก่อนผลเสมอ — ไม่งั้นแถวที่ตายแล้วไปโป่งอยู่ถัง "รอโทร"', () => {
    expect(bucketOfCall('cancelled', null)).toBe('cancelled');
    expect(bucketOfCall('cancelled', 'confirmed')).toBe('cancelled');
    expect(bucketOfCall('pending', 'cancelled')).toBe('cancelled');
  });

  it('ยังไม่มีผล = รอโทร', () => {
    expect(bucketOfCall('pending', null)).toBe('pending');
    expect(bucketOfCall('delivered', '')).toBe('pending');
    expect(bucketOfCall(null, undefined)).toBe('pending');
  });

  it('🔴 ผลที่ไม่รู้จัก = ยังไม่ตัดสิน ห้ามเดาให้ตกถังใดถังหนึ่ง', () => {
    expect(bucketOfCall('completed', 'ผลแปลก ๆ')).toBe('pending');
  });
});

describe('รอบที่โทร', () => {
  it('เกิน 3 รวบเป็น 3 (กติกาเดียวกับฝั่ง SQL)', () => {
    expect(callAttemptSlot(4)).toBe(3);
    expect(callAttemptSlot(99)).toBe(3);
  });

  it('ไม่มีค่า/ค่าเพี้ยน = รอบ 1', () => {
    expect(callAttemptSlot(null)).toBe(1);
    expect(callAttemptSlot(undefined)).toBe(1);
    expect(callAttemptSlot(0)).toBe(1);
    expect(callAttemptSlot(-5)).toBe(1);
    expect(callAttemptSlot(Number.NaN)).toBe(1);
  });

  it('รอบปกติผ่านตรง ๆ', () => {
    expect(callAttemptSlot(1)).toBe(1);
    expect(callAttemptSlot(2)).toBe(2);
    expect(callAttemptSlot(3)).toBe(3);
  });
});

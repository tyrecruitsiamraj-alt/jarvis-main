// @vitest-environment node
/**
 * กติกาของตัวส่งซ้ำไปหา Lumos (เจ้าของสั่ง 11 ก.ย. 2569:
 * *"ต้องการแค่เพิ่มแล้วต้องไปโผล่ที่ lumos ถ้าผิดที่เราก็แก้ดิ"*)
 *
 * 🔴 ด่านที่ห้ามหลุด: **ห้ามส่งซ้ำไม่จำกัด** — สายติดตามถามว่า "ไปทำงานหรือยัง"
 * โทรช้าครึ่งชั่วโมงยังมีความหมาย โทรช้าครึ่งวันคือไปกวนเขาเปล่า ๆ
 */
import { describe, expect, it } from 'vitest';
import {
  FOLLOW_PUSH_RETRY_DEFAULTS,
  readFollowPushRetryConfig,
  shouldRetryFollowPush,
} from '../../src/lib/followPushRetryPolicy.js';

const NOW = new Date('2026-09-11T10:00:00+07:00');
const cfg = FOLLOW_PUSH_RETRY_DEFAULTS;

describe('readFollowPushRetryConfig', () => {
  it('🔴 ไม่ตั้งค่าอะไรเลย = **เปิด** (เจ้าของอยากให้มันไปถึงเอง ไม่ต้องมาเปิดเอง)', () => {
    expect(readFollowPushRetryConfig({}).enabled).toBe(true);
  });

  it('ปิดได้ด้วย FOLLOW_PUSH_RETRY_ENABLED=false', () => {
    for (const v of ['false', '0', 'off', 'no', 'FALSE'])
      expect(readFollowPushRetryConfig({ FOLLOW_PUSH_RETRY_ENABLED: v }).enabled).toBe(false);
  });

  it('พิมพ์ค่ามั่ว ⇒ ใช้ค่าเริ่มต้น ไม่ใช่ปิดเงียบ', () => {
    expect(readFollowPushRetryConfig({ FOLLOW_PUSH_RETRY_ENABLED: 'อืม' }).enabled).toBe(true);
    expect(readFollowPushRetryConfig({ FOLLOW_PUSH_RETRY_INTERVAL_MS: 'เร็ว ๆ' }).intervalMs).toBe(
      cfg.intervalMs,
    );
  });

  it('ตัวเลขถูกบีบให้อยู่ในช่วงที่ปลอดภัย', () => {
    expect(readFollowPushRetryConfig({ FOLLOW_PUSH_RETRY_INTERVAL_MS: '1' }).intervalMs).toBe(10_000);
    expect(readFollowPushRetryConfig({ FOLLOW_PUSH_RETRY_LIMIT: '99999' }).limit).toBe(200);
    expect(readFollowPushRetryConfig({ FOLLOW_PUSH_RETRY_MAX_LATE_MIN: '-5' }).maxLateMinutes).toBe(0);
  });
});

describe('shouldRetryFollowPush', () => {
  const at = (iso: string) => ({ id: 'x', scheduledAt: iso });

  it('ยังไม่ถึงเวลานัด ⇒ ส่งซ้ำแน่นอน', () => {
    expect(shouldRetryFollowPush(at('2026-09-11T10:30:00+07:00'), cfg, NOW)).toBe(true);
  });

  it('เลยเวลามาแล้วแต่ยังไม่เกินเพดาน ⇒ ส่งซ้ำ', () => {
    expect(shouldRetryFollowPush(at('2026-09-11T09:00:00+07:00'), cfg, NOW)).toBe(true);
  });

  it('🔴 เลยเพดาน (2 ชม.) ⇒ **เลิกส่ง** ปล่อยให้คนตัดสินใจเอง', () => {
    expect(shouldRetryFollowPush(at('2026-09-11T07:30:00+07:00'), cfg, NOW)).toBe(false);
  });

  it('ตรงเพดานพอดียังส่ง — เส้นแบ่งอยู่ที่ "เกิน" ไม่ใช่ "ถึง"', () => {
    expect(shouldRetryFollowPush(at('2026-09-11T08:00:00+07:00'), cfg, NOW)).toBe(true);
  });

  it('ไม่มีเวลานัด/เวลาอ่านไม่ออก ⇒ ส่งซ้ำ (ให้ถึง Lumos ไว้ก่อนดีกว่าทิ้ง)', () => {
    expect(shouldRetryFollowPush({ id: 'x', scheduledAt: null }, cfg, NOW)).toBe(true);
    expect(shouldRetryFollowPush({ id: 'x', scheduledAt: 'พรุ่งนี้' }, cfg, NOW)).toBe(true);
  });

  it('ตั้งเพดานเป็น 0 ⇒ ส่งซ้ำเฉพาะที่ยังไม่ถึงเวลานัด', () => {
    const strict = { ...cfg, maxLateMinutes: 0 };
    expect(shouldRetryFollowPush(at('2026-09-11T10:30:00+07:00'), strict, NOW)).toBe(true);
    expect(shouldRetryFollowPush(at('2026-09-11T09:59:00+07:00'), strict, NOW)).toBe(false);
  });
});

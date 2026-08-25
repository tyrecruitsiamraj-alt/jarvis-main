// @vitest-environment node
/**
 * ป๊อปเตือนหัวหน้าเรื่องชื่อที่ถูกถอด (Phase 5.8)
 *
 * ด่าน: เด้ง **เฉพาะที่ยังไม่อ่าน** และเฉพาะ role หัวหน้า — ไม่งั้นกลายเป็นป๊อปที่เด้ง
 * ทุกครั้งที่เปลี่ยนหน้า ซึ่งคนจะปิดทิ้งโดยไม่อ่าน (แล้วของจริงก็ไม่มีใครทำ)
 */
import { describe, expect, it } from 'vitest';
import {
  CLAIM_IDLE_NOTIFICATION_TYPE,
  pickClaimIdleAlert,
  shouldSeeClaimIdleAlert,
} from '../../src/lib/claimIdleAlert.js';

const n = (over: Partial<{ id: string; type: string; read: boolean }>) => ({
  id: 'srv-1',
  type: CLAIM_IDLE_NOTIFICATION_TYPE,
  title: 'ถอดชื่อที่เก็บไว้แล้วไม่โทร 3 ใบ',
  message: 'คิว 2 ใบ · กร 1 ใบ',
  read: false,
  ...over,
});

describe('ใครเห็นป๊อปนี้', () => {
  it('หัวหน้า (admin/supervisor) เห็น', () => {
    expect(shouldSeeClaimIdleAlert('admin')).toBe(true);
    expect(shouldSeeClaimIdleAlert('supervisor')).toBe(true);
  });

  it('staff/opl ไม่เห็น (เป็นเรื่องที่หัวหน้าต้องตาม ไม่ใช่ป๊อปกวนทุกคน)', () => {
    expect(shouldSeeClaimIdleAlert('staff')).toBe(false);
    expect(shouldSeeClaimIdleAlert('opl')).toBe(false);
    expect(shouldSeeClaimIdleAlert(null)).toBe(false);
    expect(shouldSeeClaimIdleAlert(undefined)).toBe(false);
  });
});

describe('เลือกใบที่จะเด้ง', () => {
  it('เด้งใบที่ยังไม่อ่านของชนิดนี้', () => {
    expect(pickClaimIdleAlert([n({})])?.id).toBe('srv-1');
  });

  it('อ่านแล้ว = ไม่เด้ง (กดปิดครั้งเดียวจบ)', () => {
    expect(pickClaimIdleAlert([n({ read: true })])).toBeNull();
  });

  it('ชนิดอื่นไม่เด้ง', () => {
    expect(pickClaimIdleAlert([n({ type: 'new_job' })])).toBeNull();
  });

  it('ใบใหม่สุดของชนิดนี้ชนะ (ลิสต์เรียงใหม่มาก่อนอยู่แล้ว)', () => {
    const picked = pickClaimIdleAlert([
      n({ id: 'srv-9', read: true }),
      n({ id: 'srv-8' }),
      n({ id: 'srv-7' }),
    ]);
    expect(picked?.id).toBe('srv-8');
  });

  it('กล่องว่าง = ไม่เด้ง', () => {
    expect(pickClaimIdleAlert([])).toBeNull();
  });
});

describe('ชนิดแจ้งเตือนต้องตรงกับที่ worker สร้าง', () => {
  it('worker ใช้ type เดียวกับที่ฝั่งจอรอฟัง (ไม่งั้นป๊อปไม่เด้งเลย)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../api/_lib/callChoiceWorker.ts', import.meta.url), 'utf8');
    expect(src).toContain(`type: '${CLAIM_IDLE_NOTIFICATION_TYPE}'`);
  });
});

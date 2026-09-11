// @vitest-environment node
/**
 * `errorSummaryText` — จดเหตุที่ push ล้มให้อ่านออก (เจ้าของถาม 11 ก.ย. 2569:
 * *"อยากรู้ว่าเพราะอะไร เพราะมันเป็นบ่อยแล้ว"*)
 *
 * 🔴 ด่านหลัก: `fetch()` ของ Node โยน `TypeError: fetch failed` เสมอ เหตุจริงอยู่ใน
 * `.cause` — จดแค่ `message` ลงฐานจะได้คำว่า "fetch failed" เปล่า ๆ ไล่ต้นเหตุไม่ได้
 */
import { describe, expect, it } from 'vitest';
import { errorSummaryText } from '../../api/_lib/logger.js';

describe('errorSummaryText', () => {
  it('🔴 คลี่ .cause ออกมา — ไม่ใช่ "fetch failed" เปล่า ๆ', () => {
    const cause = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    const err = new TypeError('fetch failed', { cause });
    const text = errorSummaryText(err);
    expect(text).toContain('fetch failed');
    expect(text).toContain('ECONNRESET');
  });

  it('คลี่ AggregateError (บาง network stack ห่อไว้อีกชั้น)', () => {
    const inner = Object.assign(new Error('connect ETIMEDOUT 10.0.0.1:443'), { code: 'ETIMEDOUT' });
    const agg = new AggregateError([inner], 'all connections failed');
    const text = errorSummaryText(new TypeError('fetch failed', { cause: agg }));
    expect(text).toContain('ETIMEDOUT');
  });

  it('ข้อความที่ Lumos ตอบกลับ (4xx/5xx) ผ่านมาตรง ๆ', () => {
    expect(errorSummaryText(new Error('Lumos push reminders ล้มเหลว: HTTP 429'))).toContain('429');
  });

  it('ไม่พูดซ้ำเมื่อ cause ซ้ำกับชั้นนอก', () => {
    const e = new Error('เหมือนกัน', { cause: new Error('เหมือนกัน') });
    expect(errorSummaryText(e)).toBe('เหมือนกัน');
  });

  it('ตัดความยาวตามที่กำหนด (คอลัมน์นี้ขึ้นจอ ห้ามยาวเป็นหน้า)', () => {
    expect(errorSummaryText(new Error('ก'.repeat(500)), 50)).toHaveLength(50);
  });

  it('ค่าที่ไม่ใช่ Error ก็ต้องได้ข้อความ ไม่ใช่ [object Object]', () => {
    expect(errorSummaryText('พังเฉย ๆ')).toBe('พังเฉย ๆ');
    expect(errorSummaryText(null)).toBe('');
  });

  it('กันวนไม่รู้จบเมื่อ cause อ้างตัวเอง', () => {
    const e = new Error('วน') as Error & { cause?: unknown };
    e.cause = e;
    expect(() => errorSummaryText(e)).not.toThrow();
  });
});

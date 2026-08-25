// @vitest-environment node
/**
 * สรุปผล "เก็บไปโทรเอง / ส่ง AI โทร" — ด่านสำคัญข้อเดียว:
 * **ทำไม่ได้ต้องเห็นบนจอ** · เคสอันตรายสุดคือเก็บใบสำเร็จแต่ล็อกเบอร์ไม่ได้
 * (= AI ยังโทรทับได้) ถ้าข้อความบอกแค่ "สำเร็จ N คน" คนจะเข้าใจผิดว่าปลอดภัย
 */
import { describe, expect, it } from 'vitest';
import { summarizeCallChoice } from '../../src/lib/callChoiceSummary.js';

describe('summarizeCallChoice', () => {
  it('เก็บไปโทรเองสำเร็จหมด — บอกว่าล็อกเบอร์กัน AI แล้ว', () => {
    const s = summarizeCallChoice({ choice: 'manual', done: 3, skipped: [] });
    expect(s).toContain('เก็บไปโทรเอง 3 คน');
    expect(s).toContain('กัน AI โทรทับ');
  });

  it('ส่ง AI สำเร็จ — บอกว่าเข้าคิวแล้ว (ไม่ใช่ "โทรแล้ว")', () => {
    const s = summarizeCallChoice({ choice: 'ai', done: 2, skipped: [] });
    expect(s).toContain('ส่ง AI โทร 2 คน');
    expect(s).toContain('เข้าคิว');
    expect(s).not.toContain('โทรทับ');
  });

  it('ทำไม่ได้เลย ต้องไม่ขึ้นว่าสำเร็จ', () => {
    const s = summarizeCallChoice({
      choice: 'manual',
      done: 0,
      skipped: [{ name: 'ก', reason: 'มีเจ้าหน้าที่คนอื่นเก็บไปแล้ว' }],
    });
    expect(s).toContain('ยังเก็บไปโทรเองไม่ได้เลย');
    expect(s).toContain('มีเจ้าหน้าที่คนอื่นเก็บไปแล้ว');
  });

  it('🔴 เก็บได้แต่ล็อกเบอร์ไม่ได้ ต้องเห็นเหตุผลนั้นในข้อความ', () => {
    const s = summarizeCallChoice({
      choice: 'manual',
      done: 2,
      skipped: [{ name: 'ข', reason: 'เก็บใบแล้ว แต่ไม่มีเบอร์ให้ล็อก — AI อาจโทรทับได้' }],
    });
    expect(s).toContain('ข้าม 1 คน');
    expect(s).toContain('AI อาจโทรทับได้');
    expect(s).toContain('ข:');
  });

  it('เหตุผลเดียวกันหลายคน จัดกลุ่มแล้วยุบชื่อที่เกิน 3', () => {
    const s = summarizeCallChoice({
      choice: 'ai',
      done: 0,
      skipped: ['a', 'b', 'c', 'd', 'e'].map((n) => ({ name: n, reason: 'ไม่มีเบอร์โทร' })),
    });
    expect(s).toContain('ข้าม 5 คน');
    expect(s).toContain('และอีก 2 คน');
    // เหตุผลต้องพิมพ์ครั้งเดียว ไม่ใช่ห้ารอบ
    expect(s.match(/ไม่มีเบอร์โทร/g)).toHaveLength(1);
  });
});

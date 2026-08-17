// @vitest-environment node
/**
 * Parity: `toE164Thai()` (TS — api/_lib/thaiPhone.ts) ↔ `jarvis_phone_e164_thai()` (SQL —
 * migration 087 generated column บน public_job_applications)
 *
 * thaiPhone.ts ห้ามก๊อปสูตรไปที่อื่น — migration 087 คือข้อยกเว้นเดียว (generated column
 * ต้องเป็น SQL ล้วน) จึงต้องมีเทสต์นี้ล็อกว่าให้ผลตรงกันทุกเคส · แก้สูตรฝั่งไหนต้อง
 * แก้อีกฝั่งแล้วเทสต์นี้ต้องผ่าน ไม่งั้นกล่อง "เบอร์โทรผิด" บน dashboard จะนับคนละชุด
 * กับที่ระบบโทรใช้จริง (ผิดเงียบ ๆ ไม่มี error)
 *
 * ฝั่ง SQL รันเฉพาะเมื่อมี DATABASE_URL (แพตเทิร์นเดียวกับ db-integration.test.ts)
 * — เรียก function ล้วน ๆ ไม่แตะข้อมูลตารางใด ๆ
 */
import { describe, expect, it } from 'vitest';
import { toE164Thai } from '../../api/_lib/thaiPhone.js';

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

/** fixture ชุดเดียว ใช้ทั้งสองฝั่ง — ครอบทุก branch: 66+, 0+, 9 หลัก, ขยะ, ว่าง */
const FIXTURES: Array<{ raw: string; expected: string | null }> = [
  { raw: '0812345678', expected: '+66812345678' }, // มือถือ 10 หลัก
  { raw: '081-234-5678', expected: '+66812345678' }, // มีขีด
  { raw: '081 234 5678', expected: '+66812345678' }, // มีช่องว่าง
  { raw: '66812345678', expected: '+66812345678' }, // ขึ้น 66 รวม 11 หลัก
  { raw: '+66812345678', expected: '+66812345678' }, // มี + มาแล้ว
  { raw: '021234567', expected: null }, // เบอร์บ้าน 9 หลัก — จุดที่เคยตายเงียบ
  { raw: '02-123-4567', expected: null },
  { raw: '08123456789', expected: null }, // 11 หลักขึ้น 0
  { raw: '812345678', expected: null }, // ไม่ขึ้น 0/66
  { raw: '6681234567', expected: null }, // 66 แต่ 10 หลัก
  { raw: 'abcdefghij', expected: null }, // ไม่มีตัวเลขเลย
  { raw: '', expected: null },
  { raw: '  0812345678  ', expected: '+66812345678' }, // มีช่องว่างรอบ
];

describe('toE164Thai (TS) — fixture อ้างอิง', () => {
  for (const f of FIXTURES) {
    it(`'${f.raw}' → ${f.expected ?? 'null'}`, () => {
      expect(toE164Thai(f.raw)).toBe(f.expected);
    });
  }
  it('null/undefined → null', () => {
    expect(toE164Thai(null)).toBeNull();
    expect(toE164Thai(undefined)).toBeNull();
  });
});

describe.skipIf(!hasDb)('jarvis_phone_e164_thai (SQL · migration 087) — ต้องเท่ากับ TS ทุกเคส', () => {
  it('fixture ทุกตัวให้ผลตรงกับ toE164Thai', async () => {
    const { dbQuery } = await import('../../api/_lib/postgres.js');
    // เรียก function ล้วน ไม่แตะตาราง — ปลอดภัยบนฐาน production
    const { rows } = await dbQuery<{ raw: string; sql_result: string | null }>(
      `select raw, jarvis_phone_e164_thai(raw) as sql_result
         from unnest($1::text[]) as raw`,
      [FIXTURES.map((f) => f.raw)],
    );
    expect(rows.length).toBe(FIXTURES.length);
    for (const row of rows) {
      const expected = toE164Thai(row.raw);
      expect(`${JSON.stringify(row.raw)} → ${row.sql_result}`).toBe(
        `${JSON.stringify(row.raw)} → ${expected}`,
      );
    }
  });

  it('null → null (returns null on null input)', async () => {
    const { dbQuery } = await import('../../api/_lib/postgres.js');
    const { rows } = await dbQuery<{ r: string | null }>(
      `select jarvis_phone_e164_thai(null) as r`,
    );
    expect(rows[0]?.r).toBeNull();
  });
});

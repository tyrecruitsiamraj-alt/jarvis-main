// @vitest-environment node
/**
 * ตัวจับคู่ "ของฝั่งเรา ↔ ใบขอจาก ERP" ที่ id ไม่ตรงกัน (`siamraj-pre:` vs `siamraj-sql:`)
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. จับคู่ได้ **สองทาง** (ปล่อยด้วย sql: แล้ว feed ส่ง pre: และกลับกัน)
 * 2. **ห้าม over-match** — `LBM690800` ต้องไม่แมตช์ `LBM6908001` (ห้ามใช้ includes/endsWith)
 * 3. 🔴 **เลขที่ใบซ้ำข้ามบริษัท 23 ใบในฐานจริง** → เลขที่ที่ชี้ได้หลายใบต้อง **ไม่จับคู่**
 *    (ยอมพลาดดีกว่าเอาข้อมูลของอีกบริษัทมาแปะ) · เลขที่เป็นทางถอย ไม่ใช่คีย์หลัก
 */
import { describe, expect, it } from 'vitest';
import {
  buildCountIndex,
  buildJobKeyIndex,
  countFor,
  requestNoOf,
} from '../../src/lib/jobKeyIndex.js';

const PRE = 'siamraj-pre:LBM6908001';
const SQL = 'siamraj-sql:LBM6908001';

describe('requestNoOf', () => {
  it('ตัด prefix ได้ทุกแบบ · ไม่มี prefix คืนค่าเดิม', () => {
    expect(requestNoOf(SQL)).toBe('LBM6908001');
    expect(requestNoOf(PRE)).toBe('LBM6908001');
    expect(requestNoOf('siamraj:123')).toBe('123');
    expect(requestNoOf('LBM6908001')).toBe('LBM6908001');
  });
});

describe('จับคู่สองทาง (หัวใจของบั๊ก)', () => {
  it('เก็บด้วย sql: แล้วถามด้วย pre: ต้องเจอ', () => {
    const idx = buildJobKeyIndex([[SQL, 'ประกาศ ก']]);
    expect(idx.get(PRE)).toBe('ประกาศ ก');
    expect(idx.has(PRE)).toBe(true);
  });

  it('เก็บด้วย pre: แล้วถามด้วย sql: ต้องเจอ (กลับด้าน)', () => {
    const idx = buildJobKeyIndex([[PRE, 'ประกาศ ข']]);
    expect(idx.get(SQL)).toBe('ประกาศ ข');
  });

  it('id เต็มตรงกันชนะก่อนเสมอ (คีย์หลักคือ id เต็ม)', () => {
    const idx = buildJobKeyIndex([
      [SQL, 'ของใบจริง'],
      ['siamraj-sql:OTHER1', 'อื่น'],
    ]);
    expect(idx.get(SQL)).toBe('ของใบจริง');
  });

  it('ไม่รู้จักเลย = undefined (ไม่เดา)', () => {
    const idx = buildJobKeyIndex([[SQL, 1]]);
    expect(idx.get('siamraj-sql:ZZZ9999999')).toBeUndefined();
    expect(idx.has('siamraj-sql:ZZZ9999999')).toBe(false);
  });
});

describe('ห้าม over-match', () => {
  it('เลขที่สั้นกว่าต้องไม่แมตช์เลขที่ยาวกว่า', () => {
    const idx = buildJobKeyIndex([['siamraj-sql:LBM6908001', 'ใบเต็ม']]);
    expect(idx.get('siamraj-pre:LBM690800')).toBeUndefined();
    expect(idx.get('siamraj-pre:LBM69080011')).toBeUndefined();
  });

  it('id ว่าง/null ถูกข้าม ไม่กลายเป็นคีย์ว่าง', () => {
    const idx = buildJobKeyIndex([
      [null, 'ก'],
      [undefined, 'ข'],
      ['   ', 'ค'],
      [SQL, 'ง'],
    ]);
    expect(idx.size).toBe(1);
    expect(idx.get('')).toBeUndefined();
    expect(idx.get(PRE)).toBe('ง');
  });
});

describe('🔴 เลขที่ใบซ้ำข้ามบริษัท — ไม่จับคู่ (ambiguous)', () => {
  it('เลขที่เดียวกันมาจากสองใบ → ถามด้วย id ที่ไม่มีในชุด ต้องไม่ได้ของใครเลย', () => {
    // ของจริง: LBM6908001 เป็นทั้งใบล่วงหน้า (อีซูซุ) และใบปกติ (ชับบ์ ไลฟ์)
    const idx = buildJobKeyIndex([
      [SQL, 'ชับบ์ ไลฟ์'],
      [PRE, 'อีซูซุมอเตอร์'],
    ]);
    // ถามด้วย id เต็มยังตอบถูกทั้งคู่ (คีย์หลักไม่กำกวม)
    expect(idx.get(SQL)).toBe('ชับบ์ ไลฟ์');
    expect(idx.get(PRE)).toBe('อีซูซุมอเตอร์');
    // แต่ prefix ที่สาม (เส้น pg เก่า) ต้อง **ไม่ถูกเดา** ให้เป็นของใครคนหนึ่ง
    expect(idx.get('siamraj:LBM6908001')).toBeUndefined();
  });

  it('ใบเดียวหลาย entry ไม่ใช่ ambiguous — ต้องยัง match ข้าม prefix ได้', () => {
    const idx = buildJobKeyIndex(
      [
        [SQL, 2],
        [SQL, 3],
      ],
      (a, b) => a + b,
    );
    expect(idx.get(SQL)).toBe(5);
    expect(idx.get(PRE)).toBe(5);
  });
});

describe('merge', () => {
  it('ไม่ส่ง merge = ตัวแรกชนะ (ใช้กับ "ประกาศล่าสุด" ที่ API เรียงมาแล้ว)', () => {
    const idx = buildJobKeyIndex([
      [SQL, 'ล่าสุด'],
      [SQL, 'เก่ากว่า'],
    ]);
    expect(idx.get(SQL)).toBe('ล่าสุด');
  });

  it('ส่ง merge = รวมค่า (ใช้กับยอดคลิก/ช่องทางที่ต้องต่อกัน)', () => {
    const idx = buildJobKeyIndex<string[]>(
      [
        [SQL, ['facebook']],
        [SQL, ['tiktok']],
      ],
      (a, b) => [...a, ...b],
    );
    expect(idx.get(PRE)).toEqual(['facebook', 'tiktok']);
  });
});

describe('buildCountIndex / countFor', () => {
  it('ยอดจาก API (คีย์ sql:) อ่านด้วย id ใบล่วงหน้าได้', () => {
    const idx = buildCountIndex({ [SQL]: 4 });
    expect(countFor(idx, PRE)).toBe(4);
    expect(countFor(idx, SQL)).toBe(4);
  });

  it('ไม่มีค่า = 0 (ไม่ใช่ undefined หลุดไปบวกเลข)', () => {
    expect(countFor(buildCountIndex({}), SQL)).toBe(0);
  });
});

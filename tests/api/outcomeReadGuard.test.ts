// @vitest-environment node
/**
 * กับดักเดียวที่โปรเจกต์นี้โดนซ้ำ **3 รอบ**: อ่านผลโทรจาก `result->>'outcome'` ทางเดียว
 *
 * ทำไมมันพลาดซ้ำ ๆ: คอลัมน์ `last_outcome` เพิ่งมาตอน migration 070 · ผลที่ **คน**
 * บันทึกเขียนแค่ `last_outcome` ไม่แตะ `result` · และตอนตั้งโทรซ้ำ `applyCallFollowup`
 * **ล้าง `result` ทิ้ง** เพื่อให้ `takePendingLumosItems` หยิบแถวนั้นอีกรอบ
 * → อ่าน `result` ทางเดียวจะเห็นเป็น "ยังไม่มีผล" โดยไม่มี error ไม่มี log
 *
 * รอบที่โดนมาแล้ว:
 *   1. funnel หน้า Follow — โชว์ "มีผลกลับ 458 แต่โทรติด 0" (ดูเหมือนพัง)
 *   2. แถบตัวเลขต่อใบขอในหน้า Matching — ผลที่คนบันทึกหายเงียบ
 *   3. `listLumosCallStatusForJob` — หน้า Matching ใช้ค่านี้ตัดสินว่าจะซ่อนคนที่
 *      ปฏิเสธงานนี้ อ่านพลาด = เอาคนที่ปฏิเสธไปแล้วกลับมาเสนอใหม่ (แก้ 11 ส.ค. 2569)
 *
 * เทสต์นี้อ่านซอร์สตรง ๆ เพราะเป็นด่านเดียวที่จับได้ — พังแล้วระบบยังตอบ 200 ทุกทาง
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** ไฟล์ที่อ่านผลโทรจากตารางคิว — เพิ่มที่อ่านใหม่ต้องมาต่อรายการนี้ */
const READERS = [
  'api/_lib/lumosDispatch.ts',
  'api/_handlers/lumos-call-funnel.ts',
  'api/_handlers/matching-contact-history.ts',
  'api/_lib/callFollowup.ts',
];

describe('อ่านผลโทรต้อง coalesce เสมอ ห้ามอ่าน result ทางเดียว', () => {
  for (const file of READERS) {
    it(`${file} — ทุกที่ที่อ่าน result->>'outcome' ต้องมี last_outcome คู่กัน`, () => {
      const src = readFileSync(path.resolve(process.cwd(), file), 'utf8');
      // ตัดคอมเมนต์ออกก่อน — ไฟล์พวกนี้อธิบายกับดักไว้ในคอมเมนต์ด้วย
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('--'))
        .join('\n');

      /**
       * ทุกจุดที่อ่าน `result->>'outcome'` ต้องมี `last_outcome` อยู่ใกล้ ๆ — รับได้ 3 แบบ:
       *   1. `coalesce(last_outcome, result->>'outcome')` ใน SQL (ท่ามาตรฐาน)
       *   2. select ทั้งสองคอลัมน์แล้วถอยใน JS (`r.last_outcome || r.result_outcome`)
       *      — `matching-contact-history.ts` ใช้ท่านี้ ผลเท่ากัน
       *   3. อยู่ในคิวรี **LEGACY** สำหรับฐานที่ยังไม่รัน migration 070 ซึ่ง
       *      **ไม่มีคอลัมน์ `last_outcome`** — ใส่ coalesce ตรงนั้นจะ throw 42703
       *      (`JOB_SUMMARY_SQL_LEGACY` ใน lumosDispatch.ts)
       *
       * ที่จับได้จริงคือการอ่านโดด ๆ ที่ไม่มี last_outcome อยู่ในละแวกเดียวกันเลย
       * ซึ่งเป็นรูปของบั๊กทั้งสามรอบที่ผ่านมา
       */
      /**
       * ⚠️ เช็ค **รายจุด** ว่า `last_outcome` อยู่ "ติดกันจริง" ไม่ใช่แค่ "อยู่ในละแวก"
       * รอบแรกเขียนแบบดูละแวก 400 ตัวอักษร แล้ว mutation หลุด: คิวรี funnel มี coalesce
       * สองจุด พอย้อนจุดเดียวให้เป็นบั๊ก อีกจุดก็ยังทำให้คำว่า last_outcome อยู่ใกล้ ๆ
       * เทสต์เลยผ่านทั้งที่บั๊กกลับมาแล้วครึ่งหนึ่ง
       */
      const LEGACY_LOOKBEHIND = 900;
      const lonely: string[] = [];
      const re = /result\s*->>\s*'outcome'/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        const justBefore = code.slice(Math.max(0, m.index - 60), m.index);
        // รับได้ทั้ง `coalesce(last_outcome, result->>...` และ select คู่กันแล้วถอยใน JS
        // (`last_outcome, result->>'outcome' as result_outcome`) — สองแบบนี้ผลเท่ากัน
        const pairedRightHere = /last_outcome\s*,\s*\w*\.?$/.test(justBefore);
        const isLegacyBlock = /LEGACY/i.test(code.slice(Math.max(0, m.index - LEGACY_LOOKBEHIND), m.index));
        if (!pairedRightHere && !isLegacyBlock) {
          lonely.push(code.slice(Math.max(0, m.index - 90), m.index + 60).replace(/\s+/g, ' '));
        }
      }
      expect(lonely).toEqual([]);
    });
  }

  it('รายการไฟล์ที่ต้องคุมต้องไม่ว่าง (กันเทสต์ผ่านเพราะไม่ได้เช็คอะไรเลย)', () => {
    expect(READERS.length).toBeGreaterThanOrEqual(4);
    for (const f of READERS) {
      expect(readFileSync(path.resolve(process.cwd(), f), 'utf8').length).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * อ่านตารางของ So Scraping ต้องมีเวลาหยุดรอ (บทเรียน 24 พ.ย. 2569: So Scraping ค้าง UPDATE 21 นาที
 * คำสั่งอ่านรายชื่อ Scrap ของเรารอตาม ช่องต่อฐานเต็ม ทั้งบริษัทล็อกอินไม่ได้)
 */
const src = readFileSync(resolve(__dirname, '../../api/_lib/scrapCandidates.ts'), 'utf8');

describe('อ่าน so-candidate-data ทุกคำสั่งผ่าน scrapRead', () => {
  it('ธุรกรรมอ่านอย่างเดียว + lock_timeout + statement_timeout', () => {
    expect(src).toContain("await client.query('set transaction read only');");
    expect(src).toContain('set local lock_timeout');
    expect(src).toContain('set local statement_timeout');
  });
  it('ไม่มีคำสั่งไหนอ่าน ${CAND} ผ่าน dbQuery ตรง ๆ', () => {
    const blocks = src.split(/await (dbQuery|scrapRead)</).slice(1);
    // คู่ [ชื่อตัวเรียก, เนื้อคำสั่ง] — คำสั่งที่แตะ ${CAND} ต้องเป็น scrapRead
    for (let i = 0; i < blocks.length; i += 2) {
      const caller = blocks[i];
      const body = blocks[i + 1].slice(0, 1200);
      const sqlEnd = body.indexOf('`,');
      const sql = sqlEnd > 0 ? body.slice(0, sqlEnd) : body;
      if (sql.includes('${CAND}')) expect(caller).toBe('scrapRead');
    }
    expect((src.match(/await scrapRead</g) ?? []).length).toBe(3);
  });
});

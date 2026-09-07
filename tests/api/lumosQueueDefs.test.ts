// @vitest-environment node
/**
 * เทสต์คุมกติกา "หนึ่งเมตริก หนึ่งนิยาม" ของคิวโทร Lumos
 *
 * 🔴 **บั๊กที่เทสต์ชุดนี้เกิดมาเพื่อกัน** (วัดฐานจริง 26 ส.ค. 2569):
 * หน้าแรกขึ้น *"สายที่ส่ง AI ไปแล้วเงียบ 37 ราย"* พร้อมกับบอร์ดบนจอเดียวกันที่บอก
 * *"รอผลจาก Lumos 0"* — เพราะ `matching-flow-summary` เขียน `result is null` เอง
 * ส่วน `office-floor` เขียน `coalesce(last_outcome, ...)` · วัดฐานได้ 38 vs 0
 * และบอร์ด Lumos ใช้ `count(result)` เป็น "ได้ผลแล้ว" จึงรายงาน 3/59 ทั้งที่จริง 40/40
 *
 * เทสต์แบ่งเป็นสองชั้น:
 * 1. **พฤติกรรมจริงของ SQL** — รันเงื่อนไขที่ประกอบออกมากับฐานในหน่วยความจำ
 *    (`node:sqlite`) แล้วนับแถว · ชั้นนี้จับ **ตรรกะสามค่า (NULL)** ได้ ซึ่งการเทียบ
 *    สตริงจับไม่ได้เลย — บั๊ก 7 ก.ย. 2569 หลุดมาได้เพราะเทสต์เดิมมีแต่ชั้นเทียบสตริง
 * 2. **รูปของ SQL** — กันไม่ให้ใครไปเขียน "นิยามที่สอง" ในไฟล์อื่น
 *
 * ⚠️ ห้ามให้เทสต์แตะฐาน production (ฐาน local = production จริง) — ฐานในหน่วยความจำ
 * เป็นคนละตัว สร้างใหม่ทุกครั้งที่รัน ไม่มีการเขียนออกไปไหน
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  queueActive,
  queueCancelled,
  queueHasResult,
  queueOutcome,
  queuePending,
  queueResultAt,
  queueSentAt,
  queueStale,
  queueStalePending,
  queueWaiting,
} from '../../api/_lib/lumosQueueDefs';

const ROOT = path.resolve(__dirname, '../..');

/* ════════════════════════════════════════════════════════════════════════════
 * ชั้นที่ 1 — พฤติกรรมจริงของเงื่อนไข (ไม่ใช่รูปของสตริง)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * 🔴 **บั๊ก 7 ก.ย. 2569 ที่เทสต์ชุดนี้เกิดมาเพื่อกัน**
 * `queueCancelled` เคยเขียน `(status='cancelled' or outcome='cancelled')` เฉย ๆ
 * แถวที่ยังไม่มีผล outcome เป็น NULL ⇒ `false or NULL` = **NULL** ⇒
 * `queueActive` = `not NULL` = NULL ⇒ `count(*) filter (where ...)` ข้ามแถวทิ้งเงียบ ๆ
 * (กล่องทีมหน้าแรกจึงขึ้น "รอโทร 0" ตลอดกาล ทั้งที่ฐานมี 11 แถวรออยู่)
 *
 * การเทียบสตริงจับบั๊กนี้ไม่ได้ **ต้องรันจริง** — ฐานในหน่วยความจำก็พอ เพราะตรรกะ
 * สามค่าของ NULL เป็นมาตรฐาน SQL เหมือนกันทั้ง postgres และ sqlite
 */
type Row = {
  /** ชื่อแถวไว้อ่านตอนเทสต์แดง */
  tag: string;
  status: string;
  last_outcome: string | null;
  /** payload ดิบจาก Lumos (JSON) — null ได้แม้จะมีผลแล้ว (ตอนตั้งโทรซ้ำระบบล้างทิ้ง) */
  result: string | null;
  /** อายุของแถว (วัน) ไว้ทดสอบเกณฑ์ "ค้างเกิน N วัน" */
  ageDays?: number;
};

const ROWS: Row[] = [
  { tag: 'รอโทร (ยังไม่มีผล)', status: 'pending', last_outcome: null, result: null },
  { tag: 'รอโทร ค้างมา 5 วัน', status: 'pending', last_outcome: null, result: null, ageDays: 5 },
  { tag: 'ส่งแล้วรอผล', status: 'delivered', last_outcome: null, result: null },
  { tag: 'มีผล — คนบันทึกเอง (result ว่าง)', status: 'delivered', last_outcome: 'no_answer', result: null },
  { tag: 'มีผล — payload เก่าก่อน migration 070', status: 'completed', last_outcome: null, result: '{"outcome":"confirmed"}' },
  { tag: 'ยกเลิกด้วยสถานะ', status: 'cancelled', last_outcome: null, result: null },
  { tag: 'ยกเลิกด้วยผล', status: 'pending', last_outcome: 'cancelled', result: null },
];

/**
 * แปลง postgres-ism เท่าที่เงื่อนไขชุดนี้ใช้ให้ sqlite รันได้ — มีที่เดียวคือ
 * `now() - interval '<n> days'` · ถ้าวันหนึ่งนิยามใช้ฟังก์ชันอื่น เทสต์จะ throw ให้เห็น
 * ไม่ใช่แปลไม่ติดแล้วเงียบ
 */
function toSqlite(cond: string): string {
  const out = cond.replace(
    /now\(\)\s*-\s*interval\s*'(\d+)\s*(day|days)'/g,
    (_m, n: string) => `datetime('now','-${n} days')`,
  );
  if (/now\(\)|interval/.test(out)) {
    throw new Error(`แปลงเป็น sqlite ไม่ครบ ยังเหลือคำสั่งของ postgres: ${out}`);
  }
  return out;
}

/** นับแถวที่เงื่อนไขเป็น **true จริง ๆ** (NULL ไม่นับ — เหมือน `count(*) filter`) */
function matching(cond: string): string[] {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`create table q (
      tag text, status text, last_outcome text, result text,
      next_attempt_at text, created_at text, first_delivered_at text, updated_at text
    )`);
    const ins = db.prepare(
      `insert into q values (?, ?, ?, ?, null, datetime('now', ?), null, datetime('now'))`,
    );
    for (const r of ROWS) {
      ins.run(r.tag, r.status, r.last_outcome, r.result, `-${r.ageDays ?? 0} days`);
    }
    const rows = db
      .prepare(`select tag from q where ${toSqlite(cond)}`)
      .all() as unknown as { tag: string }[];
    return rows.map((r) => r.tag);
  } finally {
    db.close();
  }
}

describe('ตรรกะจริงของเงื่อนไข — รันกับฐานในหน่วยความจำ ไม่ใช่เทียบสตริง', () => {
  it('🔴 แถว "รอโทร" ที่ยังไม่มีผล (outcome = NULL) ต้องอยู่ใน queueActive', () => {
    // นี่คือแถวที่หายไปทั้งกอง 11 แถวจากกล่องทีมหน้าแรก
    expect(matching(queueActive('q'))).toContain('รอโทร (ยังไม่มีผล)');
    expect(matching(queueActive('q'))).toContain('ส่งแล้วรอผล');
  });

  it('ยกเลิกทั้งสองทาง (สถานะ/ผล) ต้องหลุดออกจาก queueActive และอยู่ใน queueCancelled', () => {
    const active = matching(queueActive('q'));
    expect(active).not.toContain('ยกเลิกด้วยสถานะ');
    expect(active).not.toContain('ยกเลิกด้วยผล');
    expect(matching(queueCancelled('q')).sort()).toEqual(
      ['ยกเลิกด้วยผล', 'ยกเลิกด้วยสถานะ'].sort(),
    );
    // active = ส่วนเติมเต็มของ cancelled เป๊ะ — ห้ามมีแถวไหนตกหายระหว่างสองถัง
    expect(active.length + matching(queueCancelled('q')).length).toBe(ROWS.length);
  });

  it('🔴 เงื่อนไขเวอร์ชันที่ไม่ปิด NULL (ของเดิม) ทำแถวหายจริง — กันคนย้อนกลับไปเขียนแบบนั้น', () => {
    const buggy = `(not (q.status = 'cancelled' or ${queueOutcome('q')} = 'cancelled'))`;
    // ของเดิมเหลือแค่แถว **ที่มี outcome แล้ว** — แถวที่ยังไม่มีผลกลายเป็น NULL แล้วถูกข้ามหมด
    expect(matching(buggy).sort()).toEqual(
      ['มีผล — คนบันทึกเอง (result ว่าง)', 'มีผล — payload เก่าก่อน migration 070'].sort(),
    );
    // 3 แถวที่ยังไม่มีผล (รอโทร 2 + รอผล 1) หายไปเงียบ ๆ = รูปของบั๊กบนกล่องทีมเป๊ะ
    for (const tag of ['รอโทร (ยังไม่มีผล)', 'รอโทร ค้างมา 5 วัน', 'ส่งแล้วรอผล']) {
      expect(matching(buggy)).not.toContain(tag);
      expect(matching(queueActive('q'))).toContain(tag);
    }
    expect(matching(queueActive('q')).length).toBeGreaterThan(matching(buggy).length);
  });

  it('"มีผลแล้ว" ต้องรวมผลที่อยู่ใน last_outcome และใน result->>outcome', () => {
    expect(matching(queueHasResult('q')).sort()).toEqual(
      ['มีผล — คนบันทึกเอง (result ว่าง)', 'มีผล — payload เก่าก่อน migration 070', 'ยกเลิกด้วยผล'].sort(),
    );
    // นิยามที่พัง (อ่าน result ทางเดียว) เห็นแค่แถวเดียว — คือบั๊กที่หัวไฟล์นิยามเตือนไว้
    expect(matching('(q.result is not null)')).toEqual(['มีผล — payload เก่าก่อน migration 070']);
  });

  it('รอโทร / รอผลกลับ แบ่งกันขาด และไม่ทับกับ "มีผลแล้ว"', () => {
    expect(matching(queuePending('q')).sort()).toEqual(
      ['รอโทร (ยังไม่มีผล)', 'รอโทร ค้างมา 5 วัน'].sort(),
    );
    expect(matching(queueWaiting('q'))).toEqual(['ส่งแล้วรอผล']);
    for (const tag of [...matching(queuePending('q')), ...matching(queueWaiting('q'))]) {
      expect(matching(queueHasResult('q'))).not.toContain(tag);
    }
  });

  it('"รอโทรค้างเกิน 2 วัน" จับเฉพาะตัวที่ค้างจริง ไม่ใช่ทุกตัวที่รอโทร', () => {
    expect(matching(queueStalePending("'2 days'", 'q'))).toEqual(['รอโทร ค้างมา 5 วัน']);
  });
});

describe('นิยามกลางของคิว Lumos', () => {
  it('ผลของสายอ่านจาก last_outcome ก่อนเสมอ แล้วค่อยถอยไป result->>outcome', () => {
    expect(queueOutcome('q')).toBe(`coalesce(q.last_outcome, q.result->>'outcome')`);
    // ไม่มี alias = คิวรีที่ select จากตารางเดียว
    expect(queueOutcome('')).toBe(`coalesce(last_outcome, result->>'outcome')`);
  });

  it('"มีผลแล้ว" ต้องไม่ใช่แค่ result is null — ไม่งั้นสายที่คนบันทึกผลเองจะหายไป', () => {
    const sql = queueHasResult('q');
    expect(sql).toContain('last_outcome');
    expect(sql).not.toMatch(/\bresult is null\b/);
  });

  it('"ยกเลิก" นับทั้ง status และ outcome — แล้ว active ต้องเป็นส่วนเติมเต็มของมัน', () => {
    expect(queueCancelled('q')).toContain(`q.status = 'cancelled'`);
    expect(queueCancelled('q')).toContain(`= 'cancelled'`);
    expect(queueActive('q')).toBe(`(not ${queueCancelled('q')})`);
    // 🔴 ต้องปิดท้ายด้วย false เสมอ — ไม่งั้น outcome ที่เป็น NULL ทำทั้งเงื่อนไขเป็น NULL
    expect(queueCancelled('q')).toMatch(/^coalesce\(.*, false\)$/s);
  });

  it('รอโทร / รอผลกลับ แยกกันด้วย status และทั้งคู่ต้องยังไม่มีผล', () => {
    expect(queuePending('q')).toContain(`q.status = 'pending'`);
    expect(queueWaiting('q')).toContain(`q.status = 'delivered'`);
    for (const sql of [queuePending('q'), queueWaiting('q')]) {
      expect(sql).toContain(`coalesce(q.last_outcome, q.result->>'outcome') is null`);
    }
  });

  it('เกณฑ์ "เงียบ" ต่างกันได้ตามจอ แต่ต้องต่อยอดจากนิยาม "ยังไม่มีผล" ตัวเดียวกัน', () => {
    const oneDay = queueStale("'1 day'", 'q');
    const twoDays = queueStale("'2 days'", 'q');
    expect(oneDay).toContain(queueWaiting('q'));
    expect(twoDays).toContain(queueWaiting('q'));
    expect(oneDay).toContain(`interval '1 day'`);
    expect(twoDays).toContain(`interval '2 days'`);
  });

  it('เวลาส่งออก/เวลาได้ผล ถอยไปใช้ updated_at ให้แถวก่อน migration 088', () => {
    expect(queueSentAt('q')).toBe('coalesce(q.first_delivered_at, q.updated_at)');
    expect(queueResultAt('q')).toBe('coalesce(q.first_result_at, q.updated_at)');
  });

  it('รอส่งออกนานเกินกำหนด ต่อยอดจาก "รอโทร" และดูจาก next_attempt_at ก่อน created_at', () => {
    const sql = queueStalePending("'2 days'", 'q');
    expect(sql).toContain(queuePending('q'));
    expect(sql).toContain('coalesce(q.next_attempt_at, q.created_at)');
  });
});

/**
 * 🔴 ด่านกันคนเขียนเงื่อนไขเอง — ถ้าเทสต์ข้อนี้แดง แปลว่ามีคนกำลังสร้าง
 * "นิยามที่สอง" ขึ้นมาอีก ซึ่งคือต้นเหตุที่ทำให้จอสองอันเถียงกันมาแล้ว
 */
describe('ห้ามมีนิยามที่สองของ "มีผลแล้ว" ในเส้นที่นับสายของหน้าแรก', () => {
  const GUARDED = [
    'api/_handlers/matching-flow-summary.ts',
    'api/_handlers/office-floor.ts',
    'api/_handlers/office-team.ts',
  ];

  it.each(GUARDED)('%s ไม่เช็ค status เปล่า ๆ โดยไม่ดูว่ามีผลแล้วหรือยัง', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/^\s*--.*$/gm, '');
    /**
     * 🔴 วัดฐาน 26 ส.ค. 2569: 8 แถวมี `status='pending'` ทั้งที่มีผลกลับครบแล้ว
     * ⇒ ใครนับ `status = 'pending'` ลอย ๆ จะรายงาน "รอส่งให้ AI โทร 8 สาย"
     * ทั้งที่ไม่มีใครรอสักคน · ต้องผ่าน `queuePending()` เท่านั้น
     */
    // จับเฉพาะตารางคิว (alias `q.` หรือไม่มี alias) — `p.status` เป็นตารางคำขอโพส คนละเรื่อง
    expect(code).not.toMatch(/(?:\bq\.status|(?<![a-z]\.)\bstatus)\s*=\s*'pending'/);
  });

  it.each(GUARDED)('%s ไม่เขียน result is null / count(result) เอง', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    // ตัดคอมเมนต์ออกก่อน — ไฟล์พวกนี้ "เล่าเรื่องบั๊ก" ด้วยคำเหล่านี้โดยตั้งใจ
    // (ทั้งคอมเมนต์ JS และคอมเมนต์ `--` ที่อยู่ในสตริง SQL)
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/^\s*--.*$/gm, '');
    expect(code).not.toMatch(/\bresult is null\b/);
    expect(code).not.toMatch(/count\(result\)/);
  });

  it.each(GUARDED)('%s import นิยามกลางมาใช้จริง', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(src).toContain('lumosQueueDefs.js');
  });
});

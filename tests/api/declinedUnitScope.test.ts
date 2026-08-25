// @vitest-environment node
/**
 * Phase 6.8 — กันเสนอคนซ้ำ **ระดับหน่วยงาน** (ไม่ใช่แค่ระดับใบขอ)
 *
 * 🔴 เจ้าของสั่ง: *"กันหน่วยงานที่เคยปฏิเสธระดับหน่วยงาน"* — วัดจริงบนฐาน 23 ส.ค. 2569:
 * ไซต์ `67LBDL0208` มีใบขอ **28 ใบ** ⇒ เดิมคนที่ปฏิเสธ 1 ใบยังถูกเสนออีก 27 ใบของไซต์เดิม
 *
 * ด่านที่ห้ามหลุด:
 * 1. ยังกัน **ถาวร** (ไม่มีหน้าต่างเวลา) เหมือนเดิม — ต่างจาก cooldown 30 วัน
 * 2. รวมทั้งสองแหล่งผล (คิว AI + ถังที่คนรับไปโทร)
 * 3. ยังอยู่ที่ **คอขวดเดียว** (`insertQueueItems`) ครอบทุกทางเข้า
 * 4. ยกเว้น `job_ref='follow'` เหมือนเดิม (ตารางโทรตามคนละเรื่อง)
 * 5. **fail-safe**: ไม่รู้ว่าใบนี้อยู่ไซต์ไหน → กันระดับใบขอเท่าเดิม (ไม่กันมั่วเกินจริง)
 * 6. ตัวจำหน่วยงานห้ามทำ feed ใบขอล้ม (กลืน error ทุกทาง)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildDeclinedAnyJobSql,
  buildDeclinedThisJobSql,
} from '../../api/_lib/applicationRotationSql.js';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*--.*$/gm, '');

describe('SQL กันซ้ำหลายใบขอ', () => {
  const sql = buildDeclinedAnyJobSql();

  it('รับ job ids เป็น array (ไม่ใช่ใบเดียว)', () => {
    expect(sql).toMatch(/q\.job_ref = any\(\$1::text\[\]\)/);
    expect(sql).toMatch(/h\.job_id = any\(\$1::text\[\]\)/);
  });

  it('🔴 ยังไม่มีหน้าต่างเวลา — ปฏิเสธแล้วคือถาวร', () => {
    expect(sql).not.toMatch(/interval|timestamptz|>=\s*\$3/);
  });

  it('นับ outcome declined จากทั้งคิวและถังคนโทร', () => {
    expect(sql).toMatch(/= 'declined'/);
    expect(sql.match(/'declined'/g)?.length).toBe(2);
    expect(sql).toContain('union');
  });

  /**
   * 🔴 ช่องโหว่ที่เจอ 24 ส.ค. 2569 — ผลติดต่อจากมือคน (`ok = false` ในตาราง 086)
   * หน้าจอโชว์ว่า "ไม่สนใจ" แต่ตัวกันเสนอซ้ำมองไม่เห็น เพราะ `createContactLog`
   * ไม่เขียนลง holds ตามที่คอมเมนต์เดิมสมมติไว้ ⇒ AI โทรงานเดิมซ้ำได้
   */
  it('🔴 นับผลติดต่อจากมือคนด้วย (ok = false)', () => {
    expect(sql).toMatch(/c\.ok = false/);
    expect(sql).toMatch(/application_contact_logs/);
  });

  it('เส้นผลจากมือคนเทียบใบที่เขา**สมัคร** (a.job_id) ไม่ใช่ใบที่นัดลง', () => {
    expect(sql).toMatch(/a\.job_id = any\(\$1::text\[\]\)/);
    // c.job_id เขียนเฉพาะตอนนัดได้ → ใช้ตัวเดียวจะพลาดเคส ok=false ทั้งหมด
    expect(sql).not.toMatch(/c\.job_id = any/);
  });

  it('ยังไม่มีหน้าต่างเวลาบนเส้นที่สามด้วย (ปฏิเสธคือถาวร)', () => {
    const third = sql.slice(sql.lastIndexOf('union'));
    expect(third).not.toMatch(/created_at\s*>=/);
  });

  it('อ่านเบอร์ในคิวแบบ coalesce สองคีย์ (reminder/interview คนละคีย์)', () => {
    expect(sql).toContain(`coalesce(q.payload->>'recipient_phone', q.payload->>'phone')`);
  });

  it('ตัวเดิมระดับใบขอยังอยู่ (ไม่ลบของเก่า)', () => {
    expect(buildDeclinedThisJobSql()).toMatch(/q\.job_ref = \$1/);
  });
});

describe('คอขวดเข้าคิวใช้ตัวระดับหน่วยงาน', () => {
  const dispatch = stripComments(read('api/_lib/lumosDispatch.ts'));

  it('insertQueueItems เรียก phonesDeclinedThisUnit', () => {
    expect(dispatch).toContain('phonesDeclinedThisUnit');
  });

  it('ยังยกเว้นตารางโทรตาม (follow)', () => {
    expect(dispatch).toMatch(/jobRef === 'follow'\s*\?\s*new Set\(\)/);
  });

  it('อ่านไม่ได้ = ไม่กรอง (ไม่หยุดส่งงานทั้งระบบ)', () => {
    const block = dispatch.slice(dispatch.indexOf('let declinedPhones'));
    expect(block).toMatch(/catch\s*\{\s*declinedPhones = new Set\(\);/);
  });
});

describe('ตัวจำหน่วยงานของใบขอ (jobSiteMap)', () => {
  const map = stripComments(read('api/_lib/jobSiteMap.ts'));

  it('fail-safe: ไม่รู้ไซต์ → คืนแค่ใบนี้ (กันระดับใบขอเท่าเดิม)', () => {
    expect(map).toMatch(/return \[id\]/);
    expect(map).toMatch(/site_code is not null/);
  });

  it('🔴 กลืน error ทุกทาง — ห้ามทำ feed ใบขอ/การเข้าคิวล้ม', () => {
    expect(map).not.toMatch(/throw\s/);
    expect(map.match(/catch/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('upsert ไม่ลบค่าเดิมทิ้งเมื่อรอบใหม่ไม่มีค่า (coalesce)', () => {
    expect(map).toMatch(/coalesce\(excluded\.site_code/);
    expect(map).toMatch(/coalesce\(excluded\.unit_name/);
  });

  it('feed ใบขอเติมแมปให้เองโดยไม่ await (ของหลักต้องไม่รอ)', () => {
    const feed = stripComments(read('api/_lib/siamrajUnitRequests.ts'));
    expect(feed).toMatch(/void rememberJobSites\(/);
    expect(feed).not.toMatch(/await rememberJobSites\(/);
  });
});

describe('migration 106', () => {
  const sql = stripComments(read('migrations/106_job_site_map.sql'));

  it('คีย์เป็นใบขอ + มี index ถามกลับทางด้วยไซต์', () => {
    expect(sql).toMatch(/job_id text primary key/);
    expect(sql).toMatch(/create index[\s\S]*job_site_map \(site_code\)/);
  });

  it('ไม่มี FK (ใบขออยู่คนละฐาน)', () => {
    expect(sql).not.toMatch(/references/i);
  });
});

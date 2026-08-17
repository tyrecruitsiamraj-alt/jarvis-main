/**
 * ล้างคิวโทรค้างของ Lumos — ยกเลิกแถวที่ "ส่งไปแล้วแต่ไม่เคยมีผลกลับ"
 *
 *   npx tsx scripts/cancel-stale-lumos-queue.mts --dry            # ดูอย่างเดียว (ค่าเริ่มต้น)
 *   npx tsx scripts/cancel-stale-lumos-queue.mts --apply          # ลงมือจริง
 *   npx tsx scripts/cancel-stale-lumos-queue.mts --apply --older-than-days 8
 *
 * เจ้าของเคาะ 13 ส.ค. 2569: **ล้างทั้งหมด เริ่มใหม่** ก่อนเปิดใช้จริง 18 ส.ค.
 * เหตุ: คิวค้าง 4,849 แถว = 140 คน อายุ 8–30 วัน · Lumos รับไปแล้ว 2,368 แถวแต่เงียบ
 * ตั้งแต่ 4 ส.ค. → เปิดใช้โดยไม่ล้าง = โทรหาคนเรื่องงานที่อาจปิดไปแล้ว
 *
 * ⚠️ ฐาน local = production — สคริปต์นี้จึง:
 *   1. ค่าเริ่มต้นเป็น --dry (ต้องพิมพ์ --apply ถึงเขียนจริง)
 *   2. **ไม่ลบแถว** แค่ set status = 'cancelled' (แพตเทิร์นเดียวกับ `cancelLumosQueueItem`)
 *      ประวัติยังอยู่ครบ · ย้อนกลับได้จากไฟล์สำรอง
 *   3. เขียนไฟล์สำรอง id + สถานะเดิม ก่อนอัปเดตเสมอ
 *
 * ⚠️ ขอบเขตที่ตั้งใจ: **เฉพาะแถวที่ยังไม่มีผลกลับเลย** (`result is null and last_outcome is null`)
 * แถวที่มีผลแล้วเป็นประวัติการโทรจริง ห้ามแตะ · แถวที่ยกเลิกไปแล้วข้าม
 *
 * ⚠️ **ยกเลิกฝั่งเราไม่ได้เรียกสายคืนจาก Lumos** — 2,368 แถวที่เขารับไปแล้วอยู่ในระบบเขา
 * ถ้าวันหนึ่งเขากลับมาเดินคิวเก่า สายพวกนั้นยังออกได้ · ฝั่งเราแค่จะไม่เสิร์ฟซ้ำ
 * (`SERVE_ELIGIBLE` ไม่รับ status = 'cancelled') และผลที่ส่งกลับมาจะไม่ถูกนับเป็นงานค้าง
 */
import fs from 'node:fs';
import path from 'node:path';
import '../server/bootstrap-env.js';
import { dbQuery } from '../api/_lib/postgres.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const olderThanIdx = args.indexOf('--older-than-days');
const olderThanDays = olderThanIdx >= 0 ? Number(args[olderThanIdx + 1]) : null;
if (olderThanDays !== null && (!Number.isFinite(olderThanDays) || olderThanDays < 0)) {
  console.error('--older-than-days ต้องเป็นตัวเลขไม่ติดลบ');
  process.exit(1);
}

// แถวเป้าหมาย: ยังไม่เคยมีผลกลับ และยังไม่ถูกยกเลิก
const WHERE = `
  result is null
  and last_outcome is null
  and status <> 'cancelled'
  ${olderThanDays === null ? '' : `and created_at < now() - interval '${olderThanDays} days'`}
`;

const phoneExpr = `coalesce(payload->>'recipient_phone', payload->>'phone')`;

const { rows: before } = await dbQuery<{
  rows_total: string;
  people: string;
  pending: string;
  delivered: string;
  other_status: string;
  with_followup_state: string;
  oldest: string | null;
  newest: string | null;
}>(`
  select
    count(*)::text                                                        as rows_total,
    count(distinct ${phoneExpr})::text                                    as people,
    count(*) filter (where status = 'pending')::text                      as pending,
    count(*) filter (where status = 'delivered')::text                    as delivered,
    count(*) filter (where status not in ('pending','delivered'))::text   as other_status,
    count(*) filter (where followup_state is not null)::text              as with_followup_state,
    min(created_at)::text                                                 as oldest,
    max(created_at)::text                                                 as newest
  from lumos_dispatch_queue
  where ${WHERE}
`);

const { rows: queueTotal } = await dbQuery<{ c: string }>(
  `select count(*)::text as c from lumos_dispatch_queue`,
);

console.log('คิวทั้งหมดในฐาน:', queueTotal[0].c, 'แถว');
console.log('แถวเป้าหมาย (ไม่มีผลกลับ · ยังไม่ยกเลิก):', before[0]);

if (Number(before[0].rows_total) === 0) {
  console.log('ไม่มีแถวที่เข้าเงื่อนไข — ไม่ต้องทำอะไร');
  process.exit(0);
}

if (!apply) {
  console.log('\n--dry (ค่าเริ่มต้น) — ยังไม่เขียนอะไรลงฐาน · ใส่ --apply เพื่อลงมือจริง');
  process.exit(0);
}

// สำรอง id + สถานะเดิมก่อนแตะฐาน
const { rows: backupRows } = await dbQuery<{
  id: number; status: string; channel: string; job_ref: string; person_ref: string;
  delivery_count: number; followup_state: string | null; created_at: string;
}>(`
  select id, status, channel, job_ref, person_ref, delivery_count, followup_state,
         created_at::text as created_at
    from lumos_dispatch_queue
   where ${WHERE}
   order by id
`);

const stamp = backupRows.length ? String(backupRows[backupRows.length - 1].id) : 'empty';
const backupPath = path.join(process.cwd(), `lumos-queue-cancel-backup-${stamp}.json`);
fs.writeFileSync(backupPath, JSON.stringify(backupRows, null, 2), 'utf8');
console.log(`\nสำรองไว้แล้ว ${backupRows.length} แถว → ${backupPath}`);
console.log('ย้อนกลับ: update lumos_dispatch_queue set status = <สถานะเดิม> where id = <id>');

const { rows: updated } = await dbQuery<{ id: number }>(`
  update lumos_dispatch_queue
     set status = 'cancelled', updated_at = now()
   where ${WHERE}
   returning id
`);

const { rows: after } = await dbQuery<{ c: string }>(
  `select count(*)::text as c from lumos_dispatch_queue where ${WHERE}`,
);
const { rows: totalAfter } = await dbQuery<{ c: string }>(
  `select count(*)::text as c from lumos_dispatch_queue`,
);

console.log(`\nยกเลิกแล้ว ${updated.length} แถว`);
console.log('แถวเป้าหมายที่เหลือ (ต้องเป็น 0):', after[0].c);
console.log('คิวทั้งหมดหลังทำ (ต้องเท่าเดิม):', totalAfter[0].c);
process.exit(0);

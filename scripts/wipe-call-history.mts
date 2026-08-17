/**
 * ล้างประวัติการโทรทั้งหมด — เพื่อทดลองเล่นเต็มระบบก่อนเปิดใช้จริง 18 ส.ค. 2569
 *
 *   npx tsx scripts/wipe-call-history.mts --dry     # ดูอย่างเดียว (ค่าเริ่มต้น)
 *   npx tsx scripts/wipe-call-history.mts --apply    # ลบจริง
 *
 * เจ้าของสั่ง 14 ส.ค. 2569: "ประวัติต่าง ๆ ที่เคยส่งไปลบได้ไหม อยากทดลองเล่นเต็มระบบ
 * จะได้รู้ว่าปุ่มทำงานได้หมด" — เคาะ "ล้าง 3 ตารางคู่กัน"
 *
 * ⚠️ ต่างจาก cancel-stale-lumos-queue.mts (ตัวนั้น set cancelled ไม่ลบ) — ตัวนี้ **DELETE จริง**
 * เพราะแถว cancelled ยังกินสิทธิ์ unique (channel, job_ref, person_ref) เต็มตาราง
 * ทดลองส่งคนเดิม+ใบเดิมซ้ำจะโดน revive (แถวเดิม id เดิม) ไม่ใช่แถวใหม่ — ไม่เหมือนของจริง
 *
 * ⚠️ ฐาน local = production — สคริปต์นี้จึง:
 *   1. ค่าเริ่มต้นเป็น --dry (ต้องพิมพ์ --apply ถึงลบจริง)
 *   2. **สำรองทุกคอลัมน์** (select *) ของทั้ง 3 ตารางก่อนลบ → JSON แยกไฟล์
 *      (ไฟล์อยู่ใน .gitignore เพราะมี person_ref/เบอร์/บทที่ AI พูดของผู้สมัครจริง)
 *   3. ใช้ DELETE ธรรมดา **ห้าม TRUNCATE ... RESTART IDENTITY** — id ต้องเดินต่อ
 *      ไม่งั้น dedupe_key ของ app_notifications (`call_confirmed:<id>`) จะชนของเก่า
 *      แล้วแจ้งเตือนรอบทดสอบหายเงียบ
 *
 * ⚠️ **ไม่แตะ**:
 *   - lumos_call_batches / _items — ชุด OPL6908018 เจ้าของเคาะ "ปล่อยค้างไว้" 11 ส.ค.
 *   - app_notifications — ปล่อยของเก่าไว้ (dedupe ด้วย id เดิมที่เดินต่อ)
 *   - follow_entries — ข้อมูลคนกรอก ไม่ใช่ประวัติโทร (แต่แถวเก่าจะกลับมาโชว์ "รอโทร"
 *     เพราะ join คิวไม่เจอ — รายงานจำนวนให้เจ้าของ ไม่ลบเอง)
 */
import fs from 'node:fs';
import path from 'node:path';
import '../server/bootstrap-env.js';
import { dbQuery } from '../api/_lib/postgres.js';
import { tableInAppSchema } from '../api/_lib/schema.js';

const apply = process.argv.slice(2).includes('--apply');

// ตารางที่ล้าง — ลบทุกแถว (ทดลองเริ่มจากศูนย์)
const TARGETS = [
  'lumos_dispatch_queue',
  'candidate_call_holds',
  'candidate_call_suppression',
] as const;

const counts: Record<string, string> = {};
for (const name of TARGETS) {
  const { rows } = await dbQuery<{ c: string }>(
    `select count(*)::text as c from ${tableInAppSchema(name)}`,
  );
  counts[name] = rows[0].c;
}

// follow_entries ที่ยังไม่ยกเลิก — จะกลับมาโชว์ "รอโทร" หลังลบคิว (รายงานให้เจ้าของ)
const { rows: followRows } = await dbQuery<{ c: string }>(
  `select count(*)::text as c from ${tableInAppSchema('follow_entries')} where cancelled_at is null`,
);

console.log('จำนวนแถวก่อนล้าง:');
for (const name of TARGETS) console.log(`  ${name}: ${counts[name]}`);
console.log(`\nℹ️  follow_entries ที่ยังไม่ยกเลิก: ${followRows[0].c} แถว`);
console.log('   หลังลบคิว แถวพวกนี้จะกลับมาโชว์ "รอโทร" (join คิวไม่เจอ) — เป็นเรื่องปกติ');
console.log('   ไม่ลบให้อัตโนมัติ เพราะเป็นข้อมูลที่คนกรอก ไม่ใช่ประวัติการโทร');

if (TARGETS.every((n) => Number(counts[n]) === 0)) {
  console.log('\nทุกตารางว่างอยู่แล้ว — ไม่ต้องทำอะไร');
  process.exit(0);
}

if (!apply) {
  console.log('\n--dry (ค่าเริ่มต้น) — ยังไม่ลบอะไร · ใส่ --apply เพื่อลบจริง');
  process.exit(0);
}

// สำรองทุกคอลัมน์ก่อนลบ
const backupDir = process.cwd();
const backupPaths: string[] = [];
for (const name of TARGETS) {
  if (Number(counts[name]) === 0) continue;
  const { rows } = await dbQuery(`select * from ${tableInAppSchema(name)} order by 1`);
  const p = path.join(backupDir, `wipe-backup-${name}.json`);
  fs.writeFileSync(p, JSON.stringify(rows, null, 2), 'utf8');
  backupPaths.push(p);
  console.log(`สำรอง ${name} ${rows.length} แถว → ${p}`);
}

// ลบจริง — DELETE ธรรมดา (sequence เดินต่อ) · `returning 1` เพื่อนับแถวที่ลบ
const deleted: Record<string, number> = {};
for (const name of TARGETS) {
  const { rows } = await dbQuery<{ one: number }>(
    `delete from ${tableInAppSchema(name)} returning 1 as one`,
  );
  deleted[name] = rows.length;
}

console.log('\nลบแล้ว:');
for (const name of TARGETS) console.log(`  ${name}: ${deleted[name]} แถว`);

// ยืนยันว่าว่างจริง
console.log('\nจำนวนแถวหลังลบ (ต้องเป็น 0 ทุกตาราง):');
for (const name of TARGETS) {
  const { rows } = await dbQuery<{ c: string }>(
    `select count(*)::text as c from ${tableInAppSchema(name)}`,
  );
  console.log(`  ${name}: ${rows[0].c}`);
}

console.log('\nไฟล์สำรอง (ย้อนกลับได้):');
for (const p of backupPaths) console.log(`  ${p}`);
console.log('\n⚠️ ยกเลิกฝั่งเราไม่ได้เรียกสายคืนจาก Lumos — ถ้าเขาถือคิวเก่าไว้ ต้องขอเขาล้างด้วย');
process.exit(0);

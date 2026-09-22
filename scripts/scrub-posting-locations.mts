/**
 * ล้างชื่อ/เบอร์คนออกจากช่อง "สถานที่" ของประกาศที่ขึ้นหน้าสาธารณะแล้ว
 *
 *   npx tsx scripts/scrub-posting-locations.mts          # ดูอย่างเดียว (ค่าเริ่มต้น)
 *   npx tsx scripts/scrub-posting-locations.mts --apply  # ลงมือจริง
 *
 * เจ้าของสั่ง 22 ก.ย. 2569 หลังเห็นเองบนหน้า /apply ว่าชื่อ+เบอร์ผู้จัดการสาขา
 * และผู้ช่วยของลูกค้าโผล่ให้คนนอกเห็น
 *
 * ⚠️ ฐาน local = production — สคริปต์นี้จึง:
 *   1. ค่าเริ่มต้นเป็นดูอย่างเดียว (ต้องพิมพ์ --apply ถึงเขียน)
 *   2. เขียนไฟล์สำรอง id + ข้อความเดิม ก่อนอัปเดตเสมอ (ย้อนกลับได้)
 *   3. แก้ทีละ id ที่ระบุชัด ไม่ใช้ LIKE กวาด
 */
import fs from 'node:fs';
import path from 'node:path';
import '../server/bootstrap-env.js';
import { dbQuery } from '../api/_lib/postgres.js';
import { scrubPublicLocation } from '../src/lib/publicLocationText.js';

const apply = process.argv.includes('--apply');

const { rows } = await dbQuery<{ id: string; job_id: string | null; location_text: string }>(
  `select id, job_id, location_text from recruit_postings
    where location_text is not null and location_text <> ''`,
);

const targets = rows
  .map((r) => ({ ...r, next: scrubPublicLocation(r.location_text) }))
  .filter((r) => r.next !== r.location_text.trim());

console.log(`ประกาศที่ต้องล้าง: ${targets.length} จาก ${rows.length}\n`);
for (const t of targets) {
  console.log(`— ${t.job_id ?? 'กล่องลอย'} (${t.id.slice(0, 8)})`);
  console.log(`  เดิม: ${t.location_text}`);
  console.log(`  ใหม่: ${t.next || '(ว่าง)'}\n`);
}

if (!apply) {
  console.log('ดูอย่างเดียว — ใส่ --apply เพื่อเขียนจริง');
  process.exit(0);
}

const backup = path.join(process.cwd(), `scrub-locations-backup-${Date.now()}.json`);
fs.writeFileSync(backup, JSON.stringify(targets, null, 2), 'utf-8');
console.log(`สำรองไว้ที่ ${backup}`);

let done = 0;
for (const t of targets) {
  await dbQuery(`update recruit_postings set location_text = $2, updated_at = now() where id = $1`, [
    t.id,
    t.next || null,
  ]);
  done += 1;
}
console.log(`เขียนแล้ว ${done} แถว`);
process.exit(0);

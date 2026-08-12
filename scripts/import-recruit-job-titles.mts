/**
 * ยก master "ตำแหน่งงาน" จาก iRecruit → `recruit_job_titles`
 *
 *   npx tsx scripts/import-recruit-job-titles.mts --dry
 *   npx tsx scripts/import-recruit-job-titles.mts
 *
 * ต้นทาง `recruit_master_job` (499 แถว) — **เอาเฉพาะ `owner = 'RM'`** (479 แถว)
 * ของ IOO เป็นอีกหน่วยงาน (20 แถว) ยกมาปนจะทำให้ลิสต์ของ RM มีตำแหน่งที่ใช้ไม่ได้
 *
 * ⚠️ กติกาเดียวกับ import ช่องทาง/เหตุผล: upsert ตาม (`source`,`source_id`) ยกซ้ำได้
 * · สถานะ inactive ก็ยกมาติดธง `is_active = false` (รายงานย้อนหลังต้องหาชื่อเจอ)
 * · แถวที่ต้นทางลบแล้ว (`deleted_at`) ข้ามทิ้ง (วัด 12 ส.ค. 2569: ไม่มีเลย แต่กันไว้)
 * · `type` ที่ไม่ใช่รหัส BU ที่เรารู้จัก → เก็บเป็น null **ไม่ทิ้งแถว** (ชื่อตำแหน่งยังใช้ได้)
 * · `seq` ของต้นทางส่วนใหญ่เป็น null → ใช้ 100 เท่ากันหมด แล้วเรียงด้วยชื่อที่ API
 */
import '../server/bootstrap-env.js';
import { irecruitSqlQuery } from '../api/_lib/irecruitSqlServer.js';
import { dbQuery, isPgUndefinedTable } from '../api/_lib/postgres.js';
import { APP_DEPARTMENT_CODES } from '../api/_lib/departmentScope.js';

const SOURCE = 'irecruit';
const dryRun = process.argv.includes('--dry');
const DEFAULT_SORT = 100;

type SrcJob = {
  id: string | number;
  name_th: string | null;
  name_en: string | null;
  type: string | null;
  status: string | null;
  seq: number | null;
};

function departmentCode(value: string | null): string | null {
  const s = String(value ?? '').trim().toUpperCase();
  return (APP_DEPARTMENT_CODES as readonly string[]).includes(s) ? s : null;
}

async function main() {
  // ⚠️ `--dry` ต้องดูได้**ก่อน**รัน migration (จุดประสงค์คือให้เจ้าของเห็นตัวเลขก่อน
  // ตัดสินใจว่าจะแตะฐาน production ไหม) — ตารางยังไม่มีจึงไม่ใช่ error ของ dry-run
  try {
    const before = await dbQuery<{ n: number }>('select count(*)::int n from recruit_job_titles');
    console.log(`ก่อนยก: recruit_job_titles ${before.rows[0].n} แถว`);
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
    console.log('ก่อนยก: ยังไม่มีตาราง recruit_job_titles — ต้องรัน migration 078 ก่อนยกจริง');
    if (!dryRun) {
      console.error('หยุด: รัน `node scripts/migrate.mjs` ก่อน แล้วสั่งยกอีกครั้ง');
      process.exit(2);
    }
  }

  const rows = await irecruitSqlQuery<SrcJob>(
    `SELECT id, name_th, name_en, type, status, seq
       FROM recruit_master_job
      WHERE owner = 'RM' AND deleted_at IS NULL
      ORDER BY id`,
  );
  console.log(`ต้นทาง (owner='RM', ไม่ถูกลบ): ${rows.length} ตำแหน่ง`);

  let ok = 0;
  let skipped = 0;
  let unknownDept = 0;
  const skippedWhy: string[] = [];
  for (const r of rows) {
    const name = String(r.name_th ?? '').trim();
    if (!name) {
      skipped += 1;
      skippedWhy.push(`id=${r.id} ไม่มีชื่อไทย`);
      continue;
    }
    const dept = departmentCode(r.type);
    if (!dept && String(r.type ?? '').trim()) unknownDept += 1;
    if (dryRun) {
      ok += 1;
      continue;
    }
    const nameEn = String(r.name_en ?? '').trim() || null;
    const sort = Number(r.seq);
    await dbQuery(
      `INSERT INTO recruit_job_titles (source, source_id, name, name_en, department_code, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (source, source_id) WHERE source IS NOT NULL
       DO UPDATE SET name = excluded.name,
                     name_en = excluded.name_en,
                     department_code = excluded.department_code,
                     sort_order = excluded.sort_order,
                     is_active = excluded.is_active,
                     updated_at = now()`,
      [
        SOURCE,
        String(r.id),
        name,
        nameEn,
        dept,
        Number.isFinite(sort) && sort > 0 ? sort : DEFAULT_SORT,
        String(r.status ?? '').trim() === 'active',
      ],
    );
    ok += 1;
  }

  console.log(`${dryRun ? 'จะยก' : 'ยกแล้ว'} ${ok} ตำแหน่ง · ข้าม ${skipped}`);
  if (unknownDept > 0) console.log(`  รหัส BU ที่เราไม่รู้จัก ${unknownDept} แถว → เก็บ department_code = null`);
  for (const s of skippedWhy) console.log(`  ข้าม: ${s}`);
  if (dryRun) {
    console.log('--dry: ไม่เขียนอะไรลงฐาน');
    return;
  }

  const after = await dbQuery<{ n: number; active: number; names: number }>(
    `select count(*)::int n,
            count(*) filter (where is_active)::int active,
            count(distinct lower(trim(name)))::int names
       from recruit_job_titles`,
  );
  const a = after.rows[0];
  console.log(`หลังยก: ${a.n} แถว (ใช้งานอยู่ ${a.active} · ชื่อไม่ซ้ำ ${a.names})`);
  const byDept = await dbQuery<{ department_code: string | null; n: number }>(
    `select department_code, count(*)::int n from recruit_job_titles group by 1 order by 2 desc`,
  );
  for (const g of byDept.rows) {
    console.log(`  BU ${g.department_code ?? '(ไม่ระบุ)'} = ${g.n}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

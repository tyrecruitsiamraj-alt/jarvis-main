/**
 * ยก master "เหตุผล" จาก iRecruit → `recruit_reasons`
 *
 *   npx tsx scripts/import-recruit-reasons.mts --dry
 *   npx tsx scripts/import-recruit-reasons.mts
 *
 * ต้นทาง `recruit_master_reason` (85 แถว) — **เอาเฉพาะ `owner = 'RM'`**
 * ของ IOO เป็นอีกหน่วยงาน ยกมาปนจะทำให้ dropdown ของ RM มีเหตุผทที่ใช้ไม่ได้
 *
 * ⚠️ กติกาเดียวกับ import ช่องทาง: upsert ตาม (`source`,`source_id`) ยกซ้ำได้
 * · สถานะ inactive ก็ยกมาติดธง `is_active = false` (รายงานย้อนหลังต้องหาชื่อเจอ)
 * · process ที่ไม่ใช่ 1/2/3 ข้ามทิ้งพร้อมรายงาน (ต้นทางมี process 6 ของ IOO)
 */
import '../server/bootstrap-env.js';
import { irecruitSqlQuery } from '../api/_lib/irecruitSqlServer.js';
import { dbQuery } from '../api/_lib/postgres.js';

const SOURCE = 'irecruit';
const dryRun = process.argv.includes('--dry');
const VALID_PROCESS = new Set(['1', '2', '3']);
const VALID_OUTCOME = new Set(['A', 'C']);

type SrcReason = {
  id: string | number;
  process_id: string | null;
  process_status: string | null;
  name: string | null;
  status: string | null;
};

async function main() {
  const before = await dbQuery<{ n: number }>('select count(*)::int n from recruit_reasons');
  console.log(`ก่อนยก: recruit_reasons ${before.rows[0].n} แถว`);

  const rows = await irecruitSqlQuery<SrcReason>(
    `SELECT id, process_id, process_status, name, status
       FROM recruit_master_reason
      WHERE owner = 'RM'
      ORDER BY process_id, process_status, id`,
  );
  console.log(`ต้นทาง (owner='RM'): ${rows.length} เหตุผล`);

  let ok = 0;
  let skipped = 0;
  const skippedWhy: string[] = [];
  for (const r of rows) {
    const name = String(r.name ?? '').trim();
    const proc = String(r.process_id ?? '').trim();
    const outcome = String(r.process_status ?? '').trim().toUpperCase();
    if (!name || !VALID_PROCESS.has(proc) || !VALID_OUTCOME.has(outcome)) {
      skipped += 1;
      skippedWhy.push(`id=${r.id} process=${proc} status=${outcome} name="${name}"`);
      continue;
    }
    if (dryRun) {
      ok += 1;
      continue;
    }
    await dbQuery(
      `INSERT INTO recruit_reasons (source, source_id, process_code, outcome_code, name, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (source, source_id) WHERE source IS NOT NULL
       DO UPDATE SET process_code = excluded.process_code,
                     outcome_code = excluded.outcome_code,
                     name = excluded.name,
                     is_active = excluded.is_active,
                     updated_at = now()`,
      [SOURCE, String(r.id), proc, outcome, name, String(r.status ?? '').trim() === 'active'],
    );
    ok += 1;
  }

  console.log(`${dryRun ? 'จะยก' : 'ยกแล้ว'} ${ok} เหตุผล · ข้าม ${skipped}`);
  for (const s of skippedWhy) console.log(`  ข้าม: ${s}`);
  if (dryRun) {
    console.log('--dry: ไม่เขียนอะไรลงฐาน');
    return;
  }

  const after = await dbQuery<{ n: number; active: number }>(
    `select count(*)::int n, count(*) filter (where is_active)::int active from recruit_reasons`,
  );
  console.log(`หลังยก: ${after.rows[0].n} แถว (ใช้งานอยู่ ${after.rows[0].active})`);
  const byGroup = await dbQuery<{ process_code: string; outcome_code: string; n: number }>(
    `select process_code, outcome_code, count(*)::int n from recruit_reasons
      group by process_code, outcome_code order by process_code, outcome_code`,
  );
  for (const g of byGroup.rows) {
    console.log(`  ขั้นตอน ${g.process_code} · ผล ${g.outcome_code} = ${g.n}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

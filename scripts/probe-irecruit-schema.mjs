import '../server/bootstrap-env.ts';
import { irecruitSqlQuery } from '../api/_lib/irecruitSqlServer.ts';

async function main() {
  // 1) ตารางทั้งหมดที่ชื่อขึ้นต้น recruit / z_ms (master data)
  const tables = await irecruitSqlQuery(`
    SELECT TABLE_NAME, TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME LIKE 'recruit%' OR TABLE_NAME LIKE 'z_ms%'
    ORDER BY TABLE_NAME
  `);
  console.log('=== TABLES (recruit* / z_ms*) ===');
  for (const t of tables) console.log(`  ${t.TABLE_NAME} (${t.TABLE_TYPE})`);

  // 2) คอลัมน์ทั้งหมดของ recruit_register
  const cols = await irecruitSqlQuery(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'recruit_register'
    ORDER BY ORDINAL_POSITION
  `);
  console.log('\n=== recruit_register COLUMNS (' + cols.length + ') ===');
  for (const c of cols) {
    const len = c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : '';
    console.log(`  ${c.COLUMN_NAME}: ${c.DATA_TYPE}${len} ${c.IS_NULLABLE === 'YES' ? 'null' : 'NOT NULL'}`);
  }

  // 3) job catalog — recruit_master_job (สำคัญสำหรับ adjacent matching)
  try {
    const jobs = await irecruitSqlQuery(`
      SELECT TOP 60 id, name_th
      FROM recruit_master_job
      ORDER BY name_th
    `);
    console.log('\n=== recruit_master_job (job catalog) TOP 60 of many ===');
    for (const j of jobs) console.log(`  [${j.id}] ${j.name_th}`);
  } catch (e) {
    console.log('\n(job catalog query failed:', e instanceof Error ? e.message : e, ')');
  }

  // 4) นับจำนวนผู้สมัคร owner=RM ที่ active
  try {
    const owner = (process.env.RECRUIT_REGISTER_OWNER || 'RM').trim();
    const cnt = await irecruitSqlQuery(
      `SELECT COUNT(*) AS n FROM recruit_register WHERE owner=@owner AND status='A' AND deleted_at IS NULL`,
      { owner },
    );
    console.log(`\n=== active candidates (owner=${owner}): ${cnt[0]?.n} ===`);
  } catch (e) {
    console.log('count failed:', e instanceof Error ? e.message : e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FAILED:', e instanceof Error ? e.message : e);
    process.exit(1);
  });

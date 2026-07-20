import '../server/bootstrap-env.ts';
import { irecruitSqlQuery } from '../api/_lib/irecruitSqlServer.ts';

const owner = (process.env.RECRUIT_REGISTER_OWNER || 'RM').trim();

async function section(title, fn) {
  console.log(`\n=== ${title} ===`);
  try {
    await fn();
  } catch (e) {
    console.log('  (failed:', e instanceof Error ? e.message : e, ')');
  }
}

async function main() {
  await section('recruit_master_job COUNT', async () => {
    const r = await irecruitSqlQuery(`SELECT COUNT(*) AS n FROM recruit_master_job`);
    console.log('  total jobs in catalog:', r[0]?.n);
  });

  await section('positionName (free-text) TOP 30 distinct ของ owner', async () => {
    const r = await irecruitSqlQuery(
      `SELECT DISTINCT TOP 30 CAST(positionName AS varchar(200)) AS pos
       FROM recruit_register
       WHERE owner=@owner AND status='A' AND deleted_at IS NULL
         AND positionName IS NOT NULL AND LEN(CAST(positionName AS varchar(200)))>0`,
      { owner },
    );
    for (const x of r) console.log('  -', x.pos);
  });

  await section('recruit_master_specific (ทักษะ/ข้อมูลเฉพาะ)', async () => {
    const cols = await irecruitSqlQuery(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='recruit_master_specific' ORDER BY ORDINAL_POSITION`,
    );
    console.log('  columns:', cols.map((c) => c.COLUMN_NAME).join(', '));
    const r = await irecruitSqlQuery(`SELECT TOP 20 * FROM recruit_master_specific`);
    for (const x of r) console.log('  ', JSON.stringify(x));
  });

  await section('recruit_master_license (ใบอนุญาต/ใบขับขี่)', async () => {
    const r = await irecruitSqlQuery(`SELECT TOP 20 * FROM recruit_master_license`);
    for (const x of r) console.log('  ', JSON.stringify(x));
  });

  await section('degree master? (degree_id ชี้ไปไหน) — ดูค่า distinct', async () => {
    const r = await irecruitSqlQuery(
      `SELECT DISTINCT TOP 20 degree_id FROM recruit_register WHERE owner=@owner AND degree_id IS NOT NULL`,
      { owner },
    );
    console.log('  distinct degree_id:', r.map((x) => x.degree_id).join(', '));
  });

  await section('z_ms_major (สาขาวิชา) ตัวอย่าง', async () => {
    const cols = await irecruitSqlQuery(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='z_ms_major' ORDER BY ORDINAL_POSITION`,
    );
    console.log('  columns:', cols.map((c) => c.COLUMN_NAME).join(', '));
  });

  await section('driving_license values (distinct TOP 15)', async () => {
    const r = await irecruitSqlQuery(
      `SELECT DISTINCT TOP 15 driving_license FROM recruit_register WHERE owner=@owner AND driving_license IS NOT NULL AND LEN(driving_license)>0`,
      { owner },
    );
    for (const x of r) console.log('  -', x.driving_license);
  });

  await section('SAMPLE candidate rows (mask ชื่อ/เบอร์) TOP 3', async () => {
    const r = await irecruitSqlQuery(
      `SELECT TOP 3
         LEFT(first_name,1)+'***' AS fn, sex, age, weight, height,
         driving_license, degree_id,
         CAST(positionName AS varchar(150)) AS positionName,
         job_interest_id, specific_information, province_cerrently_id, district_cerrently_id
       FROM recruit_register
       WHERE owner=@owner AND status='A' AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      { owner },
    );
    for (const x of r) console.log('  ', JSON.stringify(x));
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FAILED:', e instanceof Error ? e.message : e);
    process.exit(1);
  });

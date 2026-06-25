import pg from 'pg';
import fs from 'fs';

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

const env = { ...parseEnvFile('.env'), ...parseEnvFile('.env.local') };
const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.PG_SSL === 'false' ? undefined : { rejectUnauthorized: false },
});

async function main() {
  const schemas = (
    await pool.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name ILIKE '%operation%' OR schema_name ILIKE '%saleco%' ORDER BY 1`,
    )
  ).rows;
  console.log('schemas:', schemas);

  for (const { schema_name } of schemas) {
    const tables = (
      await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY 1`,
        [schema_name],
      )
    ).rows;
    console.log(`tables in ${schema_name}:`, tables.map((t) => t.table_name).join(', '));
  }

  for (const table of ['activity_to_saleco_head', 'activity_to_saleco', 'activity_to_saleco_request_position']) {
    const cols = (
      await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'so-operation' AND table_name = $1 ORDER BY ordinal_position`,
        [table],
      )
    ).rows;
    if (cols.length) console.log(`${table} cols:`, cols.map((c) => c.column_name).join(', '));
  }

  const sample = await pool.query(`
    SELECT h.act_saleco_id, h.request_no, h.act_saleco_datetime, h.site_code, h.request_action_code,
           h.staff_fullname, h.mobile_phone, h.act_saleco_effective_date, h.requester_id,
           ma.request_action_name,
           p.request_position_unit,
           a.resignation, a.reason_leaving_main_code, a.reason_leaving_sub_code,
           a.vehicle_type_code, a.vehicle_remark, a.vehicle_kind_code
    FROM "so-operation"."activity_to_saleco_head" h
    LEFT JOIN "so-operation"."activity_to_saleco" a ON a.act_saleco_id::text = h.act_saleco_id::text
    LEFT JOIN "so-operation"."activity_to_saleco_request_position" p ON p.act_saleco_id::text = h.act_saleco_id::text
    LEFT JOIN "so-operation"."ms_activity" ma ON ma.request_action_code = h.request_action_code
    WHERE h.request_action_code = 'RESIGN'
    ORDER BY h.act_saleco_datetime DESC NULLS LAST
    LIMIT 5
  `);
  console.log('RESIGN sample:', JSON.stringify(sample.rows, null, 2));

  const rateCols = (
    await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'so-operation' AND table_name = 'activity_to_saleco_r_detail' ORDER BY ordinal_position`,
    )
  ).rows;
  console.log('r_detail cols:', rateCols.map((c) => c.column_name).join(', '));

  const activities = await pool.query(`SELECT request_action_code, request_action_name FROM "so-operation"."ms_activity" ORDER BY 1`);
  console.log('activities:', activities.rows);

  const resignWithStaff = await pool.query(`
    SELECT h.request_no, h.staff_id, h.staff_fullname, h.created_by_user_id,
           u.display_name as requester_name, u.email
    FROM "so-operation"."activity_to_saleco_head" h
    LEFT JOIN "so-operation"."sys_user" u ON u.user_id::text = COALESCE(h.requester_id, h.created_by_user_id)::text
    WHERE h.request_action_code = 'RESIGN'
    ORDER BY h.act_saleco_datetime DESC
    LIMIT 3
  `).catch(() => ({ rows: [] }));
  console.log('requester sample:', resignWithStaff.rows);

  const reasons = await pool.query(`SELECT * FROM "so-operation"."ms_reason_leaving_main" LIMIT 10`).catch(async () => {
    const c = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='so-operation' AND table_name='ms_reason_leaving_main'`);
    console.log('ms_reason_leaving_main cols', c.rows);
    return { rows: [] };
  });
  console.log('reasons main:', reasons.rows);

  const vehicleTypes = await pool.query(`SELECT * FROM "so-operation"."ms_vehicle_type" LIMIT 5`);
  console.log('vehicle types:', vehicleTypes.rows);

  const userCols = (
    await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='so-operation' AND table_name='sys_user' ORDER BY 1`,
    )
  ).rows;
  console.log('sys_user cols:', userCols.map((c) => c.column_name).join(', '));

  const queue = await pool.query(`
    SELECT COUNT(*)::int AS n FROM "so-operation"."activity_to_saleco_head" h
    WHERE h.act_saleco_need_staff = true AND h.rm_staffing_ack_at IS NULL AND h.status IN ('OP','PA','RE','IP')
  `);
  console.log('staffing queue count:', queue.rows[0].n);

  const requester = await pool.query(`
    SELECT h.request_no, h.created_by_user_id,
           trim(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS requester_name,
           u.email
    FROM "so-operation"."activity_to_saleco_head" h
    LEFT JOIN "so-operation"."sys_user" u ON u.id = h.created_by_user_id
    WHERE h.created_by_user_id IS NOT NULL
    LIMIT 3
  `);
  console.log('requester:', requester.rows);

  const deptCols = (
    await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='so-operation' AND table_name='sys_department' ORDER BY 1`,
    )
  ).rows;
  console.log('sys_department cols:', deptCols.map((c) => c.column_name).join(', '));

  const queueRow = await pool.query(`
    SELECT h.act_saleco_id, h.request_no, h.act_saleco_datetime, h.act_saleco_effective_date,
           h.site_code, h.status, h.staff_fullname, h.staff_id, h.mobile_phone,
           h.job_description_code_1, h.job_description_code_2, h.staff_title_code,
           trim(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS requester_name,
           ma.request_action_name, ma.request_action_code,
           p.request_position_unit,
           a.resignation, a.reason_leaving_main_code, rm.name AS reason_main_name,
           rs.name AS reason_sub_name,
           vt.name AS vehicle_type_name, a.vehicle_remark
    FROM "so-operation"."activity_to_saleco_head" h
    LEFT JOIN "so-operation"."sys_user" u ON u.id = h.created_by_user_id
    LEFT JOIN "so-operation"."ms_activity" ma ON ma.request_action_code = h.request_action_code
    LEFT JOIN "so-operation"."activity_to_saleco" a ON a.act_saleco_id::text = h.act_saleco_id::text
    LEFT JOIN "so-operation"."activity_to_saleco_request_position" p ON p.act_saleco_id::text = h.act_saleco_id::text AND p.seq = 1
    LEFT JOIN "so-operation"."ms_reason_leaving_main" rm ON rm.code = a.reason_leaving_main_code
    LEFT JOIN "so-operation"."ms_reason_leaving_sub" rs ON rs.code = a.reason_leaving_sub_code
    LEFT JOIN "so-operation"."ms_vehicle_type" vt ON vt.code = a.vehicle_type_code
    WHERE h.act_saleco_need_staff = true AND h.rm_staffing_ack_at IS NULL AND h.status IN ('OP','PA','RE','IP')
    ORDER BY h.act_saleco_datetime DESC
    LIMIT 2
  `);
  console.log('queue sample:', JSON.stringify(queueRow.rows, null, 2));
}

main()
  .catch((e) => console.error('ERR', e.message))
  .finally(() => pool.end());

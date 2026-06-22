/**
 * Seed Driver Care demo data: drivers, income, calendar, complaints, actions.
 * Run: npm run db:seed:driver-care
 * Requires: npm run db:migrate (021_driver_care_tables.sql)
 */
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnvFromFiles() {
  const merged = { ...process.env };
  for (const name of ['.env', '.env.local']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i <= 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      merged[key] = val;
    }
  }
  return merged;
}

function stableUuid(mockId: string): string {
  const h = createHash('sha256').update(`jarvis-dc-seed:${mockId}`).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function monthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

type DriverProfile = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  site: string;
  scenario: 'high_income_leave' | 'high_complaint' | 'medium_leave' | 'watch_attendance' | 'low';
};

const SITES = ['Central Plaza Rama IX', 'Mega Bangna', 'EmQuartier', 'Siam Paragon'];

const profiles: DriverProfile[] = [
  { id: 'dc-01', code: 'DC-001', firstName: 'สมชาย', lastName: 'รายได้ลด', site: SITES[0]!, scenario: 'high_income_leave' },
  { id: 'dc-02', code: 'DC-002', firstName: 'วิชัย', lastName: 'ร้องเรียน', site: SITES[1]!, scenario: 'high_complaint' },
  { id: 'dc-03', code: 'DC-003', firstName: 'ประเสริฐ', lastName: 'ลาต่อเนื่อง', site: SITES[2]!, scenario: 'medium_leave' },
  { id: 'dc-04', code: 'DC-004', firstName: 'อนุชา', lastName: 'มาสาย', site: SITES[3]!, scenario: 'watch_attendance' },
  ...Array.from({ length: 26 }, (_, i) => {
    const n = i + 5;
    const pad = String(n).padStart(3, '0');
    return {
      id: `dc-${pad}`,
      code: `DC-${pad}`,
      firstName: `คนขับ${n}`,
      lastName: 'ปกติ',
      site: SITES[n % SITES.length]!,
      scenario: 'low' as const,
    };
  }),
];

const env = loadEnvFromFiles();
const databaseUrl = (env.DATABASE_URL || env.POSTGRES_URL || '').trim();
const pgSsl = ['true', '1', 'yes'].includes(String(env.PG_SSL || '').toLowerCase());
const schema = String(env.PGSCHEMA || env.DATABASE_SCHEMA || '').trim();
const validSchema = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema) ? schema : '';

if (!databaseUrl) {
  console.error('Missing DATABASE_URL or POSTGRES_URL');
  process.exit(1);
}
if (!validSchema) {
  console.error('Missing or invalid PGSCHEMA (e.g. jarvis_rm)');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: pgSsl ? { rejectUnauthorized: false } : undefined,
  max: 2,
});

async function upsertEmployee(client: pg.PoolClient, p: DriverProfile) {
  const id = stableUuid(p.id);
  await client.query(
    `INSERT INTO employees (
      id, employee_code, first_name, last_name, nickname, phone, status, position, join_date,
      reliability_score, utilization_rate
    ) VALUES ($1::uuid, $2, $3, $4, $5, $6, 'active', $7, $8::date, 80, 70)
    ON CONFLICT (id) DO UPDATE SET
      employee_code = EXCLUDED.employee_code,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      position = EXCLUDED.position,
      status = 'active'`,
    [
      id,
      p.code,
      p.firstName,
      p.lastName,
      p.firstName,
      `08${String(10000000 + profiles.indexOf(p)).slice(-8)}`,
      'พนักงานขับรถ',
      ymd(addDays(new Date(), -365)),
    ],
  );
  return id;
}

async function upsertIncome(
  client: pg.PoolClient,
  empId: string,
  month: string,
  total: number,
  otHours: number,
) {
  const base = Math.round(total * 0.6);
  const otAmt = Math.round(total * 0.25);
  await client.query(
    `INSERT INTO driver_income_monthly (
      employee_id, income_month, base_salary, ot_hours, ot_amount, allowance_amount,
      incentive_amount, deduction_amount, total_income, paid_days
    ) VALUES ($1::uuid, $2::date, $3, $4, $5, $6, $7, 0, $8, 26)
    ON CONFLICT (employee_id, income_month) DO UPDATE SET
      total_income = EXCLUDED.total_income,
      ot_hours = EXCLUDED.ot_hours,
      ot_amount = EXCLUDED.ot_amount,
      updated_at = now()`,
    [empId, month, base, otHours, otAmt, 500, 300, total],
  );
}

async function upsertCalendar(
  client: pg.PoolClient,
  empId: string,
  workDate: string,
  site: string,
  status: string,
) {
  const wcId = stableUuid(`wc:${empId}:${workDate}`);
  await client.query(
    `INSERT INTO work_calendar (id, employee_id, work_date, client_name, shift, status)
     VALUES ($1::uuid, $2::uuid, $3::date, $4, 'day', $5)
     ON CONFLICT (employee_id, work_date) DO UPDATE SET
       client_name = EXCLUDED.client_name,
       status = EXCLUDED.status,
       updated_at = now()`,
    [wcId, empId, workDate, site, status],
  );
}

async function seedDriverData(client: pg.PoolClient, p: DriverProfile, empId: string, today: Date) {
  const m0 = monthStart(today);
  const m1 = monthStart(addDays(today, -32));
  const m2 = monthStart(addDays(today, -64));

  if (p.scenario === 'high_income_leave') {
    await upsertIncome(client, empId, m2, 32000, 40);
    await upsertIncome(client, empId, m1, 31000, 38);
    await upsertIncome(client, empId, m0, 22000, 20);
  } else if (p.scenario === 'high_complaint') {
    await upsertIncome(client, empId, m2, 28000, 30);
    await upsertIncome(client, empId, m1, 28500, 32);
    await upsertIncome(client, empId, m0, 29000, 30);
  } else {
    const base = 27000 + (profiles.indexOf(p) % 5) * 500;
    await upsertIncome(client, empId, m2, base, 30);
    await upsertIncome(client, empId, m1, base + 200, 32);
    await upsertIncome(client, empId, m0, base + 100, 31);
  }

  for (let i = 89; i >= 0; i -= 1) {
    const d = addDays(today, -i);
    const dateStr = ymd(d);
    let status = 'normal_work';

    if (p.scenario === 'high_income_leave') {
      const daysAgo = i;
      if (daysAgo <= 30 && daysAgo % 5 === 0) status = 'day_off';
      else if (daysAgo > 30 && daysAgo <= 90 && daysAgo % 20 === 0) status = 'day_off';
    } else if (p.scenario === 'medium_leave') {
      if (i >= 2 && i <= 4) status = 'day_off';
      else if (i <= 30 && i % 6 === 0) status = 'cancel_by_employee';
      else if (i > 30 && i <= 90 && i % 25 === 0) status = 'day_off';
    } else if (p.scenario === 'watch_attendance') {
      if (i === 5) status = 'no_show';
      else if (i <= 20 && [3, 7, 11].includes(i)) status = 'late';
    }

    await upsertCalendar(client, empId, dateStr, p.site, status);
  }

  if (p.scenario === 'high_complaint') {
    const d1 = ymd(addDays(today, -15));
    const d2 = ymd(addDays(today, -8));
    await client.query(
      `INSERT INTO driver_complaint_event (employee_id, event_date, event_source, event_type, severity, client_name, description)
       VALUES ($1::uuid, $2::date, 'client', 'client_complaint', 'high', $3, 'ลูกค้าร้องเรียนพฤติกรรม')`,
      [empId, d1, p.site],
    );
    await client.query(
      `INSERT INTO driver_complaint_event (employee_id, event_date, event_source, event_type, severity, client_name, description)
       VALUES ($1::uuid, $2::date, 'client', 'request_change_driver', 'high', $3, 'ลูกค้าขอเปลี่ยนคนขับ')`,
      [empId, d2, p.site],
    );
  }

  if (p.scenario === 'high_income_leave') {
    await client.query(
      `INSERT INTO driver_resignation_history (
        employee_id, employee_code, employee_name, resignation_date, resignation_reason_group, resignation_reason_text
      ) VALUES ($1::uuid, $2, $3, $4::date, 'income', 'รายได้ไม่พอใจ')`,
      [empId, p.code, `${p.firstName} ${p.lastName}`, ymd(addDays(today, -400))],
    );
  }
  if (p.scenario === 'medium_leave') {
    await client.query(
      `INSERT INTO driver_resignation_history (
        employee_id, employee_code, employee_name, resignation_date, resignation_reason_group, resignation_reason_text
      ) VALUES ($1::uuid, $2, $3, $4::date, 'workload', 'งานหนัก')`,
      [empId, p.code, `${p.firstName} ${p.lastName}`, ymd(addDays(today, -500))],
    );
  }
}

async function main() {
  const today = new Date();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${validSchema}", public`);

    const hasTable = async (name: string) =>
      (
        await client.query(
          `select 1 from information_schema.tables where table_schema = $1 and table_name = $2`,
          [validSchema, name],
        )
      ).rows.length > 0;

    for (const t of [
      'driver_income_monthly',
      'driver_resignation_history',
      'driver_complaint_event',
      'driver_risk_score',
      'driver_action_log',
    ]) {
      if (!(await hasTable(t))) {
        console.error(`Missing table ${t}. Run npm run db:migrate first.`);
        process.exit(1);
      }
    }

    const dcIds = profiles.map((p) => stableUuid(p.id));
    await client.query(
      `DELETE FROM driver_action_log WHERE employee_id = any($1::uuid[])`,
      [dcIds],
    );
    await client.query(
      `DELETE FROM driver_risk_score WHERE employee_id = any($1::uuid[])`,
      [dcIds],
    );
    await client.query(
      `DELETE FROM driver_complaint_event WHERE employee_id = any($1::uuid[])`,
      [dcIds],
    );
    await client.query(
      `DELETE FROM driver_income_monthly WHERE employee_id = any($1::uuid[])`,
      [dcIds],
    );
    await client.query(
      `DELETE FROM driver_resignation_history WHERE employee_id = any($1::uuid[])`,
      [dcIds],
    );

    const empIds: { profile: DriverProfile; id: string }[] = [];
    for (const p of profiles) {
      const id = await upsertEmployee(client, p);
      empIds.push({ profile: p, id });
      await seedDriverData(client, p, id, today);
    }
    console.log('Drivers seeded:', empIds.length);
  } finally {
    client.release();
    await pool.end();
  }

  process.env.DATABASE_URL = databaseUrl;
  process.env.PGSCHEMA = validSchema;
  if (pgSsl) process.env.PG_SSL = 'true';

  const { recalculateRiskScores } = await import('../api/_lib/driverCareRisk.js');
  const count = await recalculateRiskScores();
  console.log('Risk scores recalculated:', count);

  const pool2 = new pg.Pool({
    connectionString: databaseUrl,
    ssl: pgSsl ? { rejectUnauthorized: false } : undefined,
    max: 2,
  });
  const client2 = await pool2.connect();
  try {
    await client2.query(`SET search_path TO "${validSchema}", public`);

    const overdueEmp = stableUuid('dc-01');
    const closedEmp = stableUuid('dc-02');
    const pendingEmp = stableUuid('dc-03');

    const riskRows = await client2.query<{ id: string; employee_id: string }>(
      `select id, employee_id from driver_risk_score where score_date = current_date`,
    );

    const riskByEmp = new Map(riskRows.rows.map((r) => [r.employee_id, r.id]));

    const insertAction = async (
      empId: string,
      fields: {
        actionType: string;
        issueFound: string;
        actionTaken: string;
        result: string;
        status: string;
        nextFollowUp: string | null;
        daysAgo: number;
      },
    ) => {
      const riskId = riskByEmp.get(empId) ?? null;
      await client2.query(
        `INSERT INTO driver_action_log (
          risk_score_id, employee_id, action_date, action_by_name,
          action_type, contact_status, issue_found, action_taken, result,
          next_follow_up_date, status, closed_date
        ) VALUES (
          $1::uuid, $2::uuid, now() - ($3 || ' days')::interval, 'Driver Care Demo',
          $4, 'contacted', $5, $6, $7, $8::date, $9,
          CASE WHEN $9 = 'closed' THEN now() ELSE NULL END
        )`,
        [
          riskId,
          empId,
          String(fields.daysAgo),
          fields.actionType,
          fields.issueFound,
          fields.actionTaken,
          fields.result,
          fields.nextFollowUp,
          fields.status,
        ],
      );
    };

    await insertAction(overdueEmp, {
      actionType: 'call',
      issueFound: 'income_drop',
      actionTaken: 'โทรติดตามรายได้ รอผู้บังคับบัญชายืนยัน',
      result: 'pending',
      status: 'in_progress',
      nextFollowUp: ymd(addDays(today, -7)),
      daysAgo: 14,
    });

    await insertAction(closedEmp, {
      actionType: 'meeting',
      issueFound: 'client_issue',
      actionTaken: 'ประชุมกับลูกค้าและ Supervisor แล้ว',
      result: 'stay',
      status: 'closed',
      nextFollowUp: null,
      daysAgo: 10,
    });

    await insertAction(pendingEmp, {
      actionType: 'site_check',
      issueFound: 'leave_issue',
      actionTaken: 'รอนัดคุยกับคนขับ',
      result: 'pending',
      status: 'pending',
      nextFollowUp: ymd(addDays(today, 5)),
      daysAgo: 2,
    });

    console.log('Action logs seeded (overdue, closed, pending).');
    console.log(`Done — Driver Care demo in schema "${validSchema}".`);
  } finally {
    client2.release();
    await pool2.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

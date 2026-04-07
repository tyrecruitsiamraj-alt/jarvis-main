/**
 * โหลดข้อมูลตัวอย่างจาก src/data/mockData.ts เข้า PostgreSQL (schema จาก PGSCHEMA เช่น jarvis_rm)
 * Idempotent: ON CONFLICT อัปเดตแถวเดิม
 *
 * mock ใช้ id สตริง (cd1, j1) — แปลงเป็น UUID คงที่ด้วยแฮชเพื่อให้ตรงกับคอลัมน์ uuid
 *
 * รัน: npm run db:seed:demo
 * แนะนำ: npm run db:migrate ให้ครบก่อน
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import {
  mockJobRequests,
  mockCandidates,
  mockEmployees,
  mockClients,
  mockWorkCalendar,
  mockTrainingRecords,
  mockCandidateInterviews,
  mockCandidateWorkHistory,
} from "../src/data/mockData";
import type { Candidate } from "../src/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvFromFiles() {
  const merged = { ...process.env };
  for (const name of [".env", ".env.local"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
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

function toTs(d: string | undefined): string | null {
  if (!d || !String(d).trim()) return null;
  const s = String(d).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return `${s}T12:00:00.000Z`;
}

/** แปลง id จาก mock (เช่น cd1, j1) เป็น uuid แบบคงที่ทุกครั้งที่รัน seed */
function stableUuidFromMockId(mockId: string): string {
  const h = createHash("sha256").update(`jarvis-seed:${mockId}`).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const env = loadEnvFromFiles();
const databaseUrl = (env.DATABASE_URL || env.POSTGRES_URL || "").trim();
const pgSsl = ["true", "1", "yes"].includes(String(env.PG_SSL || "").toLowerCase());
const schema = String(env.PGSCHEMA || env.DATABASE_SCHEMA || "").trim();
const validSchema = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema) ? schema : "";

if (!databaseUrl) {
  console.error("Missing DATABASE_URL or POSTGRES_URL");
  process.exit(1);
}

if (!validSchema) {
  console.error("Missing or invalid PGSCHEMA (e.g. jarvis_rm)");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: pgSsl ? { rejectUnauthorized: false } : undefined,
  max: 2,
});

async function tableColumnSet(
  client: pg.PoolClient,
  schemaName: string,
  tableName: string,
): Promise<Set<string>> {
  const r = await client.query<{ column_name: string }>(
    `select column_name from information_schema.columns
     where table_schema = $1 and table_name = $2`,
    [schemaName, tableName],
  );
  return new Set(r.rows.map((x) => x.column_name));
}

async function upsertCandidateRow(
  client: pg.PoolClient,
  c: Candidate,
  hasTitlePrefix: boolean,
  hasStaffingTrack: boolean,
) {
  const st =
    c.staffing_track === "wl" || c.staffing_track === "ex"
      ? c.staffing_track
      : "regular";
  const ts = toTs(c.created_at);

  if (hasTitlePrefix && hasStaffingTrack) {
    await client.query(
      `
      INSERT INTO candidates (
        id, title_prefix, first_name, last_name, phone, age, gender,
        drinking, smoking, tattoo, van_driving, sedan_driving,
        address, lat, lng,
        application_date, first_contact_date, first_work_date,
        status, responsible_recruiter, risk_percentage, staffing_track, created_at
      ) VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16::date, $17::date, $18::date,
        $19, $20, $21, $22, COALESCE($23::timestamptz, now())
      )
      ON CONFLICT (id) DO UPDATE SET
        title_prefix = EXCLUDED.title_prefix,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        age = EXCLUDED.age,
        gender = EXCLUDED.gender,
        drinking = EXCLUDED.drinking,
        smoking = EXCLUDED.smoking,
        tattoo = EXCLUDED.tattoo,
        van_driving = EXCLUDED.van_driving,
        sedan_driving = EXCLUDED.sedan_driving,
        address = EXCLUDED.address,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        application_date = EXCLUDED.application_date,
        first_contact_date = EXCLUDED.first_contact_date,
        first_work_date = EXCLUDED.first_work_date,
        status = EXCLUDED.status,
        responsible_recruiter = EXCLUDED.responsible_recruiter,
        risk_percentage = EXCLUDED.risk_percentage,
        staffing_track = EXCLUDED.staffing_track,
        created_at = EXCLUDED.created_at
      `,
        [
        stableUuidFromMockId(c.id),
        c.title_prefix?.trim() || null,
        c.first_name,
        c.last_name,
        c.phone,
        c.age,
        c.gender,
        c.drinking,
        c.smoking,
        c.tattoo,
        c.van_driving,
        c.sedan_driving,
        c.address,
        c.lat ?? null,
        c.lng ?? null,
        c.application_date,
        c.first_contact_date ?? null,
        c.first_work_date ?? null,
        c.status,
        c.responsible_recruiter ?? null,
        c.risk_percentage,
        st,
        ts,
      ],
    );
    return;
  }

  if (hasTitlePrefix) {
    await client.query(
      `
      INSERT INTO candidates (
        id, title_prefix, first_name, last_name, phone, age, gender,
        drinking, smoking, tattoo, van_driving, sedan_driving,
        address, lat, lng,
        application_date, first_contact_date, first_work_date,
        status, responsible_recruiter, risk_percentage, created_at
      ) VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16::date, $17::date, $18::date,
        $19, $20, $21, COALESCE($22::timestamptz, now())
      )
      ON CONFLICT (id) DO UPDATE SET
        title_prefix = EXCLUDED.title_prefix,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        age = EXCLUDED.age,
        gender = EXCLUDED.gender,
        drinking = EXCLUDED.drinking,
        smoking = EXCLUDED.smoking,
        tattoo = EXCLUDED.tattoo,
        van_driving = EXCLUDED.van_driving,
        sedan_driving = EXCLUDED.sedan_driving,
        address = EXCLUDED.address,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        application_date = EXCLUDED.application_date,
        first_contact_date = EXCLUDED.first_contact_date,
        first_work_date = EXCLUDED.first_work_date,
        status = EXCLUDED.status,
        responsible_recruiter = EXCLUDED.responsible_recruiter,
        risk_percentage = EXCLUDED.risk_percentage,
        created_at = EXCLUDED.created_at
      `,
      [
        stableUuidFromMockId(c.id),
        c.title_prefix?.trim() || null,
        c.first_name,
        c.last_name,
        c.phone,
        c.age,
        c.gender,
        c.drinking,
        c.smoking,
        c.tattoo,
        c.van_driving,
        c.sedan_driving,
        c.address,
        c.lat ?? null,
        c.lng ?? null,
        c.application_date,
        c.first_contact_date ?? null,
        c.first_work_date ?? null,
        c.status,
        c.responsible_recruiter ?? null,
        c.risk_percentage,
        ts,
      ],
    );
    return;
  }

  await client.query(
    `
    INSERT INTO candidates (
      id, first_name, last_name, phone, age, gender,
      drinking, smoking, tattoo, van_driving, sedan_driving,
      address, lat, lng,
      application_date, first_contact_date, first_work_date,
      status, responsible_recruiter, risk_percentage, created_at
    ) VALUES (
      $1::uuid, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13, $14,
      $15::date, $16::date, $17::date,
      $18, $19, $20, COALESCE($21::timestamptz, now())
    )
    ON CONFLICT (id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone = EXCLUDED.phone,
      age = EXCLUDED.age,
      gender = EXCLUDED.gender,
      drinking = EXCLUDED.drinking,
      smoking = EXCLUDED.smoking,
      tattoo = EXCLUDED.tattoo,
      van_driving = EXCLUDED.van_driving,
      sedan_driving = EXCLUDED.sedan_driving,
      address = EXCLUDED.address,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      application_date = EXCLUDED.application_date,
      first_contact_date = EXCLUDED.first_contact_date,
      first_work_date = EXCLUDED.first_work_date,
      status = EXCLUDED.status,
      responsible_recruiter = EXCLUDED.responsible_recruiter,
      risk_percentage = EXCLUDED.risk_percentage,
      created_at = EXCLUDED.created_at
    `,
    [
      stableUuidFromMockId(c.id),
      c.first_name,
      c.last_name,
      c.phone,
      c.age,
      c.gender,
      c.drinking,
      c.smoking,
      c.tattoo,
      c.van_driving,
      c.sedan_driving,
      c.address,
      c.lat ?? null,
      c.lng ?? null,
      c.application_date,
      c.first_contact_date ?? null,
      c.first_work_date ?? null,
      c.status,
      c.responsible_recruiter ?? null,
      c.risk_percentage,
      ts,
    ],
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${validSchema}", public`);

    const candCols = await tableColumnSet(client, validSchema, "candidates");
    const hasTP = candCols.has("title_prefix");
    const hasST = candCols.has("staffing_track");
    if (!hasST) {
      console.warn(
        "คำเตือน: ตาราง candidates ยังไม่มี staffing_track — รัน npm run db:migrate ให้ครบเพื่อให้ตรงกับแอปล่าสุด",
      );
    }

    let nCand = 0;
    for (const c of mockCandidates) {
      await upsertCandidateRow(client, c, hasTP, hasST);
      nCand++;
    }
    console.log("Candidates upserted:", nCand);

    let nJobs = 0;
    for (const j of mockJobRequests) {
      await client.query(
        `
        INSERT INTO jobs (
          id, unit_name, request_date, required_date, urgency, total_income,
          location_address, lat, lng, job_type, job_category,
          recruiter_name, screener_name,
          age_range_min, age_range_max, vehicle_required, work_schedule,
          penalty_per_day, days_without_worker, total_penalty,
          status, closed_date, created_at
        ) VALUES (
          $1::uuid, $2, $3::date, $4::date, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22::date, COALESCE($23::timestamptz, now())
        )
        ON CONFLICT (id) DO UPDATE SET
          unit_name = EXCLUDED.unit_name,
          request_date = EXCLUDED.request_date,
          required_date = EXCLUDED.required_date,
          urgency = EXCLUDED.urgency,
          total_income = EXCLUDED.total_income,
          location_address = EXCLUDED.location_address,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          job_type = EXCLUDED.job_type,
          job_category = EXCLUDED.job_category,
          recruiter_name = EXCLUDED.recruiter_name,
          screener_name = EXCLUDED.screener_name,
          age_range_min = EXCLUDED.age_range_min,
          age_range_max = EXCLUDED.age_range_max,
          vehicle_required = EXCLUDED.vehicle_required,
          work_schedule = EXCLUDED.work_schedule,
          penalty_per_day = EXCLUDED.penalty_per_day,
          days_without_worker = EXCLUDED.days_without_worker,
          total_penalty = EXCLUDED.total_penalty,
          status = EXCLUDED.status,
          closed_date = EXCLUDED.closed_date,
          created_at = EXCLUDED.created_at
        `,
        [
          stableUuidFromMockId(j.id),
          j.unit_name,
          j.request_date,
          j.required_date,
          j.urgency,
          j.total_income,
          j.location_address,
          j.lat ?? null,
          j.lng ?? null,
          j.job_type,
          j.job_category,
          j.recruiter_name ?? null,
          j.screener_name ?? null,
          j.age_range_min ?? null,
          j.age_range_max ?? null,
          j.vehicle_required ?? null,
          j.work_schedule ?? null,
          j.penalty_per_day,
          j.days_without_worker,
          j.total_penalty,
          j.status,
          j.closed_date ?? null,
          toTs(j.created_at),
        ],
      );
      nJobs++;
    }
    console.log("Jobs upserted:", nJobs);

    let nEmp = 0;
    for (const e of mockEmployees) {
      await client.query(
        `
        INSERT INTO employees (
          id, employee_code, first_name, last_name, nickname, phone, status, position, join_date,
          address, lat, lng, reliability_score, utilization_rate, total_days_worked,
          total_income, total_cost, total_issues, created_at
        ) VALUES (
          $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::date,
          $10, $11, $12, $13, $14, $15, $16, $17, $18,
          COALESCE($19::timestamptz, now())
        )
        ON CONFLICT (id) DO UPDATE SET
          employee_code = EXCLUDED.employee_code,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          nickname = EXCLUDED.nickname,
          phone = EXCLUDED.phone,
          status = EXCLUDED.status,
          position = EXCLUDED.position,
          join_date = EXCLUDED.join_date,
          address = EXCLUDED.address,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          reliability_score = EXCLUDED.reliability_score,
          utilization_rate = EXCLUDED.utilization_rate,
          total_days_worked = EXCLUDED.total_days_worked,
          total_income = EXCLUDED.total_income,
          total_cost = EXCLUDED.total_cost,
          total_issues = EXCLUDED.total_issues,
          created_at = EXCLUDED.created_at
        `,
        [
          stableUuidFromMockId(e.id),
          e.employee_code,
          e.first_name,
          e.last_name,
          e.nickname ?? null,
          e.phone,
          e.status,
          e.position,
          e.join_date,
          e.address ?? null,
          e.lat ?? null,
          e.lng ?? null,
          e.reliability_score,
          e.utilization_rate,
          e.total_days_worked,
          e.total_income,
          e.total_cost,
          e.total_issues,
          toTs(e.created_at),
        ],
      );
      nEmp++;
    }
    console.log("Employees upserted:", nEmp);

    const hasTable = async (tableName: string) =>
      (
        await client.query(
          `select 1 from information_schema.tables where table_schema = $1 and table_name = $2`,
          [validSchema, tableName],
        )
      ).rows.length > 0;

    if (await hasTable("client_workplaces")) {
      let nCli = 0;
      for (const c of mockClients) {
        await client.query(
          `
          INSERT INTO client_workplaces (
            id, name, address, lat, lng, contact_person, contact_phone,
            default_income, default_cost, default_shift, job_type, job_category, is_active, created_at
          ) VALUES (
            $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14::timestamptz, now())
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            address = EXCLUDED.address,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            contact_person = EXCLUDED.contact_person,
            contact_phone = EXCLUDED.contact_phone,
            default_income = EXCLUDED.default_income,
            default_cost = EXCLUDED.default_cost,
            default_shift = EXCLUDED.default_shift,
            job_type = EXCLUDED.job_type,
            job_category = EXCLUDED.job_category,
            is_active = EXCLUDED.is_active,
            created_at = EXCLUDED.created_at
        `,
          [
            stableUuidFromMockId(c.id),
            c.name,
            c.address,
            c.lat ?? null,
            c.lng ?? null,
            c.contact_person ?? null,
            c.contact_phone ?? null,
            c.default_income,
            c.default_cost,
            c.default_shift,
            c.job_type,
            c.job_category,
            c.is_active,
            toTs(c.created_at),
          ],
        );
        nCli++;
      }
      console.log("Client workplaces upserted:", nCli);
    }

    if (await hasTable("work_calendar")) {
      let nWc = 0;
      for (const w of mockWorkCalendar) {
        const clientUuid = w.client_id ? stableUuidFromMockId(w.client_id) : null;
        await client.query(
          `
          INSERT INTO work_calendar (
            id, employee_id, work_date, client_id, client_name, shift, status,
            income, cost, issue_reason, created_at, updated_at
          ) VALUES (
            $1::uuid, $2::uuid, $3::date, $4::uuid, $5, $6, $7, $8, $9, $10,
            COALESCE($11::timestamptz, now()), COALESCE($12::timestamptz, now())
          )
          ON CONFLICT (employee_id, work_date) DO UPDATE SET
            client_id = EXCLUDED.client_id,
            client_name = EXCLUDED.client_name,
            shift = EXCLUDED.shift,
            status = EXCLUDED.status,
            income = EXCLUDED.income,
            cost = EXCLUDED.cost,
            issue_reason = EXCLUDED.issue_reason,
            updated_at = EXCLUDED.updated_at
        `,
          [
            stableUuidFromMockId(w.id),
            stableUuidFromMockId(w.employee_id),
            w.work_date,
            clientUuid,
            w.client_name ?? null,
            w.shift ?? null,
            w.status,
            w.income ?? null,
            w.cost ?? null,
            w.issue_reason ?? null,
            toTs(w.created_at),
            toTs(w.updated_at),
          ],
        );
        nWc++;
      }
      console.log("Work calendar upserted:", nWc);
    }

    if (await hasTable("training_records")) {
      let nTr = 0;
      for (const t of mockTrainingRecords) {
        await client.query(
          `
          INSERT INTO training_records (id, employee_id, training_name, training_date, result, notes, created_at)
          VALUES ($1::uuid, $2::uuid, $3, $4::date, $5, $6, now())
          ON CONFLICT (id) DO UPDATE SET
            employee_id = EXCLUDED.employee_id,
            training_name = EXCLUDED.training_name,
            training_date = EXCLUDED.training_date,
            result = EXCLUDED.result,
            notes = EXCLUDED.notes
        `,
          [
            stableUuidFromMockId(t.id),
            stableUuidFromMockId(t.employee_id),
            t.training_name,
            t.training_date,
            t.result,
            t.notes ?? null,
          ],
        );
        nTr++;
      }
      console.log("Training records upserted:", nTr);
    }

    if (await hasTable("candidate_interviews")) {
      let nIv = 0;
      for (const i of mockCandidateInterviews) {
        await client.query(
          `
          INSERT INTO candidate_interviews (
            id, candidate_id, interview_date, location, client_name, attended, result, notes, created_at
          ) VALUES ($1::uuid, $2::uuid, $3::date, $4, $5, $6, $7, $8, now())
          ON CONFLICT (id) DO UPDATE SET
            interview_date = EXCLUDED.interview_date,
            location = EXCLUDED.location,
            client_name = EXCLUDED.client_name,
            attended = EXCLUDED.attended,
            result = EXCLUDED.result,
            notes = EXCLUDED.notes
        `,
          [
            stableUuidFromMockId(i.id),
            stableUuidFromMockId(i.candidate_id),
            i.interview_date,
            i.location,
            i.client_name,
            i.attended,
            i.result ?? null,
            i.notes ?? null,
          ],
        );
        nIv++;
      }
      console.log("Candidate interviews upserted:", nIv);
    }

    if (await hasTable("candidate_work_history")) {
      let nWh = 0;
      for (const h of mockCandidateWorkHistory) {
        await client.query(
          `
          INSERT INTO candidate_work_history (
            id, candidate_id, client_name, work_type, start_date, end_date, status, created_at
          ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::date, $6::date, $7, now())
          ON CONFLICT (id) DO UPDATE SET
            client_name = EXCLUDED.client_name,
            work_type = EXCLUDED.work_type,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            status = EXCLUDED.status
        `,
          [
            stableUuidFromMockId(h.id),
            stableUuidFromMockId(h.candidate_id),
            h.client_name,
            h.work_type,
            h.start_date,
            h.end_date ?? null,
            h.status,
          ],
        );
        nWh++;
      }
      console.log("Candidate work history upserted:", nWh);
    }

    console.log(
      `Done — data in schema "${validSchema}" (jobs, candidates, employees, clients, calendar, training, interviews, work history when tables exist).`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * ═══ หน้าความคุ้มค่าระบบ — ด่านสิทธิ์ + ที่เก็บ + ตัวเลขจากระบบ (เจ้าของสั่ง 15 ต.ค. 2569 "เอาไว้ดูคนเดียว") ═══
 * สิทธิ์: อีเมลใน `VALUE_CASE_EMAILS` (คั่นด้วยจุลภาค · ไม่ตั้ง = บัญชีเจ้าของ) · เครื่องนักพัฒนา (ไม่ใช่ production) ให้ admin เข้าได้เพื่อตรวจงาน
 * ตัวเลขที่กรอกเก็บแถวละบัญชี (`app_value_case.user_sub`) · ตัวเลขระบบคำนวณสดรายเดือน (เวลาไทย) ย้อน 6 เดือน
 */
import { dbQuery } from "./postgres.js";
import { tableInAppSchema } from "./schema.js";
import { isProductionRuntime } from "./runtime.js";
import type { JwtUserPayload } from "./auth.js";
import {
  normalizeValueCase,
  type ValueCaseInputs,
  type ValueCaseMonth,
} from "../../src/lib/valueCase.js";

const TABLE = tableInAppSchema("app_value_case");
const APPS = tableInAppSchema("public_job_applications");
const QUEUE = tableInAppSchema("lumos_dispatch_queue");

const DEFAULT_EMAILS = ["nitinan.c@siamraj.com"];

export function valueCaseAllowedEmails(): string[] {
  const raw = (process.env.VALUE_CASE_EMAILS || "").trim();
  const list = raw ? raw.split(",") : DEFAULT_EMAILS;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function canSeeValueCase(
  user: Pick<JwtUserPayload, "email" | "role">,
  production = isProductionRuntime(),
): boolean {
  if (
    valueCaseAllowedEmails().includes((user.email || "").trim().toLowerCase())
  )
    return true;
  return !production && user.role === "admin";
}

export async function loadValueCaseInputs(
  userSub: string,
): Promise<{ inputs: ValueCaseInputs; updatedAt: string | null }> {
  const { rows } = await dbQuery<{
    payload: unknown;
    updated_at: Date | string;
  }>(`select payload, updated_at from ${TABLE} where user_sub = $1`, [userSub]);
  const row = rows[0];
  return {
    inputs: normalizeValueCase(row?.payload ?? {}),
    updatedAt: row ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function saveValueCaseInputs(
  userSub: string,
  raw: unknown,
): Promise<string> {
  const inputs = normalizeValueCase(raw);
  const { rows } = await dbQuery<{ updated_at: Date | string }>(
    `insert into ${TABLE} (user_sub, payload, updated_at) values ($1, $2::jsonb, now())
     on conflict (user_sub) do update set payload = excluded.payload, updated_at = now()
     returning updated_at`,
    [userSub, JSON.stringify(inputs)],
  );
  return new Date(rows[0].updated_at).toISOString();
}

/** เดือนปัจจุบัน YYYY-MM เวลาไทย */
export function bangkokYm(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 7);
}

/**
 * ตัวเลขระบบรายเดือน ย้อน 6 เดือน (รวมเดือนนี้):
 * ผู้สมัครเข้า = ใบสมัครที่สร้างในเดือน · สายที่ AI โทรจบ = แถวคิวที่ได้ผลครั้งแรกในเดือน
 * (`interview` = งานสรรหา/จับคู่งาน · `reminder` = งานติดตาม)
 */
export async function loadValueCaseMonths(
  now = new Date(),
): Promise<ValueCaseMonth[]> {
  const ym = (col: string) =>
    `to_char(${col} at time zone 'Asia/Bangkok', 'YYYY-MM')`;
  const since = `date_trunc('month', (now() at time zone 'Asia/Bangkok') - interval '5 months') at time zone 'Asia/Bangkok'`;
  const [apps, calls] = await Promise.all([
    dbQuery<{ ym: string; n: string }>(
      `select ${ym("created_at")} as ym, count(*)::text as n from ${APPS} where created_at >= ${since} group by 1`,
    ),
    dbQuery<{ ym: string; channel: string; n: string }>(
      `select ${ym("first_result_at")} as ym, channel, count(*)::text as n from ${QUEUE}
        where first_result_at >= ${since} group by 1, 2`,
    ),
  ]);
  const out = new Map<string, ValueCaseMonth>();
  const cur = bangkokYm(now);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(`${cur}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = d.toISOString().slice(0, 7);
    out.set(key, {
      ym: key,
      applicants: 0,
      aiRecruitCalls: 0,
      aiFollowCalls: 0,
    });
  }
  for (const r of apps.rows) {
    const m = out.get(r.ym);
    if (m) m.applicants = Number(r.n) || 0;
  }
  for (const r of calls.rows) {
    const m = out.get(r.ym);
    if (!m) continue;
    if (r.channel === "interview") m.aiRecruitCalls += Number(r.n) || 0;
    else if (r.channel === "reminder") m.aiFollowCalls += Number(r.n) || 0;
  }
  return [...out.values()];
}

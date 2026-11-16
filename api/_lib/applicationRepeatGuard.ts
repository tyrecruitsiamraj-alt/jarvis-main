/**
 * ด่าน "สมัครซ้ำต้องรอ 14 วัน" ฝั่ง DB (เจ้าของสั่ง 1 ต.ค. 2569 · กติกา/ข้อความอยู่ที่ `src/lib/applicationRepeat.ts`)
 *
 * 🔴 DB ตัดสิน ไม่ใช่ลำดับโค้ด — ล็อก advisory ของเบอร์ **ภายในธุรกรรมเดียวกับ insert**
 *    คำขอพร้อมกันของเบอร์เดียวกันต้องรอคิว แล้วคนหลังเห็นใบของคนแรกแน่นอน (ของจริงเคยมีกดส่งซ้ำ 2 ใบภายใน 10 นาที)
 * 🔴 กติกา IP ถอดแล้ว (เจ้าของ 16 พ.ย. 2569 "เอาแค่ ห้ามสมัครซ้ำใน 14 วันแต่ ip ไม่ต้องแล้ว") — เน็ตมือถือหลายคนใช้ IP ร่วมกัน
 *    คนใหม่โดนกันทั้งที่ไม่ได้สมัครซ้ำ · ยังเก็บ `client_ip` ไว้กับใบ (`applicantClientIp`) แต่ไม่ใช้กัน
 */
import type { PoolClient } from 'pg';
import type { ApiReq } from './http.js';
import { tableInAppSchema } from './schema.js';
import { toE164Thai } from './thaiPhone.js';
import { repeatWindowSql } from '../../src/lib/applicationRepeat.js';

const tbl = tableInAppSchema('public_job_applications');

export type RepeatHit = { kind: 'phone'; lastAt: Date };

const IP_RE = /^[0-9a-f.:]{3,45}$/i;

/**
 * IP ของผู้สมัครที่ **เชื่อได้** — เว็บจริงอยู่หลัง Cloudflare ⇒ `CF-Connecting-IP` (Cloudflare เขียนทับเอง ผู้ส่งปลอมไม่ได้)
 * ⚠️ ห้ามใช้ตัวแรกของ X-Forwarded-For กับกติกาบล็อก: ผู้ส่งใส่เองได้ (Cloudflare ต่อท้ายให้) ⇒ ปลอม IP คนอื่น
 *    แล้วทำให้คนอื่นโดนบล็อก 14 วันได้ · ไม่มีหัวนี้ (เครื่อง dev / ยิงตรงไม่ผ่าน Cloudflare) = null = ข้ามกติกา IP
 */
export function applicantClientIp(req: ApiReq): string | null {
  const raw = req.headers?.['cf-connecting-ip'];
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  return v && IP_RE.test(v) ? v : null;
}

/**
 * ล็อกเบอร์ไว้จนจบธุรกรรม แล้วหาใบภายใน 14 วัน — เจอ = คืนชนิด + เวลาใบล่าสุด
 * `phone` = เบอร์ตามที่จะบันทึก (DB คิด `phone_e164` เองด้วยฟังก์ชันเดียวกับ generated column 087)
 * `excludeId` = ใบที่กำลังแก้เบอร์ (ไม่นับตัวเอง)
 */
export async function lockAndFindRepeat(
  client: PoolClient,
  input: { phone: string | null; excludeId?: string | null },
): Promise<RepeatHit | null> {
  const e164 = toE164Thai(input.phone);
  if (e164) {
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`apply-phone:${e164}`]);
    const { rows } = await client.query<{ last_at: Date | null }>(
      `select max(created_at) as last_at from ${tbl}
        where phone_e164 = jarvis_phone_e164_thai($1)
          and ${repeatWindowSql('created_at')}
          and ($2::uuid is null or id <> $2::uuid)`,
      [input.phone, input.excludeId ?? null],
    );
    if (rows[0]?.last_at) return { kind: 'phone', lastAt: new Date(rows[0].last_at) };
  }
  return null;
}

/** เบอร์ที่มีใบภายใน 14 วัน → เวลาใบล่าสุด (ใช้กับตัวอย่างก่อนนำเข้า · อ่านอย่างเดียว ไม่ล็อก) */
export async function recentPhoneApplications(
  query: <T>(sql: string, params: unknown[]) => Promise<{ rows: T[] }>,
  phones: string[],
): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (phones.length === 0) return out;
  const { rows } = await query<{ phone_e164: string; last_at: Date }>(
    `select phone_e164, max(created_at) as last_at from ${tbl}
      where phone_e164 = any(select jarvis_phone_e164_thai(p) from unnest($1::text[]) p)
        and ${repeatWindowSql('created_at')}
      group by phone_e164`,
    [phones],
  );
  for (const r of rows) out.set(r.phone_e164, new Date(r.last_at));
  return out;
}

/**
 * ใบสมัครที่มีอยู่แล้วของแต่ละเบอร์ (ทุกช่วงเวลา) — ใบล่าสุด + จำนวนใบ
 * ใช้บอก "รายชื่อซ้ำ" ตอนนำเข้า Excel (เจ้าของ 4 ต.ค. 2569: สมัครล่าสุดวันไหน · สถานะล่าสุด) · อ่านอย่างเดียว
 */
export async function existingApplicationsByPhone(
  query: <T>(sql: string, params: unknown[]) => Promise<{ rows: T[] }>,
  phones: string[],
): Promise<Map<string, { lastAt: Date; status: string | null; job: string | null; count: number }>> {
  const out = new Map<string, { lastAt: Date; status: string | null; job: string | null; count: number }>();
  if (phones.length === 0) return out;
  const { rows } = await query<{
    phone_e164: string;
    created_at: Date;
    status: string | null;
    job: string | null;
    n: number | string;
  }>(
    `select distinct on (phone_e164) phone_e164, created_at, status,
            coalesce(nullif(job_title, ''), nullif(unit_name, ''), nullif(position_interest, '')) as job,
            count(*) over (partition by phone_e164) as n
       from ${tbl}
      where phone_e164 = any(select jarvis_phone_e164_thai(p) from unnest($1::text[]) p)
      order by phone_e164, created_at desc`,
    [phones],
  );
  for (const r of rows) {
    out.set(r.phone_e164, { lastAt: new Date(r.created_at), status: r.status, job: r.job, count: Number(r.n) || 1 });
  }
  return out;
}

/**
 * ด่าน "สมัครซ้ำต้องรอ 14 วัน" ฝั่ง DB (เจ้าของสั่ง 1 ต.ค. 2569 · กติกา/ข้อความอยู่ที่ `src/lib/applicationRepeat.ts`)
 *
 * 🔴 DB ตัดสิน ไม่ใช่ลำดับโค้ด — ล็อก advisory ของเบอร์ (และ IP) **ภายในธุรกรรมเดียวกับ insert**
 *    คำขอพร้อมกันของเบอร์/IP เดียวกันต้องรอคิว แล้วคนหลังเห็นใบของคนแรกแน่นอน
 *    (ของจริงเคยมีกดส่งซ้ำ 2 ใบภายใน 10 นาที) · ลำดับล็อกเสมอ: เบอร์ → IP (กัน deadlock)
 * ⚠️ deploy รันโค้ดใหม่ **ก่อน** migrate ⇒ คอลัมน์ `client_ip` (132) อาจยังไม่มี: ข้ามกติกา IP ไปก่อน
 *    (savepoint) ห้ามทำให้ผู้สมัครส่งใบไม่ได้
 */
import type { PoolClient } from 'pg';
import type { ApiReq } from './http.js';
import { tableInAppSchema } from './schema.js';
import { toE164Thai } from './thaiPhone.js';
import { repeatWindowSql } from '../../src/lib/applicationRepeat.js';

const tbl = tableInAppSchema('public_job_applications');

export type RepeatHit = { kind: 'phone' | 'ip'; lastAt: Date };

function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

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
 * ล็อกเบอร์ (และ IP ถ้าส่งมา) ไว้จนจบธุรกรรม แล้วหาใบภายใน 14 วัน — เจอ = คืนชนิด + เวลาใบล่าสุด
 * `phone` = เบอร์ตามที่จะบันทึก (DB คิด `phone_e164` เองด้วยฟังก์ชันเดียวกับ generated column 087)
 * `excludeId` = ใบที่กำลังแก้เบอร์ (ไม่นับตัวเอง)
 */
export async function lockAndFindRepeat(
  client: PoolClient,
  input: { phone: string | null; ip?: string | null; excludeId?: string | null },
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
  if (input.ip) {
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`apply-ip:${input.ip}`]);
    await client.query('savepoint repeat_ip');
    try {
      const { rows } = await client.query<{ last_at: Date | null }>(
        `select max(created_at) as last_at from ${tbl} where client_ip = $1 and ${repeatWindowSql('created_at')}`,
        [input.ip],
      );
      await client.query('release savepoint repeat_ip');
      if (rows[0]?.last_at) return { kind: 'ip', lastAt: new Date(rows[0].last_at) };
    } catch (e) {
      await client.query('rollback to savepoint repeat_ip');
      if (!isUndefinedColumn(e)) throw e;
    }
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

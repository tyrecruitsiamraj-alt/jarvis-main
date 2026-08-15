import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { EMPTY_RECRUIT_FUNNEL, type RecruitFunnelCounts } from '../../src/lib/recruitFunnel.js';

const appsTable = tableInAppSchema('public_job_applications');

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

const isYmd = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * แผงสรุปงานสรรหา (RM) — **อ่านจากฐานเราเท่านั้น** (`public_job_applications`)
 *
 * เจ้าของสั่ง 12 ส.ค. 2569: "ไม่ได้ให้เอา database จาก iRecruit มา ฉันจะเริ่มเก็บ
 * รายชื่อใหม่เลย" — เดิมแผงนี้อ่าน `recruit_register` ฝั่ง iRecruit (154,871 ราย)
 * ซึ่งทำให้ดูเหมือนฐานเรามีข้อมูลเป็นแสนทั้งที่ยังไม่เริ่มเก็บ
 * (ตัวอ่าน iRecruit เดิมยังอยู่ที่ `api/_lib/recruitFunnelSql.ts` เผื่อใช้ตรวจตอน
 * ยกข้อมูลจริงในอนาคต — แค่ไม่มีเส้นไหนเรียกแล้ว)
 *
 * การแมปตัวเลข — ใช้เฉพาะของที่ฐานเรามีจริง ไม่เดาแทน:
 *   เข้ามา (registered)   = ใบสมัครทั้งหมด
 *   โทรแล้ว (called)      = ใบที่พ้นสถานะ new (มีเจ้าหน้าที่จัดการแล้ว)
 *   ติดต่อสำเร็จ          = contacted + converted
 *   ไม่สำเร็จ-อื่น ๆ       = rejected
 *   ไม่รับสาย/ติดต่อไม่ได้/นัดหมาย/ติดตามนัด = **0 ไปก่อน** — ฝั่งเรายังไม่มีตาราง
 *   บันทึกผลติดต่อ/นัดหมายรายครั้ง (งานถัดไปของ RM) พอมีแล้วค่อยต่อเข้าช่องพวกนี้
 *   leads = 0 — ระบบ Lead ฝั่งเรายังไม่เกิด (migration 079)
 *
 * `?from=` / `?to=` เป็น ISO date (to = ขอบบนแบบไม่รวม) — พฤติกรรมเดิม
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method !== 'GET') {
      return sendError(res, 405, 'Method not allowed', 'Read-only summary');
    }
    res.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');

    const from = getQuery(req, 'from');
    const to = getQuery(req, 'to');
    // ⚠️ ตัดช่วงวันตามเวลาไทย — created_at เป็น timestamptz · `$n::date` ตีความตาม session tz
    // (UTC) = 07:00 น. ไทย → ใบที่กรอกเที่ยงคืน–ตี 7 ถูกนับผิดวัน (แพตเทิร์นเดียวกับ
    // lumos-call-funnel/candidateCallHolds ที่ผูก +07:00 ไว้แล้ว)
    const params: unknown[] = [];
    const where: string[] = [];
    if (isYmd(from)) {
      params.push(`${from}T00:00:00+07:00`);
      where.push(`created_at >= $${params.length}::timestamptz`);
    }
    if (isYmd(to)) {
      params.push(`${to}T00:00:00+07:00`);
      where.push(`created_at < $${params.length}::timestamptz`);
    }

    const { rows } = await dbQuery<{ status: string; n: string }>(
      `select status, count(*)::text as n from ${appsTable}
        ${where.length ? `where ${where.join(' and ')}` : ''}
        group by status`,
      params,
    );
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = Number(r.n) || 0;
    const contacted = byStatus['contacted'] ?? 0;
    const converted = byStatus['converted'] ?? 0;
    const rejected = byStatus['rejected'] ?? 0;

    const counts: RecruitFunnelCounts & { leads: number } = {
      ...EMPTY_RECRUIT_FUNNEL,
      registered: (byStatus['new'] ?? 0) + contacted + converted + rejected,
      called: contacted + converted + rejected,
      contactSuccess: contacted + converted,
      contactFailedOther: rejected,
      leads: 0,
    };
    return res.status(200).json(counts);
  } catch (e) {
    return handleApiError(res, e, 'recruit-funnel');
  }
}

export default withRbac(handler, 'recruit-funnel');

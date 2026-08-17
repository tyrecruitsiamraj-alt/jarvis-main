/**
 * ยอดสรุปงานสรรหา (RM) จาก iRecruit — **อ่านอย่างเดียว**
 *
 * แผงนี้ตอบคำถามที่เจ้าของถาม: กรอกมา · โทรไปแล้ว · รับสาย · ไม่รับสาย · ติดต่อไม่ได้
 * · นัดสำเร็จ · นัดไม่สำเร็จ · นัดแล้วมา · นัดแล้วไม่มา
 *
 * ตารางที่ใช้ (ทั้งหมด `owner = 'RM'`):
 *   `recruit_register`          ใบสมัคร — ตัวตั้งต้น
 *   `recruit_logs_call`         log การกดโทร (นับหัวคน ไม่ใช่จำนวนครั้ง)
 *   `recruit_contact`           ผลการติดต่อ (A สำเร็จ · C ไม่สำเร็จ + reason_id)
 *   `recruit_appointment`       ผลการนัดหมาย
 *   `recruit_follow_appointment` ผลติดตามนัด (A มา · C ไม่มา · W รอ)
 *
 * ⚠️ **การจัดถัง "ไม่รับสาย" กับ "ติดต่อไม่ได้" ไม่ได้ทำใน SQL** — SQL คืนยอดรายเหตุผล
 * แล้วให้ `splitContactFailures()` ใน `src/lib/recruitFunnel.ts` แบ่งถัง
 * เพื่อให้เกณฑ์การแบ่งอยู่ที่เดียว ทดสอบได้ และเจ้าของแก้ได้โดยไม่ต้องแตะ SQL
 *
 * ⚠️ **นับ Lead แยก ไม่รวมในยอด "กรอกมา"** — คิวรีรายชื่อ RM ที่ระบบใช้อยู่กรอง
 * `is_lead IS NULL` ทิ้ง ถ้ายอดสรุปนับรวม Lead จะไม่ตรงกับตารางที่คนกำลังดู
 */
import { irecruitSqlQuery } from './irecruitSqlServer.js';
import {
  EMPTY_RECRUIT_FUNNEL,
  splitContactFailures,
  type RecruitFunnelCounts,
} from '../../src/lib/recruitFunnel.js';

export type RecruitFunnelResult = RecruitFunnelCounts & {
  /** ใบที่ถูกตีเป็น Lead — แยกไว้ ไม่รวมใน registered */
  leads: number;
  /** ช่วงวันที่ที่ใช้กรอง (null = ทั้งหมด) */
  from: string | null;
  to: string | null;
};

/**
 * ⚠️ ทุกยอดกรองด้วยช่วงวันที่ของ **แถวนั้นเอง** (`created_at` ของผล ไม่ใช่ของใบสมัคร)
 * ถ้ากรองด้วยวันที่ใบสมัคร ผลที่บันทึกเดือนนี้ของใบเดือนก่อนจะหายไปจากยอดเดือนนี้
 *
 * ⚠️ **ต่อเงื่อนไขวันที่เฉพาะตอนมีค่า** ไม่ใช่ส่ง null เข้าไปแล้วเช็ค `@p IS NULL`
 * เพราะ mssql เดาชนิดของพารามิเตอร์จากค่าที่ส่ง — ส่ง null ไปจะกลายเป็นชนิดผิด
 * (เทียบ datetime กับ nvarchar แล้วคิวรีล้มหรือได้ผลเพี้ยน)
 */
function dateClause(alias: string, hasFrom: boolean, hasTo: boolean): string {
  const parts: string[] = [];
  if (hasFrom) parts.push(`AND ${alias}.created_at >= @p_from`);
  if (hasTo) parts.push(`AND ${alias}.created_at < @p_to`);
  return parts.join(' ');
}

/**
 * ⚠️⚠️ **นับหัวคน ไม่ใช่จำนวนครั้ง — และเอาผลล่าสุดของแต่ละคน**
 *
 * รอบแรกนับแถวตรง ๆ แล้ววัดกับข้อมูลจริงได้ตัวเลขที่ตอบผิดคำถาม:
 * "โทรไปแล้ว 304.7% ของกรอกมา" และ "นัดสำเร็จ + นัดไม่สำเร็จ = 111.6%"
 * เพราะคนหนึ่งคนถูกโทร/ถูกนัดหลายรอบ (ตารางมี `seq`) — วัดจริง: ผลติดต่อ 117,158 แถว
 * แต่เป็น 115,714 หัวคน · นัดหมาย 72,637 แถว = 67,048 หัวคน
 *
 * คำถามของเจ้าของคือ "รับสายเท่าไหร่" = **กี่คน** ไม่ใช่กี่ครั้ง จึงต้อง
 *   1) `ROW_NUMBER() ... PARTITION BY register_id ORDER BY seq DESC, id DESC` แล้วเอา rn = 1
 *   2) ถังของแต่ละขั้นตอนจึงไม่ทับกันเอง และรวมกันได้ไม่เกินจำนวนคนที่มีผลของขั้นนั้น
 */
function latestPerPerson(table: string, alias: string, where: string): string {
  return `SELECT ${alias}.*, ROW_NUMBER() OVER (PARTITION BY ${alias}.register_id ORDER BY ${alias}.seq DESC, ${alias}.id DESC) AS rn
            FROM ${table} ${alias} WHERE ${where}`;
}

export function buildRecruitFunnelSql(hasFrom: boolean, hasTo: boolean): string {
  const d = (alias: string) => dateClause(alias, hasFrom, hasTo);
  return `
WITH last_contact AS (
  ${latestPerPerson('recruit_contact', 'c', `c.owner = 'RM' ${d('c')}`)}
), last_appointment AS (
  ${latestPerPerson('recruit_appointment', 'a', `a.owner = 'RM' ${d('a')}`)}
), last_follow AS (
  ${latestPerPerson('recruit_follow_appointment', 'f', `f.owner = 'RM' ${d('f')}`)}
)
SELECT 'registered' AS k, COUNT(*) AS n
  FROM recruit_register rr
 WHERE rr.owner = 'RM' AND rr.status = 'A' AND rr.deleted_at IS NULL ${d('rr')}
UNION ALL
SELECT 'leads', COUNT(*)
  FROM recruit_register rr
 WHERE rr.owner = 'RM' AND rr.status = 'A' AND rr.deleted_at IS NULL AND rr.is_lead = 1 ${d('rr')}
UNION ALL
SELECT 'called', COUNT(DISTINCT lc.register_id)
  FROM recruit_logs_call lc
 WHERE lc.owner = 'RM' ${d('lc')}
UNION ALL
SELECT 'contactSuccess', COUNT(*) FROM last_contact WHERE rn = 1 AND status = 'A'
UNION ALL
SELECT 'appointmentSuccess', COUNT(*) FROM last_appointment WHERE rn = 1 AND status = 'A'
UNION ALL
SELECT 'appointmentFailed', COUNT(*) FROM last_appointment WHERE rn = 1 AND status <> 'A'
UNION ALL
SELECT 'showedUp', COUNT(*) FROM last_follow WHERE rn = 1 AND status = 'A'
UNION ALL
SELECT 'noShow', COUNT(*) FROM last_follow WHERE rn = 1 AND status = 'C'
UNION ALL
SELECT 'followPending', COUNT(*) FROM last_follow WHERE rn = 1 AND status NOT IN ('A', 'C')
`;
}

/**
 * ยอด "ติดต่อไม่สำเร็จ" แยกรายเหตุผล — เอาไปแบ่งถังฝั่ง JS
 * ⚠️ ต้องเป็น **ผลล่าสุดต่อคน** ชุดเดียวกับคิวรีข้างบน ไม่งั้นสามถังรวมกันแล้วไม่เท่า
 * จำนวนคนที่ผลล่าสุดเป็น "ไม่สำเร็จ"
 * ⚠️ ใช้ `status <> 'A'` ให้เข้าคู่กับ `= 'A'` ข้างบน — สถานะแปลกปลอมจะได้ไม่หล่นหาย
 */
export function buildRecruitContactFailSql(hasFrom: boolean, hasTo: boolean): string {
  return `
WITH last_contact AS (
  ${latestPerPerson('recruit_contact', 'c', `c.owner = 'RM' ${dateClause('c', hasFrom, hasTo)}`)}
)
SELECT m.name AS reason_name, COUNT(*) AS n
  FROM last_contact lc
  LEFT JOIN recruit_master_reason m ON m.id = lc.reason_id
 WHERE lc.rn = 1 AND lc.status <> 'A'
 GROUP BY m.name
`;
}

function toDateParam(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getRecruitFunnel(
  range: { from?: string | null; to?: string | null } = {},
): Promise<RecruitFunnelResult> {
  const from = toDateParam(range.from);
  const to = toDateParam(range.to);
  const params: Record<string, unknown> = {};
  if (from) params.p_from = from;
  if (to) params.p_to = to;

  const [totals, fails] = await Promise.all([
    irecruitSqlQuery<{ k: string; n: number }>(buildRecruitFunnelSql(!!from, !!to), params),
    irecruitSqlQuery<{ reason_name: string | null; n: number }>(
      buildRecruitContactFailSql(!!from, !!to),
      params,
    ),
  ]);

  const out: RecruitFunnelResult = {
    ...EMPTY_RECRUIT_FUNNEL,
    leads: 0,
    from: range.from ?? null,
    to: range.to ?? null,
  };
  for (const row of totals) {
    const key = row.k as keyof RecruitFunnelResult;
    if (key in out && typeof out[key] === 'number') {
      (out as unknown as Record<string, number>)[key] = Number(row.n) || 0;
    }
  }

  const split = splitContactFailures(
    fails.map((f) => ({ reasonName: f.reason_name, count: Number(f.n) || 0 })),
  );
  out.noAnswer = split.noAnswer;
  out.unreachable = split.unreachable;
  out.contactFailedOther = split.other;

  return out;
}

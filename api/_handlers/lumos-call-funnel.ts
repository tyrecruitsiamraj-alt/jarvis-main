/**
 * GET /api/lumos/call-funnel — funnel การโทรทั้งระบบ + ถัง "ต้องคนตาม" (read-only)
 *
 * ตอบคำถามที่เจ้าของถาม: "ส่งไปให้ Lumos กี่คน · โทรติดกี่คน · ไม่ติดกี่คน ·
 * ไม่รับสายกี่คน" แล้วต่อด้วย "ใครที่ AI เอาไม่อยู่แล้วต้องให้คนตาม"
 *
 * ⚠️ ตัวเลขที่นี่คือ "การทำงานของการโทร" ไม่ใช่ "หาได้แล้ว/ปิดครบใบขอ" ทางการจาก ERP
 * (นิยาม Control Tower ห้ามปนกัน — ดู references/02-dashboard-metric-definitions.md)
 */
import {
  withRbac,
  handleApiError,
  sendError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { dbQuery, isPgUndefinedTable } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { listNeedsHumanQueueItems } from '../_lib/callFollowup.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');

/** ผลโทรที่ถือว่า "คุยติด" — ได้คุยกับคนจริง */
const CONNECTED_OUTCOMES = ['confirmed', 'acknowledged', 'declined', 'reschedule_requested'];
/** ผลโทรที่ถือว่า "ไม่ติด" */
const UNREACHED_OUTCOMES = ['no_answer', 'busy', 'unresponsive', 'failed'];

export type CallFunnel = {
  /** ส่งเข้าคิวทั้งหมด (ยังไม่นับซ้ำการโทรซ้ำ) */
  queued: number;
  /** Lumos ดึงไปแล้ว */
  delivered: number;
  /** รอโทร (ยังไม่ถูกดึง หรือ นัดโทรซ้ำไว้) */
  waiting: number;
  /** นัดโทรซ้ำไว้ (ส่วนหนึ่งของ waiting) */
  retryScheduled: number;
  /** มีผลกลับมาแล้ว */
  withResult: number;
  connected: number;
  unreached: number;
  /** แยกตามผลโทร */
  byOutcome: Record<string, number>;
  /** AI เอาไม่อยู่ ต้องคนตาม */
  needsHuman: number;
  /** จบแล้ว */
  closed: number;
};

function emptyFunnel(): CallFunnel {
  return {
    queued: 0,
    delivered: 0,
    waiting: 0,
    retryScheduled: 0,
    withResult: 0,
    connected: 0,
    unreached: 0,
    byOutcome: {},
    needsHuman: 0,
    closed: 0,
  };
}

type StatRow = {
  status: string;
  last_outcome: string | null;
  followup_state: string | null;
  has_result: boolean;
  scheduled_ahead: boolean;
  n: string;
};

/**
 * นับจากคิวทีเดียวด้วย group by — ไม่ดึงแถวมานับที่ node
 * (คิวมีได้หลายพันแถว · บทเรียนจากเส้นใบขอที่ปิดแล้วที่เคยดึง 2,700 แถวมานับ)
 */
async function loadFunnel(sinceYmd: string | null): Promise<CallFunnel> {
  const funnel = emptyFunnel();
  const params: unknown[] = [];
  let sinceClause = '';
  if (sinceYmd) {
    params.push(`${sinceYmd}T00:00:00+07:00`);
    sinceClause = `where created_at >= $${params.length}::timestamptz`;
  }
  try {
    const { rows } = await dbQuery<StatRow>(
      // อ่าน outcome จาก last_outcome ก่อน · ไม่มีก็ถอยไปดู result->>'outcome'
      // เพราะ last_outcome เป็นคอลัมน์ใหม่ (migration 070) แถวที่มีผลอยู่ก่อนหน้าจะว่าง
      // ถ้าไม่ถอยให้ หน้าเว็บจะโชว์ "มีผลกลับ 458 แต่โทรติด 0" ซึ่งดูเหมือนพัง
      `select status,
              coalesce(last_outcome, result->>'outcome') as last_outcome,
              followup_state,
              (result is not null) as has_result,
              (next_attempt_at is not null and next_attempt_at > now()) as scheduled_ahead,
              count(*)::text as n
         from ${queueTable}
         ${sinceClause}
        group by status, coalesce(last_outcome, result->>'outcome'),
                 followup_state, has_result, scheduled_ahead`,
      params,
    );

    for (const r of rows) {
      const n = Number(r.n) || 0;
      funnel.queued += n;
      if (r.status === 'delivered') funnel.delivered += n;
      if (r.has_result) funnel.withResult += n;
      else funnel.waiting += n;
      if (r.scheduled_ahead) funnel.retryScheduled += n;

      if (r.last_outcome) {
        funnel.byOutcome[r.last_outcome] = (funnel.byOutcome[r.last_outcome] ?? 0) + n;
        if (CONNECTED_OUTCOMES.includes(r.last_outcome)) funnel.connected += n;
        if (UNREACHED_OUTCOMES.includes(r.last_outcome)) funnel.unreached += n;
      }
      if (r.followup_state === 'needs_human') funnel.needsHuman += n;
      if (r.followup_state === 'closed') funnel.closed += n;
    }
  } catch (e) {
    // คอลัมน์ใหม่ยังไม่ถูก migrate → คืน funnel ว่าง หน้าเว็บโชว์ศูนย์ ไม่พัง
    if (isPgUndefinedTable(e) || isUndefinedColumn(e)) return funnel;
    throw e;
  }
  return funnel;
}

function isUndefinedColumn(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703'
  );
}

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const since = getQuery(req, 'since').trim();
    const sinceYmd = /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : null;

    const [funnel, needsHuman] = await Promise.all([
      loadFunnel(sinceYmd),
      listNeedsHumanQueueItems(100),
    ]);

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({ funnel, needsHuman });
  } catch (e) {
    return handleApiError(res, e, 'lumos-call-funnel', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'follow');

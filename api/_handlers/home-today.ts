/**
 * ═══ `/api/home-today` — "วันนี้ระบบทำอะไรไปแล้ว และเหลืออะไรต้องทำ" ═══
 *
 * เจ้าของนิยามหน้าแรกไว้ 15 ก.ย. 2569: *"หน้าแรกต้อง Display ดูสวย เปิดมาแล้วว้าว
 * ระบบบอกหมดทุกอย่าง … ตัวเลขต้องบอกระดับ micro ใครทำอะไร วันนี้ต้องทำอะไร
 * ทำอะไรเสร็จแล้ว เหลือทำอะไร เสร็จที่ว่าผลคืออะไร"* และย้ำว่า
 * *"หน้าแรกไม่ใช่ Display สำหรับตำแหน่งใดตำแหน่งนึง มันสำหรับทั้งระบบ"*
 *
 * ⇒ เส้นนี้จึง **ไม่กรองตามสิทธิ์/ตามคน** — ตอบภาพของทั้งบริษัทวันนี้
 *
 * คืนสองก้อน:
 * 1. `headline` — ตัวเลขพาดหัว (โทรไปแล้วกี่สาย · ผลออกมาเป็นอะไร · เหลือกี่สาย)
 * 2. `rows` — **หนึ่งแถวหนึ่งสาย** พร้อมช่องที่ทุกจอก่อนหน้านี้ขาด: **แล้วไงต่อ**
 *
 * 🔴 ผลของสายอ่านจากคำพูดจริงผ่านเครื่องยนต์กลาง `callMicroOutcome.ts`
 * (รหัส `acknowledged` ของ Lumos ปนทั้งไปและไม่ไป — ใช้รหัสตรง ๆ ไม่ได้)
 */
import { dbQuery, isPgUndefinedTable } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { withAuth, handleApiError, sendError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { queueOutcome, queueCancelled } from '../_lib/lumosQueueDefs.js';
import { classifyCallMicro, vocabForPersonRef } from '../../src/lib/callMicroOutcome.js';
import { actionForPending, actionForResult, type TodayAction } from '../../src/lib/todayAction.js';

const FOLLOW = tableInAppSchema('follow_entries');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');

/** เที่ยงคืนวันนี้ (โซนไทย) — กติกาเดียวกับ `home-kpis` ห้ามใช้ UTC */
const TODAY = `date_trunc('day', now() at time zone 'Asia/Bangkok')`;

const OUTCOME = queueOutcome('q');
const CANCELLED = queueCancelled('q');

export type HomeTodayRow = {
  id: string;
  name: string;
  phone: string | null;
  /** เวลาที่นัดให้ AI โทร (ISO) */
  scheduledAt: string;
  round: number | null;
  /** สิ่งที่เกิดขึ้นกับสายนี้ — คำสั้น ๆ สำหรับคอลัมน์ "เกิดอะไรขึ้น" */
  what: string;
  /** ผลที่อ่านได้จากบทสนทนา — null = ยังไม่มีผล */
  result: string | null;
  /** คำที่ผู้รับสายพูดเอง (ตัดสั้น) — ให้คนกดอ่านต่อได้ */
  said: string | null;
  action: TodayAction;
  /** เจ้าหน้าที่ที่เป็นคนตั้งสายนี้ */
  owner: string | null;
};

export type HomeTodayBody = {
  generated_at: string;
  headline: {
    /** สายที่นัดไว้วันนี้ทั้งหมด (ไม่รวมที่ยกเลิก) */
    planned: number;
    /** โทรจบแล้ว รู้ผลแล้ว */
    done: number;
    /** ยังไม่ถึงคิว/ยังไม่มีผล */
    left: number;
    /** ผลของสายที่จบแล้ว */
    yes: number;
    no: number;
    needHuman: number;
  };
  rows: HomeTodayRow[];
};

type Raw = {
  id: string;
  name: string;
  phone: string | null;
  scheduled_at: string;
  round: number | null;
  owner: string | null;
  person_ref: string | null;
  status: string | null;
  outcome: string | null;
  cancelled: boolean;
  summary: string | null;
  reply: string | null;
};

/** ตัดคำพูดยาว ๆ ให้พอดีคอลัมน์ — ตัดแล้วต้องบอกว่าตัด ห้ามเงียบ */
function short(text: string | null, max = 90): string | null {
  const t = (text ?? '').trim();
  if (t === '') return null;
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function loadHomeToday(now = new Date()): Promise<HomeTodayBody> {
  const { rows } = await dbQuery<Raw>(
    `select f.id::text as id,
            f.recipient_name as name,
            f.recipient_phone as phone,
            f.scheduled_at::text as scheduled_at,
            f.call_round as round,
            f.created_by_name as owner,
            q.person_ref,
            q.status,
            ${OUTCOME} as outcome,
            coalesce(${CANCELLED}, false) as cancelled,
            q.result->>'summary' as summary,
            (select string_agg(btrim(x.t->>'text'), ' · ')
               from jsonb_array_elements(coalesce(q.result->'transcript', '[]'::jsonb)) x(t)
              where x.t->>'role' = 'candidate'
                and coalesce(btrim(x.t->>'text'), '') <> '') as reply
       from ${FOLLOW} f
       left join ${QUEUE} q on q.person_ref = 'follow-' || f.id::text
      where f.cancelled_at is null
        and f.scheduled_at >= ${TODAY}
        and f.scheduled_at < ${TODAY} + interval '1 day'
      order by f.scheduled_at`,
  );

  const out: HomeTodayRow[] = [];
  const head = { planned: 0, done: 0, left: 0, yes: 0, no: 0, needHuman: 0 };

  for (const r of rows) {
    if (r.cancelled) continue;
    head.planned += 1;

    const bucket = r.outcome
      ? classifyCallMicro(
          { outcome: r.outcome, summary: r.summary, reply: r.reply },
          vocabForPersonRef(r.person_ref),
        )
      : null;

    let what: string;
    let result: string | null = null;
    let action: TodayAction;

    if (bucket) {
      head.done += 1;
      what = 'AI โทรแล้ว';
      result = short(r.summary, 120) ?? 'มีผลกลับแล้ว';
      action = actionForResult(bucket);
      if (bucket === 'said_yes') head.yes += 1;
      else if (bucket === 'said_no') head.no += 1;
    } else {
      head.left += 1;
      what = r.status ? 'ส่งให้ AI แล้ว' : 'ยังไม่ได้ส่งให้ AI';
      const late = new Date(r.scheduled_at).getTime() < now.getTime();
      action = actionForPending(!r.status ? 'not_sent' : late ? 'overdue' : 'waiting');
    }

    if (action.needsHuman) head.needHuman += 1;

    out.push({
      id: r.id,
      name: r.name,
      phone: r.phone,
      scheduledAt: new Date(r.scheduled_at).toISOString(),
      round: r.round,
      what,
      result,
      said: short(r.reply),
      action,
      owner: r.owner,
    });
  }

  return { generated_at: now.toISOString(), headline: head, rows: out };
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'Read-only');
  }
  try {
    return res.status(200).json(await loadHomeToday());
  } catch (err) {
    // ตารางยังไม่ migrate = ส่งก้อนว่าง หน้าแรกต้องไม่ล้มเพราะเส้นนี้
    if (isPgUndefinedTable(err)) {
      return res.status(200).json({
        generated_at: new Date().toISOString(),
        headline: { planned: 0, done: 0, left: 0, yes: 0, no: 0, needHuman: 0 },
        rows: [],
      });
    }
    return handleApiError(res, err, 'home-today');
  }
}

export default withAuth(handler);

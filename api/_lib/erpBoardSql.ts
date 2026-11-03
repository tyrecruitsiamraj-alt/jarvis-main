/**
 * ═══ บอร์ดรายชื่อผู้สมัครของ ERP (ir_board_*) — อ่านอย่างเดียว (เจ้าของ 2 พ.ย. 2569 "เริ่มช่วง 1 เลย") ═══
 *
 * บัญชี ERP ของ Jarvis (team.dashboard) **ไม่มีสิทธิ์เขียน** ตาราง ir_board_* เลย (ตรวจ 3 พ.ย. 2569)
 * ⇒ ไฟล์นี้อ่านอย่างเดียว ห้ามมี INSERT/UPDATE/DELETE · การกดบน Jarvis จดที่ erp_board_events แล้วรวมที่ erpBoardMerge.ts
 *
 * โครง ERP ที่วัดจริง (บอร์ด 1 "รายชื่อผู้สมัครงาน ปี 2569"):
 * - ir_board_item = "วัน" ที่นำเข้า (ทุกการ์ดมี item_id · แถบซ้าย เดือน → วัน ของ ERP)
 * - ir_board_card.citizen_id → hr_recruitment (application_no บนการ์ดว่างทุกใบ ห้ามใช้)
 * - ขั้นตอน 7 ขั้น + ผล อยู่ ir_board_card_track_event · ผล REJECT เลือกได้ Drop/Re Use · "ไปทำงาน" → Done (ir_board_workflow_transition)
 * - In process / Done ต้องผูกใบขอ (ir_board_column.is_request_link_required)
 * - เช็กลิสต์ 3 ชุด 8 ข้อ · โทร = activity 'card_called' · ผู้ดูแล = ir_board_card_assign → hr_staff
 * - 🔴 เวลาใน ERP เป็นเวลาไทย ⇒ แปลงด้วย `erpTime` เสมอ (เคยขึ้น "อัปเดตล่าสุด" ล่วงหน้า 7 ชม.)
 * - เจ้าของ 3 พ.ย. 2569: *"query เอาแค่ตั้งแต่ปี 2568 มาปีเก่าๆไม่เอา"* ⇒ วันก่อน `ERP_BOARD_MIN_DATE` ไม่ดึง
 * - ⚠️ ชื่อคนบนการ์ดเป็นข้อมูลส่วนบุคคล — เส้นนี้ staff เท่านั้น (rbac 'matching-board') · ไม่ลง log
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { erpTime, type ErpBoardMeta, type ErpRawCard, type ErpRawDetail } from './erpBoardMerge.js';

const DEFAULT_BOARD_ID = () => Number(process.env.BOARD_READY_BOARD_ID || 1);
const CARD_LIMIT_MAX = 2000;
/** วันแรกที่ดึง (1 ม.ค. 2568) */
export const ERP_BOARD_MIN_DATE = '2025-01-01';
const META_TTL_MS = 10 * 60_000;

const clean = (v: string | null | undefined) => (v && String(v).trim() ? String(v).trim() : null);
/** วันที่ล้วน (item_date) — ไม่แปลงเขตเวลา */
const ymd = (v: Date | string | null | undefined) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));
/** รายการที่ SQL ต่อมาเป็น "a|b|c^a|b|c" */
const rows = (v: string | null | undefined) => (v ? String(v).split('^').filter(Boolean).map((r) => r.split('|')) : []);
/** ต่อรายการใน SQL โดยไม่โดน XML แปลง & < > */
const agg = (select: string) => `STUFF((${select} FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, '')`;
const staffName = (alias: string) => `COALESCE(NULLIF(RTRIM(${alias}.nick_name), ''), RTRIM(${alias}.fname))`;
const iso126 = (col: string) => `CONVERT(varchar(19), ${col}, 126)`;
const MIN_ITEMS = `SELECT item_id FROM dbo.ir_board_item WHERE board_id = @boardId AND item_date >= CONVERT(date, @minDate, 23)`;

export type ErpBoardDay = { itemId: number; date: string; label: string; cards: number };

/* ─────────────── ของที่ไม่เปลี่ยนรายนาที (เก็บไว้ 10 นาที) ─────────────── */

let metaCache: { at: number; boardId: number; meta: ErpBoardMeta } | null = null;

export async function loadErpBoardMeta(boardId = DEFAULT_BOARD_ID()): Promise<ErpBoardMeta> {
  if (metaCache && metaCache.boardId === boardId && Date.now() - metaCache.at < META_TTL_MS) return metaCache.meta;
  const inputs = { boardId };
  const [head, columns, steps, outcomes, transitions, tags, checklist, staff] = await Promise.all([
    siamrajSqlQuery<{ board_name: string | null }>(`SELECT RTRIM(board_name) AS board_name FROM dbo.ir_board_head WHERE board_id = @boardId`, inputs),
    siamrajSqlQuery<{ column_id: number; column_key: string | null; label: string | null; seq_no: number; is_completed: string | null; req: string | null }>(
      `SELECT column_id, RTRIM(column_key) AS column_key, RTRIM(display_label_th) AS label, seq_no, is_completed, is_request_link_required AS req
         FROM dbo.ir_board_column WHERE board_id = @boardId AND is_active = 'Y' ORDER BY seq_no`,
      inputs,
    ),
    siamrajSqlQuery<{ step_id: number; seq_no: number; label: string | null; is_scheduled_date: string | null; scheduled_date_label: string | null }>(
      `SELECT step_id, seq_no, RTRIM(label) AS label, is_scheduled_date, RTRIM(scheduled_date_label) AS scheduled_date_label
         FROM dbo.ir_board_workflow_step WHERE board_id = @boardId AND is_active = 'Y' ORDER BY seq_no`,
      inputs,
    ),
    siamrajSqlQuery<{ outcome_id: number; step_id: number; label: string | null; effect_code: string | null }>(
      `SELECT o.outcome_id, o.step_id, RTRIM(o.label) AS label, RTRIM(o.effect_code) AS effect_code
         FROM dbo.ir_board_workflow_step_outcome o JOIN dbo.ir_board_workflow_step s ON s.step_id = o.step_id
        WHERE s.board_id = @boardId AND o.is_active = 'Y' ORDER BY s.seq_no, o.seq_no`,
      inputs,
    ),
    siamrajSqlQuery<{ step_outcome_id: number; to_column_id: number }>(
      `SELECT step_outcome_id, to_column_id FROM dbo.ir_board_workflow_transition WHERE board_id = @boardId AND is_active = 'Y' ORDER BY seq_no`,
      inputs,
    ),
    siamrajSqlQuery<{ tag_id: number; tag_label: string | null }>(
      `SELECT tag_id, RTRIM(tag_label) AS tag_label FROM dbo.ir_board_tag_master WHERE board_id = @boardId AND is_active = 'Y' ORDER BY tag_id`,
      inputs,
    ),
    siamrajSqlQuery<{ item_id: number; grp: string | null; item: string | null }>(
      `SELECT i.item_id, RTRIM(c.title) AS grp, RTRIM(i.item_text) AS item
         FROM dbo.ir_board_checklist c JOIN dbo.ir_board_checklist_item i ON i.checklist_id = c.checklist_id
        WHERE c.board_id = @boardId AND c.is_active = 'Y' AND i.is_active = 'Y' ORDER BY c.seq_no, i.seq_no`,
      inputs,
    ),
    // คนที่ถูกมอบหมายบนบอร์ดในปีที่ผ่านมา = รายชื่อให้เลือกเป็นผู้ดูแล
    siamrajSqlQuery<{ staff_id: string; name: string | null; fname: string | null; lname: string | null; last_at: Date | string | null }>(
      `SELECT RTRIM(a.staff_id) AS staff_id, MAX(${staffName('hs')}) AS name, MAX(RTRIM(hs.fname)) AS fname, MAX(RTRIM(hs.lname)) AS lname, MAX(a.assigned_at) AS last_at
         FROM dbo.ir_board_card_assign a JOIN dbo.ir_board_card k ON k.card_id = a.card_id
         LEFT JOIN dbo.hr_staff hs ON hs.staff_id = a.staff_id
        WHERE k.board_id = @boardId AND a.assigned_at >= DATEADD(day, -365, GETDATE())
        GROUP BY a.staff_id`,
      inputs,
    ),
  ]);
  const toCols = new Map<number, number[]>();
  for (const t of transitions) toCols.set(t.step_outcome_id, [...(toCols.get(t.step_outcome_id) ?? []), t.to_column_id]);
  const meta: ErpBoardMeta = {
    boardId,
    boardName: clean(head[0]?.board_name),
    columns: columns.map((c) => ({
      id: c.column_id,
      key: clean(c.column_key),
      label: clean(c.label) ?? `ช่อง ${c.column_id}`,
      seq: Number(c.seq_no) || 0,
      isDone: c.is_completed === 'Y',
      requiresLink: c.req === 'Y',
    })),
    steps: steps.map((s) => ({ id: s.step_id, seq: Number(s.seq_no) || 0, label: clean(s.label) ?? '', hasDate: s.is_scheduled_date === 'Y', dateLabel: clean(s.scheduled_date_label) })),
    outcomes: outcomes.map((o) => ({ id: o.outcome_id, stepId: o.step_id, label: clean(o.label) ?? '', reject: o.effect_code === 'REJECT', toColumnIds: toCols.get(o.outcome_id) ?? [] })),
    tags: tags.map((t) => ({ id: t.tag_id, label: clean(t.tag_label) ?? '' })),
    checklist: checklist.map((c) => ({ itemId: c.item_id, group: clean(c.grp) ?? '', item: clean(c.item) ?? '' })),
    staff: staffOptions(staff),
  };
  metaCache = { at: Date.now(), boardId, meta };
  return meta;
}

/**
 * รายชื่อผู้ดูแล — คนเดียวมีรหัสพนักงาน 2 รหัสได้ (เมย์ เมธินี 3 พ.ย. 2569) ⇒ ชื่อซ้ำทั้งชุดเหลือรหัสที่มอบหมายล่าสุด
 * ชื่อเล่นซ้ำแต่คนละคน = ต่อชื่อ-นามสกุลในวงเล็บ (เมย์ เมธินี สว่างสุข / เมธินี สิงห์โต — ชื่อจริงก็ซ้ำ)
 */
export function staffOptions(
  rows: readonly { staff_id: string; name: string | null; fname: string | null; lname?: string | null; last_at?: Date | string | null }[],
): { id: string; name: string }[] {
  const byPerson = new Map<string, { id: string; nick: string; full: string | null; at: number }>();
  for (const r of rows) {
    const nick = clean(r.name) ?? r.staff_id;
    const fname = clean(r.fname);
    const full = [fname, clean(r.lname ?? null)].filter(Boolean).join(' ') || null;
    const key = [nick, full].join('|');
    const at = r.last_at ? new Date(r.last_at as string).getTime() : 0;
    const cur = byPerson.get(key);
    if (!cur || at > cur.at) byPerson.set(key, { id: r.staff_id, nick, full, at });
  }
  const people = [...byPerson.values()];
  const count = new Map<string, number>();
  for (const p of people) count.set(p.nick, (count.get(p.nick) ?? 0) + 1);
  return people
    .map((p) => ({ id: p.id, name: (count.get(p.nick) ?? 0) > 1 && p.full ? `${p.nick} (${p.full})` : p.nick }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

/** แถบซ้าย: วันตั้งแต่ปี 2568 พร้อมจำนวนการ์ด */
export async function loadErpBoardDays(boardId = DEFAULT_BOARD_ID()): Promise<ErpBoardDay[]> {
  const days = await siamrajSqlQuery<{ item_id: number; item_date: Date | string; label: string | null; cards: number }>(
    `SELECT i.item_id, i.item_date, RTRIM(i.display_label) AS label,
            (SELECT COUNT(*) FROM dbo.ir_board_card k WHERE k.item_id = i.item_id AND ISNULL(k.is_archived, 'N') <> 'Y') AS cards
       FROM dbo.ir_board_item i
      WHERE i.board_id = @boardId AND ISNULL(i.is_archived, 'N') <> 'Y' AND i.item_date >= CONVERT(date, @minDate, 23)
      ORDER BY i.item_date DESC`,
    { boardId, minDate: ERP_BOARD_MIN_DATE },
  );
  return days.map((d) => ({ itemId: d.item_id, date: ymd(d.item_date), label: clean(d.label) ?? '', cards: Number(d.cards) || 0 }));
}

/* ─────────────── การ์ด ─────────────── */

type CardRow = {
  card_id: number;
  column_id: number;
  item_id: number | null;
  title: string | null;
  position: string | null;
  jobtype: string | null;
  site: string | null;
  mobile: string | null;
  record_date: Date | string | null;
  last_activity_at: Date | string | null;
  moved_at: Date | string | null;
  tag_ids: string | null;
  step_id: number | null;
  outcome_id: number | null;
  step_at: Date | string | null;
  step_req: string | null;
  sched: Date | string | null;
  sched_at: Date | string | null;
  links: string | null;
  assignees: string | null;
  checks: string | null;
  comments: number;
  last_comment: string | null;
  last_comment_at: Date | string | null;
  calls: number;
};

/**
 * การ์ดพร้อมของประกอบ — เลือกการ์ดก่อน (CTE) แล้วค่อยต่อของอื่นทีละใบ
 * ⚠️ ห้าม RTRIM(citizen_id) ฝั่ง hr_recruitment — index ไม่ทำงาน วัดจริง 606 ใบ 62 วินาที (2 พ.ย. 2569)
 */
const cardSql = (where: string, top = '') => `
  WITH k AS (
    SELECT ${top} card_id, column_id, item_id, title, citizen_id, record_date, last_activity_at
      FROM dbo.ir_board_card WHERE ${where}
  )
  SELECT k.card_id, k.column_id, k.item_id, RTRIM(k.title) AS title,
    RTRIM(j1.job_description_name) AS position, RTRIM(j2.job_description_name) AS jobtype, RTRIM(h.site_name) AS site, RTRIM(h.mobile) AS mobile,
    k.record_date, k.last_activity_at,
    COALESCE((SELECT MAX(a.created_at) FROM dbo.ir_board_card_activity a WHERE a.card_id = k.card_id AND a.activity_type = 'card_moved'), k.record_date) AS moved_at,
    ${agg(`SELECT '^' + CAST(ct.tag_id AS varchar(12)) FROM dbo.ir_board_card_tag ct WHERE ct.card_id = k.card_id`)} AS tag_ids,
    ev.step_id, ev.step_outcome_id AS outcome_id, ev.recorded_at AS step_at, RTRIM(ev.request_no) AS step_req,
    sc.step_scheduled_at AS sched, sc.recorded_at AS sched_at,
    ${agg(`SELECT '^' + RTRIM(r.request_no) + '|' + ISNULL(${iso126('r.linked_at')}, '') FROM dbo.ir_board_card_request_link r WHERE r.card_id = k.card_id`)} AS links,
    ${agg(`SELECT '^' + RTRIM(a.staff_id) + '|' + ISNULL(${staffName('hs')}, RTRIM(a.staff_id)) + '|' + ISNULL(${iso126('a.assigned_at')}, '')
             FROM dbo.ir_board_card_assign a LEFT JOIN dbo.hr_staff hs ON hs.staff_id = a.staff_id WHERE a.card_id = k.card_id ORDER BY a.is_primary DESC`)} AS assignees,
    ${agg(`SELECT '^' + CAST(p.item_id AS varchar(12)) + '|' + ISNULL(${iso126('p.checked_at')}, '') FROM dbo.ir_board_checklist_progress p WHERE p.card_id = k.card_id AND p.is_checked = 'Y'`)} AS checks,
    (SELECT COUNT(*) FROM dbo.ir_board_card_comment m WHERE m.card_id = k.card_id AND m.deleted_at IS NULL) AS comments,
    lc.t AS last_comment, lc.at AS last_comment_at,
    (SELECT COUNT(*) FROM dbo.ir_board_card_activity a WHERE a.card_id = k.card_id AND a.activity_type = 'card_called') AS calls
  FROM k
  OUTER APPLY (SELECT TOP 1 x.job_description_code_1, x.job_description_code_2, x.site_name, x.mobile FROM dbo.hr_recruitment x WHERE x.citizen_id = k.citizen_id ORDER BY x.application_date DESC) h
  LEFT JOIN dbo.hr_ms_job_description_1 j1 ON j1.job_description_code_1 = h.job_description_code_1
  LEFT JOIN dbo.hr_ms_job_description_2 j2 ON j2.job_description_code_2 = h.job_description_code_2
  OUTER APPLY (SELECT TOP 1 e.step_id, e.step_outcome_id, e.recorded_at, e.request_no FROM dbo.ir_board_card_track_event e WHERE e.card_id = k.card_id ORDER BY e.recorded_at DESC) ev
  OUTER APPLY (SELECT TOP 1 e.step_scheduled_at, e.recorded_at FROM dbo.ir_board_card_track_event e WHERE e.card_id = k.card_id AND e.step_scheduled_at IS NOT NULL ORDER BY e.recorded_at DESC) sc
  OUTER APPLY (SELECT TOP 1 LEFT(RTRIM(m.comment_text), 120) AS t, m.created_at AS at FROM dbo.ir_board_card_comment m WHERE m.card_id = k.card_id AND m.deleted_at IS NULL ORDER BY m.created_at DESC) lc`;

function mapRawCard(r: CardRow): ErpRawCard {
  return {
    cardId: r.card_id,
    columnId: r.column_id,
    itemId: r.item_id ?? null,
    title: clean(r.title) ?? `การ์ด ${r.card_id}`,
    position: clean(r.position),
    jobType: clean(r.jobtype),
    site: clean(r.site),
    mobile: clean(r.mobile),
    createdAt: erpTime(r.record_date),
    lastActivityAt: erpTime(r.last_activity_at),
    movedAt: erpTime(r.moved_at),
    tagIds: rows(r.tag_ids).map(([id]) => Number(id)).filter((n) => Number.isInteger(n)),
    lastStep: r.step_id ? { stepId: r.step_id, outcomeId: r.outcome_id ?? null, at: erpTime(r.step_at), requestNo: clean(r.step_req) } : null,
    lastSchedule: r.sched ? { scheduledAt: erpTime(r.sched) as string, at: erpTime(r.sched_at) } : null,
    links: rows(r.links).map(([no, at]) => ({ requestNo: no.trim(), at: erpTime(at) })).filter((l) => l.requestNo),
    assignees: rows(r.assignees).map(([id, name, at]) => ({ staffId: id.trim(), name: (name ?? id).trim(), at: erpTime(at) })).filter((a) => a.staffId),
    checks: rows(r.checks).map(([id, at]) => ({ itemId: Number(id), at: erpTime(at) })).filter((c) => Number.isInteger(c.itemId)),
    comments: Number(r.comments) || 0,
    lastComment: r.last_comment ? { text: String(r.last_comment).trim(), at: erpTime(r.last_comment_at) } : null,
    calls: Number(r.calls) || 0,
  };
}

/**
 * การ์ดของบอร์ด — เลือก "วัน" (itemId) หรือช่วงวันที่นำเข้า (from/to · YYYY-MM-DD) · ไม่ส่งอะไร = วันล่าสุด (ค่าเริ่มของ ERP)
 * ทุกทางตัดวันก่อนปี 2568 ทิ้ง · จำกัด 2,000 ใบ/ครั้ง (subquery ต่อใบ)
 */
export async function listErpBoardRawCards(opts: { boardId?: number; itemId?: number | null; from?: string | null; to?: string | null; limit?: number }): Promise<ErpRawCard[]> {
  const boardId = opts.boardId ?? DEFAULT_BOARD_ID();
  const limit = Math.min(Math.max(opts.limit ?? CARD_LIMIT_MAX, 1), CARD_LIMIT_MAX);
  const inputs: Record<string, unknown> = { boardId, limit, minDate: ERP_BOARD_MIN_DATE };
  const where = [`board_id = @boardId`, `ISNULL(is_archived, 'N') <> 'Y'`, `item_id IN (${MIN_ITEMS})`];
  if (opts.itemId) {
    inputs.itemId = opts.itemId;
    where.push(`item_id = @itemId`);
  } else if (opts.from || opts.to) {
    if (opts.from) {
      inputs.fromDate = opts.from;
      where.push(`item_id IN (SELECT item_id FROM dbo.ir_board_item WHERE board_id = @boardId AND item_date >= CONVERT(date, @fromDate, 23))`);
    }
    if (opts.to) {
      inputs.toDate = opts.to;
      where.push(`item_id IN (SELECT item_id FROM dbo.ir_board_item WHERE board_id = @boardId AND item_date < DATEADD(day, 1, CONVERT(date, @toDate, 23)))`);
    }
  } else {
    where.push(`item_id = (SELECT TOP 1 item_id FROM dbo.ir_board_item WHERE board_id = @boardId AND ISNULL(is_archived, 'N') <> 'Y' ORDER BY item_date DESC)`);
  }
  const list = await siamrajSqlQuery<CardRow>(`${cardSql(where.join(' AND '), 'TOP (@limit)')} ORDER BY k.column_id, k.last_activity_at DESC`, inputs);
  return list.map(mapRawCard);
}

/** การ์ดใบเดียว (ใช้ตรวจปุ่มก่อนจด) */
export async function loadErpBoardRawCard(cardId: number, boardId = DEFAULT_BOARD_ID()): Promise<ErpRawCard | null> {
  const r = await siamrajSqlQuery<CardRow>(cardSql('card_id = @cardId AND board_id = @boardId'), { cardId, boardId });
  return r[0] ? mapRawCard(r[0]) : null;
}

/** การ์ดใบเดียว + ของในป๊อป (ความคิดเห็น · กิจกรรม · ประวัติขั้นตอน) */
export async function loadErpBoardRawDetail(cardId: number, boardId = DEFAULT_BOARD_ID()): Promise<{ raw: ErpRawCard; detail: ErpRawDetail } | null> {
  const inputs = { cardId, boardId };
  const cardRows = await siamrajSqlQuery<CardRow>(cardSql('card_id = @cardId AND board_id = @boardId'), inputs);
  if (!cardRows[0]) return null;
  const [comments, activity, track] = await Promise.all([
    siamrajSqlQuery<{ id: number; who: string | null; t: string | null; at: Date | string | null }>(
      `SELECT TOP 50 m.comment_id AS id, (SELECT TOP 1 ${staffName('hs')} FROM dbo.hr_staff hs WHERE hs.staff_id = m.created_by) AS who,
              RTRIM(m.comment_text) AS t, m.created_at AS at
         FROM dbo.ir_board_card_comment m WHERE m.card_id = @cardId AND m.deleted_at IS NULL ORDER BY m.created_at DESC`,
      inputs,
    ),
    siamrajSqlQuery<{ type: string | null; msg: string | null; actor: string | null; at: Date | string | null }>(
      `SELECT TOP 50 RTRIM(activity_type) AS type, LEFT(RTRIM(activity_message), 200) AS msg, RTRIM(actor_name) AS actor, created_at AS at
         FROM dbo.ir_board_card_activity WHERE card_id = @cardId ORDER BY created_at DESC`,
      inputs,
    ),
    siamrajSqlQuery<{ step_id: number; outcome_id: number | null; req: string | null; sched: Date | string | null; at: Date | string | null; by_name: string | null; remark: string | null }>(
      `SELECT TOP 50 e.step_id, e.step_outcome_id AS outcome_id, RTRIM(e.request_no) AS req, e.step_scheduled_at AS sched, e.recorded_at AS at,
              (SELECT TOP 1 ${staffName('hs')} FROM dbo.hr_staff hs WHERE hs.staff_id = e.recorded_by_staff_id) AS by_name,
              LEFT(RTRIM(e.remark), 200) AS remark
         FROM dbo.ir_board_card_track_event e WHERE e.card_id = @cardId ORDER BY e.recorded_at DESC`,
      inputs,
    ),
  ]);
  return {
    raw: mapRawCard(cardRows[0]),
    detail: {
      comments: comments.map((m) => ({ id: m.id, who: clean(m.who), text: clean(m.t) ?? '', at: erpTime(m.at) })),
      activity: activity.map((a) => ({ type: clean(a.type) ?? '', message: clean(a.msg), actor: clean(a.actor), at: erpTime(a.at) })),
      track: track.map((t) => ({
        stepId: t.step_id,
        outcomeId: t.outcome_id ?? null,
        requestNo: clean(t.req),
        scheduledAt: erpTime(t.sched),
        at: erpTime(t.at),
        by: clean(t.by_name),
        remark: clean(t.remark),
      })),
    },
  };
}

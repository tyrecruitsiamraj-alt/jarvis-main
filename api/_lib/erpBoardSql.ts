/**
 * ═══ บอร์ดรายชื่อผู้สมัครของ ERP (ir_board_*) — อ่านอย่างเดียว (เจ้าของ 2 พ.ย. 2569 "เริ่มช่วง 1 เลย") ═══
 *
 * ช่วง 1 = Jarvis อ่านบอร์ดมาโชว์ครบเหมือน ERP (ช่อง · วัน · การ์ด · ขั้นตอน · เช็กลิสต์ · แท็ก · ผู้ดูแล · คอมเมนต์ · ใบขอที่ผูก)
 * ทีมยังทำงานที่ ERP · ช่วง 2 (เขียนกลับ) รอคุยทีม ERP ก่อน — ไฟล์นี้ต้องไม่มี INSERT/UPDATE/DELETE
 *
 * โครง ERP ที่วัดจริง 2 พ.ย. 2569 (บอร์ด 1 "รายชื่อผู้สมัครงาน ปี 2569" 3,133 ใบ):
 * - ir_board_item = "วัน" ที่นำเข้า (ทุกการ์ดมี item_id · แถบซ้าย เดือน → วัน ของ ERP)
 * - ir_board_card.citizen_id → hr_recruitment (application_no บนการ์ดว่างทุกใบ ห้ามใช้)
 * - ขั้นตอน 7 ขั้น + ผล อยู่ ir_board_card_track_event (แถวล่าสุด = ขั้นปัจจุบัน) · วันนัด = step_scheduled_at
 * - เช็กลิสต์ 3 ชุด 8 ข้อ (ir_board_checklist_item · progress ต่อการ์ด)
 * - โทรหาผู้สมัคร = ir_board_card_activity.activity_type 'card_called'
 * - ผู้ดูแล = ir_board_card_assign.staff_id → hr_staff.nick_name
 * - ⚠️ ชื่อคนบนการ์ดเป็นข้อมูลส่วนบุคคล — เส้นนี้ staff เท่านั้น (rbac 'matching-board') · ไม่ลง log
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';

const DEFAULT_BOARD_ID = () => Number(process.env.BOARD_READY_BOARD_ID || 1);
const CARD_LIMIT_MAX = 2000;

const toIso = (v: Date | string | null | undefined): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const clean = (v: string | null | undefined) => (v && String(v).trim() ? String(v).trim() : null);
const splitList = (v: string | null | undefined) => (v ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : []);

export type ErpBoardColumn = { id: number; key: string | null; label: string; seq: number; isDone: boolean; cards: number };
/** "วัน" บนแถบซ้ายของ ERP (ir_board_item ชนิด date) */
export type ErpBoardDay = { itemId: number; date: string; label: string; cards: number };
export type ErpBoardStep = { id: number; seq: number; label: string; hasDate: boolean; dateLabel: string | null };
export type ErpBoardTag = { id: number; label: string };
export type ErpBoardOverview = {
  boardId: number;
  boardName: string | null;
  total: number;
  columns: ErpBoardColumn[];
  days: ErpBoardDay[];
  steps: ErpBoardStep[];
  tags: ErpBoardTag[];
  checklistTotal: number;
};

export type ErpBoardCard = {
  cardId: number;
  columnId: number;
  itemId: number | null;
  title: string;
  position: string | null;
  jobType: string | null;
  site: string | null;
  mobile: string | null;
  tags: string[];
  step: string | null;
  outcome: string | null;
  /** วันนัดของขั้นล่าสุดที่มีวัน (ISO) */
  scheduledAt: string | null;
  checklistDone: number;
  requestNos: string[];
  comments: number;
  lastComment: string | null;
  calls: number;
  assignees: string[];
  createdAt: string | null;
  lastActivityAt: string | null;
};

type ColumnRow = { column_id: number; column_key: string | null; label: string | null; seq_no: number; is_completed: string | null; cards: number };
type DayRow = { item_id: number; item_date: Date | string; label: string | null; cards: number };
type StepRow = { step_id: number; seq_no: number; label: string | null; is_scheduled_date: string | null; scheduled_date_label: string | null };
type TagRow = { tag_id: number; tag_label: string | null };

/** ช่อง · วัน · ขั้นตอน · แท็ก ของบอร์ด — ของที่ไม่เปลี่ยนรายนาที (โหลดครั้งเดียวตอนเปิดหน้า) */
export async function loadErpBoardOverview(boardId = DEFAULT_BOARD_ID()): Promise<ErpBoardOverview> {
  const inputs = { boardId };
  const [head, columns, days, steps, tags, chk] = await Promise.all([
    siamrajSqlQuery<{ board_name: string | null }>(`SELECT RTRIM(board_name) AS board_name FROM dbo.ir_board_head WHERE board_id = @boardId`, inputs),
    siamrajSqlQuery<ColumnRow>(
      `SELECT c.column_id, RTRIM(c.column_key) AS column_key, RTRIM(c.display_label_th) AS label, c.seq_no, c.is_completed,
              (SELECT COUNT(*) FROM dbo.ir_board_card k WHERE k.column_id = c.column_id AND ISNULL(k.is_archived, 'N') <> 'Y') AS cards
         FROM dbo.ir_board_column c
        WHERE c.board_id = @boardId AND c.is_active = 'Y'
        ORDER BY c.seq_no`,
      inputs,
    ),
    siamrajSqlQuery<DayRow>(
      `SELECT i.item_id, i.item_date, RTRIM(i.display_label) AS label,
              (SELECT COUNT(*) FROM dbo.ir_board_card k WHERE k.item_id = i.item_id AND ISNULL(k.is_archived, 'N') <> 'Y') AS cards
         FROM dbo.ir_board_item i
        WHERE i.board_id = @boardId AND ISNULL(i.is_archived, 'N') <> 'Y' AND i.item_date IS NOT NULL
        ORDER BY i.item_date DESC`,
      inputs,
    ),
    siamrajSqlQuery<StepRow>(
      `SELECT step_id, seq_no, RTRIM(label) AS label, is_scheduled_date, RTRIM(scheduled_date_label) AS scheduled_date_label
         FROM dbo.ir_board_workflow_step WHERE board_id = @boardId AND is_active = 'Y' ORDER BY seq_no`,
      inputs,
    ),
    siamrajSqlQuery<TagRow>(`SELECT tag_id, RTRIM(tag_label) AS tag_label FROM dbo.ir_board_tag_master WHERE board_id = @boardId AND is_active = 'Y' ORDER BY tag_id`, inputs),
    siamrajSqlQuery<{ n: number }>(
      `SELECT COUNT(*) AS n FROM dbo.ir_board_checklist_item i JOIN dbo.ir_board_checklist c ON c.checklist_id = i.checklist_id
        WHERE c.board_id = @boardId AND c.is_active = 'Y' AND i.is_active = 'Y'`,
      inputs,
    ),
  ]);
  const cols = columns.map((c) => ({
    id: c.column_id,
    key: clean(c.column_key),
    label: clean(c.label) ?? `ช่อง ${c.column_id}`,
    seq: Number(c.seq_no) || 0,
    isDone: c.is_completed === 'Y',
    cards: Number(c.cards) || 0,
  }));
  return {
    boardId,
    boardName: clean(head[0]?.board_name),
    total: cols.reduce((n, c) => n + c.cards, 0),
    columns: cols,
    days: days.map((d) => ({ itemId: d.item_id, date: (toIso(d.item_date) ?? '').slice(0, 10), label: clean(d.label) ?? '', cards: Number(d.cards) || 0 })),
    steps: steps.map((s) => ({ id: s.step_id, seq: Number(s.seq_no) || 0, label: clean(s.label) ?? '', hasDate: s.is_scheduled_date === 'Y', dateLabel: clean(s.scheduled_date_label) })),
    tags: tags.map((t) => ({ id: t.tag_id, label: clean(t.tag_label) ?? '' })),
    checklistTotal: Number(chk[0]?.n) || 0,
  };
}

type CardRow = {
  card_id: number;
  column_id: number;
  item_id: number | null;
  title: string | null;
  position: string | null;
  jobtype: string | null;
  site: string | null;
  mobile: string | null;
  tags: string | null;
  step: string | null;
  outcome: string | null;
  sched: Date | string | null;
  chk_done: number;
  reqs: string | null;
  comments: number;
  last_comment: string | null;
  calls: number;
  assignees: string | null;
  record_date: Date | string | null;
  last_activity_at: Date | string | null;
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
    (SELECT STUFF((SELECT ',' + RTRIM(t.tag_label) FROM dbo.ir_board_card_tag ct JOIN dbo.ir_board_tag_master t ON t.tag_id = ct.tag_id WHERE ct.card_id = k.card_id FOR XML PATH('')), 1, 1, '')) AS tags,
    RTRIM(s.label) AS step, RTRIM(o.label) AS outcome, sc.step_scheduled_at AS sched,
    (SELECT COUNT(*) FROM dbo.ir_board_checklist_progress p WHERE p.card_id = k.card_id AND p.is_checked = 'Y') AS chk_done,
    (SELECT STUFF((SELECT ',' + RTRIM(r.request_no) FROM dbo.ir_board_card_request_link r WHERE r.card_id = k.card_id FOR XML PATH('')), 1, 1, '')) AS reqs,
    (SELECT COUNT(*) FROM dbo.ir_board_card_comment m WHERE m.card_id = k.card_id AND m.deleted_at IS NULL) AS comments,
    lc.t AS last_comment,
    (SELECT COUNT(*) FROM dbo.ir_board_card_activity a WHERE a.card_id = k.card_id AND a.activity_type = 'card_called') AS calls,
    (SELECT STUFF((SELECT ',' + COALESCE(NULLIF(RTRIM(hs.nick_name), ''), RTRIM(hs.fname)) FROM dbo.ir_board_card_assign a LEFT JOIN dbo.hr_staff hs ON hs.staff_id = a.staff_id
      WHERE a.card_id = k.card_id ORDER BY a.is_primary DESC FOR XML PATH('')), 1, 1, '')) AS assignees,
    k.record_date, k.last_activity_at
  FROM k
  OUTER APPLY (SELECT TOP 1 x.job_description_code_1, x.job_description_code_2, x.site_name, x.mobile FROM dbo.hr_recruitment x WHERE x.citizen_id = k.citizen_id ORDER BY x.application_date DESC) h
  LEFT JOIN dbo.hr_ms_job_description_1 j1 ON j1.job_description_code_1 = h.job_description_code_1
  LEFT JOIN dbo.hr_ms_job_description_2 j2 ON j2.job_description_code_2 = h.job_description_code_2
  OUTER APPLY (SELECT TOP 1 e.step_id, e.step_outcome_id FROM dbo.ir_board_card_track_event e WHERE e.card_id = k.card_id ORDER BY e.recorded_at DESC) ev
  LEFT JOIN dbo.ir_board_workflow_step s ON s.step_id = ev.step_id
  LEFT JOIN dbo.ir_board_workflow_step_outcome o ON o.outcome_id = ev.step_outcome_id
  OUTER APPLY (SELECT TOP 1 e.step_scheduled_at FROM dbo.ir_board_card_track_event e WHERE e.card_id = k.card_id AND e.step_scheduled_at IS NOT NULL ORDER BY e.recorded_at DESC) sc
  OUTER APPLY (SELECT TOP 1 LEFT(RTRIM(m.comment_text), 120) AS t FROM dbo.ir_board_card_comment m WHERE m.card_id = k.card_id AND m.deleted_at IS NULL ORDER BY m.created_at DESC) lc`;

function mapCard(r: CardRow): ErpBoardCard {
  return {
    cardId: r.card_id,
    columnId: r.column_id,
    itemId: r.item_id ?? null,
    title: clean(r.title) ?? `การ์ด ${r.card_id}`,
    position: clean(r.position),
    jobType: clean(r.jobtype),
    site: clean(r.site),
    mobile: clean(r.mobile),
    tags: splitList(r.tags),
    step: clean(r.step),
    outcome: clean(r.outcome),
    scheduledAt: toIso(r.sched),
    checklistDone: Number(r.chk_done) || 0,
    requestNos: splitList(r.reqs),
    comments: Number(r.comments) || 0,
    lastComment: clean(r.last_comment),
    calls: Number(r.calls) || 0,
    assignees: splitList(r.assignees),
    createdAt: toIso(r.record_date),
    lastActivityAt: toIso(r.last_activity_at),
  };
}

/**
 * การ์ดของบอร์ด — เลือก "วัน" (itemId) หรือช่วงวันที่นำเข้า (from/to · YYYY-MM-DD) · ไม่ส่งอะไร = วันล่าสุด (ค่าเริ่มของ ERP)
 * ⚠️ ทั้งบอร์ด 3,133 ใบ × subquery ต่อใบ หนักเกินสำหรับ SQL Server ⇒ จำกัด 2,000 ใบ/ครั้ง และบังคับให้เลือกช่วง
 */
export async function listErpBoardCards(opts: { boardId?: number; itemId?: number | null; from?: string | null; to?: string | null; limit?: number }): Promise<ErpBoardCard[]> {
  const boardId = opts.boardId ?? DEFAULT_BOARD_ID();
  const limit = Math.min(Math.max(opts.limit ?? CARD_LIMIT_MAX, 1), CARD_LIMIT_MAX);
  const inputs: Record<string, unknown> = { boardId, limit };
  const where = [`board_id = @boardId`, `ISNULL(is_archived, 'N') <> 'Y'`];
  if (opts.itemId) {
    inputs.itemId = opts.itemId;
    where.push(`item_id = @itemId`);
  } else if (opts.from || opts.to) {
    if (opts.from) {
      inputs.fromDate = opts.from;
      where.push(`item_id IN (SELECT item_id FROM dbo.ir_board_item WHERE board_id = @boardId AND CAST(item_date AS date) >= CONVERT(date, @fromDate, 23))`);
    }
    if (opts.to) {
      inputs.toDate = opts.to;
      where.push(`item_id IN (SELECT item_id FROM dbo.ir_board_item WHERE board_id = @boardId AND CAST(item_date AS date) <= CONVERT(date, @toDate, 23))`);
    }
  } else {
    where.push(`item_id = (SELECT TOP 1 item_id FROM dbo.ir_board_item WHERE board_id = @boardId AND ISNULL(is_archived, 'N') <> 'Y' ORDER BY item_date DESC)`);
  }
  const rows = await siamrajSqlQuery<CardRow>(
    `${cardSql(where.join(' AND '), 'TOP (@limit)')} ORDER BY k.column_id, k.last_activity_at DESC`,
    inputs,
  );
  return rows.map(mapCard);
}

export type ErpBoardComment = { who: string | null; text: string; at: string | null };
export type ErpBoardChecklistItem = { group: string; item: string; checked: boolean };
export type ErpBoardActivity = { type: string; message: string | null; actor: string | null; at: string | null };
export type ErpBoardTrackEvent = { requestNo: string | null; step: string; outcome: string | null; scheduledAt: string | null; at: string | null; by: string | null; remark: string | null };
export type ErpBoardCardDetail = {
  card: ErpBoardCard;
  comments: ErpBoardComment[];
  checklist: ErpBoardChecklistItem[];
  activity: ErpBoardActivity[];
  track: ErpBoardTrackEvent[];
};

/** ป๊อปการ์ด — คอมเมนต์ · เช็กลิสต์ทีละข้อ · กิจกรรม · ประวัติขั้นตอน */
export async function loadErpBoardCardDetail(cardId: number, boardId = DEFAULT_BOARD_ID()): Promise<ErpBoardCardDetail | null> {
  const inputs = { cardId, boardId };
  const cardRows = await siamrajSqlQuery<CardRow>(cardSql('card_id = @cardId AND board_id = @boardId'), inputs);
  if (!cardRows[0]) return null;
  const [comments, checklist, activity, track] = await Promise.all([
    siamrajSqlQuery<{ who: string | null; t: string | null; at: Date | string | null }>(
      `SELECT TOP 30 (SELECT TOP 1 COALESCE(NULLIF(RTRIM(hs.nick_name), ''), RTRIM(hs.fname)) FROM dbo.hr_staff hs WHERE hs.staff_id = m.created_by) AS who,
              RTRIM(m.comment_text) AS t, m.created_at AS at
         FROM dbo.ir_board_card_comment m WHERE m.card_id = @cardId AND m.deleted_at IS NULL ORDER BY m.created_at DESC`,
      inputs,
    ),
    siamrajSqlQuery<{ grp: string | null; item: string | null; checked: string | null }>(
      `SELECT RTRIM(c.title) AS grp, RTRIM(i.item_text) AS item,
              (SELECT TOP 1 p.is_checked FROM dbo.ir_board_checklist_progress p WHERE p.card_id = @cardId AND p.item_id = i.item_id) AS checked
         FROM dbo.ir_board_checklist c JOIN dbo.ir_board_checklist_item i ON i.checklist_id = c.checklist_id
        WHERE c.board_id = @boardId AND c.is_active = 'Y' AND i.is_active = 'Y' ORDER BY c.seq_no, i.seq_no`,
      inputs,
    ),
    siamrajSqlQuery<{ type: string | null; msg: string | null; actor: string | null; at: Date | string | null }>(
      `SELECT TOP 30 RTRIM(activity_type) AS type, LEFT(RTRIM(activity_message), 200) AS msg, RTRIM(actor_name) AS actor, created_at AS at
         FROM dbo.ir_board_card_activity WHERE card_id = @cardId ORDER BY created_at DESC`,
      inputs,
    ),
    siamrajSqlQuery<{ req: string | null; step: string | null; outcome: string | null; sched: Date | string | null; at: Date | string | null; by_name: string | null; remark: string | null }>(
      `SELECT TOP 30 RTRIM(e.request_no) AS req, RTRIM(s.label) AS step, RTRIM(o.label) AS outcome, e.step_scheduled_at AS sched, e.recorded_at AS at,
              (SELECT TOP 1 COALESCE(NULLIF(RTRIM(hs.nick_name), ''), RTRIM(hs.fname)) FROM dbo.hr_staff hs WHERE hs.staff_id = e.recorded_by_staff_id) AS by_name,
              LEFT(RTRIM(e.remark), 200) AS remark
         FROM dbo.ir_board_card_track_event e
         JOIN dbo.ir_board_workflow_step s ON s.step_id = e.step_id
         LEFT JOIN dbo.ir_board_workflow_step_outcome o ON o.outcome_id = e.step_outcome_id
        WHERE e.card_id = @cardId ORDER BY e.recorded_at DESC`,
      inputs,
    ),
  ]);
  return {
    card: mapCard(cardRows[0]),
    comments: comments.map((m) => ({ who: clean(m.who), text: clean(m.t) ?? '', at: toIso(m.at) })),
    checklist: checklist.map((c) => ({ group: clean(c.grp) ?? '', item: clean(c.item) ?? '', checked: c.checked === 'Y' })),
    activity: activity.map((a) => ({ type: clean(a.type) ?? '', message: clean(a.msg), actor: clean(a.actor), at: toIso(a.at) })),
    track: track.map((t) => ({ requestNo: clean(t.req), step: clean(t.step) ?? '', outcome: clean(t.outcome), scheduledAt: toIso(t.sched), at: toIso(t.at), by: clean(t.by_name), remark: clean(t.remark) })),
  };
}

/**
 * การกดบนบอร์ดรายชื่อรอลงงานฝั่ง Jarvis (ตาราง erp_board_events · migration 172) — เพิ่มอย่างเดียว ห้ามแก้แถวเก่า
 * ตัวรวมกับ ERP อยู่ erpBoardMerge.ts · เจ้าของ 3 พ.ย. 2569 Choice "ทุกปุ่มบนบอร์ด"
 */
import { dbQuery } from './postgres.js';
import { logError } from './logger.js';
import { tableInAppSchema } from './schema.js';
import { ERP_BOARD_EVENT_KINDS, type JarvisBoardEvent, type NewBoardEvent } from './erpBoardMerge.js';

const table = () => tableInAppSchema('erp_board_events');
const users = () => tableInAppSchema('users');

type Row = {
  id: string;
  card_id: number;
  kind: string;
  column_id: number | null;
  from_column_id: number | null;
  step_id: number | null;
  outcome_id: number | null;
  scheduled_at: Date | null;
  request_no: string | null;
  item_id: number | null;
  staff_id: string | null;
  staff_name: string | null;
  tag_id: number | null;
  body: string | null;
  ref_event_id: string | null;
  actor_user_id: string | null;
  actor_name: string;
  created_at: Date;
};

const KINDS = new Set<string>(ERP_BOARD_EVENT_KINDS);

function mapRow(r: Row): JarvisBoardEvent | null {
  if (!KINDS.has(r.kind)) return null;
  return {
    id: Number(r.id),
    cardId: r.card_id,
    kind: r.kind as JarvisBoardEvent['kind'],
    columnId: r.column_id,
    fromColumnId: r.from_column_id,
    stepId: r.step_id,
    outcomeId: r.outcome_id,
    scheduledAt: r.scheduled_at ? r.scheduled_at.toISOString() : null,
    requestNo: r.request_no,
    itemId: r.item_id,
    staffId: r.staff_id,
    staffName: r.staff_name,
    tagId: r.tag_id,
    body: r.body,
    refEventId: r.ref_event_id == null ? null : Number(r.ref_event_id),
    actorUserId: r.actor_user_id,
    actorName: r.actor_name,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listErpBoardEvents(cardIds: readonly number[]): Promise<JarvisBoardEvent[]> {
  if (cardIds.length === 0) return [];
  try {
    const { rows } = await dbQuery<Row>(`select * from ${table()} where card_id = any($1::int[]) order by created_at, id`, [cardIds]);
    return rows.map(mapRow).filter((e): e is JarvisBoardEvent => e != null);
  } catch (e) {
    // deploy ขึ้นแอปก่อนรัน migration (deploy.yml) ⇒ นาทีแรกยังไม่มีตาราง = ยังไม่มีใครกดบน Jarvis · อย่างอื่นโยนต่อ
    if ((e as { code?: string })?.code !== '42P01') throw e;
    logError('erp-board-events', e, { note: 'ยังไม่มีตาราง erp_board_events (รอ migration 172)' });
    return [];
  }
}

/** ชื่อที่ขึ้นบนบอร์ด = ชื่อเล่นหน้าผู้ใช้งาน → ชื่อเต็ม → อีเมล */
export async function boardActorName(userId: string, email: string): Promise<string> {
  try {
    const { rows } = await dbQuery<{ n: string | null }>(
      `select coalesce(nullif(trim(nickname), ''), nullif(trim(full_name), '')) as n from ${users()} where id = $1::uuid`,
      [userId],
    );
    return rows[0]?.n || email;
  } catch {
    return email;
  }
}

/** จดหลายแถวในคำสั่งเดียว (ผล "ไม่ผ่าน" = ขั้นตอน + ย้ายช่อง ต้องเข้าพร้อมกัน) */
export async function insertErpBoardEvents(
  cardId: number,
  events: readonly NewBoardEvent[],
  actor: { userId: string | null; name: string },
): Promise<JarvisBoardEvent[]> {
  if (events.length === 0) return [];
  const cols = [
    'card_id', 'kind', 'column_id', 'from_column_id', 'step_id', 'outcome_id', 'scheduled_at', 'request_no',
    'item_id', 'staff_id', 'staff_name', 'tag_id', 'body', 'ref_event_id', 'actor_user_id', 'actor_name',
  ];
  const params: unknown[] = [];
  const values = events.map((e) => {
    const row = [
      cardId, e.kind, e.columnId ?? null, e.fromColumnId ?? null, e.stepId ?? null, e.outcomeId ?? null, e.scheduledAt ?? null,
      e.requestNo ?? null, e.itemId ?? null, e.staffId ?? null, e.staffName ?? null, e.tagId ?? null, e.body ?? null,
      e.refEventId ?? null, actor.userId, actor.name,
    ];
    const start = params.length;
    params.push(...row);
    return `(${row.map((_, i) => `$${start + i + 1}`).join(', ')})`;
  });
  const { rows } = await dbQuery<Row>(`insert into ${table()} (${cols.join(', ')}) values ${values.join(', ')} returning *`, params);
  return rows.map(mapRow).filter((e): e is JarvisBoardEvent => e != null);
}

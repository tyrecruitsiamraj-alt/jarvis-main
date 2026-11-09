/**
 * ═══ รวมบอร์ด ERP กับการกดบน Jarvis (เจ้าของ 3 พ.ย. 2569 Choice "ทุกปุ่มบนบอร์ด") — ฟังก์ชันล้วน มีเทสต์ ═══
 *
 * ERP = ชื่อ ประวัติ การ์ดใหม่ (อ่านอย่างเดียว · erpBoardSql.ts) · Jarvis = ทุกครั้งที่กดบนบอร์ด (erp_board_events)
 * กติกาชน: **อันที่เปลี่ยนล่าสุดชนะ** เทียบทีละเรื่อง — ช่อง · ใบขอทีละเลข · ผู้ดูแลทีละคน · ข้อตรวจทีละข้อ · ขั้นตอนล่าสุด
 * ⚠️ แท็กใน ERP ไม่มีเวลา ⇒ แท็กที่เคยกดบน Jarvis ใช้ของ Jarvis เสมอ · ไม่เคยกด = ของ ERP
 * ⚠️ เวลา ERP เป็นเวลาไทยแต่ไดรเวอร์ติดป้าย UTC ⇒ แปลงที่ `erpTime` ก่อนเทียบทุกครั้ง (เคยขึ้นเวลาล่วงหน้า 7 ชม.)
 */
import type { ErpBoardCard, ErpBoardColumn, ErpBoardOutcome, ErpBoardStep } from '../../src/lib/erpBoard.js';

export const ERP_BOARD_EVENT_KINDS = [
  'move',
  'step',
  'link',
  'unlink',
  'check',
  'uncheck',
  'assign',
  'unassign',
  'tag',
  'untag',
  'call',
  'comment',
  'comment_delete',
] as const;
export type ErpBoardEventKind = (typeof ERP_BOARD_EVENT_KINDS)[number];

export type JarvisBoardEvent = {
  id: number;
  cardId: number;
  kind: ErpBoardEventKind;
  columnId: number | null;
  fromColumnId: number | null;
  stepId: number | null;
  outcomeId: number | null;
  scheduledAt: string | null;
  requestNo: string | null;
  itemId: number | null;
  staffId: string | null;
  staffName: string | null;
  tagId: number | null;
  body: string | null;
  refEventId: number | null;
  actorUserId: string | null;
  actorName: string;
  createdAt: string;
};

/** เวลา ERP (เวลาไทยที่ไดรเวอร์ติดป้าย UTC หรือข้อความ 'YYYY-MM-DDTHH:mm:ss') → ISO ของเวลาจริง */
export function erpTime(v: Date | string | null | undefined): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : new Date(v.getTime() - 7 * 3_600_000).toISOString();
  const s = String(v).trim();
  const d = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? new Date(s) : new Date(`${s}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : Number.NEGATIVE_INFINITY);

// ชนิดที่หน้าเว็บใช้ ประกาศที่เดียวใน `src/lib/erpBoard.ts` (review 9 พ.ย. 2569 เดิมเขียนซ้ำทุกช่อง) — import แบบ type ไม่ลากโค้ดหน้าเว็บมาฝั่งนี้
export type ErpBoardColumnMeta = ErpBoardColumn;
export type ErpBoardStepMeta = ErpBoardStep;
export type ErpBoardOutcomeMeta = ErpBoardOutcome;
export type ErpBoardChecklistMeta = { itemId: number; group: string; item: string };
export type ErpBoardMeta = {
  boardId: number;
  boardName: string | null;
  columns: ErpBoardColumnMeta[];
  steps: ErpBoardStepMeta[];
  outcomes: ErpBoardOutcomeMeta[];
  tags: { id: number; label: string }[];
  checklist: ErpBoardChecklistMeta[];
  staff: { id: string; name: string }[];
};

/** การ์ดดิบจาก ERP — มีเวลาทุกเรื่องที่ต้องเทียบ */
export type ErpRawCard = {
  cardId: number;
  columnId: number;
  itemId: number | null;
  title: string;
  position: string | null;
  jobType: string | null;
  site: string | null;
  mobile: string | null;
  createdAt: string | null;
  lastActivityAt: string | null;
  /** ย้ายช่องครั้งล่าสุดใน ERP (ไม่เคยย้าย = วันนำเข้า) */
  movedAt: string | null;
  tagIds: number[];
  lastStep: { stepId: number; outcomeId: number | null; at: string | null; requestNo: string | null } | null;
  lastSchedule: { scheduledAt: string; at: string | null } | null;
  links: { requestNo: string; at: string | null }[];
  assignees: { staffId: string; name: string; at: string | null }[];
  checks: { itemId: number; at: string | null }[];
  comments: number;
  lastComment: { text: string; at: string | null } | null;
  calls: number;
};

export type { ErpBoardCard };

type Toggle = { on: boolean; at: number };
/** สถานะทีละกุญแจ: ของ ERP แล้วทับด้วยการกดบน Jarvis ที่ใหม่กว่า */
function latestToggles<K>(erp: Iterable<[K, number]>, events: Iterable<{ key: K; on: boolean; at: number }>): Map<K, Toggle> {
  const m = new Map<K, Toggle>();
  for (const [k, at] of erp) m.set(k, { on: true, at });
  for (const e of events) {
    const cur = m.get(e.key);
    if (!cur || e.at >= cur.at) m.set(e.key, { on: e.on, at: e.at });
  }
  return m;
}
const onKeys = <K>(m: Map<K, Toggle>) => [...m.entries()].filter(([, v]) => v.on).map(([k]) => k);

/** ลำดับเวลาของเหตุการณ์ Jarvis (เก่า → ใหม่) — id กันเสมอเมื่อเวลาเท่ากัน */
const byTime = (a: JarvisBoardEvent, b: JarvisBoardEvent) => ms(a.createdAt) - ms(b.createdAt) || a.id - b.id;

export function mergeErpBoardCard(raw: ErpRawCard, events: readonly JarvisBoardEvent[], meta: ErpBoardMeta): ErpBoardCard {
  const ev = events.filter((e) => e.cardId === raw.cardId).sort(byTime);

  // ช่อง: ย้ายบน Jarvis ที่ใหม่กว่าการย้ายครั้งล่าสุดใน ERP
  let columnId = raw.columnId;
  let columnAt = ms(raw.movedAt);
  for (const e of ev) if (e.kind === 'move' && e.columnId != null && ms(e.createdAt) >= columnAt) {
    columnId = e.columnId;
    columnAt = ms(e.createdAt);
  }

  // ขั้นตอนล่าสุด + วันนัดล่าสุด
  let step = raw.lastStep ? { stepId: raw.lastStep.stepId, outcomeId: raw.lastStep.outcomeId, at: ms(raw.lastStep.at) } : null;
  let sched = raw.lastSchedule ? { scheduledAt: raw.lastSchedule.scheduledAt as string | null, at: ms(raw.lastSchedule.at) } : null;
  for (const e of ev) {
    if (e.kind !== 'step' || e.stepId == null) continue;
    const at = ms(e.createdAt);
    if (!step || at >= step.at) step = { stepId: e.stepId, outcomeId: e.outcomeId, at };
    if (e.scheduledAt && (!sched || at >= sched.at)) sched = { scheduledAt: e.scheduledAt, at };
  }

  const links = latestToggles(
    raw.links.map((l) => [l.requestNo, ms(l.at)] as [string, number]),
    ev.filter((e) => (e.kind === 'link' || e.kind === 'unlink') && e.requestNo).map((e) => ({ key: e.requestNo as string, on: e.kind === 'link', at: ms(e.createdAt) })),
  );
  const names = new Map(raw.assignees.map((a) => [a.staffId, a.name]));
  for (const e of ev) if (e.kind === 'assign' && e.staffId && e.staffName) names.set(e.staffId, e.staffName);
  const assign = latestToggles(
    raw.assignees.map((a) => [a.staffId, ms(a.at)] as [string, number]),
    ev.filter((e) => (e.kind === 'assign' || e.kind === 'unassign') && e.staffId).map((e) => ({ key: e.staffId as string, on: e.kind === 'assign', at: ms(e.createdAt) })),
  );
  const checks = latestToggles(
    raw.checks.map((c) => [c.itemId, ms(c.at)] as [number, number]),
    ev.filter((e) => (e.kind === 'check' || e.kind === 'uncheck') && e.itemId != null).map((e) => ({ key: e.itemId as number, on: e.kind === 'check', at: ms(e.createdAt) })),
  );
  // แท็ก ERP ไม่มีเวลา = เก่าสุดเสมอ
  const tags = latestToggles(
    raw.tagIds.map((t) => [t, Number.NEGATIVE_INFINITY] as [number, number]),
    ev.filter((e) => (e.kind === 'tag' || e.kind === 'untag') && e.tagId != null).map((e) => ({ key: e.tagId as number, on: e.kind === 'tag', at: ms(e.createdAt) })),
  );

  const deleted = new Set(ev.filter((e) => e.kind === 'comment_delete' && e.refEventId != null).map((e) => e.refEventId));
  const myComments = ev.filter((e) => e.kind === 'comment' && !deleted.has(e.id) && e.body);
  const lastMine = myComments[myComments.length - 1];
  const lastComment = lastMine && ms(lastMine.createdAt) >= ms(raw.lastComment?.at) ? lastMine.body : (raw.lastComment?.text ?? null);

  const activeItems = new Set(meta.checklist.map((c) => c.itemId));
  const checkedItemIds = onKeys(checks).filter((id) => activeItems.has(id)).sort((a, b) => a - b);
  const tagIds = onKeys(tags);
  const tagLabel = new Map(meta.tags.map((t) => [t.id, t.label]));
  const stepMeta = step ? meta.steps.find((s) => s.id === step!.stepId) : undefined;
  const outcomeMeta = step?.outcomeId != null ? meta.outcomes.find((o) => o.id === step!.outcomeId) : undefined;
  const assigneeIds = onKeys(assign);
  const lastEv = ev[ev.length - 1];

  return {
    cardId: raw.cardId,
    columnId,
    itemId: raw.itemId,
    title: raw.title,
    position: raw.position,
    jobType: raw.jobType,
    site: raw.site,
    mobile: raw.mobile,
    tags: tagIds.map((id) => tagLabel.get(id)).filter((x): x is string => Boolean(x)),
    tagIds,
    stepId: stepMeta?.id ?? null,
    step: stepMeta?.label ?? null,
    outcome: outcomeMeta?.label ?? null,
    scheduledAt: sched?.scheduledAt ?? null,
    checklistDone: checkedItemIds.length,
    checkedItemIds,
    requestNos: onKeys(links),
    comments: raw.comments + myComments.length,
    lastComment,
    calls: raw.calls + ev.filter((e) => e.kind === 'call').length,
    assignees: assigneeIds.map((id) => names.get(id) ?? id),
    assigneeIds,
    createdAt: raw.createdAt,
    lastActivityAt: lastEv && ms(lastEv.createdAt) > ms(raw.lastActivityAt) ? lastEv.createdAt : raw.lastActivityAt,
  };
}

export type ErpBoardComment = { id: string; who: string | null; text: string; at: string | null; mine: boolean };
export type ErpBoardActivity = { type: string; message: string | null; actor: string | null; at: string | null };
export type ErpBoardTrackEvent = { requestNo: string | null; step: string; outcome: string | null; scheduledAt: string | null; at: string | null; by: string | null; remark: string | null };
export type ErpBoardCardDetail = {
  card: ErpBoardCard;
  comments: ErpBoardComment[];
  checklist: { itemId: number; group: string; item: string; checked: boolean }[];
  activity: ErpBoardActivity[];
  track: ErpBoardTrackEvent[];
};
export type ErpRawDetail = {
  comments: { id: number; who: string | null; text: string; at: string | null }[];
  activity: ErpBoardActivity[];
  track: { stepId: number; outcomeId: number | null; requestNo: string | null; scheduledAt: string | null; at: string | null; by: string | null; remark: string | null }[];
};

const desc = <T extends { at: string | null }>(a: T, b: T) => ms(b.at) - ms(a.at);

/** ข้อความกิจกรรมของการกดบน Jarvis — ภาษาเดียวกับกิจกรรมของ ERP */
export function jarvisActivityMessage(e: JarvisBoardEvent, meta: ErpBoardMeta): { type: string; message: string | null } {
  const col = (id: number | null) => meta.columns.find((c) => c.id === id)?.label ?? '—';
  const tag = meta.tags.find((t) => t.id === e.tagId)?.label;
  const item = meta.checklist.find((c) => c.itemId === e.itemId)?.item;
  switch (e.kind) {
    case 'move':
      return { type: 'card_moved', message: `เปลี่ยนสถานะจาก ${col(e.fromColumnId)} เป็น ${col(e.columnId)}` };
    case 'step': {
      const s = meta.steps.find((x) => x.id === e.stepId)?.label ?? '';
      const o = meta.outcomes.find((x) => x.id === e.outcomeId)?.label;
      return { type: 'card_step', message: [s, o].filter(Boolean).join(' · ') };
    }
    case 'link':
      return { type: 'card_linked', message: e.requestNo };
    case 'unlink':
      return { type: 'card_unlinked', message: e.requestNo };
    case 'check':
      return { type: 'card_checked', message: item ?? null };
    case 'uncheck':
      return { type: 'card_unchecked', message: item ?? null };
    case 'assign':
      return { type: 'card_assigned', message: `มอบหมายให้ ${e.staffName ?? e.staffId}` };
    case 'unassign':
      return { type: 'card_unassigned', message: `เอา ${e.staffName ?? e.staffId} ออกจากผู้ดูแล` };
    case 'tag':
      return { type: 'card_tagged', message: tag ?? null };
    case 'untag':
      return { type: 'card_untagged', message: tag ?? null };
    case 'call':
      return { type: 'card_called', message: 'โทรหาผู้สมัคร' };
    case 'comment':
      return { type: 'card_commented', message: null };
    case 'comment_delete':
      return { type: 'card_comment_deleted', message: null };
  }
}

export function mergeErpBoardDetail(
  raw: ErpRawCard,
  rawDetail: ErpRawDetail,
  events: readonly JarvisBoardEvent[],
  meta: ErpBoardMeta,
  me: string | null,
): ErpBoardCardDetail {
  const card = mergeErpBoardCard(raw, events, meta);
  const ev = events.filter((e) => e.cardId === raw.cardId).sort(byTime);
  const deleted = new Set(ev.filter((e) => e.kind === 'comment_delete').map((e) => e.refEventId));
  const stepLabel = (id: number) => meta.steps.find((s) => s.id === id)?.label ?? '';
  const outcomeLabel = (id: number | null) => (id == null ? null : (meta.outcomes.find((o) => o.id === id)?.label ?? null));
  const checked = new Set(card.checkedItemIds);
  return {
    card,
    comments: [
      ...rawDetail.comments.map((c) => ({ id: `erp:${c.id}`, who: c.who, text: c.text, at: c.at, mine: false })),
      ...ev
        .filter((e) => e.kind === 'comment' && !deleted.has(e.id))
        .map((e) => ({ id: `j:${e.id}`, who: e.actorName, text: e.body ?? '', at: e.createdAt, mine: me != null && e.actorUserId === me })),
    ].sort(desc),
    checklist: meta.checklist.map((c) => ({ itemId: c.itemId, group: c.group, item: c.item, checked: checked.has(c.itemId) })),
    activity: [
      ...rawDetail.activity,
      ...ev.map((e) => ({ ...jarvisActivityMessage(e, meta), actor: e.actorName, at: e.createdAt })),
    ].sort(desc),
    track: [
      ...rawDetail.track.map((t) => ({ requestNo: t.requestNo, step: stepLabel(t.stepId), outcome: outcomeLabel(t.outcomeId), scheduledAt: t.scheduledAt, at: t.at, by: t.by, remark: t.remark })),
      ...ev
        .filter((e) => e.kind === 'step' && e.stepId != null)
        .map((e) => ({ requestNo: e.requestNo, step: stepLabel(e.stepId as number), outcome: outcomeLabel(e.outcomeId), scheduledAt: e.scheduledAt, at: e.createdAt, by: e.actorName, remark: e.body })),
    ].sort(desc),
  };
}

/* ─────────────── ตรวจปุ่มก่อนจด (ตามกติกา ERP ที่วัดจาก ir_board_workflow_* 3 พ.ย. 2569) ─────────────── */

export type ErpBoardAction =
  | { action: 'move'; columnId: number }
  | { action: 'step'; stepId: number; outcomeId?: number | null; scheduledAt?: string | null; requestNo?: string | null; toColumnId?: number | null; remark?: string | null }
  | { action: 'link' | 'unlink'; requestNo: string }
  | { action: 'check' | 'uncheck'; itemId: number }
  | { action: 'assign' | 'unassign'; staffId: string }
  | { action: 'tag' | 'untag'; tagId: number }
  | { action: 'call' }
  | { action: 'comment'; body: string }
  | { action: 'comment_delete'; commentId: number };

export type NewBoardEvent = Partial<Omit<JarvisBoardEvent, 'id' | 'cardId' | 'actorUserId' | 'actorName' | 'createdAt'>> & { kind: ErpBoardEventKind };
export type ActionCheck = { ok: true; events: NewBoardEvent[] } | { ok: false; message: string };

const REQUEST_NO_RE = /^[A-Z]{2,5}\d{5,9}$/;
const fail = (message: string): ActionCheck => ({ ok: false, message });

/**
 * ปุ่มนี้กดได้ไหม + จดอะไรบ้าง · `ownComments` = id ความคิดเห็น Jarvis ของคนกด (ลบได้เฉพาะของตัวเอง)
 * กติกา ERP: In process / Done ต้องผูกใบขอ · ลงขั้นต้องมีใบขอ · ผล "ไม่ผ่าน/ไม่สำเร็จ" ต้องเลือก Drop หรือ Re Use · "ไปทำงาน" ย้ายไป Done เอง
 */
export function checkErpBoardAction(a: ErpBoardAction, card: ErpBoardCard, meta: ErpBoardMeta, ownComments: ReadonlySet<number>): ActionCheck {
  const column = (id: number) => meta.columns.find((c) => c.id === id);
  const moveTo = (to: number): NewBoardEvent => ({ kind: 'move', columnId: to, fromColumnId: card.columnId });
  switch (a.action) {
    case 'move': {
      const to = column(a.columnId);
      if (!to) return fail('ไม่มีช่องนี้บนบอร์ด');
      if (to.id === card.columnId) return fail(`การ์ดอยู่ช่อง ${to.label} อยู่แล้ว`);
      if (to.requiresLink && card.requestNos.length === 0) return fail(`ผูกใบขอก่อนย้ายไป ${to.label}`);
      return { ok: true, events: [moveTo(to.id)] };
    }
    case 'step': {
      const step = meta.steps.find((s) => s.id === a.stepId);
      if (!step) return fail('ไม่มีขั้นตอนนี้');
      if (card.requestNos.length === 0) return fail('ผูกใบขอก่อนลงขั้นตอน');
      const requestNo = a.requestNo ?? card.requestNos[0];
      if (!card.requestNos.includes(requestNo)) return fail(`ใบขอ ${requestNo} ไม่ได้ผูกกับคนนี้`);
      const outcome = a.outcomeId != null ? meta.outcomes.find((o) => o.id === a.outcomeId && o.stepId === step.id) : null;
      if (a.outcomeId != null && !outcome) return fail('ผลนี้ไม่ใช่ของขั้นนี้');
      if (a.scheduledAt && !step.hasDate) return fail('ขั้นนี้ไม่มีวันนัด');
      if (a.scheduledAt && Number.isNaN(Date.parse(a.scheduledAt))) return fail('วันที่ไม่ถูกต้อง');
      const events: NewBoardEvent[] = [
        { kind: 'step', stepId: step.id, outcomeId: outcome?.id ?? null, scheduledAt: a.scheduledAt ?? null, requestNo, body: a.remark?.trim() || null },
      ];
      const targets = outcome?.toColumnIds ?? [];
      if (targets.length > 1) {
        if (a.toColumnId == null || !targets.includes(a.toColumnId)) {
          return fail(`เลือกว่าจะย้ายไป ${targets.map((id) => column(id)?.label).join(' หรือ ')}`);
        }
        if (a.toColumnId !== card.columnId) events.push(moveTo(a.toColumnId));
      } else if (targets.length === 1 && targets[0] !== card.columnId) {
        events.push(moveTo(targets[0]));
      }
      return { ok: true, events };
    }
    case 'link': {
      const no = a.requestNo.trim().toUpperCase();
      if (!REQUEST_NO_RE.test(no)) return fail('เลขที่ใบขอไม่ถูกต้อง');
      if (card.requestNos.includes(no)) return fail(`ผูก ${no} อยู่แล้ว`);
      return { ok: true, events: [{ kind: 'link', requestNo: no }] };
    }
    case 'unlink': {
      if (!card.requestNos.includes(a.requestNo)) return fail(`ไม่ได้ผูก ${a.requestNo}`);
      const col = column(card.columnId);
      if (col?.requiresLink && card.requestNos.length === 1) return fail(`การ์ดอยู่ช่อง ${col.label} ต้องมีใบขออย่างน้อย 1 ใบ`);
      return { ok: true, events: [{ kind: 'unlink', requestNo: a.requestNo }] };
    }
    case 'check':
    case 'uncheck': {
      if (!meta.checklist.some((c) => c.itemId === a.itemId)) return fail('ไม่มีข้อตรวจนี้');
      const on = card.checkedItemIds.includes(a.itemId);
      if ((a.action === 'check') === on) return { ok: true, events: [] };
      return { ok: true, events: [{ kind: a.action, itemId: a.itemId }] };
    }
    case 'assign': {
      const s = meta.staff.find((x) => x.id === a.staffId);
      if (!s) return fail('ไม่มีรายชื่อนี้');
      if (card.assigneeIds.includes(s.id)) return { ok: true, events: [] };
      return { ok: true, events: [{ kind: 'assign', staffId: s.id, staffName: s.name }] };
    }
    case 'unassign': {
      if (!card.assigneeIds.includes(a.staffId)) return { ok: true, events: [] };
      const name = card.assignees[card.assigneeIds.indexOf(a.staffId)] ?? null;
      return { ok: true, events: [{ kind: 'unassign', staffId: a.staffId, staffName: name }] };
    }
    case 'tag':
    case 'untag': {
      if (!meta.tags.some((t) => t.id === a.tagId)) return fail('ไม่มีแท็กนี้');
      if ((a.action === 'tag') === card.tagIds.includes(a.tagId)) return { ok: true, events: [] };
      return { ok: true, events: [{ kind: a.action, tagId: a.tagId }] };
    }
    case 'call':
      return { ok: true, events: [{ kind: 'call' }] };
    case 'comment': {
      const body = a.body.trim();
      if (!body) return fail('พิมพ์ความคิดเห็นก่อน');
      if (body.length > 1000) return fail('ความคิดเห็นยาวเกิน 1,000 ตัวอักษร');
      return { ok: true, events: [{ kind: 'comment', body }] };
    }
    case 'comment_delete':
      if (!ownComments.has(a.commentId)) return fail('ลบได้เฉพาะความคิดเห็นของตัวเองที่เขียนใน Jarvis');
      return { ok: true, events: [{ kind: 'comment_delete', refEventId: a.commentId }] };
  }
}

/** อ่าน body ของ POST เป็นปุ่ม — ผิดรูป = null */
export function parseErpBoardAction(b: Record<string, unknown>): ErpBoardAction | null {
  const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  switch (b.action) {
    case 'move':
      return int(b.columnId) ? { action: 'move', columnId: int(b.columnId) as number } : null;
    case 'step':
      return int(b.stepId)
        ? {
            action: 'step',
            stepId: int(b.stepId) as number,
            outcomeId: int(b.outcomeId),
            scheduledAt: str(b.scheduledAt),
            requestNo: str(b.requestNo),
            toColumnId: int(b.toColumnId),
            remark: str(b.remark)?.slice(0, 500) ?? null,
          }
        : null;
    case 'link':
    case 'unlink':
      return str(b.requestNo) ? { action: b.action, requestNo: str(b.requestNo) as string } : null;
    case 'check':
    case 'uncheck':
      return int(b.itemId) ? { action: b.action, itemId: int(b.itemId) as number } : null;
    case 'assign':
    case 'unassign':
      return str(b.staffId) ? { action: b.action, staffId: str(b.staffId) as string } : null;
    case 'tag':
    case 'untag':
      return int(b.tagId) ? { action: b.action, tagId: int(b.tagId) as number } : null;
    case 'call':
      return { action: 'call' };
    case 'comment':
      return typeof b.body === 'string' ? { action: 'comment', body: b.body } : null;
    case 'comment_delete':
      return int(b.commentId) ? { action: 'comment_delete', commentId: int(b.commentId) as number } : null;
    default:
      return null;
  }
}

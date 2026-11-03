/**
 * ═══ /api/matching/board — บอร์ดรายชื่อรอลงงาน (ERP อ่านอย่างเดียว + การกดบน Jarvis) ═══
 * GET ?overview=1        → ช่อง · วัน (ตั้งแต่ปี 2568) · ขั้นตอน · ผล · แท็ก · ข้อตรวจ · รายชื่อผู้ดูแล
 * GET ?item=<itemId>     → การ์ดของวันนั้น · หรือ ?from=YYYY-MM-DD&to=YYYY-MM-DD · ไม่ส่ง = วันล่าสุด
 * GET ?card=<cardId>     → ป๊อปการ์ด (ความคิดเห็น · ข้อตรวจ · กิจกรรม · ประวัติขั้นตอน)
 * POST { cardId, action, ... } → กดปุ่มบนบอร์ด (เจ้าของ 3 พ.ย. 2569 Choice "ทุกปุ่มบนบอร์ด") · คืนป๊อปการ์ดชุดใหม่
 * 🔴 บัญชี ERP ของ Jarvis อ่านอย่างเดียว ⇒ การกดจดที่ erp_board_events ไม่เขียน ERP · ชนกัน = อันที่เปลี่ยนล่าสุดชนะ
 * staff เท่านั้น (ชื่อคนจริง)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { getSiamrajSqlServerConfig } from '../_lib/siamrajSqlServer.js';
import { loadErpBoardDays, loadErpBoardMeta, loadErpBoardRawCard, loadErpBoardRawDetail, listErpBoardRawCards } from '../_lib/erpBoardSql.js';
import { boardActorName, insertErpBoardEvents, listErpBoardEvents } from '../_lib/erpBoardEvents.js';
import { checkErpBoardAction, mergeErpBoardCard, mergeErpBoardDetail, parseErpBoardAction } from '../_lib/erpBoardMerge.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}
const intOf = (v: string): number | null => (/^\d{1,9}$/.test(v) ? Number(v) : null);
const ymdOf = (v: string): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cardDetail(cardId: number, me: string | null) {
  const [found, meta, events] = await Promise.all([loadErpBoardRawDetail(cardId), loadErpBoardMeta(), listErpBoardEvents([cardId])]);
  return found ? mergeErpBoardDetail(found.raw, found.detail, events, meta, me) : null;
}

async function handler(req: AuthedReq, res: ApiRes) {
  try {
    const method = (req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST') return sendError(res, 405, 'Method not allowed', 'GET หรือ POST เท่านั้น');
    if (!getSiamrajSqlServerConfig()) return sendError(res, 503, 'Service unavailable', 'ยังไม่ได้ตั้งค่า Siamraj SQL Server (DB_HOST)');
    res.setHeader?.('Cache-Control', 'no-store');
    const me = UUID_RE.test(req.user.sub) ? req.user.sub : null;

    if (method === 'POST') {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      const body = raw as Record<string, unknown>;
      const cardId = typeof body.cardId === 'number' && Number.isInteger(body.cardId) && body.cardId > 0 ? body.cardId : null;
      const action = parseErpBoardAction(body);
      if (!cardId || !action) return sendError(res, 400, 'Bad request', 'ข้อมูลปุ่มไม่ครบ');
      const [rawCard, meta, events] = await Promise.all([loadErpBoardRawCard(cardId), loadErpBoardMeta(), listErpBoardEvents([cardId])]);
      if (!rawCard) return sendError(res, 404, 'Not found', 'ไม่พบการ์ดนี้บนบอร์ด');
      const card = mergeErpBoardCard(rawCard, events, meta);
      const deleted = new Set(events.filter((e) => e.kind === 'comment_delete').map((e) => e.refEventId));
      const own = new Set(events.filter((e) => e.kind === 'comment' && me != null && e.actorUserId === me && !deleted.has(e.id)).map((e) => e.id));
      const check = checkErpBoardAction(action, card, meta, own);
      if (!check.ok) return sendError(res, 400, 'Bad request', check.message);
      if (check.events.length > 0) {
        const name = await boardActorName(req.user.sub, req.user.email);
        const saved = await insertErpBoardEvents(cardId, check.events, { userId: me, name });
        await auditFromAuthed(req, {
          action: `erp_board.${action.action}`,
          entityType: 'erp_board_card',
          entityId: String(cardId),
          before: { columnId: card.columnId, step: card.step, requestNos: card.requestNos },
          after: saved.map((e) => ({ id: e.id, kind: e.kind, columnId: e.columnId, stepId: e.stepId, outcomeId: e.outcomeId, requestNo: e.requestNo, itemId: e.itemId, staffId: e.staffId, tagId: e.tagId })),
        });
      }
      return res.status(200).json(await cardDetail(cardId, me));
    }

    const cardParam = intOf(getQuery(req, 'card'));
    if (cardParam) {
      const detail = await cardDetail(cardParam, me);
      if (!detail) return sendError(res, 404, 'Not found', 'ไม่พบการ์ดนี้บนบอร์ด');
      return res.status(200).json(detail);
    }
    if (getQuery(req, 'overview') === '1') {
      const [meta, days] = await Promise.all([loadErpBoardMeta(), loadErpBoardDays()]);
      return res.status(200).json({ ...meta, days, total: days.reduce((n, d) => n + d.cards, 0) });
    }

    const rawCards = await listErpBoardRawCards({ itemId: intOf(getQuery(req, 'item')), from: ymdOf(getQuery(req, 'from')), to: ymdOf(getQuery(req, 'to')) });
    const [meta, events] = await Promise.all([loadErpBoardMeta(), listErpBoardEvents(rawCards.map((c) => c.cardId))]);
    return res.status(200).json({ cards: rawCards.map((c) => mergeErpBoardCard(c, events, meta)) });
  } catch (e) {
    return handleApiError(res, e, 'matching-board');
  }
}

export default withRbac(handler, 'matching-board');

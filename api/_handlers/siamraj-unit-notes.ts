import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { clearUnitRequestCache } from '../_lib/unitRequestCache.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { getUnitNote, upsertUnitNote } from '../_lib/siamrajUnitNotes.js';
import { dispatchWaitingApplicationsInBackground } from '../_lib/incomeReadyDispatch.js';
import { checkFunctionAccess } from '../_lib/roleFunctionGrants.js';
import { isSiamrajRequestInScope } from '../_lib/siamrajUnitRequests.js';

const OUT_OF_SCOPE = 'ไม่มีสิทธิ์เข้าถึงใบขอของแผนกอื่น';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      /* 🔴 `?history=1` (หมายเหตุที่เคยใช้ของใบอื่น) ถอดแล้ว 30 ก.ย. 2569 — ส่งหมายเหตุทั้งก้อนที่มีชื่อ/เบอร์/อีเมล
         ผู้สมัครปนอยู่ไปโชว์ในช่องหมายเหตุของทุกใบ · เจ้าของสั่งไม่ให้โชว์ ⇒ ไม่มีจอไหนเรียกแล้ว ห้ามเอากลับ */
      const requestNo = getString(req.query?.request_no);
      if (!requestNo) return sendError(res, 400, 'Bad request', 'request_no query is required');
      if (!(await isSiamrajRequestInScope(req.user, requestNo))) {
        return sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
      }
      const item = await getUnitNote(requestNo);
      return res.status(200).json(
        item ?? { request_no: requestNo, note: null, send_replacement: null, updated_at: null },
      );
    } catch (e) {
      return handleApiError(res, e, 'siamraj-unit-notes GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST' || method === 'PUT') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;
      const requestNo = getString(body.request_no);
      if (!requestNo) return sendError(res, 400, 'Bad request', 'request_no is required');
      if (!(await isSiamrajRequestInScope(req.user, requestNo))) {
        return sendError(res, 403, 'Forbidden', OUT_OF_SCOPE);
      }

      const touchesNote = body.note !== undefined;
      const touchesReplacement = body.send_replacement !== undefined;
      const touchesParserOverride = body.parser_override_text !== undefined;
      const touchesFieldOverrides = body.field_overrides !== undefined;
      if (!touchesNote && !touchesReplacement && !touchesParserOverride && !touchesFieldOverrides) {
        return sendError(
          res,
          400,
          'Bad request',
          'note, send_replacement, parser_override_text or field_overrides is required',
        );
      }

      if (touchesNote || touchesParserOverride || touchesFieldOverrides) {
        const access = await checkFunctionAccess(req.user.role, 'unit_notes_edit');
        if (!access.ok) return sendError(res, 403, 'Forbidden', access.message);
      }

      let sendReplacement: boolean | null | undefined;
      if (touchesReplacement) {
        const rawVal = body.send_replacement;
        if (rawVal === null) sendReplacement = null;
        else if (typeof rawVal === 'boolean') sendReplacement = rawVal;
        else return sendError(res, 400, 'Bad request', 'send_replacement must be boolean or null');
      }

      const item = await upsertUnitNote({
        requestNo,
        ...(touchesNote ? { note: body.note } : {}),
        ...(touchesReplacement ? { send_replacement: sendReplacement ?? null } : {}),
        ...(touchesParserOverride ? { parser_override_text: body.parser_override_text } : {}),
        ...(touchesFieldOverrides ? { field_overrides: body.field_overrides } : {}),
        userId: req.user.sub,
      });

      await auditFromAuthed(req, {
        action: 'siamraj_unit_note.upsert',
        entityType: 'siamraj_unit_note',
        entityId: requestNo,
        after: {
          note: item.note,
          send_replacement: item.send_replacement,
          parser_override_text: item.parser_override_text,
          field_overrides: item.field_overrides,
        },
      });

      // 🔴 ล้างสำเนาลิสต์ทันที — เหตุผลเต็มอยู่ที่ `siamraj-unit-assignments.ts` (21 ก.ย. 2569)
      clearUnitRequestCache();
      /**
       * ตั้งรายได้แล้ว → ใบสมัครผ่านลิงก์ที่ค้างเพราะยังไม่มีรายได้ เข้าคิว AI เอง (เจ้าของ 6 ต.ค. 2569 Choice
       * "ส่งเองเมื่อตั้งรายได้") · ไม่รอ · ล้มไม่กระทบการบันทึก — กติกาเต็มที่ `api/_lib/incomeReadyDispatch.ts`
       */
      if (touchesFieldOverrides) dispatchWaitingApplicationsInBackground(requestNo, item.field_overrides);
      return res.status(200).json(item);
    } catch (e) {
      return handleApiError(res, e, 'siamraj-unit-notes POST', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'siamraj-unit-notes');

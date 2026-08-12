/**
 * "รับไปโทรเอง" — ล็อกสิทธิ์โทรผู้สมัคร (กันเจ้าหน้าที่โทรชนกัน + กัน AI โทรทับ)
 *
 * GET    ?phones=08x,09x        → { holds: [...] }  ล็อกที่ยังถืออยู่ของเบอร์ชุดนี้ (วาดการ์ด)
 * GET    ?mine=1                → { holds: [...] }  ที่ฉันถืออยู่ (แถบหัวหน้า + หน้า "โทรของฉัน")
 * POST   { phone, source, candidateRef, jobId, ... }        → จับล็อก (409 ถ้ามีคนถือ)
 * PATCH  { holdId, outcome, scope?, note?, detail? }        → บันทึกผล + ปล่อยล็อก
 * DELETE ?holdId=…                                          → คืนงานโดยไม่บันทึกผล
 *
 * สิทธิ์: rbac 'matching-proposals' (ชุดเดียวกับข้อมูลผู้สมัครรายคนอื่นในหน้า Matching)
 * ปล่อย/บันทึกผลได้เฉพาะล็อกของตัวเอง — ยกเว้น admin/supervisor ที่แกะของคนอื่นได้ (โอนงาน)
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { isPgUndefinedTable } from '../_lib/postgres.js';
import { applyHumanCallFollowup } from '../_lib/callFollowup.js';
import { isSiamrajRequestInScope } from '../_lib/siamrajUnitRequests.js';
import { bangkokBusinessDateYmd } from '../_lib/businessDate.js';
import {
  acquireCallHold,
  getActiveCallHoldsByPhones,
  getCallHoldById,
  isCallHoldSource,
  isCallResultOutcome,
  listAllActiveCallHolds,
  listCallHoldsForUser,
  recordCallResult,
  releaseAllCallHoldsForUser,
  releaseCallHold,
  tallyCallResultsSince,
  transferCallHold,
  type CallHold,
} from '../_lib/candidateCallHolds.js';

/** ขอสถานะล็อกได้ครั้งละไม่เกินเท่านี้ — หน้า Matching โหลดทีละหน้าอยู่แล้ว */
const MAX_PHONES = 300;

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** ผู้ดูแลแกะล็อกของคนอื่นได้ (โอนงาน/เทกอง) — staff แกะได้แค่ของตัวเอง */
function canManageOthers(role: string | undefined): boolean {
  return role === 'admin' || role === 'supervisor';
}

/** บอร์ดหัวหน้า/โอนงาน/เทกอง — เห็นและจัดการล็อกของคนอื่นได้ */
function isSupervisorOrAbove(role: string | undefined): boolean {
  return canManageOthers(role);
}

/**
 * ส่งกลับให้หน้าเว็บ — **ไม่ส่งเบอร์กลับไป** เพราะหน้าเว็บมีเบอร์อยู่แล้วและใช้ ref เป็นคีย์
 * ทำให้ล็อกของแผนกอื่นไม่รั่วเบอร์ออกไป (เห็นแค่ว่า "มีคนถือ" กับชื่อคนถือ)
 */
function toWire(h: CallHold, viewerId: string | null) {
  return {
    id: h.id,
    candidateRef: h.candidateRef,
    source: h.source,
    candidateName: h.candidateName,
    jobId: h.jobId,
    requestNo: h.requestNo,
    heldByName: h.heldByName,
    heldAt: h.heldAt,
    expiresAt: h.expiresAt,
    mine: !!viewerId && h.heldByUserId === viewerId,
  };
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const viewerId = req.user?.sub ?? null;

  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');

      if (getQuery(req, 'mine') === '1') {
        if (!viewerId) return res.status(200).json({ holds: [], tally: null });
        const [holds, tally] = await Promise.all([
          listCallHoldsForUser(viewerId),
          tallyCallResultsSince(bangkokBusinessDateYmd(), viewerId),
        ]);
        return res.status(200).json({ holds: holds.map((h) => toWire(h, viewerId)), tally });
      }

      // บอร์ดหัวหน้า — เห็นล็อกของทุกคนในทีม + ยอดผลโทรวันนี้ของทั้งทีม
      if (getQuery(req, 'team') === '1') {
        if (!isSupervisorOrAbove(req.user?.role)) {
          return sendError(res, 403, 'Forbidden', 'เฉพาะหัวหน้า/แอดมิน');
        }
        const [holds, tally] = await Promise.all([
          listAllActiveCallHolds(),
          tallyCallResultsSince(bangkokBusinessDateYmd()),
        ]);
        return res.status(200).json({ holds: holds.map((h) => toWire(h, viewerId)), tally });
      }

      const phones = getQuery(req, 'phones')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (phones.length === 0) return res.status(200).json({ holds: [] });
      if (phones.length > MAX_PHONES) {
        return sendError(res, 400, 'Bad request', `ขอได้ครั้งละไม่เกิน ${MAX_PHONES} เบอร์`);
      }
      const map = await getActiveCallHoldsByPhones(phones);
      return res.status(200).json({
        holds: [...map.values()].map((h) => toWire(h, viewerId)),
      });
    }

    if (method === 'POST') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');

      const source = isCallHoldSource(body.source) ? body.source : null;
      if (!source) {
        return sendError(res, 400, 'Bad request', 'source ต้องเป็น board, irecruit หรือ application');
      }
      const phone = typeof body.phone === 'string' ? body.phone : '';
      const candidateRef = typeof body.candidateRef === 'string' ? body.candidateRef.trim() : '';
      const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
      if (!candidateRef) return sendError(res, 400, 'Bad request', 'ต้องระบุผู้สมัคร');
      if (!jobId) return sendError(res, 400, 'Bad request', 'ต้องระบุใบขอ');

      // รับงานโทรได้เฉพาะใบขอในแผนกตัวเอง — กติกาเดียวกับการจองตัว
      if (!(await isSiamrajRequestInScope(req.user, jobId))) {
        return sendError(res, 403, 'Forbidden', 'ไม่มีสิทธิ์เข้าถึงใบขอของแผนกอื่น');
      }

      const outcome = await acquireCallHold({
        phone,
        source,
        candidateRef,
        candidateName: body.candidateName,
        jobId,
        requestNo: body.requestNo,
        userId: viewerId,
        userName: req.user?.email ?? null,
      });

      if (!outcome.ok && outcome.reason === 'no_phone') {
        return sendError(res, 400, 'Bad request', 'ผู้สมัครคนนี้ไม่มีเบอร์ที่โทรได้ — รับไปโทรไม่ได้');
      }
      if (!outcome.ok) {
        const who = outcome.hold.heldByName || 'เจ้าหน้าที่อีกคน';
        return sendError(
          res,
          409,
          'Conflict',
          `${who} รับไปโทรแล้ว — รอผลหรือขอรับต่อ`,
          { hold: toWire(outcome.hold, viewerId) },
        );
      }

      void auditFromAuthed(req, {
        action: 'call-hold.acquire',
        entityType: 'candidate_call_hold',
        entityId: outcome.hold.id,
        after: { source, candidateRef, jobId },
      });

      return res.status(201).json({ hold: toWire(outcome.hold, viewerId) });
    }

    if (method === 'PATCH') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');
      const holdId = typeof body.holdId === 'string' ? body.holdId.trim() : '';
      if (!holdId) return sendError(res, 400, 'Bad request', 'ต้องระบุ holdId');

      // โอนงานให้คนอื่น (หัวหน้า) — คนละเรื่องกับการบันทึกผล จึงแยกทางออกก่อนเช็ค outcome
      if (typeof body.transferToUserId === 'string' && body.transferToUserId.trim()) {
        if (!isSupervisorOrAbove(req.user?.role)) {
          return sendError(res, 403, 'Forbidden', 'เฉพาะหัวหน้า/แอดมินที่โอนงานโทรได้');
        }
        const moved = await transferCallHold({
          holdId,
          toUserId: body.transferToUserId.trim(),
          toName: typeof body.transferToName === 'string' ? body.transferToName : null,
        });
        if (!moved) return sendError(res, 409, 'Conflict', 'งานโทรนี้ถูกปล่อยไปก่อนแล้ว');

        void auditFromAuthed(req, {
          action: 'call-hold.transfer',
          entityType: 'candidate_call_hold',
          entityId: holdId,
          after: { toUserId: body.transferToUserId, newHoldId: moved.id, jobId: moved.jobId },
        });
        return res.status(200).json({ hold: toWire(moved, viewerId) });
      }

      if (!isCallResultOutcome(body.outcome)) {
        return sendError(res, 400, 'Bad request', 'ผลโทรไม่ถูกต้อง');
      }

      const existing = await getCallHoldById(holdId);
      if (!existing) return sendError(res, 404, 'Not found', 'ไม่พบงานโทรนี้');
      if (existing.releasedAt) {
        return sendError(res, 409, 'Conflict', 'งานโทรนี้ถูกปล่อย/บันทึกผลไปแล้ว');
      }
      if (existing.heldByUserId !== viewerId && !canManageOthers(req.user?.role)) {
        return sendError(res, 403, 'Forbidden', 'บันทึกผลได้เฉพาะงานโทรที่ตัวเองถืออยู่');
      }

      const scope = body.scope === 'all' ? 'all' : body.scope === 'job' ? 'job' : null;
      const saved = await recordCallResult({
        holdId,
        outcome: body.outcome,
        scope,
        note: body.note,
        detail: isPlainObject(body.detail) ? body.detail : undefined,
      });
      if (!saved) return sendError(res, 409, 'Conflict', 'งานโทรนี้ถูกปล่อยไปก่อนแล้ว');

      // ผลที่คนกดเดินนโยบายเดียวกับผลของ AI — ไม่รับสายก็เข้าคิวโทรซ้ำ ขอเลื่อนก็นัดใหม่
      // "ไม่หางานแล้ว" พักเบอร์ · ครบเพดานตกถังต้องคนตาม (ดู src/lib/callFollowupPolicy.ts)
      // พลาดที่นี่ต้องไม่ทำให้การบันทึกผลล้ม — ผลถูกบันทึกไปแล้ว
      let followup: Awaited<ReturnType<typeof applyHumanCallFollowup>> = null;
      try {
        followup = await applyHumanCallFollowup({
          phone: existing.phone,
          jobId: saved.jobId,
          candidateRef: saved.candidateRef,
          outcome: body.outcome,
          declinedScope: scope,
          detail: isPlainObject(body.detail) ? body.detail : undefined,
          byName: req.user?.email ?? null,
        });
      } catch (e) {
        void e;
      }

      void auditFromAuthed(req, {
        action: 'call-hold.result',
        entityType: 'candidate_call_hold',
        entityId: holdId,
        after: {
          outcome: saved.resultOutcome,
          scope: saved.resultScope,
          jobId: saved.jobId,
          followup: followup?.action ?? null,
        },
      });

      return res.status(200).json({ hold: toWire(saved, viewerId), followup });
    }

    if (method === 'DELETE') {
      // เทกองของคนคนหนึ่งทั้งหมด (หัวหน้าใช้ตอนลูกทีมลาป่วย/ลาออก)
      const dumpUserId = getQuery(req, 'dumpUserId').trim();
      if (dumpUserId) {
        if (!isSupervisorOrAbove(req.user?.role)) {
          return sendError(res, 403, 'Forbidden', 'เฉพาะหัวหน้า/แอดมินที่เทกองได้');
        }
        const dumpReason = getQuery(req, 'reason') === 'to_ai' ? 'to_ai' : 'manual';
        const count = await releaseAllCallHoldsForUser(dumpUserId, dumpReason);

        void auditFromAuthed(req, {
          action: 'call-hold.dump',
          entityType: 'candidate_call_hold',
          entityId: dumpUserId,
          after: { reason: dumpReason, released: count },
        });
        return res.status(200).json({ released: count });
      }

      const holdId = getQuery(req, 'holdId').trim();
      if (!holdId) return sendError(res, 400, 'Bad request', 'ต้องระบุ holdId');
      const existing = await getCallHoldById(holdId);
      if (!existing) return sendError(res, 404, 'Not found', 'ไม่พบงานโทรนี้');
      if (existing.releasedAt) return res.status(200).json({ released: true });
      if (existing.heldByUserId !== viewerId && !canManageOthers(req.user?.role)) {
        return sendError(res, 403, 'Forbidden', 'คืนงานได้เฉพาะงานโทรที่ตัวเองถืออยู่');
      }

      const reasonRaw = getQuery(req, 'reason');
      const reason = reasonRaw === 'to_ai' ? 'to_ai' : reasonRaw === 'transferred' ? 'transferred' : 'manual';
      const released = await releaseCallHold(holdId, reason);

      void auditFromAuthed(req, {
        action: 'call-hold.release',
        entityType: 'candidate_call_hold',
        entityId: holdId,
        after: { reason, jobId: existing.jobId },
      });

      return res.status(200).json({ released: !!released });
    }

    res.setHeader?.('Allow', 'GET, POST, PATCH, DELETE');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/ต้องระบุ/.test(msg)) return sendError(res, 400, 'Bad request', msg);
    if (isPgUndefinedTable(e)) {
      return sendError(
        res,
        503,
        'Service unavailable',
        'ยังไม่ได้สร้างตารางงานโทร — ตัว migration จะรันเองตอน deploy รอบถัดไป',
      );
    }
    return handleApiError(res, e, 'matching-call-holds', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'matching-proposals');

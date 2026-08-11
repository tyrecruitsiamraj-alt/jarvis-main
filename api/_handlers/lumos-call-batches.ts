/**
 * ชุดส่งงานโทร — สร้าง / อนุมัติ / ยกเลิก / ถอนคนออก
 *
 * GET    /api/lumos/call-batches                    → { batches: [...] }
 * POST   { jobId, boardCardIds?, irecruitIds?, note? } → สร้างชุด **อนุมัติแล้ว** (ดูด้านล่าง)
 * PATCH  { batchId, action: 'approve'|'cancel', reason? }
 * DELETE ?batchId=&itemId=                          → ถอนคนออกจากชุด
 *
 * อนุมัติแล้ว **ยังไม่เข้าคิวทันที** — ตั้ง release_at ไว้ข้างหน้า (ช่วงถอนคำ)
 * ระหว่างนั้นยกเลิก/ถอนคนได้ · พ้นเวลาแล้ว releaseDueCallBatches() ค่อยส่งเข้าคิวจริง
 *
 * ⚠️ **POST ข้ามขั้นอนุมัติเสมอ (เจ้าของเคาะ 11 ส.ค. 2569)**
 * แผงอนุมัติถูกเอาออกจากทุกหน้าไปแล้ว ชุดที่สร้างเป็น `pending_approval` จึงค้างถาวร
 * (ตัวปล่อยแตะเฉพาะชุดที่ `approved`) — บนฐานจริงมีค้างแบบนั้น 1 ชุดตั้งแต่ 7 ส.ค.
 * ทางที่เลือก: ให้เส้นนี้เป็น `autoApprove` แล้ว **คงช่วงถอนคำ 10 นาทีไว้เหมือนเดิม**
 * เป็นตัวกันพลาดแทนการอนุมัติ · หน้า Matching มีแถบนับถอยหลัง + ปุ่มยกเลิกอยู่
 *
 * ไม่ใช่การผ่อนสิทธิ์: ปุ่ม "ส่ง AI โทร" บนหน้าเดียวกันยิงเข้าคิว**ทันที**ด้วย rbac ชุดนี้อยู่แล้ว
 * เส้นนี้จึงยังเข้มกว่าเดิม (หน่วง 10 นาที + ยกเลิกได้) ไม่ใช่หลวมกว่า
 *
 * สิทธิ์: สร้างได้ทุกคนที่ใช้หน้า Matching ได้ · **`action:'approve'` เฉพาะ supervisor/admin**
 * (เหลือไว้สำหรับชุดที่โหมด assist จัดให้ ซึ่งยังเป็น pending_approval — ถ้าจะให้ staff
 *  อนุมัติเองแก้ที่ canApprove() ที่เดียว)
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
import { isSiamrajRequestInScope } from '../_lib/siamrajUnitRequests.js';
import {
  approveCallBatch,
  cancelCallBatch,
  createCallBatch,
  getCallBatch,
  listCallBatches,
  removeCallBatchItem,
} from '../_lib/callBatchStore.js';
import { parseIdList } from './lumos-dispatch.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** อนุมัติได้ใคร — แก้ที่นี่ที่เดียวถ้าเจ้าของอยากให้ staff อนุมัติเองได้ */
function canApprove(role: string | undefined): boolean {
  return role === 'admin' || role === 'supervisor';
}

const MAX_ITEMS = 50;

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ batches: await listCallBatches(50) });
    }

    if (method === 'POST') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');
      const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
      if (!jobId) return sendError(res, 400, 'Bad request', 'ต้องระบุใบขอ');
      if (!(await isSiamrajRequestInScope(req.user, jobId))) {
        return sendError(res, 403, 'Forbidden', 'ไม่มีสิทธิ์เข้าถึงใบขอของแผนกอื่น');
      }

      const boardCardIds = parseIdList(body.boardCardIds);
      const irecruitIds = parseIdList(body.irecruitIds);
      const total = boardCardIds.length + irecruitIds.length;
      if (total === 0) return sendError(res, 400, 'Bad request', 'ต้องเลือกอย่างน้อย 1 คน');
      if (total > MAX_ITEMS) {
        return sendError(res, 400, 'Bad request', `เลือกได้ครั้งละไม่เกิน ${MAX_ITEMS} คน`);
      }

      // ชุดหนึ่งใช้ช่องเดียว — board → reminder · iRecruit → interview
      // ผสมสองช่องในชุดเดียวจะทำให้สถานะ/การยกเลิกกำกวม จึงบังคับให้แยกชุด
      if (boardCardIds.length > 0 && irecruitIds.length > 0) {
        return sendError(
          res,
          400,
          'Bad request',
          'แยกชุดกันระหว่าง "คนของเรา" กับ iRecruit — ส่งทีละช่อง',
        );
      }

      const channel = boardCardIds.length > 0 ? 'reminder' : 'interview';
      const source = boardCardIds.length > 0 ? 'board' : 'irecruit';
      const refs = boardCardIds.length > 0 ? boardCardIds : irecruitIds;

      const batch = await createCallBatch({
        channel,
        jobId,
        requestNo: typeof body.requestNo === 'string' ? body.requestNo : null,
        items: refs.map((ref) => ({ source, candidateRef: String(ref), candidateName: null })),
        note: typeof body.note === 'string' ? body.note : null,
        createdByUserId: req.user?.sub ?? null,
        createdByName: req.user?.email ?? null,
        // ⚠️ ห้ามถอดออกโดยไม่มีที่อนุมัติกลับมาก่อน — ถอดแล้วชุดจะค้างถาวรเงียบ ๆ
        // เหมือนก่อน 11 ส.ค. 2569 (มีเทสต์ source-guard คุมที่ callBatchStore.test.ts)
        autoApprove: true,
      });
      if (!batch) return sendError(res, 400, 'Bad request', 'สร้างชุดไม่สำเร็จ');

      void auditFromAuthed(req, {
        action: 'call-batch.create',
        entityType: 'lumos_call_batch',
        entityId: batch.id,
        // releaseAt เข้า audit ด้วย — "โทรเมื่อไหร่" เป็นข้อมูลที่ต้องตอบได้ย้อนหลัง
        after: { channel, jobId, count: refs.length, autoApproved: true, releaseAt: batch.releaseAt },
      });
      return res.status(201).json({ batch });
    }

    if (method === 'PATCH') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');
      const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
      if (!batchId) return sendError(res, 400, 'Bad request', 'ต้องระบุ batchId');

      const existing = await getCallBatch(batchId);
      if (!existing) return sendError(res, 404, 'Not found', 'ไม่พบชุดส่งนี้');
      if (!(await isSiamrajRequestInScope(req.user, existing.jobId))) {
        return sendError(res, 403, 'Forbidden', 'ไม่มีสิทธิ์เข้าถึงใบขอของแผนกอื่น');
      }

      if (body.action === 'approve') {
        if (!canApprove(req.user?.role)) {
          return sendError(res, 403, 'Forbidden', 'เฉพาะหัวหน้า/แอดมินที่อนุมัติได้');
        }
        const approved = await approveCallBatch(batchId, {
          userId: req.user?.sub ?? null,
          name: req.user?.email ?? null,
        });
        if (!approved) {
          return sendError(res, 409, 'Conflict', 'ชุดนี้อนุมัติ/ยกเลิกไปแล้ว');
        }
        void auditFromAuthed(req, {
          action: 'call-batch.approve',
          entityType: 'lumos_call_batch',
          entityId: batchId,
          after: { releaseAt: approved.releaseAt },
        });
        return res.status(200).json({ batch: approved });
      }

      if (body.action === 'cancel') {
        const cancelled = await cancelCallBatch(batchId, {
          name: req.user?.email ?? null,
          reason: typeof body.reason === 'string' ? body.reason : null,
        });
        if (!cancelled) {
          return sendError(res, 409, 'Conflict', 'ชุดนี้ถูกส่งเข้าคิวหรือยกเลิกไปแล้ว');
        }
        void auditFromAuthed(req, {
          action: 'call-batch.cancel',
          entityType: 'lumos_call_batch',
          entityId: batchId,
          after: { reason: cancelled.cancelReason },
        });
        return res.status(200).json({ batch: cancelled });
      }

      return sendError(res, 400, 'Bad request', "action ต้องเป็น 'approve' หรือ 'cancel'");
    }

    if (method === 'DELETE') {
      const batchId = getQuery(req, 'batchId').trim();
      const itemId = getQuery(req, 'itemId').trim();
      if (!batchId || !itemId) {
        return sendError(res, 400, 'Bad request', 'ต้องระบุ batchId และ itemId');
      }
      const existing = await getCallBatch(batchId);
      if (!existing) return sendError(res, 404, 'Not found', 'ไม่พบชุดส่งนี้');
      if (!(await isSiamrajRequestInScope(req.user, existing.jobId))) {
        return sendError(res, 403, 'Forbidden', 'ไม่มีสิทธิ์เข้าถึงใบขอของแผนกอื่น');
      }

      const ok = await removeCallBatchItem(batchId, itemId, req.user?.email ?? null);
      if (!ok) return sendError(res, 409, 'Conflict', 'ถอนออกไม่ได้ — ชุดถูกส่งไปแล้วหรือถอนอยู่แล้ว');

      void auditFromAuthed(req, {
        action: 'call-batch.remove-item',
        entityType: 'lumos_call_batch',
        entityId: batchId,
        after: { itemId },
      });
      return res.status(200).json({ batch: await getCallBatch(batchId) });
    }

    res.setHeader?.('Allow', 'GET, POST, PATCH, DELETE');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    if (isPgUndefinedTable(e)) {
      return sendError(
        res,
        503,
        'Service unavailable',
        'ยังไม่ได้สร้างตารางชุดส่งงาน — migration จะรันเองตอน deploy รอบถัดไป',
      );
    }
    return handleApiError(res, e, 'lumos-call-batches', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'lumos-dispatch');

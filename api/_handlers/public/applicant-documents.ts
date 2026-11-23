/**
 * /api/public/applicant-documents — หน้าส่งเอกสารของผู้สมัคร (ไม่ต้องมีบัญชี Jarvis · เจ้าของ 22 พ.ย. 2569)
 *
 * GET  ?action=config                         → เปิดใช้อยู่ไหม + LIFF ID (ยังไม่ต้องมีสิทธิ์)
 * POST { action:'session', invitation, idToken } → ตรวจลิงก์ + ให้ LINE ยืนยันบัญชี → ผูกบัญชีกับลิงก์ จดการเปิด ออกคุกกี้ของรอบนี้
 * ต่อจากนี้ทุกคำขอใช้คุกกี้ (HttpOnly) + k = คีย์ของลิงก์ที่เปิดอยู่:
 * GET  ?action=state&k=                       → สถานะปัจจุบัน (ฉบับร่างที่แนบไว้ · ส่งแล้วหรือยัง)
 * POST { action:'upload', k, kind, dataBase64 } → แนบภาพ (ฉบับร่าง) kind = id | license | house
 * GET  ?action=file&k=&id=                    → ภาพของลิงก์ตัวเอง
 * POST { action:'ocr', k, id }                → อ่านบัตร/ใบขับขี่ที่แนบไว้ด้วยโมเดลบนเซิร์ฟเวอร์ Ollama ของบริษัท (23 พ.ย. 2569)
 *                                               ยังไม่ตั้งโมเดล/อ่านไม่ได้ = 503 ocr_unavailable → หน้าผู้สมัครใช้ตัวอ่านในมือถือแทน
 * GET  ?action=template&k=&doc=&page=         → ต้นฉบับเอกสารของบริษัท (อ่านก่อนตอบ)
 * POST { action:'submit', k, …ชุดเอกสาร }      → ส่งชุด (ธุรกรรมเดียว · กดซ้ำได้ชุดเดิม)
 * GET  ?action=receipt&k=                     → ใบรับของชุดที่ส่งแล้ว
 * GET  ?action=pdf&k=&doc=                    → PDF ของเอกสารในชุดตัวเอง
 *
 * 🔴 ไม่ส่งข้อความ LINE ไม่ใช้ Messaging API · ไม่พิมพ์รหัสลิงก์/ID token/คุกกี้ ลง log · ทุกคำตอบ no-store
 */
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { readJsonBody } from '../../_lib/body.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { getCorsAllowedOrigins } from '../../_lib/cors.js';
import { auditFromAnonymous } from '../../_lib/audit.js';
import { dbQuery } from '../../_lib/postgres.js';
import { DocError, DocumentKeyError, T, decryptText, getDocumentSettings, isLineMockAllowed } from '../../_lib/documents/core.js';
import {
  applicantFile,
  applicantReceipt,
  applicantStateOf,
  loadApplicantContext,
  openInvitation,
  saveDraftUpload,
  submitPacket,
  type StoredPayload,
} from '../../_lib/documents/applicant.js';
import { getActiveTemplatePage } from '../../_lib/documents/templates.js';
import { packetPdf } from '../../_lib/documents/pdf.js';
import { ServerOcrUnavailable, serverOcr, warmOcrModel } from '../../_lib/documents/serverOcr.js';
import { isDocId } from '../../../src/lib/documents/documentTypes.js';
import { UPLOAD_MAX_BYTES } from '../../../src/lib/documents/uploadValidation.js';

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const str = (v: unknown): string | null => (typeof one(v) === 'string' ? (one(v) as string) : null);
const TEN_MIN = 10 * 60 * 1000;

function secure(res: ApiRes): void {
  res.setHeader?.('Cache-Control', 'no-store, private');
  res.setHeader?.('X-Content-Type-Options', 'nosniff');
  res.setHeader?.('Referrer-Policy', 'no-referrer');
}

/** คำสั่งที่เปลี่ยนข้อมูลต้องมาจากหน้าเว็บของเราเอง (Origin = โฮสต์เดียวกัน) */
function sameOrigin(req: ApiReq): boolean {
  const o = req.headers?.origin;
  const origin = (Array.isArray(o) ? o[0] : o)?.trim();
  if (!origin) return false;
  const h = req.headers?.host;
  const host = (Array.isArray(h) ? h[0] : h)?.trim();
  if (host && (origin === `https://${host}` || origin === `http://${host}`)) return true;
  return getCorsAllowedOrigins().has(origin);
}

function sendBytes(res: ApiRes, bytes: Buffer, mime: string, filename: string, download = false): void {
  secure(res);
  res.setHeader?.('Content-Type', mime);
  res.setHeader?.('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`);
  res.status(200).end?.(bytes);
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  secure(res);
  try {
    if (method === 'GET') {
      const action = str(req.query?.action);
      if (action === 'config') {
        if (!rateLimitOrReject(req, res, 'public-docs-config', 240, TEN_MIN)) return;
        const s = await getDocumentSettings();
        return res.status(200).json({ enabled: s.enabled, liffId: s.liffId, mock: isLineMockAllowed(), serverOcr: s.ocrModel !== '' });
      }
      if (!rateLimitOrReject(req, res, 'public-docs-get', 900, TEN_MIN)) return;
      const ctx = await loadApplicantContext(req, str(req.query?.k));
      if (action === 'state') {
        const st = await applicantStateOf(ctx);
        if (!st.submitted) void getDocumentSettings().then((s) => warmOcrModel(s.ocrModel)).catch(() => undefined);
        return res.status(200).json(st);
      }
      if (action === 'file') {
        const f = await applicantFile(ctx, str(req.query?.id));
        return sendBytes(res, f.bytes, f.mime, `${f.kind.replace(':', '-')}.${EXT[f.mime] ?? 'bin'}`);
      }
      if (action === 'template') {
        const doc = str(req.query?.doc);
        const page = Number(one(req.query?.page));
        const t = isDocId(doc) && Number.isInteger(page) && page >= 1 ? await getActiveTemplatePage(doc, page) : null;
        if (!t) return sendError(res, 404, 'not_found', 'ไม่พบหน้าเอกสารนี้');
        return sendBytes(res, t.bytes, t.mime, `${doc}-${page}.${EXT[t.mime] ?? 'bin'}`);
      }
      if (action === 'receipt') {
        const r = await applicantReceipt(ctx);
        if (!r) return sendError(res, 404, 'not_found', 'ยังไม่ได้ส่งเอกสาร');
        return res.status(200).json(r);
      }
      if (action === 'pdf') {
        const { rows } = await dbQuery<{
          id: string; invitation_id: string; application_id: string; line_user_id: string; submitted_at: Date; form_version: string;
          payload_hash: string; payload_enc: string; payload_key_id: string; template_versions: Record<string, { id: string; version: number; sha256: string }>;
        }>(`select * from ${T.packets} where invitation_id = $1 and line_user_id = $2 and erased_at is null`, [ctx.invitation.id, ctx.lineUserId]);
        if (!rows[0]) return sendError(res, 404, 'not_found', 'ยังไม่ได้ส่งเอกสาร');
        const payload = JSON.parse(decryptText(rows[0].payload_enc, rows[0].payload_key_id)) as StoredPayload;
        const pdf = await packetPdf(rows[0], payload, ctx.invitation.job_label, str(req.query?.doc));
        return sendBytes(res, pdf.bytes, 'application/pdf', pdf.filename, true);
      }
      return sendError(res, 404, 'not_found', 'ไม่พบรายการนี้');
    }

    if (method !== 'POST') return sendError(res, 405, 'Method not allowed');
    if (!sameOrigin(req)) return sendError(res, 403, 'invalid_origin', 'เปิดจากลิงก์ส่งเอกสารเท่านั้น');
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;

    if (body.action === 'session') {
      if (!rateLimitOrReject(req, res, 'public-docs-session', 40, TEN_MIN)) return;
      const opened = await openInvitation(body.invitation, body.idToken);
      res.setHeader?.('Set-Cookie', opened.cookie);
      // เปิดโมเดลอ่านบัตรรอไว้ (ไม่รอผล) — ถึงตอนถ่ายบัตรไม่ต้องรอเปิดโมเดล
      if (!opened.state.submitted) void getDocumentSettings().then((s) => warmOcrModel(s.ocrModel)).catch(() => undefined);
      return res.status(200).json(opened.state);
    }

    const k = typeof body.k === 'string' ? body.k : null;
    if (body.action === 'upload') {
      if (!rateLimitOrReject(req, res, 'public-docs-upload', 90, TEN_MIN)) return;
      const ctx = await loadApplicantContext(req, k);
      const b64 = body.dataBase64;
      // ตรวจความยาวก่อนถอด — ไม่ถอดไฟล์ที่ใหญ่เกินเพดานเข้าแรม
      if (typeof b64 !== 'string' || !b64) return sendError(res, 400, 'invalid_image', 'เลือกภาพที่จะแนบ');
      if (b64.length > Math.ceil((UPLOAD_MAX_BYTES * 4) / 3) + 8) return sendError(res, 413, 'invalid_image', 'ภาพใหญ่เกินไป ถ่ายใหม่หรือลดขนาดแล้วแนบอีกครั้ง');
      if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return sendError(res, 400, 'invalid_image', 'ไฟล์เสีย ถ่ายใหม่แล้วแนบอีกครั้ง');
      const saved = await saveDraftUpload(ctx, body.kind, Buffer.from(b64, 'base64'));
      return res.status(201).json(saved);
    }
    if (body.action === 'ocr') {
      if (!rateLimitOrReject(req, res, 'public-docs-ocr', 30, TEN_MIN)) return;
      const ctx = await loadApplicantContext(req, k);
      const { ocrModel } = await getDocumentSettings();
      if (!ocrModel) return sendError(res, 503, 'ocr_unavailable', 'ยังไม่ได้ตั้งโมเดลอ่านบัตร');
      const f = await applicantFile(ctx, body.id);
      if (f.kind !== 'id' && f.kind !== 'license') return sendError(res, 400, 'bad_request', 'อ่านได้เฉพาะบัตรประชาชนกับใบขับขี่');
      try {
        return res.status(200).json(await serverOcr(ocrModel, f.bytes, f.kind));
      } catch (e) {
        if (e instanceof ServerOcrUnavailable) return sendError(res, 503, 'ocr_unavailable', e.message);
        throw e;
      }
    }
    if (body.action === 'submit') {
      if (!rateLimitOrReject(req, res, 'public-docs-submit', 30, TEN_MIN)) return;
      const ctx = await loadApplicantContext(req, k);
      const result = await submitPacket(ctx, body, req);
      if (!result.already) {
        void auditFromAnonymous(req, { userName: 'ผู้สมัคร (ส่งเอกสารผ่าน LINE)' }, {
          action: 'document_packet.submit',
          entityType: 'job_application',
          entityId: ctx.invitation.application_id,
          after: { packet_id: result.packetId, invitation_id: ctx.invitation.id, job_id: ctx.invitation.job_id, department_code: ctx.invitation.department_code },
        }).catch(() => undefined);
      }
      return res.status(result.already ? 200 : 201).json(result);
    }
    return sendError(res, 404, 'not_found', 'ไม่พบรายการนี้');
  } catch (e) {
    if (e instanceof DocError) return sendError(res, e.status, e.code, e.message);
    if (e instanceof DocumentKeyError) return sendError(res, 503, 'storage_unavailable', 'เปิดเอกสารไม่ได้ในตอนนี้ ติดต่อเจ้าหน้าที่ที่ส่งลิงก์');
    return handleApiError(res, e, 'public-applicant-documents');
  }
}

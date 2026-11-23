/**
 * /api/document-packets — แท็บ "เอกสาร" ของงานสรรหา: รายการ · ชุดที่ผู้สมัครส่ง · ไฟล์ · PDF (เจ้าของ 22 พ.ย. 2569)
 *
 * GET  (ไม่มีรหัส) ?page=&pageSize=&status=&q=&bu=   → รายการผู้สมัครที่มีลิงก์ส่งเอกสาร (1 แถวต่อคน) + จำนวนต่อสถานะ
 * GET  ?applicationId=[&packetId=]                 → รายละเอียด: ลิงก์ทุกอัน บัญชี LINE ที่เปิด ชุดที่ส่ง (ระบุ packetId = เปิดชุดนั้น)
 * GET  ?file=<รหัสไฟล์>                             → ภาพในชุดที่ส่งแล้ว
 * GET  ?pdf=<เอกสาร>&packetId=[&download=1]         → PDF ของเอกสารฉบับนั้นจากชุดนั้น
 * GET  ?template=<เอกสาร>&page=&packetId=           → ต้นฉบับรุ่นที่ผู้สมัครอ่าน
 * POST { action:'flag', packetId, note } / 'unflag' → ติดธงขอให้แก้ / เอาออก
 * POST { action:'ack', packetId, note }             → รับทราบเรื่องที่ต้องดู (คุยกับผู้สมัครแล้ว)
 * POST { action:'import', packetId, department, idempotencyKey }      → นำเข้า iRecruit ผ่านตัวต่อ (เมื่อเชื่อมแล้ว)
 * POST { action:'import-record', packetId, department, externalId }  → HR คีย์ใน iRecruit เอง แล้วบันทึกเลขที่
 * POST { action:'import-resolve', attemptId, externalId? | notFound } → รอบที่ไม่รู้ผล: บอกผลหลังตรวจ
 *
 * สิทธิ์ BU เดียวกับใบสมัคร ตรวจทุกคำขอรวมไฟล์และ PDF · ส่งเอกสารไม่ทำให้นำเข้าเอง ต้อง HR กด · อ่านแจ้งเตือน ≠ ตรวจเอกสารแล้ว
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { DocError, DocumentKeyError, documentReadiness, staffDisplayName } from '../_lib/documents/core.js';
import {
  acknowledgeAttention,
  getDocumentDetail,
  irecruitExportConfigured,
  listDocuments,
  packetForPdf,
  recordManualImport,
  requestImport,
  resolveUnknownImport,
  scopedPacket,
  setReviewFlag,
  staffFile,
} from '../_lib/documents/staff.js';
import { packetPdf } from '../_lib/documents/pdf.js';
import { getTemplatePage } from '../_lib/documents/templates.js';
import { isDocId } from '../../src/lib/documents/documentTypes.js';

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const str = (v: unknown): string | null => (typeof one(v) === 'string' ? (one(v) as string) : null);
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

function sendBytes(res: ApiRes, bytes: Buffer, mime: string, filename: string, download: boolean): void {
  res.setHeader?.('Cache-Control', 'no-store, private');
  res.setHeader?.('X-Content-Type-Options', 'nosniff');
  res.setHeader?.('Referrer-Policy', 'no-referrer');
  res.setHeader?.('Content-Type', mime);
  res.setHeader?.('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`);
  res.status(200).end?.(bytes);
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  res.setHeader?.('Cache-Control', 'no-store');
  try {
    if (method === 'GET') {
      const q = req.query ?? {};
      const download = str(q.download) === '1';
      if (str(q.file)) {
        const f = await staffFile(req.user, str(q.file));
        return sendBytes(res, f.bytes, f.mime, `${f.kind.replace(':', '-')}.${EXT[f.mime] ?? 'bin'}`, download);
      }
      if (str(q.pdf)) {
        const p = await packetForPdf(req.user, str(q.packetId));
        const pdf = await packetPdf(p.row as never, p.payload, p.jobLabel, str(q.pdf));
        res.setHeader?.('X-Document-Sha256', pdf.sha256);
        return sendBytes(res, pdf.bytes, 'application/pdf', pdf.filename, download);
      }
      if (str(q.template)) {
        const doc = str(q.template);
        const page = Number(one(q.page));
        const row = await scopedPacket(req.user, str(q.packetId));
        const tv = isDocId(doc) ? (row.template_versions as unknown as Record<string, { id: string }>)[doc] : undefined;
        const t = tv && Number.isInteger(page) && page >= 1 ? await getTemplatePage(tv.id, page) : null;
        if (!t) return sendError(res, 404, 'not_found', 'ไม่พบหน้าเอกสารนี้');
        return sendBytes(res, t.bytes, t.mime, `${doc}-${page}.${EXT[t.mime] ?? 'bin'}`, false);
      }
      if (str(q.applicationId)) {
        return res.status(200).json(await getDocumentDetail(req.user, str(q.applicationId), str(q.packetId) ?? undefined));
      }
      const [feature, list] = await Promise.all([documentReadiness(), listDocuments(req.user, q)]);
      return res.status(200).json({ feature: { enabled: feature.enabled, ready: feature.ready, problem: feature.problems[0] ?? null }, irecruitConnected: irecruitExportConfigured(), ...list });
    }

    if (method !== 'POST') return sendError(res, 405, 'Method not allowed');
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    const actor = { id: req.user.sub, name: await staffDisplayName(req.user.sub, req.user.email) };
    const audit = (action: string, entityId: string, after: Record<string, unknown>, entityType = 'job_application') =>
      auditFromAuthed(req, { action, entityType, entityId, after });

    switch (body.action) {
      case 'flag':
      case 'unflag': {
        const r = await setReviewFlag(req.user, actor, body.packetId, body.action === 'flag', body.note);
        await audit(`document_packet.${body.action}`, r.applicationId, { packet_id: body.packetId });
        return res.status(200).json({ ok: true });
      }
      case 'ack': {
        const r = await acknowledgeAttention(req.user, actor, body.packetId, body.note);
        await audit('document_packet.attention_ack', r.applicationId, { packet_id: body.packetId });
        return res.status(200).json({ ok: true });
      }
      case 'import': {
        const attempt = await requestImport(req.user, actor, { packetId: body.packetId, department: body.department, idempotencyKey: body.idempotencyKey });
        await audit('document_packet.import', String(body.packetId), { attempt_id: attempt.id, status: attempt.status, department: attempt.department, external_id: attempt.externalId }, 'document_packet');
        return res.status(200).json(attempt);
      }
      case 'import-record': {
        const attempt = await recordManualImport(req.user, actor, { packetId: body.packetId, department: body.department, externalId: body.externalId });
        await audit('document_packet.import_record', String(body.packetId), { attempt_id: attempt.id, department: attempt.department, external_id: attempt.externalId }, 'document_packet');
        return res.status(200).json(attempt);
      }
      case 'import-resolve': {
        const attempt = await resolveUnknownImport(req.user, actor, { attemptId: body.attemptId, externalId: body.externalId, notFound: body.notFound });
        await audit('document_packet.import_resolve', String(body.attemptId), { status: attempt.status, external_id: attempt.externalId }, 'document_import_attempt');
        return res.status(200).json(attempt);
      }
      default:
        return sendError(res, 400, 'bad_request', 'ไม่รู้จักคำสั่งนี้');
    }
  } catch (e) {
    if (e instanceof DocError) return sendError(res, e.status, e.code, e.message);
    if (e instanceof DocumentKeyError) return sendError(res, 503, 'storage_unavailable', 'เปิดเอกสารไม่ได้: กุญแจของเซิร์ฟเวอร์ไม่ตรงกับตอนบันทึก');
    return handleApiError(res, e, 'document-packets', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'job-applications');

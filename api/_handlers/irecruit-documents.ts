/**
 * ═══ iRecruit → Jarvis: ดึงเอกสารที่ผู้สมัครส่งผ่าน LINE (เจ้าของ 23 พ.ย. 2569 "irecruit จะเรียกโหลดรูป") ═══
 *
 * /api/integrations/irecruit/applicant-documents · ยืนยันตัว: header `x-api-key` (key ชื่อ `irecruit` ตัวเดียวกับผลแบบทดสอบ
 * · ออก/ยกเลิกได้ที่ ตั้งค่า › เชื่อมระบบภายนอก)
 *
 * GET  ?national_id=1234567890123                         → ชุดเอกสารล่าสุดของเลขบัตรนี้ (ข้อมูล · ที่อยู่ · คำตอบเอกสาร · รายการรูป/PDF)
 * GET  ?national_id=…&file=<file_id>                      → รูป (image/jpeg · image/png)
 * GET  ?national_id=…&pdf=<doc>&packet_id=<packet_id>     → PDF ของเอกสารฉบับนั้น
 * POST { national_id, packet_id, irecruit_applicant_no, department? } → บันทึกว่านำเข้า iRecruit แล้ว (ชุดขึ้น "นำเข้าแล้ว")
 *
 * ไม่พบเลขบัตร = 404 · ดึงได้เฉพาะคนที่ iRecruit มีเลขบัตร (ไม่มีเส้นไล่รายการทุกคน) · ห้าม cache
 * เอกสารสำหรับทีม iRecruit: docs/irecruit-documents-api.md
 */
import { sendError, type ApiReq, type ApiRes } from '../_lib/http.js';
import { logError, logInfo } from '../_lib/logger.js';
import { withIntegrationKey } from '../_lib/integrationKeyAuth.js';
import { getAppPublicUrl } from '../_lib/postmark.js';
import { DocError } from '../_lib/documents/core.js';
import { irecruitFile, irecruitMarkImported, irecruitPacketView, irecruitPdf } from '../_lib/documents/irecruitPull.js';
import { IRECRUIT_KEY_NAME } from './irecruit-integration.js';

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

function sendBytes(res: ApiRes, bytes: Buffer, mime: string, filename: string, download: boolean): void {
  res.setHeader?.('Cache-Control', 'no-store, private');
  res.setHeader?.('X-Content-Type-Options', 'nosniff');
  res.setHeader?.('Content-Type', mime);
  res.setHeader?.('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`);
  res.status(200).end?.(bytes);
}
export const IRECRUIT_DOCUMENTS_PATH = '/api/integrations/irecruit/applicant-documents';

async function handler(req: ApiReq, res: ApiRes) {
  res.setHeader?.('Cache-Control', 'no-store');
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      const q = (req.query ?? {}) as Record<string, unknown>;
      const nationalId = one(q.national_id);
      const file = one(q.file);
      const pdf = one(q.pdf);
      if (file !== undefined) {
        const f = await irecruitFile(nationalId, file);
        logInfo('irecruit.documents.file', {});
        return sendBytes(res, f.bytes, f.mime, `${String(file).slice(0, 8)}.${f.mime === 'image/png' ? 'png' : 'jpg'}`, false);
      }
      if (pdf !== undefined) {
        const p = await irecruitPdf(nationalId, one(q.packet_id), pdf);
        logInfo('irecruit.documents.pdf', {});
        return sendBytes(res, p.bytes, 'application/pdf', p.filename, true);
      }
      const base = `${getAppPublicUrl() || ''}${IRECRUIT_DOCUMENTS_PATH}`;
      const view = await irecruitPacketView(nationalId, base);
      logInfo('irecruit.documents.packet', { packetId: view.packet_id });
      return res.status(200).json(view);
    }
    if (method === 'POST') {
      const done = await irecruitMarkImported(req.body);
      logInfo('irecruit.documents.imported', { packetId: done.packet_id, already: done.already });
      return res.status(200).json(done);
    }
    res.setHeader?.('Allow', 'GET, POST');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    if (e instanceof DocError) {
      if (e.status === 404 && method === 'GET' && one((req.query ?? {}).file) === undefined && one((req.query ?? {}).pdf) === undefined) {
        return res.status(404).json({ found: false, message: e.message });
      }
      return sendError(res, e.status, e.code, e.message);
    }
    logError('irecruit.documents', e);
    return sendError(res, 500, 'Internal error', 'ดึงเอกสารไม่สำเร็จ');
  }
}

export const irecruitDocumentsHandler = withIntegrationKey(IRECRUIT_KEY_NAME, handler);
export default irecruitDocumentsHandler;

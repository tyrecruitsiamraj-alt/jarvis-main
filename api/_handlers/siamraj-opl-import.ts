import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { runOplExcelImport } from '../_lib/oplExcelImport.js';

const MAX_BASE64_CHARS = 8 * 1024 * 1024;

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') return sendError(res, 405, 'Method not allowed');

  try {
    const raw = await readJsonBody(req);
    if (typeof raw !== 'object' || raw === null) {
      return sendError(res, 400, 'Bad request', 'Invalid JSON body');
    }
    const body = raw as Record<string, unknown>;
    const fileBase64 = typeof body.file_base64 === 'string' ? body.file_base64.trim() : '';
    const dryRun = body.dry_run === true;

    if (!fileBase64) {
      return sendError(res, 400, 'Bad request', 'file_base64 is required');
    }
    if (fileBase64.length > MAX_BASE64_CHARS) {
      return sendError(res, 400, 'Bad request', 'ไฟล์ใหญ่เกินไป (สูงสุด ~6 MB)');
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBase64, 'base64');
    } catch {
      return sendError(res, 400, 'Bad request', 'file_base64 ไม่ถูกต้อง');
    }
    if (buffer.length < 64) {
      return sendError(res, 400, 'Bad request', 'ไฟล์ว่างหรือเสียหาย');
    }

    const result = await runOplExcelImport(buffer, {
      dryRun,
      userId: req.user.sub,
    });

    if (!dryRun) {
      await auditFromAuthed(req, {
        action: 'siamraj_opl_import.run',
        entityType: 'siamraj_opl_import',
        entityId: 'bulk',
        after: {
          assignedCount: result.assignedCount,
          inserted: result.inserted,
          updated: result.updated,
          excelSiteCount: result.excelSiteCount,
        },
      });
    }

    return res.status(200).json(result);
  } catch (e) {
    return handleApiError(res, e, 'siamraj-opl-import POST', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'siamraj-opl-import');

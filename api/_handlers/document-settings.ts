/**
 * /api/document-settings — ตั้งค่า › ส่งเอกสารผ่าน LINE (เจ้าของ 22 พ.ย. 2569)
 *
 * GET                                              → ทุกคน: เปิดใช้ไหม · พร้อมไหม · มีงานเอกสารในสิทธิ์ไหม / admin: + LINE · ต้นฉบับ 5 ประเภท · คิวแจ้งเตือนที่ค้าง
 * GET  ?template=<เอกสาร>&page=                    → admin: ดูต้นฉบับรุ่นที่ใช้อยู่
 * PUT  { enabled?, lineChannelId?, liffId? }       → admin: เปิด/ปิด · ตั้ง LINE Login Channel ID กับ LIFF ID (ไม่ใช่ความลับ ไม่มี token)
 * POST { action:'template', docType, pages:[base64…] } → admin: อัปโหลดต้นฉบับรุ่นใหม่ของเอกสาร 1 ประเภท (ทุกหน้าเรียงตามลำดับ · PNG/JPG)
 *
 * เปิดใช้ได้เมื่อครบ: LINE · ต้นฉบับ 5 ประเภท · ฐานข้อมูลอัปเดตแล้ว · ปิด = หยุดสร้างลิงก์ใหม่/ผู้สมัครเปิดลิงก์ไม่ได้ ของที่ส่งแล้วยังดูได้
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  DocError,
  LIFF_ID_RE,
  LINE_CHANNEL_RE,
  documentReadiness,
  getDocumentSettings,
  listActiveTemplates,
  saveDocumentSettings,
  staffDisplayName,
  type DocumentSettings,
} from '../_lib/documents/core.js';
import { TEMPLATE_MAX_PAGES, checkTemplatePage, getActiveTemplatePage, saveTemplateVersion } from '../_lib/documents/templates.js';
import { hasDocumentHistory, irecruitExportConfigured } from '../_lib/documents/staff.js';
import { outboxBacklog } from '../_lib/documents/outbox.js';
import { DOC_TYPES, isDocId } from '../../src/lib/documents/documentTypes.js';

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const isAdmin = req.user.role === 'admin';
  res.setHeader?.('Cache-Control', 'no-store');
  try {
    if (method === 'GET') {
      const doc = one(req.query?.template);
      if (typeof doc === 'string') {
        if (!isAdmin) return sendError(res, 403, 'Forbidden', 'เฉพาะผู้ดูแลระบบ');
        const page = Number(one(req.query?.page));
        const t = isDocId(doc) && Number.isInteger(page) && page >= 1 ? await getActiveTemplatePage(doc, page) : null;
        if (!t) return sendError(res, 404, 'not_found', 'ไม่พบหน้าเอกสารนี้');
        res.setHeader?.('Content-Type', t.mime);
        res.setHeader?.('X-Content-Type-Options', 'nosniff');
        return res.status(200).end?.(t.bytes);
      }
      const readiness = await documentReadiness();
      const base = { enabled: readiness.enabled, ready: readiness.ready, hasHistory: await hasDocumentHistory(req.user).catch(() => false) };
      if (!isAdmin) return res.status(200).json(base);
      const [settings, templates, backlog] = await Promise.all([getDocumentSettings(), listActiveTemplates().catch(() => []), outboxBacklog()]);
      return res.status(200).json({
        ...base,
        problems: readiness.problems,
        mock: readiness.mock,
        lineChannelId: settings.lineChannelId,
        liffId: settings.liffId,
        irecruitConnected: irecruitExportConfigured(),
        outbox: backlog,
        templates: DOC_TYPES.map((d) => {
          const t = templates.find((x) => x.docType === d.id);
          return { docType: d.id, title: d.title, version: t?.version ?? null, pages: t?.pageCount ?? 0, updatedAt: t?.createdAt ?? null, updatedByName: t?.createdByName ?? null };
        }),
      });
    }

    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    const actor = { id: req.user.sub, name: await staffDisplayName(req.user.sub, req.user.email) };

    if (method === 'PUT') {
      const patch: Partial<DocumentSettings> = {};
      if (typeof body.lineChannelId === 'string') {
        const v = body.lineChannelId.trim();
        if (v && !LINE_CHANNEL_RE.test(v)) return sendError(res, 400, 'bad_request', 'LINE Login Channel ID เป็นตัวเลขล้วน');
        patch.lineChannelId = v;
      }
      if (typeof body.liffId === 'string') {
        const v = body.liffId.trim();
        if (v && !LIFF_ID_RE.test(v)) return sendError(res, 400, 'bad_request', 'LIFF ID หน้าตาแบบ 1234567890-AbCdEfGh');
        patch.liffId = v;
      }
      if (Object.keys(patch).length) await saveDocumentSettings(patch, actor);
      if (typeof body.enabled === 'boolean') {
        if (body.enabled) {
          // ตรวจก่อนเปิด — ไม่มีลิงก์ที่สร้างได้แต่ผู้สมัครส่งไม่ได้
          const r = await documentReadiness();
          if (r.problems.length) return sendError(res, 409, 'not_ready', `ยังเปิดใช้ไม่ได้: ${r.problems[0]}`);
        }
        await saveDocumentSettings({ enabled: body.enabled }, actor);
      }
      const saved = await getDocumentSettings();
      await auditFromAuthed(req, { action: 'document_settings.update', entityType: 'document_settings', entityId: 'main', after: saved });
      return res.status(200).json({ ok: true, ...saved });
    }

    if (method === 'POST' && body.action === 'template') {
      const pages = Array.isArray(body.pages) ? body.pages : [];
      if (pages.length < 1 || pages.length > TEMPLATE_MAX_PAGES) return sendError(res, 400, 'bad_request', `เลือกไฟล์ 1–${TEMPLATE_MAX_PAGES} หน้า`);
      const checked = pages.map((p) => {
        if (typeof p !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(p) || p.length > 4_200_000) throw new DocError(400, 'invalid_image', 'ไฟล์หน้าเอกสารใหญ่เกิน 3 MB หรือเสีย');
        return checkTemplatePage(Buffer.from(p, 'base64'));
      });
      const saved = await saveTemplateVersion(String(body.docType ?? ''), checked, actor);
      await auditFromAuthed(req, { action: 'document_template.upload', entityType: 'document_template', entityId: saved.id, after: { doc_type: body.docType, version: saved.version, pages: saved.pageCount, sha256: saved.sha256 } });
      return res.status(201).json(saved);
    }
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    if (e instanceof DocError) return sendError(res, e.status, e.code, e.message);
    return handleApiError(res, e, 'document-settings', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'document-settings');

/**
 * /api/document-invitations — ปุ่ม "ส่งเอกสาร" ในข้อมูลผู้สมัคร (เจ้าของ 22 พ.ย. 2569)
 *
 * GET  ?applicationId=                        → สถานะเอกสารของใบสมัครนี้ + ลิงก์ที่เคยสร้าง + บัญชี LINE ที่เปิดแต่ละลิงก์
 * POST { applicationId }                      → สร้างลิงก์เฉพาะใบสมัครนี้ (อายุ 24 ชม.) คืนลิงก์ให้เจ้าหน้าที่คัดลอกไปส่ง LINE เอง
 * POST { action:'revoke', invitationId }      → ยกเลิกลิงก์ที่ยังไม่ได้ส่งเอกสาร
 *
 * ระบบไม่ส่งข้อความ LINE ให้ · ลิงก์เต็มคืนครั้งเดียวตอนสร้าง (ฐานเก็บแค่แฮช) · สิทธิ์ BU เดียวกับใบสมัคร
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { DocError, documentReadiness, staffDisplayName } from '../_lib/documents/core.js';
import { applicationDocumentState, createInvitation, revokeInvitation } from '../_lib/documents/staff.js';

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

/** ต้นทางของหน้าเว็บ — ใช้ต่อลิงก์ตรง (เครื่องทดสอบ) · ของจริงใช้ลิงก์ LIFF */
export function publicOrigin(req: AuthedReq): string {
  const fixed = (process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (fixed) return fixed;
  const o = req.headers?.origin;
  const origin = (Array.isArray(o) ? o[0] : o)?.trim();
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  const h = req.headers?.host;
  return `https://${(Array.isArray(h) ? h[0] : h) ?? ''}`;
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  res.setHeader?.('Cache-Control', 'no-store');
  try {
    if (method === 'GET') {
      const [feature, state] = await Promise.all([documentReadiness(), applicationDocumentState(req.user, one(req.query?.applicationId))]);
      return res.status(200).json({ feature: { enabled: feature.enabled, ready: feature.ready, problem: feature.problems[0] ?? null }, ...state });
    }
    if (method !== 'POST') return sendError(res, 405, 'Method not allowed');
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    const actor = { id: req.user.sub, name: await staffDisplayName(req.user.sub, req.user.email) };

    if (body.action === 'revoke') {
      const r = await revokeInvitation(req.user, actor, body.invitationId);
      await auditFromAuthed(req, { action: 'document_invitation.revoke', entityType: 'job_application', entityId: r.applicationId, after: { invitation_id: body.invitationId } });
      return res.status(200).json({ ok: true });
    }
    const created = await createInvitation(req.user, actor, body.applicationId, publicOrigin(req));
    // audit ไม่มีลิงก์เต็ม — จดแค่รหัสแถว
    await auditFromAuthed(req, {
      action: 'document_invitation.create',
      entityType: 'job_application',
      entityId: String(body.applicationId),
      after: { invitation_id: created.invitationId, revision: created.revision, expires_at: created.expiresAt },
    });
    return res.status(201).json(created);
  } catch (e) {
    if (e instanceof DocError) return sendError(res, e.status, e.code, e.message);
    return handleApiError(res, e, 'document-invitations', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'job-applications');

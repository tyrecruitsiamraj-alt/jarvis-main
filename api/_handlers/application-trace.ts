/**
 * `GET /api/application-trace?id=<ใบสมัคร>` — คนนี้ไปถึงไหนนอกระบบเรา (เจ้าของ 20 ต.ค. 2569 "ผูกคนที่ผ่านกับ iRecruit และ ERP")
 * จับด้วยเบอร์ 9 ตัวท้าย ตั้งแต่วันกรอกใบ: เป็นผู้สมัครใน iRecruit วันไหน · แจ้งเข้า ERP วันไหน + ช่องทางของลิงก์ที่กรอกผ่าน
 * อ่านอย่างเดียว · อ่านแหล่งไหนไม่ได้ = ช่องนั้น `unknown: true` (ห้ามบอกว่า "ไม่เจอ")
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { loadInformDaysByPhone, loadIrecruitApplicantDays } from '../_lib/applicantSourceSql.js';
import { firstDaySince, phone9Of } from '../../src/lib/applicantSourceMatch.js';

const APPS = tableInAppSchema('public_job_applications');
const LINKS = tableInAppSchema('recruit_posting_links');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') return sendError(res, 405, 'Method not allowed');
  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุใบสมัคร');
  try {
    const { rows } = await dbQuery<{ phone: string | null; created_at: Date | string; link_channel: string | null }>(
      `select coalesce(a.phone_e164, a.phone) as phone, a.created_at,
              (select nullif(btrim(l.channel_label), '') from ${LINKS} l where l.id = a.link_id) as link_channel
         from ${APPS} a where a.id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) return sendError(res, 404, 'Not found', 'ไม่พบใบสมัคร');
    const createdAt = new Date(row.created_at).toISOString();
    const from = createdAt.slice(0, 10) < '2025-01-01' ? createdAt.slice(0, 10) : '2025-01-01';
    const [ir, erp] = await Promise.all([
      loadIrecruitApplicantDays(from).catch(() => null),
      loadInformDaysByPhone(from).catch(() => null),
    ]);
    const p9 = phone9Of(row.phone);
    const irecruitAt = firstDaySince(ir, p9, createdAt);
    const informedAt = firstDaySince(erp, p9, createdAt);
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      irecruit: { unknown: irecruitAt === undefined, at: irecruitAt ?? null },
      inform: { unknown: informedAt === undefined, at: informedAt ?? null },
      linkChannel: row.link_channel,
    });
  } catch (e) {
    return handleApiError(res, e, 'application-trace', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');

/**
 * ═══ GET/POST/DELETE /api/integration-keys — key ของระบบภายนอก (หน้า ตั้งค่า › เชื่อมระบบภายนอก) ═══
 * เจ้าของ 22 ต.ค. 2569 "ทุกอย่างต้องทำผ่าน UI ได้นะ" — เดิมออก key ได้ทางสคริปต์อย่างเดียว
 * - GET: สถานะ key + ยอดคอมเมนต์ที่ So Scraping ส่งมา
 * - POST {name}: ออก key ใหม่ (ตัวเก่าใช้ไม่ได้ทันที) — ตอบ key จริงครั้งเดียว เก็บแค่ sha256
 * - DELETE ?name=: ยกเลิก key
 * แอดมินเท่านั้น · จดบันทึกการใช้งานทุกครั้ง (ไม่จดตัว key)
 */
import { randomBytes } from 'node:crypto';
import { withAuth, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { clearIntegrationKeyCache, sha256Hex } from '../_lib/integrationKeyAuth.js';
import { INTEGRATIONS, isIntegrationName } from '../../src/lib/integrationKeys.js';

const KEYS = tableInAppSchema('app_integration_keys');
const LEADS = tableInAppSchema('so_scraping_comment_leads');

export function newIntegrationKey(name: string): string {
  return `jv_${name.replace(/-/g, '')}_${randomBytes(24).toString('hex')}`;
}

async function handler(req: AuthedReq, res: ApiRes) {
  if (req.user.role !== 'admin') return sendError(res, 403, 'Forbidden', 'เฉพาะแอดมิน');
  const m = (req.method || 'GET').toUpperCase();
  try {
    if (m === 'GET') {
      const { rows } = await dbQuery<{ name: string; created_at: string; revoked_at: string | null; last_used_at: string | null }>(
        `select name, created_at, revoked_at, last_used_at from ${KEYS}`,
      );
      const { rows: s } = await dbQuery<{ total: number; with_phone: number; applications: number; last_at: string | null }>(
        `select count(*)::int as total, count(*) filter (where phone ~ '^0[0-9]{9}$')::int as with_phone,
                count(application_id)::int as applications, max(created_at) as last_at
           from ${LEADS}`,
      ).catch(() => ({ rows: [] as Array<{ total: number; with_phone: number; applications: number; last_at: string | null }> }));
      return res.status(200).json({
        items: INTEGRATIONS.map((i) => ({ ...i, key: rows.find((r) => r.name === i.name) ?? null })),
        soScraping: s[0] ?? null,
      });
    }
    if (m === 'POST') {
      const body = (await readJsonBody(req)) as { name?: unknown } | null;
      const name = body?.name;
      if (!isIntegrationName(name)) return sendError(res, 400, 'Bad request', 'ไม่รู้จักระบบนี้');
      const key = newIntegrationKey(name);
      await dbQuery(
        `insert into ${KEYS} (name, key_sha256) values ($1, $2)
         on conflict (name) do update set key_sha256 = excluded.key_sha256, created_at = now(), revoked_at = null, last_used_at = null`,
        [name, sha256Hex(key)],
      );
      clearIntegrationKeyCache(name);
      await auditFromAuthed(req, { action: 'integration_key.issue', entityType: 'integration_key', entityId: name });
      return res.status(200).json({ name, key });
    }
    if (m === 'DELETE') {
      const name = typeof req.query?.name === 'string' ? req.query.name : '';
      if (!isIntegrationName(name)) return sendError(res, 400, 'Bad request', 'ไม่รู้จักระบบนี้');
      await dbQuery(`update ${KEYS} set revoked_at = now() where name = $1 and revoked_at is null`, [name]);
      clearIntegrationKeyCache(name);
      await auditFromAuthed(req, { action: 'integration_key.revoke', entityType: 'integration_key', entityId: name });
      return res.status(200).json({ name, revoked: true });
    }
    res.setHeader?.('Allow', 'GET, POST, DELETE');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'integration-keys', { userId: req.user?.sub });
  }
}

export default withAuth(handler);

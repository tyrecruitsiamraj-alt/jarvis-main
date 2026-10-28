/**
 * ═══ GET/POST/DELETE /api/integration-keys — key ของระบบภายนอก (หน้า ตั้งค่า › เชื่อมระบบภายนอก) ═══
 * เจ้าของ 22 ต.ค. 2569 "ทุกอย่างต้องทำผ่าน UI ได้นะ" — เดิมออก key ได้ทางสคริปต์อย่างเดียว
 * - GET: สถานะ key + ยอดคอมเมนต์ที่ So Scraping ส่งมา
 * - POST {name}: ออก key ใหม่ (ตัวเก่าใช้ไม่ได้ทันที) — ตอบ key จริงครั้งเดียว เก็บแค่ sha256
 * - DELETE ?name=: ยกเลิก key
 * แอดมินเท่านั้น · จดบันทึกการใช้งานทุกครั้ง (ไม่จดตัว key)
 *
 * key ขาออก (ที่ So Scraping ออกให้ Jarvis เรียก options API · 26 ต.ค. 2569):
 * - GET คืน `outbound` (มี key ไหม · 4 ตัวท้าย · URL) — ไม่คืนตัว key
 * - PUT {outbound:'so-scraping', key?, base_url, clear?}: บันทึกแบบเข้ารหัส
 * - POST {outbound:'so-scraping', test:true, key?, base_url}: ลองเรียกจริง (ไม่ใส่ key = ใช้ตัวที่บันทึกไว้) ตอบจำนวนที่ได้
 * - PUT {outbound:'line-bot-sowork', key?, base_url, clear?} (28 ต.ค. 2569): secret ร่วมกับ LINE Bot So Work (`lineBotSoWork.ts`)
 */
import { randomBytes } from 'node:crypto';
import { withAuth, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { clearIntegrationKeyCache, sha256Hex } from '../_lib/integrationKeyAuth.js';
import { INTEGRATIONS, isIntegrationName } from '../../src/lib/integrationKeys.js';
import { decryptApiKey } from '../_lib/aiSettingsStore.js';
import {
  callSoOptions,
  getSoKeyView,
  normalizeSoBaseUrl,
  saveSoKey,
  SoOptionsError,
  SO_OPTIONS_KEY_NAME,
} from '../_lib/soScrapingOptions.js';
import { getLineBotKeyView, LINE_BOT_KEY_NAME, saveLineBotKey } from '../_lib/lineBotSoWork.js';

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
        outbound: { [SO_OPTIONS_KEY_NAME]: await getSoKeyView(), [LINE_BOT_KEY_NAME]: await getLineBotKeyView() },
      });
    }
    if (m === 'PUT') {
      const body = (await readJsonBody(req)) as { outbound?: unknown; key?: unknown; base_url?: unknown; clear?: unknown } | null;
      if (body?.outbound === LINE_BOT_KEY_NAME) {
        const baseUrl = normalizeSoBaseUrl(body.base_url);
        if (!baseUrl) return sendError(res, 400, 'Bad request', 'URL ต้องขึ้นต้นด้วย https://');
        const secret = typeof body.key === 'string' && body.key.trim() ? body.key.trim() : null;
        if (secret && secret.length > 500) return sendError(res, 400, 'Bad request', 'secret ยาวเกินไป');
        await saveLineBotKey({ secret, baseUrl, clear: body.clear === true }, req.user.email ?? req.user.sub);
        await auditFromAuthed(req, {
          action: 'outbound_key.save',
          entityType: 'outbound_key',
          entityId: LINE_BOT_KEY_NAME,
          after: { base_url: baseUrl, key_changed: Boolean(secret), cleared: body.clear === true },
        });
        return res.status(200).json({ outbound: { [LINE_BOT_KEY_NAME]: await getLineBotKeyView() } });
      }
      if (body?.outbound !== SO_OPTIONS_KEY_NAME) return sendError(res, 400, 'Bad request', 'ไม่รู้จักระบบนี้');
      const baseUrl = normalizeSoBaseUrl(body.base_url);
      if (!baseUrl) return sendError(res, 400, 'Bad request', 'URL ต้องขึ้นต้นด้วย https://');
      const key = typeof body.key === 'string' && body.key.trim() ? body.key.trim() : null;
      if (key && key.length > 500) return sendError(res, 400, 'Bad request', 'key ยาวเกินไป');
      await saveSoKey({ key, baseUrl, clear: body.clear === true }, req.user.email ?? req.user.sub);
      await auditFromAuthed(req, {
        action: 'outbound_key.save',
        entityType: 'outbound_key',
        entityId: SO_OPTIONS_KEY_NAME,
        after: { base_url: baseUrl, key_changed: Boolean(key), cleared: body.clear === true },
      });
      return res.status(200).json({ outbound: { [SO_OPTIONS_KEY_NAME]: await getSoKeyView() } });
    }
    if (m === 'POST') {
      const body = (await readJsonBody(req)) as { name?: unknown; outbound?: unknown; test?: unknown; key?: unknown; base_url?: unknown } | null;
      if (body?.outbound === SO_OPTIONS_KEY_NAME && body.test === true) {
        const baseUrl = normalizeSoBaseUrl(body.base_url);
        if (!baseUrl) return sendError(res, 400, 'Bad request', 'URL ต้องขึ้นต้นด้วย https://');
        let key = typeof body.key === 'string' && body.key.trim() ? body.key.trim() : null;
        if (!key) {
          const { rows } = await dbQuery<{ key_enc: string | null }>(
            `select key_enc from ${tableInAppSchema('app_outbound_api_keys')} where name = $1`,
            [SO_OPTIONS_KEY_NAME],
          ).catch(() => ({ rows: [] as Array<{ key_enc: string | null }> }));
          key = decryptApiKey(rows[0]?.key_enc ?? null);
        }
        if (!key) return sendError(res, 400, 'Bad request', 'ใส่ key ก่อนกดทดสอบ');
        try {
          const o = await callSoOptions(baseUrl, key);
          return res.status(200).json({
            ok: true,
            accounts: o.accounts.length,
            groups: o.groups.length,
            workers: o.workers.length,
            scrape_accounts: o.scrapeAccounts.length,
          });
        } catch (e) {
          if (e instanceof SoOptionsError) return res.status(200).json({ ok: false, message: e.message });
          throw e;
        }
      }
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
    res.setHeader?.('Allow', 'GET, POST, PUT, DELETE');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'integration-keys', { userId: req.user?.sub });
  }
}

export default withAuth(handler);

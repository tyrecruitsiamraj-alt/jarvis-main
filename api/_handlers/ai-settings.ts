/**
 * เลือก AI ที่ใช้คิดงาน (migration 150 · เจ้าของสั่ง 17 ต.ค. 2569) — admin เท่านั้น (rbac `ai-settings`)
 *
 * GET  /api/ai-settings → การเชื่อมต่อ (ไม่มีตัว key) + งานไหนใช้ตัวไหน + Ollama จากไฟล์ตั้งค่า
 * POST /api/ai-settings { action }
 *   - save_connection   { connection }        เพิ่ม/แก้ (api_key ว่าง = คง key เดิม)
 *   - delete_connection { id }                ลบ (งานที่ใช้อยู่ถอยไป Ollama ของระบบ — FK on delete set null)
 *   - save_routes       { routes: [...] }      งานไหนใช้ตัวไหน
 *   - test              { connection | connection_id, model? }  ยิงคำถามสั้น ๆ วัดเวลา (ไม่บันทึกอะไร)
 *   - models            { connection | connection_id }          รายชื่อโมเดลของเจ้านั้น
 *
 * 🔴 ไม่ส่ง API key กลับหน้าจอทุกกรณี · บันทึกการใช้งานจดแค่ว่า "เปลี่ยน key" ไม่จดตัว key
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { isPgUndefinedTable } from '../_lib/postgres.js';
import {
  deleteAiConnection,
  getAiSettingsView,
  saveAiConnection,
  saveAiRoutes,
  targetForConnection,
  type AiTarget,
} from '../_lib/aiSettingsStore.js';
import { chatWithTarget, listProviderModels } from '../_lib/aiClient.js';
import { parseAiConnectionInput, parseAiRoutesInput } from '../../src/lib/aiSettings.js';

const MIGRATION_PENDING = 'ระบบกำลังอัปเดตฐานข้อมูล ลองใหม่อีกครั้งในอีกสักครู่';

/** เป้าหมายจากที่หน้าจอส่งมา — ร่างที่ยังไม่บันทึกใช้ได้ · ไม่ได้พิมพ์ key ใหม่ = ใช้ key ที่บันทึกไว้ */
async function targetFromBody(b: Record<string, unknown>): Promise<{ target?: AiTarget; error?: string }> {
  const model = typeof b.model === 'string' && b.model.trim() ? b.model.trim() : null;
  if (b.connection && typeof b.connection === 'object') {
    const parsed = parseAiConnectionInput(b.connection);
    if (!parsed.value) return { error: parsed.error };
    const v = parsed.value;
    const saved = v.id ? await targetForConnection(v.id) : null;
    return {
      target: {
        kind: v.kind,
        baseUrl: v.base_url,
        model: model || v.model,
        apiKey: v.clear_key ? null : (v.api_key ?? saved?.apiKey ?? null),
        source: v.name,
      },
    };
  }
  if (typeof b.connection_id === 'string' && b.connection_id) {
    const t = await targetForConnection(b.connection_id, model);
    return t ? { target: t } : { error: 'ไม่พบการเชื่อมต่อนี้' };
  }
  return { error: 'ข้อมูลไม่ถูกต้อง' };
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const by = req.user.email || null;
  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json(await getAiSettingsView());
    }
    if (method !== 'POST') return sendError(res, 405, 'Method not allowed');

    const raw = await readJsonBody(req);
    if (!raw || typeof raw !== 'object') return sendError(res, 400, 'Bad request', 'ข้อมูลไม่ถูกต้อง');
    const b = raw as Record<string, unknown>;

    if (b.action === 'save_connection') {
      const parsed = parseAiConnectionInput(b.connection);
      if (!parsed.value) return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
      const id = await saveAiConnection(parsed.value, by);
      const { api_key: key, ...safe } = parsed.value;
      await auditFromAuthed(req, {
        action: parsed.value.id ? 'ai.connection.update' : 'ai.connection.create',
        entityType: 'ai_connection',
        entityId: id,
        after: { ...safe, api_key_changed: Boolean(key) || parsed.value.clear_key === true },
      });
      return res.status(200).json({ id, settings: await getAiSettingsView() });
    }

    if (b.action === 'delete_connection') {
      const id = typeof b.id === 'string' ? b.id : '';
      if (!id) return sendError(res, 400, 'Bad request', 'ข้อมูลไม่ถูกต้อง');
      const ok = await deleteAiConnection(id);
      if (!ok) return sendError(res, 404, 'Not found', 'ไม่พบการเชื่อมต่อนี้');
      await auditFromAuthed(req, { action: 'ai.connection.delete', entityType: 'ai_connection', entityId: id });
      return res.status(200).json({ settings: await getAiSettingsView() });
    }

    if (b.action === 'save_routes') {
      const parsed = parseAiRoutesInput(b);
      if (!parsed.value) return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
      const before = await getAiSettingsView();
      await saveAiRoutes(parsed.value, by);
      await auditFromAuthed(req, {
        action: 'ai.routes.update',
        entityType: 'ai_task_routes',
        entityId: 'all',
        before: before.routes,
        after: parsed.value,
      });
      return res.status(200).json({ settings: await getAiSettingsView() });
    }

    if (b.action === 'test' || b.action === 'models') {
      const { target, error } = await targetFromBody(b);
      if (!target) return sendError(res, 400, 'Bad request', error || 'ข้อมูลไม่ถูกต้อง');
      if (b.action === 'models') {
        return res.status(200).json({ models: await listProviderModels(target) });
      }
      const started = Date.now();
      try {
        const reply = await chatWithTarget(target, {
          messages: [{ role: 'user', content: 'ตอบคำว่า ok คำเดียว' }],
          timeoutMs: 90_000,
          temperature: 0,
          think: false,
        });
        return res.status(200).json({ ok: true, ms: Date.now() - started, reply: reply.slice(0, 40) });
      } catch (e) {
        return res.status(200).json({ ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : 'ทดสอบไม่สำเร็จ' });
      }
    }

    return sendError(res, 400, 'Bad request', 'ไม่รู้จักคำสั่งนี้');
  } catch (e) {
    if (isPgUndefinedTable(e)) return sendError(res, 503, 'Service unavailable', MIGRATION_PENDING);
    return handleApiError(res, e, 'ai-settings', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'ai-settings');

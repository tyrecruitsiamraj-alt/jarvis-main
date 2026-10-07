/**
 * ═══ /api/irecruit-replace-sync — การดึงส่งคนแทนจาก iRecruit (2 ต.ค. 2569) ═══
 *
 * GET   → สภาพ: เปิดอยู่ไหม · เวลาโทร (3 สาย) · ผลรอบล่าสุด · เหตุผลที่ใช้ iRecruit ไม่ได้ (ถ้ามี)   (staff)
 * POST  → ดึงตอนนี้หนึ่งรอบ (ตัวเดียวกับที่ worker เดินทุก 5 นาที)                                  (supervisor+)
 * PATCH → `{ aiPaused: boolean }` พัก/เปิด AI ของงานส่งคนแทน (เจ้าของสั่ง 6 ต.ค. 2569 ค่ำ "อย่าพึ่งส่งให้ Ai โทร")  (supervisor+)
 *         พัก = เปลี่ยนสาย AI ที่ยังไม่ถึงเวลาเป็นคนโทร + ยกเลิกแผนที่ Lumos ทันที (worker บังคับซ้ำทุก 5 นาที)
 * (PATCH ตั้งกติกาเวลาโทร ถอดแล้ว 5 ต.ค. 2569 — เวลาโทรตายตัวตาม Journey ของเจ้าของ)
 *
 * 🔴 เส้นนี้ไม่สร้างสายเอง — ทุกอย่างผ่าน `runIrecruitReplaceSync` ที่เดียว (กันซ้ำที่ฐาน · ส่ง AI ตามสวิตช์เดิม)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { irecruitUnavailableReason } from '../_lib/irecruitSqlServer.js';
import {
  enforceReplaceAiPaused,
  getReplaceSyncSettings,
  isReplaceSyncRunning,
  runIrecruitReplaceSync,
  saveReplaceSyncSettings,
} from '../_lib/irecruitReplaceSync.js';
import { getLastReplaceSyncInMemory, getReplaceSyncWorkerConfig } from '../_lib/irecruitReplaceSyncWorker.js';
import { normalizeReplaceCallRule, replaceScheduleText } from '../../src/lib/irecruitReplaceSync.js';

async function statusPayload() {
  const cfg = getReplaceSyncWorkerConfig();
  const settings = await getReplaceSyncSettings();
  return {
    enabled: cfg.enabled,
    horizonDays: cfg.horizonDays,
    unavailableReason: irecruitUnavailableReason(),
    tableReady: settings.tableReady,
    running: isReplaceSyncRunning(),
    rule: settings.rule,
    ruleText: replaceScheduleText(settings.rule),
    lastRun: settings.lastRun ?? getLastReplaceSyncInMemory(),
    updatedAt: settings.updatedAt,
    updatedByName: settings.updatedByName,
  };
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      return res.status(200).json(await statusPayload());
    }

    if (method === 'POST') {
      if (isReplaceSyncRunning()) {
        return sendError(res, 409, 'Conflict', 'กำลังดึงอยู่ รอรอบนี้จบก่อน');
      }
      const cfg = getReplaceSyncWorkerConfig();
      const summary = await runIrecruitReplaceSync({
        horizonDays: cfg.horizonDays,
        actorName: `ดึงจาก iRecruit (${req.user.email || req.user.sub})`,
      });
      await auditFromAuthed(req, {
        action: 'irecruit_replace_sync.run',
        entityType: 'irecruit_replace_sync',
        entityId: 'default',
        after: summary,
      });
      return res.status(200).json({ summary, ...(await statusPayload()) });
    }

    if (method === 'PATCH') {
      const raw = await readJsonBody(req);
      const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      const hasPause = typeof body.aiPaused === 'boolean';
      /** เวลาโทร (7 ต.ค. 2569 เจ้าของ "ต้องปรับผ่าน ui") — `confirmTime` "HH:MM" · `leadMinutes` [สาย 2, สาย 3] นาที */
      const hasTiming = body.confirmTime !== undefined || body.leadMinutes !== undefined;
      if (!hasPause && !hasTiming) return sendError(res, 400, 'Bad request', 'ส่ง aiPaused หรือเวลาโทรมาอย่างน้อยหนึ่งอย่าง');
      const settings = await getReplaceSyncSettings();
      if (!settings.tableReady) return sendError(res, 409, 'Conflict', 'ยังไม่มีตารางค่าตั้ง (migration 133)');
      const rule = normalizeReplaceCallRule({
        ...settings.rule,
        ...(hasPause ? { aiPaused: body.aiPaused } : {}),
        ...(body.confirmTime !== undefined ? { confirmTime: body.confirmTime } : {}),
        ...(body.leadMinutes !== undefined ? { leadMinutes: body.leadMinutes } : {}),
      });
      // ค่าที่ส่งมาอ่านไม่ออก = ปฏิเสธ (ห้ามถอยไปค่าเริ่มเงียบ ๆ)
      if (body.confirmTime !== undefined && rule.confirmTime !== body.confirmTime) {
        return sendError(res, 400, 'Bad request', 'เวลาคอนเฟิร์มต้องเป็น HH:MM');
      }
      if (body.leadMinutes !== undefined && JSON.stringify(rule.leadMinutes) !== JSON.stringify(body.leadMinutes)) {
        return sendError(res, 400, 'Bad request', 'สาย 2 ต้องโทรก่อนสาย 3 · 5–600 นาที');
      }
      await saveReplaceSyncSettings({ rule }, req.user.email || req.user.sub);
      const enforced = hasPause && body.aiPaused ? await enforceReplaceAiPaused() : null;
      await auditFromAuthed(req, {
        action: hasTiming ? 'irecruit_replace_sync.timing' : 'irecruit_replace_sync.ai_paused',
        entityType: 'irecruit_replace_sync',
        entityId: 'default',
        before: { rule: settings.rule },
        after: { rule, enforced },
      });
      return res.status(200).json({ enforced, ...(await statusPayload()) });
    }

    return sendError(res, 405, 'Method not allowed', 'GET / POST / PATCH เท่านั้น');
  } catch (e) {
    return handleApiError(res, e, 'irecruit-replace-sync');
  }
}

export default withRbac(handler, 'irecruit-replace-sync');

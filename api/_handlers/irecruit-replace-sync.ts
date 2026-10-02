/**
 * ═══ /api/irecruit-replace-sync — การดึงส่งคนแทนจาก iRecruit (2 ต.ค. 2569) ═══
 *
 * GET   → สภาพ: เปิดอยู่ไหม · ชั่วโมงที่ดึง · กติกาเวลาโทร · ผลรอบล่าสุด · เหตุผลที่ใช้ iRecruit ไม่ได้ (ถ้ามี)   (staff)
 * POST  → ดึงตอนนี้หนึ่งรอบ (ตัวเดียวกับที่ worker เดินทุกเช้า)                                                (supervisor+)
 * PATCH → ตั้งกติกาเวลาโทร `{ rule: { dayOffset, time } }`                                                    (supervisor+)
 *
 * 🔴 เส้นนี้ไม่สร้างสายเอง — ทุกอย่างผ่าน `runIrecruitReplaceSync` ที่เดียว (กันซ้ำที่ฐาน · ส่ง AI ตามสวิตช์เดิม)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { irecruitUnavailableReason } from '../_lib/irecruitSqlServer.js';
import {
  getReplaceSyncSettings,
  isReplaceSyncRunning,
  runIrecruitReplaceSync,
  saveReplaceSyncSettings,
} from '../_lib/irecruitReplaceSync.js';
import { getLastReplaceSyncInMemory, getReplaceSyncWorkerConfig } from '../_lib/irecruitReplaceSyncWorker.js';
import { normalizeReplaceCallRule, replaceCallRuleText } from '../../src/lib/irecruitReplaceSync.js';

async function statusPayload() {
  const cfg = getReplaceSyncWorkerConfig();
  const settings = await getReplaceSyncSettings();
  return {
    enabled: cfg.enabled,
    hour: cfg.hour,
    horizonDays: cfg.horizonDays,
    unavailableReason: irecruitUnavailableReason(),
    tableReady: settings.tableReady,
    running: isReplaceSyncRunning(),
    rule: settings.rule,
    ruleText: replaceCallRuleText(settings.rule),
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
      const body = (await readJsonBody(req)) as { rule?: unknown } | null;
      if (!body || typeof body !== 'object' || !('rule' in body)) {
        return sendError(res, 400, 'Bad request', 'ต้องส่ง rule { dayOffset, time }');
      }
      const before = await getReplaceSyncSettings();
      if (!before.tableReady) {
        return sendError(res, 503, 'Service unavailable', 'ฐานยังไม่รัน migration 133 — ยังตั้งค่าไม่ได้');
      }
      // ส่งมาเฉพาะบางช่องได้ (ป๊อปแก้เวลาโทรไม่ส่ง aiFrom) — ช่องที่ไม่ส่งคงค่าเดิม ห้ามล้างทิ้ง
      const rule = normalizeReplaceCallRule({ ...before.rule, ...(typeof body.rule === 'object' && body.rule ? body.rule : {}) });
      // ruleChangedAt = ให้ worker ดึงใหม่รอบถัดไป (≤ 5 นาที) แล้วย้ายเวลาสายเดิมให้ตรงกติกาใหม่
      await saveReplaceSyncSettings({ rule, ruleChangedAt: new Date().toISOString() }, req.user.email || req.user.sub);
      await auditFromAuthed(req, {
        action: 'irecruit_replace_sync.rule',
        entityType: 'irecruit_replace_sync',
        entityId: 'default',
        before: before.rule,
        after: rule,
      });
      return res.status(200).json(await statusPayload());
    }

    return sendError(res, 405, 'Method not allowed', 'GET / POST / PATCH เท่านั้น');
  } catch (e) {
    return handleApiError(res, e, 'irecruit-replace-sync');
  }
}

export default withRbac(handler, 'irecruit-replace-sync');

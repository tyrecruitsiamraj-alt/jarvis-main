/**
 * ═══ /api/irecruit-replace-sync — การดึงส่งคนแทนจาก iRecruit (2 ต.ค. 2569) ═══
 *
 * GET   → สภาพ: เปิดอยู่ไหม · เวลาโทร (3 สาย) · ผลรอบล่าสุด · เหตุผลที่ใช้ iRecruit ไม่ได้ (ถ้ามี)   (staff)
 * POST  → ดึงตอนนี้หนึ่งรอบ (ตัวเดียวกับที่ worker เดินทุก 5 นาที)                                  (supervisor+)
 * (PATCH ตั้งกติกาเวลาโทร ถอดแล้ว 5 ต.ค. 2569 — เวลาโทรตายตัวตาม Journey ของเจ้าของ)
 *
 * 🔴 เส้นนี้ไม่สร้างสายเอง — ทุกอย่างผ่าน `runIrecruitReplaceSync` ที่เดียว (กันซ้ำที่ฐาน · ส่ง AI ตามสวิตช์เดิม)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { irecruitUnavailableReason } from '../_lib/irecruitSqlServer.js';
import {
  getReplaceSyncSettings,
  isReplaceSyncRunning,
  runIrecruitReplaceSync,
} from '../_lib/irecruitReplaceSync.js';
import { getLastReplaceSyncInMemory, getReplaceSyncWorkerConfig } from '../_lib/irecruitReplaceSyncWorker.js';
import { REPLACE_SCHEDULE_TEXT } from '../../src/lib/irecruitReplaceSync.js';

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
    ruleText: REPLACE_SCHEDULE_TEXT,
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

    return sendError(res, 405, 'Method not allowed', 'GET / POST เท่านั้น');
  } catch (e) {
    return handleApiError(res, e, 'irecruit-replace-sync');
  }
}

export default withRbac(handler, 'irecruit-replace-sync');

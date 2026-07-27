import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getSiamrajUnitRequestById } from '../_lib/siamrajUnitRequests.js';
import { loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { getSiamrajSqlServerConfig } from '../_lib/siamrajSqlServer.js';
import { getOllamaConfig } from '../_lib/ollamaClient.js';
import { matchBoardCandidatesForJob, type BoardMatchResult } from '../_lib/boardCandidateMatcher.js';
import { getStoredBoardMatch } from '../_lib/boardMatchStore.js';
import { listBoardReadyCandidates } from '../_lib/boardCandidatesSql.js';
import { loadBoardAvailabilityContext } from '../_lib/boardAvailability.js';
import { filterAvailableBoardMatches } from '@/lib/boardMatchAvailability';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/** แมท "คนของเรา" (ผ่านสัมภาษณ์ รอลงงาน จาก board) กับใบขอ — read-only */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method !== 'GET') {
      return sendError(res, 405, 'Method not allowed', 'Read-only board matching');
    }

    if (!getSiamrajSqlServerConfig()) {
      return sendError(res, 503, 'Service unavailable', 'ยังไม่ได้ตั้งค่า Siamraj SQL Server (DB_HOST)');
    }

    // โหมด pool: คืน "คนของเรา" แบบเบา (สกิล+พื้นที่) ให้ client นับเบื้องต้นต่อใบขอ — ไม่เรียก AI, ไม่ส่งข้อมูลติดต่อ
    if (getQuery(req, 'pool') === '1') {
      const pool = await listBoardReadyCandidates({ limit: 2000 });
      return res.status(200).json({
        pool_size: pool.length,
        pool: pool.map((c) => ({
          card_id: c.card_id,
          job1_name: c.job1_name,
          job2_name: c.job2_name,
          province_name: c.province_name,
          amphur_name: c.amphur_name,
        })),
      });
    }

    if (!getOllamaConfig()) {
      return sendError(res, 503, 'Service unavailable', 'ตั้งค่า OLLAMA_BASE_URL / OLLAMA_MODEL ก่อน');
    }

    const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
    if (!jobId.trim()) {
      return sendError(res, 400, 'Bad request', 'jobId is required');
    }

    // จำกัดตามแผนก — staff แผนกอื่นอ้าง jobId ข้ามแผนกเพื่อดูผล match + ข้อมูลผู้สมัครไม่ได้
    const job = await getSiamrajUnitRequestById(jobId, await loadUserDepartmentScope(req.user));
    if (!job) {
      return sendError(res, 404, 'Not found', 'ไม่พบใบขอ ERP');
    }

    const refresh = getQuery(req, 'refresh') === '1';

    // กรองผล (snapshot) ให้เหลือเฉพาะคนที่ "ยังพร้อม" ณ ตอนนี้ — ไม่คิด AI ใหม่, ไม่แตะ snapshot
    // คนที่ถูกจอง/ลงงานที่ใบอื่น หรือหลุดจาก pool รอลงงานแล้ว จะหายจากผลไปเอง
    const withAvailability = async (result: BoardMatchResult, computedAt: string, fromStore: boolean) => {
      const availCtx = await loadBoardAvailabilityContext();
      const matches = filterAvailableBoardMatches(result.matches, jobId, availCtx);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({
        ...result,
        matches,
        hidden_unavailable: result.matches.length - matches.length,
        computed_at: computedAt,
        from_store: fromStore,
      });
    };

    // ไม่ได้สั่งคำนวณใหม่ → เสิร์ฟผลที่เคยคิดเก็บไว้ทันที (ข้าม LLM)
    if (!refresh) {
      const stored = await getStoredBoardMatch(jobId);
      if (stored) {
        return withAvailability(stored.result, stored.computedAt, true);
      }
    }

    const result = await matchBoardCandidatesForJob(jobId, job as Record<string, unknown>, {
      refresh,
    });

    return withAvailability(result, new Date().toISOString(), false);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/เชื่อมต่อ Ollama|ตั้งค่า OLLAMA|ไม่พบโมเดล|ตอบกลับว่าง|ใช้เวลานานเกินไป/i.test(message)) {
      return sendError(res, 503, 'Service unavailable', message);
    }
    return handleApiError(res, e, 'matching-board-candidates');
  }
}

export default withRbac(handler, 'matching-board-candidates');

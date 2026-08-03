/**
 * ส่งให้ Lumos โทร แบบ "คนเลือกเอง" + อ่านสถานะ/ผลการโทรต่อคน
 *
 * GET    /api/lumos/dispatch?jobId=<id>                     → สถานะ+ผลการโทรของทุกคนที่ส่งไปแล้วในใบขอนี้
 * POST   /api/lumos/dispatch  {jobId, boardCardIds[], irecruitIds[]} → เข้าคิวเฉพาะคนที่ติ๊กเลือก
 * DELETE /api/lumos/dispatch?jobId=&channel=&ref=           → ยกเลิกที่ส่งผิด (เฉพาะที่ยังไม่มีผลกลับ)
 *
 * ⚠️ ชื่อ/เบอร์ของ payload สร้างจากฝั่ง server เท่านั้น (ผลแมทที่เก็บไว้ / ฐาน iRecruit)
 * client ส่งมาได้แค่ "id ของคนที่เลือก" — กันการยัดเบอร์ปลายทางเข้าคิวโทร
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { getSiamrajUnitRequestById } from '../_lib/siamrajUnitRequests.js';
import { loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { getStoredBoardMatch } from '../_lib/boardMatchStore.js';
import { getCachedCandidateSpec } from '../_lib/candidateSpecAnalyzer.js';
import { listRecruitCandidatesByIds } from '../_lib/recruitRegisterSql.js';
import { getIrecruitSqlServerConfig } from '../_lib/irecruitSqlServer.js';
import {
  listBoardReadyCandidates,
  boardPrimaryColumnId,
  boardFallbackColumnId,
  boardReuseColumnId,
  type BoardReadyCandidate,
} from '../_lib/boardCandidatesSql.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  enqueueLumosReminderForSelected,
  enqueueLumosInterviewForSelected,
  listLumosCallStatusForJob,
  cancelLumosQueueItem,
  type LumosDispatchOutcome,
} from '../_lib/lumosDispatch.js';

const MAX_PER_REQUEST = 50;
const BOARD_POOL_LIMIT = 2000;

/**
 * ถังที่ให้ "คนเลือกส่งเอง" เห็น: To do (รอลงงาน) + ไม่มีงาน (รองาน) + Re Use (คนเก่า)
 * — Re Use ตั้งใจให้อยู่เฉพาะเส้นนี้ ห้ามเข้า auto-match เพราะสถานะปัจจุบันไม่แน่ ต้องมีคนตรวจก่อน
 */
function pickerColumnIds(): number[] {
  return [boardPrimaryColumnId(), boardFallbackColumnId(), boardReuseColumnId()];
}

/** เรียง pool ให้คนพร้อมสุดขึ้นก่อน: To do → ไม่มีงาน → Re Use */
function pickerColumnRank(c: BoardReadyCandidate): number {
  const ids = pickerColumnIds();
  // column_label ใช้แสดงผล — ลำดับใช้จากตำแหน่งใน pickerColumnIds ผ่านการ query แยกไม่ได้
  // จึงอิง label ที่ DB ให้มา (To do / ไม่มีงาน / Re Use) แบบตายตัว
  const label = (c.column_label || '').trim().toLowerCase();
  if (label === 'to do') return 0;
  if (label === 'ไม่มีงาน') return 1;
  return ids.length; // Re Use และอื่น ๆ ไปท้าย
}

/** ชื่อที่แสดง/ส่งให้ Lumos — ตรงกับที่ boardCandidateMatcher ใช้ */
function boardFullName(c: BoardReadyCandidate): string {
  return (
    [c.first_name, c.last_name].filter(Boolean).join(' ').trim() ||
    c.nick_name ||
    `การ์ด #${c.card_id}`
  );
}

export type BoardSelectionInput = Pick<
  BoardReadyCandidate,
  'card_id' | 'first_name' | 'last_name' | 'nick_name' | 'mobile'
>;

/**
 * จับคู่ card_id ที่คนเลือก กับ pool "คนของเรา" สด ๆ — pure เพื่อคุมด้วย unit test
 *
 * ตั้งใจตรวจกับ pool **ไม่ใช่ผล AI แมทที่บันทึกไว้**: คนที่เพิ่งเพิ่มเข้า pool ทีหลัง
 * ยังไม่อยู่ในผลแมทของใบขอนั้น แต่ต้องส่งให้ Lumos โทรได้ทันทีเวลาใบขอด่วน
 * และเบอร์ที่ส่งต้องเป็นเบอร์ล่าสุดใน pool ไม่ใช่เบอร์ที่ค้างใน snapshot
 */
export function resolveBoardSelection(
  pool: BoardSelectionInput[],
  cardIds: number[],
): {
  selected: Array<{ card_id: number; full_name: string; mobile: string | null }>;
  missing: number[];
} {
  const byCardId = new Map(pool.map((c) => [c.card_id, c]));
  const selected: Array<{ card_id: number; full_name: string; mobile: string | null }> = [];
  const missing: number[] = [];
  for (const cardId of cardIds) {
    const c = byCardId.get(cardId);
    if (!c) {
      missing.push(cardId);
      continue;
    }
    selected.push({
      card_id: c.card_id,
      full_name: boardFullName(c as BoardReadyCandidate),
      mobile: c.mobile,
    });
  }
  return { selected, missing };
}

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/** อ่าน array ของ id จาก body — ทิ้งค่าที่ไม่ใช่จำนวนเต็มบวก */
export function parseIdList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw) {
    const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
    if (Number.isInteger(n) && n > 0) out.push(n);
  }
  return [...new Set(out)];
}

export type ParsedDispatchInput = {
  jobId: string;
  boardCardIds: number[];
  irecruitIds: number[];
};

export type DispatchInputResult = { error: string | null; value: ParsedDispatchInput | null };

/** ตรวจ body ของ POST — pure เพื่อคุมด้วย unit test */
export function parseDispatchInput(raw: unknown): DispatchInputResult {
  const fail = (message: string): DispatchInputResult => ({ error: message, value: null });
  if (typeof raw !== 'object' || raw === null) return fail('Invalid JSON body');
  const body = raw as Record<string, unknown>;

  const jobId = getString(body.jobId) ?? '';
  if (!jobId) return fail('jobId is required');

  const boardCardIds = parseIdList(body.boardCardIds);
  const irecruitIds = parseIdList(body.irecruitIds);
  const total = boardCardIds.length + irecruitIds.length;
  if (total === 0) return fail('กรุณาติ๊กเลือกผู้สมัครที่จะให้ Lumos โทรอย่างน้อย 1 คน');
  if (total > MAX_PER_REQUEST) {
    return fail(`ส่งได้ครั้งละไม่เกิน ${MAX_PER_REQUEST} คน (เลือกมา ${total} คน)`);
  }

  return { error: null, value: { jobId, boardCardIds, irecruitIds } };
}

function mergeOutcomes(parts: LumosDispatchOutcome[]): LumosDispatchOutcome {
  return {
    queued: parts.reduce((s, p) => s + p.queued, 0),
    duplicated: parts.flatMap((p) => p.duplicated),
    skipped: parts.flatMap((p) => p.skipped),
  };
}

async function getCallStatus(req: AuthedReq, res: ApiRes) {
  const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
  if (!jobId.trim()) return sendError(res, 400, 'Bad request', 'jobId is required');

  // จำกัดตามแผนก — ห้ามอ่านสถานะการโทรของใบขอข้ามแผนก
  const job = await getSiamrajUnitRequestById(jobId, await loadUserDepartmentScope(req.user));
  if (!job) return sendError(res, 404, 'Not found', 'ไม่พบใบขอ ERP');

  const items = await listLumosCallStatusForJob(jobId);
  res.setHeader?.('Cache-Control', 'no-store');

  // pool=1 → แนบรายชื่อ "คนของเรา" ทั้ง pool ให้หน้าจอเลือกส่งเอง (คนเพิ่มใหม่ก็อยู่ในนี้)
  if (getQuery(req, 'pool') !== '1') {
    return res.status(200).json({ items, total: items.length });
  }

  const sentRefs = new Set(items.filter((i) => i.status !== 'cancelled').map((i) => i.person_ref));
  const pool = await listBoardReadyCandidates({ columnIds: pickerColumnIds(), limit: BOARD_POOL_LIMIT });
  pool.sort((a, b) => pickerColumnRank(a) - pickerColumnRank(b));
  return res.status(200).json({
    items,
    total: items.length,
    pool: pool.map((c) => ({
      card_id: c.card_id,
      full_name: boardFullName(c),
      skills: [c.job1_name, c.job2_name].filter(Boolean).join(' / ') || null,
      area: [c.amphur_name, c.province_name].filter(Boolean).join(' ') || null,
      mobile: c.mobile,
      age: c.age,
      required_salary: c.required_salary,
      last_activity_at: c.last_activity_at,
      /** ถังบนบอร์ด: To do / ไม่มีงาน / Re Use — หน้าจอใช้ติดป้ายบอกที่มา */
      column_label: c.column_label,
      /** ส่งเข้าคิว AI โทรในใบขอนี้ไปแล้ว (auto หรือคนกดเอง) — ติ๊กซ้ำไม่ได้ */
      already_sent: sentRefs.has(`card-${c.card_id}`),
    })),
  });
}

async function dispatchSelected(req: AuthedReq, res: ApiRes) {
  const parsed = parseDispatchInput(await readJsonBody(req));
  if (parsed.error || !parsed.value) {
    return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
  }
  const { jobId, boardCardIds, irecruitIds } = parsed.value;

  const job = await getSiamrajUnitRequestById(jobId, await loadUserDepartmentScope(req.user));
  if (!job) return sendError(res, 404, 'Not found', 'ไม่พบใบขอ ERP');
  const jobRecord = job as Record<string, unknown>;

  const spec = getCachedCandidateSpec(jobId);
  const requestNo = getString(jobRecord.request_no) ?? spec?.request_no ?? null;
  const outcomes: LumosDispatchOutcome[] = [];

  if (boardCardIds.length > 0) {
    // ตรวจกับ pool สด ๆ ของ 3 ถังที่อนุญาต (To do/ไม่มีงาน/Re Use) ไม่ใช่ผล snapshot —
    // คนที่เพิ่งเพิ่มเข้า pool ทีหลังต้องส่งได้ทันทีเวลาใบขอด่วน และเบอร์ที่ใช้ต้องเป็นเบอร์ล่าสุด
    const pool = await listBoardReadyCandidates({ columnIds: pickerColumnIds(), limit: BOARD_POOL_LIMIT });
    const { selected, missing } = resolveBoardSelection(pool, boardCardIds);
    if (missing.length > 0) {
      return sendError(
        res,
        409,
        'Conflict',
        `ผู้สมัครบางคนไม่อยู่ใน pool "คนของเรา" แล้ว (การ์ด ${missing.join(', ')}) — อาจถูกย้ายคอลัมน์/ลงงานไปแล้ว`,
      );
    }
    const stored = await getStoredBoardMatch(jobId);
    outcomes.push(
      await enqueueLumosReminderForSelected(
        jobRecord,
        {
          jobId,
          request_no: stored?.result.request_no ?? requestNo,
          job_family_label: stored?.result.job_family_label ?? spec?.job_family_label ?? null,
        },
        selected,
      ),
    );
  }

  if (irecruitIds.length > 0) {
    if (!getIrecruitSqlServerConfig()) {
      return sendError(res, 503, 'Service unavailable', 'ยังไม่ได้ตั้งค่า iRecruit DB');
    }
    const candidates = await listRecruitCandidatesByIds(irecruitIds);
    const found = new Set(candidates.map((c) => c.id));
    const missing = irecruitIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      return sendError(
        res,
        409,
        'Conflict',
        `ไม่พบผู้สมัคร iRecruit บางคนในฐานข้อมูล (id ${missing.join(', ')}) — กดค้นหาใหม่แล้วเลือกอีกครั้ง`,
      );
    }
    outcomes.push(
      await enqueueLumosInterviewForSelected(
        jobRecord,
        { jobId, request_no: requestNo, job_family_label: spec?.job_family_label ?? null },
        candidates.map((c) => ({
          id: c.id,
          full_name: [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || `ผู้สมัคร #${c.id}`,
          phone_number: c.phone_number,
          job_name_th: c.job_name_th,
          position_name: c.position_name,
        })),
      ),
    );
  }

  const outcome = mergeOutcomes(outcomes);

  await auditFromAuthed(req, {
    action: 'lumos.dispatch.manual',
    entityType: 'lumos_dispatch_queue',
    entityId: jobId,
    after: {
      jobId,
      request_no: requestNo,
      boardCardIds,
      irecruitIds,
      queued: outcome.queued,
      duplicated: outcome.duplicated,
      skipped: outcome.skipped,
    },
  });

  const items = await listLumosCallStatusForJob(jobId);
  return res.status(200).json({ ...outcome, items });
}

async function cancelDispatch(req: AuthedReq, res: ApiRes) {
  const jobId = getQuery(req, 'jobId');
  const channelRaw = getQuery(req, 'channel');
  const ref = getQuery(req, 'ref');
  if (!jobId || !ref) return sendError(res, 400, 'Bad request', 'jobId และ ref จำเป็น');
  if (channelRaw !== 'reminder' && channelRaw !== 'interview') {
    return sendError(res, 400, 'Bad request', "channel ต้องเป็น 'reminder' หรือ 'interview'");
  }

  const job = await getSiamrajUnitRequestById(jobId, await loadUserDepartmentScope(req.user));
  if (!job) return sendError(res, 404, 'Not found', 'ไม่พบใบขอ ERP');

  const cancelled = await cancelLumosQueueItem(jobId, channelRaw, ref);
  if (!cancelled) {
    return sendError(
      res,
      409,
      'Conflict',
      'ยกเลิกไม่ได้ — Lumos โทรและส่งผลกลับมาแล้ว หรือรายการนี้ถูกยกเลิกไปก่อนหน้า',
    );
  }

  await auditFromAuthed(req, {
    action: 'lumos.dispatch.cancel',
    entityType: 'lumos_dispatch_queue',
    entityId: jobId,
    after: { jobId, channel: channelRaw, ref },
  });

  const items = await listLumosCallStatusForJob(jobId);
  return res.status(200).json({ cancelled: true, items });
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') return await getCallStatus(req, res);
    if (method === 'POST') return await dispatchSelected(req, res);
    if (method === 'DELETE') return await cancelDispatch(req, res);
    return sendError(res, 405, 'Method not allowed', 'Use GET, POST or DELETE');
  } catch (e) {
    return handleApiError(res, e, `lumos-dispatch ${method}`, { userId: req.user.sub });
  }
}

export default withRbac(handler, 'lumos-dispatch');

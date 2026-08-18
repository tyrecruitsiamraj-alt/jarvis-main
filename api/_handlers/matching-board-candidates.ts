import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getSiamrajUnitRequestById } from '../_lib/siamrajUnitRequests.js';
import { loadMatchingBuScope } from '../_lib/departmentScope.js';
import { getSiamrajSqlServerConfig } from '../_lib/siamrajSqlServer.js';
import { type BoardMatchResult } from '../_lib/boardCandidateMatcher.js';
import { getStoredBoardMatch } from '../_lib/boardMatchStore.js';
import {
  enqueuePrecomputeJobs,
  isMatchPrecomputeWorkerActive,
} from '../_lib/matchPrecomputeWorker.js';
import {
  listBoardReadyCandidates,
  countBoardCandidatesByColumn,
  boardPrimaryColumnId,
  boardFallbackColumnId,
  boardReuseColumnId,
  boardInProcessColumnId,
  boardDoneColumnId,
  boardDropColumnId,
} from '../_lib/boardCandidatesSql.js';
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

    // โหมด people: รายชื่อคนของเราทุกถังบนบอร์ด — หน้า "ผู้สมัคร"
    // ข้อมูลระดับเดียวกับ picker เลือกส่ง AI โทร (ชื่อ+เบอร์+สกิล) — สิทธิ์ staff เท่ากัน
    // เจ้าของสั่ง 10 ส.ค. 2569: เอา Done/Drop มาด้วย (เดิมมีแค่ 4 ถังที่เอาไปแมทได้)
    if (getQuery(req, 'people') === '1') {
      const people = await listBoardReadyCandidates({
        columnIds: [
          boardPrimaryColumnId(),
          boardFallbackColumnId(),
          boardReuseColumnId(),
          boardInProcessColumnId(),
          boardDoneColumnId(),
          boardDropColumnId(),
        ],
        limit: 2000,
      });
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({
        people: people.map((c) => ({
          card_id: c.card_id,
          full_name:
            [c.first_name, c.last_name].filter(Boolean).join(' ').trim() ||
            c.nick_name ||
            `การ์ด #${c.card_id}`,
          nick_name: c.nick_name,
          skills: [c.job1_name, c.job2_name].filter(Boolean).join(' / ') || null,
          area: [c.amphur_name, c.province_name].filter(Boolean).join(' ') || null,
          mobile: c.mobile,
          age: c.age,
          required_salary: c.required_salary,
          last_activity_at: c.last_activity_at,
          column_label: c.column_label,
          // ฟิลด์สำหรับหน้ารายละเอียด — SQL ดึงมาให้อยู่แล้ว (ไม่ได้ query เพิ่ม)
          job1_name: c.job1_name,
          job2_name: c.job2_name,
          application_no: c.application_no,
          application_date: c.application_date,
          sex_code: c.sex_code,
          province_name: c.province_name,
          amphur_name: c.amphur_name,
          full_address: c.full_address,
          site_name: c.site_name,
          work_place: c.work_place,
          remarks: c.remarks,
        })),
      });
    }

    /**
     * โหมด picker: รายชื่อสำหรับ **ตั้งตารางโทรตาม** ในหน้า Follow (F5b · 16 ส.ค. 2569)
     * ต่างจาก `people=1` สองข้อ — เจ้าของกำหนดเอง:
     *   1. เอาเฉพาะคนที่มีเบอร์ (ไม่มีเบอร์ = ตั้งตารางโทรไม่ได้อยู่ดี)
     *   2. ส่งเฉพาะฟิลด์ที่ picker ใช้ — ไม่หลุดที่อยู่/ค่าจ้างที่ขอ ออกไปหน้าอื่น
     * ถัง Checklist (1) ไม่อยู่ในลิสต์อยู่แล้ว (คนยังสมัครไม่เสร็จ = งานของเลนสรรหา)
     *
     * 🔴 **เลิกตัดคนที่ "แจ้งเข้าแล้ว" ออก** (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-2:
     * *"กล่องเลือกพนักงานเพิ่ม Done Drop เข้าไป"*) — ถัง Done/Drop อยู่ในลิสต์ตั้งแต่
     * 10 ส.ค. แล้ว แต่ `excludeInformed` ตัดคนที่ได้งานแล้วทิ้ง ทำให้ถัง Done เหลือ
     * **51 จาก 235 คน** (วัดจริง 18 ส.ค.) — และคนกลุ่มที่หายไปนั้นคือกลุ่มที่ต้องตาม
     * เรื่อง "เริ่มงาน / เรียนงาน / เบิกเบี้ยเลี้ยง" พอดี ซึ่งเป็นงานหลักของหน้า Follow
     * ⚠️ ส่ง `is_informed` ไปให้หน้าเว็บติดป้าย "แจ้งเข้าแล้ว" ด้วย — ไม่บอกก็แยกไม่ออก
     *    ว่าคนไหนได้งานแล้ว แล้วจะเผลอตามเรื่องหางานให้คนที่มีงานอยู่แล้ว
     * ⚠️ โหมดนี้ใช้ที่กล่องเลือกคนของหน้า Follow ที่เดียว — เลนสรรหา/AI matcher
     *    ใช้เส้นอื่นและยังตัดคนแจ้งเข้าแล้วอยู่เหมือนเดิม (ห้ามเอาคนมีงานไปเสนองานใหม่)
     */
    if (getQuery(req, 'picker') === '1') {
      const rows = await listBoardReadyCandidates({
        columnIds: [
          boardPrimaryColumnId(),
          boardFallbackColumnId(),
          boardReuseColumnId(),
          boardInProcessColumnId(),
          boardDoneColumnId(),
          boardDropColumnId(),
        ],
        limit: 2000,
      });
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({
        people: rows
          .filter((c) => (c.mobile || '').trim())
          .map((c) => ({
            card_id: c.card_id,
            first_name: c.first_name,
            last_name: c.last_name,
            nick_name: c.nick_name,
            // เพศ — บอร์ด iRecruit ไม่เก็บคำนำหน้า (เจอติดใน fname แค่ 17/49,524 คน)
            // ฟอร์ม Follow ใช้เดาคำนำหน้า: M→นาย · F→นางสาว (คนแก้เป็น นาง เองได้)
            sex_code: c.sex_code,
            mobile: c.mobile,
            skills: [c.job1_name, c.job2_name].filter(Boolean).join(' / ') || null,
            area: [c.amphur_name, c.province_name].filter(Boolean).join(' ') || null,
            column_label: c.column_label,
            last_activity_at: c.last_activity_at,
            // ได้งานแล้วหรือยัง — หน้าเว็บติดป้ายให้เห็นชัด ไม่ได้ใช้กรองออก
            is_informed: c.is_informed,
          })),
      });
    }

    // โหมด buckets: ยอดการ์ด active ต่อถังบนบอร์ด iRecruit
    // เจ้าของสั่ง 10 ส.ค. 2569: เอา Done/Drop มาโชว์ด้วย — เดิมมีแค่ 4 ถังที่เอาไปแมทได้
    // เรียงตามเส้นทางจริงของคน: รอลงงาน → รองาน → คนเก่า → กำลังเสนอ → ได้งาน → ตกไป
    if (getQuery(req, 'buckets') === '1') {
      const buckets = await countBoardCandidatesByColumn([
        boardPrimaryColumnId(),
        boardFallbackColumnId(),
        boardReuseColumnId(),
        boardInProcessColumnId(),
        boardDoneColumnId(),
        boardDropColumnId(),
      ]);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ buckets });
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

    const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
    if (!jobId.trim()) {
      return sendError(res, 400, 'Bad request', 'jobId is required');
    }

    // จำกัดตามแผนก — staff แผนกอื่นอ้าง jobId ข้ามแผนกเพื่อดูผล match + ข้อมูลผู้สมัครไม่ได้
    const job = await getSiamrajUnitRequestById(jobId, await loadMatchingBuScope(req.user));
    if (!job) {
      return sendError(res, 404, 'Not found', 'ไม่พบใบขอ ERP');
    }

    const refresh = getQuery(req, 'refresh') === '1';

    // กรองผล (snapshot) ให้เหลือเฉพาะคนที่ "ยังพร้อม" ณ ตอนนี้ — ไม่คิด AI ใหม่, ไม่แตะ snapshot
    // คนที่ถูกจอง/ลงงานที่ใบอื่น หรือหลุดจาก pool รอลงงานแล้ว จะหายจากผลไปเอง
    const withAvailability = async (
      result: BoardMatchResult,
      computedAt: string,
      extra: Record<string, unknown> = {},
    ) => {
      const availCtx = await loadBoardAvailabilityContext();
      const matches = filterAvailableBoardMatches(result.matches, jobId, availCtx);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({
        ...result,
        matches,
        hidden_unavailable: result.matches.length - matches.length,
        computed_at: computedAt,
        from_store: true,
        ...extra,
      });
    };

    // นโยบาย: request จากหน้าเว็บไม่รัน AI เอง — เสิร์ฟเฉพาะผลที่ worker หลังบ้านค้นเสร็จแล้ว
    // ใบที่ยังไม่มีผล (หรือสั่งค้นหาใหม่) ส่งเข้าหัวคิว worker แล้วตอบ pending ให้หน้าเว็บรอ
    const stored = await getStoredBoardMatch(jobId);

    if (stored && !refresh) {
      return withAvailability(stored.result, stored.computedAt);
    }

    const workerActive = isMatchPrecomputeWorkerActive();
    if (workerActive) {
      enqueuePrecomputeJobs([{ ...(job as Record<string, unknown>), id: jobId }], {
        refresh,
        front: true,
      });
    }

    if (stored) {
      // สั่งค้นหาใหม่: โชว์ผลเดิมไปก่อน ผลใหม่จากหลังบ้านจะมาแทนที่เมื่อคิดเสร็จ
      return withAvailability(stored.result, stored.computedAt, {
        refresh_queued: workerActive,
        worker_active: workerActive,
      });
    }

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      jobId,
      pending: true,
      queued: workerActive,
      worker_active: workerActive,
    });
  } catch (e) {
    return handleApiError(res, e, 'matching-board-candidates');
  }
}

export default withRbac(handler, 'matching-board-candidates');

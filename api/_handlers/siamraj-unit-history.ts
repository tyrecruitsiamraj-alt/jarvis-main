/**
 * ประวัติการแก้ไขของใบขอ — "ใครแก้อะไรไป" (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)
 *
 * GET /api/siamraj/unit-history?request_no=<เลขที่ใบ> → รายการแก้ไขล่าสุด (ใหม่→เก่า)
 *
 * อ่านจาก `audit_logs` ที่ handler ฝั่งเขียนบันทึกไว้อยู่แล้วทุกครั้ง (ผู้รับผิดชอบ /
 * สถานะทำงาน / หมายเหตุ+ตัวเลือกใบขอ) — **ไม่เพิ่มการเขียนใหม่** แค่เปิดทางอ่านแบบ scoped
 *
 * ⚠️ ทำไมไม่ใช้ `/api/audit-logs`: เส้นนั้นเป็น admin-only และเปิดดูได้ทุก entity
 * ส่วนเส้นนี้ staff ดูได้ แต่**จำกัดทีละใบ + ผ่านด่าน BU เดียวกับใบขอ** (คนละระดับสิทธิ์)
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getString } from '../_lib/body.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { checkSiamrajRequestScope } from '../_lib/siamrajUnitRequests.js';
import { requestScopeDenyMessage } from '../../src/lib/requestScopeMessage.js';

const auditTable = tableInAppSchema('audit_logs');

/** entity ที่นับเป็น "การแก้ไขบนกล่องงาน" — เพิ่ม action ใหม่เมื่อไหร่ต้องเติมที่นี่ด้วย */
const BOARD_EDIT_ENTITY_TYPES = [
  'siamraj_unit_assignment',
  'siamraj_unit_work_status',
  'siamraj_unit_note',
] as const;

type AuditRow = {
  id: string;
  user_name: string;
  action: string;
  entity_type: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string | Date;
};

function tryJson(v: string | null): unknown {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return v; // ค่าเก่าก่อน audit เก็บเป็น JSON — ส่งดิบไป ดีกว่าหายเงียบ
  }
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');
  try {
    const requestNo = getString(req.query?.request_no);
    if (!requestNo) return sendError(res, 400, 'Bad request', 'request_no query is required');

    // ด่านเดียวกับใบขอ — ประวัติมีชื่อคน/โน้ต ห้ามอ่านข้าม BU · บอกเหตุผลจริงเสมอ
    // ("ไม่พบใบ" กับ "คนละ BU" คนละเรื่องกัน — บทเรียน 18 ส.ค. 2569)
    const scope = await checkSiamrajRequestScope(req.user, requestNo);
    if (!scope.ok) {
      return sendError(
        res,
        scope.reason === 'not_found' ? 404 : 403,
        scope.reason === 'not_found' ? 'Not found' : 'Forbidden',
        requestScopeDenyMessage({ ...scope, requestNo }),
      );
    }

    const { rows } = await dbQuery<AuditRow>(
      `select id, user_name, action, entity_type, old_value, new_value, created_at
         from ${auditTable}
        where entity_id = $1 and entity_type = any($2)
        order by created_at desc
        limit 50`,
      [requestNo, [...BOARD_EDIT_ENTITY_TYPES]],
    );

    return res.status(200).json({
      items: rows.map((r) => ({
        id: r.id,
        user_name: r.user_name,
        action: r.action,
        entity_type: r.entity_type,
        before: tryJson(r.old_value),
        after: tryJson(r.new_value),
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      })),
      total: rows.length,
    });
  } catch (e) {
    return handleApiError(res, e, 'siamraj-unit-history GET', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'siamraj-unit-history');

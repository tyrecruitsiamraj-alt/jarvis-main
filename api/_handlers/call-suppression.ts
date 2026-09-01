/**
 * GET/DELETE /api/call-suppression — **บัญชีห้ามโทร** (เบอร์ที่ AI จะไม่โทรถึงชั่วคราว)
 *
 * เจ้าของถาม 1 ก.ย. 2569 ว่า *"ไม่ได้ส่ง — เบอร์อยู่ในบัญชีห้ามโทร คือ"* แล้วพบว่า
 * **ไม่มีหน้าจอไหนดูหรือปลดบัญชีนี้ได้เลย** — เบอร์ถูกพักอัตโนมัติเมื่อผลโทรกลับมาว่า
 * "เบอร์ผิด" (7 วัน) หรือ "ไม่หางานแล้ว" (30 วัน) แล้วคนใช้งานได้แต่รอให้หมดอายุ
 *
 * - GET    → รายการที่ **ยังพักอยู่** (หมดอายุแล้วไม่ต้องโชว์ ไม่ได้บล็อกอะไรแล้ว)
 * - DELETE → ปลดเบอร์เดียว (`?phone=`) — ลบแถวทิ้ง ไม่ใช่ตั้งเวลาให้หมดอายุ
 *
 * สิทธิ์: supervisor ขึ้นไป — ปลดแล้ว AI จะโทรหาเบอร์นั้นได้อีกครั้งจริง ๆ
 */
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { withAuth, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { toE164Thai } from '../_lib/lumosDispatch.js';

const tbl = tableInAppSchema('candidate_call_suppression');

/** คำอธิบายเหตุผลเป็นภาษาคน — รหัสที่ไม่รู้จักคืนรหัสไปตามตรง ห้ามซ่อน */
const REASON_LABEL: Record<string, string> = {
  wrong_number: 'ผลโทรบอกว่าเบอร์ผิด (ไม่ใช่เจ้าตัว)',
  not_looking: 'เจ้าตัวบอกว่าไม่หางานแล้ว',
  manual: 'เจ้าหน้าที่สั่งพักเอง',
};

type Row = {
  phone_e164: string;
  suppressed_until: string | Date;
  reason: string | null;
  note: string | null;
  created_by_name: string | null;
  created_at: string | Date;
};

const iso = (v: string | Date | null): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      const { rows } = await dbQuery<Row>(
        `select phone_e164, suppressed_until, reason, note, created_by_name, created_at
           from ${tbl}
          where suppressed_until > now()
          order by suppressed_until desc
          limit 500`,
      );
      return res.status(200).json({
        items: rows.map((r) => ({
          phone: r.phone_e164,
          until: iso(r.suppressed_until),
          reason: r.reason,
          reason_label: r.reason ? (REASON_LABEL[r.reason] ?? r.reason) : 'ไม่มีบันทึกเหตุผล',
          note: r.note,
          created_by_name: r.created_by_name,
          created_at: iso(r.created_at),
        })),
        total: rows.length,
      });
    }

    if (method === 'DELETE') {
      if (req.user.role !== 'supervisor' && req.user.role !== 'admin') {
        return sendError(res, 403, 'Forbidden', 'ปลดเบอร์ได้เฉพาะหัวหน้าขึ้นไป');
      }
      /* ⚠️ รับ phone ทาง query — body ของ DELETE ถูกกลืนระหว่างทางได้ (บทเรียนจาก call-scripts) */
      const raw = typeof req.query?.phone === 'string' ? req.query.phone : '';
      const phone = toE164Thai(raw) || raw.trim();
      if (!phone) return sendError(res, 400, 'Bad request', 'ต้องระบุเบอร์ที่จะปลด');
      const { rows } = await dbQuery<{ phone_e164: string }>(
        `delete from ${tbl} where phone_e164 = $1 returning phone_e164`,
        [phone],
      );
      if (rows.length === 0) return sendError(res, 404, 'Not found', 'ไม่พบเบอร์นี้ในบัญชีห้ามโทร');
      await auditFromAuthed(req, {
        action: 'call_suppression.release',
        entityType: 'call_suppression',
        entityId: phone,
        after: { phone },
      });
      return res.status(200).json({ ok: true, phone });
    }

    return sendError(res, 405, 'Method not allowed', 'GET / DELETE เท่านั้น');
  } catch (e) {
    return handleApiError(res, e, 'call-suppression');
  }
}

export default withAuth(handler);

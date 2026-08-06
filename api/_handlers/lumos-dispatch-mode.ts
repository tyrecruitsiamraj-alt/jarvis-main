/**
 * โหมดส่งงานให้ Lumos — GET อ่านได้ทุก role (หน้าตั้งค่าโชว์สถานะ) · PUT เฉพาะ admin
 *
 * ทำไมต้องมี: เดิม auto-send ถูก hardcode 3 จุด เจ้าของสั่งปิดก่อนแต่จะเอากลับมาวันหน้า
 * ตารางนี้ทำให้เปลี่ยนไป Auto = แก้ค่าเดียว ไม่ต้องแก้โค้ด ไม่ต้อง deploy
 * ดู src/lib/lumosDispatchMode.ts (ความหมายของค่า) + migrations/069
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { isPgUndefinedTable } from '../_lib/postgres.js';
import { getLumosDispatchMode, setLumosDispatchMode } from '../_lib/lumosDispatchMode.js';
import {
  normalizeLumosDispatchMode,
  DEFAULT_LUMOS_DISPATCH_MODE,
} from '../../src/lib/lumosDispatchMode.js';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ config: await getLumosDispatchMode() });
    }

    if (method === 'PUT') {
      // แก้ได้เฉพาะ admin — การเปิด auto = ระบบเริ่มโทรหาผู้สมัครจริงเอง
      if (req.user?.role !== 'admin') {
        return sendError(res, 403, 'Forbidden', 'เฉพาะผู้ดูแลระบบที่เปลี่ยนโหมดนี้ได้');
      }
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;
      const before = await getLumosDispatchMode();
      const next = normalizeLumosDispatchMode(body.config ?? body);

      const saved = await setLumosDispatchMode(next, req.user?.email ?? null);

      // เปิด/ปิด auto มีผลกับการโทรหาคนจริง — ต้องรู้ว่าใครเปลี่ยนเมื่อไหร่
      void auditFromAuthed(req, {
        action: 'lumos-dispatch-mode.update',
        entityType: 'app_lumos_dispatch_mode',
        entityId: 'default',
        before,
        after: saved,
      });

      return res.status(200).json({ config: saved });
    }

    res.setHeader?.('Allow', 'GET, PUT');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    if (isPgUndefinedTable(e)) {
      // ยังไม่ migrate — GET ไม่เข้าทางนี้ (getLumosDispatchMode กลืนให้แล้ว) เหลือแต่ PUT
      return sendError(
        res,
        503,
        'Service unavailable',
        'ยังไม่ได้สร้างตารางโหมดส่งงาน — migration จะรันเองตอน deploy รอบถัดไป',
      );
    }
    return handleApiError(res, e, 'lumos-dispatch-mode', { userId: req.user?.sub });
  }
}

export { DEFAULT_LUMOS_DISPATCH_MODE };
export default withRbac(handler, 'lumos-dispatch');

import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import {
  listRecruitChannels,
  listRecruitChannelRoots,
  listRecruitChannelRootsPage,
  listRecruitChannelChildren,
  searchRecruitChannels,
  createRecruitChannel,
  updateRecruitChannel,
  deleteRecruitChannel,
} from '../_lib/recruitPostings.js';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/**
 * ช่องทางรับสมัคร (master 2 ระดับ: หลัก → รอง)
 * GET   — ทุก role ที่ล็อกอิน (ฟอร์มสร้างลิงก์ต้องใช้)
 * POST/PATCH/DELETE — หัวหน้างานขึ้นไป (บังคับที่ rbac)
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      const includeInactive = getQuery(req, 'all') === '1';
      const limit = Number(getQuery(req, 'limit')) || undefined;

      const q = getQuery(req, 'q');
      const offset = Number(getQuery(req, 'offset')) || 0;

      /**
       * หน้าจัดช่องทาง — สองมุมมองแบ่งหน้าฝั่งเซิร์ฟเวอร์ คืน { items, total }
       * ⚠️ ต้องเช็คก่อนสาขา `q` ข้างล่าง ไม่งั้นพิมพ์ค้นหาแล้วตกไปที่ผลค้นแบบเก่า (ไม่มี total)
       */
      const view = getQuery(req, 'view');
      if (view === 'roots') {
        return res
          .status(200)
          .json(await listRecruitChannelRootsPage({ includeInactive, limit, offset, q }));
      }
      if (view === 'children') {
        return res.status(200).json(
          await listRecruitChannelChildren(getQuery(req, 'parent') || null, {
            includeInactive,
            limit,
            offset,
            q,
          }),
        );
      }

      // ค้นหา — ตัวเลือกช่องทาง (ChannelPicker) ใช้ท่านี้ (ทรีเต็มมี 4,390 แถว)
      if (q) {
        return res
          .status(200)
          .json(await searchRecruitChannels(q, { includeInactive, limit }));
      }

      // ช่องทางรองของพ่อหนึ่งตัว แบ่งหน้า (ท่าเดิม — คำค้นอยู่ที่ childQ)
      const parent = getQuery(req, 'parent');
      if (parent) {
        return res.status(200).json(
          await listRecruitChannelChildren(parent, {
            includeInactive,
            limit,
            offset,
            q: getQuery(req, 'childQ'),
          }),
        );
      }

      // ช่องทางหลักอย่างเดียว + จำนวนลูก
      if (getQuery(req, 'roots') === '1') {
        return res.status(200).json(await listRecruitChannelRoots(includeInactive));
      }

      return res.status(200).json(await listRecruitChannels(includeInactive));
    }

    if (method === 'POST') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');
      const created = await createRecruitChannel({
        parentId: typeof body.parentId === 'string' ? body.parentId : null,
        name: String(body.name ?? ''),
        sortOrder: Number(body.sortOrder),
      });
      return res.status(201).json(created);
    }

    if (method === 'PATCH') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');
      const id = typeof body.id === 'string' ? body.id : getQuery(req, 'id');
      if (!id) return sendError(res, 400, 'Bad request', 'ต้องระบุ id');
      const updated = await updateRecruitChannel(id, {
        name: typeof body.name === 'string' ? body.name : undefined,
        sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
        isActive: body.isActive === undefined ? undefined : !!body.isActive,
      });
      if (!updated) return sendError(res, 404, 'Not found', 'ไม่พบช่องทางนี้');
      return res.status(200).json(updated);
    }

    if (method === 'DELETE') {
      const id = getQuery(req, 'id');
      if (!id) return sendError(res, 400, 'Bad request', 'ต้องระบุ id');
      const ok = await deleteRecruitChannel(id);
      if (!ok) return sendError(res, 404, 'Not found', 'ไม่พบช่องทางนี้');
      // ลิงก์ที่เคยสร้างด้วยช่องทางนี้ยังใช้ได้ — channel_label ที่เก็บซ้ำไว้ทำให้รายงานย้อนหลังไม่เพี้ยน
      return res.status(200).json({ ok: true });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/ชื่อ|ช่องทาง|ระบุ/.test(msg)) return sendError(res, 400, 'Bad request', msg);
    return handleApiError(res, e, 'recruit-channels', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'recruit-channels');

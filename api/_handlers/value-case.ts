import {
  withAuth,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from "../_lib/http.js";
import { readJsonBody } from "../_lib/body.js";
import {
  bangkokYm,
  canSeeValueCase,
  loadValueCaseInputs,
  loadValueCaseMonths,
  saveValueCaseInputs,
} from "../_lib/valueCaseStore.js";

/**
 * หน้าความคุ้มค่าระบบ (เจ้าของสั่ง 15 ต.ค. 2569 "เอาไว้ดูคนเดียว")
 * GET = ตัวเลขที่กรอก + ตัวเลขระบบรายเดือน · PUT = บันทึกตัวเลขที่กรอก
 * คนที่ไม่มีสิทธิ์ได้ 404 (ไม่บอกว่ามีหน้านี้)
 */
async function handler(req: AuthedReq, res: ApiRes) {
  if (!canSeeValueCase(req.user)) return sendError(res, 404, "Not found");
  const method = (req.method || "GET").toUpperCase();
  try {
    if (method === "GET") {
      // ?probe=1 = เช็กสิทธิ์อย่างเดียว (เมนู ☰ ใช้ตัดสินว่าจะโชว์ทางเข้าไหม) — ไม่อ่านฐาน
      if (req.query?.probe === "1") return res.status(200).json({ ok: true });
      const [saved, months] = await Promise.all([
        loadValueCaseInputs(req.user.sub),
        loadValueCaseMonths(),
      ]);
      return res.status(200).json({ ...saved, months, currentYm: bangkokYm() });
    }
    if (method === "PUT") {
      const body = await readJsonBody(req);
      const updatedAt = await saveValueCaseInputs(req.user.sub, body);
      return res.status(200).json({ updatedAt });
    }
    return sendError(res, 405, "Method not allowed");
  } catch (e) {
    return handleApiError(res, e, "value-case", { userId: req.user?.sub });
  }
}

export default withAuth(handler);

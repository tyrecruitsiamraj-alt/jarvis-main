/**
 * GET /api/so-post-groups?from=YYYY-MM-DD&to=YYYY-MM-DD&bu=LBD&page=1
 * การ์ด "5. โพสต์ลงกลุ่ม Facebook" ในภาพรวมงานสรรหา (เจ้าของ 11 พ.ย. 2569) — ส่งต่อจาก So Scraping ด้วย key ฝั่ง server
 * สิทธิ์เดียวกับภาพรวม (`job-applications`) · from/to = วันที่ไทย รวมวันสุดท้าย · ไม่ส่ง bu = ทุก BU (เฉพาะคนที่เห็นทุก BU)
 * 🔴 BU ล็อกที่เซิร์ฟเวอร์ (QA 15 พ.ย. 2569 · ข้อเคาะ 10 พ.ย. "เห็นเฉพาะ BU ตัวเอง") — เดิมรับ bu จาก query ตรง ไม่ส่ง = ทุก BU
 *    เห็นหลาย BU แต่ไม่ได้เลือก = BU แรกในสิทธิ์ (หน้าสรุปเลือกทีละ BU) · ไม่มี BU = ไม่มีแถว
 * 🔴 16 พ.ย. 2569 เจ้าของ: Administrator เห็นแค่ SN 277 แถว ทั้งที่จอบอก "ทุก BU" (ทั้งหมด 1,701 · LBD 1,424)
 *    ต้นเหตุ: บัญชีที่มีสิทธิ์ครบทุก BU (BU หลัก + ดูเพิ่มครบ 5) ไม่ใช่ mode 'all' เลยถูกตัดเป็น BU แรก
 *    → สิทธิ์ครบทุก BU (`soPostBuOf`) ไม่เลือก = ไม่ส่ง bu (ทุก BU) · เลือกได้ทีละ BU · หลาย BU ไม่ครบ = BU แรกตามเดิม · BU เดียว = ล็อก
 *    ส่ง `meta` กลับ: bu ที่ส่งไป So Scraping จริง + ตัวเลือกของการ์ด — จอเขียนชื่อ BU จาก meta ไม่ใช่จากที่ขอ
 * `status=not_tried` (12 พ.ย. 2569 "กดแล้วดูเหตุได้ไหม") = เฉพาะสถานะนั้น + เหตุจัดกลุ่มนับ (อ่านทุกแถวของช่วงแล้วกรองฝั่งเรา)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { fetchAllSoPostGroupRows, fetchSoPostGroups, SoPostGroupsError } from '../_lib/soPostGroups.js';
import { filterSoPostGroups } from '../../src/lib/soPostGroups.js';
import { APP_DEPARTMENT_CODES, loadMatchingBuScope, type DepartmentScope } from '../_lib/departmentScope.js';
import { pickDashboardBuSet } from '../_lib/homeBuSql.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const BU = /^[A-Za-z0-9_-]{1,20}$/;
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

/**
 * BU ที่ส่งไป So Scraping + ตัวเลือกบนการ์ด
 * - `bu` null = ไม่ส่ง bu (ทุก BU) — เฉพาะคนที่สิทธิ์ครบทุก BU · `none` = ไม่มีสิทธิ์ BU ไหน (ไม่ดึง)
 * - `choices` = BU ที่เลือกได้ (null = ล็อก BU เดียว ไม่มีตัวเลือก) · `allowAll` = มีตัวเลือก "ทุก BU"
 */
export type SoPostBu = { bu: string | null; none: boolean; choices: string[] | null; allowAll: boolean };

export function soPostBuOf(scope: DepartmentScope, raw: string | null): SoPostBu {
  const all = scope.mode === 'all' || (scope.mode === 'code' && APP_DEPARTMENT_CODES.every((c) => scope.codes.includes(c)));
  if (all) {
    const asked = (raw ?? '').trim().toUpperCase();
    const choices = [...APP_DEPARTMENT_CODES];
    return { bu: choices.includes(asked as (typeof choices)[number]) ? asked : null, none: false, choices, allowAll: true };
  }
  const { bu, buSet, choices } = pickDashboardBuSet(scope, raw);
  if (buSet !== null && buSet.length === 0) return { bu: null, none: true, choices: null, allowAll: false };
  // pickDashboardBuSet ไม่คืน buSet null เมื่อ scope ไม่ใช่ 'all' — BU เดียว = ล็อก · หลาย BU ไม่เลือก = BU แรก
  return { bu: bu ?? buSet?.[0] ?? null, none: false, choices: choices && choices.length > 1 ? choices : null, allowAll: false };
}

export async function soPostGroupsHandler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  const from = String(one(req.query?.from) ?? '');
  const to = String(one(req.query?.to) ?? '');
  const buRaw = String(one(req.query?.bu) ?? '').trim();
  const page = Math.max(1, Number.parseInt(String(one(req.query?.page) ?? '1'), 10) || 1);
  if (!DAY.test(from) || !DAY.test(to)) return sendError(res, 400, 'bad_request', 'from และ to ต้องเป็น YYYY-MM-DD');
  if (buRaw && !BU.test(buRaw)) return sendError(res, 400, 'bad_request', 'bu ไม่ถูกต้อง');
  const status = String(one(req.query?.status) ?? '').trim();
  if (status && !/^[a-z_]{1,30}$/.test(status)) return sendError(res, 400, 'bad_request', 'status ไม่ถูกต้อง');
  try {
    const pick = soPostBuOf(await loadMatchingBuScope(req.user), buRaw || null);
    const meta = { bu: pick.bu, choices: pick.choices, allowAll: pick.allowAll };
    res.setHeader?.('Cache-Control', 'no-store');
    if (pick.none) return res.status(200).json({ ...filterSoPostGroups({ statuses: [], rows: [] }, { from, to, bu: null }, status, page), meta });
    const q = { from, to, bu: pick.bu };
    const body = status ? filterSoPostGroups(await fetchAllSoPostGroupRows(q), q, status, page) : await fetchSoPostGroups({ ...q, page });
    return res.status(200).json({ ...body, meta });
  } catch (e) {
    if (e instanceof SoPostGroupsError) return sendError(res, e.status, 'so_post_groups', e.message);
    return handleApiError(res, e, 'so-post-groups', { userId: req.user?.sub });
  }
}

export default withRbac(soPostGroupsHandler, 'job-applications');

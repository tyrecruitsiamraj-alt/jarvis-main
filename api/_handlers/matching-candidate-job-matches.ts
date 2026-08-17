/**
 * GET /api/matching/candidate-job-matches?cards=101,102 — "คนนี้แมทอยู่กี่งาน งานไหนบ้าง"
 *
 * ใช้ที่หน้า Matching: ป้าย "แมทอยู่ N งาน" บนรายชื่อผู้สมัคร + popup เลือกงาน
 * ตอนส่งโทรคนที่แมทหลายงาน (เจ้าของสั่ง 12 ส.ค. 2569)
 *
 * ตอบเป็น { items: { [cardId]: [{ jobId, requestNo, position, unit, tier }] } }
 * — เฉพาะใบขอที่**เปิดอยู่และอยู่ใน BU scope ของผู้ใช้** (นิยามเดียวกับลิสต์หน้า Matching)
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { listSiamrajUnitRequests } from '../_lib/siamrajUnitRequests.js';
import { loadMatchingBuScope } from '../_lib/departmentScope.js';
import { loadCandidateJobMatches } from '../_lib/candidateJobMatches.js';
import { jobPositionLabel } from '../_lib/lumosDispatch.js';

/** กันยิงถล่ม — หน้าเว็บส่งเป็นก้อนตามหน้าที่เห็น ไม่มีเหตุต้องถามทีละหลายร้อย */
const MAX_CARDS = 300;

function parseCards(raw: unknown): number[] {
  const s = typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw[0] ?? '') : '';
  const out: number[] = [];
  const seen = new Set<number>();
  for (const part of s.split(',')) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out.slice(0, MAX_CARDS);
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');
  try {
    const cards = parseCards(req.query?.cards);
    if (cards.length === 0) return sendError(res, 400, 'Bad request', 'ต้องระบุ cards เป็นเลข card_id คั่น ,');

    // ใบขอเปิด + scope BU — ท่อเดียวกับลิสต์หน้า Matching (คนเห็นลิสต์ไหนก็นับจากลิสต์นั้น)
    const departmentScope = await loadMatchingBuScope(req.user);
    const jobs = (await listSiamrajUnitRequests({ limit: 500, departmentScope })) as Array<
      Record<string, unknown>
    >;
    const jobById = new Map(jobs.map((j) => [String(j.id), j]));

    const matchMap = await loadCandidateJobMatches(cards, new Set(jobById.keys()));

    const items: Record<
      string,
      Array<{ jobId: string; requestNo: string | null; position: string; unit: string | null; tier: string }>
    > = {};
    for (const [cardId, matches] of matchMap) {
      items[String(cardId)] = matches.map((m) => {
        const job = jobById.get(m.jobId) ?? {};
        return {
          jobId: m.jobId,
          requestNo: typeof job.request_no === 'string' ? job.request_no : null,
          position: jobPositionLabel(job),
          unit: typeof job.unit_name === 'string' ? job.unit_name : null,
          tier: m.tier,
        };
      });
    }

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({ items });
  } catch (e) {
    return handleApiError(res, e, 'matching-candidate-job-matches', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'matching-proposals');

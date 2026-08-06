/**
 * ผลคัดกรองผู้สมัคร (เหล้า/บุหรี่ + ประวัติคดี) — ให้เกณฑ์เรียงผู้สมัครหน้า Matching ใช้
 *
 * GET  /api/matching/candidate-screening?source=board&refs=1,2,3  → { items: [...] }
 * POST /api/matching/candidate-screening  { source, candidateRef, drinking?, smoking?,
 *                                           criminalRecord?, criminalNote? }
 *
 * ข้อมูลนี้อ่อนไหว (ประวัติคดี) — RBAC ใช้ resource 'matching-proposals' เดียวกับ
 * ข้อมูลผู้สมัครรายคนอื่น ๆ ของหน้า Matching และบันทึก audit log ทุกครั้งที่มีการเขียน
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
import {
  getCandidateScreeningMap,
  upsertCandidateScreening,
  isScreeningSource,
  type ScreeningSource,
} from '../_lib/candidateScreening.js';

/** จำนวน ref ต่อรอบ — กันดูดข้อมูลผู้สมัครทั้งฐานด้วย query เดียว */
const MAX_REFS = 300;

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

function resolveSource(raw: string): ScreeningSource | null {
  const s = (raw || 'board').trim();
  return isScreeningSource(s) ? s : null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      const source = resolveSource(getQuery(req, 'source'));
      if (!source) return sendError(res, 400, 'Bad request', 'source ต้องเป็น board หรือ irecruit');

      const refs = getQuery(req, 'refs')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (refs.length === 0) return res.status(200).json({ items: [] });
      if (refs.length > MAX_REFS) {
        return sendError(res, 400, 'Bad request', `ขอได้ครั้งละไม่เกิน ${MAX_REFS} คน`);
      }

      const map = await getCandidateScreeningMap(source, refs);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ items: [...map.values()] });
    }

    if (method === 'POST') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');

      const source = resolveSource(typeof body.source === 'string' ? body.source : '');
      if (!source) return sendError(res, 400, 'Bad request', 'source ต้องเป็น board หรือ irecruit');

      const candidateRef = typeof body.candidateRef === 'string' ? body.candidateRef.trim() : '';
      if (!candidateRef) return sendError(res, 400, 'Bad request', 'ต้องระบุผู้สมัคร');

      const saved = await upsertCandidateScreening({
        source,
        candidateRef,
        candidateName: body.candidateName,
        drinking: body.drinking,
        smoking: body.smoking,
        criminalRecord: body.criminalRecord,
        criminalNote: body.criminalNote,
        userId: req.user?.sub ?? null,
        userName: req.user?.email ?? null,
      });

      // ประวัติคดีเป็นข้อมูลอ่อนไหว — ต้องรู้ว่าใครบันทึกอะไรเมื่อไหร่
      // เก็บแค่ธงว่ามีบันทึกคดีไหม ไม่เก็บตัวข้อความลง audit log
      void auditFromAuthed(req, {
        action: 'candidate-screening.upsert',
        entityType: 'candidate_screening',
        entityId: `${source}:${candidateRef}`,
        after: {
          drinking: saved.drinking,
          smoking: saved.smoking,
          criminalRecord: saved.criminalRecord,
          hasCriminalNote: !!saved.criminalNote,
        },
      });

      return res.status(200).json(saved);
    }

    res.setHeader?.('Allow', 'GET, POST');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/ต้องระบุ/.test(msg)) return sendError(res, 400, 'Bad request', msg);
    // โค้ดขึ้นก่อน migration รัน — บอกให้รู้เรื่องแทนปล่อย error ดิบของ Postgres ออกหน้าเว็บ
    if (isPgUndefinedTable(e)) {
      return sendError(
        res,
        503,
        'Service unavailable',
        'ยังไม่ได้สร้างตารางผลคัดกรอง — ตัว migration จะรันเองตอน deploy รอบถัดไป',
      );
    }
    return handleApiError(res, e, 'matching-candidate-screening', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'matching-proposals');

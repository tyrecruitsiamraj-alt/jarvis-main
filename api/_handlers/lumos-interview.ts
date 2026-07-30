/**
 * AI Interview — endpoints สำหรับ Lumos
 *
 * GET  /api/lumos/interview/candidates  →  ส่ง candidate list (สถานะ รอสัมภาษณ์) ให้ Lumos
 * POST /api/lumos/interview/results     →  รับผลลัพธ์การสัมภาษณ์จาก Lumos
 */
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { withLumosAuth } from '../_lib/lumos-auth.js';
import { readJsonBody } from '../_lib/body.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../_lib/http.js';
import { logInfo } from '../_lib/logger.js';
import { takePendingLumosItems, applyLumosResult } from '../_lib/lumosDispatch.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExperienceItem = {
  company?: string;
  position?: string;
  period?: string;
  responsibilities?: string;
  salary?: string;
  level?: string;
  business_type?: string;
};

type EducationItem = {
  institution?: string;
  degree?: string;
  faculty?: string;
  major?: string;
  details?: string;
  gpa?: string;
  year_ce?: number;
};

type CandidateForInterview = {
  client_candidate_id: string;
  client_interview_id: string;
  candidate_name: string;
  phone: string;
  position: string;
  scheduled_at: string;
  questions: string[];
  type?: 'phone' | 'online';
  language?: string;
  tone?: string;
  skills?: string[];
  experience?: ExperienceItem[];
  education?: EducationItem[];
};

type TranscriptItem = {
  role: 'agent' | 'candidate';
  text: string;
};

type InterviewResult = {
  interview_id: string;
  client_candidate_id: string;
  candidate_name: string;
  position: string;
  type: string;
  status: string;
  outcome: string;
  scheduled_at: string;
  phone: string | null;
  language: string;
  tone: string;
  questions: string[];
  ai_score: number | null;
  summary: string | null;
  strengths: string[] | null;
  concerns: string[] | null;
  score_rationale: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  failure_reason: string | null;
  transcript: TranscriptItem[];
  recording_url: string | null;
  call_attempts: number;
  ended_reason: string | null;
  duration_min: number | null;
};

type CandidateDbRow = {
  candidate_id: string;
  interview_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  staffing_track: string | null;
  interview_date: string | null;
  unit_name: string | null;
  job_type: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** แปลงเบอร์โทรไทยให้เป็น E.164 (+66...) */
function normalizeThaiPhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('66') && digits.length === 11) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+66${digits.slice(1)}`;
  return phone.trim();
}

/** date string (yyyy-mm-dd) → ISO 8601 ใช้เวลา 09:00 น. Bangkok */
function toScheduledAt(date: string | null): string {
  if (!date) return new Date().toISOString();
  const d = new Date(`${date}T09:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function toInterviewCandidate(row: CandidateDbRow): CandidateForInterview {
  const position =
    row.staffing_track?.trim() ||
    row.unit_name?.trim() ||
    row.job_type?.trim() ||
    'ไม่ระบุตำแหน่ง';

  return {
    client_candidate_id: row.candidate_id,
    // ถ้ามี candidate_interviews ที่ยังไม่เสร็จ ใช้ id นั้น; ไม่เช่นนั้น fallback เป็น candidate id
    client_interview_id: row.interview_id ?? row.candidate_id,
    candidate_name: `${row.first_name} ${row.last_name}`.trim(),
    phone: normalizeThaiPhone(row.phone),
    position,
    scheduled_at: toScheduledAt(row.interview_date),
    questions: [
      'กรุณาแนะนำตัวเองและเล่าประสบการณ์ทำงานที่ผ่านมาให้ฟังหน่อยครับ',
      `คาดหวังเงินเดือนสำหรับตำแหน่ง${position}เท่าไหร่ครับ`,
      'สามารถเริ่มงานได้เมื่อไหร่ครับ',
      'มีคำถามอยากถามเราบ้างไหมครับ',
    ],
    type: 'phone',
    language: 'th',
    tone: 'professional',
  };
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchWaitingInterviewCandidates(limit: number): Promise<CandidateForInterview[]> {
  const cTable  = tableInAppSchema('candidates');
  const ciTable = tableInAppSchema('candidate_interviews');
  const jaTable = tableInAppSchema('job_assignments');
  const jTable  = tableInAppSchema('jobs');

  const { rows } = await dbQuery<CandidateDbRow>(
    `SELECT
       c.id                          AS candidate_id,
       c.first_name,
       c.last_name,
       c.phone,
       c.staffing_track,
       ci.id                         AS interview_id,
       ci.interview_date::text        AS interview_date,
       j.unit_name,
       j.job_type
     FROM ${cTable} c
     /* นัดสัมภาษณ์ที่ใกล้สุดที่ยังไม่มีผล */
     LEFT JOIN LATERAL (
       SELECT id, interview_date
       FROM ${ciTable}
       WHERE candidate_id = c.id
         AND (result IS NULL OR result = 'pending')
       ORDER BY interview_date ASC
       LIMIT 1
     ) ci ON true
     /* งานล่าสุดที่ยังอยู่ในสถานะ active */
     LEFT JOIN LATERAL (
       SELECT job_id
       FROM ${jaTable}
       WHERE candidate_id = c.id
         AND status IN ('sent', 'passed', 'started')
       ORDER BY created_at DESC
       LIMIT 1
     ) ja ON true
     LEFT JOIN ${jTable} j ON j.id = ja.job_id
     WHERE c.status = 'waiting_interview'
     ORDER BY c.created_at DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map(toInterviewCandidate);
}

// ─── Validators ───────────────────────────────────────────────────────────────

const VALID_OUTCOMES = [
  'completed', 'declined', 'wrong_person',
  'unresponsive', 'no_answer', 'busy', 'failed',
] as const;

function isValidInterviewResult(v: unknown): v is InterviewResult {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.interview_id === 'string' && o.interview_id.trim() !== '' &&
    typeof o.client_candidate_id === 'string' && o.client_candidate_id.trim() !== '' &&
    typeof o.outcome === 'string' &&
    (VALID_OUTCOMES as readonly string[]).includes(o.outcome)
  );
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function getCandidates(req: ApiReq, res: ApiRes): Promise<void> {
  try {
    const rawLimit = typeof req.query?.limit === 'string' ? Number(req.query.limit) : NaN;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;

    // รวม 2 แหล่ง: (1) คิวจากการกดค้นหา iRecruit ในหน้า matching (เสิร์ฟครั้งเดียวต่อรายการ)
    //             (2) ผู้สมัครภายในสถานะรอสัมภาษณ์ (พฤติกรรมเดิม)
    const queueItems = (await takePendingLumosItems('interview', limit)) as CandidateForInterview[];
    const dbItems = await fetchWaitingInterviewCandidates(limit);
    const data = [...queueItems, ...dbItems];
    return res.status(200).json({ ok: true, data, total: data.length });
  } catch (e) {
    return handleApiError(res, e, 'lumos.interview.candidates');
  }
}

// ─── Persist helpers ──────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const lumosParams = (result: InterviewResult) => [
  result.interview_id,                                                      // lumos_interview_id
  result.outcome,                                                            // outcome
  result.ai_score ?? null,                                                   // ai_score
  result.summary ?? null,                                                    // summary
  result.strengths  ? JSON.stringify(result.strengths)  : null,             // strengths
  result.concerns   ? JSON.stringify(result.concerns)   : null,             // concerns
  result.score_rationale ?? null,                                            // score_rationale
  result.confidence ?? null,                                                 // confidence
  result.failure_reason ?? null,                                             // failure_reason
  result.transcript?.length ? JSON.stringify(result.transcript) : null,     // transcript
  result.recording_url ?? null,                                              // recording_url
  result.call_attempts ?? null,                                              // call_attempts
  result.ended_reason ?? null,                                               // ended_reason
  result.duration_min ?? null,                                               // duration_min
] as const;

/**
 * Persist 1 Lumos interview result:
 *  1. UPDATE the most-recent pending candidate_interviews row for this candidate,
 *     or INSERT a new row if none exists.
 *  2. UPDATE candidates.status = 'interviewed' when outcome = 'completed'.
 */
async function persistInterviewResult(result: InterviewResult): Promise<void> {
  const ciTable = tableInAppSchema('candidate_interviews');
  const cTable  = tableInAppSchema('candidates');

  const isCompleted = result.outcome === 'completed';
  const attended    = isCompleted;
  // Human decides pass/fail after reviewing Lumos summary; keep 'pending' until then
  const ciResult    = isCompleted ? 'pending' : null;

  if (!UUID_RE.test(result.client_candidate_id)) return;

  // ── 1. candidate_interviews ────────────────────────────────────────────────
  // Find the oldest pending interview for this candidate and update it.
  // Uses a subquery so PostgreSQL can use the index on (candidate_id, interview_date).
  const { rows: updated } = await dbQuery<{ id: string }>(
    `UPDATE ${ciTable}
        SET attended           = $1,
            result             = $2,
            notes              = COALESCE($3, notes),
            lumos_interview_id = $4,
            outcome            = $5,
            ai_score           = $6,
            summary            = $7,
            strengths          = $8,
            concerns           = $9,
            score_rationale    = $10,
            confidence         = $11,
            failure_reason     = $12,
            transcript         = $13,
            recording_url      = $14,
            call_attempts      = $15,
            ended_reason       = $16,
            duration_min       = $17
      WHERE id = (
        SELECT id FROM ${ciTable}
        WHERE candidate_id = $18
          AND (result IS NULL OR result = 'pending')
        ORDER BY interview_date ASC
        LIMIT 1
      )
      RETURNING id`,
    [
      attended,
      ciResult,
      result.summary ?? null,
      ...lumosParams(result),
      result.client_candidate_id,  // $18
    ],
  );

  // No pending row found → insert a new record to preserve the history
  if (updated.length === 0) {
    await dbQuery(
      `INSERT INTO ${ciTable}
         (candidate_id, interview_date, location, client_name, attended, result,
          notes, lumos_interview_id, outcome, ai_score, summary, strengths, concerns,
          score_rationale, confidence, failure_reason, transcript, recording_url,
          call_attempts, ended_reason, duration_min)
       VALUES
         ($1, CURRENT_DATE, '', '', $2, $3,
          $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18)`,
      [
        result.client_candidate_id,  // $1
        attended,                    // $2
        ciResult,                    // $3
        result.summary ?? null,      // $4  (notes)
        ...lumosParams(result),      // $5–$18
      ],
    );
  }

  // ── 2. candidates.status ───────────────────────────────────────────────────
  // Only mark 'interviewed' on completed calls; unreachable candidates stay 'waiting_interview'
  if (isCompleted) {
    await dbQuery(
      `UPDATE ${cTable}
          SET status = 'interviewed'
        WHERE id = $1
          AND status = 'waiting_interview'`,
      [result.client_candidate_id],
    );
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function postInterviewResults(req: ApiReq, res: ApiRes): Promise<void> {
  try {
    const raw = await readJsonBody(req);
    const results: unknown[] = Array.isArray(raw) ? raw : raw != null ? [raw] : [];

    if (results.length === 0) {
      return sendError(res, 400, 'Bad Request', 'Body must be a non-empty array of interview results');
    }

    for (const [i, item] of results.entries()) {
      if (!isValidInterviewResult(item)) {
        return sendError(
          res, 400, 'Bad Request',
          `Item[${i}] is invalid — required: interview_id (string), client_candidate_id (string), outcome (one of: ${VALID_OUTCOMES.join(', ')})`,
        );
      }
    }

    logInfo('lumos.interview.results', {
      count: results.length,
      interview_ids: results.map((r) => (r as InterviewResult).interview_id),
    });

    const settled = await Promise.allSettled(
      (results as InterviewResult[]).map((r) => persistInterviewResult(r)),
    );
    const failed = settled.filter((s) => s.status === 'rejected').length;

    // ผลของคนจากคิว iRecruit (id รูปแบบ jobId::ir-N — ไม่ใช่ UUID) → ผูกกลับเข้าคิว dispatch
    for (const r of results as InterviewResult[]) {
      if (!r.client_candidate_id.includes('::ir-')) continue;
      const queueStatus =
        r.outcome === 'completed' ? 'completed' : r.status === 'ยกเลิก' ? 'cancelled' : 'failed';
      await applyLumosResult('interview', r.client_candidate_id, queueStatus, r).catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      received: results.length,
      persisted: results.length - failed,
      failed,
      message: failed === 0
        ? 'Interview results accepted and saved'
        : `Accepted ${results.length - failed}/${results.length} — ${failed} failed to save`,
    });
  } catch (e) {
    return handleApiError(res, e, 'lumos.interview.results');
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const lumosInterviewCandidatesHandler = withLumosAuth(getCandidates);
export const lumosInterviewResultsHandler = withLumosAuth(postInterviewResults);

/**
 * AI Interview — endpoints สำหรับ Lumos
 *
 * GET  /api/lumos/interview/candidates  →  ส่ง candidate list ให้ Lumos ไปสัมภาษณ์
 * POST /api/lumos/interview/results     →  รับผลลัพธ์การสัมภาษณ์จาก Lumos
 */
import { withLumosAuth } from '../_lib/lumos-auth.js';
import { readJsonBody } from '../_lib/body.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../_lib/http.js';
import { logInfo } from '../_lib/logger.js';

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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CANDIDATES: CandidateForInterview[] = [
  {
    client_candidate_id: 'cli-cand-8821',
    client_interview_id: 'cli-int-0042',
    candidate_name: 'สมชาย ใจดี',
    phone: '+66812345678',
    position: 'Senior Backend Engineer',
    scheduled_at: '2026-07-10T10:00:00+07:00',
    questions: [
      'เล่าประสบการณ์การทำงานกับ Python ให้ฟังหน่อยครับ',
      'คาดหวังเงินเดือนเท่าไหร่ครับ',
      'ทำไมถึงอยากร่วมงานกับบริษัทเราครับ',
    ],
    type: 'phone',
    language: 'th',
    tone: 'professional',
    skills: ['Python', 'FastAPI', 'PostgreSQL'],
    experience: [
      {
        company: 'Acme Corp',
        position: 'Backend Engineer',
        period: '2022-2025',
        responsibilities: 'Built and maintained payment services',
        salary: '60000',
        level: 'Senior',
        business_type: 'Fintech',
      },
    ],
    education: [
      {
        institution: 'Chulalongkorn University',
        degree: "Bachelor's",
        faculty: 'Engineering',
        major: 'Computer Engineering',
        gpa: '3.5',
        year_ce: 2020,
      },
    ],
  },
  {
    client_candidate_id: 'cli-cand-9034',
    client_interview_id: 'cli-int-0043',
    candidate_name: 'วิภาวี รักงาน',
    phone: '+66891234567',
    position: 'HR Coordinator',
    scheduled_at: '2026-07-10T14:00:00+07:00',
    questions: [
      'เล่าประสบการณ์ด้าน HR ให้ฟังหน่อยค่ะ',
      'คาดหวังเงินเดือนเท่าไหร่คะ',
      'สามารถเริ่มงานได้เมื่อไหร่คะ',
    ],
    type: 'phone',
    language: 'th',
    tone: 'friendly',
    skills: ['HR Management', 'Recruitment', 'Payroll'],
    experience: [
      {
        company: 'HR Solutions Co.',
        position: 'HR Officer',
        period: '2021-2024',
        responsibilities: 'Recruitment and employee relations',
        salary: '35000',
        level: 'Junior',
        business_type: 'HR Consulting',
      },
    ],
    education: [
      {
        institution: 'Thammasat University',
        degree: "Bachelor's",
        faculty: 'Commerce and Accountancy',
        major: 'Human Resource Management',
        gpa: '3.2',
        year_ce: 2021,
      },
    ],
  },
];

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

async function getCandidates(_req: ApiReq, res: ApiRes): Promise<void> {
  // TODO: replace mock with real DB query
  // const rows = await dbQuery(`SELECT ... FROM ${tableInAppSchema('candidate_interviews')} WHERE status = 'waiting_interview'`);
  return res.status(200).json({
    ok: true,
    data: MOCK_CANDIDATES,
    total: MOCK_CANDIDATES.length,
  });
}

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

    // TODO: persist to DB
    // await dbQuery(`INSERT INTO ${tableInAppSchema('candidate_interviews')} (...) VALUES (...)`)

    return res.status(200).json({
      ok: true,
      received: results.length,
      message: 'Interview results accepted',
    });
  } catch (e) {
    return handleApiError(res, e, 'lumos.interview.results');
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const lumosInterviewCandidatesHandler = withLumosAuth(getCandidates);
export const lumosInterviewResultsHandler = withLumosAuth(postInterviewResults);

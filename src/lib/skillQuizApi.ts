import { apiFetch } from './apiFetch';
import type { PublicQuizQuestion, QuizAnalysis, QuizAnswers, QuizAttemptStatus, QuizSetContent, QuizTextScore } from './skillQuiz';

/** แบบทดสอบพนักงาน (12 พ.ย. 2569) — พังโยนข้อความไทยจาก server */
async function readError(r: Response): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  throw new Error(data.message || `ระบบตอบ ${r.status}`);
}

export type QuizSetItem = { id: string; content: QuizSetContent; created_by_name: string | null; created_at: string; updated_at: string; attempts: number };

export type QuizAttemptItem = {
  id: string;
  token: string;
  doc_no: string;
  person_name: string;
  person_role: string;
  title: string;
  status: QuizAttemptStatus;
  score: number | null;
  grade: string | null;
  created_at: string;
  opened_at: string | null;
  submitted_at: string | null;
};

export type QuizAttemptDetail = {
  id: string;
  token: string;
  doc_no: string;
  person_name: string;
  person_role: string;
  content: QuizSetContent;
  answers: QuizAnswers | null;
  text_scores: Record<string, QuizTextScore>;
  analysis: QuizAnalysis | null;
  analysis_by: 'ai' | 'staff' | null;
  ai_error: string | null;
  created_at: string;
  opened_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
};

export function quizLinkUrl(token: string): string {
  return `${window.location.origin}/quiz/${token}`;
}

export async function fetchQuizSets(): Promise<QuizSetItem[]> {
  const r = await apiFetch('/api/skill-quiz?view=sets');
  if (!r.ok) return readError(r);
  return ((await r.json()) as { sets: QuizSetItem[] }).sets;
}

export async function fetchQuizAttempts(): Promise<QuizAttemptItem[]> {
  const r = await apiFetch('/api/skill-quiz');
  if (!r.ok) return readError(r);
  return ((await r.json()) as { attempts: QuizAttemptItem[] }).attempts;
}

export async function fetchQuizAttempt(id: string): Promise<QuizAttemptDetail> {
  const r = await apiFetch(`/api/skill-quiz?id=${encodeURIComponent(id)}`);
  if (!r.ok) return readError(r);
  return ((await r.json()) as { attempt: QuizAttemptDetail }).attempt;
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const r = await apiFetch('/api/skill-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) return readError(r);
  return (await r.json()) as T;
}

export const saveQuizSet = (id: string | null, content: QuizSetContent) => post<{ id: string }>(id ? { action: 'update_set', id, content } : { action: 'create_set', content });
export const archiveQuizSet = (id: string) => post<{ ok: true }>({ action: 'archive_set', id });
export const createQuizLink = (setId: string, personName: string, personRole: string) =>
  post<{ id: string; token: string; doc_no: string }>({ action: 'create_link', setId, personName, personRole });
export const saveQuizReview = (id: string, v: { textScores: Record<string, number | null>; analysis: QuizAnalysis; reviewed: boolean }) =>
  post<{ attempt: QuizAttemptDetail }>({ action: 'save_review', id, ...v }).then((d) => d.attempt);
export const draftQuizWithAi = (id: string) => post<{ attempt: QuizAttemptDetail }>({ action: 'ai_draft', id }).then((d) => d.attempt);
export const archiveQuizAttempt = (id: string) => post<{ ok: true }>({ action: 'archive_attempt', id });

/** หน้าพนักงาน — ไม่ต้องล็อกอิน */
export type PublicQuiz = { title: string; personName: string; personRole: string; submitted: boolean; questions: PublicQuizQuestion[] };

export async function fetchPublicQuiz(token: string): Promise<PublicQuiz> {
  const r = await fetch(`/api/public/skill-quiz?token=${encodeURIComponent(token)}`);
  if (!r.ok) return readError(r);
  return (await r.json()) as PublicQuiz;
}

export async function submitPublicQuiz(token: string, answers: QuizAnswers): Promise<void> {
  const r = await fetch('/api/public/skill-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, answers }) });
  if (!r.ok) return readError(r);
}

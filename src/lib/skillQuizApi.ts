import { apiFetch } from './apiFetch';
import type { PublicQuizQuestion, QuizAnalysis, QuizAnswers, QuizAttemptStatus, QuizSetContent } from './skillQuiz';
import type { QuizViewerMode } from './skillQuizTaker';

/** แบบทดสอบพนักงาน (12 พ.ย. 2569) — พังโยนข้อความไทยจาก server */
async function readError(r: Response): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  throw new Error(data.message || `ระบบตอบ ${r.status}`);
}

export type QuizSetItem = {
  id: string;
  content: QuizSetContent;
  created_by_name: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  attempts: number;
  public_token: string | null;
  viewer_bus: string[];
  viewer_user_ids: string[];
};

/** ข้อมูลที่คนทำกรอกเอง (ลิงก์ของชุด · 16 พ.ย. 2569) — ลิงก์ละคนแบบเก่าเป็น null · เลขบัตรมาแบบปิดท้ายเท่านั้น */
export type QuizTakerInfo = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  age: number | null;
  birth_date: string | null;
  citizen_id_masked: string | null;
  consented_at: string | null;
};

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
} & QuizTakerInfo;

export type QuizAttemptDetail = {
  id: string;
  token: string;
  doc_no: string;
  person_name: string;
  person_role: string;
  content: QuizSetContent;
  answers: QuizAnswers | null;
  analysis: QuizAnalysis | null;
  analysis_by: 'ai' | 'staff' | null;
  ai_error: string | null;
  created_at: string;
  opened_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
} & QuizTakerInfo;

/** ลิงก์เดียวของชุด — ส่งให้ทุกคนที่ต้องทำ */
export function quizSetLinkUrl(token: string): string {
  return `${window.location.origin}/quiz/s/${token}`;
}

export type QuizPerson = { id: string; name: string; bu: string | null };

export async function fetchQuizPeople(): Promise<{ people: QuizPerson[]; bus: string[]; myId: string }> {
  const r = await apiFetch('/api/skill-quiz?view=people');
  if (!r.ok) return readError(r);
  return (await r.json()) as { people: QuizPerson[]; bus: string[]; myId: string };
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

/** ลิงก์ตัวรูปของคำถาม/ตัวเลือก — ใช้ทั้งจอเจ้าหน้าที่และหน้าคนทำ (ไม่ต้องล็อกอิน) */
export const quizImageUrl = (id: string) => `/api/public/skill-quiz?image=${encodeURIComponent(id)}`;

const QUIZ_IMAGE_SIDE = 1280;

/** ย่อรูปในเครื่องให้ด้านยาวไม่เกิน 1280 px เป็น JPEG ก่อนส่ง — รูปจากมือถือ 5 MB เหลือราว 200 KB */
async function shrinkQuizImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('เลือกไฟล์รูปเท่านั้น');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('เปิดรูปนี้ไม่ได้ ลองรูป JPG หรือ PNG');
  });
  const scale = Math.min(1, QUIZ_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เปิดรูปนี้ไม่ได้');
  // รูปพื้นโปร่ง (PNG) ให้พื้นขาว ไม่กลายเป็นดำตอนแปลงเป็น JPEG
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function uploadQuizImage(file: File): Promise<string> {
  const data = await shrinkQuizImage(file);
  return (await post<{ id: string }>({ action: 'upload_image', data })).id;
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const r = await apiFetch('/api/skill-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) return readError(r);
  return (await r.json()) as T;
}

export type QuizViewersInput = { mode: QuizViewerMode; bus: string[]; userIds: string[] };
export const saveQuizSet = (id: string | null, content: QuizSetContent, viewers: QuizViewersInput) =>
  post<{ id: string }>(id ? { action: 'update_set', id, content, viewers } : { action: 'create_set', content, viewers });
export const archiveQuizSet = (id: string) => post<{ ok: true }>({ action: 'archive_set', id });
export const saveQuizReview = (id: string, v: { analysis: QuizAnalysis; reviewed: boolean }) =>
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

/** หน้าแรกของลิงก์ชุด — ชื่อชุดกับจำนวนข้อ (ข้อสอบยังไม่ส่งจนกว่าจะกรอกข้อมูล) */
export type PublicQuizSet = { title: string; roleLabel: string; questionCount: number };

export async function fetchPublicQuizSet(setToken: string): Promise<PublicQuizSet> {
  const r = await fetch(`/api/public/skill-quiz?set=${encodeURIComponent(setToken)}`);
  if (!r.ok) return readError(r);
  return (await r.json()) as PublicQuizSet;
}

async function publicPost(body: Record<string, unknown>): Promise<string> {
  const r = await fetch('/api/public/skill-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) return readError(r);
  return ((await r.json()) as { token: string }).token;
}

export type QuizTakerForm = { firstName: string; lastName: string; phone: string; age: string; citizenId: string; birthDate: string };

export const startPublicQuiz = (setToken: string, f: QuizTakerForm, consent: boolean) =>
  publicPost({ action: 'start', set: setToken, ...f, age: Number(f.age), consent });
export const resumePublicQuiz = (setToken: string, citizenId: string, birthDate: string) => publicPost({ action: 'resume', set: setToken, citizenId, birthDate });

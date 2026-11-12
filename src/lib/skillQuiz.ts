/**
 * ═══ แบบทดสอบพนักงาน + รายงานผลส่งลูกค้า (เจ้าของสั่ง 12 พ.ย. 2569) ═══
 *
 * > *"เพิ่ม Function สำหรับ quiz … เพิ่มข้อสอบ และ ให้ทำ พอทำจบก็สรุปคะแนน พร้อมกับออกเอกสาร … เอา Ai วิเคราะห์ …
 * > เจ้าหน้าที่เราจะโยน link ให้พนักงานมาทำ แล้วเราจะโหลดสรุปแบบรูปส่งลูกค้า"*
 * Choice: อยู่ใน Jarvis เมนูใหม่ · ลิงก์ละคน · ชนิดข้อแล้วแต่คนสร้าง (ปรนัย/เขียนตอบ) · AI ร่างบทวิเคราะห์แล้วเจ้าหน้าที่แก้ได้
 *
 * ไฟล์นี้ pure ใช้ร่วมกันทั้งจอ/API/เทสต์ — ตัวตัดสินคะแนน เกรด สถานะ มีที่นี่ที่เดียว
 *   คะแนนรายทักษะ = คะแนนที่ได้ ÷ คะแนนเต็มของข้อในทักษะนั้น × 100 (ปัดเศษ)
 *   คะแนนรวม = คะแนนที่ได้ทั้งชุด ÷ คะแนนเต็มทั้งชุด × 100 → ทักษะที่มีข้อมาก/คะแนนต่อข้อสูงมีน้ำหนักมากกว่าเอง
 *   ผ่านเกณฑ์ = คะแนนรายทักษะ ≥ เกณฑ์ของชุด · เขียนตอบที่ยังไม่ให้คะแนน = ผลยังไม่ครบ (null) ห้ามนับเป็น 0
 */

export type QuizQuestionKind = 'choice' | 'text';

export type QuizSkill = { id: string; name: string };

export type QuizQuestion = {
  id: string;
  skillId: string;
  kind: QuizQuestionKind;
  prompt: string;
  /** ปรนัยเท่านั้น */
  choices: string[];
  /** ปรนัย: ลำดับคำตอบที่ถูก · เขียนตอบ: null */
  answer: number | null;
  points: number;
  /** เขียนตอบ: แนวคำตอบที่ถูก ให้ AI/เจ้าหน้าที่ใช้ให้คะแนน */
  guide: string;
};

export type QuizSetContent = {
  title: string;
  roleLabel: string;
  headerLine: string;
  passScore: number;
  skills: QuizSkill[];
  questions: QuizQuestion[];
};

export type QuizAnalysis = { strengths: string; gap: string; advice: string };

/** คะแนนเขียนตอบ (ข้อละค่า) — `by` บอกว่าใครให้ล่าสุด */
export type QuizTextScore = { score: number; reason: string; by: 'ai' | 'staff' };

export type QuizAnswers = Record<string, number | string>;

export const QUIZ_DEFAULT_HEADER = 'SO PEOPLE | TECHNICAL SKILL HEALTH CHECK';
export const QUIZ_DEFAULT_PASS = 70;
export const QUIZ_MAX_QUESTIONS = 200;
export const QUIZ_MAX_CHOICES = 8;
export const QUIZ_TEXT_ANSWER_MAX = 2000;

export const QUIZ_KIND_LABEL: Record<QuizQuestionKind, string> = { choice: 'ปรนัย', text: 'เขียนตอบ' };

/** เกรดจากคะแนนรวม (A ≥ 85 · B ≥ 70 · C ≥ 60 · D ต่ำกว่า) */
export function quizGrade(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

/** สีแท่งรายทักษะ — สีที่มีความหมาย: ดีมาก = เขียว · ผ่าน = ฟ้า · ไม่ผ่าน = แดง */
export function quizSkillTone(score: number, passScore: number): 'success' | 'info' | 'danger' {
  if (score < passScore) return 'danger';
  if (score >= 85) return 'success';
  return 'info';
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** ตรวจชุดข้อสอบที่ส่งมาจากหน้าจอ — ผิดตรงไหนบอกเป็นคำ */
export function parseQuizSetInput(raw: unknown): { ok: true; value: QuizSetContent } | { ok: false; message: string } {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const title = clean(o.title, 200);
  if (!title) return { ok: false, message: 'ใส่ชื่อชุดข้อสอบ' };
  const passScore = Math.round(Number(o.passScore ?? QUIZ_DEFAULT_PASS));
  if (!Number.isFinite(passScore) || passScore < 1 || passScore > 100) return { ok: false, message: 'เกณฑ์ผ่านต้องอยู่ระหว่าง 1–100' };
  const skillsRaw = Array.isArray(o.skills) ? o.skills : [];
  const skills: QuizSkill[] = [];
  for (const s of skillsRaw) {
    const r = (s ?? {}) as Record<string, unknown>;
    const id = clean(r.id, 40);
    const name = clean(r.name, 120);
    if (!id || !name) return { ok: false, message: 'ทักษะทุกช่องต้องมีชื่อ' };
    if (skills.some((x) => x.id === id)) return { ok: false, message: 'รหัสทักษะซ้ำ' };
    skills.push({ id, name });
  }
  if (skills.length === 0) return { ok: false, message: 'เพิ่มทักษะอย่างน้อย 1 ข้อ' };
  const qRaw = Array.isArray(o.questions) ? o.questions : [];
  if (qRaw.length === 0) return { ok: false, message: 'เพิ่มข้ออย่างน้อย 1 ข้อ' };
  if (qRaw.length > QUIZ_MAX_QUESTIONS) return { ok: false, message: `ชุดหนึ่งได้ไม่เกิน ${QUIZ_MAX_QUESTIONS} ข้อ` };
  const questions: QuizQuestion[] = [];
  for (const [i, q] of qRaw.entries()) {
    const r = (q ?? {}) as Record<string, unknown>;
    const n = i + 1;
    const id = clean(r.id, 40);
    if (!id || questions.some((x) => x.id === id)) return { ok: false, message: `ข้อ ${n}: รหัสข้อซ้ำ` };
    const skillId = clean(r.skillId, 40);
    if (!skills.some((s) => s.id === skillId)) return { ok: false, message: `ข้อ ${n}: เลือกทักษะ` };
    const kind: QuizQuestionKind = r.kind === 'text' ? 'text' : 'choice';
    const prompt = clean(r.prompt, 2000);
    if (!prompt) return { ok: false, message: `ข้อ ${n}: ใส่คำถาม` };
    const points = Math.round(Number(r.points ?? 1));
    if (!Number.isFinite(points) || points < 1 || points > 100) return { ok: false, message: `ข้อ ${n}: คะแนนต้องอยู่ระหว่าง 1–100` };
    if (kind === 'choice') {
      const choices = (Array.isArray(r.choices) ? r.choices : []).map((c) => clean(c, 500));
      if (choices.length < 2 || choices.some((c) => !c)) return { ok: false, message: `ข้อ ${n}: ตัวเลือกต้องมีอย่างน้อย 2 ข้อ และไม่ว่าง` };
      if (choices.length > QUIZ_MAX_CHOICES) return { ok: false, message: `ข้อ ${n}: ตัวเลือกได้ไม่เกิน ${QUIZ_MAX_CHOICES} ข้อ` };
      const answer = Number(r.answer);
      if (!Number.isInteger(answer) || answer < 0 || answer >= choices.length) return { ok: false, message: `ข้อ ${n}: เลือกคำตอบที่ถูก` };
      questions.push({ id, skillId, kind, prompt, choices, answer, points, guide: '' });
    } else {
      questions.push({ id, skillId, kind, prompt, choices: [], answer: null, points, guide: clean(r.guide, 2000) });
    }
  }
  const unused = skills.find((s) => !questions.some((q) => q.skillId === s.id));
  if (unused) return { ok: false, message: `ทักษะ "${unused.name}" ยังไม่มีข้อ` };
  return {
    ok: true,
    value: { title, roleLabel: clean(o.roleLabel, 200), headerLine: clean(o.headerLine, 120) || QUIZ_DEFAULT_HEADER, passScore, skills, questions },
  };
}

/** ข้อสอบที่ส่งให้พนักงาน — ตัดเฉลยและแนวคำตอบออก */
export type PublicQuizQuestion = Pick<QuizQuestion, 'id' | 'kind' | 'prompt' | 'choices' | 'points'>;
export function publicQuestions(content: QuizSetContent): PublicQuizQuestion[] {
  return content.questions.map((q) => ({ id: q.id, kind: q.kind, prompt: q.prompt, choices: q.choices, points: q.points }));
}

/** คำตอบที่พนักงานส่ง — ต้องตอบครบทุกข้อ */
export function parseQuizAnswers(content: QuizSetContent, raw: unknown): { ok: true; value: QuizAnswers } | { ok: false; message: string } {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: QuizAnswers = {};
  for (const [i, q] of content.questions.entries()) {
    const v = o[q.id];
    if (q.kind === 'choice') {
      const n = Number(v);
      if (v === null || v === undefined || v === '' || !Number.isInteger(n) || n < 0 || n >= q.choices.length) return { ok: false, message: `ยังไม่ได้ตอบข้อ ${i + 1}` };
      out[q.id] = n;
    } else {
      const t = clean(v, QUIZ_TEXT_ANSWER_MAX);
      if (!t) return { ok: false, message: `ยังไม่ได้ตอบข้อ ${i + 1}` };
      out[q.id] = t;
    }
  }
  return { ok: true, value: out };
}

export type QuizSkillResult = { skillId: string; name: string; earned: number; full: number; score: number | null; passed: boolean | null };
export type QuizResult = {
  skills: QuizSkillResult[];
  earned: number;
  full: number;
  /** null = ยังมีเขียนตอบที่ยังไม่ให้คะแนน */
  score: number | null;
  grade: 'A' | 'B' | 'C' | 'D' | null;
  passedSkills: number | null;
  pendingText: number;
};

/** คะแนนที่ได้ต่อข้อ — null = เขียนตอบที่ยังไม่มีคะแนน */
export function questionEarned(q: QuizQuestion, answers: QuizAnswers, textScores: Record<string, QuizTextScore>): number | null {
  if (q.kind === 'choice') return answers[q.id] === q.answer ? q.points : 0;
  const s = textScores[q.id];
  if (!s) return null;
  return Math.max(0, Math.min(q.points, Math.round(s.score)));
}

export function scoreQuiz(content: QuizSetContent, answers: QuizAnswers, textScores: Record<string, QuizTextScore>): QuizResult {
  let pendingText = 0;
  const skills = content.skills.map((s) => {
    let earned = 0;
    let full = 0;
    let pending = false;
    for (const q of content.questions) {
      if (q.skillId !== s.id) continue;
      full += q.points;
      const e = questionEarned(q, answers, textScores);
      if (e === null) {
        pending = true;
        pendingText += 1;
      } else earned += e;
    }
    const score = pending || full === 0 ? null : Math.round((earned / full) * 100);
    return { skillId: s.id, name: s.name, earned, full, score, passed: score === null ? null : score >= content.passScore };
  });
  const earned = skills.reduce((a, s) => a + s.earned, 0);
  const full = skills.reduce((a, s) => a + s.full, 0);
  const score = pendingText > 0 || full === 0 ? null : Math.round((earned / full) * 100);
  return {
    skills,
    earned,
    full,
    score,
    grade: score === null ? null : quizGrade(score),
    passedSkills: pendingText > 0 ? null : skills.filter((s) => s.passed).length,
    pendingText,
  };
}

export type QuizAttemptStatus = 'waiting' | 'review' | 'ready';
export const QUIZ_STATUS_LABEL: Record<QuizAttemptStatus, string> = { waiting: 'ยังไม่ทำ', review: 'รอตรวจ', ready: 'พร้อมส่ง' };
export function quizAttemptStatus(a: { submitted_at: string | null; reviewed_at: string | null }): QuizAttemptStatus {
  if (!a.submitted_at) return 'waiting';
  return a.reviewed_at ? 'ready' : 'review';
}

/** เลขที่เอกสาร SO-TECH-00125 */
export function quizDocNo(seq: number): string {
  return `SO-TECH-${String(seq).padStart(5, '0')}`;
}

/** ข้อความให้ AI — ไม่มีชื่อพนักงาน (ข้อมูลออกไปนอกเครื่องได้ถ้าตั้งเป็นเจ้าภายนอก) */
export function buildQuizAiPrompt(content: QuizSetContent, answers: QuizAnswers): string {
  const skillName = (id: string) => content.skills.find((s) => s.id === id)?.name ?? '';
  const textQs = content.questions.filter((q) => q.kind === 'text');
  const lines: string[] = [];
  lines.push(`แบบทดสอบ: ${content.title}${content.roleLabel ? ` (ตำแหน่ง ${content.roleLabel})` : ''} · เกณฑ์ผ่านรายทักษะ ${content.passScore} คะแนน`);
  lines.push('คะแนนปรนัยรายทักษะ (เต็ม 100 · ไม่รวมข้อเขียนตอบ):');
  for (const s of content.skills) {
    const qs = content.questions.filter((q) => q.skillId === s.id && q.kind === 'choice');
    if (qs.length === 0) continue;
    const full = qs.reduce((a, q) => a + q.points, 0);
    const got = qs.reduce((a, q) => a + (answers[q.id] === q.answer ? q.points : 0), 0);
    lines.push(`- ${s.name}: ${Math.round((got / full) * 100)}`);
  }
  const wrong = content.questions.filter((q) => q.kind === 'choice' && answers[q.id] !== q.answer);
  if (wrong.length > 0) {
    lines.push('ข้อปรนัยที่ตอบผิด:');
    for (const q of wrong.slice(0, 40)) lines.push(`- [${skillName(q.skillId)}] ${q.prompt} · ตอบ "${q.choices[Number(answers[q.id])] ?? ''}" · ที่ถูกคือ "${q.choices[q.answer ?? -1] ?? ''}"`);
  }
  if (textQs.length > 0) {
    lines.push('ข้อเขียนตอบที่ต้องให้คะแนน:');
    for (const q of textQs) {
      lines.push(`- id=${q.id} · [${skillName(q.skillId)}] เต็ม ${q.points} · คำถาม: ${q.prompt}`);
      if (q.guide) lines.push(`  แนวคำตอบ: ${q.guide}`);
      lines.push(`  คำตอบพนักงาน: ${String(answers[q.id] ?? '')}`);
    }
  }
  lines.push('');
  lines.push('ตอบเป็น JSON เท่านั้น รูปแบบ:');
  lines.push('{"textScores":{"<id>":{"score":<จำนวนเต็ม 0 ถึงคะแนนเต็ม>,"reason":"<เหตุผลสั้น>"}},"strengths":"<จุดแข็ง 1-2 ประโยค>","gap":"<ทักษะที่ต้องพัฒนา บอกคะแนนและสิ่งที่ควรฝึก 1-2 ประโยค>","advice":"<ข้อเสนอแนะต่อการมอบหมายงาน 1-2 ประโยค>"}');
  lines.push('เขียนภาษาไทยแบบคนพูด อ้างตัวเลขจริง ห้ามแต่งข้อมูลที่ไม่มีในนี้ ไม่มีจุดอ่อนให้เขียน gap ว่า "ไม่มีทักษะที่ต่ำกว่าเกณฑ์"');
  return lines.join('\n');
}

/** อ่านคำตอบ AI — ข้อที่อ่านไม่ได้ข้าม (ไม่เดาคะแนน) */
export function parseQuizAiReply(content: QuizSetContent, raw: string): { textScores: Record<string, QuizTextScore>; analysis: QuizAnalysis } | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const textScores: Record<string, QuizTextScore> = {};
  const ts = (o.textScores && typeof o.textScores === 'object' ? o.textScores : {}) as Record<string, unknown>;
  for (const q of content.questions) {
    if (q.kind !== 'text') continue;
    const r = ts[q.id] as Record<string, unknown> | undefined;
    const n = Number(r?.score);
    if (!r || !Number.isFinite(n)) continue;
    textScores[q.id] = { score: Math.max(0, Math.min(q.points, Math.round(n))), reason: clean(r.reason, 500), by: 'ai' };
  }
  const analysis = { strengths: clean(o.strengths, 1000), gap: clean(o.gap, 1000), advice: clean(o.advice, 1000) };
  if (!analysis.strengths && !analysis.gap && !analysis.advice && Object.keys(textScores).length === 0) return null;
  return { textScores, analysis };
}

export function parseQuizAnalysis(raw: unknown): QuizAnalysis {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { strengths: clean(o.strengths, 1000), gap: clean(o.gap, 1000), advice: clean(o.advice, 1000) };
}

/** คะแนนเขียนตอบที่เจ้าหน้าที่แก้ — เฉพาะข้อเขียนตอบ · เกินเต็มไม่ได้ */
export function parseStaffTextScores(content: QuizSetContent, raw: unknown, prev: Record<string, QuizTextScore>): Record<string, QuizTextScore> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Record<string, QuizTextScore> = { ...prev };
  for (const q of content.questions) {
    if (q.kind !== 'text' || !(q.id in o)) continue;
    const v = o[q.id];
    if (v === null || v === '') {
      delete out[q.id];
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    const score = Math.max(0, Math.min(q.points, Math.round(n)));
    if (prev[q.id]?.score === score) continue;
    out[q.id] = { score, reason: prev[q.id]?.reason ?? '', by: 'staff' };
  }
  return out;
}

/** รหัสสุ่มของทักษะ/ข้อ (ใช้ตอนกดเพิ่มบนหน้าจอ) */
export function quizLocalId(prefix: 's' | 'q'): string {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}

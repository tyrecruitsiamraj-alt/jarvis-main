// @vitest-environment node
/**
 * แบบทดสอบพนักงาน (เจ้าของ 12 พ.ย. 2569) — ตัวตัดสินคะแนน/เกรด/ตรวจฟอร์ม/ตัดเฉลย ที่ `src/lib/skillQuiz.ts`
 * 16 พ.ย. 2569 ถอดข้อเขียนตอบออกทั้งระบบ (เจ้าของ "ข้อสอบฉันไม่ได้ให้มีข้อเขียนนะ") — มีแต่ปรนัย คะแนนครบทันทีที่ส่ง
 */
import { describe, expect, it } from 'vitest';
import {
  parseQuizAiReply,
  parseQuizAnswers,
  parseQuizSetInput,
  publicQuestions,
  quizAttemptStatus,
  quizDocNo,
  quizGrade,
  quizSkillTone,
  scoreQuiz,
  type QuizSetContent,
} from '../../src/lib/skillQuiz';

const SET: QuizSetContent = {
  title: 'รายงานประเมินทักษะช่างอาคาร',
  roleLabel: 'Building Maintenance Technician',
  headerLine: 'SO PEOPLE | TECHNICAL SKILL HEALTH CHECK',
  passScore: 70,
  skills: [
    { id: 'sElec', name: 'ระบบไฟฟ้าอาคาร' },
    { id: 'sAir', name: 'ระบบปรับอากาศ' },
  ],
  questions: [
    { id: 'q1', skillId: 'sElec', kind: 'choice', prompt: 'เบรกเกอร์ตัดบ่อยเกิดจาก', choices: ['โหลดเกิน', 'สีผนัง'], answer: 0, points: 2 },
    { id: 'q2', skillId: 'sElec', kind: 'choice', prompt: 'ไฟ 3 เฟสแรงดัน', choices: ['220', '380'], answer: 1, points: 2 },
    { id: 'q3', skillId: 'sAir', kind: 'choice', prompt: 'FCU คือ', choices: ['Fan Coil Unit', 'Fuse Control Unit'], answer: 0, points: 2 },
    { id: 'q4', skillId: 'sAir', kind: 'choice', prompt: 'แอร์ไม่เย็น ตรวจอะไรก่อน', choices: ['ฟิลเตอร์', 'สีรีโมต'], answer: 0, points: 4 },
  ],
};

describe('ตรวจชุดข้อสอบจากหน้าจอ', () => {
  it('ชุดครบผ่าน · ค่าว่างได้ค่าเริ่ม', () => {
    const r = parseQuizSetInput({ ...SET, headerLine: '' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.headerLine).toBe('SO PEOPLE | TECHNICAL SKILL HEALTH CHECK');
  });
  it('บอกเหตุเป็นคำ: ไม่มีชื่อ · ปรนัยไม่เลือกคำตอบ · ทักษะไม่มีข้อ · เกณฑ์เกิน 100', () => {
    expect(parseQuizSetInput({ ...SET, title: ' ' })).toEqual({ ok: false, message: 'ใส่ชื่อชุดข้อสอบ' });
    expect(parseQuizSetInput({ ...SET, questions: [{ ...SET.questions[0], answer: 5 }, ...SET.questions.slice(1)] })).toEqual({ ok: false, message: 'ข้อ 1: เลือกคำตอบที่ถูก' });
    expect(parseQuizSetInput({ ...SET, skills: [...SET.skills, { id: 'sX', name: 'ความปลอดภัย' }] })).toEqual({ ok: false, message: 'ทักษะ "ความปลอดภัย" ยังไม่มีข้อ' });
    expect(parseQuizSetInput({ ...SET, passScore: 120 })).toEqual({ ok: false, message: 'เกณฑ์ผ่านต้องอยู่ระหว่าง 1–100' });
  });
  it('ข้อเขียนตอบไม่รับ (16 พ.ย. 2569) · ไม่มีตัวเลือกไม่รับ', () => {
    const text = { id: 'q5', skillId: 'sAir', kind: 'text', prompt: 'อธิบาย', choices: [], answer: null, points: 1 };
    expect(parseQuizSetInput({ ...SET, questions: [...SET.questions, text] })).toEqual({ ok: false, message: 'ข้อ 5: แบบทดสอบนี้มีแต่ข้อปรนัย' });
    expect(parseQuizSetInput({ ...SET, questions: [...SET.questions, { ...text, kind: 'choice' }] })).toEqual({ ok: false, message: 'ข้อ 5: ตัวเลือกต้องมีอย่างน้อย 2 ข้อ และไม่ว่าง' });
  });
});

describe('ข้อสอบที่ส่งให้พนักงาน', () => {
  it('ไม่มีเฉลย', () => {
    const qs = publicQuestions(SET);
    expect(qs).toHaveLength(4);
    for (const q of qs) {
      expect(q).not.toHaveProperty('answer');
      expect(q).not.toHaveProperty('skillId');
    }
  });
  it('ต้องตอบครบทุกข้อ · ตัวเลือกนอกช่วงไม่รับ', () => {
    expect(parseQuizAnswers(SET, { q1: 0, q2: 1, q3: 0 })).toEqual({ ok: false, message: 'ยังไม่ได้ตอบข้อ 4' });
    expect(parseQuizAnswers(SET, { q1: 3, q2: 1, q3: 0, q4: 0 })).toEqual({ ok: false, message: 'ยังไม่ได้ตอบข้อ 1' });
    expect(parseQuizAnswers(SET, { q1: 0, q2: 1, q3: 0, q4: 'ดูฟิลเตอร์' })).toEqual({ ok: false, message: 'ยังไม่ได้ตอบข้อ 4' });
    expect(parseQuizAnswers(SET, { q1: '0', q2: 1, q3: 0, q4: 1 })).toEqual({ ok: true, value: { q1: 0, q2: 1, q3: 0, q4: 1 } });
  });
});

describe('คะแนน · เกรด · ผ่านเกณฑ์', () => {
  const answers = { q1: 0, q2: 0, q3: 0, q4: 1 };
  it('ส่งแล้วคะแนนครบทันที · รวม = คะแนนที่ได้ ÷ เต็มทั้งชุด · รายทักษะ ÷ เต็มของทักษะ · บวกกันลงตัว', () => {
    const r = scoreQuiz(SET, answers);
    expect(r.skills.map((s) => [s.earned, s.full, s.score, s.passed])).toEqual([
      [2, 4, 50, false],
      [2, 6, 33, false],
    ]);
    expect(r.earned).toBe(4);
    expect(r.full).toBe(10);
    expect(r.earned).toBe(r.skills.reduce((a, s) => a + s.earned, 0));
    expect(r.score).toBe(40);
    expect(r.grade).toBe('D');
    expect(r.passedSkills).toBe(0);
    const full = scoreQuiz(SET, { q1: 0, q2: 1, q3: 0, q4: 0 });
    expect([full.score, full.grade, full.passedSkills]).toEqual([100, 'A', 2]);
  });
  it('เกรด A ≥ 85 · B ≥ 70 · C ≥ 60 · D · สีแท่ง', () => {
    expect([quizGrade(85), quizGrade(76), quizGrade(60), quizGrade(59)]).toEqual(['A', 'B', 'C', 'D']);
    expect([quizSkillTone(90, 70), quizSkillTone(75, 70), quizSkillTone(65, 70)]).toEqual(['success', 'info', 'danger']);
  });
  it('สถานะ · เลขที่เอกสาร', () => {
    expect(quizAttemptStatus({ submitted_at: null, reviewed_at: null })).toBe('waiting');
    expect(quizAttemptStatus({ submitted_at: '2026-11-12', reviewed_at: null })).toBe('review');
    expect(quizAttemptStatus({ submitted_at: '2026-11-12', reviewed_at: '2026-11-12' })).toBe('ready');
    expect(quizDocNo(125)).toBe('SO-TECH-00125');
  });
});

describe('AI ร่าง', () => {
  it('อ่าน JSON ของ AI เฉพาะบทวิเคราะห์ 3 หัว · อ่านไม่ได้ = null', () => {
    const r = parseQuizAiReply('ผล: {"strengths":"ไฟฟ้าดี","gap":"แอร์ 33","advice":"งาน PM ได้"}');
    expect(r?.analysis).toEqual({ strengths: 'ไฟฟ้าดี', gap: 'แอร์ 33', advice: 'งาน PM ได้' });
    expect(parseQuizAiReply('ไม่ใช่ JSON')).toBeNull();
    expect(parseQuizAiReply('{"x":1}')).toBeNull();
  });
});

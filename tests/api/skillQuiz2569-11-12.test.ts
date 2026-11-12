// @vitest-environment node
/**
 * แบบทดสอบพนักงาน (เจ้าของ 12 พ.ย. 2569) — ตัวตัดสินคะแนน/เกรด/ตรวจฟอร์ม/ตัดเฉลย ที่ `src/lib/skillQuiz.ts`
 */
import { describe, expect, it } from 'vitest';
import {
  parseQuizAiReply,
  parseQuizAnswers,
  parseQuizSetInput,
  parseStaffTextScores,
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
    { id: 'q1', skillId: 'sElec', kind: 'choice', prompt: 'เบรกเกอร์ตัดบ่อยเกิดจาก', choices: ['โหลดเกิน', 'สีผนัง'], answer: 0, points: 2, guide: '' },
    { id: 'q2', skillId: 'sElec', kind: 'choice', prompt: 'ไฟ 3 เฟสแรงดัน', choices: ['220', '380'], answer: 1, points: 2, guide: '' },
    { id: 'q3', skillId: 'sAir', kind: 'choice', prompt: 'FCU คือ', choices: ['Fan Coil Unit', 'Fuse Control Unit'], answer: 0, points: 2, guide: '' },
    { id: 'q4', skillId: 'sAir', kind: 'text', prompt: 'แอร์ไม่เย็น ตรวจอะไรก่อน', choices: [], answer: null, points: 4, guide: 'ฟิลเตอร์ น้ำยา คอยล์' },
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
});

describe('ข้อสอบที่ส่งให้พนักงาน', () => {
  it('ไม่มีเฉลย ไม่มีแนวคำตอบ', () => {
    const qs = publicQuestions(SET);
    expect(qs).toHaveLength(4);
    for (const q of qs) {
      expect(q).not.toHaveProperty('answer');
      expect(q).not.toHaveProperty('guide');
      expect(q).not.toHaveProperty('skillId');
    }
  });
  it('ต้องตอบครบทุกข้อ · ตัวเลือกนอกช่วงไม่รับ', () => {
    expect(parseQuizAnswers(SET, { q1: 0, q2: 1, q3: 0 })).toEqual({ ok: false, message: 'ยังไม่ได้ตอบข้อ 4' });
    expect(parseQuizAnswers(SET, { q1: 3, q2: 1, q3: 0, q4: 'x' })).toEqual({ ok: false, message: 'ยังไม่ได้ตอบข้อ 1' });
    expect(parseQuizAnswers(SET, { q1: '0', q2: 1, q3: 0, q4: ' ดูฟิลเตอร์ ' })).toEqual({ ok: true, value: { q1: 0, q2: 1, q3: 0, q4: 'ดูฟิลเตอร์' } });
  });
});

describe('คะแนน · เกรด · ผ่านเกณฑ์', () => {
  const answers = { q1: 0, q2: 0, q3: 0, q4: 'ดูฟิลเตอร์ก่อน' };
  it('เขียนตอบยังไม่ให้คะแนน = ผลยังไม่ครบ (null) ไม่ใช่ 0', () => {
    const r = scoreQuiz(SET, answers, {});
    expect(r.pendingText).toBe(1);
    expect(r.score).toBeNull();
    expect(r.grade).toBeNull();
    expect(r.passedSkills).toBeNull();
    expect(r.skills[0]).toMatchObject({ earned: 2, full: 4, score: 50, passed: false });
    expect(r.skills[1].score).toBeNull();
  });
  it('รวม = คะแนนที่ได้ ÷ เต็มทั้งชุด · รายทักษะ ÷ เต็มของทักษะ · บวกกันลงตัว', () => {
    const r = scoreQuiz(SET, answers, { q4: { score: 3, reason: '', by: 'ai' } });
    expect(r.skills.map((s) => [s.earned, s.full, s.score, s.passed])).toEqual([
      [2, 4, 50, false],
      [5, 6, 83, true],
    ]);
    expect(r.earned).toBe(7);
    expect(r.full).toBe(10);
    expect(r.earned).toBe(r.skills.reduce((a, s) => a + s.earned, 0));
    expect(r.score).toBe(70);
    expect(r.grade).toBe('B');
    expect(r.passedSkills).toBe(1);
  });
  it('คะแนนเขียนตอบเกินเต็มถูกตัดที่เต็ม', () => {
    expect(scoreQuiz(SET, answers, { q4: { score: 99, reason: '', by: 'staff' } }).skills[1].earned).toBe(6);
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

describe('AI ร่าง · เจ้าหน้าที่แก้', () => {
  it('อ่าน JSON ของ AI · ตัดคะแนนให้อยู่ในช่วง · ข้อที่ไม่ใช่เขียนตอบไม่รับ', () => {
    const r = parseQuizAiReply(SET, 'ผล: {"textScores":{"q4":{"score":9,"reason":"ครบ"},"q1":{"score":2}},"strengths":"ไฟฟ้าดี","gap":"แอร์ 50","advice":"งาน PM ได้"}');
    expect(r?.textScores).toEqual({ q4: { score: 4, reason: 'ครบ', by: 'ai' } });
    expect(r?.analysis).toEqual({ strengths: 'ไฟฟ้าดี', gap: 'แอร์ 50', advice: 'งาน PM ได้' });
    expect(parseQuizAiReply(SET, 'ไม่ใช่ JSON')).toBeNull();
  });
  it('เจ้าหน้าที่แก้คะแนน = by staff · ค่าว่าง = ลบคะแนน · ค่าเดิมคงเจ้าของเดิม', () => {
    const prev = { q4: { score: 3, reason: 'AI', by: 'ai' as const } };
    expect(parseStaffTextScores(SET, { q4: 3 }, prev)).toEqual(prev);
    expect(parseStaffTextScores(SET, { q4: 4 }, prev)).toEqual({ q4: { score: 4, reason: 'AI', by: 'staff' } });
    expect(parseStaffTextScores(SET, { q4: null }, prev)).toEqual({});
    expect(parseStaffTextScores(SET, { q1: 2 }, {})).toEqual({});
  });
});

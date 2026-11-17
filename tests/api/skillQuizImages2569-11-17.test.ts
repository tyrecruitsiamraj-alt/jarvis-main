// @vitest-environment node
/**
 * แบบทดสอบ: รูปของคำถามและตัวเลือก (เจ้าของ 17 พ.ย. 2569 "ข้อสอบ และ Choice ใส่รูปได้ไหม" → Choice "คำถาม+ตัวเลือก")
 * ชุดเก็บแค่รหัสรูป · ตัวเลือกที่มีรูปไม่ต้องมีคำ · รูปเปิดดูได้โดยไม่ล็อกอิน แต่รับเฉพาะไฟล์รูปจริง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildQuizAiPrompt, parseQuizSetInput, publicQuestions, quizChoiceLabel, type QuizSetContent } from '../../src/lib/skillQuiz';
import { sniffQuizImage } from '../../api/_lib/skillQuiz';

const IMG_Q = '3f6c1a52-8d4e-4b7a-9c21-5e0f7b9d2a10';
const IMG_A = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const IMG_B = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

const SET: QuizSetContent = {
  title: 'ประเมินทักษะช่างไฟฟ้า',
  roleLabel: 'ช่างไฟฟ้าอาคาร',
  headerLine: 'SO PEOPLE | TECHNICAL SKILL HEALTH CHECK',
  passScore: 70,
  skills: [{ id: 'sElec', name: 'ระบบไฟฟ้าอาคาร' }],
  questions: [
    { id: 'q1', skillId: 'sElec', kind: 'choice', prompt: 'อุปกรณ์ในรูปคืออะไร', choices: ['เบรกเกอร์', 'แมกเนติก'], answer: 0, points: 1, image: IMG_Q },
    { id: 'q2', skillId: 'sElec', kind: 'choice', prompt: 'รูปไหนคือสายดิน', choices: ['', 'สายสีฟ้า'], answer: 0, points: 1, choiceImages: [IMG_A, IMG_B] },
  ],
};

describe('ตรวจชุดที่มีรูป', () => {
  it('รูปคำถาม + ตัวเลือกที่เป็นรูปล้วน ผ่าน และเก็บรหัสรูปไว้', () => {
    const r = parseQuizSetInput(SET);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.questions[0].image).toBe(IMG_Q);
    expect(r.value.questions[1].choiceImages).toEqual([IMG_A, IMG_B]);
  });
  it('ชุดเดิมที่ไม่มีรูป ไม่เกิดช่องรูปเปล่าในชุด', () => {
    const r = parseQuizSetInput({ ...SET, questions: [{ ...SET.questions[0], image: undefined }] });
    expect(r.ok && r.value.questions[0]).not.toHaveProperty('image');
    expect(r.ok && r.value.questions[0]).not.toHaveProperty('choiceImages');
  });
  it('ตัวเลือกไม่มีทั้งคำและรูป ไม่รับ · รหัสรูปแปลกไม่รับ', () => {
    const blank = { ...SET.questions[1], choiceImages: ['', IMG_B] };
    expect(parseQuizSetInput({ ...SET, questions: [SET.questions[0], blank] })).toEqual({ ok: false, message: 'ข้อ 2: ตัวเลือกต้องมีอย่างน้อย 2 ข้อ และแต่ละข้อต้องมีคำหรือรูป' });
    expect(parseQuizSetInput({ ...SET, questions: [{ ...SET.questions[0], image: '../x' }, SET.questions[1]] })).toEqual({ ok: false, message: 'ข้อ 1: รูปของคำถามไม่ถูกต้อง อัปโหลดใหม่' });
    expect(parseQuizSetInput({ ...SET, questions: [SET.questions[0], { ...SET.questions[1], choiceImages: ['javascript:1', IMG_B] }] })).toEqual({ ok: false, message: 'ข้อ 2: รูปของตัวเลือกไม่ถูกต้อง อัปโหลดใหม่' });
  });
});

describe('ส่งให้คนทำ · ผลตรวจ · AI', () => {
  it('คนทำได้รูปครบ แต่ไม่มีเฉลย', () => {
    const [q1, q2] = publicQuestions(SET);
    expect(q1.image).toBe(IMG_Q);
    expect(q2.choiceImages).toEqual([IMG_A, IMG_B]);
    expect(q2).not.toHaveProperty('answer');
  });
  it('ตัวเลือกรูปล้วนมีชื่อเรียก ไม่ขึ้นช่องว่าง', () => {
    expect(quizChoiceLabel(SET.questions[1], 0)).toBe('รูปตัวเลือก 1');
    expect(quizChoiceLabel(SET.questions[1], 1)).toBe('สายสีฟ้า (มีรูป)');
    expect(quizChoiceLabel(SET.questions[0], 1)).toBe('แมกเนติก');
    const prompt = buildQuizAiPrompt(SET, { q1: 1, q2: 1 });
    expect(prompt).toContain('อุปกรณ์ในรูปคืออะไร (มีรูปประกอบ)');
    expect(prompt).toContain('ที่ถูกคือ "รูปตัวเลือก 1"');
  });
});

describe('รับเฉพาะไฟล์รูปจริง (ดูจากไบต์)', () => {
  it('JPEG · PNG · WebP ผ่าน · อย่างอื่นไม่รับ', () => {
    expect(sniffQuizImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(sniffQuizImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffQuizImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]))).toBe('image/webp');
    expect(sniffQuizImage(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
    expect(sniffQuizImage(Buffer.from('%PDF-1.7'))).toBeNull();
  });
  it('เส้นรูปไม่ต้องล็อกอิน · ตรวจรหัสก่อนแตะฐาน · อัปโหลดอยู่ฝั่งเจ้าหน้าที่ที่ล็อกอินเท่านั้น', () => {
    const pub = readFileSync('api/_handlers/public/skill-quiz.ts', 'utf8');
    expect(pub).toMatch(/isQuizImageId\(id\) \? await getQuizImage\(id\)/);
    expect(pub).not.toContain('upload_image');
    const authed = readFileSync('api/_handlers/skill-quiz.ts', 'utf8');
    expect(authed).toContain("action === 'upload_image'");
    expect(authed).toContain("withRbac(handler, 'skill-quiz')");
  });
});

/**
 * iRecruit ดึงผลแบบทดสอบ (เจ้าของ 18 พ.ย. 2569) — GET /api/integrations/irecruit/skill-results
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeSkillCursor, encodeSkillCursor, irecruitSkillResultsHandler, parseSkillQuery, toSkillResult } from '../../api/_handlers/irecruit-integration';
import { INTEGRATIONS } from '../../src/lib/integrationKeys';
import type { QuizSetContent } from '../../src/lib/skillQuiz';

const content: QuizSetContent = {
  title: 'ช่างไฟฟ้าอาคาร ระดับ 1',
  roleLabel: 'ช่างไฟฟ้า',
  headerLine: 'SO PEOPLE | TECHNICAL SKILL HEALTH CHECK',
  passScore: 70,
  skills: [
    { id: 's-elec', name: 'ไฟฟ้ากำลัง' },
    { id: 's-safe', name: 'ความปลอดภัย' },
  ],
  questions: [
    { id: 'q1', skillId: 's-elec', kind: 'choice', prompt: 'เบรกเกอร์ตัดเพราะอะไร', choices: ['โหลดเกิน', 'ไฟตก'], answer: 0, points: 1 },
    { id: 'q2', skillId: 's-elec', kind: 'choice', prompt: 'สายดินมีไว้ทำไม', choices: ['กันไฟดูด', 'ลดค่าไฟ'], answer: 0, points: 1 },
    { id: 'q3', skillId: 's-safe', kind: 'choice', prompt: 'ก่อนซ่อมตู้ไฟต้องทำอะไร', choices: ['ตัดไฟ + ล็อก', 'ใส่ถุงมือ'], answer: 0, points: 1 },
  ],
};

const row = {
  id: '6f1c2a9e-4b7d-4c2a-9e1f-3a5b7c9d0e12',
  set_id: '2b4d6f80-1a3c-4e5f-8a7b-9c0d1e2f3a45',
  doc_no: 'SO-TECH-00125',
  person_name: 'สมชาย ใจดี',
  first_name: 'สมชาย',
  last_name: 'ใจดี',
  phone: '0812345678',
  content,
  answers: { q1: 0, q2: 1, q3: 0 },
  submitted_at: '2026-11-17T03:15:00.123456Z',
  reviewed_at: null,
};

describe('รูปข้อมูลที่ส่งให้ iRecruit', () => {
  it('คะแนน · เกรด · ผ่านรายทักษะ · ลิงก์ใบผล — คิดด้วย scoreQuiz ตัวเดียวกับใบผลบนจอ', () => {
    const r = toSkillResult(row, 'https://jarvis.siamrajathanee.dev');
    expect(r).toMatchObject({
      doc_no: 'SO-TECH-00125',
      person: { first_name: 'สมชาย', last_name: 'ใจดี', phone: '0812345678' },
      set: { title: 'ช่างไฟฟ้าอาคาร ระดับ 1', role: 'ช่างไฟฟ้า' },
      status: 'review',
      status_label: 'รอตรวจ',
      score: 67,
      pass_score: 70,
      passed_skills: 1,
      total_skills: 2,
      passed: false,
    });
    expect(r.skills).toEqual([
      { name: 'ไฟฟ้ากำลัง', score: 50, passed: false },
      { name: 'ความปลอดภัย', score: 100, passed: true },
    ]);
    expect(r.result_url).toBe(`https://jarvis.siamrajathanee.dev/skill-test?set=${row.set_id}&open=${row.id}`);
  });
  it('🔴 PDPA: ไม่มีเลขบัตร · วันเกิด · คำตอบรายข้อ · บทวิเคราะห์', () => {
    const json = JSON.stringify(toSkillResult(row, ''));
    for (const k of ['citizen', 'birth', 'answers', 'analysis']) expect(json).not.toContain(k);
    expect(toSkillResult(row, '').result_url).toBeNull();
  });
});

describe('พารามิเตอร์ + ดึงต่อ', () => {
  it('cursor ถอดกลับได้ตรง · cursor เสีย = ปฏิเสธ', () => {
    const c = encodeSkillCursor(row.submitted_at, row.id);
    expect(decodeSkillCursor(c)).toEqual({ at: row.submitted_at, id: row.id });
    expect(parseSkillQuery({ cursor: 'ไม่ใช่' })).toMatchObject({ ok: false });
  });
  it('since · phone · limit', () => {
    expect(parseSkillQuery({ since: '2026-11-01T00:00:00+07:00' })).toMatchObject({ ok: true, after: { at: '2026-10-31T17:00:00.000Z' }, limit: 100 });
    expect(parseSkillQuery({ phone: '081-234-5678', limit: '20' })).toMatchObject({ ok: true, phone: '0812345678', limit: 20 });
    expect(parseSkillQuery({ phone: '12345' })).toMatchObject({ ok: false });
    expect(parseSkillQuery({ limit: '501' })).toMatchObject({ ok: false });
    expect(parseSkillQuery({ since: 'เมื่อวาน' })).toMatchObject({ ok: false });
  });
});

describe('ยืนยันตัว + ลงทะเบียน', () => {
  it('ไม่ส่ง x-api-key = 401 (ไม่แตะฐาน)', async () => {
    const out: { status?: number; body?: unknown } = {};
    const res = { status: (s: number) => ((out.status = s), res), json: (b: unknown) => ((out.body = b), res), setHeader: () => res } as never;
    await irecruitSkillResultsHandler({ method: 'GET', headers: {}, query: {} } as never, res);
    expect(out.status).toBe(401);
  });
  it('อยู่ในทะเบียน API + ออกกุญแจได้จากหน้า ตั้งค่า › เชื่อมระบบภายนอก', () => {
    expect(readFileSync('api/_handlers/registry.ts', 'utf8')).toContain("'/api/integrations/irecruit/skill-results': irecruitSkillResultsHandler");
    expect(INTEGRATIONS.find((i) => i.name === 'irecruit')?.endpoints).toEqual(['/api/integrations/irecruit/skill-results', '/api/integrations/irecruit/applicant-documents']); // 23 พ.ย. 2569 + เอกสาร
  });
  it('ลิงก์ใบผลเปิดใบนั้นได้ตรง ๆ (?open=)', () => {
    expect(readFileSync('src/pages/skill-quiz/SkillQuizPage.tsx', 'utf8')).toContain("params.get('open')");
  });
});

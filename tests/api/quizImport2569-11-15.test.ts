// @vitest-environment node
/**
 * นำเข้าข้อสอบจากไฟล์แบบ KNOWA (เจ้าของ 15 พ.ย. 2569 "ลองดู Knowa ว่าเพิ่มยังไง … นำเข้าเป็นไฟล์ได้")
 * แบบฟอร์ม Excel/Word ที่ระบบสร้าง → อ่านกลับ → ได้ข้อครบ · ไฟล์ของ KNOWA ใช้ได้ · แถวผิดบอกเลขแถว ไม่ล้มทั้งไฟล์
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { officeFileToTsv, paragraphsToRows, PARAGRAPH_HEADERS, rowsToTsv } from '@/lib/officeTable';
import { buildTemplateDocx, buildTemplateXlsx } from '@/lib/officeTemplate';
import { QUIZ_IMPORT_HEADERS, QUIZ_IMPORT_HOWTO, QUIZ_IMPORT_SAMPLE, addImportedQuestions, parseQuizImport } from '@/lib/quizImport';
import { parseQuizSetInput, type QuizSetContent } from '@/lib/skillQuiz';

const tsv = (rows: string[][]) => rows.map((r) => r.join('\t')).join('\n');
const BLANK_SKILL = { id: 's0', name: '' };
const asFile = (name: string, bytes: Uint8Array) => ({ name, arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer });

describe('อ่านแบบฟอร์มของระบบ', () => {
  it('ตัวอย่าง 3 ข้อ: ปรนัย · ถูก/ผิด · ปรนัย (ไม่มีข้อเขียนตอบ 16 พ.ย. 2569) · ทักษะใหม่ 2 ทักษะ · คะแนนตามช่อง', () => {
    const r = parseQuizImport(tsv([QUIZ_IMPORT_HEADERS, ...QUIZ_IMPORT_SAMPLE]), [BLANK_SKILL], 's0');
    expect(r.issues).toEqual([]);
    expect(r.newSkills.map((s) => s.name)).toEqual(['ระบบไฟฟ้าอาคาร', 'งานประปา']);
    expect(r.questions.map((q) => [q.kind, q.answer, q.choices.length, q.points])).toEqual([
      ['choice', 0, 4, 1],
      ['choice', 0, 2, 1],
      ['choice', 0, 4, 2],
    ]);
    expect(r.questions[2].choices[0]).toContain('ปิดวาล์วหลัก');
    expect(r.questions[0].skillId).toBe(r.questions[1].skillId);
  });

  it('Excel ที่ระบบสร้าง → อ่านกลับได้ครบ (ชีตแรก) · Word ก็เหมือนกัน', async () => {
    const x = await officeFileToTsv(asFile('a.xlsx', buildTemplateXlsx(QUIZ_IMPORT_HEADERS, QUIZ_IMPORT_SAMPLE, QUIZ_IMPORT_HOWTO, [10, 10, 10, 10, 10, 10, 10, 10])));
    expect(x.errorTh).toBeUndefined();
    expect(parseQuizImport(x.tsv, [], 's0').questions).toHaveLength(3);
    const w = await officeFileToTsv(asFile('a.docx', buildTemplateDocx('แบบฟอร์ม', QUIZ_IMPORT_HEADERS, QUIZ_IMPORT_SAMPLE, QUIZ_IMPORT_HOWTO)));
    expect(w.errorTh).toBeUndefined();
    expect(w.sourceTh).toContain('ตาราง');
    expect(parseQuizImport(w.tsv, [], 's0').questions).toHaveLength(3);
  });

  it('ไฟล์อื่นบอกเป็นคำ', async () => {
    expect((await officeFileToTsv(asFile('a.pdf', new Uint8Array([1, 2])))).errorTh).toContain('.xlsx');
    expect((await officeFileToTsv(asFile('a.xlsx', new Uint8Array([1, 2, 3])))).errorTh).toBeTruthy();
  });
});

describe('ไฟล์แบบอื่น', () => {
  it('ไฟล์ของ KNOWA (คำถาม · ก–ง · เฉลย · คำอธิบายเฉลย) ใช้ได้ · ไม่มีช่องทักษะ = ทักษะที่เลือกไว้', () => {
    const knowa = tsv([
      ['คำถาม', 'ตัวเลือก ก', 'ตัวเลือก ข', 'ตัวเลือก ค', 'ตัวเลือก ง', 'เฉลย', 'คำอธิบายเฉลย'],
      ['ข้อใดคือขั้นตอนแรกก่อนใช้รถเครน', 'ตรวจสภาพรถ', 'ติดเครื่อง', 'เรียกผู้ช่วย', 'ยกของ', 'ก', 'กฎหมายบังคับ'],
    ]);
    const r = parseQuizImport(knowa, [{ id: 'sA', name: 'ความปลอดภัย' }], 'sA');
    expect(r.issues).toEqual([]);
    expect(r.questions[0]).toMatchObject({ skillId: 'sA', kind: 'choice', answer: 0, prompt: 'ข้อใดคือขั้นตอนแรกก่อนใช้รถเครน' });
  });
  it('ไม่มีหัวตาราง = เรียงตามแบบฟอร์ม · ทักษะชื่อเดิม (ตัวพิมพ์/ช่องว่างต่าง) = ทักษะเดิม · CSV มีเครื่องหมายคำพูด', () => {
    const csv = '" ระบบไฟฟ้า ","ไฟรั่ว, ทำอย่างไร",ตัดไฟ,วิ่งหนี,,,1,2';
    const r = parseQuizImport(csv, [{ id: 'sE', name: 'ระบบไฟฟ้า' }], 'sE');
    expect(r.newSkills).toEqual([]);
    expect(r.questions[0]).toMatchObject({ skillId: 'sE', prompt: 'ไฟรั่ว, ทำอย่างไร', choices: ['ตัดไฟ', 'วิ่งหนี'], answer: 0, points: 2 });
  });
  it('ข้อความแบบข้อสอบไทยใน Word: ทักษะ: · 1. · ก. · เฉลย: · คะแนน: · ข้อไม่มีตัวเลือก = แถวผิด', () => {
    const rows = paragraphsToRows(['ทักษะ: งานประปา', '1. ท่อน้ำรั่วต้องปิดอะไรก่อน', 'ก. วาล์วหลัก', 'ข. ก๊อกในห้องน้ำ', 'เฉลย: ก', 'คะแนน: 2', '2. อธิบายการพันเทปเกลียว', 'แนวคำตอบ: พันตามเกลียว 5–7 รอบ']);
    const r = parseQuizImport(rowsToTsv([PARAGRAPH_HEADERS, ...rows]), [], 's0');
    expect(r.issues.map((i) => i.message)).toEqual(['ยังไม่ได้ใส่ตัวเลือก ใส่อย่างน้อย 2 ช่อง']);
    expect(r.questions.map((q) => [q.kind, q.answer, q.points])).toEqual([['choice', 0, 2]]);
    expect(r.newSkills.map((s) => s.name)).toEqual(['งานประปา']);
  });
});

describe('แถวผิดบอกเลขแถว ไม่ล้มทั้งไฟล์', () => {
  it('เฉลยหลายข้อ · ไม่มีเฉลย · เฉลยไม่ตรง · ตัวเลือกเว้นช่อง · ตัวเลือกเดียว · คะแนนผิด', () => {
    const r = parseQuizImport(
      tsv([
        QUIZ_IMPORT_HEADERS,
        ['ก', 'ข้อดี', 'a', 'b', '', '', 'ก', '1'],
        ['ก', 'หลายคำตอบ', 'a', 'b', 'c', '', 'ก,ค', '1'],
        ['ก', 'ไม่มีเฉลย', 'a', 'b', '', '', '', '1'],
        ['ก', 'เฉลยไม่ตรง', 'a', 'b', '', '', 'จ', '1'],
        ['ก', 'เว้นช่อง', 'a', '', 'c', '', 'ก', '1'],
        ['ก', 'ตัวเลือกเดียว', 'a', '', '', '', 'ก', '1'],
        ['ก', 'คะแนนผิด', 'a', 'b', '', '', 'ก', '500'],
      ]),
      [],
      's0',
    );
    expect(r.questions).toHaveLength(1);
    expect(r.issues.map((i) => i.line)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(r.issues[0].message).toContain('ข้อเดียว');
  });
});

describe('เพิ่มเข้าชุด', () => {
  it('ข้อเปล่าในฟอร์มถูกแทน · ทักษะว่างที่ไม่มีข้อถูกเอาออก · บันทึกผ่านตัวตรวจของ server', () => {
    const c: QuizSetContent = { title: 'ช่างอาคาร', roleLabel: '', headerLine: 'H', passScore: 70, skills: [BLANK_SKILL], questions: [{ id: 'q0', skillId: 's0', kind: 'choice', prompt: '', choices: ['', ''], answer: 0, points: 1 }] };
    const next = addImportedQuestions(c, parseQuizImport(tsv([QUIZ_IMPORT_HEADERS, ...QUIZ_IMPORT_SAMPLE]), c.skills, 's0'));
    expect(next.questions).toHaveLength(3);
    expect(next.skills.map((s) => s.name)).toEqual(['ระบบไฟฟ้าอาคาร', 'งานประปา']);
    expect(parseQuizSetInput(next).ok).toBe(true);
  });
  it('ป๊อปชุดข้อสอบมีปุ่มนำเข้า · แผงอยู่ในป๊อปเดิม (ไม่ซ้อนป๊อป)', () => {
    const ed = readFileSync('src/components/skill-quiz/QuizSetEditorDialog.tsx', 'utf8');
    expect(ed).toContain('<QuizImportPanel');
    expect(ed).toContain('นำเข้าจากไฟล์');
    expect(readFileSync('src/components/skill-quiz/QuizImportPanel.tsx', 'utf8')).not.toMatch(/<Dialog\b/);
  });
});

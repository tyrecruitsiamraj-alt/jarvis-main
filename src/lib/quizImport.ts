/**
 * ═══ นำเข้าข้อสอบจากไฟล์ / วางจาก Excel (เจ้าของ 15 พ.ย. 2569 "ลองดู Knowa ว่าเพิ่มยังไง … นำเข้าเป็นไฟล์ได้") ═══
 * ตัวอ่านตัวเดียว: ข้อความ (TSV/CSV จาก Excel · ไฟล์ที่ `officeTable.ts` แปลงมา) → ข้อของชุด + ทักษะใหม่ + แถวที่มีปัญหา
 * แถวที่อ่านไม่ได้ไม่ทำให้ทั้งไฟล์ล้ม — บอกเลขบรรทัดให้แก้เฉพาะแถว (แบบ KNOWA `question-import.ts`)
 *
 * คอลัมน์จับจาก **หัวตาราง** (เรียงแบบไหนก็ได้ · ไฟล์ของ KNOWA ใช้ได้) · ไม่มีหัว = เรียงตาม `QUIZ_IMPORT_HEADERS`
 *   ทักษะ · คำถาม · ตัวเลือก ก–ง (เพิ่ม จ–ซ ได้) · เฉลย · คะแนน
 *   ปรนัย = ตัวเลือก ≥ 2 · เฉลยเป็น ก ข ค ง / 1 2 3 4 / ข้อความของตัวเลือก / ถูก ผิด (ตอบได้ข้อเดียว — แบบทดสอบนี้ไม่มีหลายคำตอบ)
 *   ไม่มีข้อเขียนตอบ (เจ้าของ 16 พ.ย. 2569) — แถวที่ไม่ใส่ตัวเลือก = แถวผิด · คอลัมน์ "แนวคำตอบ" ในไฟล์ KNOWA อ่านข้าม
 *   ทักษะว่าง = ทักษะเดียวกับข้อก่อนหน้า · คะแนนว่าง = 1
 */
import { QUIZ_MAX_CHOICES, QUIZ_MAX_QUESTIONS, quizLocalId, type QuizQuestion, type QuizSetContent, type QuizSkill } from './skillQuiz';

export const QUIZ_IMPORT_HEADERS = ['ทักษะ', 'คำถาม', 'ตัวเลือก ก', 'ตัวเลือก ข', 'ตัวเลือก ค', 'ตัวเลือก ง', 'เฉลย', 'คะแนน'];

export const QUIZ_IMPORT_SAMPLE: string[][] = [
  ['ระบบไฟฟ้าอาคาร', 'ก่อนเปลี่ยนเบรกเกอร์ ต้องทำอะไรก่อน', 'สับคัตเอาต์ลงและแขวนป้ายห้ามสับ', 'ใส่ถุงมือแล้วทำได้เลย', 'แจ้งหัวหน้าหลังทำเสร็จ', 'รอให้ไฟดับเอง', 'ก', '1'],
  ['ระบบไฟฟ้าอาคาร', 'สายดินมีไว้ป้องกันไฟฟ้าดูด', 'ถูก', 'ผิด', '', '', 'ถูก', '1'],
  ['งานประปา', 'วาล์วน้ำรั่ว ก่อนถอดวาล์วเดิมต้องทำอะไร', 'ปิดวาล์วหลักแล้วระบายน้ำในท่อ', 'ถอดได้เลยแล้วรีบใส่ตัวใหม่', 'พันเทปเกลียวทับรอยรั่ว', 'เปิดน้ำแรงขึ้นไล่ลม', 'ก', '2'],
];

/** วิธีกรอก — แท็บที่สองของ Excel และย่อหน้าบนสุดของ Word */
export const QUIZ_IMPORT_HOWTO = [
  'แถวแรกคือหัวคอลัมน์ ห้ามลบ · หนึ่งแถวต่อหนึ่งข้อ ลบแถวตัวอย่างแล้วพิมพ์ข้อสอบแทน',
  'ข้อปรนัย ใส่ตัวเลือกอย่างน้อย 2 ช่อง แล้วช่องเฉลยใส่ ก ข ค ง (หรือ 1 2 3 4) ได้ข้อเดียว',
  'ข้อถูก/ผิด ใส่ตัวเลือก ก = ถูก ข = ผิด แล้วเฉลยเป็น ถูก หรือ ผิด',
  'ทักษะว่าง = ใช้ทักษะเดียวกับข้อก่อนหน้า · คะแนนว่าง = 1 คะแนน',
  'กรอกเสร็จ กลับไปที่ป๊อปชุดข้อสอบ กด "นำเข้าจากไฟล์" แล้วเลือกไฟล์นี้ ระบบให้ตรวจก่อนเพิ่ม',
];

export type QuizImportIssue = { line: number; message: string };
export type QuizImportResult = {
  questions: QuizQuestion[];
  /** ทักษะใหม่ที่ไฟล์อ้างถึง (ยังไม่มีในชุด) */
  newSkills: QuizSkill[];
  issues: QuizImportIssue[];
};

/**
 * ข้อความ → ตาราง · ตัวคั่นตัดสิน **รายบรรทัด** (แท็บ = วางจาก Excel · คอมมา = CSV) รองรับค่าที่ครอบด้วย "…"
 * ⚠️ เดาตัวคั่นจากทั้งไฟล์ไม่ได้ — คำถามไทยมี "ก, ข, ค" ปนในไฟล์ TSV บ่อย (KNOWA)
 */
export function splitRows(raw: string): { line: number; cells: string[] }[] {
  const chars = Array.from(raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'));
  const tabLines = new Set<number>();
  {
    let n = 1;
    let q = false;
    for (const ch of chars) {
      if (ch === '"') q = !q;
      else if (ch === '\n' && !q) n += 1;
      else if (ch === '\t' && !q) tabLines.add(n);
    }
  }
  const out: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let lineStart = 1;
  let delim: '\t' | ',' | null = null;
  const pushCell = () => {
    cells.push(cell.trim());
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    if (cells.some((c) => c.length > 0)) out.push({ line: lineStart, cells });
    cells = [];
    delim = null;
    lineStart = line + 1;
  };
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (quoted) {
      if (ch === '"') {
        if (chars[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else {
        if (ch === '\n') line += 1;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
      continue;
    }
    if (ch === '\n') {
      pushRow();
      line += 1;
      continue;
    }
    if (delim == null) delim = tabLines.has(line) ? '\t' : ',';
    if (ch === delim) {
      pushCell();
      continue;
    }
    cell += ch;
  }
  pushRow();
  return out;
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

const THAI_LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ'];
const LATIN_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const TRUE_WORDS = ['ถูก', 'ใช่', 'จริง', 'true', 't', 'y', 'yes'];
const FALSE_WORDS = ['ผิด', 'ไม่ใช่', 'เท็จ', 'false', 'f', 'n', 'no'];

type Col = 'skill' | 'prompt' | 'answer' | 'points' | 'guide' | { choice: number };

/** หัวคอลัมน์ → ช่อง · ไม่รู้จัก = null (ข้าม) */
function colOf(header: string): Col | null {
  const h = norm(header).replace(/[:：]$/, '');
  if (['ทักษะ', 'หมวด', 'หมวดทักษะ', 'หัวข้อ', 'skill'].includes(h)) return 'skill';
  if (['คำถาม', 'โจทย์', 'question'].includes(h)) return 'prompt';
  if (['เฉลย', 'คำตอบ', 'คำตอบที่ถูก', 'answer'].includes(h)) return 'answer';
  if (['คะแนน', 'points', 'score'].includes(h)) return 'points';
  if (['แนวคำตอบ', 'คำอธิบายเฉลย', 'คำอธิบาย'].includes(h)) return 'guide';
  const m = h.match(/^(?:ตัวเลือก|ตัวเลือกที่|choice|option)\s*(.+)$/) ?? h.match(/^([ก-ซ])$/);
  if (m) {
    const k = m[1].trim();
    const i = [THAI_LETTERS.indexOf(k), LATIN_LETTERS.indexOf(k), /^[1-8]$/.test(k) ? Number(k) - 1 : -1].find((x) => x >= 0);
    if (i != null && i < QUIZ_MAX_CHOICES) return { choice: i };
  }
  return null;
}

/** เฉลยหนึ่งค่า → ลำดับตัวเลือก (-1 = ชี้ไม่ได้) */
function resolveAnswer(token: string, options: readonly string[]): number {
  const t = norm(token).replace(/^ข้อ\s*/, '').replace(/[.)]$/, '');
  if (!t) return -1;
  for (let i = 0; i < options.length; i++) {
    if (t === THAI_LETTERS[i] || t === LATIN_LETTERS[i] || t === String(i + 1)) return i;
  }
  const byText = options.findIndex((o) => norm(o) === t);
  if (byText >= 0) return byText;
  if (options.length === 2) {
    if (TRUE_WORDS.includes(t)) return 0;
    if (FALSE_WORDS.includes(t)) return 1;
  }
  return -1;
}

/**
 * อ่านข้อสอบ · `skills` = ทักษะที่ชุดมีอยู่ (จับชื่อซ้ำเป็นทักษะเดิม ไม่สร้างใหม่)
 * ทักษะว่างตั้งแต่แถวแรก = `fallbackSkillId` (ทักษะที่ผู้ใช้เลือกไว้ตอนนำเข้า)
 */
export function parseQuizImport(raw: string, skills: readonly QuizSkill[], fallbackSkillId: string): QuizImportResult {
  const rows = splitRows(raw);
  const issues: QuizImportIssue[] = [];
  const questions: QuizQuestion[] = [];
  const newSkills: QuizSkill[] = [];
  if (rows.length === 0) return { questions, newSkills, issues: [{ line: 0, message: 'ไม่พบข้อสอบ' }] };

  const headerCols = rows[0].cells.map(colOf);
  const hasHeader = headerCols.includes('prompt');
  const cols: (Col | null)[] = hasHeader ? headerCols : QUIZ_IMPORT_HEADERS.map(colOf);
  const body = hasHeader ? rows.slice(1) : rows;

  const known = new Map(skills.filter((s) => s.name.trim()).map((s) => [norm(s.name), s.id]));
  let skillId = fallbackSkillId;
  const skillIdOf = (name: string): string => {
    const k = norm(name);
    const hit = known.get(k);
    if (hit) return hit;
    const s = { id: quizLocalId('s'), name: name.trim().slice(0, 120) };
    newSkills.push(s);
    known.set(k, s.id);
    return s.id;
  };

  for (const { line, cells } of body) {
    const get = (c: Col) => {
      const i = cols.findIndex((x) => (typeof c === 'string' ? x === c : typeof x === 'object' && x !== null && x.choice === c.choice));
      return i >= 0 ? (cells[i] ?? '').trim() : '';
    };
    const prompt = get('prompt');
    if (!prompt) continue;
    if (questions.length >= QUIZ_MAX_QUESTIONS) {
      issues.push({ line, message: `ชุดหนึ่งได้ไม่เกิน ${QUIZ_MAX_QUESTIONS} ข้อ — แถวนี้ไม่ได้เพิ่ม` });
      continue;
    }
    const skillName = get('skill');
    if (skillName) skillId = skillIdOf(skillName);

    const pointsRaw = get('points');
    const points = pointsRaw ? Math.round(Number(pointsRaw)) : 1;
    if (!Number.isFinite(points) || points < 1 || points > 100) {
      issues.push({ line, message: `คะแนน "${pointsRaw}" ต้องเป็นเลข 1–100` });
      continue;
    }
    // ตัวเลือกตามลำดับคอลัมน์ ก ข ค … ตัดช่องว่างท้าย (เว้นช่องกลางไว้ = ผิดรูป)
    const choiceCols = cols.flatMap((c) => (typeof c === 'object' && c !== null ? [c.choice] : [])).sort((a, b) => a - b);
    const options = choiceCols.map((i) => get({ choice: i }));
    while (options.length && !options[options.length - 1]) options.pop();
    const answer = get('answer');

    // ไม่มีข้อเขียนตอบ (เจ้าของ 16 พ.ย. 2569 "ข้อสอบฉันไม่ได้ให้มีข้อเขียนนะ") — ไม่มีตัวเลือก = แถวผิด
    if (options.length === 0) {
      issues.push({ line, message: 'ยังไม่ได้ใส่ตัวเลือก ใส่อย่างน้อย 2 ช่อง' });
      continue;
    }
    if (options.some((o) => !o)) {
      issues.push({ line, message: 'ตัวเลือกเว้นช่องว่างไว้กลางแถว' });
      continue;
    }
    if (options.length < 2) {
      issues.push({ line, message: 'ตัวเลือกต้องมีอย่างน้อย 2 ช่อง' });
      continue;
    }
    if (!answer) {
      issues.push({ line, message: 'ยังไม่ได้ใส่เฉลย' });
      continue;
    }
    const tokens = answer.split(/[,/|]+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length > 1) {
      issues.push({ line, message: `เฉลย "${answer}" — แบบทดสอบนี้ตอบถูกได้ข้อเดียว` });
      continue;
    }
    const idx = resolveAnswer(tokens[0], options);
    if (idx < 0) {
      issues.push({ line, message: `เฉลย "${answer}" ไม่ตรงกับตัวเลือกใดเลย` });
      continue;
    }
    questions.push({ id: quizLocalId('q'), skillId, kind: 'choice', prompt: prompt.slice(0, 2000), choices: options.map((o) => o.slice(0, 500)), answer: idx, points });
  }
  if (questions.length === 0 && issues.length === 0) issues.push({ line: 0, message: 'ไม่พบข้อสอบ — แถวแรกต้องเป็นหัวคอลัมน์ หรือเรียงคอลัมน์ตามแบบฟอร์ม' });
  return { questions, newSkills, issues };
}

/**
 * เพิ่มข้อที่อ่านได้เข้าชุด · ข้อเปล่าในฟอร์ม (ยังไม่พิมพ์คำถาม) ถูกแทนที่ · ทักษะว่างที่ยังไม่มีข้อถูกเอาออก
 * เกิน 200 ข้อรวมของเดิม = ตัดส่วนเกิน (ตัวนับบอกผู้ใช้ก่อนกด)
 */
export function addImportedQuestions(c: QuizSetContent, r: QuizImportResult): QuizSetContent {
  const kept = c.questions.filter((q) => q.prompt.trim());
  const questions = [...kept, ...r.questions].slice(0, QUIZ_MAX_QUESTIONS);
  const skills = [...c.skills, ...r.newSkills].filter((s) => s.name.trim() || questions.some((q) => q.skillId === s.id));
  return { ...c, skills: skills.length ? skills : c.skills, questions: questions.length ? questions : c.questions };
}

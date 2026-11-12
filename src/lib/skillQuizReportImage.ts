/**
 * ═══ รายงานผลแบบทดสอบเป็นรูป PNG ส่งลูกค้า (เจ้าของ 12 พ.ย. 2569: *"เราจะโหลดสรุปแบบรูปส่งลูกค้า"*) ═══
 * หน้าตาตามแบบที่เจ้าของส่งมา: หัวรายงาน · ชื่อ/ตำแหน่ง/เลขที่ · คะแนนรวม+เกรด · ทักษะผ่านเกณฑ์ · แท่งรายทักษะ · บทวิเคราะห์ 3 หัว
 * พื้นขาวเสมอ (รูปไปอยู่ในแชต/อีเมลลูกค้า ไม่ตามธีมเครื่องเรา) · ฟอนต์ Kanit · สีจาก designTokens เท่านั้น
 * ตัวเลขทุกตัวมาจาก `scoreQuiz` ตัวเดียวกับหน้าจอ
 */
import { LOGIN_SCENE, TONE } from '@/lib/designTokens';
import { downloadCanvas } from '@/lib/followDayReportImage';
import { quizSkillTone, scoreQuiz, type QuizAnalysis, type QuizAnswers, type QuizSetContent, type QuizTextScore } from '@/lib/skillQuiz';

export type QuizReportInput = {
  content: QuizSetContent;
  answers: QuizAnswers;
  textScores: Record<string, QuizTextScore>;
  analysis: QuizAnalysis;
  personName: string;
  personRole: string;
  docNo: string;
  submittedAt: string;
};

const FONT_FAMILY = 'Kanit, sans-serif';
const font = (px: number, weight = 400) => `${weight} ${px}px ${FONT_FAMILY}`;

const W = 1000;
const PAD = 48;
const INNER = W - PAD * 2;

const thaiDate = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });

/** ตัดบรรทัดตามความกว้าง — ภาษาไทยไม่มีเว้นวรรค จึงตัดทีละตัวอักษรเมื่อคำยาวเกิน */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of Array.from(para)) {
      const next = line + ch;
      if (ctx.measureText(next).width > maxW && line) {
        const sp = line.lastIndexOf(' ');
        if (sp > 0 && sp > line.length - 30) {
          out.push(line.slice(0, sp));
          line = line.slice(sp + 1) + ch;
        } else {
          out.push(line);
          line = ch;
        }
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

const SECTIONS: { key: keyof QuizAnalysis; label: string; tone: 'success' | 'warn' | 'primary' }[] = [
  { key: 'strengths', label: 'จุดแข็ง', tone: 'success' },
  { key: 'gap', label: 'Skill Gap', tone: 'warn' },
  { key: 'advice', label: 'ข้อเสนอแนะต่อ Operation', tone: 'primary' },
];

export function drawQuizReport(input: QuizReportInput): HTMLCanvasElement {
  const r = scoreQuiz(input.content, input.answers, input.textScores);
  const measurer = document.createElement('canvas').getContext('2d');
  const analysisLines = SECTIONS.map((s) => {
    if (!measurer) return [input.analysis[s.key]];
    measurer.font = font(17);
    return input.analysis[s.key].trim() ? wrap(measurer, input.analysis[s.key].trim(), INNER - 36) : ['—'];
  });

  const headTop = PAD;
  const statsTop = headTop + 200;
  const skillsTop = statsTop + 170;
  const SKILL_H = 64;
  const analysisTop = skillsTop + 50 + r.skills.length * SKILL_H + 30;
  const LINE_H = 28;
  const analysisH = 50 + analysisLines.reduce((a, l) => a + 36 + l.length * LINE_H + 14, 0);
  const footTop = analysisTop + analysisH + 10;
  const height = footTop + 40 + PAD;

  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = W * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, W, height);
  ctx.textBaseline = 'alphabetic';

  // หัวรายงาน — แถบเบอร์กันดีบาง ๆ ด้านบน
  ctx.fillStyle = LOGIN_SCENE.burgundy;
  ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = LOGIN_SCENE.muted;
  ctx.font = font(15, 500);
  ctx.fillText(input.content.headerLine, PAD, headTop + 18);
  ctx.fillStyle = LOGIN_SCENE.ink;
  ctx.font = font(30, 600);
  ctx.fillText(input.content.title, PAD, headTop + 60);

  ctx.font = font(26, 600);
  ctx.fillText(input.personName, PAD, headTop + 118);
  ctx.fillStyle = LOGIN_SCENE.muted;
  ctx.font = font(19);
  if (input.personRole) ctx.fillText(input.personRole, PAD, headTop + 150);
  ctx.font = font(16);
  ctx.fillText(`${input.docNo} | ${thaiDate(input.submittedAt)}`, PAD, headTop + (input.personRole ? 178 : 150));

  // กล่องตัวเลขสองช่อง
  const boxW = (INNER - 24) / 2;
  const boxes: [string, string, string, string | null][] = [
    ['คะแนนทักษะรวม', r.score === null ? '—' : String(r.score), '/100', r.grade ? `Grade ${r.grade}` : null],
    ['ทักษะผ่านเกณฑ์', r.passedSkills === null ? '—' : `${r.passedSkills}/${r.skills.length}`, '', `เกณฑ์ขั้นต่ำ ${input.content.passScore} คะแนน`],
  ];
  boxes.forEach(([label, big, unit, sub], i) => {
    const x = PAD + i * (boxW + 24);
    ctx.fillStyle = LOGIN_SCENE.line;
    ctx.beginPath();
    ctx.roundRect(x, statsTop, boxW, 140, 16);
    ctx.fill();
    const cx = x + boxW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = LOGIN_SCENE.muted;
    ctx.font = font(17);
    ctx.fillText(label, cx, statsTop + 34);
    ctx.fillStyle = LOGIN_SCENE.ink;
    ctx.font = font(48, 600);
    const bigW = ctx.measureText(big).width;
    ctx.font = font(22);
    const unitW = unit ? ctx.measureText(` ${unit}`).width : 0;
    ctx.textAlign = 'left';
    const startX = cx - (bigW + unitW) / 2;
    ctx.font = font(48, 600);
    ctx.fillText(big, startX, statsTop + 90);
    if (unit) {
      ctx.font = font(22);
      ctx.fillStyle = LOGIN_SCENE.muted;
      ctx.fillText(` ${unit}`, startX + bigW, statsTop + 90);
    }
    ctx.textAlign = 'center';
    if (sub) {
      if (i === 0) {
        ctx.font = font(16, 500);
        const pw = ctx.measureText(sub).width + 28;
        ctx.fillStyle = TONE[quizSkillTone(r.score ?? 0, input.content.passScore)].hex;
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.roundRect(cx - pw / 2, statsTop + 104, pw, 26, 13);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillText(sub, cx, statsTop + 123);
      } else {
        ctx.fillStyle = LOGIN_SCENE.muted;
        ctx.font = font(16);
        ctx.fillText(sub, cx, statsTop + 122);
      }
    }
    ctx.textAlign = 'left';
  });

  // แท่งรายทักษะ
  ctx.fillStyle = LOGIN_SCENE.ink;
  ctx.font = font(22, 600);
  ctx.fillText('Technical Skill Profile', PAD, skillsTop + 24);
  r.skills.forEach((s, i) => {
    const top = skillsTop + 50 + i * SKILL_H;
    const score = s.score ?? 0;
    const tone = TONE[quizSkillTone(score, input.content.passScore)].hex;
    ctx.fillStyle = LOGIN_SCENE.ink;
    ctx.font = font(18);
    ctx.fillText(s.name, PAD, top + 20);
    ctx.textAlign = 'right';
    ctx.font = font(20, 500);
    ctx.fillStyle = s.passed === false ? TONE.danger.hex : LOGIN_SCENE.ink;
    ctx.fillText(s.score === null ? 'รอตรวจ' : `${s.score}/100`, W - PAD, top + 20);
    ctx.textAlign = 'left';
    ctx.fillStyle = LOGIN_SCENE.line;
    ctx.beginPath();
    ctx.roundRect(PAD, top + 32, INNER, 12, 6);
    ctx.fill();
    if (score > 0) {
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.roundRect(PAD, top + 32, Math.max(12, (INNER * score) / 100), 12, 6);
      ctx.fill();
    }
  });

  // บทวิเคราะห์
  ctx.fillStyle = LOGIN_SCENE.line;
  ctx.fillRect(PAD, analysisTop - 16, INNER, 1);
  ctx.fillStyle = LOGIN_SCENE.ink;
  ctx.font = font(22, 600);
  ctx.fillText('ผลวิเคราะห์ความสามารถ', PAD, analysisTop + 20);
  let y = analysisTop + 50;
  SECTIONS.forEach((s, i) => {
    ctx.fillStyle = TONE[s.tone].hex;
    ctx.beginPath();
    ctx.arc(PAD + 9, y + 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = LOGIN_SCENE.ink;
    ctx.font = font(19, 600);
    ctx.fillText(s.label, PAD + 30, y + 19);
    y += 36;
    ctx.font = font(17);
    ctx.fillStyle = LOGIN_SCENE.ink;
    for (const line of analysisLines[i]) {
      ctx.fillText(line, PAD + 30, y + 18);
      y += LINE_H;
    }
    y += 14;
  });

  // ท้ายรูป
  const qCount = input.content.questions.length;
  ctx.fillStyle = LOGIN_SCENE.muted;
  ctx.font = font(14);
  ctx.fillText(`คะแนนจากแบบทดสอบ ${qCount} ข้อ · ${r.skills.length} ทักษะ · เกณฑ์ผ่านรายทักษะ ${input.content.passScore} คะแนน`, PAD, footTop + 24);
  return canvas;
}

/** โหลดรูป — false = เซฟไม่ได้ ให้จอบอก */
export async function downloadQuizReportPng(input: QuizReportInput): Promise<boolean> {
  try {
    await Promise.all([document.fonts.load(font(30, 600)), document.fonts.load(font(17)), document.fonts.load(font(48, 600))]);
  } catch {
    /* โหลดฟอนต์ไม่ได้ก็วาดต่อ */
  }
  const name = input.personName.replace(/[\\/:*?"<>|]/g, '').trim() || 'ผลแบบทดสอบ';
  return downloadCanvas(drawQuizReport(input), `${input.docNo} ${name}.png`);
}

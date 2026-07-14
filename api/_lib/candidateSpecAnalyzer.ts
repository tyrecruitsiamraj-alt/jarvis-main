import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ollamaChat, checkOllamaReachable } from './ollamaClient.js';
import { logError } from './logger.js';
import { parseLenientJson } from './jsonRepair.js';

export type CandidateSpecAnalysis = {
  request_no: string | null;
  analyzed_at: string;
  job_family_code: string;
  job_family_label: string;
  job_family_emoji: string;
  compensation_verdict: 'ok' | 'risk' | 'fail';
  compensation_note: string;
  compliance_verdict: 'pass' | 'caution' | 'fail';
  compliance_note: string;
  urgency_level: 'high' | 'normal' | 'low';
  urgency_emoji: string;
  summary: string;
  must_have: string[];
  nice_to_have: string[];
  not_applicable: string[];
  adjacent_positions: Array<{ tier: 'green' | 'yellow' | 'red'; title: string; note: string }>;
  excluded_positions: Array<{ title: string; reason: string }>;
  warnings: string[];
  confirm_with_client: string[];
  sections_markdown: string;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const specCache = new Map<string, { at: number; value: CandidateSpecAnalysis }>();

function projectRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

function readSkill(rel: string): string {
  const full = path.join(projectRoot(), 'skills/candidate-spec-analyzer', rel);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8');
}

function buildSystemPrompt(): string {
  const taxonomy = readSkill('references/job-family-taxonomy.md');
  const labor = readSkill('references/labor-quickref.md');
  const template = readSkill('templates/candidate-spec-template.md');
  const experts = [
    'experts/01-job-task-analysis.md',
    'experts/02-persona-appearance-gate.md',
    'experts/03-compensation-market.md',
    'experts/04-labor-compliance.md',
    'experts/05-sourcing-adjacent-positions.md',
    'experts/06-operations-site-fit.md',
  ]
    .map((rel) => readSkill(rel))
    .filter(Boolean)
    .join('\n\n');

  return `คุณคือ Candidate Spec Analyzer สำหรับ Outsource Service (SO PEOPLE).
ทำตามหลัก: classify Job Family ก่อน → วิเคราะห์ 6 มุม (งาน/บุคลิก/รายได้/compliance/ตำแหน่งใกล้เคียง/ปฏิบัติการ) → ตอบ JSON เท่านั้น
ห้ามเดาฟิลด์ที่ไม่มีในใบขอ ห้ามใช้ "อยู่สถานที่เดียวกัน" เป็นตัวตัดสินตำแหน่งใกล้เคียง

${taxonomy}

${labor}

แนวทางวิเคราะห์ของผู้เชี่ยวชาญแต่ละมุม:
${experts}

โครงสร้างรายงานอ้างอิง:
${template}

ตอบ JSON เท่านั้น (ห้าม markdown code fence) ตาม schema ใน user message`;
}

function jobToPromptText(job: Record<string, unknown>): string {
  const pick = (key: string) => {
    const v = job[key];
    if (v == null || v === '') return null;
    return String(v);
  };

  const lines = [
    ['เลขที่ใบขอ', pick('request_no')],
    ['ผู้ส่ง', pick('submittedByName') || pick('submittedByEmail')],
    ['วันที่ส่ง', pick('request_date')],
    ['วันที่ต้องการ', pick('required_date')],
    ['หน่วยงาน', pick('unit_name')],
    ['รหัสไซต์', pick('site_code')],
    ['สถานที่ทำงาน', pick('location_address')],
    ['ลักษณะงาน', pick('staff_title_name') || pick('job_type')],
    ['ตำแหน่ง (รายละเอียด)', [pick('job_description_code_1'), pick('job_description_code_2')].filter(Boolean).join(' / ') || null],
    ['ช่วงอายุ', [pick('age_range_min'), pick('age_range_max')].filter(Boolean).join('-') || null],
    ['เพศ', pick('gender_requirement')],
    ['ประเภทใบขอ', pick('request_action_name') || pick('request_action_code')],
    ['จำนวนที่ต้องการ', pick('position_units')],
    ['รายได้', pick('total_income')],
    ['วันเวลาเข้างาน', pick('work_schedule')],
    ['ผู้ติดต่อหน่วยงาน', pick('contact_name')],
    ['เบอร์ติดต่อ', pick('contact_phone')],
    ['ทำงานวันสุดท้าย (กรณีทดแทน)', pick('lastWorkingDay')],
    ['คนลาออก', pick('resigned_employee_name')],
    ['สาเหตุลาออก', pick('resigned_reason')],
    ['รายละเอียดเพิ่ม (override parser)', pick('parser_override_text')],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`);

  return `วิเคราะห์ใบขอต่อไปนี้ตาม Candidate Spec Analyzer skill:

${lines.join('\n')}

ข้อกำหนดความละเอียด (ต้องครบทุกข้อ):
- summary: 2-4 ประโยค ระบุ Job Family, ความเร่งด่วน, และประเด็นเด่นที่สุด
- must_have: อย่างน้อย 4 รายการ อิงทักษะ/คุณสมบัติจริงของตำแหน่งนี้
- nice_to_have: อย่างน้อย 2 รายการ
- adjacent_positions: อย่างน้อย 4 ตำแหน่ง กระจายทั้ง tier green/yellow/red — แต่ละตำแหน่งต้องระบุใน note ว่า "สกิลอะไรที่ถ่ายโอนได้" และ "ต้องเช็ค/เทรนอะไรเพิ่ม" ห้ามตอบ list ว่าง
- excluded_positions: อย่างน้อย 2 ตำแหน่งที่ดูใกล้เคียงแต่ต้องตัดออก พร้อมเหตุผลอ้างอิง Gate
- confirm_with_client: คำถามที่ต้องยืนยันกับหน่วยงานก่อนหาคน
- sections_markdown: รายงานเต็ม 7 sections ตาม template

ตอบ JSON เท่านั้น ตาม schema:
{
  "job_family_code": "A|B|C|D|E|F",
  "job_family_label": "ชื่อ Job Family",
  "job_family_emoji": "emoji",
  "compensation_verdict": "ok|risk|fail",
  "compensation_note": "สั้น ๆ",
  "compliance_verdict": "pass|caution|fail",
  "compliance_note": "สั้น ๆ",
  "urgency_level": "high|normal|low",
  "urgency_emoji": "🔴|🟡|🟢",
  "summary": "สรุป 1-2 ประโยค",
  "must_have": ["..."],
  "nice_to_have": ["..."],
  "not_applicable": ["..."],
  "adjacent_positions": [{"tier":"green|yellow|red","title":"...","note":"..."}],
  "excluded_positions": [{"title":"...","reason":"..."}],
  "warnings": ["..."],
  "confirm_with_client": ["..."],
  "sections_markdown": "Markdown 7 sections"
}`;
}

function normalizeAnalysis(raw: Record<string, unknown>, requestNo: string | null): CandidateSpecAnalysis {
  const asString = (v: unknown, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
  const asList = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => asString(x)).filter(Boolean) : [];

  const compensation = asString(raw.compensation_verdict, 'risk');
  const compliance = asString(raw.compliance_verdict, 'caution');
  const urgency = asString(raw.urgency_level, 'normal');

  return {
    request_no: requestNo,
    analyzed_at: new Date().toISOString(),
    job_family_code: asString(raw.job_family_code, '?'),
    job_family_label: asString(raw.job_family_label, 'ไม่ระบุ'),
    job_family_emoji: asString(raw.job_family_emoji, '📋'),
    compensation_verdict: compensation === 'ok' || compensation === 'fail' ? compensation : 'risk',
    compensation_note: asString(raw.compensation_note),
    compliance_verdict: compliance === 'pass' || compliance === 'fail' ? compliance : 'caution',
    compliance_note: asString(raw.compliance_note),
    urgency_level: urgency === 'high' || urgency === 'low' ? urgency : 'normal',
    urgency_emoji: asString(raw.urgency_emoji, urgency === 'high' ? '🔴' : urgency === 'low' ? '🟢' : '🟡'),
    summary: asString(raw.summary, 'วิเคราะห์เสร็จแล้ว'),
    must_have: asList(raw.must_have),
    nice_to_have: asList(raw.nice_to_have),
    not_applicable: asList(raw.not_applicable),
    adjacent_positions: Array.isArray(raw.adjacent_positions)
      ? raw.adjacent_positions
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const row = item as Record<string, unknown>;
            const tier = asString(row.tier, 'yellow');
            const title = asString(row.title);
            if (!title) return null;
            return {
              tier: tier === 'green' || tier === 'red' ? tier : 'yellow',
              title,
              note: asString(row.note),
            };
          })
          .filter(Boolean) as CandidateSpecAnalysis['adjacent_positions']
      : [],
    excluded_positions: Array.isArray(raw.excluded_positions)
      ? raw.excluded_positions
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const row = item as Record<string, unknown>;
            const title = asString(row.title);
            if (!title) return null;
            return { title, reason: asString(row.reason) };
          })
          .filter(Boolean) as CandidateSpecAnalysis['excluded_positions']
      : [],
    warnings: asList(raw.warnings),
    confirm_with_client: asList(raw.confirm_with_client),
    sections_markdown: asString(raw.sections_markdown),
  };
}

function parseModelJson(text: string): Record<string, unknown> {
  return parseLenientJson<Record<string, unknown>>(text);
}

export function getCachedCandidateSpec(jobId: string): CandidateSpecAnalysis | null {
  const hit = specCache.get(jobId);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    specCache.delete(jobId);
    return null;
  }
  return hit.value;
}

export async function analyzeCandidateSpecForJob(
  jobId: string,
  job: Record<string, unknown>,
  options?: { refresh?: boolean },
): Promise<CandidateSpecAnalysis> {
  if (!options?.refresh) {
    const cached = getCachedCandidateSpec(jobId);
    if (cached) return cached;
  }

  const reach = await checkOllamaReachable();
  if (!reach.ok) {
    throw new Error(reach.error);
  }

  const messages: Parameters<typeof ollamaChat>[0]['messages'] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: jobToPromptText(job) },
  ];

  // โมเดลตอบไม่เหมือนกันทุกรอบ — parse พังให้ลองใหม่อีกครั้งก่อนคืน error
  const maxAttempts = 2;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const content = await ollamaChat({
      format: 'json',
      timeoutMs: 180_000,
      think: false,
      messages,
    });

    try {
      const parsed = normalizeAnalysis(
        parseModelJson(content),
        (job.request_no as string) || null,
      );
      specCache.set(jobId, { at: Date.now(), value: parsed });
      return parsed;
    } catch (e) {
      lastError = e;
      logError('candidate-spec.parse.fail', {
        jobId,
        attempt,
        chars: content.length,
        head: content.slice(0, 300),
        tail: content.slice(-300),
      });
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

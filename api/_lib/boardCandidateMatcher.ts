import { ollamaChat } from './ollamaClient.js';
import { logError } from './logger.js';
import { parseLenientJson } from './jsonRepair.js';
import { listBoardReadyCandidates, type BoardReadyCandidate } from './boardCandidatesSql.js';
import {
  analyzeCandidateSpecForJob,
  getCachedCandidateSpec,
  type CandidateSpecAnalysis,
} from './candidateSpecAnalyzer.js';
import { isJobFamilyCode, classifyJobFamily, selectShortlist } from './jobFamilyLexicon.js';
import { saveBoardMatchResult } from './boardMatchStore.js';

/**
 * แมท "คนของเรา" (ผ่านสัมภาษณ์ รอลงงาน จาก board) กับใบขอ
 * คอนเซปเดียวกับ iRecruit matcher: spec(AI) → pre-rank(code, สกิล job1/job2) → AI จัดอันดับ+เหตุผล
 */
export type BoardCandidateMatch = BoardReadyCandidate & {
  full_name: string;
  tier: 'green' | 'yellow' | 'red';
  reason: string;
  prescore: number;
};

export type BoardMatchResult = {
  jobId: string;
  request_no: string | null;
  job_family_code: string;
  job_family_label: string;
  pool_size: number;
  shortlisted: number;
  matches: BoardCandidateMatch[];
};

const SHORTLIST_SIZE = 20;

const STOPWORDS = new Set([
  'พนักงาน',
  'เจ้าหน้าที่',
  'งาน',
  'ทั่วไป',
  'ระดับ',
  'ประจำ',
  'staff',
  'service',
  'general',
  'ไม่ระบุ',
]);

function buildJobTitle(job: Record<string, unknown>): string {
  const pick = (k: string) => {
    const v = job[k];
    const s = v == null ? '' : String(v).trim();
    return s && s !== 'ไม่ระบุ' ? s : '';
  };
  const detail = [pick('job_description_code_1'), pick('job_description_code_2')]
    .filter(Boolean)
    .join(' ');
  const title = pick('staff_title_name');
  return [detail, title].filter(Boolean).join(' ').trim() || pick('job_type');
}

function seedTerms(spec: CandidateSpecAnalysis, jobTitle: string): string[] {
  const raw: string[] = [jobTitle, spec.job_family_label];
  for (const a of spec.adjacent_positions) raw.push(a.title);
  const terms = new Set<string>();
  for (const phrase of raw) {
    if (!phrase) continue;
    const cleaned = phrase.trim().toLowerCase();
    if (cleaned.length >= 2 && !STOPWORDS.has(cleaned)) terms.add(cleaned);
    for (const piece of cleaned.split(/[\s/(),\-–—|]+/)) {
      const p = piece.trim();
      if (p.length >= 2 && !STOPWORDS.has(p)) terms.add(p);
    }
  }
  return [...terms];
}

/** ข้อความสกิลของผู้สมัคร — job1/job2 คือตำแหน่งที่คัดไว้แล้ว (สัญญาณหลัก) */
function candidateText(c: BoardReadyCandidate): string {
  return `${c.job1_name || ''} ${c.job2_name || ''} ${c.site_name || ''}`.toLowerCase();
}

function prescore(c: BoardReadyCandidate, terms: string[], jobTitle: string): number {
  const text = candidateText(c);
  if (!text.trim()) return 0;
  let score = 0;
  const jt = jobTitle.trim().toLowerCase();
  for (const t of terms) {
    if (!text.includes(t)) continue;
    score += t === jt ? 5 : t.length >= 4 ? 2 : 1;
  }
  return score;
}

function fullName(c: BoardReadyCandidate): string {
  return (
    [c.first_name, c.last_name].filter(Boolean).join(' ').trim() ||
    c.nick_name ||
    `การ์ด #${c.card_id}`
  );
}

function buildMatchPrompt(
  spec: CandidateSpecAnalysis,
  jobTitle: string,
  job: Record<string, unknown>,
  shortlist: BoardReadyCandidate[],
): { system: string; user: string } {
  const adjacent = spec.adjacent_positions
    .map((a) => `- [${a.tier}] ${a.title}${a.note ? ` (${a.note})` : ''}`)
    .join('\n');

  const system = `คุณคือผู้ช่วยจับคู่ "คนของเรา" (ผู้สมัครที่ผ่านสัมภาษณ์แล้ว รอลงงาน) กับใบขอกำลังคน (Outsource Service).
คนกลุ่มนี้ผ่านการคัดเลือกแล้ว — สกิล/ตำแหน่ง (job1/job2) เชื่อถือได้ ให้น้ำหนักการแมทสกิลเป็นหลัก รองลงมาคือพื้นที่และเงินเดือนที่ขอ
เกณฑ์ tier:
- green = สกิลตรงหรือใกล้มาก ลงงานได้ทันที
- yellow = พอเป็นไปได้ ต้องเช็ค (สกิลข้างเคียง/พื้นที่ไกล/เงินเดือนขอสูงกว่า)
- red = ห่างไกล — ใส่เฉพาะถ้าจำเป็น
ถ้าคนในรายชื่อสกิลคนละสายงานกับใบขอชัดเจน (เช่น คนขับรถ กับ งานอ่านมาตร/ธุรการ/ช่างเทคนิค) ห้ามฝืนให้ tier green/yellow เด็ดขาด ต้องให้เป็น red หรือไม่ใส่ในผลลัพธ์เลย
ในเหตุผล (reason) ห้ามระบุรายละเอียดที่ไม่ได้อยู่ในข้อมูลที่ให้มา (เช่น ประเภทรถ ยี่ห้อ รุ่น ใบรับรอง) ใช้ได้เฉพาะฟิลด์ที่ให้จริง: สกิล/เพศ/อายุ/เงินเดือนขอ/พื้นที่ ตอบ JSON เท่านั้น`;

  const income = job.total_income != null ? Number(job.total_income) : null;
  const cand = shortlist
    .map((c) => {
      const parts = [
        `#${c.card_id}`,
        `สกิล: ${[c.job1_name, c.job2_name].filter(Boolean).join(' / ') || 'ไม่ระบุ'}`,
        c.sex_code ? `เพศ:${c.sex_code}` : '',
        c.age ? `อายุ:${c.age}` : '',
        c.required_salary ? `เงินเดือนขอ:${c.required_salary}` : '',
        [c.amphur_name, c.province_name].filter(Boolean).join(' ') || '',
      ].filter(Boolean);
      return parts.join(' | ');
    })
    .join('\n');

  const user = `ใบขอต้องการตำแหน่ง: ${jobTitle}
Job Family: ${spec.job_family_code} ${spec.job_family_label}
สรุปสเปค: ${spec.summary}
คุณสมบัติต้องมี: ${spec.must_have.join(', ') || '-'}
รายได้ที่ให้: ${income ?? 'ไม่ระบุ'}
สถานที่ทำงาน: ${String(job.location_address || job.unit_name || 'ไม่ระบุ')}
ตำแหน่งใกล้เคียงที่รับได้:
${adjacent || '-'}

รายชื่อคนของเราที่รอลงงาน (id | สกิล | ข้อมูล):
${cand}

จัดอันดับคนที่เหมาะที่สุดก่อน ตอบ JSON เท่านั้น:
{
  "matches": [
    { "id": <card id>, "tier": "green|yellow|red", "reason": "เหตุผลสั้น ๆ: สกิลตรงยังไง พื้นที่/เงินเดือนต้องเช็คอะไร" }
  ]
}
ใส่เฉพาะ green/yellow เป็นหลัก (เรียงดีสุดก่อน) ถ้าไม่มีใครเข้าข่ายให้ matches เป็น []`;

  return { system, user };
}

function parseMatches(text: string): Array<{ id: number; tier: string; reason: string }> {
  const obj = parseLenientJson<{ matches?: unknown }>(text);
  if (!Array.isArray(obj.matches)) return [];
  return obj.matches
    .map((m) => {
      if (!m || typeof m !== 'object') return null;
      const row = m as Record<string, unknown>;
      const id = Number(String(row.id ?? '').replace(/[^0-9]/g, ''));
      if (!Number.isFinite(id) || id === 0) return null;
      return {
        id,
        tier: String(row.tier || 'yellow'),
        reason: typeof row.reason === 'string' ? row.reason.trim() : '',
      };
    })
    .filter((x): x is { id: number; tier: string; reason: string } => Boolean(x));
}

export async function matchBoardCandidatesForJob(
  jobId: string,
  job: Record<string, unknown>,
  options?: { refresh?: boolean },
): Promise<BoardMatchResult> {
  const spec =
    (!options?.refresh && getCachedCandidateSpec(jobId)) ||
    (await analyzeCandidateSpecForJob(jobId, job, { refresh: options?.refresh }));

  const jobTitle = buildJobTitle(job) || spec.job_family_label || '';

  // pool เล็ก (~ร้อยคน) — ดึงทั้งหมดแล้ว pre-rank ในโค้ด
  const pool = await listBoardReadyCandidates({ limit: 1000 });

  const terms = seedTerms(spec, jobTitle);
  const scored = pool
    .map((c) => ({ c, s: prescore(c, terms, jobTitle) }))
    .sort((a, b) => b.s - a.s);

  // family ของใบขอ (จาก AI candidate-spec ถ้ามี ไม่งั้น classify จากชื่อตำแหน่ง) — กันเติม shortlist ข้าม family
  // เช่น pool เป็นคนขับรถทั้งหมด แต่ใบขอเป็นงานอ่านมาตร/ธุรการ ต้องไม่ฝืนส่งคนขับรถให้ AI เลือก
  const family = isJobFamilyCode(spec.job_family_code) ? spec.job_family_code : classifyJobFamily(jobTitle);
  const shortlistItems = selectShortlist(scored, SHORTLIST_SIZE, family, candidateText);
  const shortlist = shortlistItems.map((x) => x.c);
  const scoreById = new Map(shortlistItems.map((x) => [x.c.card_id, x.s]));

  if (shortlist.length === 0) {
    const empty: BoardMatchResult = {
      jobId,
      request_no: spec.request_no,
      job_family_code: spec.job_family_code,
      job_family_label: spec.job_family_label,
      pool_size: pool.length,
      shortlisted: 0,
      matches: [],
    };
    await saveBoardMatchResult(jobId, empty);
    return empty;
  }

  const { system, user } = buildMatchPrompt(spec, jobTitle, job, shortlist);
  let ranked: Array<{ id: number; tier: string; reason: string }> = [];
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let content = '';
    try {
      content = await ollamaChat({
        format: 'json',
        think: false,
        timeoutMs: 180_000,
        temperature: 0.15,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      ranked = parseMatches(content);
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      logError('board-match.ai.fail', {
        jobId,
        attempt,
        shortlisted: shortlist.length,
        chars: content.length,
        head: content.slice(0, 200),
      });
    }
  }
  if (lastError) throw lastError instanceof Error ? lastError : new Error(String(lastError));

  const byId = new Map(shortlist.map((c) => [c.card_id, c]));
  const matches: BoardCandidateMatch[] = [];
  const seen = new Set<number>();
  for (const r of ranked) {
    const c = byId.get(r.id);
    if (!c || seen.has(r.id)) continue;
    seen.add(r.id);
    matches.push({
      ...c,
      full_name: fullName(c),
      tier: r.tier === 'green' || r.tier === 'red' ? r.tier : 'yellow',
      reason: r.reason,
      prescore: scoreById.get(c.card_id) ?? 0,
    });
  }

  const result: BoardMatchResult = {
    jobId,
    request_no: spec.request_no,
    job_family_code: spec.job_family_code,
    job_family_label: spec.job_family_label,
    pool_size: pool.length,
    shortlisted: shortlist.length,
    matches,
  };
  await saveBoardMatchResult(jobId, result);
  return result;
}

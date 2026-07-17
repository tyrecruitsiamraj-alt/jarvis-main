import { ollamaChat } from './ollamaClient.js';
import { logError } from './logger.js';
import { parseLenientJson } from './jsonRepair.js';
import {
  listRecruitCandidatesForMatch,
  listRecruitCandidatesByKeywords,
  type RecruitCandidateForMatch,
} from './recruitRegisterSql.js';
import {
  analyzeCandidateSpecForJob,
  getCachedCandidateSpec,
  type CandidateSpecAnalysis,
} from './candidateSpecAnalyzer.js';
import { isJobFamilyCode, classifyJobFamily, selectShortlist } from './jobFamilyLexicon.js';

export type IrecruitCandidateMatch = {
  id: number;
  full_name: string;
  phone_number: string | null;
  line_id: string | null;
  position_name: string | null;
  job_name_th: string | null;
  specific_name: string | null;
  location_label: string | null;
  province_name: string | null;
  district_name: string | null;
  driving_licenses: string[];
  sex: string | null;
  age: number | null;
  weight: string | null;
  height: string | null;
  process_status_name: string;
  applied_at: string;
  /** ผล AI: green=เข้าข่ายมาก / yellow=พอได้ ต้องเช็ค / red=ห่างไกล */
  tier: 'green' | 'yellow' | 'red';
  reason: string;
  /** คะแนน pre-rank (ก่อน AI) ใช้ debug */
  prescore: number;
};

export type IrecruitMatchResult = {
  jobId: string;
  request_no: string | null;
  job_family_code: string;
  job_family_label: string;
  /** สเปคจาก Candidate Spec Analyzer (ใช้ cache ร่วมกัน) */
  analysis: CandidateSpecAnalysis;
  /** จำนวนผู้สมัครที่เข้าเกณฑ์คีย์เวิร์ด (หรือคนล่าสุดถ้า fallback) */
  pool_size: number;
  /** 'keyword' = ค้นทั่วทั้งฐานด้วยคีย์เวิร์ดตำแหน่ง, 'recent' = fallback คนล่าสุด */
  search_scope: 'keyword' | 'recent';
  shortlisted: number;
  matches: IrecruitCandidateMatch[];
};

const MAX_POOL = 800;
const SHORTLIST_SIZE = 20;

/** คำกว้างเกินไป — ตัดทิ้งไม่ให้ปน (เช่น "พนักงาน" จะไป match "พนักงานขับรถ") */
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

/** แตกคำจากข้อความ (ไทยไม่มีช่องว่าง — ตัดด้วยตัวคั่นทั่วไป + เก็บวลีเต็มด้วย) */
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
      if (p.length >= 2 && !STOPWORDS.has(p) && !/^\(.*\)$/.test(p)) terms.add(p);
    }
  }
  return [...terms];
}

/** ชื่อตำแหน่งจริงมักอยู่ใน job_description_code_1/2 ไม่ใช่ staff_title_name ("พนักงาน") */
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
  // ถ้ามีรายละเอียดตำแหน่ง ใช้เป็นหลัก (staff_title มักเป็น "พนักงาน" กว้าง ๆ)
  return [detail, title].filter(Boolean).join(' ').trim() || pick('job_type');
}

function candidateText(c: RecruitCandidateForMatch): string {
  return `${c.position_name || ''} ${c.job_name_th || ''}`.toLowerCase();
}

/** pre-rank แบบเร็ว: นับ seed term ที่ปรากฏใน text ของผู้สมัคร (ชื่อตำแหน่งเต็มให้น้ำหนักมากกว่า) */
function prescore(c: RecruitCandidateForMatch, terms: string[], jobTitle: string): number {
  const text = candidateText(c);
  if (!text.trim()) return 0;
  let score = 0;
  const jt = jobTitle.trim().toLowerCase();
  for (const t of terms) {
    if (!text.includes(t)) continue;
    // วลียาว/ตรงกับชื่อตำแหน่งใบขอ = สัญญาณแรง
    score += t === jt ? 5 : t.length >= 4 ? 2 : 1;
  }
  return score;
}

function fullName(c: RecruitCandidateForMatch): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || '(ไม่ระบุชื่อ)';
}

function buildMatchPrompt(
  spec: CandidateSpecAnalysis,
  jobTitle: string,
  shortlist: RecruitCandidateForMatch[],
): { system: string; user: string } {
  const adjacent = spec.adjacent_positions
    .map((a) => `- [${a.tier}] ${a.title}${a.note ? ` (${a.note})` : ''}`)
    .join('\n');

  const system = `คุณคือผู้ช่วยจับคู่ผู้สมัครกับใบขอกำลังคน (Outsource Service).
ตัดสินว่าผู้สมัครแต่ละคน "เข้าข่าย" กับใบขอนี้แค่ไหน โดยดูจากตำแหน่งที่เขาสมัคร (position_name / job_name) เทียบกับตำแหน่งที่ต้องการและตำแหน่งใกล้เคียง (adjacent) ที่ระบุไว้
เกณฑ์ tier:
- green = ตำแหน่งตรงหรือใกล้มาก (อยู่ Job Family เดียวกัน/adjacent tier เขียว) เสนอได้ทันที
- yellow = พอเป็นไปได้ แต่ต้องเช็ค/เทรนเพิ่ม (adjacent เหลือง)
- red = ห่างไกล คนละสายงาน — ใส่เฉพาะถ้าจำเป็น
ถ้าผู้สมัครสกิลคนละสายงานกับใบขอชัดเจน (เช่น คนขับรถ กับ งานอ่านมาตร/ธุรการ/ช่างเทคนิค) ห้ามฝืนให้ tier green/yellow เด็ดขาด ต้องให้เป็น red หรือไม่ใส่ในผลลัพธ์เลย
ในเหตุผล (reason) ห้ามระบุรายละเอียดที่ไม่ได้อยู่ในข้อมูลที่ให้มา (เช่น ประเภทรถ ยี่ห้อ รุ่น ใบรับรอง) ใช้ได้เฉพาะฟิลด์ที่ให้จริง: ตำแหน่งที่สมัคร/เพศ/อายุ/ใบขับขี่/พื้นที่ ตอบ JSON เท่านั้น`;

  const cand = shortlist
    .map((c, i) => {
      const parts = [
        `#${c.id}`,
        `สมัคร: ${c.position_name || c.job_name_th || 'ไม่ระบุ'}`,
        c.sex ? `เพศ:${c.sex}` : '',
        c.age ? `อายุ:${c.age}` : '',
        c.driving_licenses.length ? `ใบขับขี่:${c.driving_licenses.join(',')}` : '',
        c.location_label ? `พื้นที่:${c.location_label}` : '',
      ].filter(Boolean);
      return parts.join(' | ');
    })
    .join('\n');

  const user = `ใบขอต้องการตำแหน่ง: ${jobTitle}
Job Family: ${spec.job_family_code} ${spec.job_family_label}
สรุปสเปค: ${spec.summary}
คุณสมบัติต้องมี: ${spec.must_have.join(', ') || '-'}
ตำแหน่งใกล้เคียงที่รับได้:
${adjacent || '-'}

รายชื่อผู้สมัคร (id | ตำแหน่งที่สมัคร | ข้อมูล):
${cand}

จัดอันดับผู้สมัครที่เข้าข่ายที่สุดก่อน ตอบ JSON เท่านั้น:
{
  "matches": [
    { "id": <id ผู้สมัคร>, "tier": "green|yellow|red", "reason": "เหตุผลสั้น ๆ ว่าทำไมเข้าข่าย/ต้องเช็คอะไร" }
  ]
}
ใส่เฉพาะคนที่ tier green หรือ yellow เป็นหลัก (เรียงดีสุดก่อน) ถ้าไม่มีใครเข้าข่ายเลยให้ matches เป็น []`;

  return { system, user };
}

function parseMatches(text: string): Array<{ id: number; tier: string; reason: string }> {
  const obj = parseLenientJson<{ matches?: unknown }>(text);
  if (!Array.isArray(obj.matches)) return [];
  return obj.matches
    .map((m) => {
      if (!m || typeof m !== 'object') return null;
      const row = m as Record<string, unknown>;
      // AI มักตอบ id เป็น "#206387" หรือ "206387" — ดึงเฉพาะตัวเลข
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

export async function matchIrecruitCandidatesForJob(
  jobId: string,
  job: Record<string, unknown>,
  options?: { owner?: string; refresh?: boolean },
): Promise<IrecruitMatchResult> {
  // 1) สเปคจากใบขอ (ใช้ cache ถ้ามี ไม่งั้นวิเคราะห์ใหม่)
  const spec =
    (!options?.refresh && getCachedCandidateSpec(jobId)) ||
    (await analyzeCandidateSpecForJob(jobId, job, { refresh: options?.refresh }));

  const jobTitle = buildJobTitle(job) || spec.job_family_label || '';

  // 2) ค้นผู้สมัคร iRecruit — กรองด้วยคีย์เวิร์ดตำแหน่งทั่วทั้งฐานก่อน (ครอบคลุมทุกคน ไม่ใช่แค่คนล่าสุด)
  const terms = seedTerms(spec, jobTitle);
  const dbKeywords = terms.filter((t) => t.length >= 3 && !t.includes(' '));
  let pool = await listRecruitCandidatesByKeywords(dbKeywords, {
    owner: options?.owner,
    limit: MAX_POOL,
  });
  let searchScope: 'keyword' | 'recent' = 'keyword';
  // ถ้าคีย์เวิร์ดไม่เจอใครเลย (ตำแหน่งแปลก) → fallback เป็นคนล่าสุด
  if (pool.length === 0) {
    pool = await listRecruitCandidatesForMatch({ owner: options?.owner, limit: 500 });
    searchScope = 'recent';
  }

  // 3) pre-rank + คัด shortlist
  const scored = pool
    .map((c) => ({ c, s: prescore(c, terms, jobTitle) }))
    .sort((a, b) => b.s - a.s);

  // family ของใบขอ (จาก AI candidate-spec ถ้ามี ไม่งั้น classify จากชื่อตำแหน่ง) — กันเติม shortlist ข้าม family
  // เช่น ค้นด้วยคีย์เวิร์ดไม่เจอใครเลย fallback เป็นคนล่าสุด ต้องไม่ฝืนส่งคนละสายงานให้ AI เลือก
  const family = isJobFamilyCode(spec.job_family_code) ? spec.job_family_code : classifyJobFamily(jobTitle);
  const shortlistItems = selectShortlist(scored, SHORTLIST_SIZE, family, candidateText);
  const shortlist = shortlistItems.map((x) => x.c);
  const scoreById = new Map(shortlistItems.map((x) => [x.c.id, x.s]));

  if (shortlist.length === 0) {
    return {
      jobId,
      request_no: spec.request_no,
      job_family_code: spec.job_family_code,
      job_family_label: spec.job_family_label,
      analysis: spec,
      pool_size: pool.length,
      search_scope: searchScope,
      shortlisted: 0,
      matches: [],
    };
  }

  // 4) AI จัดอันดับ shortlist (retry เพราะโมเดลตอบไม่เหมือนกันทุกรอบ)
  const { system, user } = buildMatchPrompt(spec, jobTitle, shortlist);
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
      logError('irecruit-match.ai.fail', {
        jobId,
        attempt,
        shortlisted: shortlist.length,
        chars: content.length,
        head: content.slice(0, 200),
        tail: content.slice(-200),
      });
    }
  }
  if (lastError) throw lastError instanceof Error ? lastError : new Error(String(lastError));

  // 5) join กลับเป็น record เต็ม (คงลำดับที่ AI จัดมา)
  const byId = new Map(shortlist.map((c) => [c.id, c]));
  const matches: IrecruitCandidateMatch[] = [];
  const seen = new Set<number>();
  for (const r of ranked) {
    const c = byId.get(r.id);
    if (!c || seen.has(r.id)) continue;
    seen.add(r.id);
    const tier = r.tier === 'green' || r.tier === 'red' ? r.tier : 'yellow';
    matches.push({
      id: c.id,
      full_name: fullName(c),
      phone_number: c.phone_number,
      line_id: c.line_id,
      position_name: c.position_name,
      job_name_th: c.job_name_th,
      specific_name: c.specific_name,
      location_label: c.location_label,
      province_name: c.province_name,
      district_name: c.district_name,
      driving_licenses: c.driving_licenses,
      sex: c.sex,
      age: c.age,
      weight: c.weight,
      height: c.height,
      process_status_name: c.process_status_name,
      applied_at: c.created_at,
      tier,
      reason: r.reason,
      prescore: scoreById.get(c.id) ?? 0,
    });
  }

  return {
    jobId,
    request_no: spec.request_no,
    job_family_code: spec.job_family_code,
    job_family_label: spec.job_family_label,
    analysis: spec,
    pool_size: pool.length,
    search_scope: searchScope,
    shortlisted: shortlist.length,
    matches,
  };
}

/**
 * AI matcher ของ **เลนสรรหา** — ค้นข้าม 3 แหล่งในรอบเดียว (R2b · 16 ส.ค. 2569)
 *
 * ต่างจาก `irecruitCandidateMatcher` (เลนคัดสรร ค้นเฉพาะ iRecruit) ตรงที่กองมาจาก
 * iRecruit + ฐานใหม่ So Recruit + ถัง Checklist แล้ว **ติดป้ายแหล่งทุกคน**
 *
 * กติกาที่ห้ามพลาด:
 * - แหล่งไหนล่ม → กองที่เหลือต้องยังทำงานได้ (เก็บ error ต่อแหล่งไปโชว์ ไม่ throw ทั้งก้อน)
 * - คนซ้ำข้ามแหล่ง (เบอร์เดียวกัน) ตัดเหลือคนเดียว ไม่งั้นโดนสองสายเรื่องงานเดียวกัน
 * - คนที่อยู่บนบอร์ดถังอื่นแล้ว = **ได้ใบสมัครแล้ว** → เป็นงานของคัดสรร ตัดออกจากกองสรรหา
 *   (ยกเว้นถัง Checklist ซึ่งเป็นกองของเลนนี้เอง)
 * - AI อ้างถึงคนด้วย **เลขลำดับในรายการ** ไม่ใช่ id ของฐาน — id ข้ามฐานชนกันได้
 *   (iRecruit id 1234 กับ card_id 1234 คนละคน) แล้ว join กลับผิดตัวแบบเงียบ ๆ
 */
import { ollamaChat } from './ollamaClient.js';
import { logError, logInfo } from './logger.js';
import { parseLenientJson } from './jsonRepair.js';
import { listRecruitCandidatesByKeywords, listRecruitCandidatesForMatch } from './recruitRegisterSql.js';
import { listSoRecruitLeadsForMatch } from './soRecruitLeadsSql.js';
import { listBoardReadyCandidates, boardChecklistColumnId } from './boardCandidatesSql.js';
import { loadBoardPhoneSet } from './applicationBoardLink.js';
import { toE164Thai } from './thaiPhone.js';
import {
  analyzeCandidateSpecForJob,
  getCachedCandidateSpec,
  type CandidateSpecAnalysis,
} from './candidateSpecAnalyzer.js';
import { isJobFamilyCode, classifyJobFamily, selectShortlist } from './jobFamilyLexicon.js';
import {
  RECRUIT_SOURCE_LABEL,
  countBySource,
  dedupePoolByPhone,
  fromChecklistCard,
  fromIrecruitCandidate,
  fromSoRecruitLead,
  poolCandidateText,
  type RecruitPoolCandidate,
  type RecruitPoolSource,
} from './recruitLanePool.js';

const MAX_IRECRUIT_POOL = 800;
const MAX_LEAD_POOL = 800;
const MAX_CHECKLIST_POOL = 1500;
const SHORTLIST_SIZE = 20;

/** คำกว้างเกินไป — ตัดทิ้งไม่ให้ปน (ชุดเดียวกับ irecruitCandidateMatcher) */
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

export type RecruitLaneMatch = RecruitPoolCandidate & {
  tier: 'green' | 'yellow' | 'red';
  reason: string;
  source_label: string;
  prescore: number;
};

export type RecruitLaneSourceStat = {
  source: RecruitPoolSource;
  label: string;
  /** จำนวนที่ดึงมาได้จากแหล่งนั้น (ก่อนตัดซ้ำ/ตัดคนขึ้นบอร์ด) */
  loaded: number;
  /** อ่านแหล่งนี้ไม่ได้ (ฐานล่ม/ยังไม่ตั้งค่า) — null = ปกติ */
  error: string | null;
};

export type RecruitLaneMatchResult = {
  jobId: string;
  request_no: string | null;
  job_family_code: string;
  job_family_label: string;
  analysis: CandidateSpecAnalysis;
  pool_size: number;
  sources: RecruitLaneSourceStat[];
  /** ตัดออกเพราะซ้ำข้ามแหล่ง (เบอร์เดียวกัน) */
  duplicates_dropped: number;
  /** ตัดออกเพราะขึ้นบอร์ดแล้ว = ได้ใบสมัครแล้ว (เป็นงานของคัดสรร) */
  on_board_dropped: number;
  /** true = เช็คบอร์ดไม่ได้ (ERP ล่ม) → ยอด on_board_dropped เชื่อไม่ได้ ต้องติดธงบนจอ */
  board_check_unavailable: boolean;
  shortlisted: number;
  matches: RecruitLaneMatch[];
};

/** แตกคำจากสเปค (ชุดเดียวกับเลนคัดสรร — คนละกองแต่เกณฑ์คำเหมือนกัน) */
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
  return [detail, title].filter(Boolean).join(' ').trim() || pick('job_type');
}

export function prescorePoolCandidate(
  c: RecruitPoolCandidate,
  terms: string[],
  jobTitle: string,
): number {
  const text = poolCandidateText(c);
  if (!text.trim()) return 0;
  let score = 0;
  const jt = jobTitle.trim().toLowerCase();
  for (const t of terms) {
    if (!text.includes(t)) continue;
    score += t === jt ? 5 : t.length >= 4 ? 2 : 1;
  }
  return score;
}

// ─── โหลดกองแต่ละแหล่ง (แหล่งไหนล่มก็ไม่ล้มทั้งก้อน) ────────────────────────

type SourceLoad = { candidates: RecruitPoolCandidate[]; error: string | null };

async function loadIrecruit(keywords: string[], owner?: string): Promise<SourceLoad> {
  try {
    let rows = await listRecruitCandidatesByKeywords(keywords, { owner, limit: MAX_IRECRUIT_POOL });
    if (rows.length === 0) {
      rows = await listRecruitCandidatesForMatch({ owner, limit: 500 });
    }
    return { candidates: rows.map(fromIrecruitCandidate), error: null };
  } catch (e) {
    return { candidates: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function loadSoRecruit(): Promise<SourceLoad> {
  try {
    const rows = await listSoRecruitLeadsForMatch(MAX_LEAD_POOL);
    return { candidates: rows.map(fromSoRecruitLead), error: null };
  } catch (e) {
    return { candidates: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function loadChecklist(): Promise<SourceLoad> {
  try {
    const rows = await listBoardReadyCandidates({
      columnIds: [boardChecklistColumnId()],
      limit: MAX_CHECKLIST_POOL,
      excludeInformed: true,
    });
    return { candidates: rows.map(fromChecklistCard), error: null };
  } catch (e) {
    return { candidates: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * ตัดคนที่ขึ้นบอร์ดถังอื่นแล้ว (= ได้ใบสมัครแล้ว → งานของคัดสรร) ออกจากกองสรรหา
 * คนจากถัง Checklist **ไม่ถูกตัด** ทั้งที่อยู่บนบอร์ด — ถังนั้นคือกองของเลนนี้เอง
 * ⚠️ `boardPhones` = null แปลว่า ERP อ่านไม่ได้ → **ไม่ตัดใคร** แล้วติดธงแทน
 * ("เช็คไม่ได้" ≠ "ไม่มีใครอยู่บนบอร์ด" — ตัดมั่วจะทำให้กองหายทั้งกอง)
 */
export function dropCandidatesAlreadyOnBoard(
  pool: RecruitPoolCandidate[],
  boardPhones: Set<string> | null,
  normalizePhone: (raw: string | null) => string | null,
): { kept: RecruitPoolCandidate[]; dropped: number } {
  if (!boardPhones) return { kept: pool, dropped: 0 };
  const kept: RecruitPoolCandidate[] = [];
  let dropped = 0;
  for (const c of pool) {
    if (c.source === 'checklist') {
      kept.push(c);
      continue;
    }
    const e164 = normalizePhone(c.phone_number);
    if (e164 && boardPhones.has(e164)) {
      dropped += 1;
      continue;
    }
    kept.push(c);
  }
  return { kept, dropped };
}

// ─── prompt (pure — เทสต์ได้) ──────────────────────────────────────────────

export function buildLaneMatchPrompt(
  spec: CandidateSpecAnalysis,
  jobTitle: string,
  shortlist: RecruitPoolCandidate[],
): { system: string; user: string } {
  const adjacent = spec.adjacent_positions
    .map((a) => `- [${a.tier}] ${a.title}${a.note ? ` (${a.note})` : ''}`)
    .join('\n');

  const system = `คุณคือผู้ช่วยจับคู่ผู้สมัครกับใบขอกำลังคน (Outsource Service).
ตัดสินว่าผู้สมัครแต่ละคน "เข้าข่าย" กับใบขอนี้แค่ไหน โดยดูจากตำแหน่งที่เขาสนใจ/เคยสมัคร เทียบกับตำแหน่งที่ต้องการและตำแหน่งใกล้เคียง (adjacent) ที่ระบุไว้
คนกลุ่มนี้ยังไม่ได้สมัครงานใบนี้ — เป็นการโทรไปเสนองาน
เกณฑ์ tier:
- green = ตำแหน่งตรงหรือใกล้มาก (อยู่ Job Family เดียวกัน/adjacent tier เขียว) เสนอได้ทันที
- yellow = พอเป็นไปได้ แต่ต้องเช็ค/เทรนเพิ่ม (adjacent เหลือง)
- red = ห่างไกล คนละสายงาน — ใส่เฉพาะถ้าจำเป็น
ถ้าผู้สมัครสกิลคนละสายงานกับใบขอชัดเจน (เช่น คนขับรถ กับ งานอ่านมาตร/ธุรการ/ช่างเทคนิค) ห้ามฝืนให้ tier green/yellow เด็ดขาด ต้องให้เป็น red หรือไม่ใส่ในผลลัพธ์เลย
ในเหตุผล (reason) ห้ามระบุรายละเอียดที่ไม่ได้อยู่ในข้อมูลที่ให้มา (เช่น ประเภทรถ ยี่ห้อ รุ่น ใบรับรอง) ใช้ได้เฉพาะฟิลด์ที่ให้จริง: ตำแหน่งที่สนใจ/เพศ/อายุ/ใบขับขี่/พื้นที่ ตอบ JSON เท่านั้น`;

  const cand = shortlist
    .map((c, i) => {
      const parts = [
        `#${i + 1}`,
        `แหล่ง: ${RECRUIT_SOURCE_LABEL[c.source]}`,
        `สนใจ/เคยสมัคร: ${c.position_text || 'ไม่ระบุ'}`,
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

รายชื่อผู้สมัคร (ลำดับ | แหล่ง | ตำแหน่งที่สนใจ | ข้อมูล):
${cand}

จัดอันดับผู้สมัครที่เข้าข่ายที่สุดก่อน ตอบ JSON เท่านั้น โดย no คือ **เลขลำดับ** ในรายการข้างบน (1-${shortlist.length}):
{
  "matches": [
    { "no": <เลขลำดับ>, "tier": "green|yellow|red", "reason": "เหตุผลสั้น ๆ ว่าทำไมเข้าข่าย/ต้องเช็คอะไร" }
  ]
}
ใส่เฉพาะคนที่ tier green หรือ yellow เป็นหลัก (เรียงดีสุดก่อน) ถ้าไม่มีใครเข้าข่ายเลยให้ matches เป็น []`;

  return { system, user };
}

/**
 * อ่านผล AI → (ลำดับ 1-based, tier, reason)
 * รับทั้ง `no` และ `id` (โมเดลชอบสลับคีย์) แต่แปลความเป็น **ลำดับ** เสมอ
 * เลขนอกช่วง/ซ้ำ = ทิ้ง (ดีกว่า join ผิดคน)
 */
export function parseLaneMatches(
  text: string,
  shortlistSize: number,
): Array<{ index: number; tier: string; reason: string }> {
  const obj = parseLenientJson<{ matches?: unknown }>(text);
  if (!Array.isArray(obj.matches)) return [];
  const seen = new Set<number>();
  const out: Array<{ index: number; tier: string; reason: string }> = [];
  for (const m of obj.matches) {
    if (!m || typeof m !== 'object') continue;
    const row = m as Record<string, unknown>;
    const raw = row.no ?? row.index ?? row.id;
    const n = Number(String(raw ?? '').replace(/[^0-9]/g, ''));
    if (!Number.isInteger(n) || n < 1 || n > shortlistSize) continue;
    const index = n - 1;
    if (seen.has(index)) continue;
    seen.add(index);
    out.push({
      index,
      tier: String(row.tier || 'yellow'),
      reason: typeof row.reason === 'string' ? row.reason.trim() : '',
    });
  }
  return out;
}

// ─── ตัวหลัก ──────────────────────────────────────────────────────────────

export async function matchRecruitLaneCandidatesForJob(
  jobId: string,
  job: Record<string, unknown>,
  options?: { owner?: string; refresh?: boolean },
): Promise<RecruitLaneMatchResult> {
  const spec =
    (!options?.refresh && getCachedCandidateSpec(jobId)) ||
    (await analyzeCandidateSpecForJob(jobId, job, { refresh: options?.refresh }));

  const jobTitle = buildJobTitle(job) || spec.job_family_label || '';
  const terms = seedTerms(spec, jobTitle);
  const dbKeywords = terms.filter((t) => t.length >= 3 && !t.includes(' '));

  // 3 แหล่งพร้อมกัน + เซ็ตเบอร์บนบอร์ด (ใช้ตัดคนที่ได้ใบสมัครแล้ว)
  const [irecruit, soRecruit, checklist, boardPhones] = await Promise.all([
    loadIrecruit(dbKeywords, options?.owner),
    loadSoRecruit(),
    loadChecklist(),
    loadBoardPhoneSet().catch(() => null),
  ]);

  const sources: RecruitLaneSourceStat[] = [
    {
      source: 'irecruit',
      label: RECRUIT_SOURCE_LABEL.irecruit,
      loaded: irecruit.candidates.length,
      error: irecruit.error,
    },
    {
      source: 'so_recruit',
      label: RECRUIT_SOURCE_LABEL.so_recruit,
      loaded: soRecruit.candidates.length,
      error: soRecruit.error,
    },
    {
      source: 'checklist',
      label: RECRUIT_SOURCE_LABEL.checklist,
      loaded: checklist.candidates.length,
      error: checklist.error,
    },
  ];

  const merged = [...checklist.candidates, ...soRecruit.candidates, ...irecruit.candidates];
  const { pool: deduped, droppedDuplicates } = dedupePoolByPhone(merged, toE164Thai);
  const { kept: pool, dropped: onBoardDropped } = dropCandidatesAlreadyOnBoard(
    deduped,
    boardPhones,
    toE164Thai,
  );

  logInfo('recruit-lane.pool', {
    jobId,
    ...countBySource(pool),
    duplicates: droppedDuplicates.length,
    onBoardDropped,
    boardUnavailable: boardPhones === null,
  });

  const base = {
    jobId,
    request_no: spec.request_no,
    job_family_code: spec.job_family_code,
    job_family_label: spec.job_family_label,
    analysis: spec,
    pool_size: pool.length,
    sources,
    duplicates_dropped: droppedDuplicates.length,
    on_board_dropped: onBoardDropped,
    board_check_unavailable: boardPhones === null,
  };

  const scored = pool
    .map((c) => ({ c, s: prescorePoolCandidate(c, terms, jobTitle) }))
    .sort((a, b) => b.s - a.s);

  const family = isJobFamilyCode(spec.job_family_code)
    ? spec.job_family_code
    : classifyJobFamily(jobTitle);
  const shortlistItems = selectShortlist(scored, SHORTLIST_SIZE, family, poolCandidateText);
  const shortlist = shortlistItems.map((x) => x.c);

  if (shortlist.length === 0) {
    return { ...base, shortlisted: 0, matches: [] };
  }

  const { system, user } = buildLaneMatchPrompt(spec, jobTitle, shortlist);
  let ranked: Array<{ index: number; tier: string; reason: string }> = [];
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
      ranked = parseLaneMatches(content, shortlist.length);
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      logError('recruit-lane.ai.fail', {
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

  const matches: RecruitLaneMatch[] = ranked.map((r) => {
    const c = shortlist[r.index];
    const tier = r.tier === 'green' || r.tier === 'red' ? r.tier : 'yellow';
    return {
      ...c,
      tier,
      reason: r.reason,
      source_label: RECRUIT_SOURCE_LABEL[c.source],
      prescore: shortlistItems[r.index]?.s ?? 0,
    };
  });

  return { ...base, shortlisted: shortlist.length, matches };
}

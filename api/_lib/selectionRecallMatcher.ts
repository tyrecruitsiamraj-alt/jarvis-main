/**
 * เลนคัดสรร — เส้น "ชวนกลับ" ที่วิ่งขนานกับใบสมัครใหม่
 * (เจ้าของสั่ง 16 ส.ค. 2569: *"งานคัดสรรทำเป็นแบบคู่ขนานเลย มีใบขอมาก็ยังไปเข้าคิว
 * หาคนที่มีเหมือนเดิม แต่ไปหาจากกล่องคนที่ไม่สนใจงานนะ ... อันที่ AI หามาก็โทรไปเลย"*)
 *
 * กอง = คนที่**สมัครกับเราแล้ว** แต่เคยตอบ `declined` กับงานอื่น
 * → ยังเป็นงานของเลนคัดสรร (เขามีใบสมัครแล้ว ไม่ต้องเก็บใหม่)
 *
 * ⚠️ **ไม่ใช่เลนสรรหา** — ใช้รูปข้อมูล/prescore/prompt ร่วมกับ `recruitLaneMatcher`
 * เพื่อไม่เขียนสองชุด แต่กองคนละกองและ endpoint คนละเส้น
 * ⚠️ **คนที่ปฏิเสธใบขอใบนี้เอง ถูกตัดตั้งแต่คิวรี** ไม่ใช่มาหวังพึ่ง cooldown
 */
import { ollamaChat } from './ollamaClient.js';
import { logError, logInfo } from './logger.js';
import { listDeclinedApplicantsForJob } from './declinedApplicantsSql.js';
import { toE164Thai } from './thaiPhone.js';
import {
  analyzeCandidateSpecForJob,
  getCachedCandidateSpec,
  type CandidateSpecAnalysis,
} from './candidateSpecAnalyzer.js';
import { isJobFamilyCode, classifyJobFamily, selectShortlist } from './jobFamilyLexicon.js';
import {
  buildLaneMatchPrompt,
  parseLaneMatches,
  prescorePoolCandidate,
  type RecruitLaneMatch,
} from './recruitLaneMatcher.js';
import {
  RECRUIT_SOURCE_LABEL,
  dedupePoolByPhone,
  fromDeclinedApplicant,
  poolCandidateText,
} from './recruitLanePool.js';

const SHORTLIST_SIZE = 20;

export type SelectionRecallResult = {
  jobId: string;
  request_no: string | null;
  job_family_label: string;
  analysis: CandidateSpecAnalysis;
  /** ขนาดกองหลังตัดซ้ำ */
  pool_size: number;
  /** อ่านกองไม่ได้ (ฐานล่ม/ยังไม่ migrate) — ต้องต่างจาก "กองว่าง" */
  pool_unavailable: boolean;
  duplicates_dropped: number;
  shortlisted: number;
  matches: RecruitLaneMatch[];
};

/** ชื่อตำแหน่งจริงมักอยู่ใน job_description_code_1/2 ไม่ใช่ staff_title_name */
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

const STOPWORDS = new Set(['พนักงาน', 'เจ้าหน้าที่', 'งาน', 'ทั่วไป', 'ระดับ', 'ประจำ', 'ไม่ระบุ']);

function seedTerms(spec: CandidateSpecAnalysis, jobTitle: string): string[] {
  const raw = [jobTitle, spec.job_family_label, ...spec.adjacent_positions.map((a) => a.title)];
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

export async function matchDeclinedApplicantsForJob(
  jobId: string,
  job: Record<string, unknown>,
  options?: { refresh?: boolean },
): Promise<SelectionRecallResult> {
  const spec =
    (!options?.refresh && getCachedCandidateSpec(jobId)) ||
    (await analyzeCandidateSpecForJob(jobId, job, { refresh: options?.refresh }));

  const jobTitle = buildJobTitle(job) || spec.job_family_label || '';

  let rows: Awaited<ReturnType<typeof listDeclinedApplicantsForJob>> = [];
  let poolUnavailable = false;
  try {
    rows = await listDeclinedApplicantsForJob(jobId);
  } catch (e) {
    poolUnavailable = true;
    logError('selection-recall.pool.fail', {
      jobId,
      message: e instanceof Error ? e.message : String(e),
    });
  }

  const { pool, droppedDuplicates } = dedupePoolByPhone(rows.map(fromDeclinedApplicant), toE164Thai);

  const base = {
    jobId,
    request_no: spec.request_no,
    job_family_label: spec.job_family_label,
    analysis: spec,
    pool_size: pool.length,
    pool_unavailable: poolUnavailable,
    duplicates_dropped: droppedDuplicates.length,
  };

  logInfo('selection-recall.pool', {
    jobId,
    loaded: rows.length,
    pool: pool.length,
    duplicates: droppedDuplicates.length,
    unavailable: poolUnavailable,
  });

  if (pool.length === 0) return { ...base, shortlisted: 0, matches: [] };

  const terms = seedTerms(spec, jobTitle);
  const scored = pool
    .map((c) => ({ c, s: prescorePoolCandidate(c, terms, jobTitle) }))
    .sort((a, b) => b.s - a.s);

  const family = isJobFamilyCode(spec.job_family_code)
    ? spec.job_family_code
    : classifyJobFamily(jobTitle);
  const shortlistItems = selectShortlist(scored, SHORTLIST_SIZE, family, poolCandidateText);
  const shortlist = shortlistItems.map((x) => x.c);
  if (shortlist.length === 0) return { ...base, shortlisted: 0, matches: [] };

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
      logError('selection-recall.ai.fail', { jobId, attempt, chars: content.length });
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
      source_label: RECRUIT_SOURCE_LABEL.declined,
      prescore: shortlistItems[r.index]?.s ?? 0,
    };
  });

  return { ...base, shortlisted: shortlist.length, matches };
}

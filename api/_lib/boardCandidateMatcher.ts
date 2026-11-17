import { aiChat } from './aiClient.js';
import { logInfo, logError } from './logger.js';
import { parseLenientJson } from './jsonRepair.js';
import {
  listBoardReadyCandidates,
  boardMatchColumnIds,
  type BoardReadyCandidate,
} from './boardCandidatesSql.js';
import {
  analyzeCandidateSpecForJob,
  getCachedCandidateSpec,
  type CandidateSpecAnalysis,
} from './candidateSpecAnalyzer.js';
import { isJobFamilyCode, classifyJobFamily, selectShortlist } from './jobFamilyLexicon.js';
import { saveBoardMatchResult } from './boardMatchStore.js';
import { enqueueLumosReminderForBoardMatch } from './lumosDispatch.js';
import { isAutoDispatchEnabled } from './lumosDispatchMode.js';
import {
  AREA_RANK_LABEL,
  jobAreaOf,
  orderPoolForShortlist,
  requiredGenderLabel,
  type AreaRank,
} from '../../src/lib/matchProximity.js';

/**
 * แมท "คนของเรา" (ผ่านสัมภาษณ์ รอลงงาน จาก board) กับใบขอ
 * คอนเซปเดียวกับ iRecruit matcher: spec(AI) → pre-rank(code, สกิล job1/job2) → AI จัดอันดับ+เหตุผล
 */
export type BoardCandidateMatch = BoardReadyCandidate & {
  full_name: string;
  tier: 'green' | 'yellow' | 'red';
  reason: string;
  prescore: number;
  /** ความใกล้กับงาน (ระบบคิด ไม่ใช่ AI · 17 พ.ย. 2569) — ผลเก่าไม่มี */
  area_rank?: AreaRank;
  area_label?: string;
};

export type BoardMatchResult = {
  jobId: string;
  request_no: string | null;
  job_family_code: string;
  job_family_label: string;
  pool_size: number;
  shortlisted: number;
  matches: BoardCandidateMatch[];
  /** เป้าที่ต้องหาให้ได้ = อัตราที่ขอ × 3 (กติกา 3 ส.ค. 2569) */
  recommended_target?: number;
  /** true = ถังแรก (ไม่มีงาน) หาได้ต่ำกว่าเป้า จึงค้นถังถัดไป (Re Use → Drop) เพิ่มแล้ว */
  fallback_used?: boolean;
  fallback_pool_size?: number;
};

const SHORTLIST_SIZE = 20;

/** ต้องหาได้อย่างน้อยกี่เท่าของอัตราที่ขอ ก่อนจะถือว่า "พอ" ไม่ต้องค้นถังต่อ */
const RECOMMEND_MULTIPLIER = 3;

/** คนที่ AI แนะนำจริง = เขียว+เหลือง (แดงคือทางเลือกสำรอง ไม่นับเข้าเป้า) */
export function recommendedCount(matches: Array<{ tier: 'green' | 'yellow' | 'red' }>): number {
  return matches.filter((m) => m.tier === 'green' || m.tier === 'yellow').length;
}

/**
 * ตัดสินว่าถังนี้ "พอ" หรือยัง — นับเฉพาะเขียว (17 พ.ย. 2569)
 * เดิมนับเหลืองด้วย ⇒ คนไกลที่ได้เหลืองนับเข้าเป้าจนไม่เคยค้น Re Use / Drop
 */
export function greenCount(matches: Array<{ tier: 'green' | 'yellow' | 'red' }>): number {
  return matches.filter((m) => m.tier === 'green').length;
}


/**
 * เป้าจำนวนคนแนะนำต่อใบขอ = อัตราที่ขอ × 3 (ขอ 3 ต้องมีอย่างน้อย 9)
 * ต่ำกว่านี้ให้ค้นถังถัดไป (ไม่มีงาน → Re Use → Drop) — อัตราอ่านแบบเดียวกับหน้าจอ (ขั้นต่ำ 1)
 */
export function recommendedTarget(job: Record<string, unknown>): number {
  const raw = Number(job.request_positions ?? job.position_units ?? 1);
  const qty = Math.max(1, Number.isFinite(raw) ? Math.round(raw) : 1);
  return qty * RECOMMEND_MULTIPLIER;
}

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
  areaOf: (c: BoardReadyCandidate) => AreaRank | null,
): { system: string; user: string } {
  const adjacent = spec.adjacent_positions
    .map((a) => `- [${a.tier}] ${a.title}${a.note ? ` (${a.note})` : ''}`)
    .join('\n');

  // 17 พ.ย. 2569: พื้นที่และเงินเดือน ระบบคิดเองแล้วบอก AI (เดิม AI เทียบเงินผิด "15,000 ต่ำกว่างบ 12,500" และเดาพื้นที่ให้คนที่ไม่มีที่อยู่)
  const system = `คุณคือผู้ช่วยจับคู่ "คนของเรา" (ผู้สมัครบนบอร์ดที่ยังไม่มีงานลง) กับใบขอกำลังคน (Outsource Service).
คนกลุ่มนี้เคยผ่านการคัดเลือกแล้ว — สกิล/ตำแหน่ง (job1/job2) เชื่อถือได้ ให้น้ำหนักการแมทสกิลเป็นหลัก รองลงมาคือความใกล้งาน
แต่ละคนมี "ใกล้งาน" ที่ระบบคำนวณจากจังหวัด/อำเภอแล้ว (อำเภอเดียวกับงาน > จังหวัดเดียวกับงาน > ภาคเดียวกับงาน > ไม่มีที่อยู่ > คนละภาคกับงาน) ใช้ค่านี้ตามที่ให้ ห้ามเดาพื้นที่เอง
เกณฑ์ tier:
- green = สกิลตรงหรือใกล้มาก และอยู่จังหวัดเดียวกับงานหรือใกล้กว่า
- yellow = พอเป็นไปได้ ต้องเช็ค (สกิลข้างเคียง / อยู่ภาคเดียวกันแต่คนละจังหวัด / ไม่มีที่อยู่)
- red = ห่างไกล — คนละภาคกับงาน หรือสกิลห่าง ใส่เฉพาะถ้าจำเป็น
ถ้าคนในรายชื่อสกิลคนละสายงานกับใบขอชัดเจน (เช่น คนขับรถ กับ งานอ่านมาตร/ธุรการ/ช่างเทคนิค) ห้ามฝืนให้ tier green/yellow เด็ดขาด ต้องให้เป็น red หรือไม่ใส่ในผลลัพธ์เลย
เหตุผล (reason) เขียนเฉพาะเรื่องสกิล/ประสบการณ์ ห้ามเขียนเรื่องเงินเดือนและพื้นที่ (ระบบแสดงให้เองแล้ว) ห้ามระบุรายละเอียดที่ไม่ได้อยู่ในข้อมูล (เช่น ประเภทรถ ยี่ห้อ รุ่น ใบรับรอง) ตอบ JSON เท่านั้น`;

  const income = job.total_income != null ? Number(job.total_income) : null;
  const cand = shortlist
    .map((c) => {
      const parts = [
        `#${c.card_id}`,
        `สกิล: ${[c.job1_name, c.job2_name].filter(Boolean).join(' / ') || 'ไม่ระบุ'}`,
        c.sex_code ? `เพศ:${c.sex_code}` : '',
        c.age ? `อายุ:${c.age}` : '',
        [c.amphur_name, c.province_name].filter(Boolean).join(' ') || '',
        areaOf(c) != null ? `ใกล้งาน:${AREA_RANK_LABEL[areaOf(c)!]}` : '',
      ].filter(Boolean);
      return parts.join(' | ');
    })
    .join('\n');

  const gender = requiredGenderLabel(job.gender_requirement);
  const ageMin = Number(job.age_range_min) || null;
  const ageMax = Number(job.age_range_max) || null;
  const user = `ใบขอต้องการตำแหน่ง: ${jobTitle}
เงื่อนไขที่ระบบกรองให้แล้ว: เพศ ${gender ?? 'ไม่ระบุ'} · อายุ ${ageMin ?? '-'}–${ageMax ?? '-'} ปี
Job Family: ${spec.job_family_code} ${spec.job_family_label}
สรุปสเปค: ${spec.summary}
คุณสมบัติต้องมี: ${spec.must_have.join(', ') || '-'}
รายได้ที่ให้: ${income ?? 'ไม่ระบุ'}
สถานที่ทำงาน: ${String(job.location_address || job.unit_name || 'ไม่ระบุ')}
ตำแหน่งใกล้เคียงที่รับได้:
${adjacent || '-'}

รายชื่อคนของเราที่ยังไม่มีงานลง (id | สกิล | ข้อมูล):
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

/** ประเมิน 1 ถัง: pre-rank สกิล → family gate → shortlist → AI จัด tier */
async function rankPool(
  jobId: string,
  job: Record<string, unknown>,
  spec: CandidateSpecAnalysis,
  jobTitle: string,
  pool: BoardReadyCandidate[],
): Promise<{ matches: BoardCandidateMatch[]; shortlisted: number }> {
  const terms = seedTerms(spec, jobTitle);
  // 17 พ.ย. 2569: ตัดเพศ/อายุผิดเงื่อนไข แล้วเรียงตามความใกล้ก่อนตัด shortlist (เดิมคะแนนสกิลเท่ากันหมด ได้ 20 คนล่าสุดทั้งประเทศ)
  const area = jobAreaOf(job as Parameters<typeof jobAreaOf>[0]);
  const ordered = orderPoolForShortlist(job, area, pool, (c) => prescore(c, terms, jobTitle));
  const scored = ordered.scored;
  const areaById = new Map(scored.map((x) => [x.c.card_id, x.a]));
  if (ordered.gatedOut.gender || ordered.gatedOut.age) logInfo('board-match.gated', { jobId, ...ordered.gatedOut });

  // family ของใบขอ (จาก AI candidate-spec ถ้ามี ไม่งั้น classify จากชื่อตำแหน่ง) — กันเติม shortlist ข้าม family
  // เช่น pool เป็นคนขับรถทั้งหมด แต่ใบขอเป็นงานอ่านมาตร/ธุรการ ต้องไม่ฝืนส่งคนขับรถให้ AI เลือก
  const family = isJobFamilyCode(spec.job_family_code) ? spec.job_family_code : classifyJobFamily(jobTitle);
  const shortlistItems = selectShortlist(scored, SHORTLIST_SIZE, family, candidateText);
  const shortlist = shortlistItems.map((x) => x.c);
  const scoreById = new Map(shortlistItems.map((x) => [x.c.card_id, x.s]));

  if (shortlist.length === 0) return { matches: [], shortlisted: 0 };

  // อ่านที่ตั้งงานไม่ออก = เทียบไม่ได้ (null) — ไม่ลดใคร ไม่บอก AI
  const areaOf = (c: BoardReadyCandidate): AreaRank | null => (area.province ? (areaById.get(c.card_id) ?? 3) : null);
  const { system, user } = buildMatchPrompt(spec, jobTitle, job, shortlist, areaOf);
  let ranked: Array<{ id: number; tier: string; reason: string }> = [];
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 1; attempt++) {
    let content = '';
    try {
      content = await aiChat({
        task: 'board_match',
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
    const a = areaOf(c);
    const aiTier = r.tier === 'green' || r.tier === 'red' ? r.tier : 'yellow';
    matches.push({
      ...c,
      full_name: fullName(c),
      // ไม่มีที่อยู่ / คนละภาค ห้ามเขียว (ระบบตัดสิน ไม่ใช่ AI)
      tier: aiTier === 'green' && a != null && a >= 3 ? 'yellow' : aiTier,
      reason: r.reason,
      prescore: scoreById.get(c.card_id) ?? 0,
      ...(a != null ? { area_rank: a, area_label: AREA_RANK_LABEL[a] } : {}),
    });
  }
  return { matches, shortlisted: shortlist.length };
}

/**
 * Waterfall (กติกา 3 ส.ค. 2569) ทีละถังตาม `boardMatchColumnIds()` — ถังแรกค้นเสมอ
 * ถ้าแนะนำ (เขียว+เหลือง) ยังน้อยกว่า อัตราที่ขอ × 3 ค่อยค้นถังถัดไป · ผลถังก่อนอยู่หน้าเสมอ (การ์ดพก column_label)
 * 🔴 17 ต.ค. 2569 เจ้าของ *"เอาแค่ ไม่มีงาน reuse Drop ก็พอสำหรับการ match"* — เดิม To do → ไม่มีงาน
 *    ตอนนี้ ไม่มีงาน → Re Use → Drop · ตัดคนแจ้งเข้าแล้ว (ได้งานแล้วห้ามเสนองานใหม่)
 */
export async function matchBoardCandidatesForJob(
  jobId: string,
  job: Record<string, unknown>,
  options?: { refresh?: boolean },
): Promise<BoardMatchResult> {
  const spec =
    (!options?.refresh && getCachedCandidateSpec(jobId)) ||
    (await analyzeCandidateSpecForJob(jobId, job, { refresh: options?.refresh }));

  const jobTitle = buildJobTitle(job) || spec.job_family_label || '';
  const target = recommendedTarget(job);

  let matches: BoardCandidateMatch[] = [];
  let shortlisted = 0;
  let poolSize = 0;
  let fallbackUsed = false;
  let fallbackPoolSize = 0;

  for (const [i, columnId] of boardMatchColumnIds().entries()) {
    if (i > 0 && greenCount(matches) >= target) break;
    // ถังแรกพัง = พังทั้งรอบ (เหมือนเดิม) · ถังถัดไปพังไม่ทำให้ผลถังก่อนหาย
    try {
      const pool = await listBoardReadyCandidates({ columnId, excludeInformed: true, limit: 1000 });
      poolSize += pool.length;
      if (i > 0) {
        fallbackUsed = true;
        fallbackPoolSize += pool.length;
      }
      if (pool.length === 0) continue;
      const ranked = await rankPool(jobId, job, spec, jobTitle, pool);
      const already = new Set(matches.map((m) => m.card_id));
      matches = [...matches, ...ranked.matches.filter((m) => !already.has(m.card_id))];
      shortlisted += ranked.shortlisted;
      if (i > 0) {
        logInfo('board-match.fallback', {
          jobId,
          target,
          columnId,
          pool: pool.length,
          totalRecommended: recommendedCount(matches),
        });
      }
    } catch (e) {
      if (i === 0) throw e;
      logError('board-match.fallback.fail', {
        jobId,
        columnId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const result: BoardMatchResult = {
    jobId,
    request_no: spec.request_no,
    job_family_code: spec.job_family_code,
    job_family_label: spec.job_family_label,
    pool_size: poolSize,
    shortlisted,
    matches,
    recommended_target: target,
    fallback_used: fallbackUsed,
    fallback_pool_size: fallbackPoolSize,
  };
  await saveBoardMatchResult(jobId, result);
  // match เสร็จ → ส่งคนที่แนะนำ (green/yellow) เข้าคิวโทร **เฉพาะเมื่อตั้งโหมดเป็น auto**
  // ค่าเริ่มต้นคือ manual: ต้องติ๊กเลือกแล้วกดส่งเองที่หน้า Matching (POST /api/lumos/dispatch)
  // เปลี่ยนที่หน้าตั้งค่า > โหมดส่งงานให้ Lumos — ไม่ต้องแก้โค้ด
  if (await isAutoDispatchEnabled('board_match')) {
    await enqueueLumosReminderForBoardMatch(job, result);
  }
  return result;
}

import { getSiamrajUnitRequestById } from './siamrajUnitRequests.js';
import { listRecruitRegistrations, type RecruitRegistration } from './recruitRegisterSql.js';
import {
  buildErpBranchDemandInput,
  parseErpBranchDemand,
  type ParsedBranchDemandItem,
} from './erpBranchDemandParser.js';

type MatchLevel = 'high' | 'medium' | 'low';

/** ยิ่งต่ำ = ใกล้กว่า (ใช้เรียงก่อนคะแนน) */
type ProximityRank = 0 | 1 | 2 | 3 | 4;

export type MatchingSuggestion = {
  score: number;
  level: MatchLevel;
  reasons: string[];
  candidate: RecruitRegistration;
  /** 0=ตรงสาขา 1=อำเภอ 2=เขตเมืองใกล้ 3=จังหวัด 4=ไกล */
  proximity_rank: ProximityRank;
};

export type MatchingSuggestionsResult = {
  job: Record<string, unknown>;
  criteria: {
    roleHints: string[];
    genderRequirement: string | null;
    ageMin: number | null;
    ageMax: number | null;
  };
  totalCandidates: number;
  suggestions: MatchingSuggestion[];
};

export type BranchMatchingSuggestionGroup = {
  branch_name_clean: string;
  branch_name_raw: string;
  requested_qty: number;
  confidence: number;
  matched_count: number;
  suggestions: MatchingSuggestion[];
};

type MatchableJob = {
  id: string;
  unit_name?: string;
  request_no?: string;
  gender_requirement?: string;
  age_range_min?: number;
  age_range_max?: number;
  job_type?: string;
  staff_title_name?: string;
  job_description_code_1?: string;
  job_description_code_2?: string;
  location_address?: string;
};

function norm(v: string | null | undefined): string {
  return (v || '').trim().toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function tokenize(v: string): string[] {
  return unique(
    norm(v)
      .split(/[\s,()/\-_.]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2),
  );
}

function roleHintsForJob(job: MatchableJob): string[] {
  const raw = unique([
    job.staff_title_name || '',
    job.job_description_code_1 || '',
    job.job_description_code_2 || '',
  ]);

  const hints = new Set<string>();
  for (const item of raw) {
    for (const token of tokenize(item)) hints.add(token);
  }

  const blob = raw.join(' ').toLowerCase();
  if (/ขับรถ|driver|chauffeur/.test(blob)) {
    hints.add('ขับรถ');
    hints.add('driver');
  }
  if (/ช่าง/.test(blob)) hints.add('ช่าง');
  if (/ธุรการ/.test(blob)) hints.add('ธุรการ');
  if (/ประชาสัมพันธ์/.test(blob)) hints.add('ประชาสัมพันธ์');
  if (/ผู้บริหาร/.test(blob)) hints.add('ผู้บริหาร');

  return [...hints];
}

function isBangkokMetroProvince(province: string | null | undefined): boolean {
  const p = norm(province);
  return /กรุงเทพ|bangkok|นนทบุรี|ปทุมธานี|สมุทรปราการ|สมุทรสาคร|นครปฐม/.test(p);
}

/** สาขาในกทม./ปริมณฑลที่มักระบุชื่อเขต */
function isBangkokAreaBranch(job: MatchableJob, branchHint?: string): boolean {
  const blob = `${norm(job.unit_name)} ${norm(job.location_address)} ${norm(branchHint)}`;
  return /การประปานครหลวง|กรุงเทพ|bangkok|มีนบุรี|ประชาชื่น|บางเขน|สุวรรณภูมิ|ลาดพร้าว|บางนา|พระราม|ดอนเมือง|สวนหลวง|ปทุมวัน|บางกะปิ|บริการ\s*\d+/.test(
    blob,
  );
}

function agePass(job: MatchableJob, candidateAge: number | null): boolean | null {
  if (!Number.isFinite(candidateAge as number)) return null;
  const age = candidateAge as number;
  const min = typeof job.age_range_min === 'number' ? job.age_range_min : null;
  const max = typeof job.age_range_max === 'number' ? job.age_range_max : null;
  if (min == null && max == null) return null;
  if (min != null && age < min) return false;
  if (max != null && age > max) return false;
  return true;
}

function genderPass(job: MatchableJob, rawSex: string | null | undefined): boolean | null {
  const req = norm(job.gender_requirement);
  const sex = norm(rawSex);
  if (!req || req === 'ไม่ระบุ') return null;
  if (!sex) return null;
  if (req === 'ชาย') return sex === 'm' || sex === 'male' || sex === 'ชาย';
  if (req === 'หญิง') return sex === 'f' || sex === 'female' || sex === 'หญิง';
  return null;
}

function roleScore(
  hints: string[],
  candidateJob: string | null,
): { ok: boolean; score: number; reason?: string } {
  const title = norm(candidateJob);
  if (!title) return { ok: false, score: 0 };
  if (hints.length === 0) return { ok: false, score: 0 };

  for (const hint of hints) {
    if (title.includes(hint)) {
      return { ok: true, score: 15, reason: `งานใกล้เคียง: ${candidateJob}` };
    }
  }
  return { ok: false, score: 0 };
}

function levelFromScore(score: number): MatchLevel {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

/**
 * คะแนนความใกล้เคียง (หลัก) — อายุ/เพศเป็นรอง
 * proximity_rank: 0 ใกล้สุด … 4 ไกล
 */
function proximityScore(
  job: MatchableJob,
  candidate: RecruitRegistration,
  branchHint?: string,
  districtHint?: string | null,
  provinceHint?: string | null,
): { score: number; rank: ProximityRank; reasons: string[] } {
  const reasons: string[] = [];
  const branch = norm(branchHint);
  const branchDistrict = norm(districtHint);
  const branchProvince = norm(provinceHint);
  const loc = norm(candidate.location_label);
  const district = norm(candidate.district_name);
  const province = norm(candidate.province_name);
  const jobAddr = norm(job.location_address);
  const unit = norm(job.unit_name);
  const placeBlob = `${branch} ${branchDistrict}`;

  // 1) ตรงเขตของจุดปฏิบัติงานนี้ (เช่น ดุสิต / ห้วยขวาง / มีนบุรี)
  if (branchDistrict && (district.includes(branchDistrict) || loc.includes(branchDistrict))) {
    reasons.push(`ใกล้เขตจุดงาน: ${districtHint}`);
    return { score: 55, rank: 0, reasons };
  }

  // 1b) หลายจุดในใบงานเดียว — ถ้าผู้สมัครอยู่ "เขตอื่นที่ถูกระบุในใบงาน"
  //     ให้ตัดออกจากจุดนี้ (กันคนดุสิตโผล่ในกลุ่มห้วยขวาง)
  if (
    branchDistrict &&
    district &&
    !district.includes(branchDistrict) &&
    !loc.includes(branchDistrict) &&
    jobAddr.includes(district) &&
    district.length >= 2
  ) {
    return {
      score: 0,
      rank: 4,
      reasons: [`อยู่คนละจุดงานในใบนี้ (เขต${candidate.district_name})`],
    };
  }

  // 2) ตรงชื่อสถานที่/สาขาในที่อยู่ผู้สมัคร (token สั้น เช่น สิงห์คอมเพล็กซ์)
  if (branch) {
    const shortTokens = branch
      .split(/[\s()]+/)
      .map((t) => t.trim())
      .filter(
        (t) =>
          t.length >= 3 &&
          !/^(เขต|ถ\.|จก\.?|บริษัท|จำนวน|ปฏิบัติงาน|กรุงเทพฯ?|มหานคร)$/.test(t) &&
          !(branchDistrict && t === branchDistrict),
      );
    for (const token of shortTokens) {
      if (loc.includes(token) || district.includes(token)) {
        reasons.push(`ใกล้สถานที่งาน: ${token}`);
        return { score: 50, rank: 0, reasons };
      }
    }
  }

  // 3) อำเภอตรงกับที่อยู่ใบงาน — แต่ห้ามใช้เมื่อมี district_hint แล้ว
  //    (ใบงานหลายจุดจะรวมเขตทุกจุด ทำให้คนดุสิตโผล่ในกลุ่มห้วยขวาง)
  if (
    !branchDistrict &&
    district &&
    (jobAddr.includes(district) || unit.includes(district) || placeBlob.includes(district))
  ) {
    reasons.push(`อำเภอ/เขตใกล้เคียง: ${candidate.district_name}`);
    return { score: 40, rank: 1, reasons };
  }

  // 4) จังหวัด / กทม. — รองเมื่อยังไม่ตรงเขตจุดงาน
  if (branchProvince && province.includes(branchProvince.replace('มหานคร', ''))) {
    reasons.push(
      branchDistrict
        ? `จังหวัดเดียวกับจุดงาน (ยังไม่ตรงเขต ${districtHint}): ${candidate.province_name}`
        : `จังหวัดจุดงานตรง: ${candidate.province_name}`,
    );
    return { score: branchDistrict ? 22 : 30, rank: 2, reasons };
  }

  if (
    (isBangkokAreaBranch(job, branchHint) || branchProvince.includes('กรุงเทพ') || /กรุงเทพ/.test(jobAddr)) &&
    isBangkokMetroProvince(candidate.province_name)
  ) {
    reasons.push(`ใกล้พื้นที่งาน (กทม./ปริมณฑล): ${candidate.province_name}`);
    return { score: branchDistrict ? 20 : 28, rank: 2, reasons };
  }

  // 5) จังหวัดตรงกับที่อยู่ใบงาน / ชื่อหน่วยงาน
  if (province && (jobAddr.includes(province) || unit.includes(province))) {
    reasons.push(`จังหวัดตรง: ${candidate.province_name}`);
    return { score: 20, rank: 3, reasons };
  }

  // 6) ไกล
  if (province) {
    reasons.push(`ห่างพื้นที่งาน (${candidate.province_name})`);
  }
  return { score: 0, rank: 4, reasons };
}

function scoreCandidateForJob(
  job: MatchableJob,
  candidate: RecruitRegistration,
  hints: string[],
  branchHint?: string,
  districtHint?: string | null,
  provinceHint?: string | null,
): MatchingSuggestion {
  let score = 0;
  const reasons: string[] = [];

  // 1) ความใกล้เคียงก่อน
  const prox = proximityScore(job, candidate, branchHint, districtHint, provinceHint);
  score += prox.score;
  reasons.push(...prox.reasons);

  // 2) ตำแหน่งงาน (รอง)
  const role = roleScore(hints, candidate.job_name_th);
  if (role.ok) {
    score += role.score;
    if (role.reason) reasons.push(role.reason);
  }

  // 3) เพศ (รอง)
  const gender = genderPass(job, candidate.sex);
  if (gender === true) {
    score += 10;
    reasons.push('เพศตรงตามเงื่อนไข');
  } else if (gender === false) {
    score -= 15;
    reasons.push('เพศไม่ตรงตามเงื่อนไข');
  }

  // 4) อายุเป็นโบนัสจัดอันดับ ไม่ใช่ตัวหลัก
  const age = agePass(job, candidate.age);
  if (age === true) {
    score += 8;
    reasons.push('อายุผ่านเกณฑ์');
  } else if (age === false) {
    score -= 8;
    reasons.push('อายุไม่ผ่านเกณฑ์');
  }

  const bounded = Math.max(0, Math.min(100, score));
  return {
    score: bounded,
    level: levelFromScore(bounded),
    reasons,
    candidate,
    proximity_rank: prox.rank,
  };
}

function sortByProximityThenScore(a: MatchingSuggestion, b: MatchingSuggestion): number {
  if (a.proximity_rank !== b.proximity_rank) return a.proximity_rank - b.proximity_rank;
  if (a.score !== b.score) return b.score - a.score;
  return b.candidate.created_at.localeCompare(a.candidate.created_at);
}

/** จำนวนคนที่ดึงจาก iRecruit เพื่อคะแนน — แยกจาก limit ของผลที่คืน */
const DEFAULT_CANDIDATE_POOL = 500;

export async function buildMatchingSuggestions(options: {
  jobId: string;
  owner?: string;
  /** จำนวนผลลัพธ์สูงสุดที่คืน (ไม่ใช่ขนาด pool) */
  limit?: number;
  /** ขนาด pool จาก iRecruit (default 500) */
  poolSize?: number;
}): Promise<MatchingSuggestionsResult | null> {
  const job = (await getSiamrajUnitRequestById(options.jobId)) as MatchableJob | null;
  if (!job) return null;

  const resultLimit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const poolSize = Math.min(
    Math.max(options.poolSize ?? DEFAULT_CANDIDATE_POOL, resultLimit),
    1000,
  );

  const candidates = await listRecruitRegistrations({
    owner: options.owner,
    limit: poolSize,
  });
  const hints = roleHintsForJob(job);

  const suggestions = candidates
    .map((candidate) => scoreCandidateForJob(job, candidate, hints))
    // ตัดคนไกลออกถ้าไม่ได้อะไรจากพื้นที่เลย
    .filter((item) => item.proximity_rank <= 3 && item.score > 0)
    .sort(sortByProximityThenScore)
    .slice(0, resultLimit);

  return {
    job: job as Record<string, unknown>,
    criteria: {
      roleHints: hints,
      genderRequirement: job.gender_requirement || null,
      ageMin: typeof job.age_range_min === 'number' ? job.age_range_min : null,
      ageMax: typeof job.age_range_max === 'number' ? job.age_range_max : null,
    },
    totalCandidates: candidates.length,
    suggestions,
  };
}

export async function buildBranchMatchingSuggestions(options: {
  jobId: string;
  owner?: string;
  limit?: number;
}): Promise<{
  job: Record<string, unknown>;
  parser_input: string;
  branches: BranchMatchingSuggestionGroup[];
} | null> {
  const job = (await getSiamrajUnitRequestById(options.jobId)) as MatchableJob | null;
  if (!job) return null;

  const parserInput = buildErpBranchDemandInput(job);
  const parsed = parseErpBranchDemand(parserInput);
  if (parsed.items.length === 0) {
    return {
      job: job as Record<string, unknown>,
      parser_input: parserInput,
      branches: [],
    };
  }

  const poolSize = Math.min(Math.max(options.limit ?? DEFAULT_CANDIDATE_POOL, 1), 1000);
  const candidates = await listRecruitRegistrations({
    owner: options.owner,
    limit: poolSize,
  });
  const hints = roleHintsForJob(job);

  const branches = parsed.items.map((branch: ParsedBranchDemandItem) => {
    const suggestions = candidates
      .map((candidate) =>
        scoreCandidateForJob(
          job,
          candidate,
          hints,
          branch.branch_name_clean,
          branch.district_hint,
          branch.province_hint,
        ),
      )
      // สาขาที่มีเขตชัด: โชว์เฉพาะคนที่ใกล้จุดนั้น (ไม่ดึงทั้งกทม.มาปน)
      .filter((item) =>
        branch.district_hint
          ? item.proximity_rank === 0 && item.score > 0
          : item.proximity_rank <= 2 && item.score > 0,
      )
      .sort(sortByProximityThenScore)
      .slice(0, 10);

    return {
      branch_name_clean: branch.branch_name_clean,
      branch_name_raw: branch.branch_name_raw,
      requested_qty: branch.requested_qty,
      confidence: branch.confidence,
      matched_count: suggestions.length,
      suggestions,
    };
  });

  return {
    job: job as Record<string, unknown>,
    parser_input: parserInput,
    branches,
  };
}

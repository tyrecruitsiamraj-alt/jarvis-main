import type { IrecruitCandidateMatch } from '@/lib/irecruitMatchTypes';

export type BranchDemandItem = {
  branch_id?: string;
  branch_name_clean: string;
  branch_name_raw: string;
  address_raw?: string | null;
  road?: string | null;
  subdistrict?: string | null;
  requested_qty: number;
  confidence: number;
  district_hint: string | null;
  province_hint: string | null;
  postal_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  geocode_status?: 'unverified' | 'estimated' | 'confirmed' | 'not_found';
};

/** 0=ตรงเขต 1=ชื่อสาขาใกล้ 2=จังหวัด 3=ปริมณฑล 4=ไกล */
export type BranchProximityRank = 0 | 1 | 2 | 3 | 4;

export type BranchAssignedMatch = IrecruitCandidateMatch & {
  proximity_rank: BranchProximityRank;
  proximity_reason: string;
};

export type BranchDistributionGroup = BranchDemandItem & {
  matches: BranchAssignedMatch[];
};

export type CandidateArea = {
  district_name?: string | null;
  province_name?: string | null;
  location_label?: string | null;
};

export type NearestBranchAssignment = {
  branch: BranchDemandItem;
  proximity_rank: BranchProximityRank;
  proximity_reason: string;
};

function norm(v: string | null | undefined): string {
  return (v || '').trim().toLowerCase();
}

function isBangkokMetro(province: string): boolean {
  return /กรุงเทพ|bangkok|นนทบุรี|ปทุมธานี|สมุทรปราการ|สมุทรสาคร|นครปฐม/.test(province);
}

function tierRank(tier: IrecruitCandidateMatch['tier']): number {
  if (tier === 'green') return 0;
  if (tier === 'yellow') return 1;
  return 2;
}

/**
 * คะแนนความใกล้ระหว่างผู้สมัครกับสาขา (ไม่เรียก AI)
 * ใช้เขต/อำเภอ → ชื่อสาขา → จังหวัด เป็นหลัก
 */
export function proximityToBranch(
  match: CandidateArea,
  branch: Pick<BranchDemandItem, 'branch_name_clean' | 'district_hint' | 'province_hint'>,
): { rank: BranchProximityRank; reason: string } {
  const district = norm(match.district_name);
  const province = norm(match.province_name);
  const loc = norm(match.location_label);
  const branchDistrict = norm(branch.district_hint);
  const branchProvince = norm(branch.province_hint).replace(/มหานคร/g, '');
  const branchName = norm(branch.branch_name_clean);

  if (branchDistrict && (district.includes(branchDistrict) || loc.includes(branchDistrict))) {
    return { rank: 0, reason: `ใกล้เขตจุดงาน: ${branch.district_hint}` };
  }

  // ชื่อสาขา/สถานที่เด่นอยู่ในที่อยู่ผู้สมัคร
  if (branchName) {
    const tokens = branchName
      .split(/[\s()]+/g)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !branchDistrict.includes(t));
    for (const t of tokens.slice(0, 4)) {
      if (loc.includes(t) || district.includes(t)) {
        return { rank: 1, reason: `ใกล้ชื่อสาขา: ${t}` };
      }
    }
  }

  if (branchProvince && province.includes(branchProvince)) {
    return {
      rank: 2,
      reason: `จังหวัดตรง: ${match.province_name || branch.province_hint}`,
    };
  }

  if (
    (branchProvince.includes('กรุงเทพ') || /กรุงเทพ/.test(branchName) || branchDistrict) &&
    isBangkokMetro(province || loc)
  ) {
    return { rank: 3, reason: 'อยู่ในกทม./ปริมณฑล' };
  }

  if (province) {
    return { rank: 4, reason: `ห่างพื้นที่งาน (${match.province_name})` };
  }
  return { rank: 4, reason: 'ไม่ระบุพื้นที่ผู้สมัคร' };
}

/** เลือกสาขาที่ใกล้สุดจากข้อมูลพื้นที่ผู้สมัคร โดยไม่อ้างว่าเป็นระยะทางจริงเมื่อไม่มีพิกัด */
export function nearestBranchForArea(
  area: CandidateArea,
  branches: BranchDemandItem[],
): NearestBranchAssignment | null {
  if (!branches.length) return null;
  const ranked = branches.map((branch, index) => ({
    branch,
    index,
    proximity: proximityToBranch(area, branch),
  }));
  ranked.sort((a, b) => a.proximity.rank - b.proximity.rank || a.index - b.index);
  const nearest = ranked[0];
  return {
    branch: nearest.branch,
    proximity_rank: nearest.proximity.rank,
    proximity_reason: nearest.proximity.reason,
  };
}

function sortAssigned(a: BranchAssignedMatch, b: BranchAssignedMatch): number {
  if (a.proximity_rank !== b.proximity_rank) return a.proximity_rank - b.proximity_rank;
  const tr = tierRank(a.tier) - tierRank(b.tier);
  if (tr !== 0) return tr;
  if (a.prescore !== b.prescore) return b.prescore - a.prescore;
  return 0;
}

/**
 * ทางเลือก A: กระจายผล AI ระดับใบขอ เข้าแต่ละสาขาตามความใกล้พื้นที่
 * - ไม่เรียก AI เพิ่ม
 * - ผู้สมัครคนเดียวกันอาจโผล่หลายสาขาถ้าใกล้หลายจุด (เรียงคนที่ใกล้สาขานั้นก่อน)
 * - คนที่ตรงเขตสาขาอื่นชัดเจน จะถูกดันลงในสาขานี้
 */
export function distributeIrecruitMatchesToBranches(
  matches: IrecruitCandidateMatch[],
  branches: BranchDemandItem[],
  options?: { perBranchLimit?: number; maxProximityRank?: BranchProximityRank },
): BranchDistributionGroup[] {
  const perBranchLimit = options?.perBranchLimit ?? 5;
  const maxProximityRank = options?.maxProximityRank ?? 3;

  const otherDistricts = (self: BranchDemandItem) =>
    branches
      .filter((b) => b !== self && b.district_hint)
      .map((b) => norm(b.district_hint));

  return branches.map((branch) => {
    const others = otherDistricts(branch);
    const scored: BranchAssignedMatch[] = matches
      .map((match) => {
        const prox = proximityToBranch(match, branch);
        const candDistrict = norm(match.district_name);
        const candLoc = norm(match.location_label);
        // ถ้าคนนี้อยู่เขตของสาขาอื่นชัดเจน — ดันลงท้ายสำหรับสาขานี้
        const belongsElsewhere =
          Boolean(branch.district_hint) &&
          others.some(
            (d) =>
              d &&
              (candDistrict.includes(d) || candLoc.includes(d)) &&
              !candDistrict.includes(norm(branch.district_hint)) &&
              !candLoc.includes(norm(branch.district_hint)),
          );

        return {
          ...match,
          proximity_rank: (belongsElsewhere ? 4 : prox.rank) as BranchProximityRank,
          proximity_reason: belongsElsewhere
            ? `อยู่คนละจุดงานในใบนี้ (เขต${match.district_name})`
            : prox.reason,
        };
      })
      .filter((m) => m.proximity_rank <= maxProximityRank)
      .sort(sortAssigned)
      .slice(0, Math.max(perBranchLimit, branch.requested_qty));

    return {
      ...branch,
      matches: scored,
    };
  });
}

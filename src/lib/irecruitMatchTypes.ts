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
  tier: 'green' | 'yellow' | 'red';
  reason: string;
  prescore: number;
};

import type { CandidateSpecAnalysis } from '@/lib/candidateSpecTypes';

export type IrecruitMatchResult = {
  jobId: string;
  request_no: string | null;
  job_family_code: string;
  job_family_label: string;
  analysis?: CandidateSpecAnalysis;
  pool_size: number;
  search_scope: 'keyword' | 'recent';
  shortlisted: number;
  matches: IrecruitCandidateMatch[];
};

export function matchTierEmoji(tier: IrecruitCandidateMatch['tier']): string {
  if (tier === 'green') return '🟢';
  if (tier === 'red') return '🔴';
  return '🟡';
}

export function matchTierLabel(tier: IrecruitCandidateMatch['tier']): string {
  if (tier === 'green') return 'เข้าข่ายมาก';
  if (tier === 'red') return 'ห่างไกล';
  return 'พอได้ ต้องเช็ค';
}

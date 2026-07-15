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

export function compensationVerdictLabel(v: CandidateSpecAnalysis['compensation_verdict']): string {
  if (v === 'ok') return 'รายได้ OK';
  if (v === 'fail') return 'รายได้ต่ำ';
  return 'รายได้เสี่ยง';
}

export function complianceVerdictLabel(v: CandidateSpecAnalysis['compliance_verdict']): string {
  if (v === 'pass') return 'Compliance ผ่าน';
  if (v === 'fail') return 'Compliance ไม่ผ่าน';
  return 'Compliance ระวัง';
}

export function adjacentTierEmoji(tier: 'green' | 'yellow' | 'red'): string {
  if (tier === 'green') return '🟢';
  if (tier === 'red') return '🔴';
  return '🟡';
}

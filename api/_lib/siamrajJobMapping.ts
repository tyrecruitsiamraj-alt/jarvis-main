export type SiamrajJobType = 'thai_executive' | 'foreign_executive' | 'central' | 'valet_parking';

export function parseAgeRange(age: string | null | undefined): { min?: number; max?: number } {
  if (!age?.trim()) return {};
  const s = age.replace(/ปี/g, '').trim();
  const range = s.match(/(\d+)\s*[-–—~至]\s*(\d+)/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) return { min, max };
  }
  const single = s.match(/(\d+)/);
  if (single) {
    const n = Number(single[1]);
    if (Number.isFinite(n)) return { min: n, max: n };
  }
  return {};
}

export function formatGenderRequirement(sex: string | null | undefined): string | undefined {
  if (!sex?.trim()) return undefined;
  const raw = sex.trim();
  const t = raw.toUpperCase();
  if (t === 'M' || t === 'MALE' || raw === 'ชาย') return 'ชาย';
  if (t === 'F' || t === 'FEMALE' || raw === 'หญิง') return 'หญิง';
  if (t === 'B' || t === 'BOTH' || raw === 'ไม่ระบุ' || t === 'ANY') return 'ไม่ระบุ';
  return raw;
}

export function inferJobTypeFromDescription(...names: (string | null | undefined)[]): SiamrajJobType {
  const blob = names.filter(Boolean).join(' ').toLowerCase();
  if (!blob) return 'central';
  if (/valet|แวลเล่|แวลเลต|valetparking/i.test(blob)) return 'valet_parking';
  if (/ต่างชาติ|foreign|expat/i.test(blob)) return 'foreign_executive';
  if (/คนไทย|thai/i.test(blob)) return 'thai_executive';
  if (/ส่วนกลาง|central/i.test(blob)) return 'central';
  return 'central';
}

export function primaryJobRoleLabel(
  jobName1: string | null | undefined,
  staffTitleName: string | null | undefined,
  code1: string | null | undefined,
): string | undefined {
  return jobName1?.trim() || staffTitleName?.trim() || code1?.trim() || undefined;
}

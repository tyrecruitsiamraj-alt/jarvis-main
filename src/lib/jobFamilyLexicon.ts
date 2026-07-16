/**
 * Deterministic job-family lexicon (frontend) — สำหรับ "quick count" ที่ไม่เรียก AI.
 * อิงจาก skills/candidate-spec-analyzer/references/job-family-taxonomy.md (Family A–F).
 *
 * ใช้แทนการนับด้วย keyword ดิบ: classify ใบขอเข้า family ก่อน แล้วนับผู้สมัครที่สกิลอยู่ family เดียวกัน
 * (แม่นกว่า เพราะรวมคำใกล้เคียง/synonyms และตัดคำกว้าง ๆ ที่ทำให้ over-count).
 * นี่คือการ "ประมาณการ" — ผล AI (board matcher) ยังเป็นตัวตัดสินจริง.
 */
export type JobFamilyCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type JobFamily = {
  code: JobFamilyCode;
  label: string;
  /** คำ/วลี (lowercase) ที่บ่งชี้ family นี้ — ใช้ทั้ง classify ใบขอ และ match สกิลผู้สมัคร */
  terms: string[];
};

export const JOB_FAMILIES: JobFamily[] = [
  {
    code: 'A',
    label: 'ภาพลักษณ์/ต้อนรับ',
    terms: [
      'ประชาสัมพันธ์', 'ต้อนรับ', 'ลูกค้าสัมพันธ์', 'พิธีกร', 'gro', 'concierge',
      'reception', 'guest relation', 'customer relation', 'brand ambassador',
      'ground staff', 'pr',
    ],
  },
  {
    code: 'B',
    label: 'ช่าง/เทคนิค/IT',
    terms: [
      'ช่างไฟฟ้า', 'ช่างเครื่อง', 'ช่างกล', 'ช่างอาคาร', 'ช่างเทคนิค', 'ช่างซ่อม', 'ช่าง',
      'เครื่องกล', 'ซ่อมบำรุง', 'เทคนิค', 'programmer', 'developer', 'โปรแกรมเมอร์',
      'it support', 'helpdesk', 'help desk', 'network', 'server', 'infra', 'mep',
      'วิศวกร', 'engineer', 'it',
    ],
  },
  {
    code: 'C',
    label: 'ขับรถ/Valet',
    terms: [
      'ขับรถ', 'พขร', 'คนขับ', 'driver', 'chauffeur', 'valet', 'รถผู้บริหาร',
      'ส่วนกลาง', 'รับส่ง', 'ขนส่ง',
    ],
  },
  {
    code: 'D',
    label: 'ธุรการ/บริการหลังบ้าน',
    terms: [
      'ธุรการ', 'admin', 'clerk', 'เสมียน', 'แคชเชียร์', 'cashier', 'คลังสินค้า', 'คลัง',
      'สโตร์', 'store', 'แม่บ้าน', 'ทำความสะอาด', 'cleaner', 'housekeeping',
      'เอกสาร', 'คีย์ข้อมูล', 'data entry', 'บัญชี', 'จัดซื้อ',
    ],
  },
  {
    code: 'E',
    label: 'รักษาความปลอดภัย',
    terms: ['รปภ', 'รักษาความปลอดภัย', 'security', 'guard', 'ยาม'],
  },
  {
    code: 'F',
    label: 'ภาคสนาม/ภูมิทัศน์',
    terms: [
      'คนสวน', 'สวน', 'รุกขกร', 'ภูมิทัศน์', 'พื้นที่สีเขียว', 'landscape', 'gardener',
      'ตัดแต่งต้นไม้', 'ดูแลต้นไม้',
    ],
  },
];

const STOPWORDS = new Set([
  'พนักงาน', 'เจ้าหน้าที่', 'งาน', 'ทั่วไป', 'ไม่ระบุ', 'ระบุ', 'ประจำ', 'staff', 'service',
]);

function normalize(text: string): string {
  return (text || '').toLowerCase();
}

/**
 * จัดใบขอ/ผู้สมัครเข้า job family จากข้อความตำแหน่ง — เลือก family ที่มี term ปรากฏมากสุด
 * (นับตามความยาว term เพื่อให้คำเฉพาะเจาะจงมีน้ำหนักกว่า). คืน null ถ้าไม่เข้าข่ายเลย.
 */
export function classifyJobFamily(text: string): JobFamilyCode | null {
  const t = normalize(text);
  if (!t.trim()) return null;
  let best: { code: JobFamilyCode; score: number } | null = null;
  for (const fam of JOB_FAMILIES) {
    let score = 0;
    for (const term of fam.terms) {
      if (t.includes(term)) score += term.length >= 4 ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { code: fam.code, score };
  }
  return best?.code ?? null;
}

const TERMS_BY_CODE: Record<JobFamilyCode, string[]> = JOB_FAMILIES.reduce(
  (acc, f) => {
    acc[f.code] = f.terms;
    return acc;
  },
  {} as Record<JobFamilyCode, string[]>,
);

/** ผู้สมัคร (จากข้อความสกิล) อยู่ family นี้หรือไม่ */
export function candidateMatchesFamily(candidateText: string, code: JobFamilyCode): boolean {
  const t = normalize(candidateText);
  if (!t.trim()) return false;
  return TERMS_BY_CODE[code].some((term) => t.includes(term));
}

/** fallback: token กว้าง ๆ จากตำแหน่ง (ใช้เมื่อ classify family ไม่ได้) */
export function fallbackKeywords(text: string): string[] {
  return [
    ...new Set(
      normalize(text)
        .split(/[\s/(),\-–—|•·]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
    ),
  ];
}

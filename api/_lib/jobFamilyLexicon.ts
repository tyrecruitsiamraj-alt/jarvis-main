/**
 * Deterministic job-family lexicon (backend twin of src/lib/jobFamilyLexicon.ts).
 * อิงจาก skills/candidate-spec-analyzer/references/job-family-taxonomy.md (Family A–F).
 *
 * ใช้กัน AI matcher (board/iRecruit) ถูกบังคับให้แมทคนข้าม family เมื่อ pool ไม่มีใครสกิลตรงเลย
 * (เช่น pool เป็นคนขับรถทั้งหมด แต่ใบขอเป็นงานอ่านมาตร/QC/ธุรการ — ต้องตอบ "ไม่มีคนตรง" ไม่ใช่ฝืนแมท).
 */
export type JobFamilyCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

const FAMILY_TERMS: Record<JobFamilyCode, string[]> = {
  A: [
    'ประชาสัมพันธ์', 'ต้อนรับ', 'ลูกค้าสัมพันธ์', 'พิธีกร', 'gro', 'concierge',
    'reception', 'guest relation', 'customer relation', 'brand ambassador',
    'ground staff', 'pr',
  ],
  B: [
    'ช่างไฟฟ้า', 'ช่างเครื่อง', 'ช่างกล', 'ช่างอาคาร', 'ช่างเทคนิค', 'ช่างซ่อม', 'ช่าง',
    'เครื่องกล', 'ซ่อมบำรุง', 'เทคนิค', 'programmer', 'developer', 'โปรแกรมเมอร์',
    'it support', 'helpdesk', 'help desk', 'network', 'server', 'infra', 'mep',
    'วิศวกร', 'engineer', 'it',
  ],
  C: [
    'ขับรถ', 'พขร', 'คนขับ', 'driver', 'chauffeur', 'valet', 'รถผู้บริหาร',
    'ส่วนกลาง', 'รับส่ง', 'ขนส่ง', 'ส่งเอกสาร', 'เดินเอกสาร',
    'แมสเซนเจอร์', 'messenger', 'courier',
  ],
  D: [
    'ธุรการ', 'admin', 'clerk', 'เสมียน', 'แคชเชียร์', 'cashier', 'คลังสินค้า', 'คลัง',
    'สโตร์', 'store', 'แม่บ้าน', 'ทำความสะอาด', 'cleaner', 'housekeeping',
    'เอกสาร', 'คีย์ข้อมูล', 'data entry', 'บันทึกข้อมูล', 'บัญชี', 'จัดซื้อ',
    'อ่านมาตร', 'จดมาตร', 'มิเตอร์',
  ],
  E: ['รปภ', 'รักษาความปลอดภัย', 'security', 'guard', 'ยาม'],
  F: [
    'คนสวน', 'สวน', 'รุกขกร', 'ภูมิทัศน์', 'พื้นที่สีเขียว', 'landscape', 'gardener',
    'ตัดแต่งต้นไม้', 'ดูแลต้นไม้', 'ขนขยะ', 'เก็บขยะ',
  ],
};

const FAMILY_CODES = Object.keys(FAMILY_TERMS) as JobFamilyCode[];

export function isJobFamilyCode(v: unknown): v is JobFamilyCode {
  return typeof v === 'string' && (FAMILY_CODES as string[]).includes(v);
}

function normalize(text: string): string {
  return (text || '').toLowerCase();
}

/**
 * งานรับ-ส่ง/เดินเอกสารมีแก่นเป็น courier/transport ไม่ใช่งานจัดทำเอกสารแบบธุรการ
 * ต้องตรวจวลีเต็มก่อน keyword "เอกสาร" เพื่อไม่ให้หลุดเข้า Family D.
 */
function isDocumentCourier(text: string): boolean {
  const compact = normalize(text).replace(/[\s/(),.\-\u2013\u2014|\u2022·]+/g, '');
  return (
    compact.includes('รับส่งเอกสาร') ||
    compact.includes('ส่งเอกสาร') ||
    compact.includes('เดินเอกสาร') ||
    compact.includes('แมสเซนเจอร์') ||
    compact.includes('messenger') ||
    compact.includes('courier')
  );
}

/** classify ข้อความตำแหน่งเข้า family — เลือกอันที่มี term ปรากฏมากสุด คืน null ถ้าไม่เข้าข่ายเลย */
export function classifyJobFamily(text: string): JobFamilyCode | null {
  const t = normalize(text);
  if (!t.trim()) return null;
  if (isDocumentCourier(t)) return 'C';
  let best: { code: JobFamilyCode; score: number } | null = null;
  for (const code of FAMILY_CODES) {
    let score = 0;
    for (const term of FAMILY_TERMS[code]) {
      if (t.includes(term)) score += term.length >= 4 ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { code, score };
  }
  return best?.code ?? null;
}

/** ผู้สมัคร (จากข้อความสกิล) อยู่ family นี้หรือไม่ */
export function candidateMatchesFamily(candidateText: string, code: JobFamilyCode): boolean {
  const t = normalize(candidateText);
  if (!t.trim()) return false;
  if (isDocumentCourier(t)) return code === 'C';
  return FAMILY_TERMS[code].some((term) => t.includes(term));
}

export type ScoredCandidate<T> = { c: T; s: number };

/**
 * เลือก shortlist จากรายชื่อที่ pre-score แล้ว (เรียงคะแนนมากไปน้อยแล้ว).
 * คนที่ score>0 แต่ตรวจได้ว่าอยู่คนละ family จะถูกตัดก่อน; ตำแหน่งที่ lexicon ยังไม่รู้จักยังให้ AI พิจารณาได้.
 * ถ้าคนสกิลตรงที่ผ่าน gate มีน้อยกว่าครึ่งของ size ที่ต้องการ เติมจากคนที่เหลือ —
 * แต่เติมได้เฉพาะคนที่ "family เดียวกับใบขอ" เท่านั้น (แม้ score=0) ห้ามสุ่มข้าม family เด็ดขาด
 * (กันเคส pool เป็นสายอื่นทั้งหมด แล้ว AI ถูกบังคับให้เลือกคนที่ไม่เกี่ยวข้องเลย เช่น คนขับรถ↔งานอ่านมาตร).
 * ถ้า family เป็น null (classify ไม่ได้) คงพฤติกรรมเดิม — เติมจากคนคะแนน 0 ทั่วไป.
 */
export function selectShortlist<T>(
  scored: ScoredCandidate<T>[],
  size: number,
  family: JobFamilyCode | null,
  candidateText: (c: T) => string,
): ScoredCandidate<T>[] {
  const sameFamily = (x: ScoredCandidate<T>) =>
    !family || candidateMatchesFamily(candidateText(x.c), family);
  const compatibleScoredFamily = (x: ScoredCandidate<T>) => {
    if (!family) return true;
    const text = candidateText(x.c);
    // ตำแหน่งเฉพาะที่ lexicon ยังไม่รู้จักยังให้ AI พิจารณาได้
    return candidateMatchesFamily(text, family) || classifyJobFamily(text) === null;
  };
  // score จากคำร่วมเช่น "เอกสาร" ห้ามเอาชนะ family gate
  const withScore = scored.filter((x) => x.s > 0 && compatibleScoredFamily(x)).slice(0, size);
  if (withScore.length >= Math.floor(size / 2)) return withScore;
  const zero = scored.filter((x) => x.s === 0);
  const fill = family ? zero.filter(sameFamily) : zero;
  return [...withScore, ...fill.slice(0, size - withScore.length)];
}

/**
 * ประกาศรับสมัคร — นิยามกลางที่ทั้งหน้าเว็บและ API ใช้ร่วมกัน
 *
 * โค้ดชุดนี้ถูก import จากทั้ง `src/` และ `api/` เจตนาให้เป็นแหล่งความจริงเดียว
 * (แพตเทิร์นเดียวกับ `matchingListFilter.ts` ที่รัน 2 ฝั่ง)
 */

/** ประเภทของ "กล่องลอย" — ประกาศที่ไม่ได้ผูกกับใบขอจาก ERP */
export const STANDALONE_POSTING_KINDS = [
  { code: 'thai_executive', label: 'ผู้บริหารคนไทย' },
  { code: 'foreign_executive', label: 'ผู้บริหารต่างชาติ' },
  { code: 'central', label: 'ส่วนกลาง' },
  { code: 'valet', label: 'Valet' },
  { code: 'government', label: 'ราชการ' },
] as const;

export type StandalonePostingKind = (typeof STANDALONE_POSTING_KINDS)[number]['code'];

const KIND_CODES = new Set<string>(STANDALONE_POSTING_KINDS.map((k) => k.code));

export function isStandalonePostingKind(value: unknown): value is StandalonePostingKind {
  return typeof value === 'string' && KIND_CODES.has(value);
}

export function standalonePostingKindLabel(code: string | null | undefined): string {
  if (!code) return '';
  return STANDALONE_POSTING_KINDS.find((k) => k.code === code)?.label ?? code;
}

export type RecruitPostingStatus = 'open' | 'closed';

export type RecruitChannel = {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
  /** ช่องทางรองของช่องทางนี้ (เติมเฉพาะตอนดึงเป็นทรี) */
  children?: RecruitChannel[];
};

export type RecruitPostingLink = {
  id: string;
  channelId: string | null;
  channelLabel: string | null;
  code: string;
  note: string | null;
  hitCount: number;
  createdAt: string;
  /** จำนวนใบสมัครที่เข้ามาทางลิงก์นี้ */
  applicationCount?: number;
};

export type RecruitPosting = {
  id: string;
  jobId: string | null;
  standaloneKind: StandalonePostingKind | null;
  departmentCode: string | null;
  title: string;
  detail: string | null;
  locationText: string | null;
  salaryText: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: RecruitPostingStatus;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  links: RecruitPostingLink[];
  /** จำนวนใบสมัครทั้งหมดของประกาศนี้ */
  applicationCount?: number;
};

/** เส้นทางสาธารณะของลิงก์ — ใช้ทั้งตอนสร้างและตอน resolve */
export function applyLinkPath(code: string): string {
  return `/apply/p/${encodeURIComponent(code)}`;
}

/**
 * ตรวจข้อมูลก่อนสร้างประกาศ — คืนข้อความผิดพลาด หรือ null เมื่อผ่าน
 * ใช้ทั้งฝั่งฟอร์ม (กันกดส่งทั้งที่ยังไม่ครบ) และฝั่ง API (กันยิงตรง)
 */
export function validatePostingInput(input: {
  jobId?: string | null;
  standaloneKind?: string | null;
  departmentCode?: string | null;
  title?: string | null;
}): string | null {
  const title = (input.title || '').trim();
  if (!title) return 'ต้องระบุหัวข้อประกาศ';
  if (title.length > 200) return 'หัวข้อประกาศยาวเกิน 200 ตัวอักษร';

  const hasJob = !!(input.jobId || '').trim();
  if (hasJob) return null;

  // ประกาศลอย — ต้องบอกว่าเป็นกล่องประเภทไหน และอยู่ BU ไหน
  if (!isStandalonePostingKind(input.standaloneKind)) {
    return 'ประกาศที่ไม่ผูกใบขอ ต้องเลือกประเภทกล่อง';
  }
  if (!(input.departmentCode || '').trim()) {
    // ไม่มีใบขอให้ดึง BU มา ถ้าปล่อยว่างจะกลายเป็นประกาศที่ทุกแผนกเห็น
    return 'ประกาศที่ไม่ผูกใบขอ ต้องเลือก BU';
  }
  return null;
}

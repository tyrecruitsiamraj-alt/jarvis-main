import type { JobRequest } from '@/types';
import { buildErpBranchDemandInput, parseErpBranchDemand } from '@/lib/erpBranchDemandParser';

/** ข้อมูลผู้สมัครขั้นต่ำสำหรับสร้างสคริปต์ */
export type OutreachCandidateInput = {
  first_name: string;
  last_name?: string | null;
  /** iRecruit: sex (ชาย/หญิง) หรือ Jarvis: male/female */
  sex?: string | null;
  title_prefix?: string | null;
};

export type OutreachScriptInput = {
  job: Pick<
    JobRequest,
    | 'unit_name'
    | 'staff_title_name'
    | 'job_description_code_1'
    | 'location_address'
    | 'work_schedule'
    | 'total_income'
  >;
  candidate: OutreachCandidateInput;
  /** ถ้าเป็นงานหลายสาขา — ระบุสาขาที่จะเสนอ (จาก parser) */
  branchName?: string;
  /**
   * รายได้รวม OT โดยประมาณ (บาท)
   * ต้นทางที่แนะนำ: st_request_p3_rate.draw_rate จาก ERP (ยังไม่ map ใน JobRequest)
   * ถ้าไม่ส่ง จะประมาณจากฐานเงินเดือน × 1.67 ปัดเป็นพัน
   */
  otTotalEstimate?: number;
};

export type OutreachScriptResult = {
  message: string;
  /** แหล่งข้อมูลที่ใช้จริง (debug / แสดงใน UI) */
  sources: {
    role: string;
    honorific: string;
    location: string;
    schedule: string;
    baseSalary: number;
    otTotalEstimate: number;
    candidateName: string;
  };
};

const DEFAULT_COMPANY = 'สยามราชธานี';

function formatMoney(n: number): string {
  return Math.round(n).toLocaleString('th-TH');
}

function candidateDisplayName(c: OutreachCandidateInput): string {
  const first = (c.first_name || '').trim();
  const last = (c.last_name || '').trim();
  return [first, last].filter(Boolean).join(' ') || first || 'คุณ';
}

/** คำนำหน้าในเนื้อความ "มีงานขับรถให้___" */
function honorificForCandidate(c: OutreachCandidateInput): string {
  const sex = (c.sex || '').trim().toLowerCase();
  if (sex === 'ชาย' || sex === 'male' || sex === 'm') return 'นาย';
  if (sex === 'หญิง' || sex === 'female' || sex === 'f') return 'คุณ';
  const prefix = (c.title_prefix || '').trim();
  if (/^นาย/.test(prefix)) return 'นาย';
  if (/^(นาง|นางสาว|คุณ)/.test(prefix)) return 'คุณ';
  return 'คุณ';
}

function isDriverRole(job: OutreachScriptInput['job']): boolean {
  const blob = [job.staff_title_name, job.job_description_code_1].filter(Boolean).join(' ');
  return /ขับรถ|driver/i.test(blob);
}

function roleLabel(job: OutreachScriptInput['job']): string {
  if (isDriverRole(job)) return 'งานขับรถ';
  const title = (job.staff_title_name || job.job_description_code_1 || 'งาน').trim();
  return `งาน${title}`;
}

/** ย่อสถานที่จาก ERP หรือ parser หลายสาขา */
function resolveLocation(job: OutreachScriptInput['job'], branchName?: string): string {
  if (branchName?.trim()) return branchName.trim();

  const input = buildErpBranchDemandInput(job);
  const parsed = parseErpBranchDemand(input);
  if (parsed.items.length === 1) return parsed.items[0].branch_name_clean;
  if (parsed.items.length > 1) {
    return parsed.items.map((i) => `${i.branch_name_clean} (${i.requested_qty} คน)`).join(', ');
  }

  const raw = (job.location_address || '').trim();
  if (!raw) return job.unit_name?.trim() || 'ตามที่อยู่ในใบงาน';
  if (raw.length <= 80) return raw;
  return `${raw.slice(0, 77)}…`;
}

function resolveSchedule(job: OutreachScriptInput['job']): string {
  const s = (job.work_schedule || '').trim();
  if (s) return s.replace(/\s*•\s*/g, ' ');
  return 'ตามที่กำหนดในใบงาน';
}

function estimateOtTotal(baseSalary: number, explicit?: number): number {
  if (explicit != null && explicit > 0) return explicit;
  if (baseSalary <= 0) return 0;
  const rough = baseSalary * 1.67;
  return Math.ceil(rough / 1000) * 1000;
}

/**
 * สร้างสคริปต์เสนองานแบบ:
 * "ตอนนี้ทางสยามราชธานีมีงานขับรถให้นาย อยู่ที่ … วัน-เวลาทำงาน … เงินเดือนฐาน … บาท …"
 */
export function buildRecruitmentOutreachScript(input: OutreachScriptInput): OutreachScriptResult {
  const honorific = honorificForCandidate(input.candidate);
  const role = roleLabel(input.job);
  const location = resolveLocation(input.job, input.branchName);
  const schedule = resolveSchedule(input.job);
  const baseSalary = Math.max(0, input.job.total_income || 0);
  const otTotalEstimate = estimateOtTotal(baseSalary, input.otTotalEstimate);
  const candidateName = candidateDisplayName(input.candidate);

  const otLine =
    otTotalEstimate > 0
      ? `มีงานนอกเวลาเป็น OT รวมแล้วประมาณ ${formatMoney(otTotalEstimate)} บาทขึ้นไปค่ะ `
      : '';

  const message =
    `ตอนนี้ทาง${DEFAULT_COMPANY}มี${role}ให้${honorific} อยู่ที่ ${location} ` +
    `วัน-เวลาทำงาน ${schedule} ` +
    `เงินเดือนฐาน ${formatMoney(baseSalary)} บาท ` +
    otLine +
    `คุณ ${candidateName} สนใจไหมคะ`;

  return {
    message,
    sources: {
      role,
      honorific,
      location,
      schedule,
      baseSalary,
      otTotalEstimate,
      candidateName,
    },
  };
}

/**
 * Map จาก payload ภายนอก (เช่น interview bot) → input ของสคริปต์
 * ใช้คู่กับข้อมูลงานจาก GET /api/siamraj/unit-requests
 */
export function outreachInputFromExternalPayload(
  job: OutreachScriptInput['job'],
  payload: {
    candidate_name?: string;
    phone?: string;
    position?: string;
    skills?: string[];
    experience?: Array<{ salary?: string; position?: string }>;
  },
  options?: { branchName?: string; otTotalEstimate?: number },
): OutreachScriptInput {
  const full = (payload.candidate_name || '').trim();
  const parts = full.split(/\s+/).filter(Boolean);
  const first_name = parts[0] || full || 'คุณ';
  const last_name = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

  return {
    job,
    candidate: { first_name, last_name },
    branchName: options?.branchName,
    otTotalEstimate: options?.otTotalEstimate,
  };
}

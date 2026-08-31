import { buildIncomeDisplay, type IncomeDisplay } from '../../../src/lib/incomeBreakdown.js';
import { publicSafeAddress } from '../../../src/lib/publicJobPrivacy.js';
import {
  isSiamrajUnitRequestsEnabled,
  listSiamrajUnitRequests,
  getSiamrajUnitRequestById,
} from '../../_lib/siamrajUnitRequests.js';
import { dbQuery } from '../../_lib/postgres.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { getString } from '../../_lib/body.js';
import {
  fetchJobBenefitChipsById,
  fetchMonthlyIncomesById,
  type MonthlyIncomeItem,
} from '../../_lib/siamrajJobBenefits.js';
import { attachNotes, attachWorkStatus } from '../siamraj-unit-requests.js';
import { isReleased, loadReleasedJobKeys } from '../../_lib/jobPublicReleases.js';
import {
  isPublicPrequestEnabled,
  isPublicVisibleByPrequest,
  isPublicVisibleByWorkStatus,
} from '../../../src/lib/publicJobVisibility.js';

type JobRow = {
  id: string;
  unit_name: string;
  request_date: string | Date;
  required_date: string | Date;
  urgency: string;
  total_income: number;
  location_address: string;
  lat: number | null;
  lng: number | null;
  job_type: string;
  job_category: string;
  recruiter_name: string | null;
  screener_name: string | null;
  age_range_min: number | null;
  age_range_max: number | null;
  gender_requirement?: string | null;
  job_description_code_1?: string | null;
  job_description_code_2?: string | null;
  vehicle_required: string | null;
  work_schedule: string | null;
  penalty_per_day: number;
  days_without_worker: number;
  total_penalty: number;
  status: string;
  closed_date: string | Date | null;
  created_at: string | Date;
};

type PublicJob = ReturnType<typeof toPublicJob>;

function toYmd(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function toIsoString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

function toPublicJob(row: JobRow | Record<string, unknown>) {
  const r = row as JobRow & Record<string, unknown>;
  return {
    id: r.id,
    unit_name: r.unit_name,
    request_no: r.request_no ?? undefined,
    request_action_name: r.request_action_name ?? undefined,
    /**
     * 🔴 `resigned_employee_name` **ถูกถอดออกจากคำตอบสาธารณะแล้ว** (29 ส.ค. 2569)
     * วัดเจอว่าเส้นนี้แจกชื่อ-นามสกุลพนักงานจริง 102 ชื่อให้คนที่ไม่ล็อกอิน
     * ⇒ ห้ามใส่กลับ · เหตุผลเต็มอยู่หัวไฟล์ `src/lib/publicJobPrivacy.ts`
     */
    request_date: toYmd(r.request_date),
    required_date: toYmd(r.required_date),
    urgency: r.urgency,
    total_income: r.total_income,
    /**
     * 🔴 ที่อยู่ดิบจากระบบงานหลัก **ห้ามออกหน้าสาธารณะ** — ในนั้นมีเบอร์มือถือคนของลูกค้า
     * ทะเบียนรถ อีเมล และรหัสภายใน (WF/OC/รหัสสาขา) ปนอยู่ 32/20 ใบตามลำดับ
     * ตัวกรองประกอบข้อความขึ้นใหม่จาก จังหวัด/อำเภอ/ตำบล เท่านั้น (whitelist)
     */
    location_address: publicSafeAddress(r),
    lat: r.lat === null || r.lat === undefined ? undefined : r.lat,
    lng: r.lng === null || r.lng === undefined ? undefined : r.lng,
    job_type: r.job_type,
    job_category: r.job_category,
    job_description_code_1: r.job_description_code_1 || undefined,
    job_description_code_2: r.job_description_code_2 || undefined,
    age_range_min: r.age_range_min === null || r.age_range_min === undefined ? undefined : r.age_range_min,
    age_range_max: r.age_range_max === null || r.age_range_max === undefined ? undefined : r.age_range_max,
    gender_requirement: r.gender_requirement || undefined,
    vehicle_required: r.vehicle_required || undefined,
    work_schedule: r.work_schedule || undefined,
    /**
     * สัญชาติเจ้านาย (เจ้าของสั่ง 17 ส.ค. 2569 — เอาขึ้นทั้งกล่องงานและหน้าสาธารณะ)
     * ⚠️ ERP กรอกมาแค่ ~40% ของใบขอ · ค่าที่เป็นขีด/ว่างถูกล้างเป็น undefined ตั้งแต่
     * `cleanErpText` แล้ว — ไม่มีข้อมูล = **ไม่ขึ้นบรรทัดนี้** ห้ามขึ้นว่า "ไม่ระบุ"
     */
    boss_nationality: (r as Record<string, unknown>).boss_nationality as string | undefined,
    /** ที่อยู่ที่เจ้าหน้าที่แก้เอง — หน้าประกาศใช้ค่านี้ก่อนค่าที่เดาจากที่อยู่ดิบ */
    override_province: (r as Record<string, unknown>).override_province as string | undefined,
    override_district: (r as Record<string, unknown>).override_district as string | undefined,
    override_subdistrict: (r as Record<string, unknown>).override_subdistrict as string | undefined,
    /** สวัสดิการที่ติ๊กเพิ่มเอง (คีย์) — คนละชุดกับ `benefits` ที่มาจากอัตราจริงใน ERP */
    extra_benefits: (r as Record<string, unknown>).extra_benefits as string[] | undefined,
    /**
     * ⚠️ ฟิลด์ส่งต่อภายใน — `withBenefits()` ใช้แล้ว**ลบทิ้งก่อนตอบ**
     * ต้องพกมาทางนี้เพราะ `withBenefits` ทำงานบนก้อนที่ map แล้ว ซึ่งไม่มี
     * `field_overrides` ติดมาด้วย (toPublicJob หยิบเฉพาะฟิลด์ที่ระบุชื่อ)
     */
    manual_income: ((r as Record<string, unknown>).field_overrides as
      | { total_income?: number | null }
      | undefined)?.total_income ?? undefined,
    /**
     * รายได้แบบแยกส่วนที่เจ้าหน้าที่ตั้งเอง (20 ส.ค. 2569) — ผ่าน buildIncomeDisplay
     * แล้ว = เลข balance เสมอ (เติมบรรทัด "อื่น ๆ" จากส่วนต่างให้แล้ว)
     * มาก่อน breakdown อัตโนมัติจาก ERP — ดูการ merge ใน withBenefits()
     */
    income_display: (buildIncomeDisplay(
      ((r as Record<string, unknown>).field_overrides as { income?: unknown } | undefined)
        ?.income as never,
    ) ?? undefined) as IncomeDisplay | undefined,
    status: r.status,
    source: r.source || undefined,
    created_at: toIsoString(r.created_at),
    /**
     * สวัสดิการที่โชว์ได้ (เจ้าของเคาะ 16 ส.ค. 2569 — "เอาเหมือนที่ AI พูด")
     * เติมทีหลังด้วย `withBenefits()` เพราะต้องยิง ERP รวมทีเดียวทั้งชุด
     * ⚠️ ทุกตัวเลขมาจาก **อัตราจ่าย** (`payment_rate`) เท่านั้น ห้ามแตะอัตราเบิก
     */
    benefits: undefined as string[] | undefined,
    /**
     * รายได้ต่อเดือน = ค่าแรงหลัก + รายได้มั่นคง (เจ้าของสั่ง 16 ส.ค. 2569)
     * ⚠️ **ไม่ทับ `total_income`** — ฟิลด์เดิมมีคนใช้ทั้งระบบ (AI แมท · เทียบเงินเดือน
     * ที่ผู้สมัครขอ · prompt ของ Lumos) เปลี่ยนความหมายกลางทางคือพังเงียบหลายจุด
     */
    monthly_income: undefined as number | undefined,
    monthly_income_base: undefined as number | undefined,
    monthly_income_items: undefined as MonthlyIncomeItem[] | undefined,
  };
}

/**
 * เติมชิปสวัสดิการให้ประกาศงาน — คิวรีเดียวทั้งชุด (วัดจริง 200 ใบ = 236 ms)
 * ⚠️ error-safe อยู่แล้วที่ `fetchJobBenefitChipsById` — ERP ล่ม = ประกาศงานยังขึ้นครบ
 * แค่ไม่มีชิป (หน้านี้เป็นเส้นสาธารณะที่คนจริงกำลังจะสมัคร ห้ามล่มเพราะข้อมูลเสริม)
 */
type PublicJobOut = Omit<PublicJob, 'manual_income'>;

async function withBenefits(jobs: PublicJob[]): Promise<PublicJobOut[]> {
  /**
   * 🔴 คีย์ด้วย **id เต็ม** (`siamraj-sql:` / `siamraj-pre:`) ไม่ใช่เลขที่ใบเปล่า
   * เลขที่ใบของใบขอปกติกับใบขอล่วงหน้า**ซ้ำกันจริง 23 ใบ** — คีย์ด้วยเลขเปล่าคือ
   * มีโอกาสเอาอัตราของอีกบริษัทมาโชว์บนประกาศโดยไม่มีใครรู้
   */
  const ids = jobs.map((j) => String(j.id || '')).filter(Boolean);
  // ⚠️ ต้องเดินต่อแม้ไม่มีข้อมูล ERP — ยังต้องตัด manual_income ออกจากผลลัพธ์
  // (เดิม early-return คืนก้อนเดิม ซึ่งตอนนี้มีฟิลด์ภายในติดไปด้วย)
  const [chips, incomes] = await Promise.all([
    fetchJobBenefitChipsById(ids),
    fetchMonthlyIncomesById(ids),
  ]);
  return jobs.map((j) => {
    const key = String(j.id || '');
    const found = key ? chips.get(key) : undefined;
    const income = key ? incomes.get(key) : undefined;
    /**
     * 🔴 **รายได้ที่เจ้าหน้าที่แก้เองต้องชนะเลขจาก ERP** — การ์ดประกาศโชว์
     * `monthly_income` เป็นหลัก (ถอยไป `total_income` เมื่อคิดไม่ได้) ถ้าทับแค่
     * `total_income` เลขที่แก้จะไม่ขึ้นบนหน้าจอเลยในใบส่วนใหญ่ = แก้แล้วเหมือนไม่ได้แก้
     * `overridden` มาจาก attachNotes (ทับ `total_income` ไว้แล้วตอนแนบ override)
     */
    const manualIncome = typeof j.manual_income === 'number' ? j.manual_income : null;
    const { manual_income: _drop, ...rest } = j;
    /**
     * 🔴 breakdown ที่เจ้าหน้าที่ตั้งเอง (income_display) **ชนะของอัตโนมัติจาก ERP**
     * — ถ้ามี ไม่ต้องส่ง monthly_income_base/items ของ ERP ไปสับสนซ้ำ
     * และยอดหัวการ์ด (monthly_income) ใช้ total ของเจ้าหน้าที่เมื่อเป็นรายเดือน
     * (รายวันไม่ยัดใส่ monthly_income — คนละหน่วย ห้ามโกหก)
     */
    if (rest.income_display) {
      return {
        ...rest,
        ...(found && found.length > 0 ? { benefits: found } : {}),
        ...(rest.income_display.period === 'monthly'
          ? { monthly_income: rest.income_display.total }
          : {}),
      };
    }
    return {
      ...rest,
      ...(found && found.length > 0 ? { benefits: found } : {}),
      ...(income
        ? {
            monthly_income: manualIncome ?? income.total,
            monthly_income_base: income.base,
            monthly_income_items: income.items,
          }
        : manualIncome != null
          ? { monthly_income: manualIncome }
          : {}),
    };
  });
}

function isPublicVisible(job: { status?: string }) {
  return job.status === 'open' || job.status === 'in_progress';
}

/**
 * ซ่อนใบที่ **ได้ตัวคนแล้ว** (เจ้าของเคาะ 17 ส.ค. 2569: รอเริ่มงาน + รอแจ้งเข้า)
 * สถานะงานเก็บฝั่ง Jarvis (PG) ไม่ใช่ ERP — ต้องแนบก่อนกรอง
 * ⚠️ แนบไม่ได้ (ตารางล่ม) = **ไม่กรอง** ดีกว่าให้ประกาศหายทั้งหน้า
 */
async function withoutFilledJobs<T extends Record<string, unknown>>(jobs: T[]): Promise<T[]> {
  try {
    await attachWorkStatus(jobs);
  } catch {
    return jobs;
  }
  return jobs.filter((j) => isPublicVisibleByWorkStatus(j));
}

/**
 * ทับค่าที่เจ้าหน้าที่แก้เองจากกล่องงาน (จังหวัด/อำเภอ/ตำบล · รายได้รวม · สวัสดิการติ๊กเพิ่ม)
 * ⚠️ `attachNotes` แนบ **โน้ตภายใน** มาด้วย (`list_note`) — ปลอดภัยเพราะ `toPublicJob`
 * หยิบเฉพาะฟิลด์ที่ระบุชื่อไว้ ไม่ได้ spread ทั้งก้อน · ห้ามเปลี่ยนเป็น spread เด็ดขาด
 * ⚠️ อ่านไม่ได้ = ใช้ค่า ERP ตามเดิม (ประกาศต้องขึ้นเสมอ)
 */
async function withStaffOverrides<T extends Record<string, unknown>>(jobs: T[]): Promise<T[]> {
  try {
    await attachNotes(jobs);
  } catch {
    /* ข้อมูลเสริม */
  }
  return jobs;
}

const parseIntOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/**
 * ใบขอล่วงหน้าออกหน้าสาธารณะได้ไหม — อ่าน env ทุกครั้ง (ไม่ cache) เพื่อให้เปลี่ยนค่าแล้ว
 * มีผลทันทีโดยไม่ต้อง restart · ค่าเริ่มต้น = **ปิด** ดูเหตุผลที่ `publicJobVisibility.ts`
 */
function prequestPublicEnabled(): boolean {
  return isPublicPrequestEnabled(process.env.PUBLIC_PREQUEST_JOBS_ENABLED);
}

/**
 * ด่านที่ 4: **ปล่อยขึ้นหน้าสาธารณะแล้วหรือยัง** (เจ้าของเคาะ 22 ส.ค. 2569 — กลับด้านหมด)
 *
 * ก่อนมีด่านนี้ ใบขอที่เปิดอยู่ขึ้นหน้า `/apply` เองทุกใบ (วัดจริง 283 ใบ) ทีมไม่มีทางเลือก
 * ว่าใบไหนให้คนนอกเห็น และไม่มีจังหวะแก้รายได้/สวัสดิการก่อนปล่อย
 *
 * 🔴 **อ่านทะเบียนไม่ได้ = ไม่ปล่อยอะไรเลย** (fail-closed)
 * ต่างจากด่านอื่นในไฟล์นี้ที่ "อ่านไม่ได้ = ไม่กรอง" โดยตั้งใจ — เพราะสองอย่างนั้นคนละความเสี่ยง:
 *   · ด่าน work_status พลาด = ประกาศที่ได้คนแล้วค้างอยู่ (น่ารำคาญ)
 *   · ด่านนี้พลาด = **ใบที่ทีมยังไม่อยากให้คนนอกเห็น หลุดออกไปทั้งกอง** (กู้คืนไม่ได้)
 */
async function onlyReleasedJobs<T extends Record<string, unknown>>(jobs: T[]): Promise<T[]> {
  const keys = await loadReleasedJobKeys();
  return jobs.filter((j) => isReleased(keys, String(j.id ?? '')));
}

async function listPublicSiamrajJobs(limit: number): Promise<PublicJob[]> {
  const items = await listSiamrajUnitRequests({ limit, mode: 'all' });
  const prequestOk = prequestPublicEnabled();
  const open = items.filter(
    (j) => isPublicVisible(j) && isPublicVisibleByPrequest(j, prequestOk),
  ) as unknown as Array<Record<string, unknown>>;
  const released = await onlyReleasedJobs(open);
  const stillHiring = await withStaffOverrides(await withoutFilledJobs(released));
  return stillHiring.map((j) => toPublicJob(j as unknown as JobRow));
}

async function getPublicSiamrajJob(id: string): Promise<PublicJob | null> {
  // ด่านใบล่วงหน้าต้องอยู่ก่อนยิง ERP — ลิงก์เก่าที่คนแชร์ไว้ต้องตาย 404 ด้วย
  // ไม่งั้นปิดหน้ารวมแล้วยังเปิดใบซ้อมตรง ๆ ได้อยู่ดี
  if (!isPublicVisibleByPrequest({ id }, prequestPublicEnabled())) return null;
  const item = await getSiamrajUnitRequestById(id);
  if (!item || !isPublicVisible(item)) return null;
  // ด่านปล่อยใบ — เปิดตรงด้วยลิงก์ก็ต้องผ่านด่านเดียวกับหน้ารวม
  // (ไม่งั้นลิงก์ที่คนแชร์ไว้ยังพาไปสมัครใบที่ทีมยังไม่ปล่อย)
  if ((await onlyReleasedJobs([item as unknown as Record<string, unknown>])).length === 0) {
    return null;
  }
  // เปิดตรงด้วยลิงก์ก็ต้องซ่อนเหมือนกัน — ไม่งั้นลิงก์เก่าที่คนแชร์ไว้ยังพาไปสมัครใบที่ได้คนแล้ว
  const visible = await withStaffOverrides(
    await withoutFilledJobs([item as unknown as Record<string, unknown>]),
  );
  if (visible.length === 0) return null;
  return toPublicJob(visible[0] as unknown as JobRow);
}

export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');

  try {
    const id = getString(req.query?.id);
    /**
     * 🔴 เพดานต้องครอบ**ใบเปิดทั้งหมด** — เดิม 200 แล้วใบเก่าตกขอบหายจากหน้าสาธารณะ
     * (เจ้าของทัก 20 ส.ค. 2569: "ทำไมกันยงอีเลคทริกฉันไม่เจอ" — 5 ใบของกันยงอยู่อันดับ
     * 201/216/283 จากใบเปิด 284 ใบ เพราะ feed เรียงจากวันที่กรอกใหม่สุด)
     * 500 ครอบใบเปิดจริง (~284) มีที่เผื่อ · ตัวกรองที่ตั้งใจ (ซ่อนรอเริ่มงาน/รอแจ้งเข้า) ยังทำงานเหมือนเดิม
     */
    const limit = Math.min(500, Math.max(1, parseIntOrNull(req.query?.limit) ?? 500));

    if (isSiamrajUnitRequestsEnabled()) {
      if (id) {
        const job = await getPublicSiamrajJob(id);
        if (!job) return sendError(res, 404, 'Not found', 'Job not found');
        return res.status(200).json((await withBenefits([job]))[0]);
      }
      const jobs = await listPublicSiamrajJobs(limit);
      return res.status(200).json(await withBenefits(jobs));
    }

    if (id) {
      const { rows } = await dbQuery<JobRow>(
        `select * from jarvis_rm.jobs where id = $1 and status in ('open', 'in_progress') limit 1`,
        [id],
      );
      if (rows.length === 0) return sendError(res, 404, 'Not found', 'Job not found');
      return res.status(200).json(toPublicJob(rows[0]));
    }

    const { rows } = await dbQuery<JobRow>(
      `select * from jarvis_rm.jobs where status in ('open', 'in_progress') order by created_at desc limit $1`,
      [limit],
    );
    return res.status(200).json(rows.map(toPublicJob));
  } catch (e) {
    return handleApiError(res, e, 'public/jobs');
  }
}

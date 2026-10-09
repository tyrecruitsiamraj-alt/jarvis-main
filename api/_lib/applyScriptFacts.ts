/**
 * ข้อมูลงานสำหรับ **บทผู้สมัครผ่านลิงก์** (เจ้าของ 5 ต.ค. 2569) — พื้นที่ (ตำบล อำเภอ จังหวัด) · ช่วงอายุ · รายได้ + สวัสดิการ
 *
 * 🔴 ไม่ทำให้ใบสมัครล้ม/ช้า: ใบขออ่านผ่านสำเนา (`listSiamrajUnitRequests` ตัวเดียวกับหน้า /apply) · อัตราเงินยิง ERP
 *    ทั้งหมดมีเพดานเวลา — ช้า/ล่ม = คืนเท่าที่รู้ บรรทัดที่ไม่มีข้อมูลหายจากบทเอง (ไม่พูดเลขที่ไม่รู้)
 * 🔴 ค่าที่ทีม Online ตั้งเอง (จังหวัด/อำเภอ/ตำบล · รายได้) ชนะของ ERP — เหมือนที่ผู้สมัครเห็นบนหน้า /apply
 */
import { listSiamrajUnitRequests } from './siamrajUnitRequests.js';
import { attachNotes } from '../_handlers/siamraj-unit-requests.js';
import {
  fetchJobBenefitRates,
  monthlyGuaranteedIncome,
  requestNoFromJobRef,
  speakableBenefitLine,
} from './siamrajJobBenefits.js';
import { publicSafeAddressParts } from '../../src/lib/publicJobPrivacy.js';
import { publicJobTitle } from '../../src/lib/publicJobTitle.js';
import { boardProvinceOf } from '../../src/lib/boardFilters.js';
import { UNSPECIFIED } from '../../src/lib/facetEngine.js';
import type { JobRequest } from '../../src/types/index.js';
import { speakableAgeRange, speakableWorkArea, speakableWorkTime, type ApplyScriptFacts } from './lumosCallScript.js';
import { logError, logWarn } from './logger.js';

export type ApplyJobFacts = Pick<ApplyScriptFacts, 'workArea' | 'ageRange' | 'monthlyIncome' | 'benefitLine' | 'workSchedule'> & {
  /**
   * ชื่อจุดทำงานจากใบขอ (work_site_name → unit_name) — 🔴 ใบสมัครหลายใบไม่ได้เก็บชื่อหน่วยงานไว้
   * เดิม AI จึงพูดว่า "งานนี้ทำที่ หน่วยงานของเรา" (เจอในบทที่ส่งจริง 5 ต.ค. 2569)
   */
  unitName?: string | null;
  /** ชื่อตำแหน่งสั้นแบบหน้าประกาศ (`publicJobTitle` เช่น "พนักงานขับรถ ผู้บริหาร") — แทนหัวข้อประกาศยาว ๆ (6 ต.ค. 2569) */
  positionTitle?: string | null;
  /** อ่านใบขอได้จริงไหม — false = ล้ม/เกินเวลา (แยกจาก "ใบไม่มีรายได้" · ตัวส่งใช้ตัดสินว่าไม่ส่งเพราะอะไร) */
  loaded?: boolean;
};

const DEFAULT_TIMEOUT_MS = 4000;
/** อ่านกล่องงาน (ฐานเรา) — เผื่อเวลาหลัง ERP ไม่ทัน */
const BOX_TIMEOUT_MS = 2000;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

/** ค่ารายได้ที่ทีมตั้งเองบนใบ (ต่อเดือน) — ตั้งแบบรายวัน = ไม่ใช้ (คนละหน่วยกับประโยค "เดือนละ") */
function manualMonthlyIncome(job: Record<string, unknown>): number | null {
  const display = job.income_display as { period?: string; total?: number } | null | undefined;
  if (display && display.period === 'monthly' && typeof display.total === 'number' && display.total > 0) {
    return display.total;
  }
  if (display) return null;
  const fo = job.field_overrides as { total_income?: number | null } | null | undefined;
  return typeof fo?.total_income === 'number' && fo.total_income > 0 ? fo.total_income : null;
}

async function loadFacts(jobId: string): Promise<ApplyJobFacts> {
  const out: ApplyJobFacts = { loaded: true };
  const items = (await listSiamrajUnitRequests({ limit: 500, mode: 'all' })) as unknown as Array<Record<string, unknown>>;
  const found = items.find((j) => String(j.id ?? '') === jobId);
  if (!found) return out;
  // สำเนาเป็นของกลาง — แนบค่าที่ทีมตั้งลงสำเนาของเราเอง ห้ามแตะ object ในแคช
  const job = { ...found };
  await attachNotes([job]);

  out.unitName = String(job.work_site_name ?? '').trim() || String(job.unit_name ?? '').trim() || null;
  try {
    out.positionTitle = publicJobTitle(job as unknown as JobRequest).trim() || null;
  } catch {
    out.positionTitle = null;
  }
  /**
   * 🔴 พื้นที่ไม่ตัดบรรทัดทิ้ง (เจ้าของ 6 ต.ค. 2569) — ไม่มีตำบล/อำเภอ = จังหวัด (ตัวเดียวกับตัวกรองจังหวัดบนหน้า)
   * ไม่มีจังหวัดด้วย = ตัวประกอบบทใช้ชื่อหน่วยงานแทน (`applyValues`)
   */
  const province = boardProvinceOf(job as unknown as JobRequest);
  out.workArea =
    speakableWorkArea(publicSafeAddressParts(job as never)) ||
    (province && province !== UNSPECIFIED ? speakableWorkArea({ province }) : '') ||
    null;
  /**
   * เวลาทำงาน (เจ้าของ 6 ต.ค. 2569 · Choice "เพิ่มแค่เวลาทำงาน") — ค่าที่วางจากโพสต์ (`field_overrides.work_schedule`)
   * ชนะ ERP แล้วใน `attachNotes` · หยิบแค่ช่วงวัน + ช่วงเวลา (`speakableWorkTime`) · หาไม่เจอ = บรรทัดหายเอง
   */
  out.workSchedule = speakableWorkTime(job.work_schedule as string | null | undefined) || null;
  out.ageRange =
    speakableAgeRange(job.age_range_min as number | null | undefined, job.age_range_max as number | null | undefined) ||
    null;

  const manual = manualMonthlyIncome(job);
  const requestNo = requestNoFromJobRef(jobId);
  if (requestNo) {
    const rates = (await fetchJobBenefitRates([requestNo])).get(requestNo) ?? [];
    if (rates.length > 0) {
      out.monthlyIncome = manual ?? (monthlyGuaranteedIncome(rates).total || null);
      out.benefitLine = speakableBenefitLine(rates) || null;
      return out;
    }
  }
  out.monthlyIncome = manual;
  return out;
}

/**
 * ข้อมูลจาก **กล่องงานอย่างเดียว** (ค่าที่ทีม Online ตั้งในป๊อปประกาศ · ฐานเราเอง ไม่ยิง ERP)
 * 🔴 เจ้าของ 9 ต.ค. 2569: *"erp ไม่ตอบสนอง ทำไมมันไม่แนบตามกล่องอะ ในเมื่อฉันใช้กล่องงานเป็น script"*
 * เดิม ERP ช้าเกิน 4 วิ = ไม่ส่ง AI ทั้งที่รายได้ตั้งไว้ในกล่องแล้ว ⇒ ERP ไม่ทัน ให้ใช้ค่าจากกล่อง
 * มีรายได้ในกล่อง (ต่อเดือน) เท่านั้นถึงนับว่าใช้ได้ — ไม่มี = คืน null (ตัวส่งบอกเหตุ "อ่านไม่ทัน" ตามเดิม)
 * บรรทัดที่ต้องใช้ ERP (สวัสดิการจากอัตราเงิน · ชื่อจุดทำงาน · ชื่อตำแหน่ง) หายจากบทเอง ไม่พูดเลขที่ไม่รู้
 */
async function loadBoxFacts(jobId: string): Promise<ApplyJobFacts | null> {
  const job: Record<string, unknown> = { id: jobId, request_no: requestNoFromJobRef(jobId) ?? undefined };
  await attachNotes([job]);
  const income = manualMonthlyIncome(job);
  if (!income) return null;
  const province = String(job.override_province ?? '').trim();
  return {
    loaded: true,
    monthlyIncome: income,
    workArea: speakableWorkArea(publicSafeAddressParts(job as never)) || (province ? speakableWorkArea({ province }) : '') || null,
    workSchedule: speakableWorkTime(job.work_schedule as string | null | undefined) || null,
    ageRange:
      speakableAgeRange(job.age_range_min as number | null | undefined, job.age_range_max as number | null | undefined) || null,
  };
}

/** ข้อมูลงานของบทผู้สมัครผ่านลิงก์ — ล้ม/เกินเวลา = ใช้ค่าจากกล่องงาน (ถ้ามีรายได้) · ไม่มีเลย = `{}` */
export async function loadApplyScriptFacts(jobId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ApplyJobFacts> {
  // อ่านกล่องงานไปพร้อมกัน (ฐานเรา เร็ว) — ERP ไม่ทันจะได้ไม่ต้องรอเพิ่ม
  const box = loadBoxFacts(jobId).catch((e) => {
    logError('apply-script.facts.box_failed', e, { jobId });
    return null;
  });
  const full = await withTimeout(
    loadFacts(jobId).catch((e) => {
      logError('apply-script.facts.failed', e, { jobId });
      return {} as ApplyJobFacts;
    }),
    timeoutMs,
    {},
  );
  if (full.loaded) return full;
  const fromBox = await withTimeout(box, BOX_TIMEOUT_MS, null);
  if (fromBox) {
    logWarn('apply-script.facts.box_only', { jobId });
    return fromBox;
  }
  return full;
}

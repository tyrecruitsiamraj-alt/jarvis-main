/**
 * ═══ หน้ากล่องงาน = "ปล่อยไปแล้วเท่าไหร่ ยังไม่ปล่อยเท่าไหร่" ═══
 *
 * เจ้าของสั่งรื้อ 27 ส.ค. 2569:
 * > *"อยากเปิดมาแล้วรู้ว่า อ้อ ตอนนี้มีใบขอเท่านี้นะ เราปล่อยไปหน้าสาธารณะเท่านี้แล้วนะ
 * >  เหลืออีกเท่านี้นะ แล้วพอจะปล่อยก็ไปกดดูแล้วก็ตามขั้นตอน 1 2 3 4 แล้วก็ปล่อยไป"*
 *
 * ═══ 3 ก้อนบนหัว (เจ้าของเคาะชื่อเอง 28 ส.ค. 2569) ═══
 *
 *   `all`        ทั้งหมด        = ใบเปิดทุกใบที่ผ่านตัวกรองบนจอ
 *   `released`   ปล่อยแล้ว      = อยู่ในทะเบียน `job_public_releases`
 *   `unreleased` ยังไม่ปล่อย    = ที่เหลือ
 *
 * ✅ `released + unreleased = all` เป๊ะ · **และตรงกับเลขบนหน้าหลักด้วย**
 * (หน้าหลักนับแบบนี้มาตลอด — ก่อนหน้านี้กล่องงานเคยใช้นิยามของตัวเอง แล้วเลขสองหน้าไม่ตรง)
 *
 * 🔴 **เคยมีก้อนที่สี่ "ไม่ต้องปล่อย"** (ใบที่ ERP พาไปคัดเลือก/เริ่มงานแล้ว) — ผมเพิ่มเอง
 * เพื่อกันปุ่ม "ปล่อยทีเดียว" ไปปล่อยใบที่มีคนทำอยู่ · เจ้าของสั่งยุบทิ้ง 28 ส.ค. 2569
 * (*"คำว่า ไม่ต้องปล่อย ฉันให้ใช้ว่า ยังไม่ปล่อย"*) ⇒ **จอเหลือ 3 ก้อน**
 * ⚠️ แต่ความจริงเรื่องใบที่เริ่มงานแล้วไม่หายไป — ย้ายไปอยู่ที่ `stillSourcing()`
 * ซึ่ง**ปุ่มปล่อยเป็นชุดต้องใช้** ไม่งั้นกลับไปปล่อยประกาศหาคนของตำแหน่งที่มีคนทำอยู่
 *
 * ═══ ขั้นตอน 1 2 3 4 (เจ้าของเคาะเอง 28 ส.ค. 2569) ═══
 *
 *   ① ข้อมูลใบขอ  ② สถานที่ปฏิบัติงาน  ③ สวัสดิการ  ④ Genlink + ส่งประกาศ
 *
 * 🔴 **แบ่ง `unreleased` ได้ครบไม่ซ้ำ** — ไล่ถอยหลังจากปลายทางเพื่อไม่ให้ใบที่เดินไกลกว่า
 * ถูกดึงกลับ ⇒ ผลรวมทุกขั้น = `unreleased` เป๊ะ (มีเทสต์คุม)
 *
 * ⚠️ **ไม่มีเหตุการณ์ "ทำขั้นนี้แล้ว" ในระบบ** — เจ้าของสั่งไว้ว่าไม่ต้องมีปุ่มติ๊กว่าทำแล้ว
 * เราจึงอ่านจาก**ร่องรอยที่คนทิ้งไว้จริง**: มีลิงก์แล้ว (`recruit_postings`) ·
 * แก้ข้อมูลที่จะขึ้นประกาศแล้ว (`field_overrides`) · จดหมายเหตุไว้ (`list_note`)
 * **ห้ามเดานอกจากสามอย่างนี้**
 */
import { isEdited, hasNote } from '@/lib/boardFlow';
import { openJobBoxOf } from '@/lib/jobBoxGroups';
import type { JobRequest } from '@/types';

/** ก้อนบนหัวกล่องงาน */
export type ReleaseLaneKey = 'all' | 'released' | 'unreleased';

/** ขั้นที่ใบ "ยังไม่ปล่อย" ค้างอยู่ — ตรงกับขั้นตอน 1 2 3 4 ที่เจ้าของเคาะ */
export type ReleaseStepKey = 'info' | 'place' | 'benefits' | 'publish';

/** ของที่ต้องรู้ต่อใบ */
export type ReleaseFacts = {
  /** ใบนี้มีประกาศ + ลิงก์สมัครของตัวเองแล้วหรือยัง (`recruit_postings`) */
  hasLink: (job: JobRequest) => boolean;
  /** อยู่ในทะเบียนปล่อยขึ้นหน้าสาธารณะแล้วหรือยัง (`job_public_releases`) */
  isReleased: (job: JobRequest) => boolean;
  /** มีคนกรอกใบสมัครเข้ามาแล้วกี่คน */
  applicants: (job: JobRequest) => number;
};

/** ใบนี้อยู่ก้อนไหน — `all` ไม่ใช่ก้อนของใบ เป็นยอดรวม จึงไม่มีในผลลัพธ์ */
export function releaseLaneOf(job: JobRequest, facts: ReleaseFacts): 'released' | 'unreleased' {
  return facts.isReleased(job) ? 'released' : 'unreleased';
}

/**
 * 🔴 ใบนี้ **ยังเป็นงานหาคนของเราอยู่ไหม** — ใช้กับปุ่มปล่อยเป็นชุดเท่านั้น
 *
 * วัดจริง 27 ส.ค. 2569: ใบที่ยังไม่ปล่อยมี 127 ใบ แต่ **23 ใบในนั้นมีคนเริ่มงานไปแล้ว**
 * (ระบบงานหลักพาไปต่อโดยที่เราไม่เคยกดปล่อย) ⇒ ปล่อยเป็นชุดทั้ง 127 = ไปประกาศหาคน
 * ของตำแหน่งที่มีคนทำอยู่แล้ว · จอไม่ต้องโชว์เรื่องนี้ (เจ้าของสั่งยุบก้อน) แต่**ปุ่มต้องรู้**
 */
export function stillSourcing(job: JobRequest): boolean {
  return openJobBoxOf(job) === 'sourcing';
}

/**
 * ใบที่ยังไม่ปล่อย ติดอยู่ขั้นไหน — **ไล่ถอยหลังจากปลายทาง**
 *
 * ④ มีลิงก์แล้ว = เหลือกดส่งประกาศ
 * ③ แก้ข้อมูลที่จะขึ้นประกาศแล้ว แต่ยังไม่มีลิงก์ (สวัสดิการ/รายได้ถูกแตะแล้ว)
 * ② มีหมายเหตุว่าติดอะไร = มีคนอ่านใบแล้ว แต่ยังไม่ได้กรอกของที่จะขึ้นประกาศ
 * ① ไม่มีร่องรอยเลย = ยังไม่มีใครอ่านใบนี้
 *
 * ⚠️ เรียกกับใบที่ **ยังไม่ปล่อย** เท่านั้น
 */
export function releaseStepOf(job: JobRequest, facts: ReleaseFacts): ReleaseStepKey {
  if (facts.hasLink(job)) return 'publish';
  if (isEdited(job)) return 'benefits';
  if (hasNote(job)) return 'place';
  return 'info';
}

export const RELEASE_STEP_ORDER: readonly ReleaseStepKey[] = [
  'info',
  'place',
  'benefits',
  'publish',
];

/**
 * ป้ายของแต่ละขั้น — 🔴 แหล่งเดียว ห้ามพิมพ์ซ้ำในหน้าจอ
 *
 * ชื่อขั้นมาจากเจ้าของเองตรง ๆ (28 ส.ค. 2569):
 * > *"ข้อมูลใบขอแบบเดียวกับของใบขอ แต่เอาเฉพาะข้อมูลใบขอที่ต้องกดลูกศรลงถึงจะเห็น ·
 * >  กดถัดไปจะเจอช่องให้ใส่สถานที่ปฏิบัติงาน · กดถัดไปจะเจอช่อง Checklist ให้เลือกว่า
 * >  จากข้อมูลใบขอจะเอาอะไรมาเป็นสวัสดิการบ้าง · กดถัดไปจะเจอหน้าให้ Genlink
 * >  และเมื่อ Gen แล้ว มีปุ่มให้กด ส่งประกาศ"*
 *
 * 🔴 `label` ต้องเป็น**งานที่ต้องทำ** ไม่ใช่สภาพของใบ (สภาพอยู่ `state`)
 * — เทสต์กันไว้ว่าห้ามขึ้นต้นด้วย ยัง/ไม่/รอ
 */
export const RELEASE_STEP_TEXT: Record<
  ReleaseStepKey,
  { step: number; label: string; state: string; hint: string; todo: string }
> = {
  info: {
    step: 1,
    label: 'ตรวจใบขอ',
    state: 'ยังไม่มีใครอ่าน',
    hint: 'ไม่มีร่องรอยว่ามีคนเปิดดูใบนี้ — ไม่มีหมายเหตุ ไม่มีการแก้ข้อมูลประกาศ',
    todo: 'อ่านข้อมูลใบขอให้ครบ ติดอะไรจดในช่องหมายเหตุ',
  },
  place: {
    step: 2,
    label: 'ใส่สถานที่ปฏิบัติงาน',
    state: 'อ่านแล้ว มีหมายเหตุค้าง',
    hint: 'มีคนอ่านใบนี้แล้ว แต่ยังไม่ได้กรอกของที่จะขึ้นประกาศ',
    todo: 'ใส่สถานที่ปฏิบัติงานที่ผู้สมัครจะเห็น',
  },
  benefits: {
    step: 3,
    label: 'เลือกสวัสดิการ',
    state: 'ข้อมูลถูกแตะแล้ว',
    hint: 'แก้ข้อมูลที่จะขึ้นประกาศไปบ้างแล้ว แต่ยังไม่มีลิงก์สมัคร',
    todo: 'ติ๊กเลือกจากข้อมูลใบขอว่าจะเอาอะไรขึ้นเป็นสวัสดิการ',
  },
  publish: {
    step: 4,
    label: 'สร้างลิงก์ + ส่งประกาศ',
    state: 'มีลิงก์แล้ว รอกดส่ง',
    hint: 'มีลิงก์สมัครแล้ว เหลือกดส่งประกาศขึ้นหน้าสาธารณะ — คนนอกกับ AI จะเห็นทันที',
    todo: 'สร้างลิงก์ตามช่องทาง แล้วกดส่งประกาศ',
  },
};

/** ป้ายของก้อนบนหัว — 🔴 แหล่งเดียว · ชื่อมาจากเจ้าของเอง */
export const RELEASE_LANE_TEXT: Record<ReleaseLaneKey, { label: string; hint: string }> = {
  all: {
    label: 'ทั้งหมด',
    hint: 'ใบขอที่ยังเปิดอยู่ทั้งหมดในชุดที่กรองอยู่ตอนนี้',
  },
  released: {
    label: 'ปล่อยแล้ว',
    hint: 'ปล่อยขึ้นหน้าสมัครสาธารณะแล้ว คนนอกและ AI เห็นใบนี้ — กดดูว่ามีคนสมัครเข้ามาไหม',
  },
  unreleased: {
    label: 'ยังไม่ปล่อย',
    hint: 'คนนอกยังไม่เห็นใบนี้ — นี่คือกองงานปล่อยประกาศ',
  },
};

/**
 * ═══ ความคืบหน้าของ **ใบเดียว** สำหรับโชว์บนการ์ด ═══
 *
 * เจ้าของสั่ง 31 ส.ค. 2569 (ส่งภาพตัวอย่างบอร์ดงานแปลเกมมาให้ดู):
 * > *"หน้ากล่องงานทำแบบนี้ก็ดี จะได้รู้ว่าใบไหนอยู่ขั้นตอนไหน
 * >  **100% คือถึงแค่ส่งประกาศไปหน้าสาธารณะ ก็พอนะ**"*
 *
 * 🔴 **ปลายสเกลคือ "ปล่อยขึ้นหน้าสาธารณะ" ไม่ใช่ "หาคนได้"**
 * ⇒ ใบที่ปล่อยแล้ว = 100% เสมอ ถึงจะยังไม่มีคนสมัครก็ตาม
 * (ห้ามเอาจำนวนผู้สมัคร/การปิดใบขอมาปนในแถบนี้ — คนละเรื่อง คนละหน้า)
 *
 * 🔴 **นับจาก "ทำเสร็จกี่ขั้น" ไม่ใช่ "อยู่ขั้นไหน"** — ใบที่ค้างอยู่ขั้น 1 คือยังไม่ได้ทำอะไรเลย
 * จึงเป็น 0% (ไม่ปัดขึ้นให้ดูสวย · จอต้องไม่โม้ว่ามีความคืบหน้าทั้งที่ไม่มี)
 *
 * ⚠️ **ห้ามใส่เครื่องหมายถูก** ในแถบขั้น — บ้านนี้ถอดติ๊กถูกออกไปสองรอบแล้ว
 * (ติ๊กถูก = อ้างว่าเสร็จ ทั้งที่ระบบไม่มีหลักฐานว่าใครทำ) ให้โชว์ **เลขขั้น** เสมอ
 */
export type ReleaseProgress = {
  /** ขั้นที่ใบนี้ค้างอยู่ (1-4) · ใบที่ปล่อยแล้วเป็น `null` เพราะจบสเกลไปแล้ว */
  currentStep: number | null;
  /** ทำเสร็จไปกี่ขั้น (0-4) */
  doneSteps: number;
  /** ทั้งหมดกี่ขั้น — ปลายทางคือ "ส่งประกาศขึ้นหน้าสาธารณะ" */
  totalSteps: number;
  released: boolean;
  /** 0-100 · 100 = ปล่อยขึ้นหน้าสาธารณะแล้ว */
  percent: number;
  /** ป้ายบรรทัดเดียวใต้แถบขั้น */
  label: string;
};

export const RELEASE_TOTAL_STEPS = RELEASE_STEP_ORDER.length;

/** ความคืบหน้าของใบนี้ — 🔴 แหล่งเดียว ห้ามคำนวณ % ซ้ำที่หน้าจอ */
export function releaseProgressOf(job: JobRequest, facts: ReleaseFacts): ReleaseProgress {
  const total = RELEASE_TOTAL_STEPS;
  if (facts.isReleased(job)) {
    return {
      currentStep: null,
      doneSteps: total,
      totalSteps: total,
      released: true,
      percent: 100,
      label: RELEASE_LANE_TEXT.released.label,
    };
  }
  const key = releaseStepOf(job, facts);
  const stepNo = RELEASE_STEP_TEXT[key].step;
  const done = stepNo - 1;
  return {
    currentStep: stepNo,
    doneSteps: done,
    totalSteps: total,
    released: false,
    percent: Math.round((done / total) * 100),
    label: RELEASE_STEP_TEXT[key].label,
  };
}

/**
 * ข้อความ tooltip ของแถบความคืบหน้าบนการ์ด
 * 🔴 ต้องบอกให้ชัดว่า 100% คือ "ปล่อยประกาศแล้ว" ไม่ใช่ "หาคนได้ครบ"
 * (ไม่งั้นคนอ่านผิดว่าใบนี้จบงานแล้ว — คนละเรื่องกับการปิดใบขอ)
 */
export function releaseProgressTitle(progress: ReleaseProgress): string {
  const end = 'ครบ 100% = ส่งประกาศขึ้นหน้าสมัครงานสาธารณะแล้ว (ไม่ใช่ว่าหาคนได้ครบ)';
  if (progress.released) return `ปล่อยขึ้นหน้าสาธารณะแล้ว · ${end}`;
  const key = RELEASE_STEP_ORDER[(progress.currentStep ?? 1) - 1];
  return `ต้องทำ: ${RELEASE_STEP_TEXT[key].todo} · ${end}`;
}

export type ReleaseStepCount = {
  key: ReleaseStepKey;
  step: number;
  label: string;
  state: string;
  hint: string;
  todo: string;
  count: number;
};

export type ReleaseLedger = {
  /** ใบเปิดทั้งหมดที่ผ่านตัวกรองบนจอ */
  all: number;
  released: number;
  unreleased: number;
  /** ปล่อยไปแล้วกี่ % ของทั้งหมด — ไม่มีใบเลย ⇒ `null` (ห้ามโชว์ 0% ทั้งที่ไม่มีอะไร) */
  percent: number | null;
  /** แบ่ง `unreleased` ตามขั้นที่ติด — บวกทุกขั้นแล้วได้ `unreleased` เป๊ะ */
  steps: ReleaseStepCount[];
  /** ในใบที่ปล่อยแล้ว มีคนสมัครแล้วกี่ใบ / ยังเงียบกี่ใบ (บวกแล้วได้ `released`) */
  releasedWithApplicants: number;
  releasedSilent: number;
  /** หัวคนรวมของใบที่ปล่อยแล้วและมีคนสมัคร — เจ้าของขอเห็น "จำนวนเท่าไหร่" */
  applicantHeads: number;
  /**
   * ใบที่ปล่อยได้จริง = ยังไม่ปล่อย **และยังเป็นงานหาคนของเรา**
   * 🔴 ปุ่มปล่อยเป็นชุดต้องใช้เลขนี้ ห้ามใช้ `unreleased` (ดูเหตุผลที่ `stillSourcing`)
   */
  releasable: number;
};

/**
 * ประกอบเลขทั้งหัวหน้า
 *
 * @param openJobs ใบเปิด **หลังผ่านตัวกรองบนจอแล้ว** (เลขต้องตรงกับที่ตาเห็น)
 *
 * 🔴 ทุกตัวเลขต้องกระทบยอดกันได้:
 *   `released + unreleased = all`
 *   `ผลรวม steps = unreleased`
 *   `releasedWithApplicants + releasedSilent = released`
 * (มีเทสต์คุมทั้งสามข้อ — กติกาข้อแรกของโปรเจกต์นี้คือห้ามโกหกตัวเลข)
 */
export function buildReleaseLedger(
  openJobs: readonly JobRequest[],
  facts: ReleaseFacts,
): ReleaseLedger {
  let released = 0;
  let unreleased = 0;
  let releasedWithApplicants = 0;
  let applicantHeads = 0;
  let releasable = 0;

  const stepCount: Record<ReleaseStepKey, number> = {
    info: 0,
    place: 0,
    benefits: 0,
    publish: 0,
  };

  for (const job of openJobs) {
    if (facts.isReleased(job)) {
      released += 1;
      const n = facts.applicants(job);
      if (n > 0) {
        releasedWithApplicants += 1;
        applicantHeads += n;
      }
      continue;
    }
    unreleased += 1;
    stepCount[releaseStepOf(job, facts)] += 1;
    if (stillSourcing(job)) releasable += 1;
  }

  const all = openJobs.length;

  return {
    all,
    released,
    unreleased,
    percent: all > 0 ? Math.round((released / all) * 100) : null,
    steps: RELEASE_STEP_ORDER.map((key) => ({
      key,
      ...RELEASE_STEP_TEXT[key],
      count: stepCount[key],
    })),
    releasedWithApplicants,
    releasedSilent: released - releasedWithApplicants,
    applicantHeads,
    releasable,
  };
}

/** กรองการ์ดตามก้อนที่เลือก — `null` หรือ `'all'` = ทุกใบเปิด */
export function filterByReleaseLane(
  openJobs: readonly JobRequest[],
  facts: ReleaseFacts,
  lane: ReleaseLaneKey | null,
): JobRequest[] {
  if (!lane || lane === 'all') return [...openJobs];
  return openJobs.filter((j) => releaseLaneOf(j, facts) === lane);
}

/** กรองการ์ดตามขั้นที่ติด — ใช้กับใบที่ยังไม่ปล่อยเท่านั้น */
export function filterByReleaseStep(
  openJobs: readonly JobRequest[],
  facts: ReleaseFacts,
  step: ReleaseStepKey,
): JobRequest[] {
  return openJobs.filter(
    (j) => !facts.isReleased(j) && releaseStepOf(j, facts) === step,
  );
}

/** ใบที่ปล่อยเป็นชุดได้ — ยังไม่ปล่อย และยังเป็นงานหาคนของเรา */
export function releasableJobsOf(
  openJobs: readonly JobRequest[],
  facts: ReleaseFacts,
): JobRequest[] {
  return openJobs.filter((j) => !facts.isReleased(j) && stillSourcing(j));
}

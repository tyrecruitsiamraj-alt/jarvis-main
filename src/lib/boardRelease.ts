/**
 * ═══ หน้ากล่องงาน = "ปล่อยไปแล้วเท่าไหร่ เหลืออีกเท่าไหร่" ═══
 *
 * เจ้าของสั่งรื้อ 27 ส.ค. 2569 (รอบสี่ · หลังเห็นเส้น 9 ขั้นแล้ว):
 * > *"หน้ากล่องงาน รื้อได้นะ · ฉันอยากเปิดมาแล้วรู้ว่า อ้อ ตอนนี้มีใบขอเท่านี้นะ
 * >  เราปล่อยไปหน้าสาธารณะเท่านี้แล้วนะ เหลืออีกเท่านี้นะ แล้วพอจะปล่อยก็ไปกดดู
 * >  แล้วก็ตามขั้นตอน 1 2 3 4 แล้วก็ปล่อยไป"*
 * > เคาะเพิ่ม: *"ขอแค่เปิดมารู้ว่า อ้อทำไปแล้วนะ แล้วก็กดดูได้ว่าที่ทำไปเป็นไงบ้าง
 * >  ยังไม่ทำเท่าไหร่"*
 *
 * ⇒ หน้านี้ตอบ **คำถามเดียว**: งานปล่อยประกาศเดินไปถึงไหนแล้ว
 * เส้น 9 ขั้นไม่ถูกทิ้ง — ถูกจัดใหม่ให้อยู่ใต้เลนที่เป็นเจ้าของมันจริง ๆ
 *
 * ═══ 3 เลน — บวกกันแล้วครบใบเปิดทั้งหมดเป๊ะ ═══
 *
 *   `toRelease` เหลือปล่อย    = ใบที่ยังเป็นงานสรรหาของเรา และยังไม่ได้ปล่อย
 *   `released`  ปล่อยแล้ว     = ใบที่ยังเป็นงานสรรหาของเรา และปล่อยแล้ว
 *   `movedOn`   ไม่ต้องปล่อย  = ใบที่ระบบงานหลักพาไปคัดเลือก/รอเริ่มงาน/เริ่มแล้ว
 *
 * 🔴 **`movedOn` มีอยู่เพราะเลขต้องไม่โกหก** — วัดจริง 27 ส.ค. 2569: ใบเปิด 301 ใบ
 * "ยังไม่ปล่อย" ตรง ๆ ได้ 125 ใบ **แต่ 24 ใบในนั้นมีคนเริ่มงานไปแล้ว**
 * (ERP พาไปต่อโดยที่เราไม่เคยกดปล่อย) ⇒ เอา 125 มาเป็น "งานที่ต้องทำ" คือสั่งให้คน
 * ไปปล่อยประกาศหาคนของตำแหน่งที่มีคนทำอยู่แล้ว · ตัวหารที่จริงคือ **205 ใบที่ยังต้องหาคน**
 *
 * ═══ ขั้นตอน 1 2 3 4 ของใบหนึ่ง (เจ้าของเคาะเอง) ═══
 *
 *   ① ตรวจใบขอ  ② แก้ข้อมูลประกาศ  ③ สร้างลิงก์  ④ ปล่อย
 *
 * 🔴 **"ติดขั้นไหน" แบ่ง `toRelease` ได้ครบและไม่ซ้ำ** — ไล่ถอยหลังจากปลายทาง
 * เพื่อไม่ให้ใบที่เดินไกลกว่าถูกดึงกลับ (แพตเทิร์นเดียวกับ `openJobStage`)
 *
 * ⚠️ **"ตรวจแล้ว" ไม่มีเหตุการณ์ในระบบ** — เจ้าของสั่งไว้ตอนทำเส้น 9 ขั้นว่า
 * *"ก็แค่ตรวจดูอะ ไม่มีอะไรก็ไปต่อ มีก็แจ้งไว้ว่าติดอะไร"* ⇒ ไม่มีปุ่ม "ตรวจแล้ว"
 * เราจึงอ่านจาก**ร่องรอยที่คนทิ้งไว้**: หมายเหตุ (`list_note`) หรือการแก้ข้อมูลประกาศ
 * (`field_overrides`) · ห้ามเดาว่า "ใครน่าจะตรวจแล้ว" นอกจากสองอย่างนี้
 */
import { isEdited, hasNote } from '@/lib/boardFlow';
import { openJobBoxOf } from '@/lib/jobBoxGroups';
import type { JobRequest } from '@/types';

/** เลนบนหัวหน้ากล่องงาน */
export type ReleaseLaneKey = 'toRelease' | 'released' | 'movedOn';

/** ขั้นที่ใบ "เหลือปล่อย" ค้างอยู่ — ตรงกับขั้นตอน 1 2 3 4 ที่เจ้าของเคาะ */
export type ReleaseStepKey = 'check' | 'fields' | 'link' | 'publish';

/** ของที่ต้องรู้ต่อใบ เพื่อบอกว่าอยู่เลนไหน/ติดขั้นไหน */
export type ReleaseFacts = {
  /** ใบนี้มีประกาศ + ลิงก์สมัครของตัวเองแล้วหรือยัง (`recruit_postings`) */
  hasLink: (job: JobRequest) => boolean;
  /** อยู่ในทะเบียนปล่อยขึ้นหน้าสาธารณะแล้วหรือยัง (`job_public_releases`) */
  isReleased: (job: JobRequest) => boolean;
  /** มีคนกรอกใบสมัครเข้ามาแล้วกี่คน */
  applicants: (job: JobRequest) => number;
};

/**
 * ใบเปิดหนึ่งใบอยู่เลนไหน — **ตอบได้เลนเดียวเสมอ**
 *
 * 🔴 ระบบงานหลักเป็นตัวตั้งก่อน: ไม่ใช่กล่อง "สรรหา" = งานปล่อยประกาศจบไปแล้ว
 * ไม่ว่าจะเคยกดปล่อยหรือไม่ (ดูเหตุผลเต็มบนหัวไฟล์)
 */
export function releaseLaneOf(job: JobRequest, facts: ReleaseFacts): ReleaseLaneKey {
  if (openJobBoxOf(job) !== 'sourcing') return 'movedOn';
  return facts.isReleased(job) ? 'released' : 'toRelease';
}

/**
 * ใบที่ "เหลือปล่อย" ติดอยู่ขั้นไหน — **ไล่ถอยหลังจากปลายทาง**
 *
 * ④ มีลิงก์แล้ว = เหลือแค่กดปล่อย
 * ③ แก้ข้อมูลประกาศแล้ว แต่ยังไม่มีลิงก์
 * ② มีหมายเหตุว่าติดอะไร = ตรวจแล้วแต่ยังไปต่อไม่ได้
 * ① ไม่มีร่องรอยเลย = ยังไม่มีใครตรวจ
 *
 * ⚠️ เรียกกับใบที่อยู่เลน `toRelease` เท่านั้น (ใบอื่นไม่มีขั้นให้ติด)
 */
export function releaseStepOf(job: JobRequest, facts: ReleaseFacts): ReleaseStepKey {
  if (facts.hasLink(job)) return 'publish';
  if (isEdited(job)) return 'link';
  if (hasNote(job)) return 'fields';
  return 'check';
}

export const RELEASE_STEP_ORDER: readonly ReleaseStepKey[] = ['check', 'fields', 'link', 'publish'];

/**
 * ป้าย + คำอธิบายของแต่ละขั้น — 🔴 แหล่งเดียว ห้ามพิมพ์ซ้ำในหน้าจอ
 *
 * 🔴 **`label` ต้องเป็น "งานที่ต้องทำ" ไม่ใช่ "สภาพของใบ"** (แก้ 27 ส.ค. 2569)
 * ทดสอบด้วยการให้โมเดลอ่อนสุดสวมบทพนักงานใหม่มาเล่นหน้านี้ — มันอ่าน
 * *"1. ยังไม่มีใครตรวจ 100"* แล้วเข้าใจว่าเป็น **ข้อมูลสถานะ** ไม่ใช่ขั้นตอนที่ต้องลงมือ
 * (รายงานมันบอกตรง ๆ ว่า *"เก็บข้อมูล 1-4 ตำแหน่ง ดูเหมือนข้อมูลสถานะ"*)
 * ⇒ เปลี่ยนเป็นคำกริยา: **ตรวจใบขอ · แก้ข้อมูลประกาศ · สร้างลิงก์ · กดปล่อย**
 * ส่วนสภาพของใบย้ายไปเป็น `state` ซึ่งขึ้นเป็นบรรทัดรองใต้คำกริยา
 */
export const RELEASE_STEP_TEXT: Record<
  ReleaseStepKey,
  { step: number; label: string; state: string; hint: string; todo: string }
> = {
  check: {
    step: 1,
    label: 'ตรวจใบขอ',
    state: 'ยังไม่มีใครแตะ',
    hint: 'ไม่มีร่องรอยว่ามีคนเปิดดูใบนี้ — ไม่มีหมายเหตุ ไม่มีการแก้ข้อมูลประกาศ',
    todo: 'เปิดดูว่าข้อมูลครบไหม ครบแล้วไปต่อได้เลย ติดอะไรให้จดในช่องหมายเหตุ',
  },
  fields: {
    step: 2,
    label: 'แก้ข้อมูลประกาศ',
    state: 'ตรวจแล้ว มีหมายเหตุค้าง',
    hint: 'มีคนจดหมายเหตุไว้ว่าติดอะไร แต่ยังไม่ได้แก้ข้อมูลที่จะขึ้นประกาศ',
    todo: 'เคลียร์ที่ติดไว้ แล้วแก้จังหวัด/รายได้/สวัสดิการที่จะขึ้นประกาศ',
  },
  link: {
    step: 3,
    label: 'สร้างลิงก์สมัคร',
    state: 'ข้อมูลพร้อมแล้ว',
    hint: 'แก้ข้อมูลที่จะขึ้นประกาศแล้ว แต่ยังไม่มีลิงก์สมัครของใบนี้',
    todo: 'สร้างลิงก์สมัครตามช่องทางที่จะเอาไปโพสต์',
  },
  publish: {
    step: 4,
    label: 'กดปล่อย',
    state: 'มีลิงก์แล้ว รอกดปุ่ม',
    hint: 'มีลิงก์สมัครแล้ว เหลือแค่กดปล่อยขึ้นหน้าสาธารณะ — คนนอกกับ AI จะเห็นใบนี้ทันที',
    todo: 'กดปล่อยขึ้นหน้าสาธารณะ',
  },
};

/** ป้ายของเลน — 🔴 แหล่งเดียว */
export const RELEASE_LANE_TEXT: Record<
  ReleaseLaneKey,
  { label: string; hint: string }
> = {
  toRelease: {
    label: 'เหลือปล่อย',
    hint: 'ใบที่ยังต้องหาคน และยังไม่ได้ปล่อยขึ้นหน้าสาธารณะ — นี่คือกองงานของวันนี้',
  },
  released: {
    label: 'ปล่อยแล้ว',
    hint: 'ปล่อยขึ้นหน้าสาธารณะแล้ว คนนอกและ AI เห็นใบนี้ — กดดูว่ามีคนสมัครเข้ามาไหม',
  },
  movedOn: {
    label: 'ไม่ต้องปล่อย',
    hint: 'ระบบงานหลักพาใบนี้ไปคัดเลือก / รอเริ่มงาน / เริ่มงานแล้ว — ปล่อยประกาศไปก็ไม่มีประโยชน์',
  },
};

export type ReleaseStepCount = {
  key: ReleaseStepKey;
  step: number;
  label: string;
  /** สภาพของใบในขั้นนี้ — บรรทัดรองใต้คำกริยา */
  state: string;
  hint: string;
  todo: string;
  count: number;
};

export type ReleaseLedger = {
  /** ใบเปิดทั้งหมดที่ผ่านตัวกรองบนจอ */
  openTotal: number;
  /** ตัวหารที่จริงของงานปล่อย = ใบที่ยังต้องหาคน (`toRelease` + `released`) */
  needsRelease: number;
  toRelease: number;
  released: number;
  movedOn: number;
  /** ปล่อยไปแล้วกี่ % ของที่ต้องปล่อย — `needsRelease` = 0 ⇒ `null` (ห้ามโชว์ 0% ทั้งที่ไม่มีงาน) */
  percent: number | null;
  /** แบ่ง `toRelease` ตามขั้นที่ติด — บวกทุกขั้นแล้วได้ `toRelease` เป๊ะ */
  steps: ReleaseStepCount[];
  /** ในใบที่ปล่อยแล้ว มีคนสมัครเข้ามาแล้วกี่ใบ / ยังเงียบกี่ใบ (บวกแล้วได้ `released`) */
  releasedWithApplicants: number;
  releasedSilent: number;
};

/**
 * ประกอบเลขทั้งหัวหน้า
 *
 * @param openJobs ใบเปิด **หลังผ่านตัวกรองบนจอแล้ว** (เลขต้องตรงกับที่ตาเห็น)
 *
 * 🔴 ทุกตัวเลขที่คืนออกไปต้องกระทบยอดกันได้:
 *   `toRelease + released + movedOn = openTotal`
 *   `ผลรวม steps = toRelease`
 *   `releasedWithApplicants + releasedSilent = released`
 * (มีเทสต์คุมทั้งสามข้อ — นี่คือกติกา "ห้ามโกหกตัวเลข" ของโปรเจกต์นี้)
 */
export function buildReleaseLedger(
  openJobs: readonly JobRequest[],
  facts: ReleaseFacts,
): ReleaseLedger {
  let toRelease = 0;
  let released = 0;
  let movedOn = 0;
  let releasedWithApplicants = 0;

  const stepCount: Record<ReleaseStepKey, number> = {
    check: 0,
    fields: 0,
    link: 0,
    publish: 0,
  };

  for (const job of openJobs) {
    const lane = releaseLaneOf(job, facts);
    if (lane === 'movedOn') {
      movedOn += 1;
      continue;
    }
    if (lane === 'released') {
      released += 1;
      if (facts.applicants(job) > 0) releasedWithApplicants += 1;
      continue;
    }
    toRelease += 1;
    stepCount[releaseStepOf(job, facts)] += 1;
  }

  const needsRelease = toRelease + released;

  return {
    openTotal: openJobs.length,
    needsRelease,
    toRelease,
    released,
    movedOn,
    percent: needsRelease > 0 ? Math.round((released / needsRelease) * 100) : null,
    steps: RELEASE_STEP_ORDER.map((key) => ({
      key,
      ...RELEASE_STEP_TEXT[key],
      count: stepCount[key],
    })),
    releasedWithApplicants,
    releasedSilent: released - releasedWithApplicants,
  };
}

/** กรองการ์ดตามเลนที่เลือก — `null` = ทุกใบเปิด */
export function filterByReleaseLane(
  openJobs: readonly JobRequest[],
  facts: ReleaseFacts,
  lane: ReleaseLaneKey | null,
): JobRequest[] {
  if (!lane) return [...openJobs];
  return openJobs.filter((j) => releaseLaneOf(j, facts) === lane);
}

/** กรองการ์ดตามขั้นที่ติด — ใช้ได้กับเลน `toRelease` เท่านั้น */
export function filterByReleaseStep(
  openJobs: readonly JobRequest[],
  facts: ReleaseFacts,
  step: ReleaseStepKey,
): JobRequest[] {
  return openJobs.filter(
    (j) => releaseLaneOf(j, facts) === 'toRelease' && releaseStepOf(j, facts) === step,
  );
}

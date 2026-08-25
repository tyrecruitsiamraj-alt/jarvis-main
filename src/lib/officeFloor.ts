/**
 * "ห้องทำงาน" บนหน้าแรก — ตรรกะ pure ที่แปลง **เลขจริง** เป็นสถานะของโต๊ะแต่ละตัว
 * (เจ้าของสั่ง 22 ส.ค. 2569: *"อยากให้หน้าหลักมีตัวละครแทนแต่ละแผนก มีโต๊ะทำงาน
 * บอกว่าแต่ละคนตอนนี้กำลังทำอะไร … เอาเมาส์ไปจี้จะเห็นสถานะ"*)
 *
 * ทำไมต้องเป็นไฟล์ pure แยก: ทั้ง API (`api/_handlers/office-floor.ts`) และหน้าเว็บ
 * ต้องได้คำเดียวกัน — ถ้าปล่อยให้ฝั่งใดฝั่งหนึ่งแปลผลเอง จะซ้ำรอยบั๊กเดิมที่
 * "ข้อความมาจากฟังก์ชันหนึ่ง แต่สีมาจากอีกฟังก์ชันหนึ่ง" แล้วสองอย่างขัดกันเงียบ ๆ
 *
 * 🔴 กติกาที่ฝังไว้ (มาจากสิ่งที่เจ้าของตีตกมาแล้ว):
 * 1. **โต๊ะว่างต้องดูว่าง ไม่ใช่โชว์เลข 0** — ตอนนี้ฐานใหม่มีใบสมัคร 1 ใบทั้งระบบ
 *    ถ้าเอา "0" ไปแปะทุกโต๊ะจะกลายเป็นป้ายตาย (anti-pattern ข้อ 3 "ห้ามตัวนับที่ขึ้น 0
 *    แทบทุกวัน") · ที่นี่จึงตอบเป็น **สถานะ** ("โต๊ะนี้ไม่มีงานค้าง") ไม่ใช่ตัวเลขเปล่า
 * 2. **ของค้างชนะทุกอย่าง** — โต๊ะที่มีของต้องลงมือ ต้องอ่านออกก่อนโต๊ะที่กำลังยุ่ง
 * 3. **ทุกเลขบอกหน่วย** (ใบ/สาย/คน/ชื่อ) — บทเรียน "292 กับ 340" ที่คนอ่านเดาหน่วยเอง
 * 4. **ห้ามเดาสถานะจากเลขที่ไม่มี** — โต๊ะที่ระบบยังไม่มีของจริงให้ตอบ `off` ตรง ๆ
 */

import type { ToneKey } from '@/lib/designTokens';

/** สถานะโต๊ะ — เรียงตามความสำคัญที่คนต้องเห็นก่อน (blocked → idle) */
export type DeskState = 'blocked' | 'calling' | 'working' | 'idle' | 'off';

export type DeskId = 'intake' | 'aiCalls' | 'selection' | 'follow' | 'content' | 'aftercare';

/** ตัวเลขบนโต๊ะ — `unit` บังคับใส่ (กติกาข้อ 3) */
export type DeskStat = {
  key: string;
  label: string;
  value: number;
  unit: string;
  tone?: ToneKey;
  /** ต้องลงมือ → ขอบเรืองขึ้นบนจอ */
  alert?: boolean;
  /** ลิงก์ของช่องนี้ (ไม่มี = ใช้ลิงก์ของโต๊ะ) */
  href?: string;
};

export type Desk = {
  id: DeskId;
  /** ชื่อโต๊ะที่คนในทีมเรียกกันจริง */
  label: string;
  /** ชื่อตัวละคร (คนหรือระบบ) */
  who: string;
  state: DeskState;
  /** ประโยคเดียวว่า "ตอนนี้กำลังทำอะไร" — โชว์ตอนเอาเมาส์จี้ */
  doing: string;
  /** จำนวนของที่ต้องลงมือ (0 = ไม่มี) */
  backlog: number;
  /** ค้างนานสุดกี่วัน (null = ไม่มีของค้าง) */
  oldestDays: number | null;
  tone: ToneKey;
  stats: DeskStat[];
  /** กดโต๊ะแล้วไปหน้างานจริง */
  href: string;
};

/** เลขดิบที่ API นับมาให้ — ทุกฟิลด์เป็นจำนวนนับ (ไม่ใช่ %) */
export type OfficeFloorRaw = {
  intake: {
    /** ใบสมัครที่กรอกเข้ามาวันนี้ */
    newToday: number;
    /** ยังไม่มีใครแตะเลย */
    untouched: number;
    /** อยู่ในคิว AI รอผล */
    inQueue: number;
    /** มีคนถือ/เก็บไปติดต่อ */
    held: number;
    /** เก็บไปแล้วเงียบเกิน 1 วัน (= ของที่ต้องลงมือ) */
    claimedIdle: number;
    /** ยังไม่ถูกโทรและกรอกมาเกิน 5 วัน */
    over5d: number;
    /**
     * รอเลือกวิธีโทร — ถูก worker ถอด claim แล้วยังไม่มีใครเลือก (Phase 5.9)
     * ⚠️ `undefined` = ฐานยังไม่รัน migration 104 (ไม่ใช่ 0) — ห้ามโชว์ช่องนี้ตอนนั้น
     */
    awaitingChoice?: number;
    /** อายุของที่ค้างนานสุด (วัน) */
    oldestDays: number | null;
  };
  aiCalls: {
    /** รอส่งออก */
    pending: number;
    /** ส่งให้ Lumos แล้วยังไม่มีผลกลับ */
    waitingResult: number;
    /** ส่งไปแล้วเงียบเกิน 1 วัน (= ของที่ต้องลงมือ) */
    staleOverDay: number;
    /** ได้ผลกลับวันนี้ */
    resultToday: number;
    oldestDays: number | null;
  };
  selection: {
    /**
     * ใบขอที่เปิดอยู่ — `null` = ยังไม่รู้
     *
     * เลขนี้มาจาก ERP (MSSQL) ซึ่งช้ากว่าคิวรี pg ทั้งหมดรวมกัน จึง **ไม่ดึงในเส้น
     * `/api/office-floor`** (เส้นของหน้าแรก ต้องเบา) — หน้าแรกโหลด `flow-summary`
     * อยู่แล้วและมีเลขนี้ จึงเติมเข้ามาทีหลังที่ฝั่งหน้าเว็บ
     * ถ้าเป็น null → ไม่โชว์ช่อง "ยังไม่มีคนแนะนำ" เลย (ดีกว่าโชว์ 0 ที่แปลว่าคนละเรื่อง)
     */
    jobsOpen: number | null;
    /** ใบขอที่ AI คิดคนให้แล้ว */
    jobsWithMatch: number;
    /** คนที่เจ้าหน้าที่เก็บไปโทรเอง (ถังยังไม่ปล่อย) */
    holdsActive: number;
    /** เก็บไปโทรเองแล้วยังไม่มีผล */
    holdsNoResult: number;
    oldestDays: number | null;
  };
  follow: {
    /** นัดโทรวันนี้ */
    today: number;
    /** เลยเวลานัดแล้วยังไม่มีผล (= ของที่ต้องลงมือ) */
    pastDue: number;
    upcoming: number;
    oldestDays: number | null;
  };
  content: {
    /** รอทีมรับงาน */
    pending: number;
    inProgress: number;
    /** ส่ง Scraping (ทุกสถานะที่ยังไม่จบ) */
    scraping: number;
    oldestDays: number | null;
  };
  /** โต๊ะ "ดูแลหลังเริ่มงาน" — ยังไม่เปิดใช้จนกว่าจะทำ Phase 7 */
  aftercare: { enabled: boolean; count: number };
};

/**
 * ส่วนที่นับจาก PostgreSQL ได้ทั้งหมด — คือสิ่งที่ `GET /api/office-floor` คืนมา
 *
 * แยกออกมาเพราะเลขฝั่งใบขอ (เปิดกี่ใบ · AI คิดให้แล้วกี่ใบ) อยู่บน **ERP MSSQL**
 * ซึ่งช้ากว่าคิวรี pg ทั้งชุดรวมกัน · หน้าแรกโหลด `flow-summary` อยู่แล้วและมีสองเลขนั้น
 * จึงเอามาประกอบกันที่ฝั่งหน้าเว็บด้วย `composeOfficeFloorRaw()` แทนที่จะยิง ERP ซ้ำ
 */
export type OfficeFloorCounts = {
  intake: OfficeFloorRaw['intake'];
  aiCalls: OfficeFloorRaw['aiCalls'];
  /** ฝั่งถังโทรของคน (pg) เท่านั้น — ส่วนใบขอมาจาก ERP */
  selection: Pick<OfficeFloorRaw['selection'], 'holdsActive' | 'holdsNoResult' | 'oldestDays'>;
  follow: OfficeFloorRaw['follow'];
  content: OfficeFloorRaw['content'];
  /**
   * โต๊ะ "ดูแลหลังเริ่มงาน" — Phase 7 เปิดหน้าจริงแล้ว (ตาราง `aftercare_people` · 107)
   * `enabled: false` = ฐานยังไม่มีตาราง (ยังไม่รัน migration) ⇒ โต๊ะขึ้นว่า "ยังไม่เปิดใช้"
   * ⚠️ optional เพราะ API รุ่นเก่ายังไม่ส่งคีย์นี้มา — ไม่มีมาให้ถือว่ายังไม่เปิด
   */
  aftercare?: OfficeFloorRaw['aftercare'];
};

/** เลขฝั่งใบขอที่มาจาก ERP (หน้าแรกได้จาก flow-summary อยู่แล้ว) */
export type OfficeFloorErpPart = {
  /** ใบขอที่เปิดอยู่ — null = ยังโหลดไม่เสร็จ/โหลดไม่ได้ */
  jobsOpen: number | null;
  /** ใบขอที่ AI คิดคนให้แล้ว (นับเฉพาะใบที่ยังเปิด — ห้ามเอายอดรวมใน board_match_results
   *  ที่มีใบปิดปนมาด้วย ไม่งั้น "ยังไม่มีคนแนะนำ" จะกลายเป็น 0 ทั้งที่ยังมีอีกร้อยกว่าใบ) */
  jobsWithMatch: number;
};

export function composeOfficeFloorRaw(
  counts: OfficeFloorCounts,
  erp: OfficeFloorErpPart,
  /**
   * ค่าบังคับจากผู้เรียก — ปกติ **ไม่ต้องส่ง** เพราะ `counts.aftercare` มาจาก API แล้ว
   * (เก็บพารามิเตอร์ไว้เพื่อเทสต์/ผู้เรียกที่มีแหล่งอื่น)
   */
  aftercare?: OfficeFloorRaw['aftercare'],
): OfficeFloorRaw {
  return {
    intake: counts.intake,
    aiCalls: counts.aiCalls,
    selection: { ...counts.selection, jobsOpen: erp.jobsOpen, jobsWithMatch: erp.jobsWithMatch },
    follow: counts.follow,
    content: counts.content,
    aftercare: aftercare ?? counts.aftercare ?? { enabled: false, count: 0 },
  };
}

const nz = (n: number | null | undefined): number => (typeof n === 'number' && n > 0 ? n : 0);

/** "3 วัน" / "" — ใช้ต่อท้ายประโยค `doing` */
function agePhrase(days: number | null): string {
  const d = nz(days);
  return d > 0 ? ` · นานสุด ${d} วัน` : '';
}

function buildIntake(r: OfficeFloorRaw['intake']): Desk {
  // ⚠️ "รอเลือกวิธีโทร" นับเป็นของค้างด้วย — ไม่เลือกใน 1 วัน AI รับไปเอง คนจึงต้องเห็นก่อน
  const backlog = nz(r.claimedIdle) + nz(r.over5d) + nz(r.awaitingChoice);
  const active = nz(r.held) + nz(r.inQueue);
  const state: DeskState =
    backlog > 0 ? 'blocked' : nz(r.untouched) > 0 || active > 0 ? 'working' : 'idle';
  const doing =
    backlog > 0
      ? `มีของค้างต้องลงมือ ${backlog} ใบ${agePhrase(r.oldestDays)}`
      : nz(r.untouched) > 0
        ? `ใบสมัครรอโทร ${r.untouched} ใบ`
        : active > 0
          ? `กำลังไล่ติดต่อ ${active} ใบ`
          : 'ไม่มีใบสมัครค้าง — รอคนกรอกเข้ามา';
  return {
    id: 'intake',
    label: 'โต๊ะทีมสรรหา',
    who: 'ทีมสรรหา',
    state,
    doing,
    backlog,
    oldestDays: backlog > 0 ? (r.oldestDays ?? null) : null,
    tone: backlog > 0 ? 'warn' : 'info',
    stats: [
      { key: 'newToday', label: 'กรอกเข้ามาวันนี้', value: nz(r.newToday), unit: 'ใบ', tone: 'info' },
      { key: 'untouched', label: 'ยังไม่มีใครแตะ', value: nz(r.untouched), unit: 'ใบ', tone: 'warn' },
      { key: 'held', label: 'มีคนถืออยู่', value: nz(r.held), unit: 'ใบ', tone: 'violet' },
      {
        key: 'claimedIdle',
        label: 'เก็บแล้วเงียบเกิน 1 วัน',
        value: nz(r.claimedIdle),
        unit: 'ใบ',
        tone: 'danger',
        alert: nz(r.claimedIdle) > 0,
      },
      // ⚠️ ฐานยังไม่รัน 104 → undefined → **ไม่โชว์ช่องนี้เลย** (ไม่ใช่โชว์ 0 ที่โกหก)
      ...(typeof r.awaitingChoice === 'number'
        ? [
            {
              key: 'awaitingChoice',
              label: 'รอเลือกวิธีโทร',
              value: r.awaitingChoice,
              unit: 'ใบ' as const,
              tone: 'warn' as const,
              alert: r.awaitingChoice > 0,
            },
          ]
        : []),
    ],
    // ของค้างมี → พาไปหน้ารายชื่อ **พร้อมถังนั้น** เลย (RmWorkspace รับ ?bucket= อยู่แล้ว)
    // เจ้าของสั่งว่าระบบต้อง "นำทางการทำงาน" — ลงหน้าที่กดต่อได้ ดีกว่าเปิดป๊อปอ่านเฉย ๆ
    // ลำดับความด่วน: รอเลือกวิธีโทร (มีนาฬิกาเดินอยู่) ชนะ เก็บแล้วเงียบ
    href: nz(r.awaitingChoice) > 0
      ? '/jobs/board?view=list&bucket=awaiting_call_choice'
      : nz(r.claimedIdle) > 0
        ? '/jobs/board?view=list&bucket=claimed_idle'
        : '/jobs/board?view=list',
  };
}

function buildAiCalls(r: OfficeFloorRaw['aiCalls']): Desk {
  const backlog = nz(r.staleOverDay);
  const state: DeskState =
    backlog > 0 ? 'blocked' : nz(r.waitingResult) > 0 ? 'calling' : nz(r.pending) > 0 ? 'working' : 'idle';
  const doing =
    backlog > 0
      ? `ส่งไปแล้วเงียบ ${backlog} สาย${agePhrase(r.oldestDays)} — ควรเช็คกับทีม Lumos`
      : nz(r.waitingResult) > 0
        ? `กำลังโทร ${r.waitingResult} สาย`
        : nz(r.pending) > 0
          ? `มี ${r.pending} สายรอส่งออก`
          : 'ไม่มีสายในคิว';
  return {
    id: 'aiCalls',
    label: 'โต๊ะ AI โทร (Lumos)',
    who: 'Lumos',
    state,
    doing,
    backlog,
    oldestDays: backlog > 0 ? (r.oldestDays ?? null) : null,
    tone: backlog > 0 ? 'danger' : 'teal',
    stats: [
      { key: 'waitingResult', label: 'กำลังโทร / รอผล', value: nz(r.waitingResult), unit: 'สาย', tone: 'teal' },
      {
        key: 'staleOverDay',
        label: 'เงียบเกิน 1 วัน',
        value: nz(r.staleOverDay),
        unit: 'สาย',
        tone: 'danger',
        alert: nz(r.staleOverDay) > 0,
      },
      { key: 'resultToday', label: 'ได้ผลกลับวันนี้', value: nz(r.resultToday), unit: 'สาย', tone: 'success' },
      { key: 'pending', label: 'รอส่งออก', value: nz(r.pending), unit: 'สาย', tone: 'info' },
    ],
    href: '/matching/match',
  };
}

function buildSelection(r: OfficeFloorRaw['selection']): Desk {
  const noMatch = r.jobsOpen === null ? null : Math.max(0, r.jobsOpen - nz(r.jobsWithMatch));
  const backlog = nz(r.holdsNoResult);
  const state: DeskState =
    backlog > 0 ? 'blocked' : nz(r.holdsActive) > 0 ? 'calling' : nz(r.jobsWithMatch) > 0 ? 'working' : 'idle';
  const doing =
    backlog > 0
      ? `เก็บไปโทรเองแล้วยังไม่บันทึกผล ${backlog} คน${agePhrase(r.oldestDays)}`
      : nz(r.holdsActive) > 0
        ? `กำลังโทรเอง ${r.holdsActive} คน`
        : nz(r.jobsWithMatch) > 0
          ? `AI คิดคนไว้ให้แล้ว ${r.jobsWithMatch} ใบ รอคนเลือก`
          : 'ยังไม่มีผล match รอไว้';
  return {
    id: 'selection',
    label: 'โต๊ะคัดสรร / เสนองาน',
    who: 'ทีมคัดสรร',
    state,
    doing,
    backlog,
    oldestDays: backlog > 0 ? (r.oldestDays ?? null) : null,
    tone: backlog > 0 ? 'warn' : 'primary',
    stats: [
      /**
       * 🔴 สองช่องแรกนับ **ใบขอ** ไม่ใช่คน — ป้ายต้องขึ้นต้นด้วยคำว่า "ใบขอ" ให้ชัด
       * (Phase 10.3 · เจ้าของสั่ง: กล่องที่พูดถึงคน ต้องไม่เอายอดใบขอมาโชว์ปนโดยไม่บอก)
       * เดิมเขียนว่า "AI คิดคนให้แล้ว 12" แล้วต่อท้ายด้วยหน่วยเล็ก ๆ ว่า ใบขอ
       * คนอ่านผ่าน ๆ นับเป็นจำนวนคนทันที
       */
      { key: 'jobsWithMatch', label: 'ใบขอที่ AI คิดคนให้แล้ว', value: nz(r.jobsWithMatch), unit: 'ใบขอ', tone: 'info' },
      // โชว์เฉพาะเมื่อรู้ยอดใบเปิดจริง — null แปลว่า "ยังไม่รู้" ไม่ใช่ "ไม่มี"
      ...(noMatch === null
        ? []
        : [
            {
              key: 'noMatch',
              label: 'ใบขอที่ยังไม่มีคนแนะนำ',
              value: noMatch,
              unit: 'ใบขอ',
              tone: 'warn' as ToneKey,
            },
          ]),
      { key: 'holdsActive', label: 'เก็บไปโทรเอง', value: nz(r.holdsActive), unit: 'คน', tone: 'violet' },
      {
        key: 'holdsNoResult',
        label: 'โทรเองแล้วยังไม่บันทึกผล',
        value: nz(r.holdsNoResult),
        unit: 'คน',
        tone: 'danger',
        alert: nz(r.holdsNoResult) > 0,
      },
    ],
    href: '/matching/match',
  };
}

function buildFollow(r: OfficeFloorRaw['follow']): Desk {
  const backlog = nz(r.pastDue);
  const state: DeskState =
    backlog > 0 ? 'blocked' : nz(r.today) > 0 ? 'calling' : nz(r.upcoming) > 0 ? 'working' : 'idle';
  const doing =
    backlog > 0
      ? `เลยเวลานัดโทรแล้ว ${backlog} ราย${agePhrase(r.oldestDays)}`
      : nz(r.today) > 0
        ? `วันนี้ต้องโทรตาม ${r.today} ราย`
        : nz(r.upcoming) > 0
          ? `มีนัดโทรข้างหน้า ${r.upcoming} ราย`
          : 'ไม่มีนัดโทรค้าง';
  return {
    id: 'follow',
    label: 'โต๊ะโทรติดตาม (Follow)',
    who: 'ทีมติดตาม',
    state,
    doing,
    backlog,
    oldestDays: backlog > 0 ? (r.oldestDays ?? null) : null,
    tone: backlog > 0 ? 'danger' : 'success',
    stats: [
      { key: 'today', label: 'ต้องโทรวันนี้', value: nz(r.today), unit: 'ราย', tone: 'primary' },
      {
        key: 'pastDue',
        label: 'เลยเวลานัดแล้ว',
        value: nz(r.pastDue),
        unit: 'ราย',
        tone: 'danger',
        alert: nz(r.pastDue) > 0,
      },
      { key: 'upcoming', label: 'นัดข้างหน้า', value: nz(r.upcoming), unit: 'ราย', tone: 'info' },
    ],
    href: '/follow',
  };
}

function buildContent(r: OfficeFloorRaw['content']): Desk {
  const backlog = nz(r.pending);
  const state: DeskState =
    backlog > 0 ? 'blocked' : nz(r.inProgress) + nz(r.scraping) > 0 ? 'working' : 'idle';
  const doing =
    backlog > 0
      ? `มีคำขอรอทีมรับ ${backlog} ใบ${agePhrase(r.oldestDays)}`
      : nz(r.inProgress) + nz(r.scraping) > 0
        ? `กำลังทำอยู่ ${nz(r.inProgress) + nz(r.scraping)} ใบ`
        : 'ไม่มีคำขอค้าง';
  return {
    id: 'content',
    label: 'โต๊ะคอนเทนต์ / Scraping',
    who: 'ทีมคอนเทนต์',
    state,
    doing,
    backlog,
    oldestDays: backlog > 0 ? (r.oldestDays ?? null) : null,
    tone: backlog > 0 ? 'orange' : 'orange',
    stats: [
      { key: 'pending', label: 'รอทีมรับงาน', value: nz(r.pending), unit: 'ใบ', tone: 'warn', alert: backlog > 0 },
      { key: 'inProgress', label: 'กำลังคิดคอนเทนต์', value: nz(r.inProgress), unit: 'ใบ', tone: 'orange' },
      { key: 'scraping', label: 'ส่ง Scraping', value: nz(r.scraping), unit: 'ใบ', tone: 'teal' },
    ],
    href: '/jobs/board?view=postings',
  };
}

function buildAftercare(r: OfficeFloorRaw['aftercare']): Desk {
  if (!r.enabled) {
    return {
      id: 'aftercare',
      label: 'โต๊ะดูแลหลังเริ่มงาน',
      who: '—',
      state: 'off',
      // ตอบตรง ๆ ว่ายังไม่เปิด ดีกว่าโชว์ 0 แล้วให้คนเดาว่าพังหรือว่าง (กติกาข้อ 4)
      doing: 'ยังไม่เปิดใช้ — กำลังสร้างในเฟสถัดไป',
      backlog: 0,
      oldestDays: null,
      tone: 'neutral',
      stats: [],
      // Phase 7 เปิดหน้าจริงแล้ว → พาไปหน้านั้นได้เลยแม้ยังไม่มีคนในความดูแล
      href: '/aftercare',
    };
  }
  return {
    id: 'aftercare',
    label: 'โต๊ะดูแลหลังเริ่มงาน',
    who: 'ทีมดูแล',
    state: nz(r.count) > 0 ? 'working' : 'idle',
    doing: nz(r.count) > 0 ? `ดูแลอยู่ ${r.count} คน` : 'ไม่มีคนต้องตามในรอบนี้',
    backlog: 0,
    oldestDays: null,
    tone: 'violet',
    stats: [{ key: 'count', label: 'กำลังดูแล', value: nz(r.count), unit: 'คน', tone: 'violet' }],
    href: '/aftercare',
  };
}

/** ลำดับโต๊ะบนฉาก — ตามลำดับการไหลของงานจริง (คนกรอก → AI โทร → คัดสรร → ติดตาม → ดูแล) */
export const DESK_ORDER: DeskId[] = [
  'intake',
  'aiCalls',
  'selection',
  'follow',
  'content',
  'aftercare',
];

export function buildOfficeFloor(raw: OfficeFloorRaw): Desk[] {
  const byId: Record<DeskId, Desk> = {
    intake: buildIntake(raw.intake),
    aiCalls: buildAiCalls(raw.aiCalls),
    selection: buildSelection(raw.selection),
    follow: buildFollow(raw.follow),
    content: buildContent(raw.content),
    aftercare: buildAftercare(raw.aftercare),
  };
  return DESK_ORDER.map((id) => byId[id]);
}

/** โต๊ะที่มีของต้องลงมือ (เรียงของค้างมากสุดก่อน) — ใช้ทำแถบสรุปเหนือฉาก */
export function desksNeedingAction(desks: Desk[]): Desk[] {
  return desks.filter((d) => d.backlog > 0).sort((a, b) => b.backlog - a.backlog);
}

/** ประโยคสรุปทั้งห้อง — ตอบคำถาม "วันนี้ต้องไปช่วยโต๊ะไหน" ในบรรทัดเดียว */
export function officeHeadline(desks: Desk[]): string {
  const hot = desksNeedingAction(desks);
  if (hot.length === 0) {
    const busy = desks.filter((d) => d.state === 'calling' || d.state === 'working');
    return busy.length > 0
      ? `ไม่มีของค้างต้องลงมือ · ${busy.length} โต๊ะกำลังเดินงานอยู่`
      : 'ทุกโต๊ะว่าง — ไม่มีงานค้างในระบบ';
  }
  const first = hot[0];
  const rest = hot.length - 1;
  return rest > 0
    ? `${first.label} ต้องลงมือก่อน (${first.backlog}) · อีก ${rest} โต๊ะมีของค้าง`
    : `${first.label} ต้องลงมือ (${first.backlog})`;
}

/** อ่านค่าช่องหนึ่งของโต๊ะ (0 ถ้าไม่มีช่องนั้น) */
export function deskStatValue(desk: Desk | undefined, key: string): number {
  return desk?.stats.find((s) => s.key === key)?.value ?? 0;
}

/**
 * เส้น "งานไหลไปทางไหน" บนฉากห้องทำงาน
 *
 * เป็นตรรกะ ไม่ใช่ของประดับ — เส้นจะวิ่งเฉพาะตอนที่ **มีงานเดินอยู่จริง** ตามเลขของโต๊ะ
 * (ถ้าวาดให้วิ่งทุกเส้นตลอดเวลา มันจะกลายเป็นภาพเคลื่อนไหวที่ไม่ถือข้อมูล = ของประดับ
 * ซึ่งชนกติกา "แสงคือสถานะ ไม่ใช่ของประดับ")
 */
export type OfficeLink = {
  from: DeskId;
  to: DeskId;
  /** คำอธิบายว่าเส้นนี้หมายถึงงานอะไรไหลจากไหนไปไหน (ใช้เป็น title ให้ screen reader) */
  label: string;
};

export const OFFICE_LINKS: readonly OfficeLink[] = [
  { from: 'intake', to: 'aiCalls', label: 'ใบสมัครที่รอ/กำลังให้ AI โทร' },
  { from: 'aiCalls', to: 'selection', label: 'ผลโทรที่กลับมาให้ทีมคัดสรรเลือก' },
  { from: 'selection', to: 'follow', label: 'คนที่ต้องโทรติดตามวันนี้' },
  { from: 'intake', to: 'content', label: 'ใบที่ส่งให้ทีมคอนเทนต์/Scraping' },
  { from: 'follow', to: 'aftercare', label: 'คนที่ตามครบแล้ว ส่งไปดูแลหลังเริ่มงาน' },
];

/** เส้นนี้มีงานเดินอยู่จริงไหม — คิดจากเลขของโต๊ะสองฝั่ง */
export function isLinkFlowing(link: OfficeLink, byId: Partial<Record<DeskId, Desk>>): boolean {
  const from = byId[link.from];
  const to = byId[link.to];
  switch (`${link.from}->${link.to}`) {
    case 'intake->aiCalls':
      // มีใบอยู่ในมือคน หรือมีสายรออยู่ในคิว AI = งานเดินจากสรรหาไป AI
      return (
        deskStatValue(from, 'held') +
          deskStatValue(to, 'pending') +
          deskStatValue(to, 'waitingResult') >
        0
      );
    case 'aiCalls->selection':
      // ผลโทรที่กลับมาวันนี้ = ของใหม่ที่ไหลไปให้คัดสรร
      return deskStatValue(from, 'resultToday') > 0;
    case 'selection->follow':
      return deskStatValue(to, 'today') > 0;
    case 'intake->content':
      return (to?.state ?? 'idle') !== 'idle' && (to?.state ?? 'off') !== 'off';
    case 'follow->aftercare':
      return to?.state === 'working';
    default:
      return false;
  }
}

/**
 * ── ผังห้อง 3D (พิกัดบน "กระดานพื้น") ──────────────────────────────────────
 *
 * เจ้าของเคาะ 22 ส.ค. 2569: ฉากนี้คือ **dashboard 3D virtual office** ทำด้วย CSS 3D
 * พิกัดอยู่ในระบบของกระดานพื้น (หน่วย px ของกระดาน ไม่ใช่ของจอ):
 *   `x` = ซ้าย→ขวา · `y` = ไกล→ใกล้กล้อง (0 คือหลังห้อง)
 *
 * เรียงตาม **ทางเดินของงานจริง**: หลังห้อง = สายแยก (คอนเทนต์ · ดูแลหลังเริ่มงาน)
 * หน้าห้อง = สายหลักที่ทีมทำทุกวัน (สรรหา → AI → คัดสรร → ติดตาม)
 * `scale` = ขนาดป้ายตั้ง — ของที่อยู่ไกลเล็กลงเอง (ช่วยเรื่องความลึกอีกชั้น)
 */
export const OFFICE_BOARD = { width: 1020, depth: 470 } as const;

/** แกนกลาง (JARVIS Core) — ทุกทีมวางล้อมรอบจุดนี้ และเส้นงานทุกเส้นวิ่งผ่านมันด้วยสายตา */
export const OFFICE_CORE = { x: 510, y: 250 } as const;

/**
 * ตำแหน่งแท่นของแต่ละทีม — **วางล้อมแกนกลาง** (เจ้าของส่งภาพอ้างอิงมา 22-23 ส.ค. 2569
 * แล้วติของเดิมที่เรียงเป็นแถวว่า "บ้านนอกมาก")
 *
 * กติกาที่ยังคงอยู่จากรอบก่อน: `y` น้อย = ไกลกล้อง = แท่นเล็กลง (ความลึกบอกลำดับงาน)
 * สายหลักที่ทีมทำทุกวัน (สรรหา · AI · คัดสรร · ติดตาม) อยู่ใกล้กล้องกว่าสายแยก
 */
export const OFFICE_SLOTS: Record<DeskId, { x: number; y: number; scale: number }> = {
  intake: { x: 226, y: 132, scale: 0.84 },
  content: { x: 806, y: 128, scale: 0.84 },
  aiCalls: { x: 116, y: 320, scale: 1.02 },
  follow: { x: 908, y: 316, scale: 1.02 },
  selection: { x: 356, y: 440, scale: 1.12 },
  aftercare: { x: 668, y: 436, scale: 1.1 },
};

/**
 * 🔴 **ห้ามวางแท่นไหนไว้กลางคอลัมน์เดียวกับแกนกลาง** (x ≈ OFFICE_CORE.x)
 * ป้ายตั้งของแท่นที่อยู่ใกล้กล้องจะพุ่งขึ้นไปทับป้าย "JARVIS Core" พอดี
 * (เจอจริงตอนตรวจ 23 ส.ค. 2569: selection อยู่ x=510 เท่ากับ core แล้วมาสคอตบังป้ายจนอ่านไม่ออก)
 * แท่นสองตัวหน้าสุดจึงเยื้องซ้าย/ขวาออกจากแกนกลาง
 */

/** จุดกลางของโต๊ะบนกระดาน (ใช้วางเส้นทางงาน) */
export function slotPoint(id: DeskId): { x: number; y: number } {
  const s = OFFICE_SLOTS[id];
  return { x: s.x, y: s.y };
}

/** เส้นทางบนพื้น: มุมและความยาวจากโต๊ะหนึ่งไปอีกโต๊ะ (คิดในระบบพิกัดกระดาน) */
export function pathGeometry(from: DeskId, to: DeskId): {
  x: number;
  y: number;
  length: number;
  angleDeg: number;
} {
  const a = slotPoint(from);
  const b = slotPoint(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    x: a.x,
    y: a.y,
    length: Math.round(Math.hypot(dx, dy)),
    angleDeg: Math.round((Math.atan2(dy, dx) * 180) / Math.PI * 10) / 10,
  };
}

/**
 * เส้นจากแกนกลางไปแท่นของทีม — ภาพอ้างอิงใช้ "สายข้อมูล" วิ่งจาก Core ไปทุกแท่น
 * (ต่างจากรอบก่อนที่ลากเส้นโต๊ะต่อโต๊ะ) · ยังใช้ `isLinkFlowing` ตัวเดิมตัดสินว่าวิ่งไหม
 * โดยดูจาก "ทีมนี้มีงานเดินอยู่จริงหรือเปล่า"
 */
export function coreSpokeGeometry(id: DeskId): {
  x: number;
  y: number;
  length: number;
  angleDeg: number;
} {
  const s = OFFICE_SLOTS[id];
  const dx = s.x - OFFICE_CORE.x;
  const dy = s.y - OFFICE_CORE.y;
  return {
    x: OFFICE_CORE.x,
    y: OFFICE_CORE.y,
    length: Math.round(Math.hypot(dx, dy)),
    angleDeg: Math.round(((Math.atan2(dy, dx) * 180) / Math.PI) * 10) / 10,
  };
}

/** ทีมนี้มีงานเดินอยู่จริงไหม — ใช้ตัดสินว่าสายจาก Core ไปแท่นนี้ควรวิ่งหรือนิ่ง */
export function isDeskActive(desk: Desk | undefined): boolean {
  if (!desk) return false;
  return desk.state === 'blocked' || desk.state === 'calling' || desk.state === 'working';
}

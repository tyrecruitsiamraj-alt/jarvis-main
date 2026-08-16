/**
 * บทพูดของ AI — 3 ชุด (เจ้าของสั่ง 16 ส.ค. 2569:
 * *"ต้องการสคริปการสัมภาษณ์แบ่งเป็น 2 part … และสุดท้าย การ Follow
 * ลองดูจากของ Lumos แล้วทำให้ดีขึ้น"*)
 *
 *   1. **สัมภาษณ์เบื้องต้น** (`buildScreeningQuestions`) — เลนสรรหา · เรา**โทรไปหาเขา**
 *      เขายังไม่ได้สมัครงานใบนี้ ต้องแนะนำตัวก่อนเสมอ แล้วค่อยคัดกรอง
 *   2. **เสนองาน** (`buildOfferQuestions` / `buildOfferMessage`) — คนที่**ติดต่อเรามาแล้ว**
 *      (ฝากใบสมัคร/อยู่บนบอร์ด) ไม่ต้องแนะนำตัวใหม่ ตรงเข้าเรื่องงานแล้วปิดด้วยการนัด
 *   3. **Follow** (`buildFollowMessage`) — ข้อความติดตามที่เจ้าหน้าที่ตั้งเอง
 *
 * ⚠️ **ช่อง interview ไม่มีที่ใส่ข้อความอิสระ** — ทุกอย่างที่ AI พูดต้องอยู่ใน `questions[]`
 * (schema รับ 1–15 ข้อ) ส่วนช่อง reminder พูดยาวได้ใน `steps[].message`
 * บทสองช่องจึงหน้าตาไม่เหมือนกัน แต่ **ข้อเท็จจริงที่พูดต้องชุดเดียวกัน**
 *
 * 🔴 **ห้ามใส่ตัวเลขรายได้ในไฟล์นี้** — ตอนประกอบ payload เรายังไม่รู้ "หน่วย" ของค่าแรง
 * (`total_income` = `payment_rate` ดิบ) วัดจากฐาน 16 ส.ค. 2569: แถวค่าแรงหลัก 16,264 แถว
 * เป็นรายเดือน 13,646 · **รายวัน 2,608** · รายชั่วโมง 5 → พูด "รายได้ 500 บาท" ให้คนที่
 * งานจ่าย 500 **ต่อวัน** = บอกเลขผิด 30 เท่า (บั๊กเดียวกับที่แก้ไปแล้วบนหน้าสาธารณะ)
 * ตัวเลขจึงถูกเติม **ตอนเสิร์ฟคิว** จาก ERP ด้วยสูตรเดียวกับหน้าสาธารณะ
 * (`monthlyGuaranteedIncome` — เงินเดือน + รายได้มั่นคง) ดู `takePendingLumosItems`
 *
 * ไฟล์นี้ pure ทั้งไฟล์ — ไม่แตะ DB/เวลาจริง · เทสต์ที่ `tests/api/lumosCallScript.test.ts`
 */

/**
 * ชื่อที่ AI ใช้แนะนำตัว — เดิม**ไม่มีการแนะนำตัวเลย** ทั้งสองบท คนรับสายจึงไม่รู้ว่า
 * ใครโทรมาและไปเอาเบอร์มาจากไหน (เหตุผลอันดับต้น ๆ ที่คนวางสาย)
 * ⚠️ เปลี่ยนที่นี่ที่เดียวถ้าเจ้าของอยากให้เรียกชื่ออื่น
 */
export const CALLER_ORG = 'สยามราชธานี';

/**
 * ช้อยส์เหตุผล "ไม่สนใจ" (ML ขั้น 1 · เจ้าของสั่ง 16 ส.ค. 2569)
 *
 * ทำไมต้องอ่านช้อยส์ให้ฟังทางโทรศัพท์แทนที่จะปล่อยให้ตอบอิสระ: schema ของ Lumos
 * ไม่มีช่องส่ง "เหตุผล" กลับมาเป็นค่าคงที่ — ที่กลับมาคือ `summary`/`transcript`
 * เป็นภาษาคน การอ่านช้อยส์ให้ฟังทำให้คำตอบเกาะกลุ่มคำเดิม พอเอาไปจัดหมวดทีหลังได้
 * ⚠️ ต้องเป็นชุดเดียวกับฝั่ง**คนโทรเอง** (ข้อ 4) ไม่งั้นสองทางเก็บคนละหมวด รวมกันไม่ได้
 */
export const DECLINE_REASON_CHOICES = [
  'ค่าตอบแทนน้อยไป',
  'ที่ทำงานไกล',
  'ได้งานอื่นแล้ว',
  'เวลาทำงานไม่สะดวก',
  'งานไม่ตรงกับที่ทำ',
] as const;

const DECLINE_REASON_PROMPT = `ถ้ายังไม่สนใจงานนี้ ขอทราบเหตุผลสั้น ๆ ได้ไหมครับ เช่น ${DECLINE_REASON_CHOICES.join(' หรือ ')}`;

export type CallScriptFacts = {
  /** ชื่อผู้รับสาย — ว่างได้ (บทจะข้ามการเรียกชื่อ ไม่ใช่พูดคำว่า "คุณ" ลอย ๆ) */
  candidateName?: string;
  position: string;
  unit: string;
  /** สถานที่ทำงานจริง (ถ้าต่างจากชื่อหน่วยงาน) — ตัดความยาวมาแล้วจาก buildJobBrief */
  placeForTravel: string;
  /** เวลาทำงาน — ว่าง = ไม่ถาม (ห้ามถามลอย ๆ ว่า "เวลาทำงานสะดวกไหม" โดยไม่บอกเวลา) */
  workSchedule?: string;
  needsOwnVehicle?: boolean;
  /** วันเริ่มงานที่พูดออกเสียงได้แล้ว (`speakableDate`) — ว่าง = ถามแบบปลายเปิด */
  startDate?: string;
};

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** "คุณสมชาย " เมื่อมีชื่อ · "" เมื่อไม่มี — กันประโยคขึ้นต้นว่า "สวัสดีครับ คุณ ผมโทรจาก…" */
function polite(name?: string | null): string {
  const n = clean(name);
  return n ? `คุณ${n} ` : '';
}

/**
 * ต่อท้ายคำว่า "ตำแหน่ง" — เว้นวรรคให้เมื่อชื่อตำแหน่งขึ้นต้นด้วยอักษรอังกฤษ/ตัวเลข
 * ("ตำแหน่งCall Center" ติดกันคืออ่านยากทั้งกับคนและกับ TTS · ชื่อตำแหน่งจริงในฐาน
 * เป็นอังกฤษเยอะ: Call Center · Programmer · IT Support)
 */
function positionPhrase(position: string): string {
  return /^[A-Za-z0-9]/.test(position) ? `ตำแหน่ง ${position}` : `ตำแหน่ง${position}`;
}

/**
 * เบอร์โทรที่ "พูดออกเสียงแล้วเข้าใจ" — บทเรียนเดียวกับ `speakableDate`
 * (`2026-08-01` เคยถูกอ่านว่า "สองพันยี่สิบหกขีดศูนย์แปด…")
 * `0812345678` ติดกัน 10 หลักเสี่ยงถูกอ่านเป็นจำนวนเต็มก้อนเดียว → คั่นเป็นกลุ่ม
 * ⚠️ ใช้ **เว้นวรรค ไม่ใช่ขีด** — ขีดมีโอกาสถูกอ่านออกเสียงว่า "ลบ"
 */
export function speakablePhoneTh(phone: string): string {
  const s = clean(phone);
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  const local = digits.startsWith('66') && digits.length === 11 ? `0${digits.slice(2)}` : digits;
  if (local.length === 10) return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  if (local.length === 9) return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
  return s;
}

// ─── ท่อนที่ใช้ร่วมกันสองบท ───────────────────────────────────────────────────

/** คำถามเรื่องสถานที่ — ระบุที่จริงเสมอ ไม่ถามลอย ๆ ว่า "เดินทางสะดวกไหม" */
const travelQuestion = (f: CallScriptFacts) =>
  `งานนี้ทำที่ ${clean(f.placeForTravel) || clean(f.unit)} สะดวกเดินทางไปทำงานไหมครับ`;

/** เวลาทำงาน/รถ — ใส่เฉพาะเมื่อใบขอมีข้อมูล (ไม่มีข้อมูล = ไม่ถาม ดีกว่าถามเปล่า) */
function conditionQuestions(f: CallScriptFacts): string[] {
  const out: string[] = [];
  const schedule = clean(f.workSchedule);
  if (schedule) out.push(`เวลาทำงาน ${schedule} สะดวกไหมครับ`);
  if (f.needsOwnVehicle) out.push('งานนี้ต้องใช้รถของตัวเองในการทำงาน คุณมีรถพร้อมใช้ไหมครับ');
  return out;
}

/** วันเริ่มงาน — รู้วันที่ลูกค้าต้องการก็ถามตรง ๆ ว่าทันไหม ไม่รู้ก็ถามปลายเปิด */
function startDateQuestion(f: CallScriptFacts): string {
  const d = clean(f.startDate);
  return d
    ? `ทางหน่วยงานอยากให้เริ่มงานประมาณวันที่ ${d} สะดวกไหมครับ ถ้าไม่ทันเริ่มได้เร็วสุดวันไหนครับ`
    : 'ถ้าตกลงรับงานนี้ เริ่มงานได้เร็วที่สุดวันไหนครับ';
}

// ─── Part 1 · สัมภาษณ์เบื้องต้น (เลนสรรหา) ───────────────────────────────────

/**
 * คนกลุ่มนี้**ยังไม่ได้สมัครงานใบนี้** — เราไปหาเขาเอง บทจึงต้อง
 *   1. บอกว่าใครโทรมา (เดิมไม่บอก)
 *   2. ขออนุญาตใช้เวลา — ไม่ใช่ยิงคำถามใส่ทันที
 *   3. คัดกรองพอรู้ว่า "ไปต่อได้ไหม" แล้วจบ — ที่เหลือเป็นงานของเจ้าหน้าที่
 *   4. **ถามเหตุผลเมื่อไม่สนใจ** (ML ขั้น 1) และ **บอกขั้นถัดไป** ก่อนวางสาย
 * สูงสุด 9 ข้อ + ที่เติมตอนเสิร์ฟอีก 1 = 10 (เพดาน schema 15)
 */
export function buildScreeningQuestions(f: CallScriptFacts): string[] {
  const position = clean(f.position) || 'ที่เปิดรับ';
  const unit = clean(f.unit) || 'หน่วยงานของเรา';
  return [
    `สวัสดีครับ ${polite(f.candidateName)}ผมติดต่อจาก${CALLER_ORG}นะครับ ตอนนี้มีงาน${positionPhrase(position)} ที่ ${unit} อยากเรียนเสนอ ขอเวลาสัก 2-3 นาที สนใจฟังรายละเอียดไหมครับ`,
    travelQuestion(f),
    ...conditionQuestions(f),
    `เคยทำงาน${positionPhrase(position)} หรืองานใกล้เคียงมาก่อนไหมครับ`,
    startDateQuestion(f),
    'ค่าแรงหรือเงินเดือนที่คาดหวังประมาณเท่าไหร่ครับ',
    DECLINE_REASON_PROMPT,
    'ถ้าสนใจ เดี๋ยวเจ้าหน้าที่จะติดต่อกลับไปนัดหมายและขอเอกสารสมัครงานนะครับ ขอบคุณที่สละเวลาครับ',
  ];
}

// ─── Part 2 · เสนองานให้คนที่สมัครไว้แล้ว ────────────────────────────────────

export type OfferOptions = {
  /**
   * เคยปฏิเสธงานอื่นไปแล้ว (เส้นชวนกลับ) — ต้องถามก่อนว่ายังหางานอยู่ไหม
   * ไม่งั้นเสนอทับคนที่ได้งานไปแล้วซ้ำ ๆ
   */
  askStillLooking?: boolean;
};

/**
 * คนกลุ่มนี้**ติดต่อเรามาก่อนแล้ว** (ฝากใบสมัคร / อยู่บนบอร์ด) — ห้ามพูดเหมือนโทรหาคนแปลกหน้า
 * ต่างจาก Part 1 สองเรื่อง:
 *   - **ไม่ถามค่าแรงที่คาดหวัง** — เขาเห็นเงื่อนไขงานตอนสมัครแล้ว ถามซ้ำเหมือนจะต่อรองใหม่
 *   - **ปิดด้วยการนัด** ไม่ใช่ปิดด้วย "เดี๋ยวเจ้าหน้าที่ติดต่อกลับ" (เขาเลยขั้นนั้นมาแล้ว)
 * สูงสุด 8 ข้อ + ที่เติมตอนเสิร์ฟอีก 1 = 9
 */
export function buildOfferQuestions(f: CallScriptFacts, opts: OfferOptions = {}): string[] {
  const position = clean(f.position) || 'ที่เปิดรับ';
  const unit = clean(f.unit) || 'หน่วยงานของเรา';
  return [
    `สวัสดีครับ ${polite(f.candidateName)}ผมติดต่อจาก${CALLER_ORG}นะครับ คุณเคยฝากใบสมัครไว้กับเรา ตอนนี้มี${positionPhrase(position)} ที่ ${unit} ที่น่าจะตรงกับที่คุณสมัครไว้ สนใจรับงานนี้ไหมครับ`,
    ...(opts.askStillLooking ? ['ตอนนี้ยังหางานอยู่ไหมครับ'] : []),
    travelQuestion(f),
    ...conditionQuestions(f),
    startDateQuestion(f),
    DECLINE_REASON_PROMPT,
    'ถ้าตกลงรับงานนี้ เดี๋ยวเจ้าหน้าที่จะโทรกลับไปนัดวันสัมภาษณ์ สะดวกให้ติดต่อกลับช่วงไหนครับ',
  ];
}

/**
 * เวอร์ชันข้อความของ Part 2 สำหรับช่อง **reminder** (คนของเราบนบอร์ด)
 * ข้อเท็จจริงชุดเดียวกับ `buildOfferQuestions` — ต่างแค่รูปประโยค เพราะช่องนี้พูดยาวได้
 * (เจ้าของ: *"Format ก็ทำให้มันเท่ากัน"*)
 *
 * `detail` = ท่อนจาก `buildJobBrief` (สถานที่ · เวลาทำงาน · ต้องมีรถ · ช่วงอายุ)
 * 🔴 ไม่มีตัวเลขรายได้ที่นี่ — เติมตอนเสิร์ฟ (ดูหัวไฟล์)
 */
export function buildOfferMessage(
  f: CallScriptFacts & { requestNo?: string; detail?: string },
): string {
  const position = clean(f.position) || 'ที่เปิดรับ';
  const unit = clean(f.unit) || 'หน่วยงานของเรา';
  const start = clean(f.startDate) ? ` เริ่มงาน ${clean(f.startDate)}` : '';
  const ref = clean(f.requestNo) ? ` (ใบขอ ${clean(f.requestNo)})` : '';
  const detail = clean(f.detail) ? ` ${clean(f.detail)}` : '';
  return (
    `สวัสดีครับ ${polite(f.candidateName)}ติดต่อจาก${CALLER_ORG}นะครับ ` +
    `ระบบคัดเลือกพบว่าคุณเหมาะกับงาน${positionPhrase(position)} ที่ ${unit}${start}${ref}${detail} ` +
    'หากสนใจ ทีมสรรหาจะติดต่อกลับไปนัดหมายรายละเอียดต่อไปครับ'
  );
}

// ─── ท่อนที่เติมตอนเสิร์ฟคิว (รายได้ + สวัสดิการ — ต้องยิง ERP) ──────────────

/** ขึ้นต้นด้วยคำนี้เสมอ = marker กันเติมซ้ำตอน Lumos ดึงคิวรอบที่สอง */
export const EXTRA_INFO_PREFIX = 'แจ้งเพิ่มเติมครับ';

/**
 * ประโยค "ของแถม" ที่เติมตอนเสิร์ฟ — รวมรายได้กับสวัสดิการไว้ **ข้อเดียว**
 * (ช่อง interview นับเป็น 1 คำถาม · แยกสองข้อกินโควตาโดยไม่จำเป็น)
 *
 * 🔴 `monthlyIncome` ต้องมาจาก `monthlyGuaranteedIncome()` เท่านั้น = สูตรเดียวกับ
 * หน้าประกาศงานสาธารณะ (เงินเดือน + รายได้มั่นคง · ไม่รวมโอที/เบี้ยขยัน)
 * สองจอพูดคนละเลขคือเรื่องใหญ่กว่าจอไหนสวยกว่า
 * คิดไม่ได้ (ERP ล่ม / ไม่มีแถวค่าแรงหลัก) = **ไม่พูดเรื่องเงินเลย** ห้ามเดา
 */
export function buildExtraInfoSentence(input: {
  monthlyIncome?: number | null;
  benefitLine?: string;
}): string {
  const parts: string[] = [];
  const income = Number(input.monthlyIncome);
  if (Number.isFinite(income) && income > 0) {
    parts.push(`รายได้ประมาณ ${Math.round(income).toLocaleString('th-TH')} บาทต่อเดือน`);
  }
  const benefits = clean(input.benefitLine);
  if (benefits) parts.push(benefits);
  return parts.length > 0 ? `${EXTRA_INFO_PREFIX} งานนี้${parts.join(' และ')}` : '';
}

/**
 * ยัดประโยคของแถมเข้า payload ตามรูปของแต่ละช่อง (interview = คำถามเพิ่ม 1 ข้อ ·
 * reminder = ต่อท้ายข้อความทุก step)
 *
 * ⚠️ **idempotent** — Lumos เสิร์ฟซ้ำได้ถึง 5 รอบ (at-least-once) เติมซ้ำทุกรอบ
 * = AI พูดรายได้ห้ารอบในสายเดียว · กันด้วย marker `EXTRA_INFO_PREFIX`
 * ⚠️ interview เพดาน 15 ข้อตาม schema — เต็มแล้วไม่เติม (ส่ง payload ที่ schema
 * ไม่ผ่าน = Lumos ปัดทิ้งเงียบทั้งรายการ แย่กว่าขาดประโยคเสริม)
 */
export function appendExtraInfoToPayload(payload: unknown, sentence: string): void {
  if (!sentence || typeof payload !== 'object' || payload === null) return;
  const p = payload as { questions?: unknown; steps?: unknown };
  const hasMarker = (s: unknown) => typeof s === 'string' && s.includes(EXTRA_INFO_PREFIX);

  if (Array.isArray(p.questions)) {
    if (p.questions.length >= 15 || p.questions.some(hasMarker)) return;
    (p.questions as string[]).push(sentence);
    return;
  }
  if (Array.isArray(p.steps)) {
    for (const step of p.steps) {
      if (typeof step !== 'object' || step === null) continue;
      const s = step as { message?: unknown };
      if (typeof s.message !== 'string' || hasMarker(s.message)) continue;
      s.message = `${s.message} ${sentence}`;
    }
  }
}

// ─── Part 3 · Follow (ข้อความติดตามที่เจ้าหน้าที่ตั้งเอง) ────────────────────

export type FollowMessageInput = {
  recipientName?: string | null;
  /** หัวเรื่องที่เจ้าหน้าที่พิมพ์ (เช่น "นัดสัมภาษณ์วันจันทร์") */
  topic: string;
  /** โน้ตเพิ่มเติม — ซ้ำกับหัวเรื่องได้ ต้องกันพูดสองรอบ */
  note?: string | null;
  /** เบอร์เจ้าหน้าที่ให้โทรกลับ */
  staffPhone?: string | null;
};

/**
 * ของเดิมต่อสามท่อนด้วย `—` เฉย ๆ: `"นัดสัมภาษณ์ — พรุ่งนี้ 9 โมง — ติดต่อกลับได้ที่ 0812345678"`
 * ฟังทางโทรศัพท์แล้วเป็นคำพูดห้วน ๆ ไม่มีหัวไม่มีท้าย · ปรับ 4 อย่าง:
 *   1. **แนะนำตัว + เรียกชื่อผู้รับ** (เดิมไม่มีเลย ผู้รับไม่รู้ว่าใครโทรมา)
 *   2. **บอกให้ชัดว่าต้องทำอะไรต่อ** — "รบกวนยืนยันกลับ" (เดิมเป็นการแจ้งลอย ๆ)
 *   3. **เบอร์อ่านเป็นกลุ่มตัวเลข** (`speakablePhoneTh`)
 *   4. **กันพูดซ้ำ** เมื่อโน้ตเหมือนหัวเรื่อง
 */
export function buildFollowMessage(input: FollowMessageInput): string {
  const topic = clean(input.topic);
  const note = clean(input.note);
  const phone = speakablePhoneTh(clean(input.staffPhone));
  // โน้ตที่พิมพ์ซ้ำหัวเรื่อง (หรือคลุมหัวเรื่องอยู่แล้ว) — พูดรอบเดียวพอ
  const sameAsTopic = Boolean(note) && (note === topic || note.includes(topic) || topic.includes(note));
  const body = [topic, sameAsTopic ? '' : note].filter(Boolean).join(' ');
  return [
    `สวัสดีครับ ${polite(input.recipientName)}ติดต่อจาก${CALLER_ORG}นะครับ`,
    body ? `เรื่อง${body}` : '',
    'รบกวนยืนยันกลับด้วยนะครับ',
    phone ? `หากต้องการติดต่อเจ้าหน้าที่ โทร ${phone} ครับ` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * ═══ อ่าน "ผลโทรจริง" จากคำพูด — ใช้ได้กับ **ทุกสายที่ AI โทร** ═══
 *
 * > เจ้าของสั่ง 15 ก.ย. 2569: *"เอามา ๆ แต่ทำไว้สำหรับการโทรอันอื่น ๆ ในอนาคตด้วยนะ"*
 *
 * ───────────────────────────────────────────────────────────────────────────
 * 🔴 **ทำไมต้องอ่านคำพูด ทั้งที่ Lumos ส่ง `outcome` มาให้แล้ว**
 *
 * รหัสของเขาหยาบเกินกว่าจะตอบว่า "สำเร็จไหม" — วัดจริงเดือน ก.ย. 2569:
 * `acknowledged` 18 · `confirmed` 23 ⇒ แต่ในกอง `acknowledged` มีทั้ง
 *   · *"ใช่ครับ เตรียมตัวแล้ว"* · *"ถึงหน่วยงานแล้ว"* — สำเร็จ
 *   · *"ยังนอนอยู่"* · *"กำลังอาบน้ำ"* — ยังไม่ออกจากบ้าน
 *   · *"ยังไม่ได้ไป"* · *"จะลาออก"* — ไม่สำเร็จ
 * ⇒ ใครเอา `confirmed` ตัวเดียวไปหาร จะได้เลขต่ำปลอม (หน้าแรกเคยขึ้น ~55%
 *   ขณะที่ความจริง 97%) · ใครเหมา `acknowledged` เป็นสำเร็จ จะได้เลขสูงปลอม
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **โครงของไฟล์นี้ = เครื่องยนต์ 1 ตัว + คลังคำของแต่ละงาน (vocab)**
 *
 * เครื่องยนต์ไม่รู้จักคำว่า "ไปทำงาน" หรือ "สนใจงาน" เลย — มันรู้แค่ว่า
 * *ตอบรับเรื่องที่ถามไหม* · คำว่าอะไรคือรับ/ปฏิเสธ/ยังไม่พร้อม เป็นของ **งานนั้น ๆ**
 *
 * ⇒ เพิ่มงานโทรใหม่ในอนาคต (เช่น โทรถามความสนใจจากกล่องงาน · โทรนัดสัมภาษณ์ ·
 *   โทรทวงเอกสาร) ให้เพิ่ม **vocab ตัวใหม่** ไฟล์เดียว ไม่ต้องแตะตรรกะ
 *
 * ⚠️ **ข้อจำกัดที่ต้องบอกบนจอเสมอ ห้ามซ่อน** — นี่คือการอ่านคำ ไม่ใช่ค่าที่ Lumos ยืนยัน
 * ไม่ชัดต้องตกถัง `talked_unclear` เสมอ **ห้ามเดาเข้าข้างฝั่งไหน**
 */

/**
 * ถังผลกลาง — หนึ่งสายอยู่ได้ถังเดียว · รวมทุกถัง = สายที่มีผลกลับแล้ว
 *
 * ชื่อถังเป็นกลางโดยตั้งใจ (`said_yes` ไม่ใช่ `said_going`) เพราะคำว่า "ใช่"
 * ของแต่ละงานแปลไม่เหมือนกัน — งานติดตามแปลว่า *ไปทำงาน* · งานคัดกรองแปลว่า *สนใจงาน*
 */
export type CallMicroOutcome =
  /** ไม่มีใครรับสาย */
  | 'no_pickup'
  /** รับแล้ว แต่ไม่ใช่เจ้าตัว */
  | 'wrong_person'
  /** รับแล้วเงียบหรือวางไปเลย — ไม่ได้ตอบคำถาม */
  | 'picked_silent'
  /** คุยแล้ว **ตอบรับ** เรื่องที่ถาม */
  | 'said_yes'
  /** คุยแล้ว **ปฏิเสธ** */
  | 'said_no'
  /** คุยแล้ว ยังไม่พร้อม/ยังไม่ได้ทำ — ไม่ใช่ปฏิเสธ แต่ยังไม่สำเร็จ */
  | 'not_yet'
  /** คุยแล้ว แต่ไม่ได้ตอบเรื่องที่ถาม — **ต้องคนอ่านเอง** */
  | 'talked_unclear';

export const CALL_MICRO_KEYS: readonly CallMicroOutcome[] = [
  'no_pickup',
  'wrong_person',
  'picked_silent',
  'said_yes',
  'said_no',
  'not_yet',
  'talked_unclear',
];

/**
 * คลังคำของงานโทรหนึ่งชนิด
 *
 * 🔴 **ลำดับการตรวจถูกกำหนดโดยเครื่องยนต์ ไม่ใช่โดยคลังคำ**:
 * ฟังไม่ออก → ปฏิเสธ → ยังไม่พร้อม → ตอบรับ → ตอบรับคำถาม → ไม่ชัด
 * (ปฏิเสธมาก่อนตอบรับเสมอ เพราะ "ไม่ไป" มีคำว่า "ไป" อยู่ข้างใน)
 */
export type CallMicroVocab = {
  /** ชื่องาน — ใช้อ้างอิงเวลา debug เท่านั้น */
  key: string;
  /** คำที่แปลว่า **ปฏิเสธ/ไม่ได้ทำ** */
  no: readonly string[];
  /** คำที่แปลว่า **ตอบรับ/ทำแล้ว** */
  yes: readonly string[];
  /** คำที่แปลว่า **ยังไม่พร้อม** (ไม่ใช่ปฏิเสธ) */
  notYet: readonly string[];
  /** เรื่องที่ AI ถาม — ใช้คู่กับคำตอบรับสั้น ๆ */
  topic: readonly string[];
};

/**
 * คำตอบรับสั้น ๆ ที่สรุปของ Lumos ชอบใช้ — **กลาง ทุกงานใช้ร่วมกัน**
 *
 * ⚠️ **"ตอบรับสาย" ไม่นับ** — แปลว่ายกหูเท่านั้น (เคยหลุดจริง: *"ยืนยันชื่อและ
 * ตอบรับสาย แต่...ตอบกลับไม่ชัดเจน"* ถูกนับเป็นสำเร็จ)
 */
const AFFIRMATIVE_WORDS = [
  'ตอบว่าใช่',
  'ตอบรับสั้น',
  'ตอบรับคำถาม',
  'ตอบรับว่า',
  'ตอบว่า "',
  'ยืนยันว่า',
] as const;

/**
 * 🔴 คำที่ AI บอกเองว่าฟังไม่ออก — ตรวจก่อนทุกอย่าง **และอ่านจากสรุปฉบับเต็ม**
 * เพราะมันมักอยู่ติดท่อนคำถามที่ถูกตัดทิ้ง
 */
const UNCLEAR_WORDS = [
  'ไม่ชัดเจน',
  'ไม่ชัด',
  'ไม่ตรงคำถาม',
  'ฟังไม่ออก',
  'ไม่ได้ตอบ',
  'ไม่ตอบคำถาม',
] as const;

/** คำทักทายล้วน ๆ — มีแค่นี้แปลว่ายังไม่ได้ตอบอะไร */
const GREETING_ONLY =
  /^(ฮัลโหล|ฮาโหล|hello|hi|สวัสดี|ครับ|ค่ะ|คะ|จ้า|ว่าไง|อยู่|ใช่|yes|[\s.,!?·|-]|[0-9])*$/i;

/**
 * 🔴🔴 **ตัดท่อนที่เป็นคำถามของ AI ออกก่อนไล่หาคำ**
 *
 * สรุปของ Lumos เล่าคำถามติดมาด้วย: *"...ตอบสั้น ๆ ว่า 'ค่ะ'
 * **ต่อคำถามว่าเตรียมตัวไปทำงานหรือยัง**"* ⇒ ไม่ตัด = เจอคำว่า "เตรียมตัวไปทำงาน"
 * ที่เป็น**คำถาม** แล้วนับเป็นคำตอบของเขา (วัดจริง 11 ก.ย. 2569: ผิด 4 สายจาก 37)
 *
 * ⚠️ ตัดถึงจุดจบประโยคเท่านั้น — ตัดเกินจะกินคำตอบจริงที่ตามหลังมา
 * ⚠️ และเพราะตัดแล้ว **บริบทของคำถามหายไป** จึงต้องมีกติกา "ตอบรับ + เรื่องที่ถาม"
 * ที่อ่านจากสรุป**ฉบับเต็ม** มาช่วยอีกชั้น (ดู `classifyCallMicro`)
 */
const QUESTION_CLAUSES: readonly RegExp[] = [
  /เมื่อ(ผู้แจ้งเตือน)?ถาม[^.]*/g,
  /ต่อคำถาม[^.]*/g,
  /ระหว่างที่[^.]*/g,
  /หลัง(ได้รับ)?(การ)?แจ้งเตือน[^.]*/g,
  /เมื่อได้รับ(การ)?แจ้งเตือน[^.]*/g,
  /ตามที่แจ้งเตือน[^.]*/g,
];

export function stripQuestionClauses(text: string): string {
  let out = text;
  for (const re of QUESTION_CLAUSES) out = out.replace(re, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

const has = (haystack: string, words: readonly string[]): boolean =>
  words.some((w) => haystack.includes(w.toLowerCase()));

/** รหัสผลจาก Lumos ที่ตัดสินได้เลย ไม่ต้องอ่านคำพูด — เหมือนกันทุกงาน */
const DECIDED_BY_CODE: Record<string, CallMicroOutcome> = {
  confirmed: 'said_yes',
  declined: 'said_no',
  wrong_person: 'wrong_person',
  no_answer: 'no_pickup',
  busy: 'no_pickup',
  failed: 'no_pickup',
  reschedule_requested: 'said_no',
};

export type CallMicroInput = {
  /** รหัสผลจาก Lumos */
  outcome: string | null | undefined;
  /** คำที่ผู้รับสายพูดเอง (ต่อจาก transcript ฝั่ง candidate) */
  reply: string | null | undefined;
  /** สรุปของ AI — ภาษาไทยเรียบร้อยกว่าคำถอดเสียง จึงเชื่อก่อน */
  summary: string | null | undefined;
};

/**
 * จัดถังหนึ่งสาย — `null` = ยังไม่มีผล หรือถูกยกเลิก (**ห้ามเอาไปหาร**)
 *
 * ลำดับ (เปลี่ยนลำดับ = เปลี่ยนตัวเลข):
 *   1. ไม่มีผล/ยกเลิก ⇒ null
 *   2. รหัสที่ชัดอยู่แล้ว
 *   3. ที่เหลือ: ฟังไม่ออก → ปฏิเสธ → ยังไม่พร้อม → ตอบรับ → ตอบรับคำถาม → ไม่ชัด
 */
export function classifyCallMicro(
  input: CallMicroInput,
  vocab: CallMicroVocab,
): CallMicroOutcome | null {
  const code = (input.outcome ?? '').trim().toLowerCase();
  if (code === '' || code === 'cancelled') return null;

  const decided = DECIDED_BY_CODE[code];
  if (decided) return decided;

  const rawSummary = (input.summary ?? '').trim().toLowerCase();
  const summary = stripQuestionClauses(rawSummary);
  const reply = (input.reply ?? '').trim().toLowerCase();
  const text = `${summary} ${reply}`.trim();

  if (`${rawSummary} ${reply}`.trim() === '')
    return code === 'unresponsive' ? 'no_pickup' : 'picked_silent';

  // พูดแต่คำทักทาย/คำรับสั้น ๆ แล้วจบ ⇒ ยังไม่ได้ตอบคำถาม
  if (rawSummary === '' && GREETING_ONLY.test(reply.replace(/\s+/g, ' '))) return 'picked_silent';

  // AI บอกเองว่าฟังไม่ออก ⇒ จบตรงนี้ (อ่านฉบับเต็ม — คำนี้มักติดท่อนคำถาม)
  if (has(`${rawSummary} ${reply}`, UNCLEAR_WORDS)) return 'talked_unclear';
  if (has(text, vocab.no)) return 'said_no';
  // "ยังไม่ได้เตรียมตัว" ต้องมาก่อน "เตรียมตัว" ของฝั่งตอบรับ
  if (has(text, vocab.notYet)) return 'not_yet';
  if (has(text, vocab.yes)) return 'said_yes';
  // ตอบรับสั้น ๆ ต่อคำถามเรื่องนี้ = ตอบรับ (เรื่องที่ถามอยู่ในท่อนที่ถูกตัด ⇒ อ่านฉบับเต็ม)
  if (has(rawSummary, AFFIRMATIVE_WORDS) && has(rawSummary, vocab.topic)) return 'said_yes';
  return 'talked_unclear';
}

export type CallMicroSummary = Record<CallMicroOutcome, number> & {
  /** สายที่มีผลกลับแล้วทั้งหมด (ไม่รวมยกเลิก/ยังไม่มีผล) */
  withResult: number;
  /** มีคนรับ — ทุกถังยกเว้น `no_pickup` */
  pickedUp: number;
  /** ได้คุยเรื่องของเราจริง — ไม่รวมไม่รับ · ไม่ใช่เจ้าตัว · รับแล้วเงียบ */
  talked: number;
};

export function emptyCallMicroSummary(): CallMicroSummary {
  return {
    no_pickup: 0,
    wrong_person: 0,
    picked_silent: 0,
    said_yes: 0,
    said_no: 0,
    not_yet: 0,
    talked_unclear: 0,
    withResult: 0,
    pickedUp: 0,
    talked: 0,
  };
}

/** บวกหนึ่งสายเข้าไปในยอดรวม — แยกออกมาเพื่อให้ฝั่ง server รวมทีละแถวได้ */
export function addCallMicro(sum: CallMicroSummary, bucket: CallMicroOutcome | null): void {
  if (!bucket) return;
  sum[bucket] += 1;
  sum.withResult += 1;
  if (bucket !== 'no_pickup') sum.pickedUp += 1;
  if (bucket !== 'no_pickup' && bucket !== 'wrong_person' && bucket !== 'picked_silent')
    sum.talked += 1;
}

export function summarizeCallMicro(
  calls: readonly CallMicroInput[],
  vocab: CallMicroVocab,
): CallMicroSummary {
  const s = emptyCallMicroSummary();
  for (const c of calls) addCallMicro(s, classifyCallMicro(c, vocab));
  return s;
}

/**
 * ═══ สามอัตราที่เอาไปตัดสินใจได้จริง — **ฐานคนละตัว ต้องเขียนกำกับบนจอทุกตัว** ═══
 *
 * · `reachRate`   = มีคนรับ ÷ สายที่มีผลกลับ        — โทรถึงตัวได้แค่ไหน
 * · `talkRate`    = ได้คุยเรื่องของเรา ÷ สายที่มีผลกลับ — คุยรู้เรื่องแค่ไหน
 * · `successRate` = **ตอบรับ ÷ สายที่ได้คุย**        — Success Rate ของทั้งระบบ
 *
 * ⚠️ `not_yet` ไม่นับเป็นสำเร็จ แต่อยู่ในฐานหาร (เขาคุยกับเราแล้ว)
 * 🔴 เปลี่ยนนิยามต้องแก้ที่นี่ที่เดียว แล้วอัปเดตเทสต์ — ห้ามคิดเองซ้ำที่จออื่น
 */
export type CallMicroRates = {
  reachRate: number | null;
  talkRate: number | null;
  successRate: number | null;
};

export function callMicroRates(s: CallMicroSummary): CallMicroRates {
  const pct = (top: number, bottom: number): number | null =>
    bottom > 0 ? (top / bottom) * 100 : null;
  return {
    reachRate: pct(s.pickedUp, s.withResult),
    talkRate: pct(s.talked, s.withResult),
    successRate: pct(s.said_yes, s.talked),
  };
}

/* ══════════════════════ คลังคำของแต่ละงานโทร ══════════════════════ */

/**
 * **งานติดตามคนที่รับปากแล้ว** — คำถามคือ *"เตรียมตัวไปทำงานแล้วใช่ไหม"* /
 * *"ถึงหน่วยงานแล้วใช่ไหม"* ⇒ ตอบรับ = ไปทำงาน
 *
 * ชุดคำมาจากผลจริง 71 สาย (11-15 ก.ย. 2569) ไม่ได้นั่งคิดเอา
 */
export const FOLLOW_VOCAB: CallMicroVocab = {
  key: 'follow',
  no: [
    'ไม่ได้ไป',
    'ไม่ไป',
    'ยังไม่ได้ไป',
    'ไม่ทัน',
    'ยกเลิก',
    'ขอลา',
    'ลาป่วย',
    'ลาออก',
    'ไปหาหมอ',
    'ไม่สบาย',
    'ท้องเสีย',
    'ไม่ได้เดินทาง',
    'cancel',
    '안 가요',
  ],
  yes: [
    'เตรียมตัวแล้ว',
    'เตรียมตัวเรียบร้อย',
    'เตรียมตัวไปทำงาน',
    'เตรียมแล้ว',
    'เตรียมตัวพร้อม',
    'พร้อมแล้ว',
    'เรียบร้อยแล้ว',
    'กำลังเดินทาง',
    'เดินทางอยู่',
    'เดินทางแล้ว',
    'เดินทางถึง',
    'ออกเดินทาง',
    'ออกจากบ้านแล้ว',
    'กำลังขับรถ',
    'ขับรถอยู่',
    'ขับไปแล้ว',
    'รอรถ',
    'ถึงแล้ว',
    'ถึงหน่วยงาน',
    'ถึงที่ทำงาน',
    'ถึงโรงพยาบาล',
    'กำลังจะถึง',
    'มาแล้ว',
    'ขึ้นตึกทำงาน',
    'ทำงานเรียบร้อยแล้ว',
    'stand by',
    'on the way',
    'ไปแล้ว',
    'กำลังไป',
    'ไปทำ',
  ],
  notYet: [
    'อาบน้ำ',
    'แต่งตัว',
    'กินข้าว',
    'ทานข้าว',
    'เพิ่งตื่น',
    'ยังนอน',
    'ยังไม่ตื่น',
    'ยังไม่ได้เตรียม',
    'ยังไม่ได้ออก',
  ],
  topic: ['เตรียมตัว', 'ไปทำงาน', 'ถึงหน่วยงาน', 'เดินทาง', 'ไปที่หน่วยงาน'],
};

/**
 * **งานโทรถามความสนใจ** (ผู้สมัครจากกล่องงาน/หน้าสาธารณะ) — คำถามคือ
 * *"ยังสนใจงานนี้อยู่ไหม / สะดวกมาสัมภาษณ์ไหม"* ⇒ ตอบรับ = สนใจ
 *
 * ⚠️ **ยังไม่มีสายจริงให้วัด** (เลนนี้ยังไม่เคยถูกใช้ — ใบสมัคร 21 ใบ ไม่เคยถูกโทรเลย)
 * ชุดคำจึงมาจากสำนวนที่ใช้ซ้ำในเลนอื่น + คำที่คนพูดจริงตอนเจ้าหน้าที่โทรเอง
 * 🔴 **พอมีสายจริงแล้วต้องเอาผลมาวัดซ้ำและแก้ชุดคำ** เหมือนที่ทำกับเลนติดตาม
 */
export const INTEREST_VOCAB: CallMicroVocab = {
  key: 'interest',
  no: [
    'ไม่สนใจ',
    'ไม่ว่าง',
    'ไม่สะดวก',
    'ได้งานแล้ว',
    'ทำงานที่อื่น',
    'ไม่รับ',
    'ขอยกเลิก',
    'ไม่เอาแล้ว',
    'เปลี่ยนใจ',
  ],
  yes: [
    'สนใจ',
    'ยังสนใจ',
    'สะดวก',
    'ไปสัมภาษณ์',
    'มาสัมภาษณ์',
    'รับงาน',
    'ตกลง',
    'เอาครับ',
    'เอาค่ะ',
    'นัดได้',
  ],
  notYet: ['ขอคิดดูก่อน', 'ขอเวลา', 'ยังไม่แน่ใจ', 'ปรึกษาก่อน', 'ขอดูก่อน'],
  topic: ['สนใจ', 'สัมภาษณ์', 'ตำแหน่ง', 'งาน'],
};

/** เลือกคลังคำจาก `person_ref` ของแถวคิว — ที่เดียวที่แมปเลน → คลังคำ */
export function vocabForPersonRef(personRef: string | null | undefined): CallMicroVocab {
  const ref = (personRef ?? '').trim();
  if (ref.startsWith('follow-')) return FOLLOW_VOCAB;
  // app- (ใบสมัครหน้าสาธารณะ) · card- / ir- (คนที่แมตช์กับใบขอ) = โทรถามความสนใจ
  return INTEREST_VOCAB;
}

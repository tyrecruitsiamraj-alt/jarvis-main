/**
 * ตัวประกอบบทพูดของ AI — **ข้อความทั้งหมดอยู่ที่ `lumosCallScript.templates.ts`**
 * (เจ้าของเคาะ 16 ส.ค. 2569: *"ขอเป็นไฟล์ที่แก้ไขได้ที"* — แก้คำที่ไฟล์นั้นไฟล์เดียว
 * ไม่ต้องแตะไฟล์นี้)
 *
 * ไฟล์นี้มีแต่ "กฎการประกอบ":
 *   1. เติมค่าลงตัวแปร `{แบบนี้}`
 *   2. **ตัวแปรไหนไม่มีค่า = ทิ้งทั้งบรรทัด** — ใบขอที่ไม่ได้กรอกเวลาทำงานจะไม่ถูกถาม
 *      ว่า "เวลาทำงาน สะดวกไหม" (คำถามลอย ๆ ทำให้คนรับสายงงว่าเวลาไหน)
 *   3. คุมเพดานจำนวนคำถามตาม schema ของ Lumos
 *
 * บททั้ง 3 ชุด:
 *   1. **สัมภาษณ์เบื้องต้น** — เลนสรรหา · เราโทรไปหาเขา เขายังไม่ได้สมัครงานใบนี้
 *   2. **เสนองาน** — คนที่ติดต่อเรามาแล้ว (ฝากใบสมัคร/อยู่บนบอร์ด)
 *   3. **Follow** — ข้อความติดตามที่เจ้าหน้าที่ตั้งเอง
 *
 * ⚠️ **ช่อง interview ไม่มีที่ใส่ข้อความอิสระ** — ทุกอย่างที่ AI พูดต้องอยู่ใน `questions[]`
 * (schema รับ 1–15 ข้อ) ส่วนช่อง reminder พูดยาวได้ใน `steps[].message`
 *
 * 🔴 **ห้ามมีตัวเลขรายได้ในบท** — ตอนประกอบ payload ยังไม่รู้ "หน่วย" ของค่าแรง
 * (`total_income` = `payment_rate` ดิบ) วัดจากฐาน 16 ส.ค. 2569: แถวค่าแรงหลัก 16,264 แถว
 * เป็นรายเดือน 13,646 · **รายวัน 2,608** · รายชั่วโมง 5 → พูด "รายได้ 500 บาท" ให้คนที่
 * งานจ่าย 500 **ต่อวัน** = บอกเลขผิด 30 เท่า (บั๊กเดียวกับที่แก้ไปแล้วบนหน้าสาธารณะ)
 * ตัวเลขจึงถูกเติม **ตอนเสิร์ฟคิว** จาก ERP ด้วยสูตรเดียวกับหน้าสาธารณะ
 * (`monthlyGuaranteedIncome` — เงินเดือน + รายได้มั่นคง) ดู `takePendingLumosItems`
 *
 * ไฟล์นี้ pure ทั้งไฟล์ — ไม่แตะ DB/เวลาจริง · เทสต์ที่ `tests/api/lumosCallScript.test.ts`
 */
import { CALL_SCRIPT_TEMPLATES as T } from './lumosCallScript.templates.js';

/** ชื่อที่ AI ใช้แนะนำตัว — ค่าจริงอยู่ในไฟล์ template */
export const CALLER_ORG: string = T.ผู้โทร;

/**
 * ช้อยส์เหตุผล "ไม่สนใจ" (ML ขั้น 1 · เจ้าของสั่ง 16 ส.ค. 2569)
 * ⚠️ ต้องเป็นชุดเดียวกับฝั่ง**คนโทรเอง** (ข้อ 4) ไม่งั้นสองทางเก็บคนละหมวด รวมกันไม่ได้
 */
export const DECLINE_REASON_CHOICES: readonly string[] = T.เหตุผลที่ไม่สนใจ;

/** ขึ้นต้นด้วยคำนี้เสมอ = marker กันเติมซ้ำตอน Lumos ดึงคิวรอบที่สอง */
export const EXTRA_INFO_PREFIX: string = T.ของแถม.ขึ้นต้น;

/**
 * เพดานคำถามต่อบท — schema ของ Lumos รับ 1–15 ข้อ กันไว้ 1 ข้อให้ประโยครายได้
 * ที่เติมตอนเสิร์ฟ · เกินแล้วตัดท้ายทิ้ง (payload ที่ schema ไม่ผ่าน = Lumos ปัดทิ้ง
 * **ทั้งรายการ** เงียบ ๆ ซึ่งแย่กว่าคำถามหายไปข้อสองข้อ)
 */
export const MAX_QUESTIONS = 14;

// ─── บทฉบับแก้จากหน้าตั้งค่า (เจ้าของสั่ง 27 ส.ค. 2569) ─────────────────────
//
// เจ้าหน้าที่แก้บทได้จากหน้าตั้งค่า → เก็บใน pg (call_script_overrides) →
// `callScriptStore` โหลดมาวางไว้ที่นี่ก่อนประกอบ payload ทุกครั้ง
// ไฟล์นี้ยัง pure: ไม่แตะ DB เอง แค่อ่านค่าที่ถูก "วาง" ไว้ · ไม่มีฉบับแก้ = ใช้ T เดิม
// ⇒ เทสต์เดิมทั้งชุดผ่านโดยไม่ต้องรู้จักฟีเจอร์นี้ และลบแถวใน DB = กลับบทมาตรฐานทันที

/** คีย์บทที่แก้ได้จากหน้าตั้งค่า → array บทในไฟล์ template */
export type EditableScriptKey = 'interview' | 'offer' | 'follow' | 'follow_repeat';

export const EDITABLE_SCRIPT_DEFAULTS: Record<EditableScriptKey, readonly string[]> = {
  interview: T.สัมภาษณ์เบื้องต้น,
  offer: T.เสนองาน,
  follow: T.ติดตาม,
  follow_repeat: T.ติดตามรอบถัดไป,
};

let scriptOverrides: Partial<Record<EditableScriptKey, readonly string[]>> = {};

/** วางฉบับแก้ (callScriptStore เรียก) — ส่ง `{}` = ล้างทั้งหมดกลับบทมาตรฐาน */
export function setCallScriptOverrides(
  next: Partial<Record<EditableScriptKey, readonly string[]>>,
): void {
  scriptOverrides = next;
}

/** บทที่ใช้จริงตอนนี้ — ฉบับแก้ก่อน ไม่มีค่อยถอยไปบทในไฟล์ */
export function activeScriptLines(key: EditableScriptKey): readonly string[] {
  const o = scriptOverrides[key];
  return o && o.length > 0 ? o : EDITABLE_SCRIPT_DEFAULTS[key];
}

/** ใช้บทมาตรฐานอยู่ หรือฉบับที่แอดมินแก้ */
export function activeScriptSource(key: EditableScriptKey): 'default' | 'custom' {
  const o = scriptOverrides[key];
  return o && o.length > 0 ? 'custom' : 'default';
}

/**
 * ลายนิ้วมือสั้นของบทที่ใช้อยู่ตอนนี้ — บทถูกแก้เมื่อไหร่ค่านี้เปลี่ยน
 *
 * ใช้จดลงคิวว่า "สายนี้ AI พูดบทเวอร์ชันไหน" เพื่อย้อนตรวจได้ว่าผลสายช่วงหนึ่งแย่ลง
 * เพราะบทเปลี่ยนหรือเปล่า · **ไม่ได้ใช้เรื่องความปลอดภัย** จึงไม่ต้องเป็น hash เข้ารหัส
 * (djb2 พอ — สั้น อ่านง่ายในล็อก และไม่ต้องพึ่ง crypto ให้ไฟล์นี้เลิก pure)
 */
export function activeScriptFingerprint(key: EditableScriptKey): string {
  const text = activeScriptLines(key).join('\n');
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return `${key}-${h.toString(36)}`;
}

// ─── ตัวเติมค่าลงบท ───────────────────────────────────────────────────────────

/**
 * `undefined`/`null` = **ไม่มีข้อมูล → ทิ้งทั้งบรรทัด**
 * `''` = มีแต่ไม่ต้องพิมพ์อะไร → **เก็บบรรทัดไว้** (ใช้กับตัวแปรธงอย่าง `{ต้องมีรถ}`
 * และกับ `{ชื่อผู้รับ}` ตอนไม่รู้ชื่อ)
 */
export type ScriptValues = Record<string, string | null | undefined>;

/**
 * ตัวแปรทั้งหมดที่ไฟล์ template ใช้ได้
 *
 * 🔴 **มีไว้กันพิมพ์ผิด** — ถ้าใครพิมพ์ `{ตำแน่ง}` ตกตัวอักษร ระบบจะถือว่า "ไม่มีค่า"
 * แล้ว**ทิ้งคำถามข้อนั้นทั้งข้อเงียบ ๆ** ไม่มี error ไม่มี log · เทสต์
 * `tests/api/lumosCallScript.test.ts` สแกนไฟล์ template เทียบกับลิสต์นี้ทุกครั้ง
 * เพิ่มตัวแปรใหม่ต้องมาเพิ่มที่นี่ด้วย
 */
export const KNOWN_PLACEHOLDERS: readonly string[] = [
  'ผู้โทร',
  'ชื่อผู้รับ',
  'ตำแหน่ง',
  'หน่วยงาน',
  'สถานที่ทำงาน',
  'เวลาทำงาน',
  'วันเริ่มงาน',
  'ช้อยส์เหตุผล',
  'เลขที่ใบขอ',
  'รายละเอียดงาน',
  'รายได้ต่อเดือน',
  'สวัสดิการ',
  'เรื่อง',
  'เบอร์เจ้าหน้าที่',
  /** ชื่อเจ้าหน้าที่ผู้ติดตาม — ใช้แนะนำตัวต้นสาย (เจ้าของสั่ง 1 ก.ย. 2569) */
  'ชื่อเจ้าหน้าที่',
  // ตัวแปรธง — ไม่พิมพ์อะไรออกมา แค่บอกว่าบรรทัดนี้ใช้กับใบแบบไหน
  'ต้องมีรถ',
  'ไม่มีวันเริ่มงาน',
  'เคยปฏิเสธงานอื่น',
];

const PLACEHOLDER = /\{([^{}]+)\}/g;

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** ค่าที่ว่างจริง ๆ ให้กลายเป็น undefined (= ทิ้งบรรทัด) ไม่ใช่ช่องว่างค้างในประโยค */
const orDrop = (v: unknown): string | undefined => clean(v) || undefined;

/** ธง: true = เก็บบรรทัด · false = ทิ้งบรรทัด */
const flag = (on: boolean | undefined): string | undefined => (on ? '' : undefined);

/** คืน null เมื่อบรรทัดนี้ใช้ไม่ได้กับใบขอนี้ (มีตัวแปรที่ไม่มีค่า) */
export function renderLine(template: string, values: ScriptValues): string | null {
  let dropped = false;
  const out = template.replace(PLACEHOLDER, (_m, name: string) => {
    const v = values[name];
    if (v === undefined || v === null) {
      dropped = true;
      return '';
    }
    return v;
  });
  if (dropped) return null;
  // ตัวแปรที่แทนด้วยค่าว่างทิ้งช่องว่างซ้อนไว้ — เก็บกวาดก่อนส่งให้ AI อ่าน
  const tidy = out.replace(/\s{2,}/g, ' ').trim();
  return tidy || null;
}

/** ประกอบทั้งบท · ตัดบรรทัดที่ใช้ไม่ได้ทิ้ง แล้วคุมเพดานจำนวนข้อ */
export function renderLines(
  templates: readonly string[],
  values: ScriptValues,
  max = MAX_QUESTIONS,
): string[] {
  const lines: string[] = [];
  for (const t of templates) {
    const line = renderLine(t, values);
    if (line) lines.push(line);
  }
  // ลบคำถามหมดทุกข้อในไฟล์ template = สายเงียบ · ถอยไปใช้คำถามสำรอง
  if (lines.length === 0) {
    const fallback = renderLine(T.คำถามสำรอง, values);
    return fallback ? [fallback] : [];
  }
  return lines.slice(0, max);
}

// ─── ค่าที่ใช้ร่วมกันทุกบท ────────────────────────────────────────────────────

export type CallScriptFacts = {
  /** ชื่อผู้รับสาย — ว่างได้ (บทจะข้ามการเรียกชื่อ ไม่ใช่พูดคำว่า "คุณ" ลอย ๆ) */
  candidateName?: string | null;
  position: string;
  unit: string;
  /** สถานที่ทำงานจริง (ถ้าต่างจากชื่อหน่วยงาน) — ตัดความยาวมาแล้วจาก buildJobBrief */
  placeForTravel?: string | null;
  /** เวลาทำงาน — ว่าง = บรรทัดที่ถามเรื่องเวลาหายไปเอง */
  workSchedule?: string | null;
  needsOwnVehicle?: boolean;
  /** วันเริ่มงานที่พูดออกเสียงได้แล้ว (`speakableDate`) — ว่าง = ใช้บรรทัดถามปลายเปิดแทน */
  startDate?: string | null;
};

/**
 * คำนำหน้าไทยที่ต้องตัดก่อนเติม "คุณ" — เรียงยาว→สั้น ("นางสาว" ต้องชนะ "นาง")
 *
 * 🔴 เจ้าของสั่ง 1 ก.ย. 2569: *"คุณ...(ชื่อพนักงาน)... **ตัดนาย/นางสาวออก**"*
 * ของเดิมเติม "คุณ" หน้าชื่อดิบ ⇒ AI พูดว่า **"คุณนายสุรเดช"** (ซ้อนคำนำหน้า)
 * ⚠️ ชื่อในฐานมาจากหลายทาง (ERP · บอร์ด · คนพิมพ์เอง) จึงตัดที่นี่ที่เดียวตอนประกอบบท
 * ไม่ไปไล่แก้ข้อมูลต้นทาง
 */
const THAI_NAME_PREFIXES = [
  'นางสาว',
  'น.ส.',
  'นาง',
  'นาย',
  'ด.ช.',
  'ด.ญ.',
  'เด็กชาย',
  'เด็กหญิง',
] as const;

/** ตัดคำนำหน้าไทยออกจากชื่อ — ไม่มีคำนำหน้าก็คืนชื่อเดิม */
export function stripThaiNamePrefix(name?: string | null): string {
  let n = clean(name);
  for (const pre of THAI_NAME_PREFIXES) {
    if (n.startsWith(pre)) {
      n = n.slice(pre.length).trim();
      break;
    }
  }
  return n;
}

/** "คุณสมชาย " เมื่อมีชื่อ · "" เมื่อไม่มี — กันประโยคขึ้นต้นว่า "สวัสดีครับ คุณ ผมโทรจาก…" */
function polite(name?: string | null): string {
  const n = stripThaiNamePrefix(name);
  return n ? `คุณ${n} ` : '';
}

/**
 * `{ตำแหน่ง}` = คำว่า "ตำแหน่ง" + ชื่อตำแหน่ง — เว้นวรรคให้เมื่อขึ้นต้นด้วยอักษรอังกฤษ
 * ("ตำแหน่งCall Center" ติดกันคืออ่านยากทั้งกับคนและกับ TTS · ชื่อตำแหน่งจริงในฐาน
 * เป็นอังกฤษเยอะ: Call Center · Programmer · IT Support)
 */
function positionPhrase(position: string): string {
  return /^[A-Za-z0-9]/.test(position) ? `ตำแหน่ง ${position}` : `ตำแหน่ง${position}`;
}

function jobValues(f: CallScriptFacts): ScriptValues {
  const position = clean(f.position) || 'ที่เปิดรับ';
  const unit = clean(f.unit) || 'หน่วยงานของเรา';
  const startDate = orDrop(f.startDate);
  return {
    ผู้โทร: CALLER_ORG,
    ชื่อผู้รับ: polite(f.candidateName),
    ตำแหน่ง: positionPhrase(position),
    หน่วยงาน: unit,
    สถานที่ทำงาน: clean(f.placeForTravel) || unit,
    เวลาทำงาน: orDrop(f.workSchedule),
    วันเริ่มงาน: startDate,
    ไม่มีวันเริ่มงาน: flag(!startDate),
    ต้องมีรถ: flag(f.needsOwnVehicle),
    ช้อยส์เหตุผล: DECLINE_REASON_CHOICES.join(' หรือ '),
  };
}

// ─── บทที่ 1 · สัมภาษณ์เบื้องต้น (เลนสรรหา) ──────────────────────────────────

/**
 * คนกลุ่มนี้**ยังไม่ได้สมัครงานใบนี้** — เราไปหาเขาเอง บทจึงต้องแนะนำตัว ขอเวลา
 * คัดกรองพอรู้ว่าไปต่อได้ไหม **ถามเหตุผลเมื่อไม่สนใจ** (ML ขั้น 1) แล้วบอกขั้นถัดไป
 */
export function buildScreeningQuestions(f: CallScriptFacts): string[] {
  return renderLines(activeScriptLines('interview'), jobValues(f));
}

// ─── บทที่ 2 · เสนองานให้คนที่สมัครไว้แล้ว ───────────────────────────────────

export type OfferOptions = {
  /**
   * เคยปฏิเสธงานอื่นไปแล้ว (เส้นชวนกลับ) — เปิดบรรทัด "ตอนนี้ยังหางานอยู่ไหม"
   * ไม่งั้นเสนอทับคนที่ได้งานไปแล้วซ้ำ ๆ
   */
  askStillLooking?: boolean;
};

/**
 * คนกลุ่มนี้**ติดต่อเรามาก่อนแล้ว** (ฝากใบสมัคร / อยู่บนบอร์ด) — ห้ามพูดเหมือนโทรหาคนแปลกหน้า
 * ต่างจากบทที่ 1 สองเรื่อง: **ไม่ถามค่าแรงที่คาดหวัง/ประสบการณ์ซ้ำ** (เขาเห็นเงื่อนไข
 * ตอนสมัครแล้วและเรามีโปรไฟล์อยู่) · **ปิดด้วยการนัด** ไม่ใช่ "เดี๋ยวเจ้าหน้าที่ติดต่อกลับ"
 */
export function buildOfferQuestions(f: CallScriptFacts, opts: OfferOptions = {}): string[] {
  return renderLines(activeScriptLines('offer'), {
    ...jobValues(f),
    เคยปฏิเสธงานอื่น: flag(opts.askStillLooking),
  });
}

/**
 * เวอร์ชันข้อความของบทที่ 2 สำหรับช่อง **reminder** (คนของเราบนบอร์ด)
 * ข้อเท็จจริงชุดเดียวกับ `buildOfferQuestions` — ต่างแค่รูปประโยค เพราะช่องนี้พูดยาวได้
 * (เจ้าของ: *"Format ก็ทำให้มันเท่ากัน"*)
 */
export function buildOfferMessage(
  f: CallScriptFacts & { requestNo?: string | null; detail?: string | null },
): string {
  return renderLines(
    T.แจ้งงาน,
    {
      ...jobValues(f),
      เลขที่ใบขอ: orDrop(f.requestNo),
      รายละเอียดงาน: orDrop(f.detail),
    },
    T.แจ้งงาน.length,
  ).join(' ');
}

// ─── ท่อนที่เติมตอนเสิร์ฟคิว (รายได้ + สวัสดิการ — ต้องยิง ERP) ──────────────

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
  benefitLine?: string | null;
}): string {
  const parts: string[] = [];
  const income = Number(input.monthlyIncome);
  if (Number.isFinite(income) && income > 0) {
    const line = renderLine(T.ของแถม.รายได้, {
      รายได้ต่อเดือน: Math.round(income).toLocaleString('th-TH'),
    });
    if (line) parts.push(line);
  }
  const benefits = renderLine(T.ของแถม.สวัสดิการ, { สวัสดิการ: orDrop(input.benefitLine) });
  if (benefits) parts.push(benefits);
  return parts.length > 0 ? `${T.ของแถม.ขึ้นต้น}${parts.join(T.ของแถม.ตัวเชื่อม)}` : '';
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

// ─── บทที่ 3 · Follow (ข้อความติดตามที่เจ้าหน้าที่ตั้งเอง) ───────────────────

export type FollowMessageInput = {
  recipientName?: string | null;
  /** หัวเรื่องที่เจ้าหน้าที่พิมพ์ (เช่น "นัดสัมภาษณ์วันจันทร์") */
  topic: string;
  /** โน้ตเพิ่มเติม — ซ้ำกับหัวเรื่องได้ ต้องกันพูดสองรอบ */
  note?: string | null;
  /** เบอร์เจ้าหน้าที่ให้โทรกลับ */
  staffPhone?: string | null;
  /**
   * ชื่อเจ้าหน้าที่ผู้ติดตาม — ใช้แนะนำตัวต้นสาย (เจ้าของสั่ง 1 ก.ย. 2569:
   * *"สวัสดีค่ะ ...(ชื่อเจ้าของงาน)... จากสยามราชธานีนะคะ"*)
   * ⚠️ ไม่มีชื่อ = ส่งค่าว่าง **ไม่ใช่ undefined** — บรรทัดทักทายต้องยังอยู่ (แค่ไม่มีชื่อ)
   */
  staffName?: string | null;
  /** หน่วยงานที่ไปทำงาน — บทถามว่า "ไปหน่วยงาน...แล้วใช่ไหม" */
  unitName?: string | null;
};

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

/**
 * ของเดิมต่อสามท่อนด้วย `—` เฉย ๆ: `"นัดสัมภาษณ์ — พรุ่งนี้ 9 โมง — ติดต่อกลับได้ที่ 0812345678"`
 * ฟังทางโทรศัพท์แล้วเป็นคำพูดห้วน ๆ ไม่มีหัวไม่มีท้าย · บทใหม่แนะนำตัว เรียกชื่อ
 * บอกให้ยืนยันกลับ และอ่านเบอร์เป็นกลุ่มตัวเลข
 */
export function buildFollowMessage(
  input: FollowMessageInput,
  /**
   * `'first'` = สายแรกของงานติดตามนี้ · `'repeat'` = รอบที่สองเป็นต้นไป
   * (เจ้าของสั่ง 31 ส.ค. 2569: *"โทรรอบแรกกับรอบที่ 2 มันไม่เหมือนกัน"*)
   * ไม่ส่ง = รอบแรก — ของเดิมที่เรียกอยู่จึงไม่ต้องแก้
   */
  round: 'first' | 'repeat' = 'first',
): string {
  const topic = clean(input.topic);
  const note = clean(input.note);
  // โน้ตที่พิมพ์ซ้ำหัวเรื่อง (หรือคลุมหัวเรื่องอยู่แล้ว) — พูดรอบเดียวพอ
  const sameAsTopic = Boolean(note) && (note === topic || note.includes(topic) || topic.includes(note));
  const lines = activeScriptLines(round === 'repeat' ? 'follow_repeat' : 'follow');
  return renderLines(
    lines,
    {
      ผู้โทร: CALLER_ORG,
      ชื่อผู้รับ: polite(input.recipientName),
      เรื่อง: orDrop([topic, sameAsTopic ? '' : note].filter(Boolean).join(' ')),
      เบอร์เจ้าหน้าที่: orDrop(speakablePhoneTh(clean(input.staffPhone))),
      /* 🔴 สองตัวนี้ส่งค่าว่างเมื่อไม่มีข้อมูล **ห้ามใช้ orDrop** — ไม่งั้นบรรทัดทักทาย
         กับบรรทัดคำถามหลักจะหายไปทั้งบรรทัด เหลือสายที่ไม่ได้ถามอะไรเลย */
      ชื่อเจ้าหน้าที่: stripThaiNamePrefix(input.staffName),
      หน่วยงาน: clean(input.unitName),
    },
    lines.length,
  ).join(' ');
}

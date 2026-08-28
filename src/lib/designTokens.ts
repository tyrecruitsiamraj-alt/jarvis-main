/**
 * โทนสีกลางของระบบ (token กลาง) — "ความหมายหนึ่งอย่าง = สีหนึ่งสี" ทั้งแอป
 *
 * ก่อนมีไฟล์นี้ ความหมายของสีถูกเขียนซ้ำอยู่ 6 ที่ (funnel หน้าแรก · KPI dashboard ·
 * ถังอายุ · SLA · การ์ดกระทบยอด · ป้ายสถานะ) แต่ละที่คลาดกันเอง เช่น "ยกเลิก" เป็นเทาที่ KPI
 * แต่เป็นชมพูที่การ์ดกระทบยอด และ "เข้ามา" เป็นฟ้าที่ KPI แต่เป็นครามในกราฟ
 * ต่อไปแก้ความหมายสีที่ไฟล์นี้ที่เดียว
 *
 * ความหมายที่ล็อกไว้ (ตรงกับ references/05-ui-design-rules.md):
 *   neutral (เทา)   — กลาง · ยกเลิก · ใบขอที่เพิ่งเปิด · งานค้างเก่าที่หาได้
 *   info (ฟ้า)      — ขอมา/เข้ามา · AI แนะนำ · งานที่ยังรอได้
 *   primary (น้ำเงิน) — กำลังดำเนินการ · ส่ง AI โทร · ปิดครบใบขอของงวดนี้
 *   success (เขียว)  — หาได้แล้ว · สนใจงาน · ทันกำหนด
 *   warn (เหลือง)    — เหลือหา · ยอดค้างทั้งต้นงวด/ปลายงวด · เสี่ยงเกินกำหนด · รอคนทำต่อ
 *   danger (แดง)     — เกิน SLA · ติดขัด · ด่วนมาก (ต้องลงมือวันนี้)
 *   violet (ม่วง)    — จองตัว/ลงงาน · ภาระงานรวม · ของค้างเก่าที่ปิดได้
 *   orange (ส้ม)     — ส่งทีมคอนเทนต์ · ปิดช้ากว่ากำหนด
 *   teal (เขียวน้ำทะเล) — ส่ง Scraping
 *
 * กติกาเวลาเพิ่มค่า:
 * 1. ทุก variant ที่กำหนดสีพื้น/สีตัวหนังสือของธีมสว่าง ต้องมีคู่ `dark:` (ยกเว้น dot/solid
 *    ที่ใช้สีอิ่มตัวเดียวกันทั้งสองธีม) — มีเทสต์บังคับที่ tests/api/designTokens.test.ts
 * 2. `chip` ชี้ไปที่ class ใน src/index.css ไม่ประกาศสีซ้ำ — chip ถูกใช้ตรง ๆ ทั่วแอปอยู่แล้ว
 * 3. `solid` (บล็อกสีอิ่ม) ใช้กับตัวเลขที่ "ต้องลงมือวันนี้" เท่านั้น ใส่เกิน 1-2 ที่ต่อหน้า
 *    แล้วจะไม่เหลือของที่เด่นจริง
 */

export type ToneKey =
  | 'neutral'
  | 'info'
  | 'primary'
  | 'success'
  | 'warn'
  | 'danger'
  | 'violet'
  | 'orange'
  | 'teal';

export type ToneClasses = {
  /**
   * แถบสี 3px บนหัวการ์ด — ใช้กับ funnel หน้าแรก (คู่กับ `!border-t-[3px]`)
   * ใส่ `!` ทั้งสองธีมเพราะ `.jarvis-stat-tile` กำหนด `border-color` ครบ 4 ด้าน specificity เท่ากัน
   * ตอนนี้ utility ชนะเพราะถูก emit ทีหลังในสไตล์ชีต — ถ้าลำดับเปลี่ยนสีขอบบนจะกลายเป็นขาวแบบเงียบ ๆ
   * (เคสเดียวกับที่รอบ 3e0bfd2 ต้องใส่ `!` ให้ความหนา) จึงล็อกด้วย `!` ไม่ให้ขึ้นกับลำดับ
   */
  bar: string;
  /** พื้นพาสเทลของกล่องตัวเลข + hover */
  tile: string;
  /** ตัวเลขบนพื้นพาสเทล (เข้มกว่าปกติเพื่อให้อ่านออกบนพื้นสี) */
  num: string;
  /** ตัวเลข/ตัวหนังสือบนพื้นขาวหรือ glass */
  value: string;
  /** เส้นขอบ + พื้นจาง ของกล่องย่อย/แถวรายการ */
  soft: string;
  /** hover ของกล่อง soft ที่กดได้ — ใส่คู่กับ soft เท่านั้น */
  softHover: string;
  /**
   * ปุ่ม/ลิงก์แบบเส้นขอบบนพื้นขาว (ธีมสว่าง) — เส้นขอบ + ตัวหนังสือสีโทน + hover จาง
   *
   * มีไว้เพราะเวลาเขียนมือมักลืมคู่มืดของ `bg-white` → ปุ่มเป็นสี่เหลี่ยมขาวโพลน
   * บนพื้นเข้มในโหมดมืด (เจอมาแล้วที่ปุ่มแบ่งหน้าของ MatchingPage)
   * ต่างจาก `soft` ตรงที่ soft เป็นกล่องพื้นพาสเทล ส่วน outline พื้นขาว/เข้มตามธีม
   */
  outline: string;
  /** บล็อกสีอิ่ม ตัวหนังสือขาว — เฉพาะตัวเลขที่ต้องลงมือวันนี้ */
  solid: string;
  /** จุดสีเล็กหน้าป้าย */
  dot: string;
  /**
   * ตัวเลข/ตัวหนังสือบน "พื้นเข้ม" (hero, การ์ดดำ) — สีเดียวทั้งสองธีมเพราะพื้นเข้มตลอด
   * โทนอ่อนกว่า `value` เพื่อให้อ่านออกบนพื้นน้ำเงินหมึก
   */
  onDark: string;
  /** ชิป — class กลางใน src/index.css (แหล่งเดียวกับที่หน้าอื่นเรียกใช้) */
  chip: string;
  /** ค่าสีจริงสำหรับ recharts (รับ class ไม่ได้ ต้องเป็น hex) */
  hex: string;
};

/**
 * จานสีของทั้งระบบ — **แบบ B "กรมท่า + ทองเก่า"** (เจ้าของเลือก 10 ส.ค. 2569)
 *
 * ก่อนหน้านี้เจ้าของติงว่า "ไม่มีความ luxury เลย สีแจ๋นแหลนมาก" — ต้นเหตุไม่ใช่ตัวสี
 * แต่เป็น **การเอาสีอิ่มตัวไปทำพื้น** ทุกการ์ดจึงมีพื้นสีของตัวเองแล้วแข่งกันหมด
 * ตาไม่รู้จะไปหยุดตรงไหน
 *
 * หลักที่ใช้ตอนนี้ — "หมึกกับกระดาษ":
 * 1. **พื้นเป็นกลางเสมอ** (`tile` / `soft` ใช้ตระกูล slate ทุกโทน) — กระดาษไม่มีสี
 * 2. **สีอยู่ที่หมึก** — ขีดบนการ์ด (`bar`) · ตัวเลข (`num`/`value`) · จุด (`dot`) · เส้นขอบ
 * 3. **เข้มขึ้นหนึ่งขั้น** จากเดิม (600→700, 400→600) — สีเข้มอ่านเป็น "สุขุม" สีสดอ่านเป็น "ตะโกน"
 * 4. `primary` = **กรมท่า** (blue-800/900) เป็นสีหลักของแบรนด์ในหน้าจอ
 *    `warn` = **ทองด้าน** (amber-700/800) เป็นสีเน้นจุดเดียวที่อุ่น
 * 5. **เก็บ violet/teal/orange ไว้ครบ** ไม่ยุบรวมกับ warn — สามสีนี้เป็นภาษาที่ทีมใช้แยกงานจริง
 *    (Scraping vs Content · In process vs To do · ต้องคนตาม) ยุบแล้วข้อมูลหาย
 *    แต่หรี่ลงให้ไม่แย่งสายตากับสถานะหลัก
 *
 * ⚠️ `outline` ต้องมี `bg-white` ในธีมสว่างเสมอ (มีเทสต์บังคับ) — เป็นปุ่มพื้นขาว ไม่ใช่กล่องพาสเทล
 * ⚠️ `dot` / `solid` ใช้สีเดียวทั้งสองธีมโดยตั้งใจ — เป็นสีอิ่มบนพื้นที่เล็กมาก
 */
export const TONE: Record<ToneKey, ToneClasses> = {
  neutral: {
    bar: '!border-t-slate-400 dark:!border-t-slate-500',
    tile: 'bg-slate-100/80 hover:bg-slate-200/60 dark:bg-slate-800/70 dark:hover:bg-slate-800',
    num: 'text-slate-800 dark:text-slate-200',
    value: 'text-slate-700 dark:text-slate-300',
    soft: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50',
    softHover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    outline: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-950/50',
    solid: 'bg-slate-700 text-white hover:bg-slate-600',
    dot: 'bg-slate-400',
    onDark: 'text-slate-300',
    chip: 'jarvis-chip jarvis-chip-neutral',
    hex: '#64748b',
  },
  info: {
    bar: '!border-t-sky-600 dark:!border-t-sky-500',
    tile: 'bg-slate-100/70 hover:bg-slate-200/60 dark:bg-slate-800/60 dark:hover:bg-slate-800',
    num: 'text-sky-800 dark:text-sky-200',
    value: 'text-sky-800 dark:text-sky-300',
    soft: 'border-sky-300/70 bg-slate-50 dark:border-sky-800/70 dark:bg-slate-800/50',
    softHover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    outline: 'border-sky-300 bg-white text-sky-800 hover:bg-slate-50 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-950/50',
    solid: 'bg-sky-700 text-white hover:bg-sky-600',
    dot: 'bg-sky-600',
    onDark: 'text-sky-300',
    chip: 'jarvis-chip jarvis-chip-info',
    hex: '#0369a1',
  },
  primary: {
    // กรมท่า — สีหลักของหน้าจอตามแบบ B
    bar: '!border-t-blue-800 dark:!border-t-blue-500',
    tile: 'bg-slate-100/70 hover:bg-slate-200/60 dark:bg-slate-800/60 dark:hover:bg-slate-800',
    num: 'text-blue-900 dark:text-blue-200',
    value: 'text-blue-800 dark:text-blue-300',
    soft: 'border-blue-300/70 bg-slate-50 dark:border-blue-800/70 dark:bg-slate-800/50',
    softHover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    outline: 'border-blue-300 bg-white text-blue-800 hover:bg-slate-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-950/50',
    solid: 'bg-blue-800 text-white hover:bg-blue-700',
    dot: 'bg-blue-800',
    onDark: 'text-blue-300',
    chip: 'jarvis-chip jarvis-chip-primary',
    hex: '#1e40af',
  },
  success: {
    // ⚠️ ต้องอยู่คนละตระกูลกับโทน `teal` — เทสต์บังคับว่า hex ของทุกโทนห้ามซ้ำ
    // (ซ้ำเมื่อไหร่ = สองเส้นบนกราฟกลายเป็นสีเดียว แยกไม่ออก) · จับได้ตอนเปลี่ยนจานสีรอบนี้
    bar: '!border-t-emerald-700 dark:!border-t-emerald-500',
    tile: 'bg-slate-100/70 hover:bg-slate-200/60 dark:bg-slate-800/60 dark:hover:bg-slate-800',
    num: 'text-emerald-800 dark:text-emerald-200',
    value: 'text-emerald-800 dark:text-emerald-300',
    soft: 'border-emerald-300/70 bg-slate-50 dark:border-emerald-800/70 dark:bg-slate-800/50',
    softHover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    outline: 'border-emerald-300 bg-white text-emerald-800 hover:bg-slate-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-950/50',
    solid: 'bg-emerald-700 text-white hover:bg-emerald-600',
    dot: 'bg-emerald-700',
    onDark: 'text-emerald-300',
    chip: 'jarvis-chip jarvis-chip-success',
    hex: '#047857',
  },
  warn: {
    // ทองด้าน — สีเน้นที่อุ่นเพียงสีเดียวของระบบ
    bar: '!border-t-amber-700 dark:!border-t-amber-500',
    tile: 'bg-slate-100/70 hover:bg-slate-200/60 dark:bg-slate-800/60 dark:hover:bg-slate-800',
    num: 'text-amber-800 dark:text-amber-200',
    value: 'text-amber-800 dark:text-amber-300',
    soft: 'border-amber-300/70 bg-slate-50 dark:border-amber-800/70 dark:bg-slate-800/50',
    softHover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    outline: 'border-amber-300 bg-white text-amber-800 hover:bg-slate-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-950/50',
    solid: 'bg-amber-700 text-white hover:bg-amber-600',
    dot: 'bg-amber-700',
    onDark: 'text-amber-300',
    chip: 'jarvis-chip jarvis-chip-warn',
    hex: '#b45309',
  },
  danger: {
    bar: '!border-t-rose-800 dark:!border-t-red-500',
    tile: 'bg-slate-100/70 hover:bg-slate-200/60 dark:bg-slate-800/60 dark:hover:bg-slate-800',
    num: 'text-rose-900 dark:text-red-200',
    value: 'text-rose-800 dark:text-red-300',
    soft: 'border-rose-300/70 bg-slate-50 dark:border-red-800/70 dark:bg-slate-800/50',
    softHover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    outline: 'border-rose-300 bg-white text-rose-800 hover:bg-slate-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-slate-950/50',
    solid: 'bg-rose-800 text-white hover:bg-rose-700',
    dot: 'bg-rose-800',
    onDark: 'text-red-400',
    chip: 'jarvis-chip jarvis-chip-danger',
    hex: '#9f1239',
  },
  violet: {
    // สีที่ 4 — Scraping / คนเก่า Re Use · หรี่ลงให้ไม่แย่งสถานะหลัก
    bar: '!border-t-violet-700 dark:!border-t-violet-500',
    tile: 'bg-slate-100/70 hover:bg-slate-200/60 dark:bg-slate-800/60 dark:hover:bg-slate-800',
    num: 'text-violet-900 dark:text-violet-200',
    value: 'text-violet-800 dark:text-violet-300',
    soft: 'border-violet-300/70 bg-slate-50 dark:border-violet-800/70 dark:bg-slate-800/50',
    softHover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    outline: 'border-violet-300 bg-white text-violet-800 hover:bg-slate-50 dark:border-violet-800 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-slate-950/50',
    solid: 'bg-violet-700 text-white hover:bg-violet-600',
    dot: 'bg-violet-700',
    onDark: 'text-violet-300',
    chip: 'jarvis-chip jarvis-chip-violet',
    hex: '#6d28d9',
  },
  orange: {
    // สีที่ 5 — "ต้องคนตาม" / ส่งทีมคอนเทนต์ · เป็นสีเดียวที่ยังสดได้เพราะแปลว่า "ต้องลงมือ"
    bar: '!border-t-orange-600 dark:!border-t-orange-400',
    tile: 'bg-slate-100/70 hover:bg-slate-200/60 dark:bg-slate-800/60 dark:hover:bg-slate-800',
    num: 'text-orange-900 dark:text-orange-200',
    value: 'text-orange-800 dark:text-orange-300',
    soft: 'border-orange-300/70 bg-slate-50 dark:border-orange-800/70 dark:bg-slate-800/50',
    softHover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    outline: 'border-orange-300 bg-white text-orange-800 hover:bg-slate-50 dark:border-orange-800 dark:bg-slate-900 dark:text-orange-300 dark:hover:bg-slate-950/50',
    solid: 'bg-orange-600 text-white hover:bg-orange-500',
    dot: 'bg-orange-600',
    onDark: 'text-orange-300',
    chip: 'jarvis-chip jarvis-chip-orange',
    hex: '#c2410c',
  },
  teal: {
    bar: '!border-t-teal-700 dark:!border-t-teal-400',
    tile: 'bg-slate-100/70 hover:bg-slate-200/60 dark:bg-slate-800/60 dark:hover:bg-slate-800',
    num: 'text-teal-900 dark:text-teal-200',
    value: 'text-teal-800 dark:text-teal-300',
    soft: 'border-teal-300/70 bg-slate-50 dark:border-teal-800/70 dark:bg-slate-800/50',
    softHover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    outline: 'border-teal-300 bg-white text-teal-800 hover:bg-slate-50 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-300 dark:hover:bg-slate-950/50',
    solid: 'bg-teal-700 text-white hover:bg-teal-600',
    dot: 'bg-teal-700',
    onDark: 'text-teal-300',
    chip: 'jarvis-chip jarvis-chip-teal',
    hex: '#0f766e',
  },
};

/** variant ที่ต้องมีคู่ `dark:` เสมอ — dot/solid ใช้สีอิ่มตัวเดียวกันทั้งสองธีมโดยตั้งใจ */
export const TONE_DARK_REQUIRED_VARIANTS = [
  'bar',
  'tile',
  'num',
  'value',
  'soft',
  'softHover',
  'outline',
] as const;

/**
 * พื้นผิวของหน้า /dashboard (Request Control Tower)
 *
 * หน้านี้ไม่ได้ใช้ glass แบบหน้าอื่น — เป็น light enterprise dashboard ตามที่ตกลงไว้
 * ที่ references/05-ui-design-rules.md จึงมี token ชุดของตัวเอง แต่ต้องมีคู่มืดครบเหมือนกัน
 */
export const DASH = {
  /** การ์ดมาตรฐาน — ใส่ padding ที่จุดเรียกใช้ (แต่ละการ์ดใช้ไม่เท่ากัน) */
  card: 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
  /** การ์ดใหญ่มุมโค้งกว่า — แถว KPI / ถังอายุ */
  cardLg: 'rounded-2xl bg-white shadow-sm dark:bg-slate-900',
  /** การ์ดดำสำหรับสรุปผู้บริหาร (ตามรูป reference ที่เจ้าของส่งมา) */
  darkCard: 'jarvis-dark-card',
  /** hero เข้มหัวหน้า Dashboard (mockup rev.3 ข้อ 02) — น้ำเงินหมึก เข้มทั้งสองธีม */
  hero: 'jarvis-hero-card',
  /** ป้ายทอง (brass) บน hero เข้ม — สีเดียวทั้งสองธีมเพราะพื้นเข้มตลอด */
  heroLabel: 'text-[10px] font-bold uppercase tracking-[0.14em] text-[#c9b184]',
  /** ป้ายหัวข้อกลุ่ม (brass) บนพื้นสว่างของหน้า — ภาษาเดียวกับ eyebrow ใน mockup */
  eyebrow: 'text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a6c33] dark:text-[#cfae72]',
  title: 'text-sm font-semibold text-slate-900 dark:text-slate-100',
  label: 'text-xs font-medium text-slate-600 dark:text-slate-300',
  sub: 'text-xs text-slate-500 dark:text-slate-400',
  /** เหมือน sub แต่ไม่กำหนดขนาด — ใช้เมื่อจุดเรียกใช้กำหนดขนาดเอง (twMerge จะทับขนาดถ้าใช้ sub) */
  muted: 'text-slate-600 dark:text-slate-400',
  divider: 'border-slate-100 dark:border-slate-800',
  tableHead: 'bg-slate-50/80 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400',
  tableRow: 'border-slate-50 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/40',
  cell: 'text-slate-700 dark:text-slate-300',
  cellStrong: 'font-medium text-slate-900 dark:text-slate-100',
  cellMuted: 'text-slate-600 dark:text-slate-400',
} as const;

/** key ของ DASH ที่ยกเว้นกฎ "ต้องมีคู่ dark" — การ์ดดำ/hero/ป้ายบน hero เป็นสีเดียวทั้งสองธีมโดยตั้งใจ */
export const DASH_DARK_EXEMPT_KEYS = ['darkCard', 'hero', 'heroLabel'] as const;

/**
 * กราฟ (recharts) — รับ class ไม่ได้ ต้องส่งค่าสีเข้าไปตรง ๆ
 *
 * แกนและเส้นตารางใช้ `currentColor` เพื่อสืบสีจาก class ของ div ที่ครอบกราฟ (ใส่ DASH.sub ไว้)
 * จะได้สลับตามธีมเองโดยไม่ต้องมี hook อ่านธีมใน component
 * สีเส้น/แท่งของแต่ละ series ให้ดึงจาก TONE[...].hex ตามความหมายของ series นั้น ห้ามใส่ hex สดใหม่
 */
export const CHART = {
  axisFill: 'currentColor',
  gridStroke: 'currentColor',
  gridOpacity: 0.2,
  /** tooltip ป้ายดำ (ตามรูป reference ที่เจ้าของส่งมา) — ใช้ได้ทั้งธีมสว่างและมืด */
  tooltip: {
    contentStyle: {
      background: '#111114',
      border: '1px solid rgba(255, 255, 255, 0.14)',
      borderRadius: 12,
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.28)',
      fontSize: 12,
      color: '#ffffff',
    },
    labelStyle: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, marginBottom: 2 },
    itemStyle: { color: '#ffffff' },
  },
} as const;

/**
 * ═══ Jarvis HUD — ภาษาออกแบบ "แผงควบคุมล้ำ ๆ" (เจ้าของสั่ง 22 ส.ค. 2569) ═══
 *
 * เจ้าของสั่งตรง: *"ขอให้ระบบดูล้ำทันสมัยเหมือนแบบ Jarvis ในหนัง Iron man"*
 *
 * หลักที่ใช้ (ต่อจากหลัก "หมึกกับกระดาษ" ของ TONE — ไม่ทับ ไม่แทน):
 * 1. **HUD คือแผง ink เข้มเท่ากันทั้งสองธีมโดยตั้งใจ** — ภาษาเดียวกับ `DASH.hero` / `DASH.darkCard`
 *    ที่ทำมาแล้วและเจ้าของรับ · จึงยกเว้นกฎ "ต้องมีคู่ dark" เหมือนสองตัวนั้น
 *    (เหตุผล: ของล้ำ ๆ อ่านออกเฉพาะบนพื้นเข้ม · ทำคู่สว่างแล้วเส้นเรืองแสงจะกลายเป็นเส้นจาง)
 * 2. **ไม่มีสีใหม่** — เส้น/แสงทั้งหมดใช้ teal/sky ชุดเดียวกับ `TONE.teal.onDark` (teal-300)
 *    และ `TONE.info.onDark` (sky-300) ที่ระบบใช้บนพื้นเข้มอยู่แล้ว
 * 3. **ตัวเลขเป็น mono + tabular** — เลขบนแผงต้องไม่ขยับตอนค่าเปลี่ยน (ของเดิมใช้ฟอนต์ปกติ
 *    เลขวิ่งแล้วความกว้างเด้ง อ่านเป็น "จอกระตุก")
 * 4. **แสงคือสถานะ ไม่ใช่ของประดับ** — เรืองแสงเฉพาะของที่ต้องลงมือ (กติกาเดียวกับ `solid`
 *    ของ TONE: ใส่เกิน 1-2 ที่ต่อหน้าแล้วจะไม่เหลือของที่เด่นจริง)
 * 5. พื้นผิวจริงประกาศเป็น class กลางใน `src/index.css` (แพตเทิร์นเดียวกับ chip/hero)
 *    ไม่ประกาศ gradient ซ้ำใน TS
 */
export const HUD = {
  /** แผงหลัก — ink panel + เส้นขอบเรืองแสงบาง + กริดจาง + มุมวงเล็บ 4 มุม (ครบในคลาสเดียว) */
  panel: 'jarvis-hud-panel',
  /** กล่องย่อยในแผง — จางกว่า ไม่มีมุมวงเล็บ (ไม่งั้นมุมซ้อนมุมกลายเป็นลายพราง) */
  inner: 'jarvis-hud-inner',
  /** กล่องย่อยที่กดได้ — hover เรืองขึ้นเล็กน้อย ใส่คู่กับ inner เท่านั้น */
  innerHover: 'jarvis-hud-inner-hover',
  /** เส้นสแกนวิ่ง — ใส่เป็น div ลูกในแผง (หยุดเองเมื่อ prefers-reduced-motion) */
  scan: 'jarvis-hud-scan',
  /** ป้ายหัวข้อกลุ่มบนแผง — uppercase ระยะห่างกว้าง โทน teal (ภาษาเดียวกับ DASH.eyebrow แต่บนพื้นเข้ม) */
  eyebrow: 'text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300',
  /** ป้ายกำกับตัวเลข/ช่อง */
  label: 'text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400',
  /** ตัวเลขหลักของแผง — mono + tabular กันความกว้างเด้ง */
  figure: 'font-mono text-2xl font-semibold tabular-nums text-white',
  /** ตัวเลขรอง */
  figureSm: 'font-mono text-lg font-semibold tabular-nums text-white',
  /** หน่วย/คำต่อท้ายตัวเลข */
  unit: 'text-[11px] text-slate-400',
  /** ตัวหนังสือเนื้อหาบนแผง */
  body: 'text-xs text-slate-300',
  /** ตัวหนังสือเนื้อหาที่ต้องเด่นกว่า body */
  bodyStrong: 'text-xs font-medium text-slate-100',
  /** เส้นคั่นในแผง */
  divider: 'border-white/10',
  /** พื้นของ popover/hover-card ที่ลอยอยู่บนแผง HUD (class กลาง — สีจริงอยู่ใน index.css) */
  popover: 'jarvis-hud-popover',
} as const;

/**
 * key ของ HUD ที่ยกเว้นกฎ "ต้องมีคู่ dark" — **ทั้งชุด** เพราะ HUD เป็นแผง ink
 * เข้มเท่ากันทั้งสองธีมโดยตั้งใจ (เหตุผลข้อ 1 ในคอมเมนต์ข้างบน)
 *
 * ⚠️ ถ้าวันหนึ่งจะทำ HUD คู่สว่าง **ห้ามเติม dark: ทีละตัว** — ให้ประกาศชุดใหม่
 * (`HUD_LIGHT`) แล้วเลือกที่จุดเรียกใช้ ไม่งั้นสองภาษาปนกันในแผงเดียว
 */
export const HUD_DARK_EXEMPT_KEYS = Object.keys(HUD) as Array<keyof typeof HUD>;

/** class กลางของ HUD ที่ต้องมีตัวจริงใน src/index.css (เทสต์เช็คให้) */
export const HUD_CSS_CLASS_KEYS = ['panel', 'inner', 'innerHover', 'scan', 'popover'] as const;

/**
 * สีเส้นกราฟ/เกจ **บนพื้นเข้มของ HUD** — คู่ hex ของ `TONE[..].onDark`
 *
 * ทำไมต้องมีชุดที่สอง: `TONE[..].hex` เป็นเฉดเข้ม (600–800) ทำมาสำหรับกราฟบนพื้นขาว
 * เอาไปวาดบนแผง HUD สีเข้มแล้ว **จมหายไปกับพื้น** (เคสเดียวกับบั๊ก "ลืม dark:bg" ที่เจอบ่อย)
 * ชุดนี้จึงเป็นเฉด 300/400 ให้ตรงกับ class `onDark` ที่ระบบใช้กับตัวหนังสือบนพื้นเข้มอยู่แล้ว
 * — ไม่ใช่สีใหม่ เป็นเฉดสว่างของสีเดิม
 *
 * ⚠️ SVG/canvas รับ class ไม่ได้ ต้องส่ง hex เข้าไปตรง ๆ (เหตุผลเดียวกับ `TONE[..].hex`)
 */
/**
 * สี "หมึกเข้ม" ของ HUD — ปลายมืดของ gradient บนแผง (`.jarvis-hud-panel`)
 *
 * ใช้เป็น **สีตัวหนังสือ/รายละเอียดบนบล็อกสีอิ่ม** ของ HUD (ป้ายจำนวนของค้าง · ตา/ปาก
 * ของตัวละครในฉากห้องทำงาน) — พวกนี้อยู่ใน SVG/inline style ซึ่งรับ class ไม่ได้
 * จึงต้องมีค่าจริงให้อ้าง ห้ามพิมพ์ hex ซ้ำที่จุดเรียกใช้
 */
export const HUD_INK = {
  hex: '#0a1120',
  /** เข้มเกือบทึบ — ตา/ตัวเลขบนพื้นสีอิ่ม */
  strong: 'rgba(10, 17, 32, 0.85)',
  /** จางลง — เส้นปาก/รายละเอียดรอง */
  soft: 'rgba(10, 17, 32, 0.7)',
} as const;

export const HUD_HEX: Record<ToneKey, string> = {
  neutral: '#cbd5e1', // slate-300
  info: '#7dd3fc', // sky-300
  primary: '#93c5fd', // blue-300
  success: '#6ee7b7', // emerald-300
  warn: '#fcd34d', // amber-300
  danger: '#f87171', // red-400
  violet: '#c4b5fd', // violet-300
  orange: '#fdba74', // orange-300
  teal: '#5eead4', // teal-300
};

/**
 * สีโครงฉาก "ห้องทำงาน" บนหน้าแรก — พื้น · โต๊ะ · เก้าอี้ · เส้นเชื่อมงาน
 *
 * ทำไมต้องอยู่ที่นี่: SVG รับ class ไม่ได้ (เหตุผลเดียวกับ `HUD_HEX`) แต่ถ้าปล่อยให้
 * component เขียน `rgba(...)` เองกระจาย 30 จุด จะไม่มีทางปรับความเข้มของฉากทั้งก้อน
 * ได้อีก และผิดกติกา "สีทุกสีมาจาก designTokens"
 *
 * 🔴 ทุกค่าเป็น **rgba ที่ทับบนพื้นแผง HUD** (ขาว/ดำ + teal เท่านั้น) — ไม่มีสีความหมายใหม่
 * สีที่ "มีความหมาย" (สถานะของโต๊ะ) มาจาก `HUD_HEX[tone]` เสมอ
 */
export const HUD_SCENE = {
  /** พื้นห้อง (ไล่จางลงล่าง) */
  floor: 'rgba(255, 255, 255, 0.045)',
  /** เส้นตารางพื้นแบบมุมมองลึก */
  floorLine: 'rgba(94, 234, 212, 0.10)',
  /** เส้นขอบฟ้า */
  horizon: 'rgba(94, 234, 212, 0.20)',
  /** หน้าโต๊ะ (ด้านบนของทรงไอโซเมตริก) */
  deskTop: 'rgba(255, 255, 255, 0.17)',
  /** ด้านข้าง/ขาโต๊ะ — เข้มกว่าหน้าโต๊ะเพื่อให้เห็นความหนา */
  deskSide: 'rgba(255, 255, 255, 0.08)',
  /** ขอบเรืองบนหน้าโต๊ะ */
  deskEdge: 'rgba(94, 234, 212, 0.26)',
  /** เก้าอี้ */
  chair: 'rgba(255, 255, 255, 0.13)',
  /** กระจก/จอลอย */
  glass: 'rgba(255, 255, 255, 0.055)',
  /** เงาใต้ของ */
  shadow: 'rgba(0, 0, 0, 0.32)',
  /** เส้นเชื่อม "งานไหลไปทางไหน" ระหว่างโต๊ะ (ตอนไม่มีงานไหล) */
  link: 'rgba(148, 163, 184, 0.22)',
  /**
   * สีตัวมาสคอต (ย้ายมาจาก hex ดิบในไฟล์ฉาก · Phase 8.2)
   * กติกา "ห้าม hex ดิบในไฟล์หน้า" บังคับกับของใหม่ทันที · ฉากนี้เป็นโลกกลางคืน
   * โทนเดียว (ไม่มีคู่ light/dark) จึงเป็นค่าคงที่เหมือน HUD_SCENE ตัวอื่น
   */
  /**
   * ⚠️ ต้องอยู่ใน **จานเดียวกับ HUD_SCENE ตัวอื่น** (ขาว/เทา/teal-300/slate-400)
   * เทสต์ `designTokens.test.ts` บังคับไว้ — ของเดิมเคยเป็นฟ้าจาง/น้ำเงินเข้ม
   * (`#cfe4f7`/`#0b1524`/`#eaf6ff`) ซึ่งเป็น "สีใหม่นอก TONE" ที่กติกา Phase 1.2 ห้าม
   * เปลี่ยนเป็นไล่ขาว→เทา + บังตาดำ · แสง teal ของฉากยังฉาบให้เห็นเป็นโทนฟ้าอยู่แล้ว
   */
  mascotSheenFrom: 'rgba(255, 255, 255, 1)',
  mascotSheenTo: 'rgba(203, 203, 203, 1)',
  mascotVisor: 'rgba(17, 17, 17, 1)',
  mascotEye: 'rgba(240, 240, 240, 1)',
} as const;

/**
 * ═══ ฉากของ "หน้าด่านหน้า" (login · หน้าสมัครสาธารณะ) ═══
 *
 * 🔴 **ยกมาจาก mockup `tundralogin_v3.html` ที่เจ้าของส่งมา 27 ส.ค. 2569 ตรง ๆ**
 * เจ้าของสั่ง: *"ถ้าใช้ได้ก็ใช้ แต่อยากให้มีแค่แบบของเรา เหมือนอยากได้ค่าภาพกับ
 * อะไรต่าง ๆ ของเขา แต่การทำงานเป็นแบบเรา"*
 * แล้วย้ำอีกรอบตอนผมไปสลับภาพเป็นฉากออฟฟิศของเราเอง:
 * *"บ้าหรอ จะเอาแบบไฟล์ HTML ที่ส่งให้ดิ ทำนอกเหนือจากที่สั่งอีกแล้ว"*
 *
 * ⇒ **หน้าตา = ของเขาเป๊ะ** (ภาพป่า · จานกระดาษ-เขียวป่า · การ์ดกระจก · ตัวอักษรของเขา)
 * ⇒ **การทำงาน = ของเรา** (Microsoft SSO · กฎรหัสผ่าน · ข้อความ error · สิทธิ์)
 *
 * ⚠️ ค่าพวกนี้อยู่ใน token ได้เพราะเป็น **แหล่งเดียวของสี** — กติกาห้าม hex ดิบ
 * บังคับกับ "ไฟล์หน้าจอ" ไม่ใช่ไฟล์ token (เหมือน `TONE.*.hex` ที่ทำมาก่อน)
 */
export const FRONT_SCENE = {
  /** ภาพพื้นหลัง — ภาพเดียวกับใน mockup (ป่าสน มองจากบน) */
  photo:
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2600&q=92',
  /** สีพื้นรองตอนภาพยังโหลดไม่เสร็จ */
  base: '#cfd8cf',
  /** กระดาษ — พื้นของการ์ดกระจก */
  paper: '#f5f2e9',
  glass: 'rgba(248, 246, 239, .72)',
  glassStrong: 'rgba(250, 248, 242, .88)',
  /** เส้นขอบไฮไลต์ของกระจก */
  line: 'rgba(255, 255, 255, .58)',
  /** หมึก — ตัวหนังสือหลักบนกระดาษ */
  ink: '#15251c',
  muted: '#66736b',
  /** เขียวป่า — ปุ่มลงมือกับตราบริษัท */
  forest: '#1e3a2b',
  forest2: '#294d39',
  /** เขียวจาง — คำที่เน้นในหัวเรื่อง / ลิงก์ (ค่าของ mockup) */
  sage: '#6d8b77',
  /**
   * เขียวจางแบบเข้มขึ้น — ใช้ตอนตัวหนังสือทับ**ภาพ** ไม่ใช่พื้นครีม
   * ⚠️ mockup วางหัวเรื่องบนพื้นครีมล้วน `sage` จึงพอ · ของเราทับป่าที่ช่วงกลางสว่างจัด
   * วัดบนจอจริงแล้ว `sage` จมหายไป (ชัดสุดบนมือถือ) ⇒ ต้องมีตัวเข้มคู่กัน
   */
  sageStrong: '#3f6350',
  /** ฟิลเตอร์ที่ทาบบนภาพ — ลดความจัดของสีให้ภาพไม่แย่งการ์ด */
  photoFilter: 'saturate(.78) contrast(.96) brightness(1.04)',
} as const;

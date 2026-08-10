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

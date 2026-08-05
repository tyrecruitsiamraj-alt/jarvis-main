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
  /** บล็อกสีอิ่ม ตัวหนังสือขาว — เฉพาะตัวเลขที่ต้องลงมือวันนี้ */
  solid: string;
  /** จุดสีเล็กหน้าป้าย */
  dot: string;
  /** ชิป — class กลางใน src/index.css (แหล่งเดียวกับที่หน้าอื่นเรียกใช้) */
  chip: string;
  /** ค่าสีจริงสำหรับ recharts (รับ class ไม่ได้ ต้องเป็น hex) */
  hex: string;
};

export const TONE: Record<ToneKey, ToneClasses> = {
  neutral: {
    bar: '!border-t-slate-400 dark:!border-t-slate-500',
    tile: 'bg-slate-100/80 hover:bg-slate-200/60 dark:bg-slate-800/70 dark:hover:bg-slate-800',
    num: 'text-slate-700 dark:text-slate-300',
    value: 'text-slate-800 dark:text-slate-200',
    soft: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50',
    softHover: 'hover:bg-slate-100/70 dark:hover:bg-slate-800',
    solid: 'bg-slate-600 text-white hover:bg-slate-500',
    dot: 'bg-slate-400',
    chip: 'jarvis-chip jarvis-chip-neutral',
    hex: '#94a3b8',
  },
  info: {
    bar: '!border-t-sky-400 dark:!border-t-sky-500',
    tile: 'bg-sky-50 hover:bg-sky-100/70 dark:bg-sky-950/60 dark:hover:bg-sky-950',
    num: 'text-sky-900 dark:text-sky-200',
    value: 'text-sky-700 dark:text-sky-300',
    soft: 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/50',
    softHover: 'hover:bg-sky-100/70 dark:hover:bg-sky-950',
    solid: 'bg-sky-600 text-white hover:bg-sky-500',
    dot: 'bg-sky-400',
    chip: 'jarvis-chip jarvis-chip-info',
    hex: '#0ea5e9',
  },
  primary: {
    bar: '!border-t-blue-500 dark:!border-t-blue-400',
    tile: 'bg-blue-50 hover:bg-blue-100/70 dark:bg-blue-950/60 dark:hover:bg-blue-950',
    num: 'text-blue-900 dark:text-blue-200',
    value: 'text-blue-700 dark:text-blue-300',
    soft: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50',
    softHover: 'hover:bg-blue-100/70 dark:hover:bg-blue-950',
    solid: 'bg-blue-600 text-white hover:bg-blue-500',
    dot: 'bg-blue-500',
    chip: 'jarvis-chip jarvis-chip-primary',
    hex: '#3b82f6',
  },
  success: {
    bar: '!border-t-emerald-500 dark:!border-t-emerald-400',
    tile: 'bg-emerald-50 hover:bg-emerald-100/70 dark:bg-emerald-950/60 dark:hover:bg-emerald-950',
    num: 'text-emerald-900 dark:text-emerald-200',
    value: 'text-emerald-700 dark:text-emerald-300',
    soft: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/50',
    softHover: 'hover:bg-emerald-100/70 dark:hover:bg-emerald-950',
    solid: 'bg-emerald-600 text-white hover:bg-emerald-500',
    dot: 'bg-emerald-400',
    chip: 'jarvis-chip jarvis-chip-success',
    hex: '#22c55e',
  },
  warn: {
    bar: '!border-t-amber-400 dark:!border-t-amber-500',
    tile: 'bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/60 dark:hover:bg-amber-950',
    num: 'text-amber-900 dark:text-amber-200',
    value: 'text-amber-700 dark:text-amber-300',
    soft: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50',
    softHover: 'hover:bg-amber-100/70 dark:hover:bg-amber-950',
    solid: 'bg-amber-500 text-white hover:bg-amber-400',
    dot: 'bg-amber-400',
    chip: 'jarvis-chip jarvis-chip-warn',
    hex: '#f59e0b',
  },
  danger: {
    bar: '!border-t-red-500 dark:!border-t-red-400',
    tile: 'bg-red-50 hover:bg-red-100/70 dark:bg-red-950/60 dark:hover:bg-red-950',
    num: 'text-red-900 dark:text-red-200',
    value: 'text-red-700 dark:text-red-300',
    soft: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50',
    softHover: 'hover:bg-red-100/70 dark:hover:bg-red-950',
    solid: 'bg-red-600 text-white hover:bg-red-500',
    dot: 'bg-red-500',
    chip: 'jarvis-chip jarvis-chip-danger',
    hex: '#ef4444',
  },
  violet: {
    bar: '!border-t-violet-500 dark:!border-t-violet-400',
    tile: 'bg-violet-50 hover:bg-violet-100/70 dark:bg-violet-950/60 dark:hover:bg-violet-950',
    num: 'text-violet-900 dark:text-violet-200',
    value: 'text-violet-700 dark:text-violet-300',
    soft: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/50',
    softHover: 'hover:bg-violet-100/70 dark:hover:bg-violet-950',
    solid: 'bg-violet-600 text-white hover:bg-violet-500',
    dot: 'bg-violet-400',
    chip: 'jarvis-chip jarvis-chip-violet',
    hex: '#8b5cf6',
  },
  orange: {
    bar: '!border-t-orange-400 dark:!border-t-orange-400',
    tile: 'bg-orange-50 hover:bg-orange-100/70 dark:bg-orange-950/60 dark:hover:bg-orange-950',
    num: 'text-orange-900 dark:text-orange-200',
    value: 'text-orange-700 dark:text-orange-300',
    soft: 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/50',
    softHover: 'hover:bg-orange-100/70 dark:hover:bg-orange-950',
    solid: 'bg-orange-500 text-white hover:bg-orange-400',
    dot: 'bg-orange-400',
    chip: 'jarvis-chip jarvis-chip-orange',
    hex: '#f97316',
  },
  teal: {
    bar: '!border-t-teal-400 dark:!border-t-teal-400',
    tile: 'bg-teal-50 hover:bg-teal-100/70 dark:bg-teal-950/60 dark:hover:bg-teal-950',
    num: 'text-teal-900 dark:text-teal-200',
    value: 'text-teal-700 dark:text-teal-300',
    soft: 'border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/50',
    softHover: 'hover:bg-teal-100/70 dark:hover:bg-teal-950',
    solid: 'bg-teal-600 text-white hover:bg-teal-500',
    dot: 'bg-teal-400',
    chip: 'jarvis-chip jarvis-chip-teal',
    hex: '#14b8a6',
  },
};

/** variant ที่ต้องมีคู่ `dark:` เสมอ — dot/solid ใช้สีอิ่มตัวเดียวกันทั้งสองธีมโดยตั้งใจ */
export const TONE_DARK_REQUIRED_VARIANTS = ['bar', 'tile', 'num', 'value', 'soft', 'softHover'] as const;

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
  eyebrow: 'text-[11px] font-bold uppercase tracking-[0.14em] text-[#b08d4f] dark:text-[#cfae72]',
  title: 'text-sm font-semibold text-slate-900 dark:text-slate-100',
  label: 'text-xs font-medium text-slate-600 dark:text-slate-300',
  sub: 'text-xs text-slate-500 dark:text-slate-400',
  /** เหมือน sub แต่ไม่กำหนดขนาด — ใช้เมื่อจุดเรียกใช้กำหนดขนาดเอง (twMerge จะทับขนาดถ้าใช้ sub) */
  muted: 'text-slate-500 dark:text-slate-400',
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

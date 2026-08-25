/**
 * KPI แถวบนของหน้าหลัก — แปลง "เลขวันนี้ / เลขเมื่อวาน" เป็นการ์ดที่อ่านออก
 * (เจ้าของเคาะ 24 ส.ค. 2569: *"ทำตัวเทียบจริงเลย"* — ห้ามใส่ลูกศรลอย ๆ)
 *
 * 🔴 กติกาที่ฝังไว้:
 * 1. **เทียบได้เฉพาะตัวที่เป็นเหตุการณ์มีเวลา** (ใบสมัครกรอกเมื่อไหร่ · ผลโทรกลับเมื่อไหร่ ·
 *    นัดเมื่อไหร่) — ตัวที่เป็น "สถานะปัจจุบัน" (ใบขอเปิดกี่ใบ · ข้อเสนอค้างกี่ใบ)
 *    **เทียบวันต่อวันไม่ได้** เพราะระบบไม่เก็บ snapshot รายวัน ⇒ ห้ามแต่งตัวเลขให้
 * 2. **วันที่ยังไม่มีอะไรเกิด ห้ามโชว์ 0 เฉย ๆ** — ฐานจริง 24 ส.ค. 2569 วันนี้ 0 ทุกช่อง
 *    (ระบบเพิ่งเปลี่ยนมาใช้ gating ปล่อยใบ) ถ้าแปะ 0 ทุกใบทุกวันจะกลายเป็นป้ายตาย
 *    ตาม anti-pattern ข้อ 3 ของแผงบอร์ด ⇒ ตอบเป็น `quiet` ให้จอเลือกคำเอง
 * 3. **อัตรา (%) ที่ฐานยังน้อย ต้องบอกว่าน้อย** — 1 สายติดจาก 1 สาย ไม่ใช่ 100%
 *    ที่เอาไปอวดได้ ⇒ ต่ำกว่า `MIN_RATE_SAMPLE` ให้ถือว่ายังไม่พอตัดสิน
 */

/** จำนวนสายขั้นต่ำก่อนจะยอมโชว์เปอร์เซ็นต์เป็นตัวชี้วัด */
export const MIN_RATE_SAMPLE = 5;

export type KpiKey =
  | 'newApplicants'
  | 'callResults'
  | 'interested'
  | 'appointments'
  | 'connectRate';

/** เลขดิบที่ API นับมา — คู่วันนี้/เมื่อวาน ตัวต่อตัว */
export type KpiPair = {
  today: number;
  yesterday: number;
  /** ตัวหารของอัตรา (เฉพาะ KPI ที่เป็น %) — วันนี้ / เมื่อวาน */
  todayBase?: number;
  yesterdayBase?: number;
};

export type KpiRaw = Record<KpiKey, KpiPair>;

export type KpiCard = {
  key: KpiKey;
  label: string;
  /** ค่าที่โชว์ตัวใหญ่ (อัตราเป็น % แล้ว) */
  value: number;
  unit: string;
  /** เป็นอัตราไหม (จอจะเติม %) */
  isRate: boolean;
  /** ต่างจากเมื่อวานเท่าไหร่ — `null` = เทียบไม่ได้ (ยังไม่มีของให้เทียบ) */
  delta: number | null;
  /** วันนี้ยังไม่มีอะไรเกิดเลย */
  quiet: boolean;
  /** คำอธิบายใต้ตัวเลข — บอกที่มา ไม่ใช่คำเชียร์ */
  sub: string;
  /** ลิงก์ไปหน้างานจริงของ KPI นี้ */
  href: string;
};

const META: Record<KpiKey, { label: string; unit: string; isRate: boolean; href: string }> = {
  newApplicants: { label: 'ผู้สมัครใหม่วันนี้', unit: 'คน', isRate: false, href: '/recruit/rm' },
  callResults: { label: 'ผลโทรกลับวันนี้', unit: 'สาย', isRate: false, href: '/recruit/rm?tab=calls' },
  interested: { label: 'ตอบว่าสนใจวันนี้', unit: 'คน', isRate: false, href: '/recruit/rm?bucket=interested' },
  appointments: { label: 'นัดสัมภาษณ์วันนี้', unit: 'นัด', isRate: false, href: '/recruit/rm?tab=appointments' },
  connectRate: { label: 'อัตราต่อสายติดวันนี้', unit: '%', isRate: true, href: '/follow' },
};

/** ปัดอัตราเป็นจำนวนเต็ม — ตัวหารเป็น 0 คืน null (ไม่ใช่ 0%) */
export function ratePct(hit: number, base: number): number | null {
  if (!Number.isFinite(hit) || !Number.isFinite(base) || base <= 0) return null;
  return Math.round((hit / base) * 100);
}

/**
 * สร้างการ์ด KPI หนึ่งใบจากคู่เลข
 * - ไม่ใช่อัตรา: `value = today` · `delta = today - yesterday`
 * - เป็นอัตรา: `value = %วันนี้` · `delta = %วันนี้ - %เมื่อวาน` (ตัวอย่างน้อย = null ทั้งคู่)
 */
export function buildKpiCard(key: KpiKey, pair: KpiPair): KpiCard {
  const meta = META[key];
  if (!meta.isRate) {
    const today = Math.max(0, Math.trunc(pair.today || 0));
    const yday = Math.max(0, Math.trunc(pair.yesterday || 0));
    const quiet = today === 0;
    return {
      key,
      label: meta.label,
      value: today,
      unit: meta.unit,
      isRate: false,
      // วันนี้ 0 และเมื่อวาน 0 = ไม่มีอะไรให้เทียบ (ไม่ใช่ "เท่าเดิม")
      delta: today === 0 && yday === 0 ? null : today - yday,
      quiet,
      sub: yday > 0 ? `เมื่อวาน ${yday} ${meta.unit}` : 'เมื่อวานไม่มี',
      href: meta.href,
    };
  }

  const base = Math.max(0, Math.trunc(pair.todayBase || 0));
  const ybase = Math.max(0, Math.trunc(pair.yesterdayBase || 0));
  const enough = base >= MIN_RATE_SAMPLE;
  const yEnough = ybase >= MIN_RATE_SAMPLE;
  const pct = enough ? ratePct(pair.today, base) : null;
  const yPct = yEnough ? ratePct(pair.yesterday, ybase) : null;
  return {
    key,
    label: meta.label,
    value: pct ?? 0,
    unit: meta.unit,
    isRate: true,
    delta: pct !== null && yPct !== null ? pct - yPct : null,
    quiet: !enough,
    sub: enough
      ? `จาก ${base} สายวันนี้`
      : base > 0
        ? `ยังน้อยเกินตัดสิน (${base} สาย)`
        : 'วันนี้ยังไม่มีสาย',
    href: meta.href,
  };
}

/** ลำดับการ์ดบนแถว — ซ้ายไปขวาตามลำดับงานจริง (สมัคร → โทร → สนใจ → นัด → คุณภาพสาย) */
export const KPI_ORDER: readonly KpiKey[] = [
  'newApplicants',
  'callResults',
  'interested',
  'appointments',
  'connectRate',
];

export function buildKpiCards(raw: KpiRaw): KpiCard[] {
  return KPI_ORDER.map((k) => buildKpiCard(k, raw[k] ?? { today: 0, yesterday: 0 }));
}

/**
 * คำบอกทิศของส่วนต่าง — ใช้คำ ไม่ใช่แค่ลูกศร (คนอ่านลูกศรกลับทางกันบ่อย)
 * `null` = เทียบไม่ได้ ⇒ จอต้องไม่วาดลูกศรเลย
 */
export function deltaText(delta: number | null, unit: string): string | null {
  if (delta === null) return null;
  if (delta === 0) return 'เท่าเมื่อวาน';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${Math.abs(delta)} ${unit} จากเมื่อวาน`;
}

/** ส่วนต่างนี้ควรอ่านเป็นข่าวดีไหม — ทุก KPI ชุดนี้ยิ่งมากยิ่งดี */
export function deltaIsGood(delta: number | null): boolean | null {
  if (delta === null || delta === 0) return null;
  return delta > 0;
}

/**
 * ── การ์ด "สถานะปัจจุบัน" (standing) ─────────────────────────────────────────
 *
 * เจ้าของสั่ง 24 ส.ค. 2569: ถอดแถบ funnel ออก แต่ *"Dashboard ต้องบอกครบทั้งระบบ"*
 * ⇒ "ใบขอเปิดอยู่ / ด่วนกี่ใบ" ย้ายขึ้นมาเป็นการ์ดใบแรกของแถว KPI
 * (ตรงกับภาพอ้างอิงที่เจ้าของส่งมา ซึ่งการ์ดใบแรกคือ "ตำแหน่งเปิดรับทั้งหมด")
 *
 * 🔴 การ์ดชนิดนี้ **ไม่มีตัวเทียบเมื่อวานตลอดกาล** — เพราะเป็นยอดคงค้าง ณ ตอนนี้
 * ไม่ใช่เหตุการณ์ที่มีเวลา และระบบไม่เก็บ snapshot รายวัน (เหตุผลเดียวกับข้อ 1 ข้างบน)
 * จึงแยก type ออกมาเลย ไม่ยัดเข้า `KpiCard` เพื่อไม่ให้เผลอวาดลูกศรให้มัน
 */
export type StandingCard = {
  key: 'openRequests';
  label: string;
  value: number;
  unit: string;
  /** บรรทัดใต้ตัวเลข — บอกของด่วน ไม่ใช่คำเชียร์ */
  sub: string;
  /** มีของด่วนค้าง = ต้องเห็นก่อน */
  alert: boolean;
  href: string;
};

/** ใบขอที่ยังเปิดรับอยู่ + จำนวนใบด่วน (มาจาก flow-summary ที่หน้าแรกโหลดอยู่แล้ว) */
export function buildOpenRequestsCard(openTotal: number, urgent: number): StandingCard {
  const total = Math.max(0, Math.trunc(openTotal || 0));
  const rush = Math.max(0, Math.trunc(urgent || 0));
  return {
    key: 'openRequests',
    label: 'ใบขอที่ยังเปิดรับ',
    value: total,
    unit: 'ใบ',
    sub: rush > 0 ? `ด่วน ${rush} ใบ` : total > 0 ? 'ไม่มีใบด่วน' : 'ยังไม่มีใบขอเปิด',
    alert: rush > 0,
    href: '/jobs/board',
  };
}

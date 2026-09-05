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
  | 'newRequests'
  | 'newApplicants'
  | 'callResults'
  | 'interested'
  | 'appointments'
  | 'apptToday'
  | 'followToday'
  | 'connectRate';

/** เลขดิบที่ API นับมา — คู่วันนี้/เมื่อวาน ตัวต่อตัว */
export type KpiPair = {
  today: number;
  yesterday: number;
  /** ตัวหารของอัตรา (เฉพาะ KPI ที่เป็น %) — วันนี้ / เมื่อวาน */
  todayBase?: number;
  yesterdayBase?: number;
  /**
   * ตัวแยกย่อยที่ต้องเห็นคู่กับตัวเลขหลัก (เจ้าของสั่ง 25 ส.ค. 2569: *"นัดวันนี้แยก
   * มา/ไม่มา"* · *"Follow แยก ต้องโทร/โทรแล้ว/สำเร็จ"*)
   * มีค่าเมื่อไหร่ `sub` ของการ์ดจะเป็นตัวแยกย่อยแทนบรรทัด "เมื่อวาน N"
   * (ตัวเทียบเมื่อวานยังอยู่ครบที่ `delta` ซึ่งจอวาดเป็นชิปแยกอยู่แล้ว)
   */
  parts?: readonly { label: string; value: number }[];
  /**
   * ตัวเลขนี้เทียบวันต่อวันได้ไหม — ค่าตั้งต้น `true`
   *
   * 🔴 `false` สำหรับ **ยอดคงค้าง** (เช่น "Follow ต้องโทร" ที่รวมของค้างจากวันก่อน)
   * ตามกติกาข้อ 1 ของไฟล์นี้: สถานะปัจจุบันไม่มี snapshot รายวัน ⇒ เทียบไม่ได้
   * ปล่อยให้คิด `today - yesterday` เมื่อไหร่ จะได้ลูกศรที่ **แต่งขึ้นมา** ซึ่งห้ามเด็ดขาด
   */
  comparable?: boolean;
};

/**
 * เลขดิบทั้งชุด — **บางคีย์ขาดได้** โดยตั้งใจ
 * `newRequests` ไม่ได้มาจาก `/api/home-kpis` (ฝั่ง pg ไม่มีวันที่ส่งใบขอ) แต่มาจาก
 * flow-summary แล้วหน้าแรกยัดเข้ามาทีหลัง ⇒ ประกาศเป็น Partial ตามความจริง
 * `buildKpiCards` เติม `{today:0,yesterday:0}` ให้คีย์ที่ขาดอยู่แล้ว (การ์ดขึ้น "ยังไม่มีวันนี้")
 */
export type KpiRaw = Partial<Record<KpiKey, KpiPair>>;

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
  newRequests: { label: 'ใบขอเข้าใหม่วันนี้', unit: 'ใบ', isRate: false, href: '/jobs/list' },
  apptToday: { label: 'นัดถึงกำหนดวันนี้', unit: 'นัด', isRate: false, href: '/follow' },
  followToday: { label: 'Follow ต้องโทรวันนี้', unit: 'ราย', isRate: false, href: '/follow' },
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
      // เทียบไม่ได้ (ยอดคงค้าง) หรือวันนี้ 0 และเมื่อวาน 0 = ไม่มีอะไรให้เทียบ
      // (ไม่ใช่ "เท่าเดิม") — ทั้งสองกรณีห้ามวาดลูกศร
      delta: pair.comparable === false || (today === 0 && yday === 0) ? null : today - yday,
      quiet,
      // มีตัวแยกย่อย = เอาตัวแยกย่อยขึ้นแทน (ตัวเทียบเมื่อวานอยู่ที่ชิป delta อยู่แล้ว)
      sub: (() => {
        const base = pair.parts?.length
          ? pair.parts.map((x) => `${x.label} ${x.value}`).join(' · ')
          : yday > 0
            ? `เมื่อวาน ${yday} ${meta.unit}`
            : 'เมื่อวานไม่มี';
        /**
         * 🔴 "Follow ต้องโทรวันนี้" ≠ hero "เลยเวลานัดแล้ว" (เจ้าของแจ้ง: จอเดียวกัน
         * ขึ้นสองเลขคนละอันจนงง — วัดจริง 6 ก.ย. 2569 บนเครื่องนี้: การ์ดนี้ 21 ราย ·
         * hero 11 ราย)
         *
         * พิสูจน์จากนิยามจริง — **ไม่ใช่แค่ "นับทั้งวัน vs เลยเวลา"** อย่างที่ดูตอนแรก
         * (วันนั้น floor.follow.today = 0 พอดี ตัดตัวแปรช่วงเวลาออกไปได้) ต้นเหตุจริงคือ
         * "โทรแล้วหรือยัง" เช็คคนละที่:
         * - การ์ดนี้ (`followWork.due` ใน api/_handlers/home-kpis.ts) นับ
         *   `outcome_code is null` —ยังไม่มีใคร **กดปิดงาน** อย่างเป็นทางการ
         * - hero `pastDue` (`FOLLOW_DONE` ใน api/_handlers/office-floor.ts) เช็คแค่ว่า
         *   คิว Lumos มีผลกลับหรือยัง (`person_ref = 'follow-<id>'` มี outcome)
         * ⇒ รายที่ AI โทรได้ผลแล้วแต่ยังไม่มีใครกดปิดงาน จะหลุดออกจาก "เลยเวลานัดแล้ว"
         * (เพราะ AI ตอบมาแล้ว) แต่ยังค้างใน "ต้องโทรวันนี้" (เพราะยังไม่ปิดงาน) —
         * ยืนยันด้วย query จริงบนฐาน 6 ก.ย. 2569: ในจำนวนที่การ์ดนี้นับ 21 ราย มี 10 ราย
         * ที่คิว Lumos มีผลกลับแล้วแต่ยังไม่ปิดงาน (ตรงกับส่วนต่าง 21-11 พอดี)
         */
        return key === 'followToday'
          ? `${base} · รวมรายที่คุยผลแล้วแต่ยังไม่ปิดงาน (คนละมุมกับ "เลยเวลานัดแล้ว")`
          : base;
      })(),
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
  'newRequests',
  'newApplicants',
  'callResults',
  'interested',
  'appointments',
  'apptToday',
  'followToday',
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
  /**
   * บรรทัดที่สอง — สถานะ SLA (Phase 10.5 · เจ้าของเคาะ 25 ส.ค. 2569: *"โชว์ทั้งคู่"*)
   * `null` = ยังไม่รู้ตัวเลข SLA (API รุ่นเก่า) ⇒ ไม่วาดบรรทัดนี้เลย
   * 🔴 **หลุดแล้วกับใกล้หลุดต้องมาคู่กัน** — วัดจริง 25 ส.ค. 2569 ใกล้หลุด 15 ใบ แต่
   * หลุดไปแล้ว 199 ใบ (68%) · โชว์ตัวเดียวคนจะเข้าใจว่ามีปัญหาแค่ 15 ใบ
   */
  sla: string | null;
  /** มีของด่วนค้าง = ต้องเห็นก่อน */
  alert: boolean;
  href: string;
};

/** ใบขอที่ยังเปิดรับอยู่ + จำนวนใบด่วน (มาจาก flow-summary ที่หน้าแรกโหลดอยู่แล้ว) */
export function buildOpenRequestsCard(
  openTotal: number,
  urgent: number,
  sla?: { breached?: number | null; atRisk?: number | null },
): StandingCard {
  const total = Math.max(0, Math.trunc(openTotal || 0));
  const rush = Math.max(0, Math.trunc(urgent || 0));
  const breached = typeof sla?.breached === 'number' ? Math.max(0, Math.trunc(sla.breached)) : null;
  const atRisk = typeof sla?.atRisk === 'number' ? Math.max(0, Math.trunc(sla.atRisk)) : null;
  return {
    key: 'openRequests',
    label: 'ใบขอที่ยังเปิดรับ',
    value: total,
    unit: 'ใบ',
    sub: rush > 0 ? `ด่วน ${rush} ใบ` : total > 0 ? 'ไม่มีใบด่วน' : 'ยังไม่มีใบขอเปิด',
    // 🔴 ไม่รู้ตัวใดตัวหนึ่ง = ไม่วาดทั้งบรรทัด ดีกว่าโชว์ครึ่งเดียวแล้วคนอ่านผิด
    sla:
      breached === null || atRisk === null
        ? null
        : `หลุด SLA ${breached} ใบ · ใกล้หลุด ${atRisk} ใบ`,
    alert: rush > 0,
    href: '/jobs/board',
  };
}

/**
 * ═══ รายได้จริงของคนเก่า — "ย้อนหลัง 3 เดือน" จริง ๆ (ไม่ใช่ 3 งวด) ═══
 *
 * เจ้าของเคาะ 26 ก.ย. 2569 (Choice: *"3 เดือนจริง ทั้งสองที่"*) — หน้าใบขอกับป๊อปไล่งาน
 * ใช้ชุดเดียวกัน · ของเดิมดึง `TOP 3` งวด ซึ่ง **ส่วนใหญ่เป็นงวดครึ่งเดือน** ⇒ ได้แค่ ~1.5 เดือน
 * ทั้งที่เจ้าของสั่งตั้งแต่ 25 ส.ค. ว่า *"ขอดูแบบย้อนหลัง 3 เดือนเลย"*
 *
 * วัดฐานจริง 26 ก.ย. 2569 (`wg2_payment_head` 12 เดือนล่าสุด — อ่านอย่างเดียว):
 * - ความยาวงวดมีแค่สองแบบ: **ครึ่งเดือน** 13/15/16 วัน (117,811 งวด) ·
 *   **เต็มเดือน** 28/30/31 วัน (49,210 งวด) · ความยาวอื่นมีหลักสิบงวด = งวดไม่เต็ม
 *   (วันเริ่ม/จบ: 1–15 · 16–สิ้นเดือน · 1–สิ้นเดือน เกือบทั้งหมด)
 * - ใบขอที่เปิดอยู่: ในหน้าต่าง 3 เดือนมีได้ **มากสุด 7 งวด** ⇒ ดึงมา 8 งวดพอเสมอ
 *
 * 🔴 กติกา:
 * 1. หน้าต่าง 3 เดือน **นับจากงวดล่าสุดของคนนั้นในไซต์นั้น** ไม่ใช่นับจากวันนี้
 *    (คนที่ออกไปแล้วครึ่งปี ก็ต้องเห็น 3 เดือนสุดท้ายที่เขาทำงานอยู่)
 * 2. **แยกรายงวดเหมือนเดิม ไม่ยุบเป็นค่าเฉลี่ย** บนหน้าใบขอ (คำสั่ง 25 ส.ค. ยังอยู่)
 * 3. ค่าเฉลี่ยต่อเดือน (`resignedMonthlyNetAverage`) ใช้ **เฉพาะปุ่ม "ใช้รายได้คนเก่า"**
 *    ในขั้นใส่รายได้ · ตัดงวดไม่เต็มทิ้ง · งวดครึ่งเดือนนับเป็นครึ่งเดือน
 */
import type { ResignedIncomeMonth } from '@/types';

/** ย้อนหลังกี่เดือน */
export const RESIGNED_INCOME_MONTHS = 3;

/**
 * จำนวนงวดที่ SQL ดึงมาก่อนตัดหน้าต่าง — วัดจริงมากสุด 7 งวดใน 3 เดือน
 * (งวดครึ่งเดือน 6 งวด + งวดไม่เต็มที่เพิ่งเข้า/เพิ่งออกได้อีก 1)
 */
export const RESIGNED_INCOME_FETCH_PERIODS = 8;

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** ถอยหลัง n เดือนแบบปฏิทิน (31 พ.ค. − 3 เดือน = 28/29 ก.พ.) — รูปไม่ถูก = `null` */
export function minusMonthsYmd(ymd: string, n: number): string | null {
  const m = YMD_RE.exec(ymd);
  if (!m) return null;
  let y = Number(m[1]);
  let mo = Number(m[2]) - n;
  while (mo <= 0) {
    mo += 12;
    y -= 1;
  }
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const d = Math.min(Number(m[3]), lastDay);
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

/** วันสิ้นสุดของงวด (ไม่มีวันจบใช้วันเริ่มแทน) — ไม่รู้ทั้งคู่ = `''` */
const endOf = (p: ResignedIncomeMonth): string => {
  const t = String(p.to ?? '').slice(0, 10);
  if (YMD_RE.test(t)) return t;
  const f = String(p.from ?? '').slice(0, 10);
  return YMD_RE.test(f) ? f : '';
};

/**
 * ตัดให้เหลือเฉพาะงวดที่อยู่ใน `months` เดือนล่าสุด — นับจากวันจบของงวดล่าสุด
 *
 * งวดที่ **จบหลังเส้นตัด** ถือว่าอยู่ในหน้าต่าง (งวดที่คร่อมเส้นก็นับ)
 * ⚠️ งวดที่ไม่รู้วันเลย ตัดทิ้ง (วางลงหน้าต่างไม่ได้) · ไม่รู้วันทุกงวด = คืน 3 งวดแรกตามเดิม
 * ⚠️ ลำดับคงตามที่ส่งมา (SQL เรียงงวดใหม่ → เก่าอยู่แล้ว)
 */
export function lastMonthsOfPay(
  periods: readonly ResignedIncomeMonth[],
  months = RESIGNED_INCOME_MONTHS,
): ResignedIncomeMonth[] {
  const ends = periods.map(endOf).filter(Boolean).sort();
  const latest = ends[ends.length - 1];
  if (!latest) return periods.slice(0, 3);
  const cutoff = minusMonthsYmd(latest, months);
  if (!cutoff) return periods.slice(0, 3);
  return periods.filter((p) => {
    const e = endOf(p);
    return e !== '' && e > cutoff;
  });
}

/** จำนวนวันของงวด (นับทั้งวันแรกและวันสุดท้าย) — ไม่รู้ = `null` */
export function payPeriodDays(from: string | null, to: string | null): number | null {
  const a = YMD_RE.exec(String(from ?? '').slice(0, 10));
  const b = YMD_RE.exec(String(to ?? '').slice(0, 10));
  if (!a || !b) return null;
  const ta = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const tb = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  const days = Math.round((tb - ta) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

export type PayPeriodKind = 'half' | 'month' | 'partial';

/**
 * งวดนี้เป็นงวดแบบไหน — ครึ่งเดือน (13–16 วัน) · เต็มเดือน (28–31 วัน) · ไม่เต็ม (อื่น ๆ)
 * ⚠️ ไม่รู้วัน = `null` (ห้ามเดาว่าเต็ม)
 */
export function payPeriodKind(from: string | null, to: string | null): PayPeriodKind | null {
  const days = payPeriodDays(from, to);
  if (days === null) return null;
  if (days >= 13 && days <= 16) return 'half';
  if (days >= 28 && days <= 31) return 'month';
  return 'partial';
}

/**
 * งวดนี้ **โดนวันออกงานตัด** ไหม — ใช้ `lastWorkingDay` (วันลาออกจากใบขอ)
 *
 * วัดฐาน 26 ก.ย. 2569: ใบขอที่รู้วันออก 186 ใบ — งวดล่าสุด **ออกกลางงวด 57 ใบ** และ
 * **จ่ายหลังวันออก 29 ใบ** (46%) ⇒ วันที่ของงวดดูเต็ม (1–15) แต่ยอดต่ำเพราะทำไม่ครบ
 * ถ้าไม่ตัด ค่าเฉลี่ย "รายได้คนเก่า" จะต่ำกว่าที่เขาได้จริงตอนทำเต็มเดือน
 * - `mid`   = ออกก่อนวันจบงวด (วันเริ่ม ≤ วันออก < วันจบ)
 * - `after` = งวดที่เริ่มหลังวันออกไปแล้ว (เงินค้าง/เงินก้อนสุดท้าย)
 */
export function resignCutOf(
  p: Pick<ResignedIncomeMonth, 'from' | 'to'>,
  lastWorkingDay: string | null | undefined,
): 'mid' | 'after' | null {
  const lwd = String(lastWorkingDay ?? '').slice(0, 10);
  if (!YMD_RE.test(lwd)) return null;
  const from = String(p.from ?? '').slice(0, 10);
  const to = String(p.to ?? '').slice(0, 10);
  if (YMD_RE.test(from) && from > lwd) return 'after';
  if (YMD_RE.test(to) && lwd < to && (!YMD_RE.test(from) || from <= lwd)) return 'mid';
  return null;
}

export type ResignedMonthlyAverage = {
  /** สุทธิเฉลี่ยต่อเดือน (ปัดเป็นบาท) */
  amount: number;
  /** จำนวนงวดเต็มที่เอามาคิด */
  fullPeriods: number;
  /** งวดเต็มพวกนั้นรวมกันได้กี่เดือน (ครึ่งเดือน = 0.5) */
  monthsCovered: number;
  /** งวดที่ตัดทิ้งเพราะไม่เต็มงวด / ไม่รู้วัน / ไม่มียอดสุทธิ */
  skipped: number;
};

/**
 * สุทธิเฉลี่ยต่อเดือนของคนเก่า — ใช้กับปุ่ม **"ใช้รายได้คนเก่า"** ในขั้นใส่รายได้เท่านั้น
 *
 * สูตร: ยอดสุทธิของงวดเต็มรวมกัน ÷ จำนวนเดือนที่งวดพวกนั้นครอบ
 * (ครึ่งเดือนนับ 0.5 · เต็มเดือนนับ 1) ⇒ สองงวดครึ่งเดือน 10,000 + 10,000 = เดือนละ 20,000
 * ตรงกับที่เห็นบน eSlip (ไม่ใช่หารด้วยจำนวนวันแล้วคูณ 30 ซึ่งได้ 19,355 แล้วคนงง)
 *
 * 🔴 งวดไม่เต็ม (เพิ่งเข้า/เพิ่งออก) **ตัดทิ้ง** — ยอดต่ำผิดปกติหรือมีเงินก้อนสุดท้ายปน
 *    รวมงวดที่วันที่ดูเต็มแต่ **โดนวันออกงานตัด** (`resignCutOf` — ส่ง `lastWorkingDay` มา)
 * ไม่มีงวดเต็มเลย = `null` (ปุ่มต้องกดไม่ได้ พร้อมบอกเหตุผล)
 */
export function resignedMonthlyNetAverage(
  periods: readonly ResignedIncomeMonth[] | null | undefined,
  lastWorkingDay?: string | null,
): ResignedMonthlyAverage | null {
  if (!periods || periods.length === 0) return null;
  let sum = 0;
  let months = 0;
  let full = 0;
  for (const p of periods) {
    const kind = payPeriodKind(p.from, p.to);
    const net = typeof p.net === 'number' && Number.isFinite(p.net) ? p.net : null;
    if (net === null || kind === null || kind === 'partial') continue;
    // วันที่งวดเต็ม แต่โดนวันออกงานตัด (ออกกลางงวด / จ่ายหลังออก) = ยอดไม่เต็ม ตัดทิ้ง
    if (resignCutOf(p, lastWorkingDay)) continue;
    sum += net;
    months += kind === 'half' ? 0.5 : 1;
    full += 1;
  }
  if (full === 0 || months <= 0) return null;
  return {
    amount: Math.round(sum / months),
    fullPeriods: full,
    monthsCovered: months,
    skipped: periods.length - full,
  };
}

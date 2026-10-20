/**
 * ═══ จับคู่ใบสมัครกับ ERP แจ้งเข้า + ช่องทาง iRecruit (เจ้าของ 19 ต.ค. 2569 "จับได้ถึงแจ้งเข้า") ═══
 * ใช้ฝั่ง API (`recruit-overview`) — pure ไม่มี import ของหน้าเว็บ · ตัวนับอยู่ `src/lib/channelFunnel.ts`
 * เทสต์ `tests/api/channelFunnel2569-10-19.test.ts`
 */

/** เบอร์ 9 ตัวท้าย (ตัวเดียวกับ "ช่องทางที่ได้คนลงงาน") */
export const phone9Of = (raw: string | null | undefined): string | null => {
  const d = String(raw ?? '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : null;
};

const BKK_YMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });
const bkkYmd = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : BKK_YMD.format(new Date(t));
};

/** มีใบแจ้งเข้า (YYYY-MM-DD) ตั้งแต่วันกรอกใบไหม · `informDays` null = อ่าน ERP ไม่ได้ */
export function informedSince(informDays: ReadonlyMap<string, readonly string[]> | null, phone9: string | null, createdAt: string): boolean | null {
  if (!informDays) return null;
  const day = bkkYmd(createdAt);
  if (!phone9 || !day) return false;
  return (informDays.get(phone9) ?? []).some((d) => d >= day);
}

/** iRecruit ลงทะเบียนห่างจากวันดึงเข้าระบบเราได้ไม่เกิน 60 วัน */
const IRECRUIT_LOOKBACK_MS = 60 * 86_400_000;

/** ช่องทางที่ลงทะเบียนใน iRecruit ครั้งล่าสุดก่อน (หรือวันเดียวกับ) วันที่ใบเข้าระบบเรา */
export function irecruitChannelAt(
  regs: ReadonlyMap<string, ReadonlyArray<{ at: string; channel: string }>> | null,
  phone9: string | null,
  createdAt: string,
): string | null {
  if (!regs || !phone9) return null;
  const t = Date.parse(createdAt);
  let best: { at: number; channel: string } | null = null;
  for (const r of regs.get(phone9) ?? []) {
    const at = Date.parse(r.at);
    if (!(at < t + 86_400_000 && t - at <= IRECRUIT_LOOKBACK_MS)) continue;
    if (!best || at > best.at) best = { at, channel: r.channel };
  }
  return best?.channel ?? null;
}

/**
 * วันแรก (YYYY-MM-DD) ที่เบอร์นี้โผล่ในชุดวัน ตั้งแต่วันกรอกใบ (เวลาไทย) — ใช้กับวันแจ้งเข้า ERP / วันเป็นผู้สมัคร iRecruit
 * `days` null = อ่านแหล่งนั้นไม่ได้ ⇒ undefined (ไม่รู้) · ไม่เจอ = null
 */
export function firstDaySince(
  days: ReadonlyMap<string, readonly string[]> | null,
  phone9: string | null,
  createdAt: string,
): string | null | undefined {
  if (!days) return undefined;
  const day = bkkYmd(createdAt);
  if (!phone9 || !day) return null;
  const hits = (days.get(phone9) ?? []).filter((d) => d >= day).sort();
  return hits[0] ?? null;
}

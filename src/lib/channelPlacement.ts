/**
 * ═══ ช่องทางที่ได้คนลงงาน (เจ้าของ 19 ต.ค. 2569 — หน้าภาพรวมงานสรรหา) ═══
 *
 * เจ้าของ: *"ทีม Online ควรเห็นว่าเด็กตัวเองมาจากไหนบ้าง แล้วได้ลงงานจากช่องทางไหนเยอะ"* +
 * Choice "ตามเดือนที่แจ้งเข้า" · "ช่องทางหลัก กดดูย่อยได้"
 *
 * - ลงงาน = ใบแจ้งเข้า ERP ที่ไม่ถูกยกเลิก ในช่วงที่เลือก (ตามวันแจ้งเข้า) — คนละ 1 ครั้ง
 * - ช่องทาง = การลงทะเบียนล่าสุด **ก่อนหรือวันเดียวกับ** วันแจ้งเข้า (ย้อนไม่เกิน 365 วัน) จับคู่ด้วยเบอร์ 9 ตัวท้าย
 *   แหล่งลงทะเบียน: iRecruit (ช่องทาง/กลุ่มย่อยของ RM) + ใบสมัครผ่านลิงก์ของระบบเรา
 * - ลงทะเบียน = จำนวนเบอร์ที่ลงทะเบียนในช่วงเดียวกัน (ตามวันลงทะเบียน)
 * - ไม่เจอการลงทะเบียน = "ไม่รู้ช่องทาง" (บอกเลขเสมอ ห้ามทิ้ง — ทุกแถวรวมกัน = แจ้งเข้าทั้งหมด)
 * ไฟล์นี้ pure — เทสต์ `tests/api/channelPlacement2569-10-19.test.ts`
 */

export type ChannelRegistration = { phone9: string; at: string; channel: string | null; sub: string | null };
export type ChannelInform = { phone9: string; at: string };

export type ChannelSubRow = { name: string; registered: number; placed: number };
export type ChannelRow = { channel: string; registered: number; placed: number; subs: ChannelSubRow[] };
export type ChannelPlacement = {
  /** แจ้งเข้าในช่วง (คน) */
  informed: number;
  /** ในนั้นรู้ช่องทาง */
  matched: number;
  rows: ChannelRow[];
};

export const UNKNOWN_CHANNEL = 'ไม่รู้ช่องทาง';
const LOOKBACK_MS = 365 * 86_400_000;

/** รวมชื่อช่องทางหลักให้เป็นชุดเดียว (iRecruit + ลิงก์ระบบเรา) — TikTok ไลฟ์แยกออกมาให้เห็น */
export function mainChannelOf(channel: string | null, sub: string | null): string {
  const ch = (channel ?? '').trim();
  const s = (sub ?? '').trim();
  if (/tiktok/i.test(ch)) return /live|ไลฟ์/i.test(s) ? 'TikTok ไลฟ์สด' : 'TikTok';
  if (/line\s*ai\s*lbd/i.test(ch)) return 'Line AI LBD';
  if (/line\s*ai\s*lba/i.test(ch)) return 'Line AI LBA';
  if (/^line/i.test(ch)) return 'LINE OA';
  if (/facebook\s*group/i.test(ch)) return 'Facebook กลุ่ม';
  if (/facebook\s*ads/i.test(ch)) return 'Facebook Ads';
  if (/facebook\s*page/i.test(ch)) return 'Facebook เพจ';
  if (/^facebook$/i.test(ch)) return 'Facebook';
  if (/^other$/i.test(ch)) return 'อื่น ๆ';
  if (/^flyer$/i.test(ch)) return 'ป้าย/ใบปลิว';
  return ch || 'ไม่ระบุ';
}

const subName = (sub: string | null, channel: string) => (sub ?? '').trim() || channel;

export function buildChannelPlacement(
  regs: readonly ChannelRegistration[],
  informs: readonly ChannelInform[],
  window: { from: string; to: string },
): ChannelPlacement {
  const fromMs = Date.parse(`${window.from}T00:00:00+07:00`);
  const toMs = Date.parse(`${window.to}T00:00:00+07:00`) + 86_400_000;
  const byPhone = new Map<string, ChannelRegistration[]>();
  for (const r of regs) {
    if (!/^\d{9}$/.test(r.phone9)) continue;
    const list = byPhone.get(r.phone9) ?? [];
    list.push(r);
    byPhone.set(r.phone9, list);
  }

  const rows = new Map<string, { registered: Set<string>; placed: number; subs: Map<string, { registered: Set<string>; placed: number }> }>();
  const rowOf = (channel: string) => {
    let r = rows.get(channel);
    if (!r) {
      r = { registered: new Set(), placed: 0, subs: new Map() };
      rows.set(channel, r);
    }
    return r;
  };
  const subOf = (row: ReturnType<typeof rowOf>, name: string) => {
    let s = row.subs.get(name);
    if (!s) {
      s = { registered: new Set(), placed: 0 };
      row.subs.set(name, s);
    }
    return s;
  };

  // ลงทะเบียนในช่วง (นับเบอร์ไม่ซ้ำต่อช่องทาง)
  for (const r of regs) {
    const t = Date.parse(r.at);
    if (!(t >= fromMs && t < toMs) || !/^\d{9}$/.test(r.phone9)) continue;
    const ch = mainChannelOf(r.channel, r.sub);
    const row = rowOf(ch);
    row.registered.add(r.phone9);
    subOf(row, subName(r.sub, ch)).registered.add(r.phone9);
  }

  // ลงงาน — คนละครั้ง (แจ้งเข้าแรกในช่วง)
  const firstInform = new Map<string, number>();
  for (const i of informs) {
    const t = Date.parse(i.at);
    if (!(t >= fromMs && t < toMs) || !/^\d{9}$/.test(i.phone9)) continue;
    const prev = firstInform.get(i.phone9);
    if (prev === undefined || t < prev) firstInform.set(i.phone9, t);
  }
  let matched = 0;
  for (const [phone, t] of firstInform) {
    const cands = (byPhone.get(phone) ?? []).filter((r) => {
      const at = Date.parse(r.at);
      // วันแจ้งเข้าเป็นวันที่ (ไม่มีเวลา) ⇒ ลงทะเบียนวันเดียวกันนับได้ทั้งวัน
      return at < t + 86_400_000 && t - at <= LOOKBACK_MS;
    });
    if (cands.length === 0) {
      rowOf(UNKNOWN_CHANNEL).placed += 1;
      continue;
    }
    const last = cands.reduce((a, b) => (Date.parse(b.at) > Date.parse(a.at) ? b : a));
    const ch = mainChannelOf(last.channel, last.sub);
    const row = rowOf(ch);
    row.placed += 1;
    subOf(row, subName(last.sub, ch)).placed += 1;
    matched += 1;
  }

  const out: ChannelRow[] = [...rows.entries()].map(([channel, r]) => ({
    channel,
    registered: r.registered.size,
    placed: r.placed,
    subs: [...r.subs.entries()]
      .map(([name, s]) => ({ name, registered: s.registered.size, placed: s.placed }))
      .sort((a, b) => b.placed - a.placed || b.registered - a.registered),
  }));
  // ลงงานมากก่อน · "ไม่รู้ช่องทาง" ท้ายสุดเสมอ
  out.sort((a, b) =>
    a.channel === UNKNOWN_CHANNEL ? 1 : b.channel === UNKNOWN_CHANNEL ? -1 : b.placed - a.placed || b.registered - a.registered,
  );
  if (!rows.has(UNKNOWN_CHANNEL)) out.push({ channel: UNKNOWN_CHANNEL, registered: 0, placed: 0, subs: [] });
  return { informed: firstInform.size, matched, rows: out };
}

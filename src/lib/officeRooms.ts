/**
 * ฉาก "4 ห้อง" บนหน้าแรก (Phase 2.12 + 10.1 · เจ้าของเคาะ 24 ส.ค. 2569)
 *
 * เจ้าของส่งภาพ render มาเอง (`public/office/office-rooms.jpg`) แล้วสั่ง:
 * *"ภาพตัวอย่างถ้าไม่ได้ประมาณนี้ไม่ต้องออกมานะ"* + *"มันควรแบ่งเป็นห้อง"* —
 * ฉากจึงเป็น **ไฟล์ภาพ** ส่วนตัวเลข/การ์ด/ป้ายเป็น **DOM จริงวางทับ** (เลขสด กดได้)
 *
 * ไฟล์นี้ pure ล้วน: รวมโต๊ะ 6 ตัวของ `officeFloor.ts` เป็น 4 ห้องตามที่เจ้าของนิยาม
 *   1. Online   = โต๊ะคอนเทนต์/Scraping (ส่งออกไปหน้าสาธารณะ)
 *   2. Recruit  = โต๊ะทีมสรรหา (รับสมัครผ่านกล่องงาน)
 *   3. คัดสรร   = โต๊ะคัดสรร + โทรติดตาม (Follow) + ดูแลหลังเริ่มงาน (3 โต๊ะในห้องเดียว)
 *   4. AI Call  = โต๊ะ AI โทร (Lumos)
 *
 * 🔴 กติกา:
 * 1. **ห้ามคิดเลขใหม่ที่นี่** — ทุกตัวเลข/สถานะ/ประโยคมาจาก `Desk` ที่ `officeFloor.ts`
 *    คิดไว้แล้ว (นิยามเดียวทั้งระบบ) ที่นี่แค่จัดกลุ่มเป็นห้อง
 * 2. **โต๊ะที่หายไปจาก API ห้ามเดา** — ห้องที่ไม่มีโต๊ะเลยให้สถานะ `off` ตรง ๆ
 * 3. ตำแหน่งการ์ด/ป้ายบนภาพเป็น **% ของภาพ** — ภาพถูกครอบด้วย aspect-ratio คงที่
 *    จึงขยับตามจอโดยไม่หลุดตำแหน่ง (วัดจริงจากภาพ 1672×941)
 */

import type { ToneKey } from '@/lib/designTokens';
import type { Desk, DeskId, DeskState } from '@/lib/officeFloor';

export type RoomId = 'online' | 'recruit' | 'select' | 'ai';

/** โต๊ะไหนอยู่ห้องไหน — นิยามของเจ้าของ 24 ส.ค. 2569 (ห้ามยุบ/ย้ายเอง) */
export const ROOM_DESKS: Record<RoomId, readonly DeskId[]> = {
  online: ['content'],
  recruit: ['intake'],
  select: ['selection', 'follow', 'aftercare'],
  ai: ['aiCalls'],
};

/** สีประจำห้อง — ตามสีนีออนในภาพ render (ส้ม/ฟ้า/ม่วง/แดง) · ต้องเป็น key ของ HUD_HEX */
export const ROOM_TONE: Record<RoomId, ToneKey> = {
  online: 'orange',
  recruit: 'teal',
  select: 'violet',
  ai: 'danger',
};

/** `card` = หัวการ์ดสถิติ — ชื่อไทยห้ามต่อท้ายด้วย "Room" (เคยได้ "คัดสรร Room" อ่านเพี้ยน) */
export const ROOM_LABEL: Record<RoomId, { no: number; name: string; sub: string; card: string }> = {
  online: { no: 1, name: 'Online', sub: 'Content · Scraping · ปล่อยหน้าสาธารณะ', card: 'Online Room' },
  recruit: { no: 2, name: 'Recruit', sub: 'รับสมัครผ่านกล่องงาน', card: 'Recruit Room' },
  select: { no: 3, name: 'คัดสรร', sub: 'สมัครแล้ว · Follow · ดูแลหลังเริ่มงาน', card: 'ห้องคัดสรร' },
  ai: { no: 4, name: 'AI Call', sub: 'ส่งให้ Lumos โทรทั้งหมด', card: 'AI Call Room' },
};

/**
 * ตำแหน่งบนภาพ (% ของกว้าง/สูง) — `card` = มุมการ์ดสถิติ · `tag` = ป้ายเลขห้อง
 * วัดจากภาพจริง: Online บนซ้าย · Recruit บนขวา · AI Call ล่างซ้าย · คัดสรร ล่างขวา
 * ⚠️ เปลี่ยนภาพเมื่อไหร่ต้องวัดใหม่ — ค่าอยู่ที่เดียวนี้เท่านั้น
 */
export const ROOM_SPOTS: Record<
  RoomId,
  { card: { x: number; y: number; anchor: 'tl' | 'tr' | 'bl' | 'br' }; tag: { x: number; y: number } }
> = {
  online: { card: { x: 1.4, y: 6, anchor: 'tl' }, tag: { x: 25, y: 3.5 } },
  recruit: { card: { x: 98.6, y: 6, anchor: 'tr' }, tag: { x: 66, y: 3.5 } },
  ai: { card: { x: 1.4, y: 94, anchor: 'bl' }, tag: { x: 21, y: 51 } },
  select: { card: { x: 98.6, y: 94, anchor: 'br' }, tag: { x: 63, y: 54 } },
};

/** แถวข้อมูลบนการ์ดห้อง — value/unit มาจากโต๊ะจริง กดแล้วไปหน้างานของแถวนั้น */
export type RoomStatRow = {
  key: string;
  label: string;
  value: number;
  unit: string;
  tone?: ToneKey;
  alert?: boolean;
  href: string;
};

export type Room = {
  id: RoomId;
  no: number;
  name: string;
  sub: string;
  /** หัวการ์ดสถิติ */
  card: string;
  tone: ToneKey;
  state: DeskState;
  /** ประโยค "กำลังทำอะไร" — ของโต๊ะที่เร่งด่วนสุดในห้อง */
  doing: string;
  /** ของต้องลงมือรวมทั้งห้อง */
  backlog: number;
  rows: RoomStatRow[];
  /** ปลายทางหลักของห้อง (กดหัวการ์ด) */
  href: string;
};

/** ลำดับความเร่งของสถานะ — มากคือเร่ง · ห้องเอาค่าที่เร่งสุดในบรรดาโต๊ะของตัวเอง */
const STATE_RANK: Record<DeskState, number> = { blocked: 4, calling: 3, working: 2, idle: 1, off: 0 };

export const ROOM_STATE_WORD: Record<DeskState, string> = {
  blocked: 'มีของค้าง',
  calling: 'กำลังโทร',
  working: 'กำลังทำงาน',
  idle: 'ว่าง',
  off: 'ยังไม่เปิดใช้',
};

/** จำนวนแถวบนการ์ด — เกินนี้การ์ดสูงจนทับห้องในภาพ */
const MAX_ROWS = 4;

/** ชื่อสั้นของโต๊ะในห้องรวม (ห้องคัดสรรมี 3 โต๊ะ ต้องบอกว่าแถวไหนของโต๊ะไหน) */
const DESK_SHORT: Partial<Record<DeskId, string>> = {
  selection: 'คัดสรร / เสนองาน',
  follow: 'โทรติดตาม (Follow)',
  aftercare: 'ดูแลหลังเริ่มงาน',
};

const statRow = (desk: Desk, s: Desk['stats'][number]): RoomStatRow => ({
  key: `${desk.id}:${s.key}`,
  label: s.label,
  value: s.value,
  unit: s.unit,
  tone: s.tone,
  alert: s.alert,
  href: s.href ?? desk.href,
});

function deskRows(desk: Desk, soloRoom: boolean): RoomStatRow[] {
  if (soloRoom) {
    // ห้องที่มีโต๊ะเดียว: เอา stat ของโต๊ะมาตรง ๆ (คำ/หน่วย/สี ตามที่นิยามไว้แล้ว)
    return desk.stats.slice(0, MAX_ROWS).map((s) => statRow(desk, s));
  }
  // ห้องรวมหลายโต๊ะ: โต๊ะละหนึ่งแถว — ของค้างชนะ ไม่มีของค้างใช้ stat แรก
  const alertStat = desk.stats.find((s) => s.alert);
  const s = alertStat ?? desk.stats[0];
  if (!s) return [];
  return [
    {
      key: desk.id,
      label: DESK_SHORT[desk.id] ?? desk.label,
      value: alertStat ? desk.backlog || s.value : s.value,
      unit: s.unit,
      tone: alertStat ? 'danger' : s.tone,
      alert: Boolean(alertStat),
      href: desk.href,
    },
  ];
}

/**
 * ช่องที่เหลือของห้องรวม เติมด้วย stat สำคัญที่ยังไม่ได้โชว์
 * (เจ้าของสั่ง 24 ส.ค. 2569: *"อยากให้มีแค่ 4 ห้องแต่มี Dashboard บอกครบทั้งระบบ"*
 * — ถอดแถบ funnel แล้วเลขที่เคยอยู่บนนั้นต้องมีที่อยู่ ห้ามหายจากหน้าแรก)
 *
 * 🔴 เติมตามลำดับโต๊ะ/ลำดับ stat เดิมเสมอ — ห้ามสุ่ม/เรียงตามค่า ไม่งั้นแถวสลับที่ทุกครั้งที่โหลด
 */
function fillRows(members: readonly Desk[], taken: readonly RoomStatRow[]): RoomStatRow[] {
  const used = new Set(taken.map((r) => r.key));
  const extra: RoomStatRow[] = [];
  for (const desk of members) {
    for (const s of desk.stats) {
      const row = statRow(desk, s);
      if (used.has(row.key)) continue;
      // แถวที่เติมต้องบอกว่าเป็นของโต๊ะไหน (ห้องรวมมีหลายโต๊ะ คำซ้ำกันได้)
      extra.push(row);
      used.add(row.key);
      if (taken.length + extra.length >= MAX_ROWS) return extra;
    }
  }
  return extra;
}

/**
 * ประกอบห้องจากโต๊ะ — โต๊ะที่ API ไม่ส่งมาถูกข้าม · ห้องที่ไม่เหลือโต๊ะเลย = `off`
 */
export function buildRooms(desks: readonly Desk[]): Room[] {
  const byId = new Map(desks.map((d) => [d.id, d]));
  return (Object.keys(ROOM_DESKS) as RoomId[]).map((id) => {
    const members = ROOM_DESKS[id].map((d) => byId.get(d)).filter((d): d is Desk => Boolean(d));
    const label = ROOM_LABEL[id];
    if (members.length === 0) {
      return {
        id,
        no: label.no,
        name: label.name,
        sub: label.sub,
        card: label.card,
        tone: ROOM_TONE[id],
        state: 'off',
        doing: 'ยังไม่มีข้อมูลของห้องนี้',
        backlog: 0,
        rows: [],
        href: '/',
      };
    }
    const lead = [...members].sort((a, b) => STATE_RANK[b.state] - STATE_RANK[a.state])[0];
    const solo = members.length === 1;
    return {
      id,
      no: label.no,
      name: label.name,
      sub: label.sub,
      card: label.card,
      tone: ROOM_TONE[id],
      state: lead.state,
      doing: lead.doing,
      backlog: members.reduce((sum, d) => sum + (d.backlog || 0), 0),
      rows: (() => {
        const base = members.flatMap((d) => deskRows(d, solo)).slice(0, MAX_ROWS);
        if (solo || base.length >= MAX_ROWS) return base;
        return [...base, ...fillRows(members, base)];
      })(),
      href: lead.href,
    };
  });
}

/** เรียงห้องตามเลขที่เจ้าของตั้ง (1-4) — ใช้กับมุมมองรายการบนมือถือ */
export function roomsInOrder(rooms: readonly Room[]): Room[] {
  return [...rooms].sort((a, b) => a.no - b.no);
}

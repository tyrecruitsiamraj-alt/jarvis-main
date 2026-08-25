// @vitest-environment node
/**
 * ฉาก 4 ห้องบนหน้าแรก (Phase 2.12 + 10.1 · เจ้าของเคาะ 24 ส.ค. 2569)
 *
 * ด่านที่ห้ามหลุด:
 * 1. โต๊ะ 6 ตัวถูกจัดเข้า 4 ห้องตามนิยามเจ้าของเป๊ะ ๆ — ห้ามยุบ/ย้ายเอง
 * 2. ห้ามคิดเลขใหม่ — แถวการ์ดต้องมาจาก stat ของโต๊ะจริง (คำ/หน่วยเดิม)
 * 3. โต๊ะหายจาก API = ข้าม · ห้องไม่เหลือโต๊ะ = `off` ไม่ใช่เดา
 * 4. สถานะห้อง = ตัวเร่งสุดในบรรดาโต๊ะ (blocked ชนะ calling ชนะ working...)
 * 5. ตำแหน่งบนภาพครบทุกห้อง และเป็น % ที่อยู่ในกรอบภาพจริง
 */
import { describe, expect, it } from 'vitest';
import {
  ROOM_DESKS,
  ROOM_LABEL,
  ROOM_SPOTS,
  ROOM_TONE,
  buildRooms,
  roomsInOrder,
} from '../../src/lib/officeRooms.js';
import type { Desk } from '../../src/lib/officeFloor.js';

const desk = (over: Partial<Desk> & Pick<Desk, 'id'>): Desk => ({
  label: `โต๊ะ ${over.id}`,
  who: 'ทีม',
  state: 'working',
  doing: 'กำลังทำงาน',
  backlog: 0,
  oldestDays: null,
  tone: 'info',
  stats: [
    { key: 'a', label: 'ช่องแรก', value: 5, unit: 'ใบ', tone: 'info' },
    { key: 'b', label: 'ช่องสอง', value: 2, unit: 'สาย' },
  ],
  href: `/go/${over.id}`,
  ...over,
});

const ALL = [
  desk({ id: 'intake' }),
  desk({ id: 'aiCalls', state: 'calling', doing: 'กำลังโทร' }),
  desk({ id: 'selection' }),
  desk({ id: 'follow', state: 'idle', doing: 'ว่าง' }),
  desk({ id: 'aftercare', state: 'off', doing: 'ยังไม่เปิด' }),
  desk({ id: 'content' }),
];

describe('นิยามห้องของเจ้าของ', () => {
  it('4 ห้องครบ และโต๊ะทั้ง 6 ตัวมีห้องอยู่ ไม่ซ้ำห้อง', () => {
    const ids = Object.values(ROOM_DESKS).flat();
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect(ROOM_DESKS.select).toEqual(['selection', 'follow', 'aftercare']);
    expect(ROOM_DESKS.online).toEqual(['content']);
    expect(ROOM_DESKS.recruit).toEqual(['intake']);
    expect(ROOM_DESKS.ai).toEqual(['aiCalls']);
  });

  it('เลขห้อง 1-4 ไม่ซ้ำ · มีป้าย/สี/ตำแหน่งครบทุกห้อง', () => {
    const nos = Object.values(ROOM_LABEL).map((l) => l.no).sort();
    expect(nos).toEqual([1, 2, 3, 4]);
    // หัวการ์ด: ชื่อไทยห้ามต่อท้าย "Room" (เคยได้ "คัดสรร Room")
    expect(ROOM_LABEL.select.card).toBe('ห้องคัดสรร');
    expect(Object.values(ROOM_LABEL).every((l) => l.card.trim().length > 0)).toBe(true);
    for (const id of Object.keys(ROOM_DESKS) as (keyof typeof ROOM_DESKS)[]) {
      expect(ROOM_TONE[id]).toBeTruthy();
      const spot = ROOM_SPOTS[id];
      expect(spot.card.x).toBeGreaterThanOrEqual(0);
      expect(spot.card.x).toBeLessThanOrEqual(100);
      expect(spot.card.y).toBeGreaterThanOrEqual(0);
      expect(spot.card.y).toBeLessThanOrEqual(100);
      expect(spot.tag.x).toBeGreaterThan(0);
      expect(spot.tag.x).toBeLessThan(100);
    }
  });
});

describe('ประกอบห้องจากโต๊ะจริง', () => {
  const rooms = buildRooms(ALL);
  const byId = Object.fromEntries(rooms.map((r) => [r.id, r]));

  it('ห้องโต๊ะเดียวใช้ stat ของโต๊ะตรง ๆ — คำ/หน่วยเดิม ห้ามคิดใหม่', () => {
    expect(byId.recruit.rows[0]).toMatchObject({ label: 'ช่องแรก', value: 5, unit: 'ใบ' });
    expect(byId.recruit.rows[1]).toMatchObject({ label: 'ช่องสอง', unit: 'สาย' });
  });

  it('ห้องรวม 3 โต๊ะได้โต๊ะละแถวก่อน พร้อมชื่อโต๊ะกำกับ', () => {
    expect(byId.select.rows.slice(0, 3).map((r) => r.key)).toEqual([
      'selection',
      'follow',
      'aftercare',
    ]);
    expect(byId.select.rows[1].label).toContain('Follow');
    // แถวของแต่ละโต๊ะกดไปหน้าของโต๊ะนั้น ไม่ใช่หน้าเดียวกันหมด
    expect(new Set(byId.select.rows.slice(0, 3).map((r) => r.href)).size).toBe(3);
  });

  /**
   * 🔴 เจ้าของสั่ง 24 ส.ค. 2569: *"อยากให้มีแค่ 4 ห้องแต่มี Dashboard บอกครบทั้งระบบ"*
   * ถอดแถบ funnel แล้วเลขที่เคยอยู่บนนั้น (เช่น "ยังไม่มีคนแนะนำ") ต้องมีที่อยู่
   * ⇒ ช่องที่เหลือของห้องรวมต้องถูกเติมด้วย stat ที่ยังไม่ได้โชว์
   */
  it('ห้องรวมเติมช่องที่เหลือด้วย stat ที่ยังไม่ได้โชว์ — ไม่ปล่อยว่าง ไม่ซ้ำแถวเดิม', () => {
    const rows = byId.select.rows;
    expect(rows.length).toBe(4);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    // แถวที่เติมมาต้องเป็นของโต๊ะในห้องนี้เท่านั้น
    expect(rows[3].key.startsWith('selection:')).toBe(true);
  });

  it('เติมแถวแบบลำดับคงที่ — โหลดสองครั้งได้ผลเท่ากัน', () => {
    const a = buildRooms(ALL).find((r) => r.id === 'select')!;
    const b = buildRooms(ALL).find((r) => r.id === 'select')!;
    expect(a.rows.map((r) => r.key)).toEqual(b.rows.map((r) => r.key));
  });

  it('ห้องโต๊ะเดียวไม่ถูกเติมซ้ำ (stat เดิมพออยู่แล้ว)', () => {
    expect(new Set(byId.recruit.rows.map((r) => r.key)).size).toBe(byId.recruit.rows.length);
    expect(byId.recruit.rows.every((r) => r.key.startsWith('intake:'))).toBe(true);
  });

  it('สถานะห้อง = ตัวเร่งสุดของโต๊ะในห้อง', () => {
    expect(byId.ai.state).toBe('calling');
    // select มี working + idle + off → working ชนะ
    expect(byId.select.state).toBe('working');
  });

  it('ของค้างรวมทั้งห้อง และแถวของโต๊ะที่มีของค้างขึ้นสีแดง', () => {
    const withBacklog = buildRooms([
      ...ALL.filter((d) => d.id !== 'follow'),
      desk({
        id: 'follow',
        state: 'blocked',
        backlog: 7,
        stats: [
          { key: 'x', label: 'เลยนัด', value: 7, unit: 'ราย', tone: 'danger', alert: true },
          { key: 'y', label: 'วันนี้', value: 1, unit: 'ราย' },
        ],
      }),
    ]);
    const sel = withBacklog.find((r) => r.id === 'select')!;
    expect(sel.state).toBe('blocked');
    expect(sel.backlog).toBe(7);
    const followRow = sel.rows.find((r) => r.key === 'follow')!;
    expect(followRow.alert).toBe(true);
    expect(followRow.value).toBe(7);
  });

  it('🔴 โต๊ะหายจาก API = ห้อง off ไม่ใช่เดาเลข', () => {
    const partial = buildRooms(ALL.filter((d) => d.id !== 'content'));
    const online = partial.find((r) => r.id === 'online')!;
    expect(online.state).toBe('off');
    expect(online.rows).toEqual([]);
  });

  it('ไม่มีโต๊ะเลยก็ไม่ระเบิด — ทุกห้อง off', () => {
    const empty = buildRooms([]);
    expect(empty).toHaveLength(4);
    expect(empty.every((r) => r.state === 'off')).toBe(true);
  });

  it('เรียงตามเลขห้อง 1-4 สำหรับมุมมองรายการ', () => {
    expect(roomsInOrder(rooms).map((r) => r.no)).toEqual([1, 2, 3, 4]);
  });
});

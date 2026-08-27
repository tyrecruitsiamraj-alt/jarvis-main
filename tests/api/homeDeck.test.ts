import { describe, expect, it } from 'vitest';
import { buildStageTiles, deckStatusLine } from '@/lib/homeDeck';

describe('buildStageTiles — แถบ 6 ขั้นท้าย Command Deck', () => {
  it('ครบ 6 ขั้นเรียงตามสายพาน ทุกใบมีป้ายหน่วยและทางไป', () => {
    const tiles = buildStageTiles({});
    expect(tiles.map((t) => t.step)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const t of tiles) {
      expect(t.countLabel, t.key).toBeTruthy();
      expect(t.path.startsWith('/'), t.key).toBe(true);
    }
  });

  it('ยังไม่รู้ค่า = null (จอเขียน "—") ห้ามกลายเป็น 0', () => {
    expect(buildStageTiles({ requests: null }).find((t) => t.key === 'requests')?.count).toBeNull();
    expect(buildStageTiles({}).find((t) => t.key === 'requests')?.count).toBeNull();
  });

  it('จุดแดงเฉพาะถังต้องลงมือที่รู้ค่าและมีของ — ถังบอกปริมาณเยอะแค่ไหนก็ไม่แดง', () => {
    const tiles = buildStageTiles({ follow: 2, applicants: 0, requests: 293 });
    expect(tiles.find((t) => t.key === 'follow')?.urgent).toBe(true);
    expect(tiles.find((t) => t.key === 'applicants')?.urgent).toBe(false);
    expect(tiles.find((t) => t.key === 'requests')?.urgent).toBe(false);
    expect(buildStageTiles({}).every((t) => !t.urgent)).toBe(true);
  });
});

describe('deckStatusLine — ประโยคเดียวใต้หน้าปัด', () => {
  it('ของที่มีคนรอปลายทาง (เลยนัด) ชนะทุกอย่าง', () => {
    const r = deckStatusLine({ followPastDue: 1, applicantsUntouched: 9, slaBreached: 200 });
    expect(r.tone).toBe('danger');
    expect(r.text).toContain('1');
  });

  it('ไม่มีเลยนัด → ผู้สมัครค้างมาก่อนยอดสะสม SLA', () => {
    const r = deckStatusLine({ followPastDue: 0, applicantsUntouched: 3, slaBreached: 200 });
    expect(r.tone).toBe('warn');
    expect(r.text).toContain('ผู้สมัคร 3');
  });

  it('รู้ครบและว่างหมด = บอกว่าว่าง (โทน ok)', () => {
    expect(deckStatusLine({ followPastDue: 0, applicantsUntouched: 0, slaBreached: 0 }).tone).toBe(
      'ok',
    );
  });
});

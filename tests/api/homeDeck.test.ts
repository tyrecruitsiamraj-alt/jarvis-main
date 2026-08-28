import { describe, expect, it } from 'vitest';
import { buildStageTiles, deckStatusLine } from '@/lib/homeDeck';

describe('buildStageTiles — แถบลำดับงานท้าย Command Deck', () => {
  it('ครบทุกหน้าเรียงตามลำดับงาน ทุกใบมีป้ายหน่วยและทางไป', () => {
    const tiles = buildStageTiles({});
    /** 🔴 เหลือ 4 หน้า และไม่มีเลขขั้นแล้ว — ผูกด้วยคีย์ (เจ้าของสั่ง 28 ส.ค. 2569) */
    expect(tiles.map((t) => t.key)).toEqual(['requests', 'matching', 'follow', 'aftercare']);
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
    const tiles = buildStageTiles({ follow: 2, requests: 293, matching: 59 });
    expect(tiles.find((t) => t.key === 'follow')?.urgent).toBe(true);
    /** ถังบอกปริมาณ (ใบขอค้าง 293 · สายในคิว 59) ไม่ใช่ "ต้องลงมือวันนี้" ⇒ ห้ามแดง */
    expect(tiles.find((t) => t.key === 'requests')?.urgent).toBe(false);
    expect(tiles.find((t) => t.key === 'matching')?.urgent).toBe(false);
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

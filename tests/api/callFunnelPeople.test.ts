// @vitest-environment node
/**
 * drill-down "กดเลขแล้วเห็นชื่อ" ของแผง AI โทร (เจ้าของสั่ง 3 ก.ย. 2569:
 * ให้ทุกหน้าได้ ≥8 คะแนน · หน้าจับคู่งานถูกฉุดเพราะ *เห็นแต่ตัวเลข ไม่เห็นชื่อ*)
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. **key ของช่องสองฝั่งต้องเท่ากันเป๊ะ** — ถ้า `aiCallFlowCells()` มีช่องที่ฝั่ง
 *    server ไม่รู้จัก กดแล้วจะได้ 400 · ถ้า server มีเกิน ก็มีเงื่อนไขที่ไม่มีใครใช้
 *    (บทเรียนหน้าติดตาม: ยอดมาจากชุดหนึ่ง ชื่อมาจากอีกชุด แล้วเลขเถียงกัน)
 * 2. รายชื่อต้องไม่ dump payload ทั้งก้อน — ในนั้นมีบทพูดและเบอร์ฉุกเฉิน
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CALL_FUNNEL_CELL_KEYS } from '../../api/_handlers/lumos-call-funnel';
import { aiCallFlowCells } from '../../src/lib/aiCallFlowCells';
import { EMPTY_FUNNEL } from '../../src/lib/callFunnelApi';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('ช่องบนจอ ↔ เงื่อนไขฝั่ง server', () => {
  it('🔴 key ตรงกันเป๊ะทั้งสองฝั่ง', () => {
    const uiKeys = aiCallFlowCells(EMPTY_FUNNEL).map((c) => c.key);
    expect([...uiKeys].sort()).toEqual([...CALL_FUNNEL_CELL_KEYS].sort());
  });

  it('ทุกช่องบนจอมีทางกดดูรายชื่อ (ไม่มีช่องที่กดแล้ว 400)', () => {
    for (const c of aiCallFlowCells(EMPTY_FUNNEL)) {
      expect(CALL_FUNNEL_CELL_KEYS).toContain(c.key);
    }
  });
});

describe('ความปลอดภัยของรายชื่อ', () => {
  const handler = read('api/_handlers/lumos-call-funnel.ts');

  it('ไม่ส่ง payload ทั้งก้อนออกไป', () => {
    // ต้องหยิบทีละฟิลด์ (name/phone) ไม่ใช่ `payload: r.payload`
    expect(handler).not.toMatch(/payload:\s*r\.payload/);
    expect(handler).toContain('queuePayloadName(r.payload)');
    expect(handler).toContain('queuePayloadPhone(r.payload)');
  });

  it('มีเพดานจำนวนแถว (กันดึงคิวทั้งตาราง)', () => {
    expect(handler).toMatch(/Math\.min\(Math\.max\(limit, 1\), 500\)/);
  });

  it('ช่องที่ไม่รู้จัก = 400 ไม่ใช่คืนลิสต์ว่าง', () => {
    expect(handler).toMatch(/ไม่รู้จักช่อง/);
  });
});

describe('จอต้องบอกได้ว่าโหลดรายชื่อพลาด', () => {
  it('client โยน error ไม่กลืนเป็นลิสต์ว่าง', () => {
    const api = read('src/lib/callFunnelApi.ts');
    const fn = api.slice(api.indexOf('export async function fetchCallFunnelPeople'));
    expect(fn).toContain("throw new Error('โหลดรายชื่อไม่ได้')");
  });

  it('ป๊อปแยก "โหลดพลาด" ออกจาก "ไม่มีใครในช่องนี้"', () => {
    const panel = read('src/components/matching/AiCallFlowPanel.tsx');
    expect(panel).toContain('ไม่มีใครในช่องนี้');
    expect(panel).toContain('peopleError');
  });
});

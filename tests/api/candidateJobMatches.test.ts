// @vitest-environment node
/**
 * `api/_lib/candidateJobMatches.ts` — "คนนี้แมทอยู่กี่งาน" ค้นย้อนจาก card_id
 *
 * สามกติกาที่ห้ามพลาด:
 *   1. นับเฉพาะใบขอที่ผู้เรียกส่งมา (เปิดอยู่+ใน scope) — board_match_results
 *      เก็บของใบที่ปิดแล้วด้วย นับดิบ ๆ เลขโตเกินจริง (card 1805 = 113 ใบ)
 *   2. tier แดงไม่นับเป็นแมท (นิยามเดียวกับ recommendedCandidateCount)
 *   3. คนที่ขอมาแต่ไม่แมทอะไรเลยต้องได้ [] ไม่ใช่หายไปจาก map
 */
import { describe, expect, it, vi } from 'vitest';

const tierMapMock = vi.hoisted(() => vi.fn());
vi.mock('../../api/_lib/boardMatchStore.js', () => ({
  loadBoardMatchTierMap: tierMapMock,
}));

import { loadCandidateJobMatches } from '../../api/_lib/candidateJobMatches';

type Entry = { tiers: Array<{ tier: 'green' | 'yellow' | 'red'; cardId: number }>; computedAt: string };
const entry = (tiers: Entry['tiers']): Entry => ({ tiers, computedAt: '2026-08-12T00:00:00Z' });

describe('loadCandidateJobMatches', () => {
  it('นับเฉพาะใบขอเปิดที่ส่งมา — ใบปิดแล้วในผลแมทไม่ถูกนับ', async () => {
    tierMapMock.mockResolvedValue(
      new Map([
        ['job-open', entry([{ tier: 'green', cardId: 7 }])],
        ['job-closed', entry([{ tier: 'green', cardId: 7 }])],
      ]),
    );
    const got = await loadCandidateJobMatches([7], new Set(['job-open']));
    expect(got.get(7)).toEqual([{ jobId: 'job-open', tier: 'green' }]);
  });

  it('tier แดงไม่นับเป็นแมท · เขียว/เหลืองนับ', async () => {
    tierMapMock.mockResolvedValue(
      new Map([
        ['j1', entry([{ tier: 'red', cardId: 7 }])],
        ['j2', entry([{ tier: 'yellow', cardId: 7 }])],
        ['j3', entry([{ tier: 'green', cardId: 7 }])],
      ]),
    );
    const got = await loadCandidateJobMatches([7], new Set(['j1', 'j2', 'j3']));
    expect(got.get(7)?.map((m) => m.jobId).sort()).toEqual(['j2', 'j3']);
  });

  it('คนที่ไม่แมทอะไรเลยได้ [] — ไม่หายจาก map · คนที่ไม่ได้ขอไม่ติดมา', async () => {
    tierMapMock.mockResolvedValue(new Map([['j1', entry([{ tier: 'green', cardId: 9 }])]]));
    const got = await loadCandidateJobMatches([7, 9], new Set(['j1']));
    expect(got.get(7)).toEqual([]);
    expect(got.get(9)).toEqual([{ jobId: 'j1', tier: 'green' }]);
    expect(got.has(5)).toBe(false);
  });

  it('ขอลิสต์ว่าง = ไม่แตะฐานเลย (ไม่เรียก loadBoardMatchTierMap)', async () => {
    tierMapMock.mockClear();
    const got = await loadCandidateJobMatches([], new Set(['j1']));
    expect(got.size).toBe(0);
    expect(tierMapMock).not.toHaveBeenCalled();
  });
});

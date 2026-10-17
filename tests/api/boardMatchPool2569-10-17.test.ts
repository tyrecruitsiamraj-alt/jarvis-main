// @vitest-environment node
/**
 * ถังที่เอามาจับคู่งาน (เจ้าของ 17 ต.ค. 2569)
 * > *"เอาแค่ ไม่มีงาน reuse Drop ก็พอสำหรับการ match"*
 *
 * - กองจับคู่งาน = ไม่มีงาน (7) · Re Use (6) · Drop (5) เท่านั้น · To do / In process ไม่เอาแล้ว
 * - ตัดคนแจ้งเข้าแล้ว (ได้งานแล้วห้ามเสนองานใหม่)
 * - AI แมทค้นทีละถัง ไม่มีงาน → Re Use → Drop หยุดเมื่อถึงเป้า (อัตราที่ขอ × 3)
 * - ทุกเส้นที่แมท/ส่งโทรใช้กองเดียวกัน: เลือกคนส่ง AI โทร · ชุดโทร · นับต่อใบขอ · กรองผลแมทที่เก็บไว้
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetched: Array<{ columnId?: number; columnIds?: number[]; excludeInformed?: boolean }> = [];
const pools = new Map<number, number[]>();
const failColumns = new Set<number>();

vi.mock('../../api/_lib/boardCandidatesSql.js', async (orig) => {
  const real = await orig<typeof import('../../api/_lib/boardCandidatesSql.js')>();
  return {
    ...real,
    listBoardReadyCandidates: vi.fn(async (o: { columnId?: number; columnIds?: number[]; excludeInformed?: boolean }) => {
      fetched.push(o);
      const col = o.columnId ?? -1;
      if (failColumns.has(col)) throw new Error('board down');
      return (pools.get(col) ?? []).map((id) => ({
        card_id: id,
        column_label: String(col),
        first_name: `คน${id}`,
        job1_name: 'แม่บ้าน',
      }));
    }),
  };
});
vi.mock('../../api/_lib/ollamaClient.js', () => ({
  // ตอบ green ให้ทุกคนที่อยู่ใน prompt — เทสต์นี้ดูลำดับถัง ไม่ได้ดูคุณภาพ AI
  ollamaChat: vi.fn(async ({ messages }: { messages: Array<{ content: string }> }) => {
    const ids = [...messages[1].content.matchAll(/^#(\d+) \|/gm)].map((m) => Number(m[1]));
    return JSON.stringify({ matches: ids.map((id) => ({ id, tier: 'green', reason: '' })) });
  }),
}));
vi.mock('../../api/_lib/candidateSpecAnalyzer.js', () => ({
  getCachedCandidateSpec: () => ({
    request_no: 'R-1',
    job_family_code: 'X',
    job_family_label: 'แม่บ้าน',
    summary: '',
    must_have: [],
    adjacent_positions: [],
  }),
  analyzeCandidateSpecForJob: vi.fn(),
}));
vi.mock('../../api/_lib/jobFamilyLexicon.js', () => ({
  isJobFamilyCode: () => false,
  classifyJobFamily: () => null,
  selectShortlist: (scored: unknown[], n: number) => scored.slice(0, n),
}));
vi.mock('../../api/_lib/boardMatchStore.js', () => ({ saveBoardMatchResult: vi.fn(async () => {}) }));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({ enqueueLumosReminderForBoardMatch: vi.fn() }));
vi.mock('../../api/_lib/lumosDispatchMode.js', () => ({ isAutoDispatchEnabled: vi.fn(async () => false) }));

const { boardMatchColumnIds, isBoardMatchFromOldPool } = await import('../../api/_lib/boardCandidatesSql.js');
const { matchBoardCandidatesForJob } = await import('../../api/_lib/boardCandidateMatcher.js');
const { boardColumnBadge } = await import('../../src/lib/lumosDispatchApi.js');

beforeEach(() => {
  fetched.length = 0;
  pools.clear();
  failColumns.clear();
});

describe('กองจับคู่งาน = ไม่มีงาน · Re Use · Drop', () => {
  it('รหัสถังตามบอร์ดจริง เรียงตามลำดับค้น · ไม่มี To do / In process / Done / งานรายวัน / Checklist', () => {
    expect(boardMatchColumnIds()).toEqual([7, 6, 5]);
    for (const no of [1, 2, 3, 4, 8]) expect(boardMatchColumnIds()).not.toContain(no);
  });

  it('listBoardMatchPool ตัดคนแจ้งเข้าแล้วเสมอ', () => {
    const src = readFileSync('api/_lib/boardCandidatesSql.ts', 'utf8');
    expect(src).toMatch(
      /export function listBoardMatchPool[\s\S]*?listBoardReadyCandidates\(\{ columnIds: boardMatchColumnIds\(\), excludeInformed: true, limit \}\)/,
    );
  });

  it('ทุกเส้นที่แมท/ส่งโทรใช้กองเดียวกัน', () => {
    expect(readFileSync('api/_handlers/lumos-dispatch.ts', 'utf8')).toContain('return listBoardMatchPool(BOARD_POOL_LIMIT);');
    expect(readFileSync('api/_lib/callBatchDispatcher.ts', 'utf8')).toContain('await listBoardMatchPool(BOARD_POOL_LIMIT)');
    expect(readFileSync('api/_lib/boardAvailability.ts', 'utf8')).toContain('listBoardMatchPool(5000)');
    expect(readFileSync('api/_handlers/matching-board-candidates.ts', 'utf8')).toContain('await listBoardMatchPool(2000)');
    expect(readFileSync('api/_lib/boardCandidateMatcher.ts', 'utf8')).not.toContain('boardPrimaryColumnId');
  });

  it('ป้ายที่มาของ Drop ขึ้นบนรายชื่อเลือกส่งเอง', () => {
    expect(boardColumnBadge('Drop')?.text).toBe('Drop');
  });
});

describe('AI แมทค้นทีละถัง ไม่มีงาน → Re Use → Drop', () => {
  it('ถังแรกพอเป้าแล้ว = ไม่ค้นถังถัดไป', async () => {
    pools.set(7, [1, 2, 3]);
    const r = await matchBoardCandidatesForJob('J1', { position_units: 1, position_name: 'แม่บ้าน' });
    expect(fetched.map((f) => f.columnId)).toEqual([7]);
    expect(fetched.every((f) => f.excludeInformed === true)).toBe(true);
    expect(r.fallback_used).toBe(false);
    expect(r.matches.map((m) => m.card_id)).toEqual([1, 2, 3]);
  });

  it('ไม่ถึงเป้า = ค้นต่อจนครบ 3 ถัง · ผลถังก่อนอยู่หน้า · ไม่แตะ To do', async () => {
    pools.set(7, [1, 2]);
    pools.set(6, [3]);
    pools.set(5, [4, 5, 6, 7]);
    pools.set(2, [99]);
    const r = await matchBoardCandidatesForJob('J2', { position_units: 2, position_name: 'แม่บ้าน' });
    expect(fetched.map((f) => f.columnId)).toEqual([7, 6, 5]);
    expect(r.fallback_used).toBe(true);
    expect(r.pool_size).toBe(7);
    expect(r.fallback_pool_size).toBe(5);
    expect(r.matches.map((m) => m.card_id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('ถังถัดไปพัง ผลถังก่อนไม่หาย', async () => {
    pools.set(7, [1]);
    failColumns.add(6);
    pools.set(5, [2]);
    const r = await matchBoardCandidatesForJob('J3', { position_units: 1, position_name: 'แม่บ้าน' });
    expect(r.matches.map((m) => m.card_id)).toEqual([1, 2]);
  });
});

describe('ผลแมทที่คิดจากกองเดิม (To do) ต้องแมทใหม่ 1 รอบ', () => {
  it('ก่อนเวลาเปลี่ยนกอง / อ่านเวลาไม่ได้ = เก่า · หลังจากนั้น = ใช้ได้', () => {
    expect(isBoardMatchFromOldPool('2026-10-16T09:00:00Z')).toBe(true);
    expect(isBoardMatchFromOldPool(null)).toBe(true);
    expect(isBoardMatchFromOldPool('2026-10-17T11:00:00Z')).toBe(false);
  });

  it('worker สแกนเจอผลเก่า = เข้าคิวแมทใหม่ (ไม่วิเคราะห์สเปคซ้ำ) · เปิดใบดู = ดันหัวคิว โชว์ผลเดิมระหว่างรอ', () => {
    const worker = readFileSync('api/_lib/matchPrecomputeWorker.ts', 'utf8');
    expect(worker).toMatch(/else if \(isBoardMatchFromOldPool\(entry\.computedAt\)\) \{[\s\S]*?items\.push\(\{ job, refresh: false \}\);/);
    expect(worker).toContain('const eligible = isRefresh || opts.rematch === true');
    const handler = readFileSync('api/_handlers/matching-board-candidates.ts', 'utf8');
    expect(handler).toContain('const rematch = !refresh && stored != null && isBoardMatchFromOldPool(stored.computedAt);');
    expect(handler).toContain('if (stored && !refresh && !rematch) {');
    expect(handler).toMatch(/enqueuePrecomputeJobs\([\s\S]*?\{\s*refresh,\s*rematch,\s*front: true,/);
  });
});

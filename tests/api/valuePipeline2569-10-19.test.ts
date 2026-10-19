// @vitest-environment node
/** หน้าความคุ้มค่า: ใบขอครบเส้น 4 แท็บ (เจ้าของ 19 ต.ค. 2569 · ช้า = เกิน 24 ชม. · ไม่มีข้อมูล = บอก ห้าม 0) */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildStageSla, computeOutcome, informedAfterAi, onTimePct, stuckByOwner, NO_OWNER } from '../../src/lib/valuePipeline';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const H = 3_600_000;
let id = 0;
const fact = (o: Partial<RecruitAppFact>): RecruitAppFact => ({
  id: `a${++id}`,
  createdAt: new Date(NOW - 72 * H).toISOString(),
  jobId: 'J1',
  channelLabel: null,
  referralSource: 'facebook',
  position: null,
  phoneOk: true,
  calledByAi: false,
  calledByStaff: false,
  firstCalledAt: null,
  aiAnswer: null,
  aiAnswerAt: null,
  staffAnswer: null,
  staffAnswerAt: null,
  staffLastAt: null,
  contact: null,
  contactBy: null,
  logOk: null,
  logReason: null,
  logAt: null,
  appointmentAt: null,
  attendance: null,
  onBoard: null,
  ...o,
});
const at = (h: number) => new Date(NOW - h * H).toISOString();

describe('คุ้มไหม', () => {
  it('แจ้งเข้าที่ AI เคยโทรภายใน 60 วันก่อน (หรือวันเดียวกัน) · เบอร์ซ้ำนับครั้งเดียว', () => {
    const calls = new Map([
      ['811111111', [Date.parse('2026-10-01T03:00:00Z')]],
      ['822222222', [Date.parse('2026-07-01T03:00:00Z')]], // เกิน 60 วัน
      ['833333333', [Date.parse('2026-10-11T03:00:00Z')]], // หลังแจ้งเข้า
    ]);
    const r = informedAfterAi(
      [
        { phone9: '811111111', day: '2026-10-10' },
        { phone9: '811111111', day: '2026-10-12' },
        { phone9: '822222222', day: '2026-10-10' },
        { phone9: '833333333', day: '2026-10-10' },
      ],
      calls,
    );
    expect(r).toEqual({ informed: 3, fromAi: 1 });
  });
  it('ต้นทุนต่อคน/ต่อใบ · ไม่มีคน/ใบ = null (ห้ามหารศูนย์เป็น 0)', () => {
    const o = computeOutcome({ month: '2026-10', aiCalls: 10, informed: 5, informedFromAi: 4, requestsIn: 9, requestsClosed: 2, systemCost: 80_000, staffCost: 120_000 });
    expect(o.costPerInform).toBe(20_000);
    expect(o.costPerClosed).toBe(100_000);
    expect(computeOutcome({ ...o, informedFromAi: 0, requestsClosed: 0 }).costPerInform).toBeNull();
  });
});

describe('ช้าที่ตรงไหน', () => {
  const facts = [
    fact({ calledByAi: true, firstCalledAt: at(71), aiAnswer: 'said_yes', aiAnswerAt: at(71), staffLastAt: at(60) }), // AI ทัน · คนโทรต่อทัน (11 ชม.)
    fact({ calledByAi: true, firstCalledAt: at(30), aiAnswer: 'said_yes', aiAnswerAt: at(30) }), // AI ไม่ทัน (42 ชม.) · คนยังไม่โทร ค้าง
    fact({}), // ยังไม่มีใครโทร ค้าง
    fact({ channelLabel: 'iRecruit' }), // ใบ iRecruit — AI ไม่โทรเอง ไม่นับค้าง
    fact({ logOk: true, logAt: at(50), appointmentAt: at(30) }), // นัดเลยวัน ยังไม่ลงผล
  ];
  const stages = buildStageSla(facts, [{ jobId: 'J1', day: '2026-10-10', releasedAt: null, remaining: 1, filled: 0 }], NOW);
  const s = (k: string) => stages.find((x) => x.key === k)!;
  it('AI · คนโทรต่อ · มา/ไม่มา · ประกาศ', () => {
    expect([s('aiCall').done, s('aiCall').onTime, s('aiCall').stuck]).toEqual([2, 1, 2]);
    expect([s('staffCall').done, s('staffCall').onTime, s('staffCall').stuck]).toEqual([1, 1, 1]);
    expect(s('attendance').stuck).toBe(1);
    expect(s('release').stuck).toBe(1);
  });
  it('ขั้นที่ยังไม่มีข้อมูล = null + เหตุ (ห้าม 0)', () => {
    for (const k of ['match', 'inform', 'follow', 'replace', 'aftercare']) {
      expect(s(k).done).toBeNull();
      expect(s(k).missing).toBeTruthy();
    }
    expect(onTimePct(s('follow'))).toBeNull();
    expect(onTimePct(s('aiCall'))).toBe(50);
  });
  it('ค้างที่ใคร — ไม่มีเจ้าของแยกแถว', () => {
    const owners = stuckByOwner(stages, facts, new Map([['J1', 'แป๋ม']]));
    expect(owners[0].owner).toBe('แป๋ม');
    expect(stuckByOwner(stages, facts, new Map())[0].owner).toBe(NO_OWNER);
  });
});

describe('หน้าจอ + API', () => {
  it('หน้า /value มี 4 แท็บ · API สิทธิ์เดียวกับหน้าความคุ้มค่า · ใบขอปิดไม่นับค้าง', () => {
    const page = readFileSync('src/pages/value/ValueCasePage.tsx', 'utf8');
    for (const t of ['คุ้มไหม', 'ช้าที่ตรงไหน', 'ใบขอนี้ติดอะไร', 'จุดบอด']) expect(page).toContain(`>${t}</TabsTrigger>`);
    const api = readFileSync('api/_handlers/value-pipeline.ts', 'utf8');
    expect(api).toContain("if (!canSeeValueCase(req.user)) return sendError(res, 404, 'Not found');");
    expect(api).toContain('(!f.jobId || openIds.has(f.jobId))');
    expect(readFileSync('api/_handlers/registry.ts', 'utf8')).toContain("'/api/value-pipeline': valuePipelineHandler");
  });
});

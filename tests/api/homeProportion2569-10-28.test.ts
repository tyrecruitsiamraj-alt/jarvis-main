/**
 * แท็บ "สัดส่วน" หน้าหลัก (เจ้าของ 28 ต.ค. 2569)
 * Choice: เรื่องครบตามสั่ง + จับคู่งาน · AI ไม่ติดแล้วคนตาม · ทางเข้า · ขั้นที่ยังเป็นคน · ไม่มีเลขรวม · % = AI ได้โทร รวมที่คนตามต่อ
 * ชื่อแท็บ "สัดส่วน" ("เอาคำว่า สัดส่วน ไม่เอา Aiกับคน")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildProportionGroups,
  ladderAddsUp,
  matchingProportionRow,
  proportionCoverage,
  proportionStuck,
  summarizeAftercarePeople,
  summarizeFollowLane,
  proportionPct,
  proportionTag,
  recruitProportionRows,
  type ProportionPayload,
  type ProportionRow,
} from '../../src/lib/homeProportion';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';
import { proportionAppReasonsSql, proportionEntrySql, proportionFollowRowsSql } from '../../api/_lib/homeProportionSql';

const read = (p: string) => readFileSync(p, 'utf8');

const fact = (over: Partial<RecruitAppFact>): RecruitAppFact =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-10-05T03:00:00Z',
    jobId: 'OPL6910001',
    channelLabel: 'Facebook · Group',
    referralSource: null,
    position: 'พนักงานขับรถ',
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
    ...over,
  }) as RecruitAppFact;

const row = (ai: number, both: number, staff: number, none = 0): ProportionRow => ({ key: 'x', name: 'x', note: '', ai, both, staff, none });

describe('% = AI ได้โทร รวมที่คนตามต่อ', () => {
  it('(AI + ทั้งสองทาง) ÷ งานที่ทำแล้ว · ยังไม่มีงาน = null ไม่ใช่ 0%', () => {
    expect(proportionPct(row(758, 302, 17, 624))).toBe(98);
    expect(proportionPct(row(0, 0, 277, 199))).toBe(0);
    expect(proportionPct(row(0, 0, 0, 5))).toBeNull();
  });
  it('ป้าย: ≥60 AI ทำหลัก · 30–59 แบ่งกัน · ต่ำกว่า 30 คนทำหลัก · 0 ยังไม่มี AI · ไม่มีงาน', () => {
    expect(proportionTag(row(60, 0, 40))).toBe('ai');
    expect(proportionTag(row(30, 0, 70))).toBe('mix');
    expect(proportionTag(row(10, 0, 90))).toBe('staff');
    expect(proportionTag(row(0, 0, 61))).toBe('noAi');
    expect(proportionTag(row(0, 0, 0))).toBe('empty');
  });
});

const stepOf = (l: { steps: Array<{ key: string; value: number; parts: Array<{ key: string; label: string; value: number }> }> }, key: string) =>
  l.steps.find((x) => x.key === key)!;

describe('โครงแผงของแต่ละเรื่อง (เจ้าของ 29 ต.ค. 2569)', () => {
  it('Prescreen: รายชื่อทั้งหมด = โทรแล้ว + รอโทร + ไม่โทร · โทรแล้ว = ติดต่อสำเร็จ + ไม่สำเร็จ · สรุปไม่ได้อยู่ในติดต่อสำเร็จ', () => {
    const apps = [
      fact({ calledByAi: true, aiAnswer: 'no_pickup' }),
      fact({ calledByAi: true, calledByStaff: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-10-05T04:00:00Z', logOk: true, appointmentAt: '2026-10-07T02:00:00Z', attendance: 'showed', screening: 'passed', informed: true }),
      fact({ calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-10-05T04:00:00Z' }),
      fact({ calledByAi: true, aiAnswer: 'talked_unclear' }),
      fact({ calledByStaff: true, logOk: false }),
      fact({}),
    ];
    const [pre, after, appt] = recruitProportionRows(apps);
    expect([pre.ai, pre.both, pre.staff, pre.none]).toEqual([3, 1, 1, 1]);
    const l = pre.ladder!;
    expect(ladderAddsUp(l)).toBe(true);
    expect(l.steps.map((x) => x.title)).toEqual(['โทรไปแล้ว', 'ติดต่อสำเร็จ', 'ติดต่อไม่สำเร็จ', 'รอโทร', 'ไม่โทร']);
    expect(stepOf(l, 'talked').parts.map((p) => [p.label, p.value])).toEqual([['สนใจ', 2], ['สรุปไม่ได้', 1]]);
    expect(stepOf(l, 'notTalked').parts.map((p) => [p.label, p.value])).toEqual([['ไม่รับสาย', 1], ['คนโทรเอง ติดต่อไม่ได้', 1]]);
    // โทรหลัง Prescreen: คนสนใจ 2 → ติดต่อสำเร็จ 1 · รอโทร 1
    expect(ladderAddsUp(after.ladder!)).toBe(true);
    expect([stepOf(after.ladder!, 'talked').value, stepOf(after.ladder!, 'waiting').value]).toEqual([1, 1]);
    // นัดได้: จากที่ติดต่อสำเร็จทั้งหมด → นัดได้ 1 (มา 1) · บรรทัดผ่าน/แจ้งเข้า
    const al = appt.ladder!;
    expect(al.totalLabel).toBe('ติดต่อสำเร็จทั้งหมด');
    expect(ladderAddsUp(al)).toBe(true);
    expect(stepOf(al, 'booked').parts.map((p) => [p.label, p.value])).toEqual([['มาตามนัด', 1]]);
    expect(al.steps[0].sub).toBe('มาแล้ว ผ่าน 1 · แจ้งเข้า ERP 1');
  });
  it('🔴 ไม่โทรต้องมีเหตุทุกใบ — เหตุจากฐาน · ใบขอปิด · หาไม่เจอ = ยังไม่รู้เหตุ (ไม่หาย) · อ่านใบขอไม่ได้ ไม่เดาว่าปิด', () => {
    const id = (k: number) => `0000000${k}-1111-4111-8111-111111111111`;
    const apps = [
      fact({ id: id(1), jobId: 'siamraj-sql:OPL6910002' }),
      fact({ id: id(2), jobId: 'siamraj-sql:OPL6910099' }),
      fact({ id: id(3), jobId: 'siamraj-sql:OPL6910099' }),
      fact({ id: id(4), jobId: 'siamraj-sql:OPL6910099', aiQueued: true }),
      fact({ id: id(5), jobId: 'siamraj-sql:OPL6910099' }),
      fact({ id: id(6), phoneOk: false }),
    ];
    const flags = [
      { id: id(2), jobId: 'siamraj-sql:OPL6910099', claimed: false, reason: 'dup' as const, blockReason: null },
      { id: id(5), jobId: 'siamraj-sql:OPL6910099', claimed: true, reason: null, blockReason: null },
    ];
    const l = recruitProportionRows(apps, flags, new Set(['siamraj-sql:OPL6910099']))[0].ladder!;
    expect(ladderAddsUp(l)).toBe(true);
    expect(stepOf(l, 'waiting').parts.map((p) => [p.key, p.value])).toEqual([['aiQueued', 1], ['claimed', 1]]);
    expect(stepOf(l, 'notCalled').parts.map((p) => [p.label, p.value])).toEqual([
      ['ใบขอปิดแล้ว', 1],
      ['ซ้ำ iRecruit ภายใน 14 วัน AI ไม่โทรเอง', 1],
      ['ยังไม่รู้เหตุ', 1],
      ['เบอร์ผิด โทรไม่ได้', 1],
    ]);
    const noFeed = recruitProportionRows(apps, flags, null)[0].ladder!;
    expect(stepOf(noFeed, 'notCalled').parts.find((p) => p.label === 'ใบขอปิดแล้ว')).toBeUndefined();
  });
  it('ติดตาม (นับสาย): โทรแล้ว = ได้คำตอบ + ติดต่อไม่ได้ · รอโทร (ตามเวลา / เลยเวลา) · ไม่โทร · ยกเลิกบอกใต้สมการ', () => {
    const base = { aiUnreached: false, dispatch: null, queueStatus: null };
    const s = summarizeFollowLane(
      [
        { ...base, ai: true, staff: false, bucket: 'went', mode: 'ai', queueStatus: 'completed' },
        { ...base, ai: true, staff: true, bucket: 'failed', mode: 'ai', aiUnreached: true },
        { ...base, ai: false, staff: true, bucket: 'unclear', mode: 'manual' },
        { ...base, ai: false, staff: false, bucket: 'waiting', mode: 'ai', queueStatus: 'pending', future: true },
        { ...base, ai: false, staff: false, bucket: 'waiting', mode: 'ai', queueStatus: 'pending' },
        { ...base, ai: false, staff: false, bucket: 'waiting', mode: 'manual' },
        { ...base, ai: false, staff: false, bucket: 'waiting', mode: 'manual', backfilled: true },
        { ...base, ai: false, staff: false, bucket: 'waiting', mode: 'ai', dispatch: 'off' },
      ],
      7,
    );
    const l = s.ladder!;
    expect([s.ai, s.both, s.staff, s.none, s.aiUnreached]).toEqual([1, 1, 1, 5, 1]);
    expect(ladderAddsUp(l)).toBe(true);
    expect(stepOf(l, 'answered').parts.map((p) => p.label)).toEqual(['ไป', 'สรุปไม่ได้']);
    expect(stepOf(l, 'unreached').value).toBe(1);
    expect(stepOf(l, 'waiting').parts.map((p) => [p.key, (p as { stuck?: boolean }).stuck ?? false])).toEqual([
      ['aiLater', false],
      ['aiNoResult', true],
      ['staff', true],
    ]);
    expect(stepOf(l, 'notCalled').parts.map((p) => p.label)).toEqual(['ลงย้อนหลัง ดึงมาตอนเวลาโทรผ่านไปแล้ว', 'ปิดส่งอัตโนมัติอยู่']);
    expect(l.excluded).toEqual({ label: 'ยกเลิก ไม่นับ', value: 7 });
  });
  it('ดูแลหลังเริ่มงาน นับเป็นคน: 3 หัวข้อ Healthy/Warning/High Risk ต่อคนที่คุยได้ · รอบเลยแล้ว/ยังไม่ตั้งรอบ = ค้าง', () => {
    const p = (o: Partial<Parameters<typeof summarizeAftercarePeople>[0][number]>) => ({
      aiCalled: false, result: null, expectation: null, supervisor: null, escalation: null, hasRounds: true, upcoming: false, overdue: false, ...o,
    });
    const s = summarizeAftercarePeople([
      p({ result: 'working', expectation: 'healthy', supervisor: 'healthy', escalation: 'healthy' }),
      p({ aiCalled: true, result: 'issue', expectation: 'warning', supervisor: 'high_risk', escalation: 'healthy' }),
      p({ result: 'resigned' }),
      p({ aiCalled: true }),
      p({ upcoming: true }),
      p({ overdue: true }),
      p({ hasRounds: false }),
    ]);
    const l = s.ladder!;
    expect(l.unit).toBe('คน');
    expect(ladderAddsUp(l)).toBe(true);
    expect([s.ai, s.both, s.staff, s.none]).toEqual([1, 1, 2, 3]);
    expect(stepOf(l, 'supervisor').parts.map((x) => [x.label, x.value])).toEqual([['Healthy', 1], ['High Risk', 1]]);
    expect(stepOf(l, 'notTalked').parts.map((x) => x.label)).toEqual(['ลาออก', 'AI โทรแล้ว ยังไม่มีคนลงผล']);
    const stuck = proportionStuck([{ key: 'f', title: 'f', rows: [{ key: 'aftercare', name: 'ดูแลหลังเริ่มงาน', note: '', ai: 0, both: 0, staff: 0, none: 0, ladder: l }] }]);
    expect(stuck.map((x) => x.label).sort()).toEqual(['AI โทรแล้ว ยังไม่มีคนลงผล', 'ยังไม่ตั้งรอบโทร', 'เลยรอบแล้ว ยังไม่โทร'].sort());
  });
  it('จับคู่งาน แบบเดียวกับ Prescreen จากรายงานผลโทร · ไม่มีรายงาน = 0 ไม่หาย', () => {
    const r = matchingProportionRow({
      funnel: [],
      extra: [],
      cols: [],
      cells: [
        { bu: 'LBD', seg: 'ai', col: 'interested', n: 3 },
        { bu: 'LBD', seg: 'ai', col: 'noAnswer', n: 2 },
        { bu: 'LBD', seg: 'staff', col: 'notInterested', n: 1 },
        { bu: 'LBD', seg: 'notCalled', col: 'noResult', n: 4 },
      ],
    });
    expect([r.ai, r.staff, r.none]).toEqual([5, 1, 4]);
    expect(ladderAddsUp(r.ladder!)).toBe(true);
    expect(stepOf(r.ladder!, 'talked').value).toBe(4);
    expect(matchingProportionRow(null).ladder!.total).toBe(0);
  });
  it('ทุกก้อนอยู่เสมอ · ถอดก้อน "ขั้นที่ยังเป็นคน 100%" แล้ว', () => {
    const g = buildProportionGroups({ apps: null, payload: null });
    expect(g.map((x) => x.title)).toEqual(['งานสรรหา', 'ติดตามและดูแล', 'ทางเข้าของงาน']);
    expect(g.flatMap((x) => x.rows.map((r) => r.name))).toEqual([
      'AI โทร Prescreen',
      'โทรหลัง Prescreen',
      'นัดได้',
      'จับคู่งาน',
      'ติดตามคนเริ่มงาน',
      'ติดตามส่งคนแทน',
      'ดูแลหลังเริ่มงาน',
      'ผู้สมัครเข้าระบบ',
    ]);
  });
  it('ทางเข้า: ระบบ = สมัครเอง + iRecruit + So Scraping · คน = คีย์/นำเข้า · ไม่มีแถวใบส่งคนแทน/โพสต์ประกาศ (เจ้าของ 29 ต.ค. 2569)', () => {
    const payload: ProportionPayload = {
      generated_at: '',
      from: '2026-10-01',
      to: '2026-10-28',
      bu: null,
      follow: null,
      entry: { selfApply: 866, irecruit: 496, soScraping: 0, staffKeyed: 374 },
      errors: {},
    };
    const entry = buildProportionGroups({ apps: [], payload }).find((x) => x.key === 'entry')!.rows;
    expect([entry[0].ai, entry[0].staff, entry[0].aiLabel]).toEqual([1362, 374, 'ระบบ']);
    expect(entry.map((r) => r.key)).toEqual(['apps']);
  });
});

describe('3 ข้อจากรีวิวหน้าหลัก (เจ้าของ "ทำหมดเลย" 28 ต.ค. 2569)', () => {
  it('ทั้งหมด % = AI ได้โทร ÷ ทั้งหมดรวมที่ยังไม่โทร · ไม่มีส่วนที่ยังไม่โทร = ไม่ขึ้น', () => {
    expect(proportionCoverage(row(765, 302, 17, 623))).toBe(63);
    expect(proportionCoverage(row(10, 0, 5, 0))).toBeNull();
  });
  it('งานที่ค้างอยู่ = ช่อง stuck ของทุกแถว มากไปน้อย', () => {
    const g = buildProportionGroups({
      apps: [fact({ id: '00000001-1111-4111-8111-111111111111', calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-10-05T04:00:00Z' })],
      payload: null,
    });
    expect(proportionStuck(g)).toEqual([{ rowKey: 'afterPrescreen', rowName: 'โทรหลัง Prescreen', label: 'ยังไม่มีใครเก็บ', value: 1, unit: 'คน' }]);
  });
  it('ติดตามสองแท็บชุดเดียวกัน: ช่วงเต็ม (followPlanBounds) · ตัดยกเลิกด้วยช่องผล ไม่ใช่ cancelled_at', () => {
    const sql = proportionFollowRowsSql();
    expect(sql).not.toMatch(/where f.cancelled_at is null/);
    expect(sql).toContain('(f.created_at > f.scheduled_at) as backfilled');
    const h = read('api/_handlers/home-ai-share.ts');
    expect(h).toContain('followPlanBounds(win).start,');
    expect(h).toContain(": inLane.filter((r) => followLedgerBucket(r, derived) !== 'cancelled');");
  });
});

describe('SQL + เส้น + หน้า', () => {
  it('ติดตาม: แถวสายที่โทรจริง ไม่นับยกเลิก แยก 3 ก้อน · ช่องผลตัวเดียวกับการ์ดผลโทร · AI ไม่ติด = ผลไม่ใช่การคุย', () => {
    const sql = proportionFollowRowsSql();
    expect(sql).toContain("when f.topic = $4::text then 'aftercare'");
    expect(sql).toContain("when f.follow_team = 'replacement' then 'replacement'");
    expect(sql).toContain('(f.staff_called_at is not null) as staff');
    expect(sql).toContain('as ledger_bucket');
    expect(sql).toContain("not in ('confirmed','acknowledged','declined','reschedule_requested')");
    expect(read('api/_handlers/home-ai-share.ts')).toContain('bucket: followLedgerBucket(r, derived),');
  });
  it('เหตุของใบสมัคร: ลำดับเดียว ใบละเหตุ · ไม่นับใบที่เจ้าหน้าที่โทรแล้ว', () => {
    const sql = proportionAppReasonsSql();
    const order = ["then 'dup'", "then 'soScraping'", "then 'keyed'", "then 'noJob'", "then 'block'", "then 'suppressed'", "then 'noIncome'"].map((k) => sql.indexOf(k));
    expect(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1]))).toBe(true);
    expect(sql).toMatch(/and not \(/);
  });
  it('ทางเข้า: ไม่นับใบที่ยกเลิกข้อมูล · ไม่นับใบส่งคนแทน/โพสต์แล้ว', () => {
    const sql = proportionEntrySql();
    expect(sql.match(/not exists \(select 1 from .*application_cancellations/g)?.length).toBe(4);
    expect(sql).not.toContain('replace_sync');
    expect(sql).not.toContain('post_orders');
  });
  it('เส้น ?proportion=1 · หน้าหลักมีแท็บ "สัดส่วน" (ไม่ใช้คำว่า AI กับคน)', () => {
    expect(read('api/_handlers/home-ai-share.ts')).toContain('if (q.proportion !== undefined) {');
    const page = read('src/pages/HomeOverviewPage.tsx');
    expect(page).toContain('<TabsTrigger value="proportion" data-testid="home-tab-proportion">');
    expect(page).toMatch(/>\s*สัดส่วน\s*</);
    expect(page).not.toContain('AI กับคน');
    expect(read('src/components/home-overview/ProportionTab.tsx')).not.toContain('AI กับคน');
  });
});

describe('หน้าตาแท็บสัดส่วน (เจ้าของ 29 ต.ค. 2569)', () => {
  it('แต่ละแถวแบ่ง AI % กับ คน % (รวมกัน 100) · งานค้างเป็น Dropdown เลือกทีละเรื่อง มีแท่ง', () => {
    const tab = read('src/components/home-overview/ProportionTab.tsx');
    expect(tab).toContain("side('คน', show ? `${100 - (pct ?? 0)}%` : '—', r.staff");
    expect(tab).toContain('data-testid="proportion-stuck-select"');
    expect(tab).toContain('function StuckBoard(');
    expect(tab).not.toContain('<ul className="flex flex-wrap gap-2">');
  });
});

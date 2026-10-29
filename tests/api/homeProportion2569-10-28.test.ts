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
  proportionCoverage,
  proportionStuck,
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
  it('ป้าย: ≥60 AI ทำหลัก · 30–59 แบ่งกัน · ต่ำกว่า 30 คนทำหลัก · 0 ยังไม่มี AI · ไม่มีงาน · วัดไม่ได้', () => {
    expect(proportionTag(row(60, 0, 40))).toBe('ai');
    expect(proportionTag(row(30, 0, 70))).toBe('mix');
    expect(proportionTag(row(10, 0, 90))).toBe('staff');
    expect(proportionTag(row(0, 0, 61))).toBe('noAi');
    expect(proportionTag(row(0, 0, 0))).toBe('empty');
    expect(proportionTag({ ...row(0, 0, 0), unknown: true })).toBe('unknown');
  });
});

describe('สรรหา 3 ขั้น + ขั้นที่ยังเป็นคน (จากใบสมัครชุดเดียวกับหน้าหลัก)', () => {
  it('Prescreen แยก AI/ทั้งสองทาง/คน/ยังไม่โทร ครบทุกใบ · โทรหลัง Prescreen นับคนที่บอก AI ว่าสนใจ · นัด = คนทำ', () => {
    const apps = [
      fact({ calledByAi: true }),
      fact({ calledByAi: true, calledByStaff: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-10-05T04:00:00Z', staffLastAt: '2026-10-05T06:00:00Z', logOk: true, appointmentAt: '2026-10-07T02:00:00Z', attendance: 'showed', screening: 'passed', informed: true }),
      fact({ calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-10-05T04:00:00Z' }),
      fact({ calledByStaff: true }),
      fact({}),
    ];
    const { recruit, human } = recruitProportionRows(apps);
    const [pre, after, appt] = recruit;
    expect([pre.ai, pre.both, pre.staff, pre.none]).toEqual([2, 1, 1, 1]);
    expect(pre.ai + pre.both + pre.staff + pre.none).toBe(apps.length);
    expect([after.ai, after.staff, after.none]).toEqual([0, 1, 1]);
    expect([appt.ai, appt.staff]).toEqual([0, 1]);
    expect(human.map((h) => h.staff)).toEqual([1, 1, 1]);
    expect(human.every((h) => h.ai === 0 && h.both === 0)).toBe(true);
    for (const r of recruit) if (r.ladder) expect(ladderAddsUp(r.ladder)).toBe(true);
    expect(appt.parts?.reduce((n, p) => n + p.value, 0)).toBe(appt.staff);
  });
  it('🔴 ไม่โทรต้องมีเหตุทุกใบ — เหตุจากฐาน · ใบขอปิด (ไม่อยู่ในใบขอที่เปิด) · หาไม่เจอ = ยังไม่รู้เหตุ (ไม่หาย)', () => {
    const id = (n: number) => `0000000${n}-1111-4111-8111-111111111111`;
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
    const pre = recruitProportionRows(apps, flags, new Set(['siamraj-sql:OPL6910099'])).recruit[0].ladder!;
    expect(ladderAddsUp(pre)).toBe(true);
    expect(pre.waiting.map((p) => [p.key, p.value])).toEqual([['aiQueued', 1], ['claimed', 1]]);
    expect(pre.notCalled.map((p) => [p.label, p.value])).toEqual([
      ['ใบขอปิดแล้ว', 1],
      ['ซ้ำ iRecruit ภายใน 14 วัน — AI ไม่โทรเอง ให้คนเลือก', 1],
      ['ยังไม่รู้เหตุ', 1],
      ['เบอร์ผิด โทรไม่ได้', 1],
    ]);
    // อ่านใบขอไม่ได้ = ไม่เดาว่าปิด
    const noFeed = recruitProportionRows(apps, flags, null).recruit[0].ladder!;
    expect(noFeed.notCalled.find((p) => p.label === 'ใบขอปิดแล้ว')).toBeUndefined();
  });
  it('ติดตาม: ผล + รอโทร (AI ไม่มีผล / คนยังไม่ลงผล) + ไม่โทร (เหตุจากป้ายส่ง AI) บวกลบลงตัว', () => {
    const base = { aiUnreached: false, dispatch: null, queueStatus: null };
    const s = summarizeFollowLane([
      { ...base, ai: true, staff: false, bucket: 'went', mode: 'ai', queueStatus: 'completed' },
      { ...base, ai: true, staff: true, bucket: 'failed', mode: 'ai', aiUnreached: true },
      { ...base, ai: false, staff: true, bucket: 'notWent', mode: 'manual' },
      { ...base, ai: false, staff: false, bucket: 'waiting', mode: 'ai', queueStatus: 'pending' },
      { ...base, ai: false, staff: false, bucket: 'waiting', mode: 'manual' },
      { ...base, ai: false, staff: false, bucket: 'waiting', mode: 'ai', dispatch: 'off' },
      { ...base, ai: false, staff: false, bucket: 'waiting', mode: 'ai' },
    ]);
    expect([s.ai, s.both, s.staff, s.none, s.aiUnreached]).toEqual([1, 1, 1, 4, 1]);
    expect(ladderAddsUp(s.ladder!)).toBe(true);
    expect(s.ladder!.waiting.map((p) => p.value)).toEqual([1, 1]);
    expect(s.ladder!.notCalled.map((p) => p.label)).toEqual(['ปิดส่งอัตโนมัติอยู่', 'ยังไม่รู้เหตุ']);
  });
  it('สายที่ยังไม่ถึงเวลา = รอโทรตามเวลา (ไม่ค้าง) · เลยเวลาแล้ว = ค้าง · ยกเลิกบอกใต้สมการ', () => {
    const base = { aiUnreached: false, dispatch: null, queueStatus: 'pending', ai: false, staff: false, bucket: 'waiting' };
    const s = summarizeFollowLane(
      [
        { ...base, mode: 'ai', future: true },
        { ...base, mode: 'manual', future: true },
        { ...base, mode: 'ai', future: false },
        { ...base, mode: 'manual', future: false },
      ],
      7,
    );
    expect(s.ladder!.waiting.map((p) => [p.key, p.stuck ?? false])).toEqual([
      ['aiLater', false],
      ['staffLater', false],
      ['aiNoResult', true],
      ['staff', true],
    ]);
    expect(s.ladder!.excluded).toEqual({ label: 'ยกเลิก ไม่นับ', value: 7 });
    // ลงย้อนหลัง (สร้างหลังเวลาสาย) = ไม่โทร ไม่ใช่ค้าง (เจ้าของ 29 ต.ค. 2569)
    const b = summarizeFollowLane([{ ...base, mode: 'manual', future: false, backfilled: true }]);
    expect(b.ladder!.waiting).toEqual([]);
    expect(b.ladder!.notCalled.map((p) => [p.label, p.stuck ?? false])).toEqual([['ลงย้อนหลัง — ดึงมาตอนเวลาโทรผ่านไปแล้ว', false]]);
    expect(ladderAddsUp(s.ladder!)).toBe(true);
  });
  it('ทุกก้อนอยู่เสมอแม้ยังไม่มีข้อมูล (ว่าง = 0 ห้ามหาย)', () => {
    const g = buildProportionGroups({ apps: null, payload: null, matching: null });
    expect(g.map((x) => x.title)).toEqual(['งานสรรหา', 'ติดตามและดูแล', 'ทางเข้าของงาน', 'ขั้นที่ยังเป็นคน 100%']);
    expect(g.flatMap((x) => x.rows.map((r) => r.name))).toEqual([
      'AI โทร Prescreen',
      'โทรหลัง Prescreen',
      'นัดมาสมัครได้',
      'จับคู่งาน',
      'ติดตามคนเริ่มงาน',
      'ติดตามส่งคนแทน',
      'ดูแลหลังเริ่มงาน',
      'ผู้สมัครเข้าระบบ',
      'ใบส่งคนแทน',
      'โพสต์ประกาศ',
      'ลงผลมา / ไม่มาตามนัด',
      'ผ่าน / ไม่ผ่าน',
      'แจ้งเข้า ERP',
    ]);
  });
  it('ทางเข้า: ระบบ = สมัครเอง + iRecruit + So Scraping · คน = คีย์/นำเข้า · โพสต์ประกาศวัดไม่ได้', () => {
    const payload: ProportionPayload = {
      generated_at: '',
      from: '2026-10-01',
      to: '2026-10-28',
      bu: null,
      follow: {
        starter: { ai: 1182, both: 67, staff: 326, none: 39, aiUnreached: 202 },
        replacement: { ai: 2137, both: 279, staff: 82, none: 736, aiUnreached: 752 },
        aftercare: { ai: 0, both: 0, staff: 0, none: 0, aiUnreached: 0 },
      },
      entry: { selfApply: 866, irecruit: 496, soScraping: 0, staffKeyed: 374, replaceSync: 2624, replaceManual: 1, postOrders: 18 },
      errors: {},
    };
    const g = buildProportionGroups({ apps: [], payload, matching: null });
    const entry = g.find((x) => x.key === 'entry')!.rows;
    expect([entry[0].ai, entry[0].staff, entry[0].aiLabel]).toEqual([1362, 374, 'ระบบ']);
    expect(entry[2].unknown).toBe(true);
    const starter = g.find((x) => x.key === 'follow')!.rows[0];
    expect(starter.note).toBe('สาย · AI โทรไม่ติด 202 คนตามต่อ 67');
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
      matching: null,
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
  it('ทางเข้า: ไม่นับใบที่ยกเลิกข้อมูล · ใบคนแทนนับใบ (ไม่ใช่สาย)', () => {
    const sql = proportionEntrySql();
    expect(sql.match(/not exists \(select 1 from .*application_cancellations/g)?.length).toBe(4);
    expect(sql).toContain("count(distinct split_part(f.source_ref, ':', 2))::int");
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

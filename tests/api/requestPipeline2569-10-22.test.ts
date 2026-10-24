/**
 * ═══ แท็บใบขอบนหน้าหลัก: เส้น 12 ขั้น · ค้าง · ส่งคนแทน · ค่าปรับ · ช่องทาง (เจ้าของ 22 ต.ค. 2569) ═══
 * 🔴 ทุกก้อนบวกกันลงตัว (เจ้าของ "บวกลบกันแล้วมันต้องเท่ากัน") · ตัวอย่างเจ้าของ "ผ่านมา 50 ส่งคนแทน 49 = ปรับ 1 วัน"
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AGE_BUCKETS,
  ageBucketOf,
  aiResultOf,
  allocateReplacements,
  buildPipelineRequests,
  countsOf,
  stuckOf,
  stuckStepOf,
  summarizePipeline,
} from '@/lib/requestPipeline';
import { buildPlatforms, platformOf } from '@/lib/channelPlatforms';
import { groupReplacements } from '../../api/_handlers/request-pipeline';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import type { RequestPipelineResponse } from '@/lib/requestPipelineTypes';
import type { JobRequest } from '@/types';

const fact = (o: Partial<RecruitAppFact>): RecruitAppFact =>
  ({
    id: Math.random().toString(36).slice(2),
    createdAt: '2026-10-01T03:00:00Z',
    jobId: 'j1',
    calledByAi: false,
    calledByStaff: false,
    aiAnswer: null,
    aiAnswerAt: null,
    staffAnswer: null,
    staffLastAt: null,
    contact: null,
    contactBy: null,
    appointmentAt: null,
    attendance: null,
    screening: null,
    aiOutOfArea: false,
    appointmentFailed: false,
    ...o,
  }) as RecruitAppFact;

describe('อายุใบขอ', () => {
  it('ล่วงหน้า / ต่ำกว่า 30 / 30–60 / เกิน 60', () => {
    expect(ageBucketOf(true, null)).toBe('advance');
    expect(ageBucketOf(false, 0)).toBe('d1to7');
    expect(ageBucketOf(false, 7)).toBe('d1to7');
    expect(ageBucketOf(false, 8)).toBe('d8to15');
    expect(ageBucketOf(false, 15)).toBe('d8to15');
    expect(ageBucketOf(false, 16)).toBe('d16to30');
    expect(ageBucketOf(false, 30)).toBe('d16to30');
    expect(ageBucketOf(false, 31)).toBe('gt30');
    expect(ageBucketOf(false, null)).toBe('unknown');
  });
});

describe('คนในแต่ละขั้น', () => {
  it('ผล AI แยกขาด รวมกัน = AI โทรแล้ว · คนละพื้นที่ก่อนสนใจ', () => {
    const fs_ = [
      fact({ calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-10-01T04:00:00Z' }),
      fact({ calledByAi: true, aiAnswer: 'said_yes', aiOutOfArea: true }),
      fact({ calledByAi: true, aiAnswer: 'said_no' }),
      fact({ calledByAi: true, aiAnswer: 'no_pickup' }),
      fact({ calledByAi: true, aiAnswer: 'not_yet' }),
      fact({}),
    ];
    expect(aiResultOf(fs_[1])).toBe('outOfArea');
    const c = countsOf(fs_, 0, 0);
    expect(c.apps).toBe(6);
    expect(c.aiCalled).toBe(5);
    expect(c.aiYes + c.aiNo + c.aiOutOfArea + c.aiNoPickup + c.aiOther).toBe(c.aiCalled);
  });
  it('ติดขั้นแรกที่ยังไม่มีใครผ่าน', () => {
    const zero = countsOf([], 0, 0);
    expect(stuckStepOf(false, zero)).toBe('released');
    expect(stuckStepOf(true, zero)).toBe('apps');
    expect(stuckStepOf(true, countsOf([fact({})], 0, 0))).toBe('ai');
    expect(stuckStepOf(true, countsOf([fact({ calledByAi: true, aiAnswer: 'said_no' })], 0, 0))).toBe('ai');
    // เว็บจริง LBM6903002: AI ได้คนสนใจ แต่ยังไม่มีคนโทรต่อ = "คนยังไม่โทรต่อ" ไม่ใช่ "ยังติดต่อไม่ได้"
    expect(stuckOf(true, countsOf([fact({ calledByAi: true, aiAnswer: 'said_yes' })], 0, 0))).toEqual({ step: 'staff', reason: 'คนยังไม่โทรต่อ' });
    expect(stuckOf(true, countsOf([fact({ calledByAi: true, aiAnswer: 'said_no' })], 0, 0)).reason).toBe('โทรแล้วยังไม่มีคนสนใจ');
    expect(stuckStepOf(true, countsOf([fact({ calledByAi: true, aiAnswer: 'said_yes', appointmentAt: '2026-10-05T03:00:00Z' })], 0, 0))).toBe('showed');
    expect(
      stuckStepOf(true, countsOf([fact({ calledByAi: true, aiAnswer: 'said_yes', appointmentAt: '2026-10-05T03:00:00Z', attendance: 'showed', screening: 'passed' })], 0, 0)),
    ).toBe('follow');
  });
});

describe('ส่งคนแทน → วันโดนปรับ', () => {
  it('คนแทนต่อวันครอบใบที่เริ่มนับก่อนสุดก่อน · ไม่นับวันอนาคต · ไม่นับวันก่อนเริ่ม', () => {
    const reqs = [
      { jobId: 'old', site: 'S1', startYmd: '2026-10-01', weekdays: null },
      { jobId: 'new', site: 'S1', startYmd: '2026-10-10', weekdays: null },
    ];
    const cov = allocateReplacements(reqs, { S1: [['2026-10-05', 2], ['2026-10-12', 1], ['2026-10-13', 2], ['2026-10-30', 5]] }, '2026-10-20');
    expect([...(cov.get('old') ?? [])].sort()).toEqual(['2026-10-05', '2026-10-12', '2026-10-13']);
    expect([...(cov.get('new') ?? [])]).toEqual(['2026-10-13']);
  });

  it('ตัวอย่างเจ้าของ: ผ่านมา 50 วัน ส่งคนแทน 49 วัน = ปรับ 1 วัน × (ค่าปรับ + ลดมูลค่า ตามที่ใบมี)', () => {
    const today = new Date('2026-10-22T05:00:00+07:00');
    // ย้อนหลัง (กรอกหลังวันที่ต้องการ) → นับจากวันกรอก 2 ก.ย. ถึง 22 ต.ค. = 50 วัน (ทำทุกวัน)
    const job = {
      id: 'j1',
      request_no: 'TEST6909001',
      site_code: 'S1',
      unit_name: 'ทดสอบ',
      required_date: '2026-09-01',
      submittedAt: '2026-09-02T10:00:00+07:00',
      request_date: '2026-09-02',
      work_schedule: null,
      penalty_per_day: 100,
      deduct_per_day: 50,
    } as unknown as JobRequest;
    const days: Array<[string, number]> = [];
    for (let d = 3; d <= 51; d += 1) {
      const t = new Date(Date.UTC(2026, 8, d));
      days.push([t.toISOString().slice(0, 10), 1]);
    }
    const data = {
      today: '2026-10-22',
      facts: [],
      releasedJobIds: [],
      replacementBySite: { S1: days },
      followStartsBySite: {},
      aftercareBySite: {},
    } as unknown as RequestPipelineResponse;
    const [r] = buildPipelineRequests([job], data, today);
    expect(r.advance).toBe(false);
    expect(r.ageDays).toBe(50);
    expect(r.replacedDays).toBe(49);
    expect(r.penaltyDays).toBe(1);
    expect(r.fine).toBe(100);
    expect(r.deduct).toBe(50);
    // ใบไม่มีค่าปรับ = 0 ไม่ใช่เดา
    const [r2] = buildPipelineRequests([{ ...job, penalty_per_day: 0, deduct_per_day: 0 } as JobRequest], data, today);
    expect([r2.fine, r2.deduct]).toEqual([0, 0]);
  });

  it('สรุป: ทุกช่วงอายุรวม = จำนวนใบ · ติดขั้นรวม = จำนวนใบ', () => {
    const rows = [
      { bucket: 'd1to7', stuck: 'apps', fine: 10, deduct: 0, penaltyDays: 1, replacedDays: 0 },
      { bucket: 'gt30', stuck: 'released', fine: 0, deduct: 5, penaltyDays: 2, replacedDays: 3 },
      { bucket: 'advance', stuck: 'released', fine: 0, deduct: 0, penaltyDays: null, replacedDays: 0 },
    ] as never;
    const s = summarizePipeline(rows);
    expect(AGE_BUCKETS.reduce((n, b) => n + s.buckets[b.key], 0)).toBe(3);
    expect(Object.values(s.stuck).reduce((a, b) => a + b, 0)).toBe(3);
    expect([s.fine, s.deduct, s.penaltyDays, s.replacedDays]).toEqual([10, 5, 3, 3]);
  });

  it('API: คนแทนหนึ่งคนนับครั้งเดียวต่อวัน (สายยืนยัน/ก่อนเข้างานของคนเดียวกัน)', () => {
    const g = groupReplacements([
      { site: 'S1', source_ref: 'irecruit-replace:100:confirm:p1', scheduled_at: '2026-10-11T09:00:00Z', note: 'ยืนยันเวลาเข้างาน 12/10 08:00 น.' },
      { site: 'S1', source_ref: 'irecruit-replace:100:lead60:p1', scheduled_at: '2026-10-12T00:00:00Z', note: 'เข้างาน 08:00 น.' },
      { site: 'S1', source_ref: 'irecruit-replace:101:lead60:p2', scheduled_at: '2026-10-12T00:00:00Z', note: 'เข้างาน 08:00 น.' },
      { site: null, source_ref: 'irecruit-replace:102:lead60:p3', scheduled_at: '2026-10-12T00:00:00Z', note: 'เข้างาน 08:00 น.' },
    ]);
    expect(g.bySite.S1).toEqual([['2026-10-12', 2]]);
    expect(g.since).toBe('2026-10-12');
  });
});

describe('ช่องทาง 3 ชั้น', () => {
  it('ทุกช่องทางลงแพลตฟอร์มเดียว · ผลรวมทุกชั้นเท่ากัน', () => {
    expect(platformOf('Facebook กลุ่ม')).toBe('facebook');
    expect(platformOf('Facebook (ไม่รู้ว่ากลุ่ม/Ads/เพจ)')).toBe('facebook');
    expect(platformOf('TikTok ไลฟ์สด')).toBe('tiktok');
    expect(platformOf('ป้าย/ใบปลิว')).toBe('offline');
    expect(platformOf('พนักงานแนะนำ')).toBe('offline');
    expect(platformOf('Jobthai')).toBe('web');
    expect(platformOf('LINE OA')).toBe('line');
    expect(platformOf('ไม่รู้ช่องทาง')).toBe('unknown');
    expect(platformOf('อะไรใหม่')).toBe('other');
    const cp = {
      informed: 10,
      matched: 8,
      rows: [
        { channel: 'Facebook กลุ่ม', registered: 100, placed: 3, subs: [{ name: 'กลุ่ม A', registered: 60, placed: 2 }, { name: 'กลุ่ม B', registered: 40, placed: 1 }] },
        { channel: 'Facebook Ads', registered: 50, placed: 2, subs: [{ name: 'Ads X', registered: 50, placed: 2 }] },
        { channel: 'TikTok', registered: 30, placed: 3, subs: [] },
        { channel: 'ไม่รู้ช่องทาง', registered: 0, placed: 2, subs: [] },
      ],
    };
    const p = buildPlatforms(cp);
    expect(p.map((x) => [x.key, x.registered, x.placed])).toEqual([
      ['facebook', 150, 5],
      ['tiktok', 30, 3],
      ['unknown', 0, 2],
    ]);
    expect(p.reduce((n, x) => n + x.placed, 0)).toBe(cp.informed);
    const fb = p[0];
    expect(fb.types.reduce((n, t) => n + t.placed, 0)).toBe(fb.placed);
  });
});

describe('หน้าจอ', () => {
  it('แท็บใบขอบนหน้าหลัก · ใบขอชุดเดียวกับเมนูใบขอ · บรรทัดบวกเลขครบ', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/pages/HomeAiSharePage.tsx'), 'utf8');
    expect(page).toContain('{requestsView ? <HomeRequestsTab win={winQ} tick={tick} /> : null}');
    const tab = fs.readFileSync(path.join(process.cwd(), 'src/components/home-ai-share/HomeRequestsTab.tsx'), 'utf8');
    expect(tab).toContain('useUnitRequestsFeed()');
    for (const id of ['req-bucket-sum', 'req-stuck-sum', 'req-channels-sum', 'req-fine', 'req-deduct']) expect(tab).toContain(id);
    const api = fs.readFileSync(path.join(process.cwd(), 'api/_handlers/request-pipeline.ts'), 'utf8');
    expect(api).toContain('readUnitRequestListThroughCache({ limit: 500, departmentScope })');
  });
});

describe('ติดตามเริ่มงานของภาพรวม นับคนต่อไซต์ครั้งเดียว (เว็บจริงเคยขึ้น 801)', () => {
  it('สองใบไซต์เดียวกัน คนติดตาม 3 คน = 3 ไม่ใช่ 6 · นับตั้งแต่ใบที่เริ่มก่อนสุด', async () => {
    const { siteFollowTotals } = await import('@/lib/requestPipeline');
    const rows = [
      { site: 'S1', startYmd: '2026-10-05', job: {} },
      { site: 'S1', startYmd: '2026-10-10', job: {} },
      { site: 'S2', startYmd: '2026-10-01', job: {} },
    ] as never;
    const t = siteFollowTotals(rows, { followStartsBySite: { S1: ['2026-10-01', '2026-10-06', '2026-10-11', '2026-10-12'], S2: ['2026-10-02'] }, aftercareBySite: {} });
    expect(t).toEqual({ followStarts: 4, aftercare: 0 });
  });
});

describe('หน่วยตรงกันทั้งแท็บ (เจ้าของ 22 ต.ค. 2569 "หน่วยนับไม่ตรงกันมันจะชวนงง")', () => {
  const tab = fs.readFileSync(path.join(process.cwd(), 'src/components/home-ai-share/HomeRequestsTab.tsx'), 'utf8');
  it('หน่วยอยู่หัวคอลัมน์/หัวกลุ่ม · ของหน่วยเดียวกันอยู่กลุ่มเดียวกัน', () => {
    for (const h of ['ผ่านขั้นนี้ (ใบ)', 'ติดขั้นนี้ (ใบ)', 'ผ่านมา (วัน)', 'คนสนใจ (คน)', 'คนกรอก (คน)', 'โดนปรับ (วัน)', 'ค่าปรับ (บาท)', 'ลดมูลค่า (บาท)', 'ลงทะเบียน (คน)', 'ลงงาน (คน)', 'จำนวนใบ', 'ขาดคน (คน-วัน · วันทำงาน)', 'เงิน (บาท)']) {
      expect(tab).toContain(h);
    }
    // คอลัมน์แยกผลเป็นของคนเท่านั้น — ไม่มี "ยังไม่ประกาศ (ใบ)" / "ส่งคนแทน (วัน)" ปน
    expect(tab).not.toContain("part('ยังไม่ประกาศ'");
    expect(tab).not.toContain("part('ส่งคนแทน (วัน)'");
    // เงินรายใบมาจากสมุดค่าปรับตัวเดียวกับหน้าหลัก (24 ต.ค. 2569) — ห้ามกลับไปคิดวันค้าง × อัตรา
    expect(tab).toContain('ledgerByRequest(money)');
    // แยกผลซ่อนไว้ กดเลขคนแล้วกาง (เจ้าของ "ซ่อน พอกดแล้วค่อยโชว์") · เลขแยกผลอยู่คอลัมน์ "คน" เดียวกัน
    expect(tab).toContain('useState<ReadonlySet<PipelineStepKey>>(new Set())');
    expect(tab).toContain('data-testid={`req-step-toggle-${s.key}`}');
    // ผ่านขั้นก่อน − ติดขั้นนี้ = ผ่านขั้นนี้
    expect(tab).toContain('if (stuckHere !== null) passedSoFar -= stuckHere;');
  });
});

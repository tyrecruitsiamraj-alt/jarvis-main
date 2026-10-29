// @vitest-environment node
/**
 * ภาพรวมงานสรรหา "อ่านแล้วรู้เลย" (เจ้าของ 19 ต.ค. 2569)
 * 1. ใบขอเข้ามา → ประกาศแล้ว/ยังไม่ประกาศ → มีคนสมัคร (กรอกมากี่คน)/ไม่มีคนกรอก
 * 2. รายชื่อที่กรอกมา → AI โทร (สนใจ/ไม่สนใจ/คนละพื้นที่ …) · รอโทร · เบอร์ผิด · อายุเกิน → คนโทรต่อ → นัดหมาย → มา/ไม่มา
 * + ปุ่มช่วงเวลาปุ่มเดียว (เดือน · ช่วงวัน · เฉพาะวัน)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRecruitJourney, buildRequestSteps } from '../../src/lib/recruitJourney';
import { isOutOfAreaAnswer } from '../../src/lib/outOfAreaAnswer';
import { toRequestSummary } from '../../api/_handlers/recruit-overview';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';

const base: RecruitAppFact = {
  createdAt: '2026-10-12T03:00:00Z',
  jobId: 'j',
  channelLabel: null,
  referralSource: null,
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
};
const f = (o: Partial<RecruitAppFact>): RecruitAppFact => ({ ...base, ...o });

describe('ใบขอ', () => {
  it('ประกาศ/ไม่ประกาศ · มีคนสมัคร/ไม่มีคนกรอก · กรอกมากี่คน · ลูกรวม = แม่', () => {
    const sum = toRequestSummary([
      { releasedAt: '2026-10-02T00:00:00Z', applications: 3 },
      { releasedAt: '2026-10-03T00:00:00Z', applications: 0 },
      { releasedAt: '2026-10-04T00:00:00Z', applications: 2 },
      { releasedAt: null, applications: 1 },
      { releasedAt: null, applications: 0 },
    ]);
    expect(sum).toEqual({ total: 5, released: 3, notReleased: 2, notReleasedOpen: 2, notReleasedClosed: 0, releasedWithApps: 2, releasedNoApps: 1, appsOnReleased: 5 });
    const steps = buildRequestSteps(sum);
    for (const s of steps) expect(s.parts.reduce((n, p) => n + p.value, 0), s.key).toBe(s.total);
    expect(steps.every((s) => s.unit === 'ใบ')).toBe(true);
    expect(steps[1].parts[0].note).toBe('กรอกมา 5 คน');
  });
});

describe('รายชื่อที่กรอกมา', () => {
  const steps = buildRecruitJourney([
    f({ phoneOk: false }),
    f({ aiQueued: true }),
    f({ overAge: true }),
    f({ calledByAi: true, aiAnswer: 'said_yes', aiOutOfArea: true }), // สนใจ ไม่ถูกทับ
    f({ calledByAi: true, aiAnswer: 'said_no', aiOutOfArea: true }),
    f({ calledByAi: true, aiAnswer: 'said_no' }),
    f({ calledByAi: true, aiAnswer: 'no_pickup', aiOutOfArea: true }), // ไม่ได้คุย = ติดต่อไม่ได้
  ]);
  const part = (step: string, key: string) => steps.find((s) => s.key === step)!.parts.find((p) => p.key === key)!.value;
  it('เบอร์ผิด · รอโทร · อายุเกิน แยกช่อง · ลูกรวม = แม่ทุกขั้น', () => {
    for (const s of steps) expect(s.parts.reduce((n, p) => n + p.value, 0), s.key).toBe(s.total);
    expect([part('names', 'badData'), part('names', 'aiQueued'), part('names', 'overAge'), part('names', 'aiCalled')]).toEqual([1, 1, 1, 4]);
  });
  it('คนละพื้นที่ไม่ทับ "สนใจ" (เลขสนใจต้องตรงแท็บผู้สมัคร/หน้าหลัก)', () => {
    expect([part('ai', 'yes'), part('ai', 'no'), part('ai', 'area'), part('ai', 'unreached')]).toEqual([1, 1, 1, 1]);
  });
  it('ไม่มีขั้นผ่าน/ไม่ผ่านแล้ว', () => {
    expect(steps.map((s) => s.key)).toEqual(['names', 'ai', 'staff', 'appointment', 'attendance']);
  });
});

describe('คนละพื้นที่ — อ่านจากคำตอบกับ AI', () => {
  it.each([
    ['ผู้สมัครแจ้งว่าบ้านอยู่ไกล เดินทางไม่สะดวก', true],
    ['อยู่คนละจังหวัด', true],
    ['ไม่สะดวกในการเดินทางไปสถานที่ปฏิบัติงาน', true],
    ['ผู้สมัครบอกว่าไม่ไกล สะดวกเดินทาง', false],
    ['ไม่สะดวกเริ่มงานวันจันทร์', false],
    ['', false],
  ])('%s → %s', (text, want) => {
    expect(isOutOfAreaAnswer(text)).toBe(want);
  });
});

describe('หน้าจอ', () => {
  const ov = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
  it('ปุ่มช่วงเวลาปุ่มเดียว (28 ต.ค. 2569: เดือน · ปฏิทินตัวเลข · 7/30 วันล่าสุด · ไม่มีเฉพาะวันแล้ว)', () => {
    expect(ov).toContain('aria-label="เลือกช่วงเวลา"');
    const pop = ov.slice(ov.indexOf('<PopoverContent'), ov.indexOf('</PopoverContent>'));
    for (const k of ['ariaLabel="เลือกเดือน"', 'mode="range"', 'recruit-last7', 'recruit-last30']) expect(pop).toContain(k);
    expect(pop).not.toContain('เฉพาะวันในสัปดาห์');
  });
  it('การ์ด 6 ใบถอดแล้ว · มีก้อนใบขอ + รายชื่อที่กรอกมา', () => {
    expect(ov).not.toContain('<OverviewKpi');
    // 21 ต.ค. 2569 เป็นการ์ดกดลงลึกทุกแท็บ
    // การ์ดใบขอรวมเข้าการ์ดแนวโน้มใบขอ (27 ต.ค. 2569) — กดกล่องแล้วรายการใบขอขึ้นใต้กราฟ
    expect(ov).toContain("title: 'แนวโน้มใบขอ'");
    expect(ov).toContain("drillCard('apps', 'รายชื่อที่กรอกมา')");
  });
  it('API ส่งอายุ + คนละพื้นที่ + ใบขอ', () => {
    const api = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
    expect(api).toContain('overAge: isOverAge(');
    expect(api).toContain('aiOutOfArea: Boolean(r.ai_outcome) && isOutOfAreaAnswer(');
    // 21 ต.ค. 2569: อ่านทีเดียวช่วงก่อน+ช่วงนี้ แล้วแบ่งเป็นใบขอช่วงนี้ / ช่วงก่อน / รายวัน (กราฟเทียบ)
    expect(api).toContain('loadOnlineRequestRows({ from: window.prevFrom, to: window.to, bu: buSet, departmentScope: scope })');
    expect(api).toContain('body.requests = toRequestSummary(inRange(window.from, window.to));');
  });
});

describe('รอบ 2 (เจ้าของ 19 ต.ค. 2569)', () => {
  it('ภาพรวม: ช่องเป็นกล่องเลขใหญ่ ไม่จาง (ช่องที่กดไม่ได้เป็น div ไม่ใช่ปุ่ม disabled)', () => {
    const parts = readFileSync('src/components/dashboard-trends/RecruitOverviewParts.tsx', 'utf8');
    expect(parts).toContain('const canOpen = p.value > 0 && !!onOpenPart && p.ids.length > 0;');
    expect(parts).toContain('text-xl font-medium tabular-nums text-foreground');
    expect(parts).not.toContain('disabled={p.value === 0 || !onOpenPart');
  });
  it('แท็บผู้สมัคร: มุมมองเป็น Dropdown ("ทำเป็น Dropdown")', () => {
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    expect(ws).toMatch(/<FilterChipsDropdown\s+ariaLabel="มุมมองผู้สมัคร"/);
  });
});

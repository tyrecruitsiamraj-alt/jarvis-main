/**
 * ภาพรวมงานสรรหา (เจ้าของ 18 พ.ย. 2569) — รายชื่อเข้ามาไปถึงไหน + แยกช่องทาง + สถานะทำงานแบบ Dashboard
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildIntakeFlow, intakeChildren, intakeCounts, intakePathOf, isIntakeLeaf, onIntakePath, staffReachOf } from '@/lib/recruitIntakeFlow';
import { workStatusOfRemaining } from '@/lib/workStatusOfRemaining';
import type { StuckRequest } from '@/lib/recruitStuck';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import type { JobRequest } from '@/types';

let n = 0;
const fact = (p: Partial<RecruitAppFact>): RecruitAppFact =>
  ({ id: `9f1c${String((n += 1)).padStart(4, '0')}-6b2e-4c1a-9d3e-2a7b5c8e1f00`, createdAt: '2026-11-17T03:00:00Z', jobId: 'siamraj-sql:OPL6911059', channelLabel: null, referralSource: null, position: null, phoneOk: true, calledByAi: false, calledByStaff: false, firstCalledAt: null, aiAnswer: null, aiAnswerAt: null, staffAnswer: null, staffAnswerAt: null, staffLastAt: null, contact: null, contactBy: null, logOk: null, logReason: null, logAt: null, appointmentAt: null, attendance: null, onBoard: null, ...p }) as RecruitAppFact;

const cohort: RecruitAppFact[] = [
  fact({ aiQueued: true }),
  fact({}),
  fact({ calledByAi: true, aiAnswer: 'no_pickup', channelLabel: 'Facebook · Facebook Group · กลุ่มหางานจังหวัด', bringer: 'เจมส์', postSource: 'manual' }),
  fact({ calledByAi: true, aiAnswer: 'said_no', channelLabel: 'Tiktok · Tiktok Live', bringer: 'ว่าน', postSource: 'manual' }),
  fact({ calledByAi: true, aiAnswer: 'said_yes', channelLabel: 'Facebook · Facebook Group · กลุ่มหางานจังหวัด', bringer: 'ว่าน', postSource: 'manual' }),
  fact({ calledByAi: true, aiAnswer: 'said_yes', claimedBy: 'คิว', channelLabel: 'Jobthai' }),
  fact({ calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-11-17T04:00:00Z', calledByStaff: true, logOk: true, logAt: '2026-11-17T05:00:00Z', staffLastAt: '2026-11-17T05:00:00Z', appointmentAt: '2026-11-19T02:00:00Z', attendance: 'showed', channelLabel: 'Tiktok · Tiktok Live', bringer: 'ว่าน', postSource: 'manual' }),
  fact({ calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-11-17T04:00:00Z', calledByStaff: true, staffAnswer: 'no_pickup', staffAnswerAt: '2026-11-17T06:00:00Z', staffLastAt: '2026-11-17T06:00:00Z' }),
  // สนใจกับ AI ทีหลังที่เจ้าหน้าที่เคยโทร = ยังรอเจ้าหน้าที่โทร (นิยามเดียว 18 พ.ย. 2569)
  fact({ calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-11-17T09:00:00Z', calledByStaff: true, logOk: false, logAt: '2026-11-17T03:00:00Z', staffLastAt: '2026-11-17T03:00:00Z' }),
  fact({ calledByStaff: true, logOk: false, logAt: '2026-11-17T06:00:00Z', referralSource: 'facebook' }),
  fact({ calledByStaff: true, logOk: true, logAt: '2026-11-17T06:00:00Z', appointmentAt: '2026-11-18T02:00:00Z' }),
];

describe('รายชื่อเข้ามาไปถึงไหน', () => {
  it('ทุกกล่อง แถวรวมกัน = หัวกล่อง (หลุดตรงไหนบวกกลับได้ครบ)', () => {
    for (const b of buildIntakeFlow(cohort)) {
      expect(b.rows.reduce((s, r) => s + r.ids.length, 0)).toBe(b.ids.length);
    }
    const [apps, ai, follow, self, booked] = buildIntakeFlow(cohort);
    expect(apps.ids.length).toBe(11);
    expect(apps.rows.map((r) => [r.label, r.ids.length])).toEqual([['AI โทร', 7], ['ทีมโทรเอง', 2], ['รอ AI โทร', 1], ['ยังไม่มีใครโทร', 1]]);
    expect(ai.ids.length).toBe(7);
    expect(ai.rows.find((r) => r.key === 'not_yet')).toBeUndefined();
    expect(follow.rows.map((r) => r.ids.length)).toEqual([1, 0, 1, 1, 2]);
    expect(self.rows.map((r) => r.ids.length)).toEqual([1, 0, 1]);
    expect(booked.rows.map((r) => r.ids.length)).toEqual([1, 0, 1]);
  });

  it('ผลฝั่งทีม = ของที่ใหม่สุดระหว่างบันทึกติดต่อกับผลโทร', () => {
    expect(staffReachOf(fact({ calledByStaff: true, logOk: true, logAt: '2026-11-17T08:00:00Z', staffAnswer: 'no_pickup', staffAnswerAt: '2026-11-17T06:00:00Z' }))).toBe('talk');
    expect(staffReachOf(fact({ calledByStaff: true, logOk: true, logAt: '2026-11-17T05:00:00Z', staffAnswer: 'no_pickup', staffAnswerAt: '2026-11-17T06:00:00Z' }))).toBe('miss');
    expect(staffReachOf(fact({ calledByStaff: false }))).toBeNull();
  });
});

describe('แยกช่องทาง: หลัก → รอง → (กลุ่ม FB) → คนหามา', () => {
  it('Facebook Group มีชั้นชื่อกลุ่มก่อนคน · ช่องทางอื่นถึงคนเลย', () => {
    expect(intakePathOf(cohort[2])).toEqual(['Facebook', 'Facebook Group', 'กลุ่มหางานจังหวัด', 'เจมส์']);
    expect(intakePathOf(cohort[3])).toEqual(['Tiktok', 'Tiktok Live', 'ว่าน']);
    expect(isIntakeLeaf(['Facebook', 'Facebook Group', 'กลุ่มหางานจังหวัด'])).toBe(false);
    expect(isIntakeLeaf(['Tiktok', 'Tiktok Live', 'ว่าน'])).toBe(true);
  });
  it('ชั้นบนสุดขึ้นครบ 5 ช่องทางหลัก (ว่างก็ขึ้น) · ทุกชั้นบวกกันเท่าแถวแม่', () => {
    const top = intakeChildren(cohort, []);
    expect(top.map((t) => t.label)).toEqual(['Facebook', 'Tiktok', 'Webjob', 'Offline', 'อื่น ๆ · ไม่รู้ช่องทาง']);
    expect(top.reduce((s, t) => s + t.list.length, 0)).toBe(cohort.length);
    const fb = top[0].list;
    const subs = intakeChildren(cohort, ['Facebook']);
    expect(subs.reduce((s, t) => s + t.list.length, 0)).toBe(fb.length);
    const people = intakeChildren(cohort, ['Facebook', 'Facebook Group', 'กลุ่มหางานจังหวัด']);
    expect(people.map((p) => [p.label, p.list.length])).toEqual([['เจมส์', 1], ['ว่าน', 1]]);
    expect(cohort.filter((f) => onIntakePath(f, ['Tiktok', 'Tiktok Live', 'ว่าน']))).toHaveLength(2);
    expect(intakeCounts(cohort)).toEqual([11, 7, 5, 2, 2, 1]);
  });
});

const job = (p: Partial<JobRequest> & Pick<JobRequest, 'id' | 'request_no'>): JobRequest =>
  ({ unit_name: 'ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)', location_address: '', status: 'open', request_date: '2026-11-03', required_date: '2026-11-17', created_at: '2026-11-03T02:00:00.000Z', urgency: 'advance', total_income: 0, job_type: 'full_time', job_category: 'private', penalty_per_day: 0, days_without_worker: 0, total_penalty: 0, request_positions: 1, filled_positions: 0, cancelled_positions: 0, department_code: 'LBD', ...p }) as JobRequest;

describe('สถานะทำงานแบบ Dashboard บนหน้าภาพรวม', () => {
  const jobs = [
    job({ id: 'siamraj-sql:OPL6911059', request_no: 'OPL6911059' }),
    job({ id: 'siamraj-sql:OPL6911017', request_no: 'OPL6911017', work_status: 'waiting_inform', required_date: '2026-11-17' }),
    job({ id: 'siamraj-sql:OPL6911001', request_no: 'OPL6911001', work_status: 'waiting_interview', required_date: '2026-11-25', request_positions: 3, filled_positions: 1 }),
    job({ id: 'siamraj-sql:OPL6910036', request_no: 'OPL6910036', required_date: '2026-10-20' }),
    job({ id: 'siamraj-sql:OPL6911002', request_no: 'OPL6911002', required_date: '2026-11-17', status: 'closed' }),
  ];
  // ใบชุดเดียวกับการ์ดเหลือหา (เจ้าของ 19 พ.ย. 2569 "ถ้าเอาตามช่วง 2 อันก็ต้องเท่ากัน")
  const rem = (no: string, remaining: number): StuckRequest =>
    ({ requestNo: no, jobId: `siamraj-sql:${no}`, remaining, ageDays: 5, state: 'open' }) as unknown as StuckRequest;
  it('"ทั้งหมด" = การ์ดเหลือหาเสมอ · ใบที่ปิดไปหลังวันสุดท้ายของช่วง = ไม่มีสถานะ (ยอดไม่ขาด)', () => {
    const remaining = [rem('OPL6911059', 1), rem('OPL6911017', 1), rem('OPL6911001', 2), rem('OPL6909004', 1)];
    const boxes = workStatusOfRemaining(remaining, jobs);
    expect(boxes[0]).toMatchObject({ id: 'work_status_total', positions: 5, requests: 4 });
    expect(boxes.find((b) => b.id === 'work_status_in_progress')).toMatchObject({ label: 'กำลังดำเนินการสรรหา', positions: 1, requests: 1 });
    expect(boxes.find((b) => b.id === 'work_status_waiting_interview')).toMatchObject({ positions: 2, requests: 1 });
    expect(boxes.find((b) => b.id === 'work_status_none')).toMatchObject({ positions: 1, requests: 1 });
    expect(boxes.slice(1).reduce((n, b) => n + b.positions, 0)).toBe(boxes[0].positions);
    expect(boxes.slice(1).reduce((n, b) => n + b.requests, 0)).toBe(boxes[0].requests);
    // ทุกใบมีสถานะ = ไม่ขึ้นกล่องไม่มีสถานะ
    expect(workStatusOfRemaining(remaining.slice(0, 3), jobs).some((b) => b.id === 'work_status_none')).toBe(false);
  });
  it('ก้อนใบขอเป็นแผงเดียว (เลือกเรื่อง → กราฟ BU → ตาราง) + การประกาศ อยู่ในการ์ดใบขอใบเดียว (19 พ.ย. 2569)', () => {
    const page = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    const card = page.slice(page.indexOf('data-testid="v2-requests"'), page.indexOf('data-testid="v2-outreach-card"'));
    expect(card).toContain('<RequestBuPanel');
    expect(card).toContain('data-testid="v2-posting"');
    expect(card.match(/<\/Card>/g)?.length).toBe(1);
    expect(page).not.toContain('WorkStatusBoard');
    expect(page).not.toContain('data-testid="v2-req-equation"');
  });
  it('การประกาศ: ไม่มีตารางรายละเอียดเดิมข้างล่าง · ไม่มีช่องใบขอทั้งหมด (19 พ.ย. 2569 "เอาออก")', () => {
    const page = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    const pp = readFileSync('src/components/dashboard-trends/v2/PostingProgress.tsx', 'utf8');
    expect(page).not.toContain("{ key: 'all', rows: openRows");
    expect(pp).not.toContain('PERSON_GROUP_LABEL');
    expect(pp).not.toContain('อัตราที่ยังต้องหา');
  });
  it('การประกาศนับเฉพาะใบกำลังดำเนินการสรรหา · กราฟยืดเต็มความสูง (19 พ.ย. 2569 "เอายอดไอนี่ดีกว่า ดำเนินการสรรหา" · "ใต้กราฟมันดูโล่งๆ")', () => {
    const page = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    expect(page).toContain("workStatusOfRemaining(stuckEquation(reqRows).remaining, statusJobs).find((b) => b.id === 'work_status_in_progress')");
    expect(page).toContain('open={postRows}');
    expect(readFileSync('src/components/dashboard-trends/v2/PostingProgress.tsx', 'utf8')).toContain('flex flex-1 flex-col justify-evenly');
  });
  it('หน้าภาพรวมมีก้อนใบขอ + รายชื่อเข้ามาไปถึงไหน', () => {
    const src = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    expect(src).toContain('<RequestBuPanel');
    expect(src).toContain('title="รายชื่อเข้ามาไปถึงไหน"');
  });
});

describe('การ์ด "ต้องทำ" กดแล้วเห็นคนชุดเดียวกับเลข (เจ้าของ 18 พ.ย. 2569 "พอกดไปมันยอดแค่ 185")', () => {
  it('ถัง waiting_staff ใช้ตัวตัดสินเดียวกับเลขบนการ์ด (isWaitingStaffRow) · ใบ iRecruit เก่าตัดเหมือนหน้าผู้สมัคร', async () => {
    const mod = await import('../../api/_handlers/recruit-overview');
    const NOW = Date.parse('2026-11-18T12:00:00Z');
    const rows = [
      { id: '0b6e1a52-1c2d-4e3f-8a9b-0c1d2e3f4a5b', created_at: '2026-11-17T02:00:00Z', called: true, ai_outcome: 'confirmed', ai_at: '2026-11-17T03:00:00Z', staff_last_at: null },
      { id: '1c7f2b63-2d3e-4f40-9b0c-1d2e3f4a5b6c', created_at: '2026-11-17T02:00:00Z', called: true, ai_outcome: 'confirmed', ai_at: '2026-11-17T03:00:00Z', staff_last_at: '2026-11-17T05:00:00Z' },
      { id: '2d803c74-3e4f-4051-8c1d-2e3f4a5b6c7d', created_at: '2026-11-17T02:00:00Z', called: true, ai_outcome: 'declined', ai_at: '2026-11-17T03:00:00Z', staff_last_at: null },
    ];
    expect(rows.filter(mod.isWaitingStaffRow).map((r) => r.id)).toEqual(['0b6e1a52-1c2d-4e3f-8a9b-0c1d2e3f4a5b']);
    expect(mod.toBacklog(rows, null, NOW).waitingStaff.total).toBe(1);
    expect(mod.isBacklogBucket('waiting_staff')).toBe(true);
    expect(mod.isBacklogBucket('untouched')).toBe(false);
    expect(mod.backlogSql()).toContain("a.created_by_name = 'iRecruit'");
    expect(mod.appointmentBacklogSql()).toContain("a.created_by_name = 'iRecruit'");
  });
  it('การ์ดพาไปถังใหม่ทั้ง 3 ใบ พร้อม BU ที่เลือก · หน้ารายชื่อรู้จักถัง', () => {
    const src = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    for (const b of ['bucket=waiting_staff', 'bucket=uncalled_now', 'bucket=overdue_now']) expect(src).toContain(b);
    const labels = readFileSync('src/lib/recruitRmOverviewApi.ts', 'utf8');
    for (const b of ['waiting_staff:', 'uncalled_now:', 'overdue_now:']) expect(labels).toContain(b);
    expect(readFileSync('api/_handlers/job-applications.ts', 'utf8')).toContain('backlogIds(bucketParam, picked.buSet)');
  });
  it('แยกช่องทาง: แถวที่กดอยู่ที่เดิมใต้เมาส์ (จำตำแหน่งก่อนกดแล้วเลื่อนจอชดเชย)', () => {
    const src = readFileSync('src/components/dashboard-trends/v2/IntakeFlowPanel.tsx', 'utf8');
    expect(src).toContain('data-intake-key');
    expect(src).toContain('window.scrollBy');
  });
});

describe('สนใจแล้ว รอเจ้าหน้าที่โทร = นิยามเดียวทั้งหน้า (เจ้าของ 18 พ.ย. 2569 "เอานิยามเดียว")', () => {
  it('ส่วนผู้สมัคร · รายชื่อเข้ามาไปถึงไหน · รายชื่ออยู่กับใคร นับคนชุดเดียวกัน', async () => {
    const { isWaitingForStaff } = await import('@/lib/waitingForStaff');
    const { buildPersonJourney } = await import('@/lib/recruitPersonJourney');
    const { buildCallerResults } = await import('@/lib/callerResults');
    const want = cohort.filter((f) => isWaitingForStaff(f)).map((f) => f.id).sort();
    const journeyWaiting = buildPersonJourney(cohort).find((s) => s.key === 'follow')!.parts.find((p) => p.key === 'waiting')!.ids!.slice().sort();
    const follow = buildIntakeFlow(cohort).find((b) => b.key === 'follow')!;
    const intakeWaiting = follow.rows.filter((r) => r.key === 'heldNotCalled' || r.key === 'notHeld').flatMap((r) => r.ids).sort();
    expect(journeyWaiting).toEqual(want);
    expect(intakeWaiting).toEqual(want);
    // รายชื่ออยู่กับใคร (แถวที่ยังไม่มีใครเก็บ) = แถว "รอเจ้าหน้าที่โทร · ยังไม่มีใครเก็บ"
    expect(buildCallerResults(cohort).ai.waiting.slice().sort()).toEqual(follow.rows.find((r) => r.key === 'notHeld')!.ids.slice().sort());
  });
  it('ฝั่ง API (การ์ดต้องทำ) เรียกตัวเดียวกัน', () => {
    expect(readFileSync('api/_handlers/recruit-overview.ts', 'utf8')).toContain('isWaitingForStaff({ aiAnswer: micro(');
  });
});

describe('ภาพรวมไม่มีแถบกรอง 7 ช่องแล้ว (เจ้าของ 19 พ.ย. 2569 "ถอดออกทั้งแถบ")', () => {
  it('ไม่มี StuckFilterBar และไม่มีค่ากรองค้างเบื้องหลัง', () => {
    const src = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    for (const s of ['StuckFilterBar', 'reqFilter', 'jobFilterOf', 'appRecruiters']) expect(src).not.toContain(s);
  });
});

describe('กราฟแท่ง BU กดง่าย (เจ้าของ 19 พ.ย. 2569 "ถ้าไม่กดโดนแท่งมันไม่ขึ้นอะ … เล็กจนกดยากมาก")', () => {
  it('กดที่ช่องของกลุ่มได้ทั้งช่อง ไม่ต้องโดนตัวแท่ง', () => {
    expect(readFileSync('src/components/dashboard-trends/v2/MonthCompareBars.tsx', 'utf8')).toContain('st?.activeLabel');
  });
});

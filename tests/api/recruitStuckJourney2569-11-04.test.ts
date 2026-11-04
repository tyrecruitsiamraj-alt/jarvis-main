/**
 * หน้าภาพรวมงานสรรหา รอบเติม 4 ข้อ (เจ้าของ 4 พ.ย. 2569 "ทำเพิ่มแล้วเสนอมา")
 * 1 สมการบนสุด ยกมา + ขอใหม่ − ปิดแล้ว − ยกเลิก = ยังต้องหา (ลงตัวเสมอ)
 * 2 เส้นรายชื่อแตกทางที่หลุดครบ — ทุกขั้นรวมเท่ายอดของขั้น · สนใจ = เลขเดียวกับตารางช่องทาง (คนละพื้นที่ไม่ทับ)
 * 4 ใครโทรต่อ · ภายใน 1 วันไหม — ยังไม่โทร + ใน 1 วัน + เกิน 1 วัน = สนใจ
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stuckEquation, stuckInScope, type StuckRequest, type StuckState } from '@/lib/recruitStuck';
import { NO_CLAIMER, aiBranchOf, buildFollowCallers, buildPersonJourney, followSpeedOf, informedOf } from '@/lib/recruitPersonJourney';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

const req = (no: string, state: StuckState, inRange: boolean) => ({ requestNo: no, jobId: `siamraj-sql:${no}`, state, inRange }) as unknown as StuckRequest;

describe('สมการบนสุด', () => {
  const rows = [
    req('OLD1', 'open', false),
    req('OLD2', 'open', false),
    req('NEW1', 'open', true),
    req('NEW2', 'filled', true),
    req('NEW3', 'cancelled', true),
    req('NEW4', 'cancelled', true),
  ];
  it('ยกมา + ขอใหม่ − ปิดแล้ว − ยกเลิก = ยังต้องหา', () => {
    const eq = stuckEquation(rows);
    expect([eq.carried, eq.new, eq.filled, eq.cancelled, eq.remaining].map((l) => l.length)).toEqual([2, 4, 1, 2, 3]);
    expect(eq.carried.length + eq.new.length - eq.filled.length - eq.cancelled.length).toBe(eq.remaining.length);
  });
  it('ใบชุดที่เลือก: ยกมาเป็นของใบเก่าที่ยังเปิด · ปิดแล้ว/ยกเลิกเป็นของใบขอใหม่ · แถวรุ่นเก่าไม่มีสถานะ = ยังต้องหา', () => {
    expect(rows.filter((r) => stuckInScope(r, 'carried')).map((r) => r.requestNo)).toEqual(['OLD1', 'OLD2']);
    expect(rows.filter((r) => stuckInScope(r, 'cancelled')).map((r) => r.requestNo)).toEqual(['NEW3', 'NEW4']);
    expect(stuckInScope({ requestNo: 'X' } as StuckRequest, 'remaining')).toBe(true);
  });
  it('เซิร์ฟเวอร์: ขอใหม่ = ชุดเดียวกับหน้าหลัก · ยกมา = ยังต้องหาวันนี้เท่านั้น · พื้นที่ใช้ตัวอ่านของแท็บใบขอเดิม', () => {
    const src = readFileSync('api/_handlers/recruit-stuck.ts', 'utf8');
    expect(src).toContain('loadOnlineRequestRows({ from: win.from, to: win.to');
    expect(src).toContain("b.inRange || onlineRequestStateOf(b.online) === 'open'");
    expect(src).toContain('toRequestRows(base.map((b) => b.online))');
  });
});

const T0 = '2026-11-01T03:00:00.000Z';
const H = 3_600_000;
const at = (h: number) => new Date(Date.parse(T0) + h * H).toISOString();
let seq = 0;
const fact = (p: Partial<RecruitAppFact> = {}): RecruitAppFact => ({
  id: `a${++seq}`,
  createdAt: T0,
  jobId: 'siamraj-sql:OPL6911001',
  channelLabel: 'Facebook',
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
  ...p,
});
/** ตอบ AI ว่าสนใจ ชั่วโมงที่ 1 */
const yes = (p: Partial<RecruitAppFact> = {}) => fact({ calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: at(1), ...p });
/** คนโทรต่อชั่วโมงที่ h แล้วติดต่อได้ */
const reached = (h: number, p: Partial<RecruitAppFact> = {}) => yes({ calledByStaff: true, staffFirstAt: at(h), staffLastAt: at(h), contact: 'success', contactBy: 'staff', ...p });

describe('เส้นรายชื่อ — หลุดตรงไหน', () => {
  const now = new Date(at(200));
  const list = [
    fact(), // ยังไม่มีใครโทร ไม่มีคิว
    fact({ aiQueued: true }),
    fact({ phoneOk: false }),
    fact({ calledByStaff: true, logOk: true }), // คนโทรเอง ไม่ผ่าน AI
    fact({ calledByAi: true, aiAnswer: 'no_pickup' }),
    fact({ calledByAi: true, aiAnswer: 'said_no' }),
    fact({ calledByAi: true, aiAnswer: 'said_no', aiOutOfArea: true }),
    yes({ aiOutOfArea: true }), // สนใจ แม้บอกว่าไกล — ไม่ทับ
    yes({ claimedBy: 'อ้น' }), // ยังไม่มีคนโทรต่อ
    yes({ claimedBy: 'อ้น', calledByStaff: true, staffFirstAt: at(5), staffLastAt: at(5), contact: 'failed', contactBy: 'staff' }),
    reached(3, { claimedBy: 'อ้น', appointmentAt: at(500) }), // นัดได้ ยังไม่ถึงวัน
    reached(40, { claimedBy: 'อ้น', appointmentAt: at(100), attendance: 'showed', screening: 'passed' }),
    reached(4, { claimedBy: 'หมิว', appointmentAt: at(100) }), // เลยวันนัด ยังไม่ลงผล
    reached(4, { claimedBy: 'หมิว', appointmentFailed: true }),
  ];
  const stages = buildPersonJourney(list, now);
  const get = (k: string) => stages.find((s) => s.key === k)!;
  const n = (s: string, p: string) => get(s).parts.find((x) => x.key === p)!.ids.length;

  it('ทุกขั้น: ทางแยกรวมกันเท่ายอดของขั้น · ขั้นถัดไป = ทางที่ไปต่อ', () => {
    for (const s of stages) {
      expect(s.parts.reduce((t, p) => t + p.ids.length, 0), s.key).toBe(s.total);
      expect(s.parts.filter((p) => p.next)).toHaveLength(1);
    }
    for (let i = 1; i < stages.length; i += 1) expect(stages[i].total).toBe(stages[i - 1].parts.find((p) => p.next)!.ids.length);
  });
  it('เลขของแต่ละทาง', () => {
    expect(get('apps').total).toBe(14);
    expect([n('apps', 'aiCalled'), n('apps', 'staffOnly'), n('apps', 'queued'), n('apps', 'noQueue')]).toEqual([10, 1, 1, 2]);
    expect(get('apps').parts.find((p) => p.key === 'noQueue')!.note).toBe('เบอร์ผิด 1 · ยังไม่ส่ง AI 1');
    expect([n('ai', 'yes'), n('ai', 'noPickup'), n('ai', 'no'), n('ai', 'outOfArea')]).toEqual([7, 1, 1, 1]);
    expect([n('follow', 'reached'), n('follow', 'failed'), n('follow', 'waiting')]).toEqual([4, 1, 2]);
    expect([n('appoint', 'booked'), n('appoint', 'apptFailed')]).toEqual([3, 1]);
    expect([n('attend', 'showed'), n('attend', 'upcoming'), n('attend', 'overdue')]).toEqual([1, 1, 1]);
    expect(n('pass', 'passed')).toBe(1);
  });
  it('สนใจ = ตอบ AI ว่าสนใจ คนละพื้นที่ไม่ทับ (เลขเดียวกับตารางช่องทาง)', () => {
    expect(aiBranchOf(yes({ aiOutOfArea: true }))).toBe('yes');
    expect(aiBranchOf(fact({ calledByAi: true, aiAnswer: 'said_no', aiOutOfArea: true }))).toBe('outOfArea');
  });
  it('ได้ลงงาน: อ่าน ERP ไม่ได้ทั้งชุด = null (ห้ามโชว์ 0)', () => {
    expect(informedOf(list)).toBeNull();
    expect(informedOf([fact({ informed: true }), fact({ informed: false })])).toHaveLength(1);
  });

  it('ใครโทรต่อ: ยังไม่โทร + ใน 1 วัน + เกิน 1 วัน = สนใจ · ไม่มีคนเก็บอยู่ท้าย', () => {
    const rows = buildFollowCallers(list, now);
    expect(rows.map((r) => r.name)).toEqual(['อ้น', 'หมิว', NO_CLAIMER]);
    for (const r of rows) expect(r.notCalled.length + r.in1d.length + r.late.length).toBe(r.all.length);
    const on = rows[0];
    expect([on.all.length, on.notCalled.length, on.notCalledLate.length, on.in1d.length, on.late.length, on.reached.length, on.booked.length]).toEqual([4, 1, 1, 2, 1, 2, 2]);
    expect(rows.reduce((t, r) => t + r.all.length, 0)).toBe(n('ai', 'yes'));
  });
  it('ภายใน 1 วัน นับจากเวลาที่ AI ได้คำตอบถึงเจ้าหน้าที่ลงมือครั้งแรก', () => {
    expect(followSpeedOf(reached(25))).toBe('in1d');
    expect(followSpeedOf(reached(26))).toBe('late');
    expect(followSpeedOf(yes())).toBe('notCalled');
  });
});

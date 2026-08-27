// @vitest-environment node
/**
 * เส้นทางงานบนหน้ากล่องงาน — **เส้นเดียวจบ** (เจ้าของสั่งรื้อ 27 ส.ค. 2569)
 *
 * ด่านที่ห้ามหลุด:
 * 1. 🔴 **ทุกใบอยู่ขั้นเดียว** — ผลรวมทุกขั้นของใบเปิด = จำนวนใบเปิดทั้งหมดเป๊ะ
 *    (นี่คือหัวใจของการยุบ 4 ชั้นเหลือชั้นเดียว · ของเดิมเลขซ้อนกันจนบวกไม่ลงตัว)
 * 2. นับจากชุดที่กรองอยู่บนจอ ไม่ใช่ทั้งฐาน
 * 3. กล่อง ERP มาก่อน — ใบที่เดินพ้นงานประกาศไปแล้วห้ามถูกดึงกลับมาขั้นต้น ๆ
 */
import { describe, expect, it } from 'vitest';
import {
  BOARD_STAGE_ORDER,
  buildBoardStages,
  hasNote,
  isEdited,
  isUntouchedReview,
  openJobStage,
  type BoardStageFacts,
} from '../../src/lib/boardFlow';
import type { JobRequest } from '../../src/types/index.js';

const job = (over: Partial<JobRequest> = {}): JobRequest =>
  ({
    id: 'j1',
    unit_name: 'หน่วยงาน',
    location_address: '',
    status: 'open',
    created_at: '2026-08-01T00:00:00Z',
    ...over,
  }) as JobRequest;

function facts(over: Partial<BoardStageFacts> = {}): BoardStageFacts {
  return {
    hasLink: () => false,
    isReleased: () => false,
    applicants: () => 0,
    ...over,
  };
}

const NO_CLOSED = { closed: 0, cancelled: 0 };

describe('openJobStage — ใบหนึ่งอยู่ขั้นเดียว', () => {
  it('ยังไม่มีลิงก์ ยังไม่ปล่อย = รอตรวจ', () => {
    expect(openJobStage(job(), facts())).toBe('review');
  });

  it('มีลิงก์แล้วแต่ยังไม่ปล่อย = รอปล่อยประกาศ', () => {
    expect(openJobStage(job(), facts({ hasLink: () => true }))).toBe('toRelease');
  });

  it('ปล่อยแล้วแต่ยังไม่มีคนกรอก = รอคนสมัคร', () => {
    expect(openJobStage(job(), facts({ hasLink: () => true, isReleased: () => true }))).toBe(
      'waitApplicants',
    );
  });

  it('มีคนกรอกแล้ว = มีคนสมัครแล้ว (ชนะทุกขั้นก่อนหน้า)', () => {
    expect(openJobStage(job(), facts({ applicants: () => 2 }))).toBe('hasApplicants');
  });

  it('🔴 กล่อง ERP มาก่อน — ใบที่เดินพ้นงานประกาศแล้วห้ามถูกดึงกลับขั้นต้น', () => {
    const selecting = job({ work_status: 'waiting_interview' } as Partial<JobRequest>);
    // ยังไม่มีลิงก์เลย แต่ ERP บอกว่ากำลังคัดเลือกแล้ว
    expect(openJobStage(selecting, facts())).toBe('selecting');
    const started = job({ work_status: 'daily_work' } as Partial<JobRequest>);
    expect(openJobStage(started, facts())).not.toBe('review');
  });
});

describe('buildBoardStages', () => {
  it('คืนขั้นครบตามลำดับเส้น จบที่ปิดแล้ว/ยกเลิก', () => {
    const stages = buildBoardStages([job()], facts(), NO_CLOSED);
    expect(stages.map((s) => s.key)).toEqual([...BOARD_STAGE_ORDER]);
    expect(stages.at(-1)!.key).toBe('cancelled');
  });

  it('🔴 ผลรวมทุกขั้นของใบเปิด = จำนวนใบเปิดทั้งหมด (ไม่ซ้ำ ไม่ขาด)', () => {
    const jobs = [
      job({ id: 'a' }),
      job({ id: 'b' }),
      job({ id: 'c' }),
      job({ id: 'd', work_status: 'waiting_interview' } as Partial<JobRequest>),
      job({ id: 'e', work_status: 'waiting_inform' } as Partial<JobRequest>),
    ];
    const f = facts({ hasLink: (j) => j.id === 'b', applicants: (j) => (j.id === 'c' ? 4 : 0) });
    const stages = buildBoardStages(jobs, f, { closed: 9, cancelled: 3 });
    const openSum = stages.filter((s) => !s.done).reduce((n, s) => n + s.count, 0);
    expect(openSum).toBe(jobs.length);
    // ใบปิด/ยกเลิกมาคนละ feed — ส่งเข้ามาตรง ๆ ไม่ปนกับใบเปิด
    expect(stages.find((s) => s.key === 'closed')!.count).toBe(9);
    expect(stages.find((s) => s.key === 'cancelled')!.count).toBe(3);
  });

  it('ขั้น "มีคนสมัครแล้ว" บอกจำนวนคนด้วย — ไม่มีคนกรอกเลยไม่ต้องมีเลขรอง', () => {
    const withPeople = buildBoardStages(
      [job({ id: 'a' }), job({ id: 'b' })],
      facts({ applicants: () => 3 }),
      NO_CLOSED,
    ).find((s) => s.key === 'hasApplicants')!;
    expect(withPeople.count).toBe(2);
    expect(withPeople.sub).toBe('6 คน');

    const none = buildBoardStages([job()], facts(), NO_CLOSED).find(
      (s) => s.key === 'hasApplicants',
    )!;
    expect(none.count).toBe(0);
    expect(none.sub).toBeNull();
  });

  it('ทุกขั้นมีคำอธิบายที่อ่านออกโดยไม่ต้องถามใคร', () => {
    for (const st of buildBoardStages([job()], facts(), NO_CLOSED)) {
      expect(st.label, st.key).toBeTruthy();
      expect(st.hint.length, `${st.key}.hint`).toBeGreaterThan(20);
    }
  });

  it('ขั้นที่มีงานให้ลงมือถูกทำเครื่องหมายไว้ · ขั้นที่จบแล้วถูกแยกออก', () => {
    const stages = buildBoardStages([job()], facts(), NO_CLOSED);
    const by = Object.fromEntries(stages.map((s) => [s.key, s]));
    expect(by.review.actionable).toBe(true);
    expect(by.waitApplicants.actionable).toBe(false);
    expect(by.closed.done).toBe(true);
    expect(by.review.done).toBe(false);
  });

  it('ไม่มีใบสักใบ = ทุกขั้นเป็น 0 ไม่ระเบิด', () => {
    for (const st of buildBoardStages([], facts(), NO_CLOSED)) expect(st.count).toBe(0);
  });
});

describe('ป้ายบนการ์ด (ไม่ใช่ขั้นบนเส้นแล้ว)', () => {
  it('isEdited: ก้อนว่าง/null ล้วน = ยังไม่แก้ · มีค่าจริง = แก้แล้ว', () => {
    expect(isEdited(job())).toBe(false);
    expect(isEdited(job({ field_overrides: { age_min: null } }))).toBe(false);
    expect(isEdited(job({ field_overrides: { branches: [] } }))).toBe(false);
    expect(isEdited(job({ field_overrides: { age_min: 25 } }))).toBe(true);
  });

  it('hasNote: ช่องหมายเหตุคือที่จดว่า "ติดอะไร"', () => {
    expect(hasNote(job())).toBe(false);
    expect(hasNote(job({ list_note: '   ' }))).toBe(false);
    expect(hasNote(job({ list_note: 'รอลูกค้ายืนยัน' }))).toBe(true);
  });

  it('รอตรวจแล้วยังไม่มีใครจด = ของที่ยังไม่มีใครแตะจริง ๆ', () => {
    expect(isUntouchedReview(job(), facts())).toBe(true);
    expect(isUntouchedReview(job({ list_note: 'ติดค่าแรง' }), facts())).toBe(false);
    // เดินต่อไปแล้วไม่ใช่ของรอตรวจอีก
    expect(isUntouchedReview(job(), facts({ hasLink: () => true }))).toBe(false);
  });
});

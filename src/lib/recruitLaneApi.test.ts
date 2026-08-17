/**
 * ข้อความสรุปของเลนสรรหา (R2b) — ป้ายบอกแหล่งต้องอยู่ทั้งบนผลค้นและบนสรุปตอนส่ง
 *
 * พังเงียบที่คุมไว้: แหล่งที่ **อ่านไม่ได้** ถูกแสดงเป็น 0 เฉย ๆ
 * (คนอ่านจะเข้าใจว่า "ไม่มีคนในกองนั้น" ทั้งที่จริงคือฐานล่ม แล้วไปสรุปผิดว่าไม่มีคน)
 */
import { describe, expect, it } from 'vitest';
import {
  RECRUIT_LANE_SOURCE_LABEL,
  recruitLanePoolSummary,
  recruitLaneSendSummary,
  tierChipClass,
  type RecruitLaneDispatch,
  type RecruitLaneSourceStat,
} from '@/lib/recruitLaneApi';

const sources: RecruitLaneSourceStat[] = [
  { source: 'irecruit', label: 'จาก iRecruit', loaded: 120, error: null },
  { source: 'so_recruit', label: 'จากฐานใหม่', loaded: 8, error: null },
  { source: 'checklist', label: 'จาก Checklist', loaded: 1102, error: null },
];

const dispatch = (over: Partial<RecruitLaneDispatch> = {}): RecruitLaneDispatch => ({
  queued: 0,
  duplicated: [],
  skipped: [],
  cooldownSkipped: 0,
  leadCooldownSkipped: 0,
  queuedBySource: { irecruit: 0, so_recruit: 0, checklist: 0, declined: 0 },
  ...over,
});

describe('recruitLanePoolSummary', () => {
  const base = {
    pool_size: 1200,
    sources,
    duplicates_dropped: 0,
    on_board_dropped: 0,
    board_check_unavailable: false,
  };

  it('บอกยอดกองรวม + แยกตามแหล่งครบ 3', () => {
    const s = recruitLanePoolSummary(base);
    expect(s).toContain('ค้นจากกอง 1,200 คน');
    expect(s).toContain('จาก iRecruit 120');
    expect(s).toContain('จากฐานใหม่ 8');
    expect(s).toContain('จาก Checklist 1,102');
  });

  it('แหล่งที่อ่านไม่ได้ต้องขึ้นคำเตือน ไม่ใช่โชว์ 0 เงียบ ๆ', () => {
    const s = recruitLanePoolSummary({
      ...base,
      sources: [
        { source: 'irecruit', label: 'จาก iRecruit', loaded: 0, error: 'connect ECONNREFUSED' },
        ...sources.slice(1),
      ],
    });
    expect(s).toContain('อ่านไม่ได้: จาก iRecruit');
    expect(s).not.toContain('จาก iRecruit 0');
  });

  it('บอกยอดที่ตัดออก — คนซ้ำข้ามแหล่ง + คนที่ได้ใบสมัครแล้ว', () => {
    const s = recruitLanePoolSummary({ ...base, duplicates_dropped: 5, on_board_dropped: 12 });
    expect(s).toContain('ตัดคนซ้ำข้ามแหล่ง 5');
    expect(s).toContain('ได้ใบสมัครแล้ว 12 (ไปเลนคัดสรร)');
  });

  it('เช็คบอร์ดไม่ได้ = ติดธง (ยอด "ได้ใบสมัครแล้ว" เชื่อไม่ได้)', () => {
    expect(recruitLanePoolSummary({ ...base, board_check_unavailable: true })).toContain(
      'เช็คบอร์ด ERP ไม่ได้',
    );
  });

  it('ไม่มีอะไรถูกตัด = ไม่ต้องมีคำว่า "ตัด" ให้คนอ่านสับสน', () => {
    const s = recruitLanePoolSummary(base);
    expect(s).not.toContain('ตัดคนซ้ำ');
    expect(s).not.toContain('ได้ใบสมัครแล้ว');
  });
});

describe('recruitLaneSendSummary', () => {
  it('บอกยอดส่งพร้อมป้ายแหล่งของคนที่เข้าคิวจริง', () => {
    const s = recruitLaneSendSummary(
      dispatch({ queued: 7, queuedBySource: { irecruit: 3, so_recruit: 1, checklist: 3, declined: 0 } }),
    );
    expect(s).toContain('ส่ง AI โทร 7 คน');
    expect(s).toContain('จาก iRecruit 3');
    expect(s).toContain('จากฐานใหม่ 1');
    expect(s).toContain('จาก Checklist 3');
  });

  it('แหล่งที่ส่งได้ 0 ไม่ต้องรกในสรุป', () => {
    const s = recruitLaneSendSummary(
      dispatch({ queued: 3, queuedBySource: { irecruit: 0, so_recruit: 0, checklist: 3, declined: 0 } }),
    );
    expect(s).toContain('จาก Checklist 3');
    expect(s).not.toContain('จาก iRecruit');
  });

  it('แยกเหตุผลข้าม 2 แบบให้ชัด (งานนี้ 30 วัน กับ ใบสนใจโดนงานอื่น)', () => {
    const s = recruitLaneSendSummary(dispatch({ queued: 1, cooldownSkipped: 4, leadCooldownSkipped: 2 }));
    expect(s).toContain('ข้าม 4 (เพิ่งติดต่อเรื่องงานนี้ใน 30 วัน)');
    expect(s).toContain('ข้าม 2 (ใบสนใจที่เพิ่งถูกโทรเรื่องงานอื่น)');
  });

  it('เคยส่งแล้ว/ส่งไม่ได้ ขึ้นเป็นยอดแยก', () => {
    const s = recruitLaneSendSummary(
      dispatch({
        queued: 0,
        duplicated: ['ir-1', 'ir-2'],
        skipped: [{ ref: 'card-9', name: 'ก (จาก Checklist)', reason: 'ไม่มีเบอร์' }],
      }),
    );
    expect(s).toContain('ส่ง AI โทร 0 คน');
    expect(s).toContain('เคยส่งแล้ว 2');
    expect(s).toContain('ส่งไม่ได้ 1');
  });

  it('server เก่าไม่ส่ง queuedBySource มา = ไม่พัง (ไม่มีท่อนแหล่ง)', () => {
    const { queuedBySource: _omitted, ...withoutSources } = dispatch({ queued: 2 });
    expect(recruitLaneSendSummary(withoutSources as RecruitLaneDispatch)).toBe('ส่ง AI โทร 2 คน');
  });
});

describe('ป้าย/สี', () => {
  it('ป้ายแหล่งฝั่งหน้าเว็บตรงกับฝั่ง server เป๊ะ (ไม่งั้นสองจอพูดคนละคำ)', () => {
    expect(RECRUIT_LANE_SOURCE_LABEL).toEqual({
      irecruit: 'จาก iRecruit',
      so_recruit: 'จากฐานใหม่',
      checklist: 'จาก Checklist',
      // `declined` เป็นของเลนคัดสรร (เส้นชวนกลับ) ใช้รูปข้อมูลร่วมกันเท่านั้น
      declined: 'เคยปฏิเสธงานอื่น',
    });
  });

  it('tier → ชิปคนละสี', () => {
    expect(tierChipClass('green')).toContain('success');
    expect(tierChipClass('yellow')).toContain('warn');
    expect(tierChipClass('red')).toContain('danger');
  });
});

import { describe, expect, it } from 'vitest';
import {
  actionableBuckets,
  actionableSummary,
  bucketVisual,
  roundSignal,
  roundTabLabel,
  type RoundCounts,
} from '@/lib/followRoundVisual';
import { FOLLOW_ROUND_BUCKETS } from '@/lib/followRoundBuckets';

const counts = (over: Partial<RoundCounts> = {}): RoundCounts => ({
  all: 0,
  waiting: 0,
  calling: 0,
  connected: 0,
  unreached: 0,
  went: 0,
  not_went: 0,
  ...over,
});

describe('bucketVisual — สีบอกว่าควรทำอะไร', () => {
  it('ช่องที่ต้องลงมือ = เหลือง/แดง และติดธง actionable', () => {
    expect(bucketVisual('unreached', 3)).toEqual({ tone: 'warn', actionable: true });
    expect(bucketVisual('not_went', 1)).toEqual({ tone: 'danger', actionable: true });
  });

  it('ช่องที่ดีแล้ว/กำลังเดิน ไม่ต้องลงมือ', () => {
    expect(bucketVisual('connected', 9)).toEqual({ tone: 'success', actionable: false });
    expect(bucketVisual('went', 9)).toEqual({ tone: 'success', actionable: false });
    expect(bucketVisual('calling', 2)).toEqual({ tone: 'primary', actionable: false });
    expect(bucketVisual('waiting', 5)).toEqual({ tone: 'neutral', actionable: false });
    expect(bucketVisual('all', 5)).toEqual({ tone: 'neutral', actionable: false });
  });

  it('🔴 เลข 0 ต้องเป็นเทาเสมอ ไม่ว่าช่องไหน — กล่องว่างห้ามติดสีร้อน', () => {
    for (const b of FOLLOW_ROUND_BUCKETS) {
      expect(bucketVisual(b, 0)).toEqual({ tone: 'neutral', actionable: false });
    }
    expect(bucketVisual('not_went', 0).actionable).toBe(false);
  });

  it('ค่าเพี้ยน (ติดลบ/NaN) ตกเป็นเทา ไม่ใช่ติดสีร้อน', () => {
    expect(bucketVisual('not_went', -1).tone).toBe('neutral');
    expect(bucketVisual('unreached', Number.NaN).tone).toBe('neutral');
  });
});

describe('roundSignal — เรียงความเร่งด่วน', () => {
  it('ไม่มีใครในรอบ = empty', () => {
    expect(roundSignal(counts()).level).toBe('empty');
    expect(roundSignal(counts()).tone).toBe('neutral');
  });

  it('🔴 แดงชนะเหลือง ชนะน้ำเงิน ชนะเทา', () => {
    const all = counts({ all: 9, not_went: 1, unreached: 2, calling: 3, waiting: 4 });
    expect(roundSignal(all).tone).toBe('danger');
    expect(roundSignal({ ...all, not_went: 0 }).tone).toBe('warn');
    expect(roundSignal({ ...all, not_went: 0, unreached: 0 }).tone).toBe('primary');
    expect(roundSignal({ ...all, not_went: 0, unreached: 0, calling: 0 }).tone).toBe('neutral');
  });

  it('ไม่มีอะไรค้างเลย = เขียว', () => {
    const done = roundSignal(counts({ all: 5, connected: 5, went: 5 }));
    expect(done.level).toBe('ok');
    expect(done.tone).toBe('success');
    expect(done.text).toMatch(/ไม่มีอะไรค้าง/);
  });

  it('ข้อความบอกจำนวนจริงของช่องที่เร่งสุด', () => {
    expect(roundSignal(counts({ all: 9, not_went: 4 })).text).toContain('4');
    expect(roundSignal(counts({ all: 9, unreached: 7 })).text).toContain('7');
    expect(roundSignal(counts({ all: 9, calling: 2 })).text).toContain('2');
  });

  it('🔴 all = 0 ชนะทุกอย่าง — ไม่มีคนในรอบก็ห้ามขึ้นแดง', () => {
    expect(roundSignal(counts({ not_went: 3, unreached: 2 })).level).toBe('empty');
  });
});

describe('actionableBuckets / actionableSummary', () => {
  it('คืนเฉพาะช่องที่ต้องลงมือ เรียงตามที่โชว์บนจอ', () => {
    expect(actionableBuckets(counts({ all: 5, unreached: 2, not_went: 1 }))).toEqual([
      'unreached',
      'not_went',
    ]);
    expect(actionableBuckets(counts({ all: 5, connected: 5 }))).toEqual([]);
  });

  it('สรุปเป็นข้อความ · ไม่มีของต้องทำ = null (ห้ามขึ้นข้อความว่าง)', () => {
    expect(actionableSummary(counts({ all: 5, unreached: 2, not_went: 1 }))).toBe(
      'โทรไม่ติด 2 · ไม่ไป 1',
    );
    expect(actionableSummary(counts({ all: 5, went: 5 }))).toBeNull();
    expect(actionableSummary(counts())).toBeNull();
  });
});

describe('roundTabLabel', () => {
  it('คำเต็มตามที่เจ้าของสั่ง ไม่ใช่ "รอบ N"', () => {
    expect(roundTabLabel(1)).toBe('การโทรครั้งที่ 1');
    expect(roundTabLabel(3)).toBe('การโทรครั้งที่ 3');
  });
});

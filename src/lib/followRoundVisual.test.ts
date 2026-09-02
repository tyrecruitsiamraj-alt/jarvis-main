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
    expect(bucketVisual('unreached', 3)).toEqual({ tone: 'warn', actionable: true, muted: false });
    expect(bucketVisual('not_went', 1)).toEqual({ tone: 'danger', actionable: true, muted: false });
  });

  it('ช่องที่ดีแล้ว/กำลังเดิน ไม่ต้องลงมือ', () => {
    expect(bucketVisual('connected', 9)).toEqual({ tone: 'success', actionable: false, muted: false });
    expect(bucketVisual('went', 9)).toEqual({ tone: 'success', actionable: false, muted: false });
    expect(bucketVisual('calling', 2)).toEqual({ tone: 'primary', actionable: false, muted: false });
  });

  it('🔴 ทุกช่องที่มีคนต้องมีสีของตัวเอง ห้ามซ้ำกันจนแยกไม่ออก', () => {
    const tones = FOLLOW_ROUND_BUCKETS.map((b) => bucketVisual(b, 3).tone);
    // ไป/โทรติด เป็นเขียวได้ทั้งคู่ (ความหมายเดียวกัน = ดีแล้ว) ที่เหลือต้องไม่ซ้ำ
    expect(new Set(tones).size).toBeGreaterThanOrEqual(5);
    // ทั้งหมด กับ รอโทร ต้องไม่ใช่สีเดียวกัน (เคยเป็นเทาทั้งคู่ กวาดตาแยกไม่ออก)
    expect(bucketVisual('all', 3).tone).not.toBe(bucketVisual('waiting', 3).tone);
    // และห้ามเป็นเทาล้วน — เทาไม่สื่ออะไรเลย
    expect(bucketVisual('all', 3).tone).not.toBe('neutral');
    expect(bucketVisual('waiting', 3).tone).not.toBe('neutral');
  });

  it('🔴 ทั้ง 7 ช่องต้องแยกสีได้แม้ตอนว่างทั้งแถบ (เคสที่เจ้าของเจอ)', () => {
    const tones = FOLLOW_ROUND_BUCKETS.map((b) => bucketVisual(b, 0).tone);
    expect(new Set(tones).size).toBeGreaterThanOrEqual(5);
    expect(tones.every((t) => t === 'neutral')).toBe(false);
  });

  it('🔴 ช่องว่าง (0) คงสีประจำตัวไว้ แต่ต้อง muted และไม่ใช่ของที่ต้องลงมือ', () => {
    for (const b of FOLLOW_ROUND_BUCKETS) {
      const v = bucketVisual(b, 0);
      expect(v.muted).toBe(true);
      expect(v.actionable).toBe(false);
      // สีต้องเท่ากับตอนมีของ — ช่องเดิมต้องเป็นสีเดิมเสมอ กวาดตาจำตำแหน่งได้
      expect(v.tone).toBe(bucketVisual(b, 5).tone);
    }
  });

  it('ค่าเพี้ยน (ติดลบ/NaN) ถือเป็นช่องว่าง — สีเดิมแต่ muted', () => {
    expect(bucketVisual('not_went', -1)).toEqual({ tone: 'danger', actionable: false, muted: true });
    expect(bucketVisual('unreached', Number.NaN).muted).toBe(true);
  });
});

describe('roundSignal — เรียงความเร่งด่วน', () => {
  it('🔴 ไม่มีใครในรอบ = empty และ **ไม่มีข้อความ** (เจ้าของสั่งเอาออก)', () => {
    expect(roundSignal(counts()).level).toBe('empty');
    expect(roundSignal(counts()).tone).toBe('neutral');
    expect(roundSignal(counts()).text).toBe('');
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
    expect(roundTabLabel(1)).toBe('สายที่ 1');
    expect(roundTabLabel(3)).toBe('สายที่ 3');
  });
});

import { describe, expect, it } from 'vitest';
import {
  LUMOS_QUIET_HOURS,
  lumosConnectRate,
  lumosLinkStatus,
  lumosOutcomeSlices,
  lumosOutcomeTotal,
} from '../../src/lib/lumosLinkHealth';

const NOW = Date.UTC(2026, 7, 13, 6, 0, 0); // นาฬิกาคงที่ (pure — ไม่พึ่ง Date.now)
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe('lumosLinkStatus — ตอบให้ได้ว่า Lumos ยังส่งผลกลับอยู่ไหม', () => {
  it('ไม่เคยส่งใครเลย → idle ไม่ใช่สัญญาณเตือน', () => {
    const s = lumosLinkStatus({ lastResultAt: null, lastSentAt: null, waiting: 0, nowMs: NOW });
    expect(s.level).toBe('idle');
    expect(s.tone).toBe('neutral');
  });

  it('**เคสหัวใจ: มีสายรออยู่แต่เงียบเกิน 48 ชม. → stalled (สายขาด)**', () => {
    // นี่คือเคสที่เดิมไม่มีสัญญาณอะไรบอกเลย — งานหยุดเดินโดยไม่มีใครรู้
    const s = lumosLinkStatus({
      lastResultAt: hoursAgo(72),
      lastSentAt: hoursAgo(80),
      waiting: 25,
      nowMs: NOW,
    });
    expect(s.level).toBe('stalled');
    expect(s.tone).toBe('danger');
    expect(s.detail).toContain('25');
    // ป้ายต้องเป็น "ระยะเวลา" ไม่ใช่ "จุดเวลา" — "เงียบมา 3 วันที่แล้ว" อ่านไม่รู้เรื่อง
    expect(s.label).toBe('เงียบมา 3 วัน');
  });

  it('เงียบนานเท่ากันแต่ไม่มีใครรออยู่ → ไม่ใช่สายขาด (idle)', () => {
    // ต้องแยกสองเคสนี้ให้ออก ไม่งั้นจะเตือนหมาป่าทุกวันจนไม่มีใครเชื่อ
    const s = lumosLinkStatus({
      lastResultAt: hoursAgo(200),
      lastSentAt: hoursAgo(200),
      waiting: 0,
      nowMs: NOW,
    });
    expect(s.level).toBe('idle');
    expect(s.tone).toBe('neutral');
  });

  it('เพิ่งได้ผลกลับและยังมีสายเดินอยู่ → flowing', () => {
    const s = lumosLinkStatus({
      lastResultAt: hoursAgo(0.5),
      lastSentAt: hoursAgo(1),
      waiting: 10,
      nowMs: NOW,
    });
    expect(s.level).toBe('flowing');
    expect(s.tone).toBe('success');
    expect(s.label).toContain('นาทีที่แล้ว');
  });

  it('เงียบ 6–48 ชม. โดยมีสายรอ → watch (จับตา ยังไม่ใช่เตือน)', () => {
    const s = lumosLinkStatus({
      lastResultAt: hoursAgo(12),
      lastSentAt: hoursAgo(13),
      waiting: 4,
      nowMs: NOW,
    });
    expect(s.level).toBe('watch');
    expect(s.tone).toBe('warn');
  });

  it('ส่งไปนานแล้วแต่ไม่เคยมีผลกลับสักครั้ง → stalled', () => {
    const s = lumosLinkStatus({
      lastResultAt: null,
      lastSentAt: hoursAgo(LUMOS_QUIET_HOURS + 1),
      waiting: 7,
      nowMs: NOW,
    });
    expect(s.level).toBe('stalled');
  });

  it('เพิ่งส่งไปยังไม่มีผล → watch ไม่ใช่ stalled', () => {
    const s = lumosLinkStatus({ lastResultAt: null, lastSentAt: hoursAgo(1), waiting: 3, nowMs: NOW });
    expect(s.level).toBe('watch');
  });

  it('เวลาที่อ่านไม่ออกถือว่าไม่มีข้อมูล ไม่ใช่พังทั้งแถบ', () => {
    const s = lumosLinkStatus({ lastResultAt: 'ไม่ใช่วันที่', lastSentAt: null, waiting: 0, nowMs: NOW });
    expect(s.level).toBe('idle');
    expect(s.hoursSinceResult).toBeNull();
  });

  it('ทุกสถานะต้องมีทั้งป้ายและคำอธิบาย ไม่ปล่อยว่าง', () => {
    const cases = [
      { lastResultAt: null, lastSentAt: null, waiting: 0 },
      { lastResultAt: null, lastSentAt: hoursAgo(1), waiting: 2 },
      { lastResultAt: hoursAgo(1), lastSentAt: hoursAgo(2), waiting: 2 },
      { lastResultAt: hoursAgo(12), lastSentAt: hoursAgo(13), waiting: 2 },
      { lastResultAt: hoursAgo(99), lastSentAt: hoursAgo(99), waiting: 2 },
      { lastResultAt: hoursAgo(99), lastSentAt: hoursAgo(99), waiting: 0 },
    ];
    for (const c of cases) {
      const s = lumosLinkStatus({ ...c, nowMs: NOW });
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.detail.length).toBeGreaterThan(0);
    }
  });
});

describe('lumosOutcomeSlices — เลขย่อยต้องบวกได้เท่าเลขใหญ่', () => {
  it('แจกแจงครบทุกแบบที่มีค่า เรียงมากไปน้อย', () => {
    const slices = lumosOutcomeSlices({ confirmed: 3, no_answer: 18, acknowledged: 24, declined: 3 });
    expect(slices.map((s) => s.outcome)).toEqual(['acknowledged', 'no_answer', 'confirmed', 'declined']);
    expect(slices.reduce((n, s) => n + s.value, 0)).toBe(48);
  });

  it('ค่าที่ไม่ใช่ outcome จริง (ข้อมูลเก่าเพี้ยน) ต้องไม่หลุดมาโชว์', () => {
    // เจอจริงในฐาน: แถวที่ outcome เป็น 'completed' — ตัวกรองนี้มีมาก่อนแล้ว ห้ามถอด
    const slices = lumosOutcomeSlices({ confirmed: 2, completed: 99 });
    expect(slices.map((s) => s.outcome)).toEqual(['confirmed']);
    expect(lumosOutcomeTotal({ confirmed: 2, completed: 99 })).toBe(2);
  });

  it('ช่องที่เป็น 0 ไม่โผล่ (กวาดตาแล้วเจอของจริงเร็วขึ้น)', () => {
    expect(lumosOutcomeSlices({ confirmed: 0, declined: 0 })).toEqual([]);
  });

  it('เปอร์เซ็นต์คิดจากผลรวมของผลจริง', () => {
    const slices = lumosOutcomeSlices({ confirmed: 1, declined: 1, no_answer: 2 });
    expect(slices.find((s) => s.outcome === 'no_answer')?.percent).toBe(50);
  });

  it('ป้ายกับโทนมาจาก lib กลาง ไม่ใช่ประกาศเอง', () => {
    const s = lumosOutcomeSlices({ wrong_person: 1 })[0];
    expect(s.label).toBe('เบอร์ผิด');
    expect(s.tone).toBe('orange');
  });
});

describe('lumosConnectRate — โทรติดกี่ %', () => {
  it('ได้คุยกับคน = ติด · ไม่รับ/ไม่ตอบ/เบอร์ผิด = ไม่ติด', () => {
    const r = lumosConnectRate({ confirmed: 3, acknowledged: 24, declined: 3, no_answer: 18, wrong_person: 2 });
    expect(r.connected).toBe(30);
    expect(r.unreached).toBe(20);
    expect(r.total).toBe(50);
    expect(r.percent).toBe(60);
  });

  it('ยังไม่มีผลเลย → percent เป็น null ไม่ใช่ 0% (คนละความหมาย)', () => {
    expect(lumosConnectRate({}).percent).toBeNull();
  });

  it('ขอเลื่อนนับเป็นติด (ได้คุยแล้ว)', () => {
    expect(lumosConnectRate({ reschedule_requested: 4 }).percent).toBe(100);
  });
});

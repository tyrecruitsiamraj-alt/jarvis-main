import { describe, expect, it } from 'vitest';
import { buildExtraRounds, extraRoundsNote } from '@/lib/followExtraRounds';

/** เวลาอ้างอิงของเทสต์ — 18 ส.ค. 2569 12:00 ตามเวลาเครื่อง */
const NOW = new Date('2026-08-18T12:00:00');
/** datetime-local → ISO แบบเดียวกับที่ lib ทำ (ใช้สร้างค่าคาดหวัง ไม่ผูกกับ timezone เครื่องรัน) */
const iso = (local: string) => {
  const d = new Date(local);
  d.setSeconds(0, 0);
  return d.toISOString();
};

describe('buildExtraRounds', () => {
  it('แปลงเวลาที่กรอกเป็นรอบใหม่ เรียงจากก่อนไปหลัง', () => {
    const r = buildExtraRounds(['2026-08-20T15:00', '2026-08-19T09:00'], [], NOW);
    expect(r.isoTimes).toEqual([iso('2026-08-19T09:00'), iso('2026-08-20T15:00')]);
    expect(r.duplicateCount).toBe(0);
    expect(r.invalidCount).toBe(0);
  });

  it('ช่องว่าง = ยังไม่กรอก ข้ามเงียบ ๆ ไม่นับเป็นผิดพลาด', () => {
    const r = buildExtraRounds(['', '   ', '2026-08-19T09:00'], [], NOW);
    expect(r.isoTimes).toHaveLength(1);
    expect(r.invalidCount).toBe(0);
  });

  it('🔴 ซ้ำกับรอบที่มีอยู่แล้วต้องถูกตัด (ไม่งั้นโทรซ้อนคนเดิม)', () => {
    const existing = [iso('2026-08-19T09:00')];
    const r = buildExtraRounds(['2026-08-19T09:00', '2026-08-19T14:00'], existing, NOW);
    expect(r.isoTimes).toEqual([iso('2026-08-19T14:00')]);
    expect(r.duplicateCount).toBe(1);
  });

  it('🔴 ซ้ำกันเองในกล่องที่เพิ่งกรอกก็ต้องถูกตัด', () => {
    const r = buildExtraRounds(['2026-08-19T09:00', '2026-08-19T09:00'], [], NOW);
    expect(r.isoTimes).toHaveLength(1);
    expect(r.duplicateCount).toBe(1);
  });

  it('เทียบซ้ำระดับนาที — วินาทีต่างกันยังนับว่าซ้ำ', () => {
    const existing = ['2026-08-19T09:00:45.000Z'];
    const sameMinuteLocal = (() => {
      const d = new Date('2026-08-19T09:00:45.000Z');
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    })();
    const r = buildExtraRounds([sameMinuteLocal], existing, NOW);
    expect(r.duplicateCount).toBe(1);
    expect(r.isoTimes).toEqual([]);
  });

  it('🔴 เบราว์เซอร์บางตัวส่งวินาทีมาด้วย — ต้องตัดทิ้งก่อนเทียบซ้ำ', () => {
    // ช่องเดียวกันแต่มีวินาทีติดมา ต้องนับว่าซ้ำกับรอบเดิมที่ตั้งไว้นาทีเดียวกัน
    const existing = [iso('2026-08-19T09:00')];
    const r = buildExtraRounds(['2026-08-19T09:00:30'], existing, NOW);
    expect(r.duplicateCount).toBe(1);
    expect(r.isoTimes).toEqual([]);
    // และถ้าไม่ซ้ำ เวลาที่คืนต้องลงท้ายนาทีตรง ไม่ติดวินาที
    const r2 = buildExtraRounds(['2026-08-21T09:00:30'], [], NOW);
    expect(r2.isoTimes[0]).toBe(iso('2026-08-21T09:00'));
  });

  it('รูปแบบเวลาผิด = นับ invalid ไม่ใช่เงียบหาย', () => {
    const r = buildExtraRounds(['19/08/2026 09:00', '2026-08-19', 'ไม่รู้'], [], NOW);
    expect(r.isoTimes).toEqual([]);
    expect(r.invalidCount).toBe(3);
  });

  it('🔴 เวลาที่ผ่านมาแล้วยัง "ใช้ได้" แต่ต้องนับไว้เตือน (Lumos ปัดทิ้งเงียบ)', () => {
    const r = buildExtraRounds(['2026-08-17T09:00', '2026-08-20T09:00'], [], NOW);
    expect(r.isoTimes).toHaveLength(2);
    expect(r.pastCount).toBe(1);
  });

  it('อนาคตล้วน = ไม่มีเตือน', () => {
    const r = buildExtraRounds(['2026-08-19T09:00'], [], NOW);
    expect(r.pastCount).toBe(0);
  });

  it('ไม่กรอกอะไรเลย = ไม่มีรอบใหม่ ไม่มี error', () => {
    const r = buildExtraRounds([], [], NOW);
    expect(r).toEqual({ isoTimes: [], duplicateCount: 0, invalidCount: 0, pastCount: 0 });
  });

  it('เวลาเดิมที่พังอยู่ในฐาน (ISO อ่านไม่ออก) ต้องไม่ทำให้ทั้งชุดล่ม', () => {
    const r = buildExtraRounds(['2026-08-19T09:00'], ['ไม่ใช่วันที่', ''], NOW);
    expect(r.isoTimes).toHaveLength(1);
  });
});

describe('extraRoundsNote', () => {
  it('รวมทุกเรื่องเป็นบรรทัดเดียว', () => {
    const note = extraRoundsNote({
      isoTimes: ['a', 'b'],
      duplicateCount: 1,
      invalidCount: 2,
      pastCount: 1,
    });
    expect(note).toContain('เพิ่ม 2 รอบ');
    expect(note).toContain('ตัดเวลาซ้ำ 1');
    expect(note).toContain('เวลาไม่ถูกต้อง 2');
    expect(note).toContain('ผ่านมาแล้ว');
  });

  it('ไม่มีอะไรต้องบอก = null (ห้ามขึ้นกล่องเปล่า)', () => {
    expect(
      extraRoundsNote({ isoTimes: [], duplicateCount: 0, invalidCount: 0, pastCount: 0 }),
    ).toBeNull();
  });

  it('มีแต่ของดี = บอกแค่จำนวนรอบ', () => {
    expect(
      extraRoundsNote({ isoTimes: ['a'], duplicateCount: 0, invalidCount: 0, pastCount: 0 }),
    ).toBe('เพิ่ม 1 รอบ');
  });
});

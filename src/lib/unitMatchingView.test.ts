/**
 * หน้า "คนที่จับคู่ได้" ของใบขอ (16 ส.ค. 2569) — แบ่งกลุ่ม/นับ/สถานะ
 *
 * พังเงียบที่คุมไว้:
 * - ใบที่ยังบอกที่มาไม่ได้ ถูกยัดรวมกับ "สมัครเข้ามาเอง" → เลขบนจอโกหก
 * - ยอดบนแถบสรุปกับจำนวนแถวในกลุ่มไม่ตรงกัน (คิดกันคนละที่)
 * - เบอร์ใช้ไม่ได้ขึ้นว่า "รอโทร" → ค้างในถังตลอดกาลโดยไม่มีใครรู้
 */
import { describe, expect, it } from 'vitest';
import type { PublicApplication } from '@/lib/publicApplicationsApi';
import {
  groupApplicationsByOrigin,
  summarizeUnitMatches,
  unitMatchFactLine,
  unitMatchOriginLabel,
  unitMatchStatus,
} from '@/lib/unitMatchingView';

const app = (over: Partial<PublicApplication> = {}): PublicApplication =>
  ({
    id: Math.random().toString(36).slice(2),
    full_name: 'ทดสอบ ระบบ',
    phone: '0812345678',
    status: 'new',
    created_at: '2026-08-16T03:00:00.000Z',
    ...over,
  }) as PublicApplication;

describe('groupApplicationsByOrigin', () => {
  it('เรียงกลุ่มตามลำดับที่ตกลงไว้ — สมัครเอง → AI หาให้ → เจ้าหน้าที่คีย์', () => {
    const groups = groupApplicationsByOrigin([
      app({ origin: 'staff_added' }),
      app({ origin: 'ai_found' }),
      app({ origin: 'self_apply' }),
    ]);
    expect(groups.map((g) => g.origin)).toEqual(['self_apply', 'ai_found', 'staff_added']);
  });

  it('กลุ่มที่ไม่มีคน ไม่ถูกสร้าง (หัวข้อว่างกลางหน้าทำให้คิดว่าโหลดไม่ครบ)', () => {
    const groups = groupApplicationsByOrigin([app({ origin: 'ai_found' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('AI หามาให้');
  });

  it('🔴 ใบที่ยังบอกที่มาไม่ได้ ไปกลุ่มแยกท้ายสุด ห้ามรวมกับ "สมัครเข้ามาเอง"', () => {
    const groups = groupApplicationsByOrigin([app({ origin: 'self_apply' }), app()]);
    expect(groups.map((g) => g.origin)).toEqual(['self_apply', 'unknown']);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[1].label).toBe('ยังบอกที่มาไม่ได้');
  });

  it('ไม่มีใครเลย = ไม่มีกลุ่ม', () => {
    expect(groupApplicationsByOrigin([])).toEqual([]);
  });

  it('ทุกคนต้องอยู่ในกลุ่มใดกลุ่มหนึ่งพอดี — ไม่หาย ไม่ซ้ำ', () => {
    const items = [
      app({ origin: 'self_apply' }),
      app({ origin: 'ai_found' }),
      app({ origin: 'staff_added' }),
      app(),
    ];
    const total = groupApplicationsByOrigin(items).reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(items.length);
  });
});

describe('summarizeUnitMatches', () => {
  it('นับครบทุกช่อง และคืน 0 เมื่อไม่มีใคร', () => {
    expect(summarizeUnitMatches([])).toEqual({
      total: 0,
      interested: 0,
      called: 0,
      waiting: 0,
      byOrigin: { self_apply: 0, ai_found: 0, staff_added: 0 },
    });
  });

  it('โทรแล้ว + ยังไม่ได้โทร รวมกันเท่ายอดทั้งหมดเสมอ', () => {
    const items = [
      app({ last_call_outcome: 'confirmed' }),
      app({ last_call_outcome: 'declined' }),
      app(),
      app({ last_call_outcome: 'completed' }), // ค่าขยะจากข้อมูลเก่า = ไม่นับว่าโทรแล้ว
    ];
    const s = summarizeUnitMatches(items);
    expect(s.called + s.waiting).toBe(s.total);
    expect(s.called).toBe(2);
    expect(s.interested).toBe(1);
  });

  it('ยอดแยกที่มารวมกันไม่เกินยอดทั้งหมด (ใบที่ไม่รู้ที่มาไม่ถูกนับ)', () => {
    const s = summarizeUnitMatches([app({ origin: 'ai_found' }), app()]);
    expect(s.byOrigin.ai_found).toBe(1);
    expect(s.byOrigin.self_apply + s.byOrigin.ai_found + s.byOrigin.staff_added).toBeLessThanOrEqual(
      s.total,
    );
  });
});

describe('unitMatchStatus', () => {
  it('นัดแล้วชนะทุกอย่าง', () => {
    expect(
      unitMatchStatus(app({ appointment_at: '2026-08-18T03:00:00.000Z', last_call_outcome: 'declined' })).text,
    ).toBe('นัดแล้ว');
  });

  it('ตอบสนใจ = ป้ายเขียว', () => {
    const st = unitMatchStatus(app({ last_call_outcome: 'confirmed' }));
    expect(st.text).toBe('สนใจ');
    expect(st.tone).toBe('success');
  });

  it('ปฏิเสธ = ป้ายแดง · ผลอื่นเป็นเหลือง', () => {
    expect(unitMatchStatus(app({ last_call_outcome: 'declined' })).tone).toBe('danger');
    expect(unitMatchStatus(app({ last_call_outcome: 'no_answer' })).tone).toBe('warn');
  });

  it('🔴 เบอร์ใช้ไม่ได้ต้องเด่นกว่า "รอโทร"', () => {
    const st = unitMatchStatus(app({ phone_callable: false }));
    expect(st.text).toBe('เบอร์ใช้โทรไม่ได้');
    expect(st.tone).toBe('danger');
  });

  it('มีคนเก็บไปโทร ต่างจากรอโทร', () => {
    expect(unitMatchStatus(app({ claimed: true })).text).toBe('มีคนเก็บไปโทร');
    expect(unitMatchStatus(app()).text).toBe('รอโทร');
  });

  it('ค่าขยะจากข้อมูลเก่า ไม่ถูกอ่านเป็นผลโทร', () => {
    expect(unitMatchStatus(app({ last_call_outcome: 'completed' })).text).toBe('รอโทร');
  });
});

describe('บรรทัดข้อมูล/ป้าย', () => {
  it('ประกอบเฉพาะช่องที่มีค่า ไม่ทิ้งจุดคั่นลอย', () => {
    expect(unitMatchFactLine(app({ position_interest: 'ขับรถ', province: 'ชลบุรี' }))).toBe(
      'ขับรถ · ชลบุรี',
    );
    expect(unitMatchFactLine(app())).toBe('');
  });

  it('ไม่รู้ที่มา = ไม่ติดป้าย (ห้ามเดา)', () => {
    expect(unitMatchOriginLabel(app())).toBeNull();
    expect(unitMatchOriginLabel(app({ origin: 'ai_found' }))).toBe('AI หาให้');
  });
});

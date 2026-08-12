// @vitest-environment node
/**
 * "เก็บไปโทรเอง" ทีละหลายคน — การแบ่งกลุ่มเป้าหมาย + สรุปผล
 *
 * หัวใจ 2 อย่าง:
 *   1. คนที่รู้ล่วงหน้าว่ายิงไม่ผ่าน (ไม่มีเบอร์/ไม่มีใบขอ) ต้องถูกแยกออก **และถูกนับรายงาน**
 *      ไม่ใช่หายเงียบ (silent truncation อ่านว่า "เก็บครบแล้ว" ทั้งที่ไม่ครบ)
 *   2. 409 ที่คนถือคือเราเอง (เบอร์ซ้ำในชุด/ถืออยู่ก่อน) = "อยู่ในถังอยู่แล้ว" ไม่ใช่ "ติดคนอื่น"
 */
import { describe, expect, it } from 'vitest';

import {
  partitionHoldTargets,
  summarizeAcquireResults,
  type HoldTarget,
} from '../../src/lib/callHoldsBulk';
import type { AcquireCallHoldResult } from '../../src/lib/callHoldsApi';

const target = (over: Partial<HoldTarget> = {}): HoldTarget => ({
  candidateRef: '1834',
  candidateName: 'ฉัตรชัย สุคันธวณิช',
  phone: '0812345678',
  jobId: 'siamraj-sql:DS5812003',
  requestNo: null,
  source: 'board',
  ...over, // spread ทับตรง ๆ — ส่ง null มาต้องได้ null ไม่ใช่โดน ?? กลืนเป็นค่า default
});

const HOLD_STUB = {
  id: 'h1',
  candidateRef: '1834',
  candidateName: null,
  jobId: null,
  requestNo: null,
  source: 'board',
  heldByName: null,
  heldAt: '2026-08-11T00:00:00.000Z',
  expiresAt: '2026-08-12T00:00:00.000Z',
} as never;

const ok: AcquireCallHoldResult = { ok: true, hold: HOLD_STUB, message: null, heldBy: null };
const heldBy = (name: string): AcquireCallHoldResult => ({
  ok: false,
  hold: null,
  message: null,
  heldBy: { ...(HOLD_STUB as object), heldByName: name } as never,
});

describe('แบ่งกลุ่มเป้าหมายก่อนยิง', () => {
  it('ครบสามกลุ่ม และรวมกันเท่าจำนวนที่ส่งเข้า (ไม่มีใครหายเงียบ)', () => {
    const targets = [
      target({ candidateRef: 'a' }),
      target({ candidateRef: 'b', phone: null }),
      target({ candidateRef: 'c', phone: '   ' }),
      target({ candidateRef: 'd', jobId: null }),
      target({ candidateRef: 'e', jobId: '' }),
    ];
    const p = partitionHoldTargets(targets);
    expect(p.ready.map((t) => t.candidateRef)).toEqual(['a']);
    expect(p.noPhone.map((t) => t.candidateRef)).toEqual(['b', 'c']);
    expect(p.noJob.map((t) => t.candidateRef)).toEqual(['d', 'e']);
    expect(p.ready.length + p.noPhone.length + p.noJob.length).toBe(targets.length);
  });

  it('ไม่มีเบอร์สำคัญกว่าไม่มีใบขอ — คนที่ขาดทั้งคู่เข้ากลุ่มไม่มีเบอร์', () => {
    const p = partitionHoldTargets([target({ phone: null, jobId: null })]);
    expect(p.noPhone).toHaveLength(1);
    expect(p.noJob).toHaveLength(0);
  });
});

describe('สรุปผลหลังยิง', () => {
  it('นับสำเร็จ + ติดคนอื่น (บอกชื่อคนถือ) + ข้ามที่ไม่มีเบอร์/ใบขอ', () => {
    const msg = summarizeAcquireResults({
      results: [
        { target: target({ candidateName: 'สมชาย' }), result: ok },
        { target: target({ candidateName: 'สมหญิง' }), result: ok },
        { target: target({ candidateName: 'สมศรี' }), result: heldBy('ตั้ม') },
      ],
      viewerName: 'nitinan.c@siamraj.com',
      skippedNoPhone: 1,
      skippedNoJob: 2,
    });
    expect(msg).toContain('เก็บเข้าถังโทรแล้ว 2 คน');
    expect(msg).toContain('ติดคนอื่นถืออยู่ 1: สมศรี (ตั้ม)');
    expect(msg).toContain('ไม่มีเบอร์ 1 คน');
    expect(msg).toContain('ไม่ผูกใบขอ (คีย์เอง) 2 คน');
  });

  it('409 ที่คนถือคือเราเอง = "อยู่ในถังคุณอยู่แล้ว" ไม่ใช่ติดคนอื่น', () => {
    const msg = summarizeAcquireResults({
      results: [
        { target: target({ candidateName: 'สมชาย' }), result: heldBy('nitinan.c@siamraj.com') },
      ],
      viewerName: 'nitinan.c@siamraj.com',
    });
    expect(msg).toContain('อยู่ในถังคุณอยู่แล้ว 1 คน');
    expect(msg).not.toContain('ติดคนอื่น');
  });

  it('ล้มโดยไม่รู้คนถือ (เช่น เบอร์แปลงไม่ได้) = "ไม่สำเร็จ" พร้อมชื่อ', () => {
    const msg = summarizeAcquireResults({
      results: [
        {
          target: target({ candidateName: 'สมปอง' }),
          result: { ok: false, hold: null, message: 'x', heldBy: null },
        },
      ],
    });
    expect(msg).toContain('ไม่สำเร็จ 1: สมปอง');
  });

  it('ไม่มีชื่อ ใช้ ref แทน — ข้อความต้องไม่มี undefined/ว่าง', () => {
    const msg = summarizeAcquireResults({
      results: [{ target: target({ candidateName: null, candidateRef: '77' }), result: ok }],
    });
    expect(msg).toBe('เก็บเข้าถังโทรแล้ว 1 คน');
    const msg2 = summarizeAcquireResults({
      results: [
        { target: target({ candidateName: null, candidateRef: '77' }), result: heldBy('ตั้ม') },
      ],
    });
    expect(msg2).toContain('77 (ตั้ม)');
  });

  it('ไม่มีอะไรเลย = ข้อความบอกตรง ๆ', () => {
    expect(summarizeAcquireResults({ results: [] })).toBe('ไม่มีอะไรให้เก็บ');
  });
});

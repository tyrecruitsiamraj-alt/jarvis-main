// @vitest-environment node
/**
 * รอยต่อ "Lumos ส่งผลกลับ" ของช่องสัมภาษณ์ — จุดที่เคยขาดสองชั้นซ้อนกัน
 *
 * ทำไมต้องมีเทสต์ชุดนี้: ทั้งสองบั๊กเดิม**เงียบสนิท** ระบบตอบ 200 ว่าบันทึกแล้ว
 * แต่ในฐานไม่มีอะไรขยับ ไม่มี error ไม่มี log · เทสต์คือด่านเดียวที่จับได้
 *   1. รับผลเฉพาะ ref `ir-` → ผลของใบสมัครหน้าสาธารณะกับคนบนบอร์ดถูกทิ้ง
 *   2. คำว่า "สนใจ" ของช่องนี้คือ `completed` ซึ่งตัวตามงานไม่รู้จัก → ไม่เด้งแจ้งเตือน
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeInterviewOutcome } from '../../api/_lib/lumosInterviewOutcome.js';
import { CALL_OUTCOMES } from '../../src/lib/callFollowupPolicy.js';

const h = vi.hoisted(() => ({
  applyLumosResult: vi.fn().mockResolvedValue(true),
  dbQuery: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('../../api/_lib/lumos-auth.js', () => ({ withLumosAuth: (fn: unknown) => fn }));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({
  applyLumosResult: h.applyLumosResult,
  takePendingLumosItems: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: h.dbQuery, isPgUndefinedTable: () => false }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

import { lumosInterviewResultsHandler } from '../../api/_handlers/lumos-interview.js';

const JOB = 'siamraj-sql:LAO6908007';

function result(clientId: string, outcome = 'completed') {
  return {
    interview_id: 'iv-1',
    client_candidate_id: clientId,
    candidate_name: 'ทดสอบ',
    position: 'ขับรถ',
    type: 'phone',
    status: 'เสร็จสิ้น',
    outcome,
    scheduled_at: '2026-08-17T02:00:00.000Z',
    phone: '+66900000000',
    language: 'th',
    tone: 'professional',
    questions: [],
    ai_score: 80,
    summary: 'สนใจงาน',
    strengths: [],
    concerns: [],
    score_rationale: null,
    confidence: 'high',
    failure_reason: null,
    transcript: [],
    recording_url: null,
    call_attempts: 1,
    ended_reason: null,
    duration_min: 3,
  };
}

async function post(body: unknown) {
  const out: { code?: number; body?: Record<string, unknown> } = {};
  const res = {
    status(c: number) { out.code = c; return res; },
    json(b: Record<string, unknown>) { out.body = b; return res; },
    setHeader() { return res; },
    end() { return res; },
  };
  const req = { method: 'POST', query: {}, headers: { 'content-type': 'application/json' }, body };
  await (lumosInterviewResultsHandler as unknown as (a: unknown, b: unknown) => Promise<void>)(req, res);
  return out;
}

beforeEach(() => {
  h.applyLumosResult.mockClear();
  h.applyLumosResult.mockResolvedValue(true);
  h.dbQuery.mockClear();
});

describe('แปลศัพท์ผลของช่องสัมภาษณ์', () => {
  it('🔴 completed = สนใจ → แปลเป็น confirmed (ไม่งั้นตัวตามงานเงียบทั้งชุด)', () => {
    expect(normalizeInterviewOutcome('completed')).toBe('confirmed');
  });

  it('คำที่ตรงกับชุดกลางอยู่แล้ว ปล่อยผ่านทุกคำ', () => {
    for (const o of CALL_OUTCOMES) expect(normalizeInterviewOutcome(o)).toBe(o);
  });

  it('คำของช่องสัมภาษณ์ที่ตรงชุดกลางอยู่แล้ว — ต้องไม่ถูกแปลเพี้ยน', () => {
    expect(normalizeInterviewOutcome('declined')).toBe('declined');
    expect(normalizeInterviewOutcome('no_answer')).toBe('no_answer');
    expect(normalizeInterviewOutcome('wrong_person')).toBe('wrong_person');
  });

  it('คำที่ไม่รู้จัก/ว่าง = null (ข้ามการตามงาน ไม่เดาแทนคน)', () => {
    expect(normalizeInterviewOutcome('อะไรไม่รู้')).toBeNull();
    expect(normalizeInterviewOutcome('')).toBeNull();
    expect(normalizeInterviewOutcome(null)).toBeNull();
    expect(normalizeInterviewOutcome(undefined)).toBeNull();
  });
});

describe('รับผลกลับเข้าคิว — ต้องรับทุกแหล่ง', () => {
  const refs = [
    ['ir-', `${JOB}::ir-123`],
    ['app- (ใบสมัครหน้าสาธารณะ)', `${JOB}::app-11111111-1111-4111-8111-111111111111`],
    ['card- (คนบนบอร์ด)', `${JOB}::card-2000`],
  ] as const;

  for (const [label, id] of refs) {
    it(`🔴 ${label} → ผูกกลับเข้าคิว 1 ครั้ง`, async () => {
      await post([result(id)]);
      expect(h.applyLumosResult).toHaveBeenCalledTimes(1);
      expect(h.applyLumosResult.mock.calls[0][1]).toBe(id);
    });
  }

  it('ส่งคำที่แปลแล้วให้ตัวตามงาน แต่ผลดิบยังเป็นคำเดิมของ Lumos', async () => {
    const id = `${JOB}::app-abc`;
    await post([result(id, 'completed')]);
    const call = h.applyLumosResult.mock.calls[0];
    expect(call[4]).toBe('confirmed');
    expect((call[3] as { outcome: string }).outcome).toBe('completed');
  });

  it('outcome ที่ไม่ต้องแปล ส่งค่าเดิมต่อ', async () => {
    await post([result(`${JOB}::card-1`, 'declined')]);
    expect(h.applyLumosResult.mock.calls[0][4]).toBe('declined');
  });

  it('สถานะที่เขียนลงคิว: completed → completed · อย่างอื่น → failed · ยกเลิก → cancelled', async () => {
    await post([result(`${JOB}::ir-1`, 'completed')]);
    expect(h.applyLumosResult.mock.calls[0][2]).toBe('completed');

    h.applyLumosResult.mockClear();
    await post([result(`${JOB}::ir-2`, 'no_answer')]);
    expect(h.applyLumosResult.mock.calls[0][2]).toBe('failed');

    h.applyLumosResult.mockClear();
    await post([{ ...result(`${JOB}::ir-3`, 'failed'), status: 'ยกเลิก' }]);
    expect(h.applyLumosResult.mock.calls[0][2]).toBe('cancelled');
  });

  it('รับหลายรายการในครั้งเดียว — ผูกครบทุกรายการ', async () => {
    await post([result(`${JOB}::ir-1`), result(`${JOB}::app-2`), result(`${JOB}::card-3`)]);
    expect(h.applyLumosResult).toHaveBeenCalledTimes(3);
  });
});

describe('ตัวเลขที่ตอบกลับ Lumos ต้องบอกความจริง', () => {
  it('หาแถวในคิวเจอ → matched นับตามจริง', async () => {
    const out = await post([result(`${JOB}::card-1`), result(`${JOB}::card-2`)]);
    expect(out.code).toBe(200);
    expect(out.body?.matched).toBe(2);
  });

  it('🔴 หาแถวไม่เจอ → matched = 0 (เดิมตอบว่าบันทึกแล้วทั้งที่ไม่มีอะไรขยับ)', async () => {
    h.applyLumosResult.mockResolvedValue(false);
    const out = await post([result(`${JOB}::card-ไม่มีในคิว`)]);
    expect(out.body?.matched).toBe(0);
    expect(String(out.body?.message)).toContain('0/1');
  });

  it('ผูกคิวล้มกลางคัน ต้องไม่ทำให้ ingest ทั้งก้อนพัง (Lumos จะยิงซ้ำ)', async () => {
    h.applyLumosResult.mockRejectedValue(new Error('db down'));
    const out = await post([result(`${JOB}::card-1`)]);
    expect(out.code).toBe(200);
    expect(out.body?.matched).toBe(0);
  });
});

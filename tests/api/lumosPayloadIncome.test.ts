// @vitest-environment node
/**
 * เติมรายได้ตอนยิงงานให้ Lumos (เจ้าของ 5 ต.ค. 2569: "ให้บทเสนองานเดิมพูดรายได้ด้วย")
 * ของเดิมเติมตอน Lumos มาดึงคิว ซึ่งไม่มีแล้ว ⇒ ย้ายมาที่ตัวยิง
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/siamrajJobBenefits.js', async (orig) => {
  const mod = await orig<typeof import('../../api/_lib/siamrajJobBenefits.js')>();
  return {
    ...mod,
    fetchJobBenefitRates: vi.fn(async (nos: string[]) => {
      const m = new Map();
      for (const no of nos) {
        m.set(no, [
          { fee_name: 'เงินเดือน', fee_rate: 12000, unit: 'M', is_wage: true },
          { fee_name: 'เบี้ยขยัน', fee_rate: 500, unit: 'M', is_wage: false },
        ]);
      }
      return m;
    }),
  };
});

const { enrichPayloadsWithIncome, jobRefOfPayload, payloadMentionsMoney } = await import(
  '../../api/_lib/lumosPayloadIncome.js'
);

const offer = () => ({
  client_candidate_id: 'siamraj-sql:LBM6909001::app-1',
  questions: ['สวัสดีครับ คุณสมชาย ผมติดต่อจากสยามราชธานีนะครับ คุณเคยฝากใบสมัครไว้กับเรา'],
});

describe('เติมรายได้ตอนยิง', () => {
  it('หาใบขอจากรหัสใน payload ได้ทั้งสองช่อง', () => {
    expect(jobRefOfPayload(offer())).toBe('siamraj-sql:LBM6909001');
    expect(jobRefOfPayload({ client_contact_id: 'siamraj-sql:X1::card-9', steps: [] })).toBe('siamraj-sql:X1');
    expect(jobRefOfPayload({ client_contact_id: 'follow::abc' })).toBe('follow');
  });

  it('🔴 บทเสนองาน (ยังไม่พูดเงิน) = เติมประโยครายได้ + สวัสดิการ · ยิงซ้ำไม่เติมซ้ำ', async () => {
    const p = offer();
    expect(await enrichPayloadsWithIncome([p])).toBe(1);
    const last = p.questions[p.questions.length - 1];
    expect(last).toContain('รายได้ประมาณ');
    expect(last).toContain('บาทต่อเดือน');
    expect(await enrichPayloadsWithIncome([p])).toBe(0);
    expect(p.questions.filter((q) => q.includes('รายได้ประมาณ'))).toHaveLength(1);
  });

  it('บทผู้สมัครผ่านลิงก์ที่พูดรายได้เองแล้ว = ไม่เติม · งานติดตาม (ไม่มีเลขใบขอ) = ไม่เติม', async () => {
    const apply = { ...offer(), questions: ['…', 'งานนี้รายได้ประมาณเดือนละ 15,500 บาทครับ'] };
    expect(payloadMentionsMoney(apply)).toBe(true);
    expect(await enrichPayloadsWithIncome([apply])).toBe(0);
    const follow = { client_contact_id: 'follow::x', steps: [{ message: 'สวัสดีครับ' }] };
    expect(await enrichPayloadsWithIncome([follow])).toBe(0);
    expect(follow.steps[0].message).toBe('สวัสดีครับ');
  });

  it('ตัวยิงเรียกเติมก่อนยิงทุกครั้ง (รอบแรก + ส่งซ้ำผ่านตัวเดียวกัน)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../api/_lib/lumosPushTracking.ts', import.meta.url), 'utf8');
    const fn = src.slice(src.indexOf('export async function pushQueueRowsTracked'));
    expect(fn.indexOf('await enrichPayloadsWithIncome(')).toBeGreaterThan(0);
    expect(fn.indexOf('await enrichPayloadsWithIncome(')).toBeLessThan(fn.indexOf('for (const row of rows)'));
  });
});

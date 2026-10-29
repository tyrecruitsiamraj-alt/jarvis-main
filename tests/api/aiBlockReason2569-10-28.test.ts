import { describe, expect, it, vi } from 'vitest';
import { notSentReasonOf } from '../../src/lib/applicantAiAnswerText';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn(async () => ({ rows: [] })), isPgUndefinedTable: () => false }));

// เจ้าของ 28 ต.ค. 2569 "ทำไมไม่โทร" — คุณหนึ่ง: คีย์เองเลือก AI แล้ว ใบขอล่วงหน้า LBM6910007 ยังไม่ตั้งรายได้ จอบอก "ยังไม่กดส่ง AI"
const app = (over: Partial<PublicApplication>) =>
  ({ id: 'df382382-59c1-4a25-8729-570492a1994f', full_name: 'หนึ่ง', job_id: 'siamraj-pre:LBM6910007', created_by_name: 'narissara.p@siamraj.com', ...over }) as PublicApplication;

describe('เหตุที่ยังไม่ส่ง AI = เหตุจริงจากตัวส่ง', () => {
  it('ตัวส่งจดว่าใบขอยังไม่ตั้งรายได้ → โชว์คำนั้น (ตัดส่วนอธิบายหลังขีด)', () => {
    expect(notSentReasonOf(app({ call_choice: 'ai', ai_block_reason: 'ใบขอยังไม่ตั้งรายได้ — ตั้งรายได้ในป๊อปโพสต์ประกาศ (กล่องรายได้) ก่อน แล้วค่อยส่ง AI' }))).toBe(
      'ใบขอยังไม่ตั้งรายได้',
    );
  });
  it('เลือก AI แล้วยังไม่มีเหตุจด = รอระบบส่ง · ไม่ได้เลือก = คำเดิม', () => {
    expect(notSentReasonOf(app({ call_choice: 'ai' }))).toBe('เลือกให้ AI โทรแล้ว รอระบบส่ง');
    expect(notSentReasonOf(app({ call_choice: null }))).toBe('เพิ่มเอง/นำเข้า ยังไม่กดส่ง AI');
  });
  it('ตัวส่งจดเหตุลงใบเฉพาะแถวใบสมัคร (app-<id>) และเขียนเมื่อเหตุเปลี่ยน', async () => {
    const { recordAiBlockReasons } = await import('../../api/_lib/applicationDispatchRetry');
    const { dbQuery } = await import('../../api/_lib/postgres.js');
    await recordAiBlockReasons([
      { ref: 'app-df382382-59c1-4a25-8729-570492a1994f', reason: 'ใบขอยังไม่ตั้งรายได้ — …' },
      { ref: 'follow-x', reason: 'อื่น' },
    ]);
    const call = vi.mocked(dbQuery).mock.calls.at(-1)!;
    expect(String(call[0])).toContain('is distinct from v.reason');
    expect(call[1]).toEqual([['df382382-59c1-4a25-8729-570492a1994f'], ['ใบขอยังไม่ตั้งรายได้ — …']]);
    // โหลดตัวส่งคิวครั้งแรกตอนรันพร้อมกันทั้งชุดเกิน 5 วิ (29 ต.ค. 2569 ด่านตกซ้ำ 3 รอบ · รันเดี่ยวผ่าน)
  }, 30_000);
});

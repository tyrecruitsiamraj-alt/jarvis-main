/**
 * กล่องตั้งเกณฑ์ความเร่งของใบ (เจ้าของสั่ง 10 ก.ย. 2569)
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. ใบที่ไม่ได้ตั้ง → ป้ายบอก "ใช้ค่ากลาง" · ช่องว่างทั้งหมด · placeholder บอกค่ากลาง
 * 2. พิมพ์เส้นแบ่งใหม่ → **ตัวอย่างผลลัพธ์เปลี่ยนทันทีก่อนกดบันทึก**
 *    (เกณฑ์พวกนี้มองด้วยตาไม่ออก ถ้าไม่โชว์ คนจะตั้งเลขมั่วแล้วแดชบอร์ดขยับเงียบ ๆ)
 * 3. กดบันทึก → ส่ง override เดิมไปครบ **ไม่ทับรายได้/สวัสดิการที่ทีมแก้ไว้**
 * 4. ปุ่ม "กลับไปใช้ค่ากลาง" โผล่เฉพาะใบที่ตั้งไว้แล้ว และส่ง null
 */
import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { JobRequest } from '@/types';

const saveUnitRequestMeta = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/siamrajUnitRequestsApi', () => ({
  saveUnitRequestMeta: (...args: unknown[]) => saveUnitRequestMeta(...args),
  siamrajExternalId: (job: { request_no?: string }) => job.request_no ?? null,
}));

const { default: RequestLeadRulesCard } = await import('./RequestLeadRulesCard');

/** ใบขอห่าง 4 วัน — ค่ากลาง (เส้นแบ่ง 7) ตัดสินว่า "ฉุกเฉิน" */
const job = (over: Partial<JobRequest> = {}): JobRequest =>
  ({
    id: 'siamraj-sql:R-1',
    request_no: 'R-1',
    request_date: '2026-09-01',
    required_date: '2026-09-05',
    position_units: 1,
    request_positions: 1,
    status: 'open',
    ...over,
  }) as unknown as JobRequest;

const thresholdInput = () => screen.getByLabelText('เส้นแบ่ง ฉุกเฉิน ↔ ล่วงหน้า') as HTMLInputElement;

beforeEach(() => saveUnitRequestMeta.mockClear());
afterEach(cleanup);

describe('กล่องเกณฑ์ความเร่งของใบ', () => {
  it('ใบที่ไม่ได้ตั้ง — บอกว่าใช้ค่ากลาง และ placeholder บอกเลขกลางไว้', () => {
    render(<RequestLeadRulesCard job={job()} />);
    expect(screen.getByText('ใช้ค่ากลาง')).toBeTruthy();
    expect(thresholdInput().value).toBe('');
    expect(thresholdInput().placeholder).toBe('7');
    // ค่ากลางบอกว่าใบนี้ฉุกเฉิน · ให้เวลา 15 วัน
    expect(screen.getByText('ฉุกเฉิน')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
  });

  it('🔴 พิมพ์เส้นแบ่ง 3 → ตัวอย่างเปลี่ยนเป็น "ล่วงหน้า" ทันที ยังไม่ต้องกดบันทึก', () => {
    render(<RequestLeadRulesCard job={job()} />);
    expect(screen.getByText('ฉุกเฉิน')).toBeTruthy();
    fireEvent.change(thresholdInput(), { target: { value: '3' } });
    expect(screen.getByText('ล่วงหน้า')).toBeTruthy();
    expect(screen.queryByText('ฉุกเฉิน')).toBeNull();
    expect(saveUnitRequestMeta).not.toHaveBeenCalled();
  });

  it('ยังไม่แก้อะไร ปุ่มบันทึกกดไม่ได้ (กันบันทึกทับของเดิมโดยไม่ตั้งใจ)', () => {
    render(<RequestLeadRulesCard job={job()} />);
    const btn = screen.getByRole('button', { name: 'บันทึกเกณฑ์ของใบนี้' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('🔴 บันทึกแล้วต้องส่ง override เดิมไปครบ — ห้ามทับรายได้/สวัสดิการที่ทีมแก้ไว้', async () => {
    const j = job({
      field_overrides: { total_income: 18000, benefits: ['ที่พักฟรี'] },
    } as Partial<JobRequest>);
    render(<RequestLeadRulesCard job={j} />);
    fireEvent.change(thresholdInput(), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกเกณฑ์ของใบนี้' }));

    await waitFor(() => expect(saveUnitRequestMeta).toHaveBeenCalledTimes(1));
    const [requestNo, payload] = saveUnitRequestMeta.mock.calls[0] as [
      string,
      { field_overrides: Record<string, unknown> },
    ];
    expect(requestNo).toBe('R-1');
    expect(payload.field_overrides.total_income).toBe(18000);
    expect(payload.field_overrides.benefits).toEqual(['ที่พักฟรี']);
    expect(payload.field_overrides.lead_rules).toEqual({ urgent_threshold_days: 3 });
  });

  it('ใบที่ตั้งไว้แล้ว — ป้ายบอก "ตั้งเองเฉพาะใบนี้" · ช่องมีค่าเดิม · มีปุ่มกลับไปใช้ค่ากลาง', async () => {
    const j = job({ lead_rules: { urgent_threshold_days: 3, sla_days: { urgent: 30 } } });
    render(<RequestLeadRulesCard job={j} />);
    expect(screen.getByText('ตั้งเองเฉพาะใบนี้')).toBeTruthy();
    expect(thresholdInput().value).toBe('3');
    // ตั้งเส้นแบ่ง 3 แล้วใบห่าง 4 วันกลายเป็นล่วงหน้า ⇒ ใช้เวลาของล่วงหน้า (ค่ากลาง 15)
    expect(screen.getByText('ล่วงหน้า')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /กลับไปใช้ค่ากลาง/ }));
    await waitFor(() => expect(saveUnitRequestMeta).toHaveBeenCalledTimes(1));
    const [, payload] = saveUnitRequestMeta.mock.calls[0] as [
      string,
      { field_overrides: Record<string, unknown> },
    ];
    expect(payload.field_overrides.lead_rules).toBeNull();
  });

  it('ใบที่ตั้งให้เวลาหาคนไว้ 30 วัน — ตัวอย่างบอกวันครบกำหนดตามเลขของใบ', () => {
    render(<RequestLeadRulesCard job={job({ lead_rules: { sla_days: { urgent: 30 } } })} />);
    expect(screen.getByText('ฉุกเฉิน')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('ดูอย่างเดียว — ไม่มีปุ่มบันทึก', () => {
    render(<RequestLeadRulesCard job={job()} canEdit={false} />);
    expect(screen.queryByRole('button', { name: 'บันทึกเกณฑ์ของใบนี้' })).toBeNull();
    expect(thresholdInput().disabled).toBe(true);
  });
});

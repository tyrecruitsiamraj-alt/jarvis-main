/**
 * ป๊อปไล่งานโฉมใหม่ ขั้น 2/3 (30 ก.ย. 2569) — เจ้าของไล่ทีละหน้า
 * 🔴 ด่าน:
 * 1. เปิดดูเฉย ๆ ห้ามบันทึก (บั๊ก 27 ก.ย. — ป๊อปวนบันทึกเอง)
 * 2. ขั้น 2: ติ๊ก "ใบขอเขียนว่า" = ไม่ตั้งเอง · ติ๊ก "ใส่รายละเอียดเอง" ถึงโชว์ช่อง + เลือกที่อ่านจากใบขอไว้ให้
 * 3. ขั้น 3: รายได้เลือกได้ทางเดียว · ใส่เองเก็บพร้อมหน่วย · ติ๊กบรรทัดตามใบขอได้ยอดรวม
 * 4. สวัสดิการ: ติ๊กรายการทั่วไป + รายละเอียดต่อท้าย · เกิน 5 ติ๊กไม่ได้
 * 5. ไม่มีปุ่ม "บันทึกแล้วปิด"
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { JobRequest } from '@/types';

const saveUnitRequestMeta = vi.fn(async (..._a: unknown[]) => undefined);
const RATE_LINES = [
  { seq: 1, fee_name: 'เงินเดือน', is_wage: true, payment_rate: 15000 },
  { seq: 2, fee_name: 'ค่าเบี้ยขยัน', is_wage: false, payment_rate: 500 },
  { seq: 3, fee_name: 'ค่าปรับขาดงาน (ตามอัตรา)', is_wage: false, payment_rate: 410 },
];
vi.mock('@/lib/siamrajUnitRequestsApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/siamrajUnitRequestsApi')>()),
  fetchSiamrajUnitRequest: vi.fn(async () => ({ rate_lines: RATE_LINES })),
  saveUnitRequestMeta: (...a: unknown[]) => saveUnitRequestMeta(...a),
}));

const { default: PublicJobFields } = await import('./EditPublicJobFieldsDialog');
const { fetchSiamrajUnitRequest } = await import('@/lib/siamrajUnitRequestsApi');

const job = (over: Partial<JobRequest> = {}) =>
  ({
    id: 'siamraj-sql:OPL6909999',
    request_no: 'OPL6909999',
    location_address: '99 ถ.สีลม แขวงสุริยวงศ์ เขตบางรัก กรุงเทพมหานคร 10500',
    ...over,
  }) as JobRequest;

/** ของที่บันทึกครั้งล่าสุด (field_overrides) */
const lastSaved = () => {
  const call = saveUnitRequestMeta.mock.calls.at(-1) as [string, { field_overrides: Record<string, unknown> }] | undefined;
  return call?.[1].field_overrides;
};

/** รอให้ตัวบันทึกเอง (1.5 วิ) ทำงาน */
const flushAutosave = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1600);
  });
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  saveUnitRequestMeta.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ขั้น 2 — ใบขอเขียนว่า / ใส่รายละเอียดเอง', () => {
  it('🔴 เปิดดูเฉย ๆ = ติ๊ก "ใบขอเขียนว่า" ไว้ ไม่มีช่องเลือก และไม่บันทึกอะไร', async () => {
    render(<PublicJobFields job={job()} sections={['place']} />);
    expect(screen.getByRole('checkbox', { name: 'ใบขอเขียนว่า' }).getAttribute('data-state')).toBe('checked');
    expect(screen.getByRole('checkbox', { name: 'ใส่รายละเอียดเอง' }).getAttribute('data-state')).toBe('unchecked');
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    await flushAutosave();
    expect(saveUnitRequestMeta).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'บันทึกแล้วปิด' })).toBeNull();
  });

  it('ติ๊กใส่เอง = โชว์จังหวัด/อำเภอ/ตำบล เลือกที่อ่านจากใบขอไว้ให้ แล้วบันทึกเอง', async () => {
    render(<PublicJobFields job={job()} sections={['place']} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'ใส่รายละเอียดเอง' }));
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    await flushAutosave();
    expect(lastSaved()).toMatchObject({ province: 'กรุงเทพมหานคร', district: 'บางรัก', subdistrict: 'สุริยวงศ์' });
  });

  it('ใบที่ตั้งเองไว้แล้ว เปิดมาเป็น "ใส่รายละเอียดเอง" · กลับไปติ๊กใบขอเขียนว่า = ล้างที่ตั้งเอง', async () => {
    const saved = job({
      override_province: 'ลพบุรี',
      field_overrides: { province: 'ลพบุรี' } as JobRequest['field_overrides'],
    });
    render(<PublicJobFields job={saved} sections={['place']} />);
    expect(screen.getByRole('checkbox', { name: 'ใส่รายละเอียดเอง' }).getAttribute('data-state')).toBe('checked');
    await flushAutosave();
    expect(saveUnitRequestMeta).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ใบขอเขียนว่า' }));
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    await flushAutosave();
    expect(lastSaved()).toMatchObject({ province: null, district: null, subdistrict: null });
  });
});

describe('ขั้น 3 — รายได้เลือกได้ทางเดียว', () => {
  it('ค่าตั้งต้น = ตามใบขอ (ยังไม่ติ๊กบรรทัดไหน) · ติ๊กบรรทัดแล้วได้ยอดรวม · บรรทัดค่าปรับมีป้ายเตือน', async () => {
    render(<PublicJobFields job={job()} sections={['income', 'benefits']} />);
    expect(screen.getByRole('checkbox', { name: /ตามใบขอ/ }).getAttribute('data-state')).toBe('checked');
    const salary = await screen.findByRole('checkbox', { name: /^เงินเดือน/ });
    expect(salary.getAttribute('data-state')).toBe('unchecked');
    expect(screen.getByText('ค่าปรับ ไม่ใช่รายได้')).toBeTruthy();
    await flushAutosave();
    expect(saveUnitRequestMeta).not.toHaveBeenCalled();
    fireEvent.click(salary);
    fireEvent.click(screen.getByRole('checkbox', { name: /ค่าเบี้ยขยัน/ }));
    expect(screen.getByText('รวม 15,500')).toBeTruthy();
    await flushAutosave();
    expect(lastSaved()?.income).toEqual({
      period: 'monthly',
      lines: [
        { label: 'เงินเดือน', amount: 15000 },
        { label: 'ค่าเบี้ยขยัน', amount: 500 },
      ],
      total: null,
    });
  });

  it('🔴 ชื่อซ้ำคนละยอด (เงินเดือน 12,000 / เงินเดือน 400) โชว์ครบ ติ๊ก 12,000 แล้วได้ 12,000 จริง (4 ต.ค. 2569)', async () => {
    vi.mocked(fetchSiamrajUnitRequest).mockResolvedValueOnce({
      rate_lines: [
        { seq: 1, fee_name: 'เงินเดือน', is_wage: true, payment_rate: 12000 },
        { seq: 2, fee_name: 'เงินเดือน', is_wage: false, payment_rate: 400 },
      ],
    } as unknown as JobRequest);
    render(<PublicJobFields job={job()} sections={['income', 'benefits']} />);
    await screen.findByText('12,000');
    const rows = screen.getAllByRole('checkbox', { name: /^เงินเดือน/ });
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[0]);
    expect(rows[0].getAttribute('data-state')).toBe('checked');
    expect(rows[1].getAttribute('data-state')).toBe('unchecked');
    expect(screen.getByText('รวม 12,000')).toBeTruthy();
    await flushAutosave();
    expect(lastSaved()?.income).toMatchObject({ lines: [{ label: 'เงินเดือน', amount: 12000 }] });
  });

  it('ใส่เอง = ยอดเดียว + ต่อวัน/ต่อเดือน (ติ๊กแล้วทางเดิมหลุดเอง)', async () => {
    render(<PublicJobFields job={job()} sections={['income', 'benefits']} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'ใส่เอง' }));
    expect(screen.getByRole('checkbox', { name: /ตามใบขอ/ }).getAttribute('data-state')).toBe('unchecked');
    fireEvent.change(screen.getByLabelText('ยอดรายได้'), { target: { value: '520' } });
    fireEvent.click(screen.getByRole('radio', { name: 'ต่อวัน' }));
    await flushAutosave();
    expect(lastSaved()).toMatchObject({
      total_income: null,
      income: { period: 'daily', lines: [{ label: 'รายได้', amount: 520 }], total: null },
    });
  });

  it('ไม่มีข้อมูลคนเก่า = ติ๊กรายได้คนเก่าไม่ได้', () => {
    render(<PublicJobFields job={job()} sections={['income', 'benefits']} />);
    expect(screen.getByRole('checkbox', { name: /^รายได้คนเก่า/ }).hasAttribute('disabled')).toBe(true);
  });
});

describe('ขั้น 3 — สวัสดิการติ๊กจากรายการทั่วไป', () => {
  it('ติ๊ก + ใส่รายละเอียดต่อท้าย = บรรทัดเดียว "ชื่อ รายละเอียด"', async () => {
    render(<PublicJobFields job={job()} sections={['income', 'benefits']} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'รถรับส่ง' }));
    fireEvent.click(screen.getByRole('button', { name: 'รายละเอียด' }));
    fireEvent.change(screen.getByLabelText('รายละเอียด รถรับส่ง'), { target: { value: 'จาก BTS หมอชิต' } });
    expect(screen.getByText('รถรับส่ง จาก BTS หมอชิต')).toBeTruthy();
    await flushAutosave();
    expect(lastSaved()?.benefits).toEqual(['รถรับส่ง จาก BTS หมอชิต']);
  });

  it('🔴 ไม่ล็อก 5 รายการแล้ว (4 ต.ค. 2569) — ติ๊กได้ทุกรายการ · เพิ่มเองได้ · ไม่มีตัวนับ N/5', () => {
    render(<PublicJobFields job={job()} sections={['income', 'benefits']} />);
    for (const name of ['ชุดฟอร์ม', 'รถรับส่ง', 'ที่พัก/หอพัก', 'อาหารกลางวัน', 'ประกันสังคม', 'ประกันกลุ่ม']) {
      fireEvent.click(screen.getByRole('checkbox', { name }));
    }
    expect(screen.queryByText('5/5')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'โบนัสประจำปี' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'เพิ่มรายการเอง' }).hasAttribute('disabled')).toBe(false);
  });

  it('ชุดฟอร์มบอกจำนวนชุดได้ หรือไม่ระบุจำนวน · "จ่ายรายวัน" ไม่อยู่ในสวัสดิการ ย้ายไปช่องรับเงิน', async () => {
    render(<PublicJobFields job={job()} sections={['income', 'benefits']} />);
    expect(screen.queryByRole('checkbox', { name: 'จ่ายรายวัน' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ชุดฟอร์ม' }));
    expect(screen.getByRole('checkbox', { name: 'ไม่ระบุจำนวนชุด' }).getAttribute('data-state')).toBe('checked');
    fireEvent.change(screen.getByLabelText('จำนวนชุดฟอร์ม'), { target: { value: '3' } });
    expect(screen.getByRole('checkbox', { name: 'ไม่ระบุจำนวนชุด' }).getAttribute('data-state')).toBe('unchecked');
    fireEvent.click(screen.getByRole('checkbox', { name: 'รายวัน' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'รายเดือน' }));
    await flushAutosave();
    expect(lastSaved()).toMatchObject({ benefits: ['ชุดฟอร์ม 3 ชุด'], pay_cycles: ['monthly', 'daily'] });
  });

  it('🔴 ใบเก่าที่ติ๊ก "จ่ายรายวัน" ไว้ในสวัสดิการ = เปิดมาเป็นรับเงินรายวัน และเปิดดูเฉย ๆ ไม่บันทึก', async () => {
    render(
      <PublicJobFields
        job={job({ extra_benefits: ['จ่ายรายวัน', 'ชุดฟอร์ม'], field_overrides: { benefits: ['จ่ายรายวัน', 'ชุดฟอร์ม'] } as JobRequest['field_overrides'] })}
        sections={['income', 'benefits']}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'รายวัน' }).getAttribute('data-state')).toBe('checked');
    expect(screen.getByRole('checkbox', { name: 'ชุดฟอร์ม' }).getAttribute('data-state')).toBe('checked');
    await flushAutosave();
    expect(saveUnitRequestMeta).not.toHaveBeenCalled();
  });

  it('🔴 ใบที่มีสวัสดิการพิมพ์เองไว้ เปิดดูแล้วไม่บันทึกทับ · บรรทัดที่พิมพ์เองยังอยู่ให้แก้', async () => {
    const saved = job({
      extra_benefits: ['ชุดฟอร์ม', 'ข้าวฟรี 1 มื้อ'],
      field_overrides: { benefits: ['ชุดฟอร์ม', 'ข้าวฟรี 1 มื้อ'] },
    });
    render(<PublicJobFields job={saved} sections={['income', 'benefits']} />);
    expect(screen.getByRole('checkbox', { name: 'ชุดฟอร์ม' }).getAttribute('data-state')).toBe('checked');
    expect((screen.getByLabelText('สวัสดิการที่เพิ่มเอง') as HTMLInputElement).value).toBe('ข้าวฟรี 1 มื้อ');
    await flushAutosave();
    expect(saveUnitRequestMeta).not.toHaveBeenCalled();
  });
});

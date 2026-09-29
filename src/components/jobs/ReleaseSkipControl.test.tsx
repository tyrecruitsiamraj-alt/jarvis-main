/**
 * ปุ่ม "ไม่ปล่อย + เหตุผล" ในป๊อปไล่งานของกล่องงาน (29 ก.ย. 2569)
 * 🔴 ด่าน: ฟอร์มกางในที่เดิม (ไม่มี Dialog ซ้อน) · "อื่น ๆ" ต้องพิมพ์เหตุผลก่อนบันทึก · ส่ง id เต็ม ·
 *    ตั้งแล้วเห็นเหตุผล + ยกเลิกได้ · ใบที่ปล่อยแล้ว/ยังอ่านทะเบียนไม่ได้ = ไม่มีปุ่ม
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const markReleaseSkip = vi.fn();
const clearReleaseSkip = vi.fn();
vi.mock('@/lib/jobReleaseSkipApi', () => ({
  markReleaseSkip: (...a: unknown[]) => markReleaseSkip(...a),
  clearReleaseSkip: (...a: unknown[]) => clearReleaseSkip(...a),
}));

const { default: ReleaseSkipControl } = await import('./ReleaseSkipControl');

const JOB = 'siamraj-sql:OPL6909011';

beforeEach(() => {
  markReleaseSkip.mockReset().mockResolvedValue({});
  clearReleaseSkip.mockReset().mockResolvedValue(1);
});
afterEach(() => cleanup());

describe('ไม่ปล่อย + เหตุผล', () => {
  it('ยังไม่ตั้ง → กดแล้วฟอร์มกางในที่เดิม · อื่น ๆ ต้องพิมพ์เหตุผล · บันทึกด้วย id เต็ม', async () => {
    const onChanged = vi.fn();
    render(<ReleaseSkipControl jobId={JOB} skip={null} released={false} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: /ไม่ปล่อยใบนี้/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'บันทึก ไม่ปล่อย' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'อื่น ๆ' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก ไม่ปล่อย' }));
    expect(await screen.findByText('เลือก “อื่น ๆ” ต้องพิมพ์เหตุผลด้วย')).toBeTruthy();
    expect(markReleaseSkip).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('เหตุผลเพิ่มเติม'), { target: { value: 'ลูกค้าเลื่อนโครงการ' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก ไม่ปล่อย' }));
    await waitFor(() => expect(markReleaseSkip).toHaveBeenCalledWith(JOB, 'other', 'ลูกค้าเลื่อนโครงการ'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('ตั้งแล้ว → เห็นเหตุผล + ยกเลิกได้', async () => {
    const onChanged = vi.fn();
    render(
      <ReleaseSkipControl
        jobId={JOB}
        skip={{ job_id: JOB, request_no: 'OPL6909011', reason: 'unit_hold', note: null, skipped_at: '2026-09-29T03:00:00Z', skipped_by_name: null }}
        released={false}
        onChanged={onChanged}
      />,
    );
    expect(screen.getByText(/ไม่ปล่อยใบนี้ · หน่วยงานให้รอ/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก ไม่ปล่อย' }));
    await waitFor(() => expect(clearReleaseSkip).toHaveBeenCalledWith(JOB));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('🔴 ปล่อยขึ้นหน้าสาธารณะแล้ว / ยังอ่านทะเบียนไม่ได้ = ไม่มีปุ่ม (ห้ามโชว์ปุ่มที่ขัดกับของจริง)', () => {
    const { container, rerender } = render(<ReleaseSkipControl jobId={JOB} skip={null} released onChanged={() => undefined} />);
    expect(container.textContent).toBe('');
    rerender(<ReleaseSkipControl jobId={JOB} skip={undefined} released={false} onChanged={() => undefined} />);
    expect(container.textContent).toBe('');
    rerender(<ReleaseSkipControl jobId={JOB} skip={null} released={null} onChanged={() => undefined} />);
    expect(container.textContent).toBe('');
  });
});

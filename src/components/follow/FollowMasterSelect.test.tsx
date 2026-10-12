/**
 * 🔴 QA รอบ 4 (12 ต.ค. 2569) ข้อ 4: ป๊อปแก้ไขเปิดมาช่อง "เรื่อง" ว่างทุกครั้ง แล้วบันทึกส่ง topic:"" ไป
 * ต้นเหตุ: ลิสต์โหลดเสร็จ ค่าของ Select เปลี่ยนจาก "__manual__" เป็นเลขลำดับ → select ที่ซ่อนอยู่ของ Radix
 * รีเซ็ตตัวเองแล้วยิง onValueChange("") เหมือนคนเลือก ⇒ ค่าเดิมหายโดยไม่มีใครกด
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import FollowMasterSelect from './FollowMasterSelect';

afterEach(cleanup);

describe('FollowMasterSelect — ค่าเดิมห้ามหายตอนลิสต์โหลดเสร็จ', () => {
  it('เปิดแก้รายการที่มีเรื่องอยู่แล้ว = ไม่ยิง onChange("") เอง และขึ้นชื่อเรื่องเดิม', async () => {
    const onChange = vi.fn();
    let resolve: (v: string[]) => void = () => {};
    const load = () => new Promise<string[]>((r) => (resolve = r));
    const { container } = render(
      <form>
        <FollowMasterSelect<string>
          id="topic"
          label="เรื่องที่จะให้โทรติดตาม"
          value="ติดตามเริ่มงาน"
          onChange={onChange}
          emptyOptionLabel="เลือกเรื่อง"
          manualPlaceholder="พิมพ์เรื่อง"
          load={load}
          toValue={(s) => s}
          toLabel={(s) => s}
        />
      </form>,
    );
    await act(async () => resolve(['ติดตามส่งคนแทน', 'ติดตามเริ่มงาน']));
    await waitFor(() => expect(container.textContent).toContain('ติดตามเริ่มงาน'));
    expect(onChange).not.toHaveBeenCalledWith('');
  });
});

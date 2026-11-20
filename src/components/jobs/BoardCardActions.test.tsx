/**
 * 3 กล่อง "ทำอะไรไปแล้ว" สูงเท่ากันเสมอ (เจ้าของ 13 พ.ย. 2569 "ทำช่องไว้รอให้เท่าๆกันเลย ไม่งั้นอันไหนไม่สั่งกล่องก็ยุบไม่สวย")
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BoardCardActions from './BoardCardActions';
import { EMPTY_JOB_POST_ACTIONS } from '@/lib/jobPostActions';

const shape = (el: HTMLElement) => [...el.children].map((c) => `${c.tagName}:${c.children.length}`).join('|');

describe('BoardCardActions', () => {
  it('ยังไม่สั่งอะไรเลย: ทุกกล่องมีแถวช่อง + บรรทัดล่าง ช่องขึ้น 0', () => {
    render(<BoardCardActions actions={structuredClone(EMPTY_JOB_POST_ACTIONS)} postGroups={null} so={[]} onOpen={() => {}} />);
    const boxes = ['autopost', 'manual', 'scrap'].map((k) => screen.getByTestId(`board-action-${k}`));
    for (const b of boxes) expect(b.children).toHaveLength(3);
    expect(shape(boxes[0])).toBe(shape(boxes[1]));
    expect(boxes[0].textContent).toContain('0เผยแพร่แล้ว');
    expect(boxes[1].textContent).toContain('0โพสต์แล้ว');
    expect(boxes[1].textContent).toContain('0Gen link');
    // Scrap เป็นช่องตัวเลขแบบเดียวกัน (เจ้าของ 20 พ.ย. 2569 "ทำไมไม่แจ้งเป็นตัวเลขเหมือนกับอันอื่นๆ")
    expect(shape(boxes[2])).toBe(shape(boxes[0]));
    expect(boxes[2].textContent).toContain('0สำเร็จ');
    expect(boxes[2].textContent).toContain('0ไม่สำเร็จ');
  });
  it('Scrap: สำเร็จ + รอ + ไม่สำเร็จ + ยกเลิก = ที่สั่ง · บรรทัดล่างบอกเหตุของคำสั่งล่าสุด', async () => {
    const { summarizeJobPostActions } = await import('@/lib/jobPostActions');
    const o = (status: string, at: string) => ({ job_id: 'siamraj-sql:OPL6910061', request_type: 'scraping' as const, status, created_at: at, updated_at: at });
    const sum = summarizeJobPostActions([], [o('completed', '2026-11-18T03:00:00Z'), o('rejected', '2026-11-20T02:28:19Z'), o('rejected', '2026-11-20T02:53:07Z'), o('pending', '2026-11-19T03:00:00Z')])['siamraj-sql:OPL6910061'];
    expect(sum.scrap).toMatchObject({ orders: 4, done: 1, waiting: 1, failed: 2, cancelled: 0, status: 'rejected' });
    render(
      <BoardCardActions
        actions={sum}
        postGroups={null}
        so={[{ request_type: 'scraping', status: 'rejected', notes: 'ตีกลับ: โควต้าค้นหาวันนี้เต็มแล้ว', created_at: '2026-11-20T02:53:07Z' } as never]}
        onOpen={() => {}}
      />,
    );
    const box = screen.getByTestId('board-action-scrap');
    expect(box.textContent).toContain('สั่ง 4 ครั้ง');
    expect(box.textContent).toContain('1สำเร็จ');
    expect(box.textContent).toContain('1รอ');
    expect(box.textContent).toContain('2ไม่สำเร็จ');
    expect(box.textContent).toContain('โควต้าค้นหาวันนี้เต็มแล้ว');
  });
  it('ยังโหลดไม่มา: ช่องเดิมขึ้นขีด ไม่ใช่ 0 ปลอม', () => {
    render(<BoardCardActions actions={null} postGroups={null} so={null} onOpen={() => {}} />);
    const auto = screen.getByTestId('board-action-autopost');
    expect(auto.children).toHaveLength(3);
    expect(auto.textContent).toContain('—เผยแพร่แล้ว');
  });
  it('กล่องลอย (16 พ.ย. 2569): เหลือกล่องโพสต์เองกล่องเดียว ไม่มี Autopost/Scrap', () => {
    render(<BoardCardActions manualOnly actions={structuredClone(EMPTY_JOB_POST_ACTIONS)} postGroups={null} so={null} onOpen={() => {}} />);
    expect(screen.getByTestId('board-action-manual')).toBeTruthy();
    expect(screen.queryByTestId('board-action-autopost')).toBeNull();
    expect(screen.queryByTestId('board-action-scrap')).toBeNull();
  });
});

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
    expect(boxes[2].textContent).toContain('ยังไม่สั่งสถานะล่าสุด');
  });
  it('ยังโหลดไม่มา: ช่องเดิมขึ้นขีด ไม่ใช่ 0 ปลอม', () => {
    render(<BoardCardActions actions={null} postGroups={null} so={null} onOpen={() => {}} />);
    const auto = screen.getByTestId('board-action-autopost');
    expect(auto.children).toHaveLength(3);
    expect(auto.textContent).toContain('—เผยแพร่แล้ว');
  });
});

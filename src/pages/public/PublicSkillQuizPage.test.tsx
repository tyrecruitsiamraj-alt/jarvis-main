/**
 * หน้าแบบทดสอบของพนักงาน — ส่งคำตอบแล้วกล่องยืนยันต้องหายทันที (เจ้าของ 15 พ.ย. 2569 "แก้บั๊กกล่องส่งคำตอบค้าง")
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const submitPublicQuiz = vi.fn(async () => {});
vi.mock('@/lib/skillQuizApi', () => ({
  fetchPublicQuiz: async () => ({
    title: 'ชุดช่างอาคาร',
    personName: 'นายสมชาย ใจดี',
    personRole: 'ช่างซ่อมบำรุง',
    submitted: false,
    questions: [{ id: 'q-7f3a', kind: 'choice', prompt: 'ก่อนเปลี่ยนเบรกเกอร์ ต้องทำอะไรก่อน', choices: ['สับคัตเอาต์ลง', 'ทำได้เลย'], points: 1 }],
  }),
  submitPublicQuiz: (...a: unknown[]) => submitPublicQuiz(...(a as [])),
}));
const { default: PublicSkillQuizPage } = await import('./PublicSkillQuizPage');

afterEach(cleanup);
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.scrollTo = () => {};

describe('ส่งคำตอบ', () => {
  it('ยืนยันส่งแล้ว กล่อง "ส่งคำตอบ?" ไม่อยู่บนหน้าเลย เหลือหน้าขอบคุณ', async () => {
    render(
      <MemoryRouter initialEntries={['/quiz/Tk9xQ2mPq7RwZ']}>
        <Routes>
          <Route path="/quiz/:token" element={<PublicSkillQuizPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByLabelText('สับคัตเอาต์ลง'));
    fireEvent.click(screen.getByRole('button', { name: 'ส่งคำตอบ' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'ส่งคำตอบ')!);
    await screen.findByTestId('quiz-sent');
    expect(submitPublicQuiz).toHaveBeenCalledWith('Tk9xQ2mPq7RwZ', { 'q-7f3a': 0 });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.queryByText('ส่งคำตอบ?')).toBeNull();
  });
});

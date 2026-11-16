/**
 * ลิงก์เดียวของชุด (เจ้าของ 16 พ.ย. 2569 แบบ Knowa) — กรอกข้อมูล + ยินยอม PDPA ก่อนเริ่ม · เข้าซ้ำด้วยเลขบัตร+วันเกิด
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const startPublicQuiz = vi.fn(async () => 'Tk9xQ2mPq7RwZabc');
vi.mock('@/lib/skillQuizApi', () => ({
  fetchPublicQuizSet: async () => ({ title: 'ชุดช่างอาคาร', roleLabel: 'ช่างซ่อมบำรุง', questionCount: 20 }),
  startPublicQuiz: (...a: unknown[]) => startPublicQuiz(...(a as [])),
  resumePublicQuiz: vi.fn(),
}));
const { default: PublicSkillQuizEntryPage } = await import('./PublicSkillQuizEntryPage');

afterEach(cleanup);
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/quiz/s/Sx8mQ2pLr7TwZkd9']}>
      <Routes>
        <Route path="/quiz/s/:setToken" element={<PublicSkillQuizEntryPage />} />
        <Route path="/quiz/:token" element={<p>ใบของคนทำ</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ลิงก์ของชุด', () => {
  it('ยังไม่กรอก = บอกช่องที่ขาด ไม่เรียก server', async () => {
    renderPage();
    expect(await screen.findByText('ชุดช่างอาคาร')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'เริ่มทำแบบทดสอบ' }));
    expect(await screen.findByText('ใส่ชื่อ')).toBeTruthy();
    expect(startPublicQuiz).not.toHaveBeenCalled();
    expect(screen.getByTestId('pdpa-consent')).toBeTruthy();
  });

  it('เคยกรอกแล้ว = เหลือแค่เลขบัตรกับวันเกิด', async () => {
    renderPage();
    await screen.findByText('ชุดช่างอาคาร');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'เคยกรอกแล้ว' }));
    expect(await screen.findByRole('button', { name: 'เข้าแบบทดสอบ' })).toBeTruthy();
    expect(screen.queryByLabelText('ชื่อ')).toBeNull();
    expect(screen.getByLabelText('เลขบัตรประชาชน')).toBeTruthy();
    expect(screen.queryByTestId('pdpa-consent')).toBeNull();
  });
});

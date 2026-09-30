/**
 * ปฏิทินเลือกช่วงแบบใช้ง่าย (30 ก.ย. 2569 · รอบ 18)
 * 🔴 ด่าน: ปุ่มเป็นไอคอนปฏิทินอย่างเดียว แต่ชื่อปุ่ม/ตอนจี้ยังบอกช่วงเป็นภาษาคน ·
 *    เจ้าของ: *"calendar มีปุ่มยืนยันก่อน · ดู Fix ในการเลือกเกินไป ทำให้ง่ายกว่านี้"* + *"เลือกเทียบเดือน/ปี/สัปดาห์"* ⇒
 *    แท็บ วัน · สัปดาห์ · เดือน · ปี · กดครั้งแรก = หน่วยเดียว · กดอีกครั้ง = เป็นช่วง · **ไม่เปลี่ยนอะไรจนกว่าจะกดยืนยัน** ·
 *    ช่วงที่ได้มีหน่วยติดไป (กราฟจัดแท่งตามหน่วย) · เดือนที่ยังไม่ถึงกดไม่ได้ · หัวปฏิทินเป็นเดือนไทย ปี พ.ศ.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PeriodPicker from './PeriodPicker';

afterEach(() => cleanup());

const TODAY = '2026-09-30';

function open(value: { from: string | null; to: string | null; unit?: 'day' | 'week' | 'month' | 'year' } = { from: '2026-09-24', to: '2026-09-30' }) {
  const onChange = vi.fn();
  render(<PeriodPicker value={value} onChange={onChange} today={TODAY} />);
  fireEvent.click(screen.getByRole('button', { name: /ช่วงเวลา/ }));
  return onChange;
}

const tab = (name: string) => fireEvent.click(screen.getByRole('radio', { name }));
const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'ยืนยัน' }));
/** ปุ่มวันในปฏิทิน (ไม่เอาวันของเดือนข้าง ๆ) */
const day = (n: number) => {
  const cell = screen.getAllByRole('gridcell').find((c) => c.textContent === String(n) && !c.hasAttribute('data-outside'));
  return cell?.querySelector('button') ?? cell!;
};

describe('ปฏิทินเลือกช่วง', () => {
  it('ปุ่มเป็นไอคอนปฏิทินอย่างเดียว (ไม่มีคำบนปุ่ม) · ชื่อปุ่มกับตอนจี้ยังบอกช่วงเป็นภาษาคน', () => {
    render(<PeriodPicker value={{ from: '2026-09-24', to: '2026-09-30' }} onChange={vi.fn()} today={TODAY} />);
    const btn = screen.getByRole('button', { name: 'ช่วงเวลา 7 วันล่าสุด' });
    expect(btn.textContent?.trim()).toBe('');
    expect(btn.getAttribute('title')).toBe('7 วันล่าสุด');
  });

  it('รอบ 18: แท็บ วัน · สัปดาห์ · เดือน · ปี · ปุ่มยืนยันกดไม่ได้จนกว่าจะเลือกอะไรใหม่', () => {
    open();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['วัน', 'สัปดาห์', 'เดือน', 'ปี']);
    expect(screen.getByRole('radio', { name: 'วัน' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByRole('button', { name: 'ยืนยัน' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('🔴 เลือกแล้วยังไม่เปลี่ยน จนกว่าจะกดยืนยัน · บรรทัดท้ายบอกว่าจะได้ช่วงไหน', () => {
    const onChange = open();
    tab('เดือน');
    fireEvent.click(screen.getByRole('button', { name: 'สิงหาคม 2569' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('สิงหาคม 2569', { selector: '[aria-live]' })).toBeTruthy();
    confirm();
    expect(onChange).toHaveBeenCalledWith({ from: '2026-08-01', to: '2026-08-31', unit: 'month' });
  });

  it('🔴 เทียบเดือน: กดกันยา แล้วกดสิงหา = สองเดือน (กดกลับหัวก็ได้) · เดือนที่ยังไม่ถึงกดไม่ได้', () => {
    const onChange = open();
    tab('เดือน');
    expect((screen.getByRole('button', { name: 'ตุลาคม 2569' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'กันยายน 2569' }));
    fireEvent.click(screen.getByRole('button', { name: 'สิงหาคม 2569' }));
    expect(screen.getByText('ส.ค. – ก.ย. 2569', { selector: '[aria-live]' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'สิงหาคม 2569' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'กันยายน 2569' }).getAttribute('aria-pressed')).toBe('true');
    confirm();
    expect(onChange).toHaveBeenCalledWith({ from: '2026-08-01', to: '2026-09-30', unit: 'month' });
  });

  it('เทียบเดือนข้ามปี: เลื่อนปีแล้วกดต่อได้ · กดครั้งที่สามเริ่มใหม่', () => {
    const onChange = open();
    tab('เดือน');
    fireEvent.click(screen.getByRole('button', { name: 'ปีก่อน' }));
    fireEvent.click(screen.getByRole('button', { name: 'ธันวาคม 2568' }));
    fireEvent.click(screen.getByRole('button', { name: 'ปีถัดไป' }));
    fireEvent.click(screen.getByRole('button', { name: 'มกราคม 2569' }));
    expect(screen.getByText('ธ.ค. 2568 – ม.ค. 2569', { selector: '[aria-live]' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'มีนาคม 2569' }));
    expect(screen.getByText('มีนาคม 2569', { selector: '[aria-live]' })).toBeTruthy();
    confirm();
    expect(onChange).toHaveBeenCalledWith({ from: '2026-03-01', to: '2026-03-31', unit: 'month' });
  });

  it('เทียบปี: กดสองปี = ทั้งสองปี', () => {
    const onChange = open();
    tab('ปี');
    fireEvent.click(screen.getByRole('button', { name: 'ปี 2568' }));
    fireEvent.click(screen.getByRole('button', { name: 'ปี 2569' }));
    confirm();
    expect(onChange).toHaveBeenCalledWith({ from: '2025-01-01', to: '2026-12-31', unit: 'year' });
  });

  it('สัปดาห์: กดวันไหนก็ได้ = ทั้งสัปดาห์ (จันทร์–อาทิตย์) · กดอีกวัน = ถึงสัปดาห์นั้น', () => {
    const onChange = open();
    tab('สัปดาห์');
    fireEvent.click(day(15));
    expect(screen.getByText('สัปดาห์ 14–20 ก.ย. 2569', { selector: '[aria-live]' })).toBeTruthy();
    fireEvent.click(day(30));
    confirm();
    expect(onChange).toHaveBeenCalledWith({ from: '2026-09-14', to: '2026-10-04', unit: 'week' });
  });

  it('วัน: กดวันเดียวแล้วยืนยัน = วันนั้น · กดสองวัน = ช่วงวัน · หัวปฏิทินเป็นเดือนไทย ปี พ.ศ.', () => {
    const onChange = open();
    expect(screen.getByText('กันยายน 2569')).toBeTruthy();
    fireEvent.click(day(29));
    confirm();
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-09-29', to: '2026-09-29', unit: 'day' });
    fireEvent.click(screen.getByRole('button', { name: /ช่วงเวลา/ }));
    fireEvent.click(day(10));
    fireEvent.click(day(3));
    confirm();
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-09-03', to: '2026-09-10', unit: 'day' });
  });

  it('ปุ่มลัด 7 วันล่าสุด / ทั้งหมด ก็ต้องกดยืนยันเหมือนกัน', () => {
    const onChange = open({ from: '2026-08-01', to: '2026-08-31', unit: 'month' });
    expect(screen.getByRole('radio', { name: 'เดือน' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'ทั้งหมด' }));
    expect(onChange).not.toHaveBeenCalled();
    confirm();
    expect(onChange).toHaveBeenCalledWith({ from: null, to: null });
  });

  it('ปิดป๊อปโดยไม่ยืนยัน = ทิ้งที่เลือกไว้ (เปิดใหม่เริ่มจากช่วงเดิม)', () => {
    const onChange = open();
    tab('เดือน');
    fireEvent.click(screen.getByRole('button', { name: 'สิงหาคม 2569' }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /ช่วงเวลา/ }));
    expect(screen.getByRole('radio', { name: 'วัน' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('7 วันล่าสุด', { selector: '[aria-live]' })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});

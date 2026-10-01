/**
 * ป๊อปนำเข้าผู้สมัครจาก Excel (1 ต.ค. 2569)
 * 🔴 ด่าน: ตารางตัวอย่างอยู่เสมอ (ว่าง = "ยังไม่ได้เลือกไฟล์") · เลือกไฟล์ = อ่านตัวอย่าง (dry run) ไม่บันทึก ·
 *    ปุ่มนำเข้าบอกจำนวนที่จะเข้าจริง · ไม่มีแถวผ่าน = กดไม่ได้ · บันทึกแล้วบอกหน้าแม่ + ตารางเปลี่ยนเป็น "นำเข้าแล้ว"
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const runApplicationImport = vi.fn();
const downloadApplicationImportTemplate = vi.fn();
vi.mock('@/lib/applicationImportApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/applicationImportApi')>();
  return {
    ...mod,
    readFileAsBase64: vi.fn(async () => 'BASE64'),
    runApplicationImport: (...a: unknown[]) => runApplicationImport(...a),
    downloadApplicationImportTemplate: (...a: unknown[]) => downloadApplicationImportTemplate(...a),
  };
});
vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn(async () => ({ ok: true, json: async () => [] })) }));
vi.mock('@/components/shared/ChannelPicker', () => ({ default: () => <div data-testid="channel-picker" /> }));

const { default: ImportApplicantsDialog } = await import('./ImportApplicantsDialog');

afterEach(() => {
  cleanup();
  runApplicationImport.mockReset();
  downloadApplicationImportTemplate.mockReset();
});

const preview = {
  dryRun: true,
  rows: [
    { row: 2, name: 'สมชาย ใจดี', phone: '0812345678', ok: true, reason: null },
    { row: 3, name: 'สมหญิง ใจดี', phone: '0822222222', ok: false, reason: 'เบอร์นี้มีในระบบแล้ว' },
  ],
  ready: 1,
  skipped: 1,
};

describe('ImportApplicantsDialog', () => {
  it('🔴 ยังไม่เลือกไฟล์ ⇒ ตารางยังอยู่ แถว "ยังไม่ได้เลือกไฟล์" · ปุ่มนำเข้ากดไม่ได้', () => {
    render(<ImportApplicantsDialog open onClose={() => {}} onSaved={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('นำเข้าผู้สมัครจาก Excel')).toBeTruthy();
    expect(within(dialog).getByRole('columnheader', { name: 'ผล' })).toBeTruthy();
    expect(within(dialog).getByText('ยังไม่ได้เลือกไฟล์')).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: /นำเข้า 0 คน/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ดาวน์โหลดไฟล์ตัวอย่าง', async () => {
    downloadApplicationImportTemplate.mockResolvedValue(undefined);
    render(<ImportApplicantsDialog open onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /ดาวน์โหลดไฟล์ตัวอย่าง/ }));
    await waitFor(() => expect(downloadApplicationImportTemplate).toHaveBeenCalledTimes(1));
  });

  it('🔴 เลือกไฟล์ ⇒ อ่านตัวอย่าง (dry run) · บอกแถวที่ข้าม · กดนำเข้า ⇒ บันทึกจริง แล้วบอกหน้าแม่', async () => {
    runApplicationImport
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({ ...preview, dryRun: false, inserted: 1, ready: undefined });
    const onSaved = vi.fn();
    render(<ImportApplicantsDialog open onClose={() => {}} onSaved={onSaved} />);
    const input = screen.getByLabelText('ไฟล์ Excel') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'list.xlsx')] } });

    expect(await screen.findByText('เบอร์นี้มีในระบบแล้ว')).toBeTruthy();
    expect(runApplicationImport.mock.calls[0][0]).toMatchObject({ fileBase64: 'BASE64', dryRun: true, responsibleName: null });
    const save = screen.getByRole('button', { name: /นำเข้า 1 คน/ });
    fireEvent.click(save);

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(1));
    expect(runApplicationImport.mock.calls[1][0]).toMatchObject({ dryRun: false });
    expect(await screen.findByText('นำเข้าแล้ว')).toBeTruthy();
    expect(screen.getByText('นำเข้าแล้ว 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /นำเข้า \d+ คน/ })).toBeNull();
  });

  it('อ่านไฟล์ไม่ได้ ⇒ บอกข้อความจาก API', async () => {
    runApplicationImport.mockRejectedValueOnce(new Error('ไฟล์ไม่มีคอลัมน์: เบอร์โทร'));
    render(<ImportApplicantsDialog open onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText('ไฟล์ Excel'), { target: { files: [new File(['x'], 'bad.xlsx')] } });
    expect((await screen.findByRole('alert')).textContent).toBe('ไฟล์ไม่มีคอลัมน์: เบอร์โทร');
  });
});

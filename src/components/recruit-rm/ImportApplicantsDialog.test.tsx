/**
 * ป๊อปนำเข้าผู้สมัครจาก Excel (1 ต.ค. 2569)
 * 🔴 ด่าน: ตารางตัวอย่างอยู่เสมอ (ว่าง = "ยังไม่ได้เลือกไฟล์") · เลือกไฟล์ = อ่านตัวอย่าง (dry run) ไม่บันทึก ·
 *    ปุ่มนำเข้าบอกจำนวนที่จะเข้าจริง · ไม่มีแถวผ่าน = กดไม่ได้ · บันทึกแล้วบอกหน้าแม่ + ตารางเปลี่ยนเป็น "นำเข้าแล้ว"
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
    downloadImportDuplicates: (...a: unknown[]) => downloadImportDuplicates(...a),
  };
});
const downloadImportDuplicates = vi.fn();
vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn(async () => ({
    ok: true,
    json: async () => [{ id: 'u1', email: 'a@example.com', full_name: 'คุณเอ ทดสอบ', is_active: true, role: 'admin', created_at: '2026-01-01T00:00:00Z' }],
  })),
}));
// ตัวเลือกช่องทางจริงโหลดจาก API — แทนด้วยปุ่มที่เลือก "Facebook Group"
vi.mock('@/components/shared/ChannelPicker', () => ({
  default: ({ onChange }: { onChange: (c: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ id: 'c1', name: 'Facebook Group', parentId: null, parentName: null, isActive: true })}>
      เลือกช่องทางทดสอบ
    </button>
  ),
}));

const { default: ImportApplicantsDialog } = await import('./ImportApplicantsDialog');

beforeAll(() => {
  // jsdom ไม่มี scrollIntoView — Select ของ Radix เรียกตอนเปิดรายการ (แบบเดียวกับเทสต์หน้าหลัก)
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  runApplicationImport.mockReset();
  downloadApplicationImportTemplate.mockReset();
});

const preview = {
  dryRun: true,
  rows: [
    { row: 2, name: 'สมชาย ใจดี', phone: '0812345678', ok: true, reason: null },
    { row: 3, name: 'สมหญิง ใจดี', phone: '0822222222', ok: false, reason: 'สมัครเข้ามาแล้วภายใน 14 วัน (ได้ตั้งแต่ 9/10/2569)' },
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
    fireEvent.click(screen.getByRole('button', { name: /ดาวน์โหลดแบบฟอร์มนำเข้า/ }));
    await waitFor(() => expect(downloadApplicationImportTemplate).toHaveBeenCalledTimes(1));
  });

  it('🔴 เลือกไฟล์ ⇒ อ่านตัวอย่าง (dry run) · บอกแถวที่ข้าม · กดนำเข้า ⇒ บันทึกจริง แล้วบอกหน้าแม่', async () => {
    runApplicationImport
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({ ...preview, dryRun: false, inserted: 1, ready: undefined });
    const onSaved = vi.fn();
    render(<ImportApplicantsDialog open onClose={() => {}} onSaved={onSaved} />);
    const input = screen.getByLabelText(/ไฟล์ Excel/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'list.xlsx')] } });

    expect(await screen.findByText('สมัครเข้ามาแล้วภายใน 14 วัน (ได้ตั้งแต่ 9/10/2569)')).toBeTruthy();
    expect(runApplicationImport.mock.calls[0][0]).toMatchObject({ fileBase64: 'BASE64', dryRun: true, responsibleName: null });
    const save = screen.getByRole('button', { name: /นำเข้า 1 คน/ });
    // 🔴 ต้องเลือกผู้รับผิดชอบ + ช่องทางก่อน (4 ต.ค. 2569) — สองช่องโผล่หลังเลือกไฟล์
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('combobox', { name: 'ผู้รับผิดชอบ' }));
    fireEvent.click(await screen.findByRole('option', { name: 'คุณเอ ทดสอบ' }));
    fireEvent.click(await screen.findByText('เลือกช่องทางทดสอบ'));
    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(save);

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(1));
    expect(runApplicationImport.mock.calls[1][0]).toMatchObject({
      dryRun: false,
      responsibleName: 'คุณเอ ทดสอบ',
      channelLabel: 'Facebook Group',
    });
    expect(await screen.findByText('นำเข้าแล้ว')).toBeTruthy();
    expect(screen.getByText('นำเข้าแล้ว 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /นำเข้า \d+ คน/ })).toBeNull();
  });

  it('อ่านไฟล์ไม่ได้ ⇒ บอกข้อความจาก API', async () => {
    runApplicationImport.mockRejectedValueOnce(new Error('ไฟล์ไม่มีคอลัมน์: เบอร์โทร'));
    render(<ImportApplicantsDialog open onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText(/ไฟล์ Excel/), { target: { files: [new File(['x'], 'bad.xlsx')] } });
    expect((await screen.findByRole('alert')).textContent).toBe('ไฟล์ไม่มีคอลัมน์: เบอร์โทร');
  });

  it('🔴 ผู้รับผิดชอบ/ช่องทางยังไม่โผล่จนกว่าจะเลือกไฟล์', () => {
    render(<ImportApplicantsDialog open onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryByTestId('import-shared')).toBeNull();
  });

  it('🔴 มีรายชื่อซ้ำ ⇒ เด้งหน้ารายชื่อซ้ำเอง: สมัครล่าสุด · สถานะล่าสุด · ดาวน์โหลดได้ · ทำต่อกลับหน้าเดิม', async () => {
    runApplicationImport.mockResolvedValueOnce({
      ...preview,
      duplicates: [
        {
          row: 3,
          name: 'สมหญิง ใจดี',
          phone: '0822222222',
          lastAppliedAt: '2026-09-30T03:00:00Z',
          lastStatus: 'contacted',
          lastJob: 'คนสวน KYE',
          applications: 2,
          skipped: true,
          note: 'สมัครเข้ามาแล้วภายใน 14 วัน (ได้ตั้งแต่ 14/10/2569)',
        },
      ],
      duplicatesFileBase64: 'DUPES',
    });
    render(<ImportApplicantsDialog open onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText(/ไฟล์ Excel/), { target: { files: [new File(['x'], 'list.xlsx')] } });
    const view = await screen.findByTestId('import-duplicates');
    expect(within(view).getByText('รายชื่อซ้ำ 1 คน')).toBeTruthy();
    expect(within(view).getByText(/30\/9\/2569/)).toBeTruthy();
    expect(within(view).getByText('ติดต่อแล้ว')).toBeTruthy();
    expect(within(view).getByText('เคยสมัคร 2 ใบ')).toBeTruthy();
    fireEvent.click(within(view).getByRole('button', { name: /ดาวน์โหลดรายชื่อซ้ำ/ }));
    expect(downloadImportDuplicates).toHaveBeenCalledWith('DUPES');
    fireEvent.click(within(view).getByRole('button', { name: /ทำต่อ/ }));
    expect(screen.queryByTestId('import-duplicates')).toBeNull();
    expect(screen.getByRole('button', { name: /ซ้ำ 1 คน/ })).toBeTruthy();
  });
});

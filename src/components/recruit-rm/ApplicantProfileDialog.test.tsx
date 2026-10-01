/**
 * ใบประวัติผู้สมัคร — ปุ่มดูรายละเอียดของแท็บผู้สมัคร (เจ้าของสั่ง 1 ต.ค. 2569 · Choice "ใบประวัติเต็มหน้า")
 *
 * 🔴 ด่าน:
 * - เปิดมาเป็นใบประวัติเลย: หัว ชื่อ เพศ อายุ เบอร์ ตำแหน่งที่สมัคร · ข้อมูลส่วนตัว · ไฟล์ · ประวัติการสมัคร · ผลโทร
 * - ไม่มีขั้นตอนติดต่อ/นัดหมาย (อยู่ป๊อปของแท็บการติดตาม)
 * - ไฟล์ที่แนบมาเปิดให้เลย ไม่ต้องกด · ไม่แนบ = บอกว่าไม่ได้แนบไฟล์ (ส่วนนี้ไม่หาย)
 * - แก้ข้อมูลได้ ส่งเฉพาะช่องที่เปลี่ยน · ไม่เปลี่ยนอะไร = กดบันทึกไม่ได้
 * - แท็บผู้สมัครเปิดใบประวัติ แท็บอื่นยังเปิดป๊อปติดต่อ
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PublicApplication } from '@/lib/publicApplicationsApi';

const updateApplicationProfile = vi.fn();
const fetchApplicationDocument = vi.fn();

vi.mock('@/lib/publicApplicationsApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/publicApplicationsApi')>();
  return {
    ...mod,
    fetchApplicantDetailExtras: vi.fn(async () => ({
      history: [
        {
          id: 'h1',
          created_at: '2026-09-20T03:00:00.000Z',
          job_title: 'คนสวน',
          position_interest: null,
          unit_name: 'หน่วยทดสอบ',
          channel_label: 'Facebook',
          status: 'new',
        },
      ],
      aiCalls: [],
      staffCalls: [],
    })),
    updateApplicationProfile: (...a: unknown[]) => updateApplicationProfile(...a),
    fetchApplicationDocument: (...a: unknown[]) => fetchApplicationDocument(...a),
  };
});

// jsdom ไม่มี object URL
if (!('createObjectURL' in URL)) {
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:test';
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
}

const { default: ApplicantProfileDialog } = await import('./ApplicantProfileDialog');

afterEach(() => {
  cleanup();
  updateApplicationProfile.mockReset();
  fetchApplicationDocument.mockReset();
});

const app = (over: Partial<PublicApplication> = {}): PublicApplication =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    full_name: 'นายทดสอบ ระบบ',
    title_prefix: 'นาย',
    first_name: 'ทดสอบ',
    last_name: 'ระบบ',
    phone: '0812345678',
    age: 33,
    gender: 'male',
    province: 'กรุงเทพมหานคร',
    district: 'บางกะปิ',
    subdistrict: 'หัวหมาก',
    education: 'ม.ปลาย/ปวช.',
    weight_kg: 67,
    height_cm: 167,
    note: 'สะดวกช่วงเช้า',
    job_title: 'ขับรถ',
    unit_name: 'หน่วยทดสอบ',
    origin: 'self_apply',
    status: 'new',
    created_at: new Date().toISOString(),
    has_document: false,
    ...over,
  }) as PublicApplication;

const renderDialog = (a: PublicApplication, onSaved = vi.fn()) => {
  render(<ApplicantProfileDialog application={a} onClose={vi.fn()} onSaved={onSaved} />);
  return { onSaved, dialog: screen.getByRole('dialog') };
};

describe('ApplicantProfileDialog (ใบประวัติ)', () => {
  it('🔴 เปิดมาเป็นใบประวัติ: หัวชื่อ/เพศ/อายุ/เบอร์/ตำแหน่ง · 4 ส่วน · ไม่มีขั้นตอนติดต่อ', async () => {
    const { dialog } = renderDialog(app());
    expect(within(dialog).getByText('นายทดสอบ ระบบ')).toBeTruthy();
    expect(within(dialog).getByText('ชาย · 33 ปี')).toBeTruthy();
    expect(within(dialog).getByText('สมัคร ขับรถ — หน่วยทดสอบ')).toBeTruthy();
    expect(within(dialog).getByText(/สมัครวันนี้ · มาจาก สมัครใหม่/)).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: /โทรหา/ }).getAttribute('href')).toBe('tel:0812345678');
    expect(within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'ข้อมูลส่วนตัว',
      'ไฟล์ประวัติที่แนบ',
      'ประวัติการสมัคร',
      'ผลโทร',
    ]);
    expect(within(dialog).getByText('หัวหมาก บางกะปิ กรุงเทพมหานคร')).toBeTruthy();
    expect(within(dialog).getByText('“สะดวกช่วงเช้า”')).toBeTruthy();
    expect(within(dialog).queryByText('ขั้นตอนการดำเนินการ')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /ติดต่อสำเร็จ/ })).toBeNull();
    expect(await within(dialog).findByText('คนสวน — หน่วยทดสอบ')).toBeTruthy();
    expect(within(dialog).getByText('ยังไม่มีการโทร')).toBeTruthy();
  });

  it('ไม่แนบไฟล์ ⇒ บอกว่าไม่ได้แนบไฟล์ (ส่วนนี้ไม่หาย) · ไม่ยิงเส้นไฟล์', () => {
    const { dialog } = renderDialog(app());
    expect(within(dialog).getByText('ไม่ได้แนบไฟล์')).toBeTruthy();
    expect(fetchApplicationDocument).not.toHaveBeenCalled();
  });

  it('🔴 แนบไฟล์มา ⇒ เปิดให้เลยไม่ต้องกด (PDF ขึ้นในป๊อป)', async () => {
    fetchApplicationDocument.mockResolvedValue({ filename: 'cv.pdf', mime: 'application/pdf', dataBase64: 'JVBERi0x' });
    const { dialog } = renderDialog(app({ has_document: true, document_filename: 'cv.pdf', document_mime: 'application/pdf' }));
    await waitFor(() => expect(fetchApplicationDocument).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111'));
    await waitFor(() => expect(dialog.querySelector('iframe')).toBeTruthy());
    expect(within(dialog).queryByRole('button', { name: /เปิดดูไฟล์แนบ/ })).toBeNull();
  });

  it('แก้ข้อมูล: ส่งเฉพาะช่องที่เปลี่ยน · ยังไม่เปลี่ยน = บันทึกไม่ได้ · บันทึกแล้วกลับเป็นใบประวัติ', async () => {
    updateApplicationProfile.mockResolvedValue({});
    const { dialog, onSaved } = renderDialog(app());
    fireEvent.click(within(dialog).getByRole('button', { name: /แก้ไข/ }));
    const save = within(dialog).getByRole('button', { name: 'บันทึก' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('น้ำหนัก (กก.)'), { target: { value: '68' } });
    fireEvent.click(save);
    await waitFor(() => expect(updateApplicationProfile).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', { weight_kg: 68 }));
    expect(onSaved).toHaveBeenCalled();
    await waitFor(() => expect(within(dialog).queryByLabelText('น้ำหนัก (กก.)')).toBeNull());
  });

  it('เบอร์ใช้โทรไม่ได้ ⇒ มีช่องแก้เบอร์ชุดเดียวกับป๊อปติดต่อ', () => {
    const { dialog } = renderDialog(app({ phone_callable: false }));
    expect(within(dialog).getByText('เบอร์นี้ใช้กับระบบโทรไม่ได้')).toBeTruthy();
    expect(within(dialog).getByLabelText('เบอร์มือถือใหม่')).toBeTruthy();
  });
});

describe('ต่อสาย: แท็บผู้สมัครเปิดใบประวัติ · แท็บอื่นเปิดป๊อปติดต่อ', () => {
  it('RmWorkspace เลือกป๊อปตามแท็บ · ป๊อปติดต่อใช้ช่องแก้เบอร์ตัวกลาง', () => {
    const ws = fs.readFileSync(path.resolve(__dirname, 'RmWorkspace.tsx'), 'utf8');
    expect(ws).toMatch(/action === 'view' && tab === 'candidates'[\s\S]{0,40}setProfileApp\(row\)/);
    expect(ws).toContain('<ApplicantProfileDialog');
    const contact = fs.readFileSync(path.resolve(__dirname, 'ApplicantContactDialog.tsx'), 'utf8');
    expect(contact).toContain('<ApplicantPhoneFix');
  });
});

/**
 * ไฟล์แนบในป๊อป "ดูรายละเอียด" — เจ้าของแจ้ง 7 ก.ย. 2569 ว่า *"มีไฟล์แนบมาแต่ดูไม่ได้"*
 *
 * 🔴 ด่านที่ห้ามหลุด (ต้นเหตุเดิมคือ "ไม่มีส่วนนี้ในป๊อปเลย"):
 * 1. มีไฟล์แนบ ⇒ ต้องมีปุ่มเปิดดู · ไม่มีไฟล์แนบ ⇒ ไม่วาดอะไร
 * 2. กดแล้ว **เปิดดูได้จริง** — PDF ขึ้น iframe · รูปขึ้น img · ชนิดอื่นบอกให้ดาวน์โหลด
 * 3. ใช้ `blob:` (เบราว์เซอร์บล็อก `data:` ในแท็บใหม่/iframe) และ revoke คืนเสมอ
 * 4. เปิดคนใหม่ต้องไม่เห็นไฟล์ของคนก่อน
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

import ApplicantAttachmentPanel from './ApplicantAttachmentPanel';

const fetchDoc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/publicApplicationsApi', () => ({ fetchApplicationDocument: fetchDoc }));

const created: string[] = [];
const revoked: string[] = [];

beforeEach(() => {
  cleanup();
  created.length = 0;
  revoked.length = 0;
  fetchDoc.mockReset();
  // jsdom ไม่มี object URL — ปลอมให้ตรวจได้ว่าเราสร้าง/คืนจริง
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (b: Blob) => {
      const u = `blob:mock/${created.length}-${b.type || 'none'}`;
      created.push(u);
      return u;
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: (u: string) => revoked.push(u),
  });
});

afterEach(cleanup);

/** "PDF" ก้อนเล็ก ๆ เป็น base64 (แค่ต้อง decode ผ่าน ไม่ต้องเป็นไฟล์จริง) */
const B64 = btoa('%PDF-1.4 hello');

describe('ไม่มีไฟล์แนบ', () => {
  it('ไม่วาดอะไรเลย — ไม่มีกรอบเปล่าหลอกตา', () => {
    const { container } = render(<ApplicantAttachmentPanel applicationId="a1" />);
    expect(container.innerHTML).toBe('');
  });

  it('has_document = false ก็ไม่วาด', () => {
    const { container } = render(
      <ApplicantAttachmentPanel applicationId="a1" hasDocument={false} />,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('มีไฟล์แนบ — ต้องเปิดดูได้จริง', () => {
  it('โชว์ชื่อไฟล์ + ปุ่มเปิดดู และยังไม่ยิงเส้นจนกว่าจะกด (ไฟล์ base64 ก้อนใหญ่)', () => {
    render(
      <ApplicantAttachmentPanel
        applicationId="a1"
        hasDocument
        filename="resume.pdf"
        mime="application/pdf"
      />,
    );
    expect(screen.getByText('resume.pdf')).toBeTruthy();
    expect(screen.getByText('ไฟล์ PDF')).toBeTruthy();
    expect(screen.getByRole('button', { name: /เปิดดูไฟล์แนบ/ })).toBeTruthy();
    expect(fetchDoc).not.toHaveBeenCalled();
  });

  it('🔴 กด "เปิดดูไฟล์แนบ" → PDF ขึ้นพรีวิวในป๊อป + ลิงก์แท็บใหม่/ดาวน์โหลดใช้ blob:', async () => {
    fetchDoc.mockResolvedValue({ filename: 'resume.pdf', mime: 'application/pdf', dataBase64: B64 });
    const { container } = render(
      <ApplicantAttachmentPanel applicationId="a1" hasDocument filename="resume.pdf" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /เปิดดูไฟล์แนบ/ }));

    const frame = await waitFor(() => {
      const f = container.querySelector('iframe');
      expect(f).not.toBeNull();
      return f!;
    });
    expect(fetchDoc).toHaveBeenCalledWith('a1');
    expect(frame.getAttribute('src')).toBe(created[0]);
    expect(created[0].startsWith('blob:')).toBe(true);

    const openTab = screen.getByText('เปิดแท็บใหม่').closest('a')!;
    expect(openTab.getAttribute('href')).toBe(created[0]);
    expect(openTab.getAttribute('target')).toBe('_blank');
    const dl = screen.getByText('ดาวน์โหลด').closest('a')!;
    expect(dl.getAttribute('download')).toBe('resume.pdf');
  });

  it('รูปภาพขึ้นเป็น <img> ไม่ใช่ iframe', async () => {
    fetchDoc.mockResolvedValue({ filename: 'idcard.jpg', mime: 'image/jpeg', dataBase64: B64 });
    const { container } = render(
      <ApplicantAttachmentPanel applicationId="a2" hasDocument filename="idcard.jpg" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /เปิดดูไฟล์แนบ/ }));
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('img')!.getAttribute('src')).toBe(created[0]);
  });

  it('ชนิดที่พรีวิวไม่ได้ ⇒ บอกให้เปิดแท็บใหม่/ดาวน์โหลด ไม่ใช่กรอบว่าง', async () => {
    fetchDoc.mockResolvedValue({
      filename: 'cv.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      dataBase64: B64,
    });
    render(<ApplicantAttachmentPanel applicationId="a3" hasDocument filename="cv.docx" />);
    fireEvent.click(screen.getByRole('button', { name: /เปิดดูไฟล์แนบ/ }));
    await waitFor(() => expect(screen.getByText(/เปิดดูในหน้านี้ไม่ได้/)).toBeTruthy());
    expect(screen.getByText('เปิดแท็บใหม่')).toBeTruthy();
  });

  it('โหลดไม่สำเร็จ ⇒ บอกเหตุผลบนจอ ไม่เงียบ', async () => {
    fetchDoc.mockRejectedValue(new Error('โหลดไฟล์แนบไม่สำเร็จ'));
    render(<ApplicantAttachmentPanel applicationId="a4" hasDocument filename="x.pdf" />);
    fireEvent.click(screen.getByRole('button', { name: /เปิดดูไฟล์แนบ/ }));
    await waitFor(() => expect(screen.getByText('โหลดไฟล์แนบไม่สำเร็จ')).toBeTruthy());
  });

  it('เปิดคนใหม่ ⇒ ล้างไฟล์ของคนเก่า + คืน object URL', async () => {
    fetchDoc.mockResolvedValue({ filename: 'a.pdf', mime: 'application/pdf', dataBase64: B64 });
    const { rerender, container } = render(
      <ApplicantAttachmentPanel applicationId="a5" hasDocument filename="a.pdf" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /เปิดดูไฟล์แนบ/ }));
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());

    rerender(<ApplicantAttachmentPanel applicationId="a6" hasDocument filename="b.pdf" />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(revoked).toContain(created[0]);
    expect(screen.getByRole('button', { name: /เปิดดูไฟล์แนบ/ })).toBeTruthy();
  });
});

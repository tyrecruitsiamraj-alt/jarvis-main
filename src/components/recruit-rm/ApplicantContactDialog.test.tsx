/**
 * ป๊อป "รายละเอียดผู้สมัคร" แบบรูป iRecruit (เจ้าของสั่ง 1 ต.ค. 2569)
 *
 * 🔴 ด่าน:
 * - หน้าตาตามรูป: หัว "รายละเอียดผู้สมัคร" · ขั้นตอนการดำเนินการ 3 ขั้น · แท็บ 6 แท็บ · ปุ่มบันทึก/ปิด
 * - กดเลือกในขั้นตอนยังไม่เขียน จนกด "บันทึก" · ไม่มีอะไรเปลี่ยน = กดบันทึกไม่ได้
 * - Journey 4 ต.ค. 2569: ติดต่อสำเร็จ → นัดหมาย / นัดหมายไม่สำเร็จ · นัดหมาย = วัน + สถานที่ (รายการ iRecruit) + หน่วยงาน
 *   · นัดหมายไม่สำเร็จ = เหตุผล (ขั้น 2) · ติดต่อไม่สำเร็จ = เหตุผลอย่างเดียว ไม่มีปุ่มนัด
 * - ติดตามนัดกดไม่ได้ถ้ายังไม่มีนัด · แก้ข้อมูลแล้วส่งเฉพาะช่องที่เปลี่ยน
 * - ก้อน "ยกเลิกข้อมูลผู้สมัคร" ยังไม่มี (Choice เจ้าของ)
 * - แท็บว่างยังเป็นตาราง (หัวคอลัมน์ + แถว "ไม่มี…")
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PublicApplication } from '@/lib/publicApplicationsApi';

const saveContactLog = vi.fn();
const updateApplicationProfile = vi.fn();
const recordAppointmentAttendance = vi.fn();
const setApplicationCancelled = vi.fn();

vi.mock('@/lib/applicationContactsApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/applicationContactsApi')>();
  return {
    ...mod,
    fetchContactLogs: vi.fn(async () => []),
    saveContactLog: (...a: unknown[]) => saveContactLog(...a),
  };
});
vi.mock('@/lib/publicApplicationsApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/publicApplicationsApi')>();
  return {
    ...mod,
    fetchApplicantDetailExtras: vi.fn(async () => ({ history: [], aiCalls: [], staffCalls: [] })),
    fetchAttendanceLogs: vi.fn(async () => []),
    updateApplicationProfile: (...a: unknown[]) => updateApplicationProfile(...a),
    recordAppointmentAttendance: (...a: unknown[]) => recordAppointmentAttendance(...a),
    setApplicationCancelled: (...a: unknown[]) => setApplicationCancelled(...a),
  };
});
// เหตุผลแยกตามขั้น — ขั้น 2 (นัดหมาย × ไม่สำเร็จ) มีตัวเลือกให้กด
vi.mock('@/lib/recruitReasonsApi', () => ({
  fetchRecruitReasons: vi.fn(async (o: { processCode?: string } = {}) =>
    o.processCode === '2'
      ? [{ id: 'r-appt', processCode: '2', outcomeCode: 'C', name: 'ไม่สะดวกสมัคร', sortOrder: 1, isActive: true }]
      : [],
  ),
}));
// jsdom ไม่มี scrollIntoView — Select ของ Radix เรียกตอนเปิดรายการ
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
vi.mock('@/lib/siamrajUnitRequestsApi', () => ({ fetchSiamrajUnitRequests: vi.fn(async () => []) }));

const { default: ApplicantContactDialog } = await import('./ApplicantContactDialog');

afterEach(() => {
  cleanup();
  saveContactLog.mockReset();
  updateApplicationProfile.mockReset();
  recordAppointmentAttendance.mockReset();
  setApplicationCancelled.mockReset();
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
    status: 'contacted',
    created_at: '2026-09-30T03:00:00.000Z',
    has_document: false,
    ...over,
  }) as PublicApplication;

const renderDialog = (a: PublicApplication, onSaved = vi.fn(), onClose = vi.fn()) => {
  render(<ApplicantContactDialog application={a} onClose={onClose} onSaved={onSaved} />);
  return { onSaved, onClose, dialog: screen.getByRole('dialog') };
};

describe('ApplicantContactDialog (โฉม iRecruit)', () => {
  it('หน้าตาตามรูป: หัว · 3 ขั้น · 6 แท็บ · บันทึก/ปิด · ไม่มีก้อนยกเลิกข้อมูลผู้สมัคร', () => {
    const { dialog } = renderDialog(app());
    expect(within(dialog).getByText('รายละเอียดผู้สมัคร')).toBeTruthy();
    expect(within(dialog).getByText('ขั้นตอนการดำเนินการ')).toBeTruthy();
    for (const t of ['การติดต่อ', 'การนัดหมาย', 'การติดตามนัด']) {
      expect(within(dialog).getAllByText(t).length).toBeGreaterThan(0);
    }
    for (const t of ['ข้อมูลผู้สมัคร', 'ประวัติการสมัคร', 'การโทร', 'การติดต่อ', 'การนัดหมาย', 'ติดตามนัดหมาย']) {
      expect(within(dialog).getByRole('tab', { name: t })).toBeTruthy();
    }
    expect(within(dialog).getByText('ข้อมูลส่วนตัวและการสมัคร')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /แก้ไขข้อมูล/ })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'ปิด' })).toBeTruthy();
    expect(within(dialog).queryByText('ยกเลิกข้อมูลผู้สมัคร')).toBeNull();
    // ยังไม่เปลี่ยนอะไร = บันทึกไม่ได้
    expect((within(dialog).getByRole('button', { name: 'บันทึก' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ผลติดต่อล่าสุด "สำเร็จ" ⇒ ปุ่มติดต่อสำเร็จถูกเลือกไว้ตั้งแต่เปิด', () => {
    const { dialog } = renderDialog(app({ last_contact_ok: true }));
    expect(within(dialog).getByRole('button', { name: /ติดต่อสำเร็จ/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(dialog).getByRole('button', { name: /ติดต่อไม่สำเร็จ/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('🔴 กดติดต่อสำเร็จ → บันทึก ⇒ ผลติดต่อสำเร็จไม่มีนัด แล้วปิดป๊อป', async () => {
    saveContactLog.mockResolvedValue({});
    const { dialog, onSaved, onClose } = renderDialog(app());
    fireEvent.click(within(dialog).getByRole('button', { name: /ติดต่อสำเร็จ/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saveContactLog).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, appointmentAt: null, reasonId: null, jobId: null, jobLabel: null }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('ติดต่อไม่สำเร็จ ⇒ ต้องเลือกเหตุผลก่อน + ไม่มีปุ่มนัดหมาย (Journey ข้อ 6)', () => {
    const { dialog } = renderDialog(app());
    fireEvent.click(within(dialog).getByRole('button', { name: /ติดต่อไม่สำเร็จ/ }));
    expect(within(dialog).getByRole('combobox', { name: 'เหตุผลที่ติดต่อไม่สำเร็จ' })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /^นัดหมาย/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('เลือกเหตุผลที่ติดต่อไม่สำเร็จ');
    expect(saveContactLog).not.toHaveBeenCalled();
  });

  it('🔴 Journey ข้อ 4: ยังไม่ติดต่อสำเร็จ = ไม่มีปุ่มนัด · กดติดต่อสำเร็จ ⇒ นัดหมาย / นัดหมายไม่สำเร็จ ขึ้น', () => {
    const { dialog } = renderDialog(app());
    const step = within(dialog).getByTestId('step-appointment');
    expect(within(step).queryByRole('button', { name: /นัดหมาย/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: /ติดต่อสำเร็จ/ }));
    expect(within(step).getByRole('button', { name: /^นัดหมาย$/ })).toBeTruthy();
    expect(within(step).getByRole('button', { name: /นัดหมายไม่สำเร็จ/ })).toBeTruthy();
  });

  it('ผลล่าสุดติดต่อสำเร็จ + มีนัดเดิม ⇒ ปุ่มเป็น "นัดหมายใหม่"', () => {
    const { dialog } = renderDialog(app({ last_contact_ok: true, appointment_at: '2026-09-15T05:00:00.000Z' }));
    const step = within(dialog).getByTestId('step-appointment');
    expect(within(step).getByRole('button', { name: /นัดหมายใหม่/ })).toBeTruthy();
  });

  it('นัดหมายโดยไม่ใส่วัน ⇒ บอกให้ใส่วันนัด ไม่ยิงอะไร · สถานที่เป็นรายการแบบ iRecruit', async () => {
    const { dialog } = renderDialog(app());
    fireEvent.click(within(dialog).getByRole('button', { name: /ติดต่อสำเร็จ/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: /^นัดหมาย$/ }));
    expect(within(dialog).getByTestId('new-appointment')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'สถานที่นัดหมาย' }));
    for (const p of ['บูธคู้บอน', 'สำนักงานใหญ่', 'Online', 'อื่นๆ']) {
      expect(await screen.findByRole('option', { name: p })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('option', { name: 'อื่นๆ' }));
    expect(within(dialog).getByRole('textbox', { name: 'ชื่อสถานที่นัดหมาย' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('นัดหมายต้องใส่วันนัด');
    expect(saveContactLog).not.toHaveBeenCalled();
  });

  it('🔴 นัดหมายไม่สำเร็จ ⇒ ต้องเลือกเหตุผล แล้วบันทึกเป็นติดต่อสำเร็จ + นัดไม่สำเร็จ + เหตุผล ไม่มีวันนัด', async () => {
    saveContactLog.mockResolvedValue({});
    const { dialog, onClose } = renderDialog(app());
    fireEvent.click(within(dialog).getByRole('button', { name: /ติดต่อสำเร็จ/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: /นัดหมายไม่สำเร็จ/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('เลือกเหตุผลที่นัดหมายไม่สำเร็จ');
    expect(saveContactLog).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'เหตุผลที่นัดหมายไม่สำเร็จ' }));
    fireEvent.click(await screen.findByRole('option', { name: 'ไม่สะดวกสมัคร' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saveContactLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        appointmentFailed: true,
        reasonId: 'r-appt',
        reasonLabel: 'ไม่สะดวกสมัคร',
        appointmentAt: null,
        appointmentPlace: null,
      }),
    );
  });

  it('นัดหมายเดิมขึ้นในขั้นที่ 2 · ไม่มีนัด = ไม่โชว์ช่องนัด + ปุ่มติดตามนัดกดไม่ได้', () => {
    const withAppt = renderDialog(
      app({ appointment_at: '2026-09-15T05:00:00.000Z', appointment_place: 'สาขาลาดพร้าว', appointment_job: 'หน่วย ก' }),
    ).dialog;
    const step = within(withAppt).getByTestId('step-appointment');
    expect(within(step).getByText('15/9/2569')).toBeTruthy();
    expect(within(step).getByText('สาขาลาดพร้าว')).toBeTruthy();
    expect(within(step).getByText('หน่วย ก')).toBeTruthy();
    cleanup();
    const noAppt = renderDialog(app()).dialog;
    // ยังไม่มีนัด = ไม่โชว์ช่อง นัดหมายวันที่/สถานที่/ลงหน่วยงาน ที่เป็นขีด (เจ้าของสั่ง 4 ต.ค. 2569)
    expect(within(noAppt).queryByTestId('current-appointment')).toBeNull();
    expect(within(within(noAppt).getByTestId('step-appointment')).queryByText('นัดหมายวันที่')).toBeNull();
    const follow = within(noAppt).getByTestId('step-follow-up');
    const ok = within(follow).getByRole('button', { name: /ติดตามสำเร็จ/ }) as HTMLButtonElement;
    expect(ok.disabled).toBe(true);
    expect(ok.title).toBe('ยังไม่มีนัดหมาย');
  });

  it('🔴 ติดตามไม่สำเร็จ ⇒ ต้องเลือกไม่มา/เลื่อนนัด แล้วบันทึกผลติดตามนัดของนัดเดิม', async () => {
    recordAppointmentAttendance.mockResolvedValue(undefined);
    const { dialog, onClose } = renderDialog(app({ appointment_at: '2026-09-15T05:00:00.000Z' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /ติดตามไม่สำเร็จ/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('เลือกว่าไม่มา หรือ เลื่อนนัด');
    fireEvent.click(within(dialog).getByRole('button', { name: 'ไม่มา' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(recordAppointmentAttendance).toHaveBeenCalledWith({
      applicationId: '11111111-1111-4111-8111-111111111111',
      appointmentAt: '2026-09-15T05:00:00.000Z',
      result: 'no_show',
    });
    expect(saveContactLog).not.toHaveBeenCalled();
  });

  it('🔴 แก้ข้อมูล: เปลี่ยนอายุ → บันทึก ⇒ ส่งเฉพาะช่องที่เปลี่ยน · ยกเลิกแก้ไข = ไม่ส่งอะไร', async () => {
    updateApplicationProfile.mockResolvedValue({});
    const { dialog, onClose } = renderDialog(app());
    fireEvent.click(within(dialog).getByRole('button', { name: /แก้ไขข้อมูล/ }));
    const age = within(dialog).getByRole('spinbutton', { name: 'อายุ' });
    fireEvent.change(age, { target: { value: '34' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateApplicationProfile).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', { age: 34 });
  });

  it('แก้ข้อมูลผิดช่วง ⇒ บอกข้อผิดก่อนส่ง', () => {
    const { dialog } = renderDialog(app());
    fireEvent.click(within(dialog).getByRole('button', { name: /แก้ไขข้อมูล/ }));
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'อายุ' }), { target: { value: '9' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('อายุต้องอยู่ระหว่าง 15–80 ปี');
    expect(updateApplicationProfile).not.toHaveBeenCalled();
  });

  it('🔴 โหมดฝัง (ป๊อปดูรายชื่อของกล่องงาน) — ไม่ห่อ Dialog ซ้อน แต่ยังมีหัว/ขั้นตอน/แท็บครบ', () => {
    render(<ApplicantContactDialog embedded application={app()} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('รายละเอียดผู้สมัคร')).toBeTruthy();
    expect(screen.getByTestId('step-contact')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'ติดตามนัดหมาย' })).toBeTruthy();
  });

  it('🔴 แท็บว่างยังเป็นตาราง: หัวคอลัมน์ + แถว "ไม่มี…"', async () => {
    const { dialog } = renderDialog(app());
    fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'การโทร' }));
    fireEvent.click(within(dialog).getByRole('tab', { name: 'การโทร' }));
    expect(await within(dialog).findByText('ยังไม่มีการโทร')).toBeTruthy();
    expect(within(dialog).getByRole('columnheader', { name: 'ใครโทร' })).toBeTruthy();
  });
});

/** ปุ่มดูข้อมูลของแท็บผู้สมัคร = ป๊อปแบบรูป iRecruit (เจ้าของ 4 ต.ค. 2569) */
describe('โหมด profile (แท็บผู้สมัคร)', () => {
  it('ไม่มีขั้นตอน 3 ขั้น · แท็บ 6 อันครบ · ปุ่มล่างเหลือปิด · มีก้อนยกเลิกข้อมูลผู้สมัคร', async () => {
    render(<ApplicantContactDialog mode="profile" application={app()} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryByTestId('step-contact')).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /^บันทึก$/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'ปิด' })).toBeTruthy();
    expect(screen.getByTestId('cancel-applicant')).toBeTruthy();
  });

  it('🔴 ยกเลิกข้อมูล = ยืนยันในป๊อปเดิมก่อน (ไม่ซ้อนป๊อป) แล้วส่งเหตุผล · บอกหน้าแม่', async () => {
    setApplicationCancelled.mockResolvedValue(undefined);
    const onCancelled = vi.fn();
    render(
      <ApplicantContactDialog mode="profile" application={app()} onClose={() => {}} onSaved={() => {}} onCancelled={onCancelled} />,
    );
    const box = screen.getByTestId('cancel-applicant');
    fireEvent.click(within(box).getByRole('button', { name: 'ยกเลิกข้อมูล' }));
    expect(setApplicationCancelled).not.toHaveBeenCalled();
    fireEvent.change(within(box).getByLabelText('เหตุผลที่ยกเลิก'), { target: { value: 'ไม่สะดวกแล้ว' } });
    fireEvent.click(within(box).getByRole('button', { name: /ยืนยันยกเลิก/ }));
    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(setApplicationCancelled).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', true, 'ไม่สะดวกแล้ว');
  });

  it('โหมดเดิม (แท็บการติดต่อ) ยังมีขั้นตอน 3 ขั้น และไม่มีก้อนยกเลิก', () => {
    render(<ApplicantContactDialog application={app()} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByTestId('step-contact')).toBeTruthy();
    expect(screen.queryByTestId('cancel-applicant')).toBeNull();
  });
});

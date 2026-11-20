/**
 * Gen link เลือกผู้รับผิดชอบได้ (เจ้าของ 19 พ.ย. 2569
 * "พวกนี้มีเจ้าหน้าที่สรรหารับผิดชอบนะ ตอน gen link เพิ่มให้สามารถเลือกคนรับผิดชอบด้วยเลย" · "หมายถึงให้มีชื่อเจ้าหน้าที่สรรหาด้วย")
 * รายชื่อ = สายสรรหา + ทีม Online · กล่องลอยค่าเริ่ม = ผู้รับผิดชอบของกล่อง (ตรงรายชื่อ) › คนกด · ใบขอ = คนกด
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RecruitPosting } from '@/lib/recruitPostings';
import {
  linkResponsibleOptions,
  linkResponsibleValue,
  mergeResponsibleStaff,
  standaloneBoxResponsible,
} from '@/lib/linkResponsible';
import { postingLinkCreator } from '@/lib/recruitPostings';

const ME = { id: 'u-me', full_name: 'Tangmay S', nickname: 'ตังเมย์', email: 'tangmay@siamraj.com' };
const BEE = { id: 'u-b', name: 'Bee K', label: 'บี' };
const WAN = { id: 'u-w', name: 'Wan P', label: 'ว่าน' };

vi.mock('@/contexts/AuthContext', () => ({
  useOptionalAuthUser: () => ME,
  useAuth: () => ({ user: ME, hasPermission: () => true }),
}));
/** สายสรรหา = บี · ทีม Online = ว่าน */
const fetchResponsibleNames = vi.fn(async (lane?: string) => (lane === 'online' ? [WAN] : [BEE]));
vi.mock('@/lib/applicationImportApi', () => ({
  fetchResponsibleNames: (lane?: string) => fetchResponsibleNames(lane),
}));
// Select ของ Radix เปิดใน jsdom ไม่ได้ — แทนด้วย <select> ธรรมดา (ค่า/ตัวเลือกชุดเดียวกัน)
vi.mock('@/components/shared/FieldSelect', () => ({
  FieldSelect: ({
    value,
    onChange,
    options,
    ariaLabel,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
    ariaLabel?: string;
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
const createRecruitPosting = vi.fn(async (_body: Record<string, unknown>) => ({
  id: 'p-new',
  links: [{ id: 'l1', code: 'abc', channelLabel: null }],
}));
const addPostingLink = vi.fn(async (_id: string, _input: Record<string, unknown>) => ({
  id: 'l2',
  channelId: null,
  channelLabel: null,
  code: 'def',
  note: null,
  hitCount: 0,
  createdAt: '2026-11-19T03:00:00Z',
}));
/** ประกาศเก่าของกล่องลอย — ผู้รับผิดชอบเก็บเป็นชื่อ */
let boxPostings: Array<Partial<RecruitPosting>> = [];
const fetchRecruitPostings = vi.fn(async (_o?: unknown) => boxPostings);
vi.mock('@/lib/recruitPostingsApi', () => ({
  createRecruitPosting: (body: Record<string, unknown>) => createRecruitPosting(body),
  addPostingLink: (id: string, input: Record<string, unknown>) => addPostingLink(id, input),
  fetchRecruitPostings: (o?: unknown) => fetchRecruitPostings(o),
}));
vi.mock('@/components/shared/MultiChannelPicker', () => ({ default: () => null }));
vi.mock('@/components/shared/JobTitleField', () => ({ default: () => null }));

const { default: GenApplyLinkDialog } = await import('./GenApplyLinkDialog');
const { default: AddChannelLinks } = await import('./AddChannelLinks');

beforeEach(() => {
  createRecruitPosting.mockClear();
  addPostingLink.mockClear();
  fetchResponsibleNames.mockClear();
  fetchRecruitPostings.mockClear();
  boxPostings = [];
});

describe('ตัวเลือกผู้รับผิดชอบ', () => {
  it('รวมสายสรรหา + Online ไม่ซ้ำคน · คนกดอยู่บนสุดเป็นชื่อเล่น', () => {
    const staff = mergeResponsibleStaff([[BEE, { id: ME.id, name: 'Tangmay S', label: 'ตังเมย์' }], [WAN, BEE]]);
    expect(staff.map((s) => s.id).sort()).toEqual(['u-b', 'u-me', 'u-w']);
    expect(linkResponsibleOptions(staff, ME)).toEqual([
      { value: 'u-me', label: 'ตังเมย์' },
      { value: 'u-b', label: 'บี' },
      { value: 'u-w', label: 'ว่าน' },
    ]);
  });
  it('ค่าเริ่ม: เลือกเอง › ชื่อผู้รับผิดชอบกล่องที่ตรงรายชื่อ (ชื่อเล่น/ชื่อเต็ม) › คนกด', () => {
    expect(linkResponsibleValue('', ME)).toBe('u-me');
    expect(linkResponsibleValue('u-b', ME, [WAN], 'ว่าน')).toBe('u-b');
    expect(linkResponsibleValue('', ME, [BEE, WAN], 'ว่าน')).toBe('u-w');
    expect(linkResponsibleValue('', ME, [BEE, WAN], ' wan p ')).toBe('u-w');
    expect(linkResponsibleValue('', ME, [BEE, WAN], 'เจมส์')).toBe('u-me');
    expect(linkResponsibleValue('', null)).toBe('');
  });
  it('ผู้รับผิดชอบของกล่อง = ชื่อในประกาศล่าสุดของกล่องนั้น (BU เดียวกันก่อน)', () => {
    const list = [
      { standaloneKind: 'valet', departmentCode: 'LBD', responsibleName: 'ว่าน', createdAt: '2026-11-01T00:00:00Z' },
      { standaloneKind: 'valet', departmentCode: 'LBA', responsibleName: 'บี', createdAt: '2026-11-10T00:00:00Z' },
      { standaloneKind: 'valet', departmentCode: 'LBD', responsibleName: null, createdAt: '2026-11-15T00:00:00Z' },
      { standaloneKind: 'central', departmentCode: 'LBD', responsibleName: 'เจมส์', createdAt: '2026-11-18T00:00:00Z' },
    ] as RecruitPosting[];
    expect(standaloneBoxResponsible(list, 'valet', 'LBD')).toBe('ว่าน');
    expect(standaloneBoxResponsible(list, 'valet', 'LBM')).toBe('บี');
    expect(standaloneBoxResponsible(list, 'government', 'LBD')).toBeNull();
  });
  it('บรรทัด "Gen link ล่าสุด … โดย" ใช้ชื่อของลิงก์จาก API (= ผู้รับผิดชอบ › คนกด)', () => {
    expect(postingLinkCreator({ createdByName: 'บี', createdAt: '2026-11-19T03:00:00Z' }, null)).toBe('บี');
  });
});

describe('ฟอร์ม Gen link ของกล่องลอย', () => {
  const standalone = { kind: 'valet', kindLabel: 'Valet parking', departmentCode: 'LBD' };

  it('ช่องเดิมช่องเดียว รายชื่อมีทั้งสายสรรหาและทีม Online · กล่องไม่มีผู้รับผิดชอบ = คนกด', async () => {
    render(<GenApplyLinkDialog open job={null} standalone={standalone} onClose={() => undefined} />);
    await screen.findByRole('option', { name: 'ว่าน' });
    expect(screen.getByRole('option', { name: 'บี' })).toBeTruthy();
    expect(fetchResponsibleNames.mock.calls.map(([l]) => l).sort()).toEqual(['online', 'recruiter']);
    expect(screen.getAllByLabelText('เจ้าหน้าที่สรรหา')).toHaveLength(1);
    expect((screen.getByLabelText('เจ้าหน้าที่สรรหา') as HTMLSelectElement).value).toBe('u-me');
    fireEvent.click(screen.getByRole('button', { name: /Gen link/ }));
    await waitFor(() => expect(createRecruitPosting).toHaveBeenCalledTimes(1));
    expect(createRecruitPosting.mock.calls[0][0]).toMatchObject({ responsibleUserId: 'u-me', responsibleName: null, standaloneKind: 'valet' });
  });

  it('ช่องเจ้าหน้าที่สรรหาอยู่บนสุดของฟอร์ม ก่อนหัวข้อประกาศ (เจ้าของ 20 พ.ย. 2569 "ทำไมยังไม่มีให้เลือกเจ้าหน้าที่สรรหา")', async () => {
    render(<GenApplyLinkDialog open job={null} standalone={standalone} onClose={() => undefined} />);
    await screen.findByRole('option', { name: 'ว่าน' });
    const field = screen.getByLabelText('เจ้าหน้าที่สรรหา');
    const heading = screen.getByText('หัวข้อประกาศ');
    expect(field.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('ผู้รับผิดชอบ')).toBeNull();
  });

  it('ค่าเริ่ม = ผู้รับผิดชอบของกล่องที่บันทึกไว้ (ตรงคนในรายชื่อ) · เลือกคนอื่นได้', async () => {
    boxPostings = [{ standaloneKind: 'valet', departmentCode: 'LBD', responsibleName: 'ว่าน', createdAt: '2026-11-17T00:00:00Z' }];
    render(<GenApplyLinkDialog open job={null} standalone={standalone} onClose={() => undefined} />);
    await waitFor(() => expect((screen.getByLabelText('เจ้าหน้าที่สรรหา') as HTMLSelectElement).value).toBe('u-w'));
    expect(fetchRecruitPostings).toHaveBeenCalledWith({ standaloneOnly: true });
    fireEvent.change(screen.getByLabelText('เจ้าหน้าที่สรรหา'), { target: { value: 'u-b' } });
    fireEvent.click(screen.getByRole('button', { name: /Gen link/ }));
    await waitFor(() => expect(createRecruitPosting).toHaveBeenCalledTimes(1));
    expect(createRecruitPosting.mock.calls[0][0]).toMatchObject({ responsibleUserId: 'u-b' });
  });

  it('ผู้รับผิดชอบของกล่องไม่อยู่ในรายชื่อตอนนี้ = ค่าเริ่มเป็นคนกด', async () => {
    boxPostings = [{ standaloneKind: 'valet', departmentCode: 'LBD', responsibleName: 'คนลาออกแล้ว', createdAt: '2026-11-17T00:00:00Z' }];
    render(<GenApplyLinkDialog open job={null} standalone={standalone} onClose={() => undefined} />);
    await screen.findByRole('option', { name: 'ว่าน' });
    await waitFor(() => expect(fetchRecruitPostings).toHaveBeenCalled());
    expect((screen.getByLabelText('เจ้าหน้าที่สรรหา') as HTMLSelectElement).value).toBe('u-me');
  });
});

describe('Gen link ของใบขอ', () => {
  it('Gen link เพิ่ม: ค่าเริ่ม = คนกด (ไม่อ่านผู้รับผิดชอบกล่อง) · เลือกคนอื่นแล้ว id ไปกับทุกลิงก์', async () => {
    const posting = { id: 'p1', title: 'คนขับรถ', links: [], status: 'open' } as unknown as RecruitPosting;
    render(<AddChannelLinks posting={posting} />);
    const pick = (await screen.findByLabelText('เจ้าหน้าที่สรรหา')) as HTMLSelectElement;
    expect(pick.value).toBe('u-me');
    await screen.findByRole('option', { name: 'บี' });
    fireEvent.change(pick, { target: { value: 'u-b' } });
    fireEvent.click(screen.getByRole('button', { name: /Gen link กลาง 1 อัน/ }));
    await waitFor(() => expect(addPostingLink).toHaveBeenCalledTimes(1));
    expect(addPostingLink.mock.calls[0]).toEqual(['p1', { responsibleUserId: 'u-b' }]);
    expect(fetchRecruitPostings).not.toHaveBeenCalled();
  });
});

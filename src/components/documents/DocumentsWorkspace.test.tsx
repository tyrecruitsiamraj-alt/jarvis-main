/**
 * แท็บเอกสาร — ลิงก์จากกระดิ่งเปิดคนนั้นและชุดนั้นทันที (22 พ.ย. 2569)
 * DOC-055/061 เปิด applicationId + packetId ที่แจ้ง ไม่เปิดชุดล่าสุดแทน · DOC-059 ไม่มีสิทธิ์ = บอกตรง ๆ ไม่โชว์ข้อมูลของใคร
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DocumentsWorkspace from './DocumentsWorkspace';

const APP = '11111111-1111-4111-8111-111111111111';
const PACKET = '44444444-4444-4444-8444-444444444444';
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const LIST = { feature: { enabled: true, ready: true, problem: null }, irecruitConnected: false, items: [], total: 0, page: 1, pageSize: 20, counts: {} };
const packet = {
  id: PACKET,
  invitationId: '22222222-2222-4222-8222-222222222222',
  revision: 1,
  submittedAt: '2026-11-22T04:00:00.000Z',
  formVersion: 'v',
  payloadHash: 'h',
  erased: false,
  personName: 'ทดลอง อ่านเอกสาร',
  person: [{ key: 'firstName', label: 'ชื่อ', value: 'ทดลอง' }],
  addresses: { registered: '99/1 แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200', current: '', sameAsRegistered: true },
  consents: [{ doc: 'background', title: 'หนังสือยินยอมให้ตรวจประวัติ', answer: 'no', label: 'ไม่ยินยอม / ขอคุยกับเจ้าหน้าที่', followUp: true, templateVersion: 1, pages: 1 }],
  signature: { method: 'typed', name: 'ทดลอง อ่านเอกสาร', image: '' },
  files: [],
  ocr: [],
  ocrEdits: [],
  attention: [{ code: 'consent_declined', text: 'หนังสือยินยอมให้ตรวจประวัติ: ไม่ยินยอม / ขอคุยกับเจ้าหน้าที่' }],
  line: { userId: 'U0', displayName: 'Ty', pictureUrl: null, verifiedAt: '2026-11-22T03:05:00.000Z', senderRelation: 'self' },
  review: { flag: false, note: null, byName: null, at: null },
  attentionAck: null,
  imports: [],
};
const DETAIL = {
  application: { id: APP, name: 'สมมติ ทดลองระบบ', jobLabel: 'พนักงานขับรถ', bu: 'LBD' },
  status: 'needs_fix',
  invitations: [],
  packets: [{ id: PACKET, revision: 1, submittedAt: packet.submittedAt, personName: packet.personName, erased: false }],
  packet,
  events: [],
};

afterEach(() => vi.unstubAllGlobals());

const mount = () =>
  render(
    <MemoryRouter initialEntries={[`/jobs/board?view=documents&applicationId=${APP}&packetId=${PACKET}`]}>
      <Routes>
        <Route path="/jobs/board" element={<DocumentsWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );

describe('แท็บเอกสาร', () => {
  it('DOC-055/061 ลิงก์จากกระดิ่งเปิดชุดที่แจ้งทันที · เรื่องที่ต้องดูขึ้นเฉพาะจุด · คำตอบ "ไม่ยินยอม" ตามจริง', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', (input: string) => {
      urls.push(input);
      return json(input.includes('applicationId=') ? DETAIL : LIST);
    });
    mount();
    expect(await screen.findByText('สมมติ ทดลองระบบ')).toBeTruthy();
    expect(urls.some((u) => u.includes(`applicationId=${APP}`) && u.includes(`packetId=${PACKET}`))).toBe(true);
    expect(screen.getByTestId('packet-attention').textContent).toContain('ไม่ยินยอม');
    expect(screen.getByTestId('packet-consents').textContent).toContain('ไม่ยินยอม / ขอคุยกับเจ้าหน้าที่');
    expect(screen.getByTestId('packet-sender').textContent).toContain('ไม่มีรูป');
  });

  it('DOC-059 ไม่มีสิทธิ์ = ข้อความจากเซิร์ฟเวอร์ ไม่มีข้อมูลผู้สมัคร', async () => {
    vi.stubGlobal('fetch', (input: string) =>
      input.includes('applicationId=') ? json({ error: 'forbidden', message: 'ไม่มีสิทธิ์เข้าถึงใบสมัครของแผนกอื่น' }, 403) : json(LIST),
    );
    mount();
    expect((await screen.findByTestId('document-sheet-error')).textContent).toBe('ไม่มีสิทธิ์เข้าถึงใบสมัครของแผนกอื่น');
    expect(screen.queryByTestId('packet-person')).toBeNull();
  });
});

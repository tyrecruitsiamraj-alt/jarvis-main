/**
 * ปุ่ม "ส่งเอกสาร" ในป๊อปผู้สมัคร (22 พ.ย. 2569)
 * DOC-001 สร้างลิงก์เมื่อกดเท่านั้น ไม่ส่ง LINE · DOC-002 คลิปบอร์ด = ลิงก์ของผู้สมัครคนนี้ · DOC-008 เห็นคนเปิดลิงก์ก่อนส่งเอกสาร
 * DOC-051 ระบบปิดและใบนี้ไม่เคยมีลิงก์ = ป๊อปหน้าตาเดิม
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SendDocumentsSection from './SendDocumentsSection';

const APP = '11111111-1111-4111-8111-111111111111';
const INV = '22222222-2222-4222-8222-222222222222';
const URL_ = `https://liff.line.me/2001234567-AbCdEfGh?invite=${'cd'.repeat(32)}`;
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const state = (over: Record<string, unknown> = {}) => ({
  feature: { enabled: true, ready: true, problem: null },
  application: { id: APP, name: 'สมมติ ทดลองระบบ', jobLabel: 'พนักงานขับรถ' },
  status: null,
  invitations: [],
  latestPacketId: null,
  ...over,
});
const link = (over: Record<string, unknown> = {}) => ({
  id: INV,
  revision: 1,
  createdAt: '2026-11-22T03:00:00.000Z',
  createdByName: 'เจ้าหน้าที่ทดสอบ',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  revokedAt: null,
  revokedByName: null,
  line: null,
  packetId: null,
  submittedAt: null,
  ...over,
});

let calls: { url: string; method: string }[] = [];
const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
  calls = [];
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => vi.unstubAllGlobals());

const mount = () =>
  render(
    <MemoryRouter>
      <SendDocumentsSection applicationId={APP} />
    </MemoryRouter>,
  );

describe('ส่งเอกสาร ในป๊อปผู้สมัคร', () => {
  it('DOC-001/002 เปิดป๊อป = อ่านอย่างเดียว · กดแล้วได้ลิงก์ของคนนี้ในคลิปบอร์ด', async () => {
    let created = false;
    vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
      calls.push({ url: input, method: (init?.method ?? 'GET').toUpperCase() });
      if (init?.method === 'POST') {
        created = true;
        return json({ invitationId: INV, revision: 1, url: URL_, expiresAt: link().expiresAt }, 201);
      }
      return json(state(created ? { status: 'not_opened', invitations: [link()] } : {}));
    });
    mount();
    const button = await screen.findByTestId('create-document-link');
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
    expect(calls[0].url).toContain(`applicationId=${APP}`);
    fireEvent.click(button);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(URL_));
    expect((screen.getByLabelText('ลิงก์ส่งเอกสาร') as HTMLInputElement).value).toBe(URL_);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(screen.getByTestId('send-documents-status').textContent).toBe('ยังไม่มีผู้เปิดลิงก์นี้');
  });

  it('DOC-008/010 เห็นชื่อ LINE เวลาเปิด และบอกตามจริงว่าไม่มีรูป ก่อนผู้สมัครส่งเอกสาร', async () => {
    const line = { userId: 'U'.padEnd(33, '0'), displayName: 'Ty', pictureUrl: null, verifiedAt: '2026-11-22T03:05:00.000Z', firstOpenedAt: '2026-11-22T03:05:00.000Z', lastOpenedAt: '2026-11-22T03:05:00.000Z', openCount: 1 };
    vi.stubGlobal('fetch', () => json(state({ status: 'opened', invitations: [link({ line })] })));
    mount();
    const opener = await screen.findByTestId('doc-line-opener');
    expect(opener.textContent).toContain('LINE: Ty');
    expect(opener.textContent).toContain('ไม่มีรูป');
    expect(screen.getByTestId('send-documents-status').textContent).toBe('เปิดลิงก์แล้ว ยังไม่ส่งเอกสาร');
  });

  it('DOC-051 ระบบปิดและใบนี้ไม่เคยมีลิงก์ = ไม่แสดงอะไร · มีของเดิม = ดูได้แต่สร้างใหม่ไม่ได้', async () => {
    vi.stubGlobal('fetch', () => json(state({ feature: { enabled: false, ready: false, problem: null } })));
    const { container, unmount } = mount();
    await waitFor(() => expect(calls.length === 0).toBe(true));
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector('[data-testid="send-documents"]')).toBeNull();
    unmount();
    vi.stubGlobal('fetch', () => json(state({ feature: { enabled: false, ready: false, problem: null }, status: 'ready', invitations: [link({ packetId: '33333333-3333-4333-8333-333333333333', submittedAt: '2026-11-22T04:00:00.000Z' })], latestPacketId: '33333333-3333-4333-8333-333333333333' })));
    mount();
    expect(await screen.findByTestId('open-documents')).toBeTruthy();
    expect(screen.queryByTestId('create-document-link')).toBeNull();
  });
});

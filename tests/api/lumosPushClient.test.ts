/**
 * เทสต์เส้น push ของหน้า Follow — ยิงด้วย fetch จำลองทั้งหมด **ห้ามแตะ Lumos จริง**
 * (การส่งจริง = เข้าคิวโทรหาคนจริง · กติกาโปรเจกต์ห้ามทดสอบที่ยิงถึงคนจริง)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLumosPushConfig, pushReminders, cancelPushedReminder } from '../../api/_lib/lumosPushClient';
import { buildFollowPushRecord } from '../../api/_lib/lumosDispatch';
import type { LumosReminderPayload } from '../../api/_lib/lumosDispatch';

const PUSH_ENV = {
  LUMOS_BASE_URL: 'https://lumos.test',
  LUMOS_CONNECTION_ID: 'conn-1',
  LUMOS_PUSH_API_KEY: 'test-key',
} as const;

function okPushResponse(accepted = 1) {
  return new Response(
    JSON.stringify({ status: 'success', code: 202, accepted, results: [] }),
    { status: 202, headers: { 'Content-Type': 'application/json' } },
  );
}

function samplePayload(scheduledAt: string): LumosReminderPayload {
  return {
    client_contact_id: 'follow-abc',
    recipient_name: 'สมชาย ทดสอบ',
    recipient_phone: '+66900000000',
    title: 'ตามเอกสาร',
    language: 'th',
    tone: 'professional',
    steps: [{ type: 'follow_up', message: 'ทดสอบ', scheduled_at: scheduledAt }],
  };
}

describe('getLumosPushConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('ครบสามตัวถึงคืน config — ขาดตัวไหนก็ null (push ถูกข้ามเงียบ ไม่ล้ม)', () => {
    for (const [k, v] of Object.entries(PUSH_ENV)) vi.stubEnv(k, v);
    expect(getLumosPushConfig()).toEqual({
      baseUrl: 'https://lumos.test',
      connectionId: 'conn-1',
      apiKey: 'test-key',
    });
    vi.stubEnv('LUMOS_PUSH_API_KEY', '');
    expect(getLumosPushConfig()).toBeNull();
  });

  it('ตัด trailing slash ของ baseUrl — กัน URL กลายเป็น //api/...', () => {
    for (const [k, v] of Object.entries(PUSH_ENV)) vi.stubEnv(k, v);
    vi.stubEnv('LUMOS_BASE_URL', 'https://lumos.test/');
    expect(getLumosPushConfig()?.baseUrl).toBe('https://lumos.test');
  });
});

describe('buildFollowPushRecord — bump เวลาให้ผ่านด่าน ingest ของ Lumos', () => {
  const now = new Date('2026-08-26T05:00:00.000Z'); // = 12:00 เวลาไทย

  it('เวลาที่ผ่านมาแล้วถูกดันไป now+10 นาที (เวลาไทย +07:00) — ส่งดิบ ๆ Lumos ปัดทิ้งเงียบ', () => {
    const rec = buildFollowPushRecord(samplePayload('2026-08-26T02:00:00.000Z'), now);
    expect(rec.steps[0]?.scheduled_at).toBe('2026-08-26T12:10:00+07:00');
  });

  it('เวลาอนาคตคงเดิม (แค่แปลงเป็นรูปเวลาไทย) — ห้ามเลื่อนนัดของคน', () => {
    const rec = buildFollowPushRecord(samplePayload('2026-08-27T03:30:00.000Z'), now);
    expect(rec.steps[0]?.scheduled_at).toBe('2026-08-27T10:30:00+07:00');
  });

  it('ไม่แก้ payload ต้นฉบับ — ตัวเดียวกันนี้ยังต้องเข้าคิว pull ด้วยค่าเดิม', () => {
    const payload = samplePayload('2026-08-26T02:00:00.000Z');
    buildFollowPushRecord(payload, now);
    expect(payload.steps[0]?.scheduled_at).toBe('2026-08-26T02:00:00.000Z');
  });
});

describe('pushReminders / cancelPushedReminder — รูป request ที่ออกไปหา Lumos', () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(PUSH_ENV)) vi.stubEnv(k, v);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('POST ไป /webhooks/<conn>/reminders พร้อม Bearer + Idempotency-Key และ body เป็น array เสมอ', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okPushResponse());
    vi.stubGlobal('fetch', fetchMock);

    const res = await pushReminders(
      buildFollowPushRecord(samplePayload('2026-08-27T03:30:00.000Z')),
      'follow-abc',
    );

    expect(res.accepted).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://lumos.test/api/public/v1/webhooks/conn-1/reminders');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
    expect(headers['Idempotency-Key']).toBe('follow-abc');
    const body = JSON.parse(String(init.body)) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect((body[0] as { client_contact_id: string }).client_contact_id).toBe('follow-abc');
  });

  it('Lumos ตอบไม่ ok → throw พร้อมข้อความจากเขา (คนเรียกต้อง catch เอง — best-effort)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'invalid api key' }), { status: 401 }),
      ),
    );
    await expect(pushReminders(buildFollowPushRecord(samplePayload('2026-08-27T03:30:00.000Z'))))
      .rejects.toThrow('invalid api key');
  });

  it('cancel ยิง DELETE ไปที่ id เดิมที่ push (follow-<id> = client_contact_id)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okPushResponse(0));
    vi.stubGlobal('fetch', fetchMock);

    await cancelPushedReminder('follow-abc');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://lumos.test/api/public/v1/webhooks/conn-1/reminders/follow-abc');
    expect(init.method).toBe('DELETE');
  });
});

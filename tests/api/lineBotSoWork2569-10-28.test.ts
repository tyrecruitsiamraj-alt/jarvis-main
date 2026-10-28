import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn(), isPgUndefinedTable: () => false }));
vi.mock('../../api/_lib/aiSettingsStore.js', () => ({ decryptApiKey: (v: string | null) => (v ? 'shared-secret' : null), encryptApiKey: (v: string) => `enc:${v}` }));

const mod = await import('../../api/_lib/lineBotSoWork');
const { dbQuery } = await import('../../api/_lib/postgres.js');

const SECRET = 'shared-secret';
const LID = 'U4af4980629abcdef0123456789abcdef';
const sign = (s: string) => createHmac('sha256', SECRET).update(s).digest('hex');

describe('LINE Bot So Work (ทีมบอท 28 ต.ค. 2569 · ข้อ 1–2)', () => {
  it('ข้อ 1: lsig = HMAC-SHA256(lid) ตรง = รับ lid · ไม่ตรง/รูปผิด = ไม่รับ', () => {
    expect(mod.verifyLineUser(LID, sign(LID), SECRET)).toBe(LID);
    expect(mod.verifyLineUser(LID, sign(LID).toUpperCase(), SECRET)).toBe(LID);
    expect(mod.verifyLineUser(LID, sign('Uother'), SECRET)).toBeNull();
    expect(mod.verifyLineUser('not-a-line-id', sign('not-a-line-id'), SECRET)).toBeNull();
    expect(mod.verifyLineUser(LID, 'xyz', SECRET)).toBeNull();
    expect(mod.verifyLineUser(null, null, SECRET)).toBeNull();
  });

  it('ข้อ 2: body ตามสเปก · เลขใบขอไม่มี prefix · เวลา +07:00 · header = HMAC ของ body ทั้งก้อน', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ base_url: 'https://bot.example.dev', key_enc: 'x', key_hint: null, updated_by: null, updated_at: null }] } as never);
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    await mod.notifyLineBotApplicationCreated(
      { applicationId: 'app-1', lineUserId: LID, jobId: 'siamraj-sql:OPL6909077', createdAt: new Date('2026-10-28T03:15:00Z') },
      fetchImpl,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://bot.example.dev/jarvis/application');
    const body = String(calls[0].init.body);
    expect(JSON.parse(body)).toEqual({
      event: 'application.created',
      application_id: 'app-1',
      line_user_id: LID,
      request_no: 'OPL6909077',
      created_at: '2026-10-28T10:15:00+07:00',
    });
    expect((calls[0].init.headers as Record<string, string>)['x-jarvis-signature']).toBe(sign(body));
  });

  it('ส่งไม่สำเร็จ = ไม่โยน error (ใบสมัครบันทึกไปแล้ว)', async () => {
    const fetchImpl = (async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    await expect(
      mod.notifyLineBotApplicationCreated({ applicationId: 'a', lineUserId: LID, jobId: null, createdAt: new Date() }, fetchImpl),
    ).resolves.toBeUndefined();
  });

  it('หน้าสมัครส่ง lid/lsig ให้ API ตรวจ · API ตั้ง line_oa เมื่อลายเซ็นตรง · ?job= รับเลขใบขอ', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/components/jobs/PublicApplyDialog.tsx', 'utf8')).toContain("lsig: searchParams.get('lsig'),");
    const api = readFileSync('api/_handlers/public/apply.ts', 'utf8');
    expect(api).toContain("if (lineUserId && !lockedByLink) v.referralSource = 'line_oa';");
    expect(api).toContain('void notifyLineBotApplicationCreated(');
    expect(readFileSync('src/components/jobs/JobBoardView.tsx', 'utf8')).toContain("String(j.request_no ?? '').trim().toUpperCase() === no");
  });
});

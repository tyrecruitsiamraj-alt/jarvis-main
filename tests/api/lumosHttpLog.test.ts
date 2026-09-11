// @vitest-environment node
/**
 * log การยิง HTTP ไปหา Lumos (เจ้าของสั่ง 11 ก.ย. 2569:
 * *"ให้บอก Http Status, Request และ Response เพื่อให้ฉันนำมา debug"*)
 *
 * 🔴 ด่านที่ห้ามหลุดเด็ดขาด: **คีย์ต้องไม่โผล่ใน log** — งาน log ที่ทำคีย์หลุด
 * แย่กว่าไม่มี log
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  LUMOS_HTTP_LOG_DEFAULTS,
  newRequestId,
  pickResponseHeaders,
  readLumosHttpLogConfig,
  redactSecrets,
  safeHeadersForLog,
  truncateForLog,
} from '../../api/_lib/lumosHttpLog.js';

describe('readLumosHttpLogConfig', () => {
  it('🔴 ไม่ตั้งค่า = **full** (ที่เจ้าของสั่ง) · ค่ามั่วก็ full ห้ามปิดเงียบ', () => {
    expect(readLumosHttpLogConfig({}).level).toBe('full');
    expect(readLumosHttpLogConfig({ LUMOS_HTTP_LOG: 'มั่ว' }).level).toBe('full');
  });

  it('ปิด/ย่อได้', () => {
    expect(readLumosHttpLogConfig({ LUMOS_HTTP_LOG: 'off' }).level).toBe('off');
    expect(readLumosHttpLogConfig({ LUMOS_HTTP_LOG: 'BASIC' }).level).toBe('basic');
  });

  it('เพดานความยาวถูกบีบให้สมเหตุผล', () => {
    expect(readLumosHttpLogConfig({ LUMOS_HTTP_LOG_MAX_CHARS: '5' }).maxChars).toBe(200);
    expect(readLumosHttpLogConfig({ LUMOS_HTTP_LOG_MAX_CHARS: '999999' }).maxChars).toBe(100_000);
    expect(readLumosHttpLogConfig({ LUMOS_HTTP_LOG_MAX_CHARS: 'x' }).maxChars).toBe(
      LUMOS_HTTP_LOG_DEFAULTS.maxChars,
    );
  });
});

describe('redactSecrets', () => {
  it('🔴 แทนที่คีย์ทุกที่ที่โผล่ ไม่ใช่แค่ในหัว', () => {
    const key = 'sk-live-abcdefghijklmnop';
    const text = `Authorization: Bearer ${key} · error says ${key} invalid`;
    const out = redactSecrets(text, [key]);
    expect(out).not.toContain(key);
    expect(out.match(/\*\*\*/g)).toHaveLength(2);
  });

  it('ค่าสั้นกว่า 8 ตัวอักษรไม่แทน (ไปตรงกับข้อความปกติแล้ว log อ่านไม่รู้เรื่อง)', () => {
    expect(redactSecrets('status ok', ['ok'])).toBe('status ok');
  });

  it('undefined/ว่าง ไม่ทำให้พัง', () => {
    expect(redactSecrets('abc', [undefined, ''])).toBe('abc');
  });
});

describe('safeHeadersForLog', () => {
  it('🔴 Authorization ถูกปิด แต่ยัง **เห็นว่ามีหัวนี้** (ไว้ไล่เคส 401)', () => {
    const out = safeHeadersForLog({ Authorization: 'Bearer sk-live-xyz', 'Content-Type': 'application/json' });
    expect(out.Authorization).toBe('Bearer ***');
    expect(out['Content-Type']).toBe('application/json');
  });

  it('ไม่สนตัวพิมพ์เล็กใหญ่', () => {
    expect(safeHeadersForLog({ authorization: 'Bearer zzz' }).authorization).toBe('Bearer ***');
  });
});

describe('truncateForLog', () => {
  it('สั้นกว่าเพดาน = ไม่แตะ', () => {
    expect(truncateForLog('สั้น', 100)).toBe('สั้น');
  });

  it('🔴 ตัดแล้วต้องบอกว่าตัดไปเท่าไหร่ — ห้ามตัดเงียบ', () => {
    const out = truncateForLog('ก'.repeat(50), 10);
    expect(out.startsWith('ก'.repeat(10))).toBe(true);
    expect(out).toContain('ตัดอีก 40 ตัวอักษร');
  });
});

describe('pickResponseHeaders', () => {
  it('เก็บเฉพาะหัวที่ช่วยไล่ปัญหา (rate limit · request id · content-type)', () => {
    const h: Record<string, string> = {
      'content-type': 'application/json',
      'x-request-id': 'abc',
      'retry-after': '30',
      'set-cookie': 'ไม่เอา',
    };
    const out = pickResponseHeaders((n) => h[n] ?? null);
    expect(out['x-request-id']).toBe('abc');
    expect(out['retry-after']).toBe('30');
    expect(out['set-cookie']).toBeUndefined();
  });
});

describe('newRequestId', () => {
  it('ยาว 8 ตัวและไม่ซ้ำกันง่าย ๆ', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newRequestId()));
    expect([...ids][0]).toHaveLength(8);
    expect(ids.size).toBeGreaterThan(190);
  });
});

/* ─── ของจริง: ยิงผ่าน lumosFetch แล้ว log ต้องออกครบ ─────────────────────── */

const API_KEY = 'sk-live-TOPSECRET-0123456789';
const lines: Array<Record<string, unknown>> = [];
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  lines.length = 0;
  const grab = (s: unknown) => {
    try {
      lines.push(JSON.parse(String(s)));
    } catch {
      /* บรรทัดที่ไม่ใช่ JSON ไม่สน */
    }
  };
  logSpy = vi.spyOn(console, 'log').mockImplementation(grab);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(grab);
  process.env.LUMOS_BASE_URL = 'https://lumos.example.com';
  process.env.LUMOS_CONNECTION_ID = 'conn-1';
  process.env.LUMOS_PUSH_API_KEY = API_KEY;
  delete process.env.LUMOS_HTTP_LOG;
});
afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  vi.unstubAllGlobals();
});

const find = (msg: string) => lines.filter((l) => l.msg === msg);

describe('lumosFetch — log ของจริง', () => {
  it('🔴 สำเร็จ ⇒ ได้ทั้งบรรทัดส่งและบรรทัดตอบ ผูกกันด้วย reqId เดียวกัน', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ accepted: 1 }), {
          status: 202,
          headers: { 'content-type': 'application/json', 'x-request-id': 'lumos-abc' },
        }),
      ),
    );
    const { pushReminders } = await import('../../api/_lib/lumosPushClient.js');
    const out = await pushReminders({ recipient_name: 'ก' } as never, 'follow-e1');

    // ผู้เรียกยังอ่าน body ได้ตามปกติ (log ใช้ clone ไม่ได้กินของจริง)
    expect(out).toEqual({ accepted: 1 });

    const req = find('lumos.http.request');
    const res = find('lumos.http.response');
    expect(req).toHaveLength(1);
    expect(res).toHaveLength(1);
    expect(req[0].reqId).toBe(res[0].reqId);
    expect(req[0].method).toBe('POST');
    expect(String(req[0].path)).toContain('/reminders');
    expect(res[0].status).toBe(202);
    expect(res[0].ok).toBe(true);
    expect(typeof res[0].ms).toBe('number');
    expect(String(res[0].body)).toContain('accepted');
    expect((res[0].headers as Record<string, string>)['x-request-id']).toBe('lumos-abc');
  });

  it('🔴 คีย์ต้องไม่โผล่ใน log สักบรรทัด', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(`บอกว่า key ${API_KEY} ใช้ไม่ได้`, { status: 401 })),
    );
    const { pushReminders } = await import('../../api/_lib/lumosPushClient.js');
    await expect(pushReminders({} as never, 'k')).rejects.toThrow();

    const dump = JSON.stringify(lines);
    expect(dump).not.toContain(API_KEY);
    expect(dump).toContain('Bearer ***');
    expect(find('lumos.http.response')[0].status).toBe(401);
  });

  it('ตอบไม่ใช่ 2xx ⇒ ยังได้ body ของเขามาอ่าน (นี่คือของที่เอาไป debug)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ detail: 'plan ซ้ำกับที่มีอยู่' }), { status: 409 })),
    );
    const { pushReminders } = await import('../../api/_lib/lumosPushClient.js');
    await expect(pushReminders({} as never, 'k')).rejects.toThrow(/ซ้ำ/);
    expect(String(find('lumos.http.response')[0].body)).toContain('plan ซ้ำ');
  });

  it('🔴 ต่อไม่ถึงเลย ⇒ ได้ lumos.http.error พร้อมเหตุจริงจาก .cause ทุก attempt', { timeout: 30_000 }, async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed', {
          cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
        });
      }),
    );
    const { pushReminders } = await import('../../api/_lib/lumosPushClient.js');
    await expect(pushReminders({} as never, 'k')).rejects.toThrow();

    // จำนวนครั้ง = FETCH_MAX_ATTEMPTS (ขยายเป็น 5 เมื่อ 11 ก.ย. 2569 ให้ครอบช่วงเน็ตหลุดจริง)
    const errs = find('lumos.http.error');
    expect(errs.length).toBeGreaterThanOrEqual(3);
    expect(String(errs[0].reason)).toContain('ECONNRESET');
    expect(errs[0].willRetry).toBe(true);
    expect(errs.at(-1)?.willRetry).toBe(false);
  });

  it('LUMOS_HTTP_LOG=off ⇒ เงียบสนิท (เผื่อ log บวมเกินไป)', async () => {
    process.env.LUMOS_HTTP_LOG = 'off';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    const { pushReminders } = await import('../../api/_lib/lumosPushClient.js');
    await pushReminders({} as never, 'k');
    expect(find('lumos.http.request')).toHaveLength(0);
    expect(find('lumos.http.response')).toHaveLength(0);
  });

  it('LUMOS_HTTP_LOG=basic ⇒ มีหัวข้อกับ status แต่ไม่มี body', async () => {
    process.env.LUMOS_HTTP_LOG = 'basic';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"accepted":1}', { status: 200 })));
    const { pushReminders } = await import('../../api/_lib/lumosPushClient.js');
    await pushReminders({ a: 1 } as never, 'k');
    expect(find('lumos.http.request')[0].body).toBeUndefined();
    expect(find('lumos.http.response')[0].body).toBeUndefined();
    expect(find('lumos.http.response')[0].status).toBe(200);
  });
});

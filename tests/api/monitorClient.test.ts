// @vitest-environment node
/**
 * logLoginEvent ต้อง: ข้ามเงียบถ้าไม่ได้ตั้งค่า, ไม่ throw ไม่ว่า monitor จะตอบยังไง,
 * และ cache client ไว้ (ไม่ createMonitorClient ใหม่ทุกครั้งที่ login)
 * — login จริงต้องไม่มีวันล้มเพราะ monitor ล่ม/ช้า/ตั้งค่าไม่ครบ
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createMonitorClientMock = vi.fn();
const tryLogMock = vi.fn();
const logWarnMock = vi.fn();

async function freshLogLoginEvent() {
  vi.resetModules();
  createMonitorClientMock.mockReset();
  tryLogMock.mockReset();
  logWarnMock.mockReset();
  createMonitorClientMock.mockReturnValue({ tryLog: tryLogMock });

  vi.doMock('@drcopyman/monitor-sdk', () => ({
    createMonitorClient: createMonitorClientMock,
  }));
  vi.doMock('../../api/_lib/logger.js', () => ({
    logWarn: logWarnMock,
    logInfo: vi.fn(),
    logError: vi.fn(),
  }));

  const mod = await import('../../api/_lib/monitorClient.js');
  return mod.logLoginEvent;
}

const USER = { id: 'u1', email: 'somchai@siamraj.com', full_name: 'สมชาย ใจดี', role: 'staff' };

describe('logLoginEvent', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ไม่ได้ตั้งค่า MONITOR_BASE_URL/MONITOR_API_KEY → ข้ามเงียบ ไม่แตะ SDK เลย', async () => {
    const logLoginEvent = await freshLogLoginEvent();
    logLoginEvent(USER, 'auth.login.success');
    expect(createMonitorClientMock).not.toHaveBeenCalled();
  });

  it('ตั้งค่าครบ → สร้าง client ด้วย systemName jarvis แล้วยิง tryLog ด้วยฟิลด์ที่ถูกต้อง', async () => {
    vi.stubEnv('MONITOR_BASE_URL', 'https://monitor.test');
    vi.stubEnv('MONITOR_API_KEY', 'mk_test');

    const logLoginEvent = await freshLogLoginEvent();
    tryLogMock.mockResolvedValue({ ok: true, data: { id: 'log1', timestamp: '2026-09-16T00:00:00Z' } });
    logLoginEvent(USER, 'auth.login.success');
    // fire-and-forget — รอ microtask ให้ .then() ทำงาน
    await Promise.resolve();
    await Promise.resolve();

    expect(createMonitorClientMock).toHaveBeenCalledWith({
      baseUrl: 'https://monitor.test',
      apiKey: 'mk_test',
      systemName: 'jarvis',
      timeoutMs: 5_000,
    });
    expect(tryLogMock).toHaveBeenCalledWith({
      userId: 'u1',
      username: 'สมชาย ใจดี',
      action: 'auth.login.success',
      metadata: { email: 'somchai@siamraj.com', role: 'staff' },
    });
  });

  it('เรียกซ้ำหลายครั้ง → createMonitorClient ถูกสร้างครั้งเดียว (cache)', async () => {
    vi.stubEnv('MONITOR_BASE_URL', 'https://monitor.test');
    vi.stubEnv('MONITOR_API_KEY', 'mk_test');

    const logLoginEvent = await freshLogLoginEvent();
    tryLogMock.mockResolvedValue({ ok: true, data: { id: 'log1', timestamp: '2026-09-16T00:00:00Z' } });
    logLoginEvent(USER, 'auth.login.success');
    logLoginEvent(USER, 'auth.magic_link.success');
    await Promise.resolve();

    expect(createMonitorClientMock).toHaveBeenCalledTimes(1);
    expect(tryLogMock).toHaveBeenCalledTimes(2);
  });

  it('tryLog คืน {ok:false} → log คำเตือน ไม่ throw ออกมาให้คนเรียก', async () => {
    vi.stubEnv('MONITOR_BASE_URL', 'https://monitor.test');
    vi.stubEnv('MONITOR_API_KEY', 'mk_test');

    const logLoginEvent = await freshLogLoginEvent();
    tryLogMock.mockResolvedValue({
      ok: false,
      error: { code: 'NETWORK', message: 'fetch failed' },
    });
    expect(() => logLoginEvent(USER, 'auth.login.success')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(logWarnMock).toHaveBeenCalledWith(
      'monitor.login.log.fail',
      expect.objectContaining({ userId: 'u1', code: 'NETWORK', message: 'fetch failed' }),
    );
  });

  it('tryLog reject ตรง ๆ (ผิดสัญญา SDK แต่กันไว้อีกชั้น) → ไม่ทำให้ logLoginEvent เองพัง', async () => {
    vi.stubEnv('MONITOR_BASE_URL', 'https://monitor.test');
    vi.stubEnv('MONITOR_API_KEY', 'mk_test');

    const logLoginEvent = await freshLogLoginEvent();
    tryLogMock.mockRejectedValue(new Error('ไม่ควรเกิด แต่กันไว้'));
    expect(() => logLoginEvent(USER, 'auth.login.success')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(logWarnMock).toHaveBeenCalledWith(
      'monitor.login.log.fail',
      expect.objectContaining({ userId: 'u1', message: 'ไม่ควรเกิด แต่กันไว้' }),
    );
  });
});

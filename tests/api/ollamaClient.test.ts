import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ollamaChat', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.OLLAMA_BASE_URL = 'http://ollama.test';
    process.env.OLLAMA_MODEL = 'test-model';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('includes temperature in the request options when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '{"a":1}' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { ollamaChat } = await import('../../api/_lib/ollamaClient');
    await ollamaChat({
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.15,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.options.temperature).toBe(0.15);
  });

  it('omits temperature entirely when not provided (preserves server default)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '{"a":1}' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { ollamaChat } = await import('../../api/_lib/ollamaClient');
    await ollamaChat({ messages: [{ role: 'user', content: 'hi' }] });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.options).not.toHaveProperty('temperature');
  });
});

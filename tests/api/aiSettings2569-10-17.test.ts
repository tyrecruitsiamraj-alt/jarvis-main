// @vitest-environment node
/**
 * เลือก AI ที่ใช้คิดงานจากหน้าตั้งค่า (เจ้าของ 17 ต.ค. 2569)
 * > *"ตอนนี้ใช้ Ollama แล้วถ้าอนาคตอยากจะเปลี่ยนหล่ะมันต้องเปลี่ยนจากหน้า Ui ได้"*
 * Choice: Ollama + เจ้าแบบ OpenAI + Claude · เลือกแยกได้ต่องาน · admin เท่านั้น
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbRows: { conns: Record<string, unknown>[]; routes: Record<string, unknown>[]; missingTable: boolean } = {
  conns: [],
  routes: [],
  missingTable: false,
};
vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(async (sql: string) => {
    if (dbRows.missingTable) throw Object.assign(new Error('relation does not exist'), { code: '42P01' });
    if (sql.includes('ai_connections') && sql.trim().startsWith('select')) return { rows: dbRows.conns };
    if (sql.includes('ai_task_routes') && sql.trim().startsWith('select')) return { rows: dbRows.routes };
    return { rows: [] };
  }),
  isPgUndefinedTable: (e: unknown) => (e as { code?: string })?.code === '42P01',
}));

process.env.AUTH_JWT_SECRET = 'test-secret-for-ai-settings';
process.env.OLLAMA_BASE_URL = 'http://ollama.local:11434';
process.env.OLLAMA_MODEL = 'qwen3.5:9b';

const store = await import('../../api/_lib/aiSettingsStore.js');
const { chatWithTarget, aiChat } = await import('../../api/_lib/aiClient.js');
const { parseAiConnectionInput, parseAiRoutesInput, aiKeyHint, AI_TASKS } = await import('../../src/lib/aiSettings.js');

const read = (p: string) => readFileSync(p, 'utf8');
const realFetch = globalThis.fetch;

beforeEach(() => {
  dbRows.conns = [];
  dbRows.routes = [];
  dbRows.missingTable = false;
  store.invalidateAiSettings();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('ตรวจค่าที่กรอก', () => {
  it('ชื่อ/เจ้า/โมเดลต้องมี · ที่อยู่ว่างใช้ค่าตั้งต้นของเจ้านั้น · ตัด / ท้าย', () => {
    expect(parseAiConnectionInput({ name: '', kind: 'openai', model: 'x' }).error).toBe('ใส่ชื่อการเชื่อมต่อ');
    expect(parseAiConnectionInput({ name: 'a', kind: 'gemini', model: 'x' }).error).toBe('เลือกเจ้า AI');
    expect(parseAiConnectionInput({ name: 'a', kind: 'openai', model: '' }).error).toBe('ใส่ชื่อโมเดล');
    expect(parseAiConnectionInput({ name: 'a', kind: 'anthropic', model: 'm' }).value?.base_url).toBe('https://api.anthropic.com');
    expect(parseAiConnectionInput({ name: 'a', kind: 'ollama', model: 'm' }).error).toContain('http');
    expect(parseAiConnectionInput({ name: 'a', kind: 'ollama', model: 'm', base_url: 'http://x:11434/' }).value?.base_url).toBe('http://x:11434');
  });
  it('เลือกต่องาน: ไม่รู้จักงาน = ผิด · ค่าว่าง = ใช้ Ollama ของระบบ', () => {
    expect(parseAiRoutesInput({ routes: [{ task: 'x' }] }).error).toBe('ไม่รู้จักงานนี้');
    expect(parseAiRoutesInput({ routes: [{ task: 'board_match', connection_id: '', model: ' ' }] }).value).toEqual([
      { task: 'board_match', connection_id: null, model: null },
    ]);
    expect(AI_TASKS).toHaveLength(5);
  });
  it('key โชว์แค่ 4 ตัวท้าย · สั้นกว่า 8 ไม่โชว์', () => {
    expect(aiKeyHint('sk-abcdefgh1234')).toBe('1234');
    expect(aiKeyHint('short')).toBeNull();
  });
});

describe('🔴 API key', () => {
  it('เข้ารหัสแล้วถอดกลับได้ · ข้อมูลเสีย = null (ไม่ล้ม)', () => {
    const enc = store.encryptApiKey('sk-live-secret-9999');
    expect(enc).not.toContain('sk-live');
    expect(store.decryptApiKey(enc)).toBe('sk-live-secret-9999');
    expect(store.decryptApiKey(enc.slice(0, -4) + 'AAAA')).toBeNull();
    expect(store.decryptApiKey('garbage')).toBeNull();
  });
  it('หน้าจอได้แค่ has_key + 4 ตัวท้าย ไม่มีตัว key', async () => {
    dbRows.conns = [
      { id: 'c1', name: 'Claude', kind: 'anthropic', base_url: 'https://api.anthropic.com', model: 'claude-x', api_key_enc: store.encryptApiKey('sk-ant-123456789'), api_key_hint: '6789', updated_by: null, updated_at: null },
    ];
    const view = await store.getAiSettingsView();
    expect(view.connections[0]).toMatchObject({ has_key: true, key_hint: '6789' });
    expect(JSON.stringify(view)).not.toContain('sk-ant');
    expect(JSON.stringify(view)).not.toContain('api_key_enc');
  });
  it('handler ไม่ส่ง key กลับ · audit จดแค่ว่าเปลี่ยน key', () => {
    const h = read('api/_handlers/ai-settings.ts');
    expect(h).toContain('const { api_key: key, ...safe } = parsed.value;');
    expect(h).toContain('api_key_changed: Boolean(key)');
    expect(read('api/_lib/rbac.ts')).toMatch(/case 'ai-settings':\s*return 'admin';/);
  });
});

describe('งานไหนใช้ AI ตัวไหน', () => {
  it('🔴 ไม่มีตาราง / ไม่ได้ตั้ง = Ollama จากไฟล์ตั้งค่าแบบเดิม (ทางถอย)', async () => {
    dbRows.missingTable = true;
    expect(await store.resolveAiTarget('board_match')).toMatchObject({ kind: 'ollama', model: 'qwen3.5:9b', source: 'Ollama ของระบบ' });
    dbRows.missingTable = false;
    store.invalidateAiSettings();
    expect(await store.resolveAiTarget('candidate_spec')).toMatchObject({ kind: 'ollama', baseUrl: 'http://ollama.local:11434' });
  });
  it('ตั้งต่องานได้ · โมเดลของงานชนะโมเดลตั้งต้น · การเชื่อมต่อหาย = ถอยไป Ollama ของระบบ', async () => {
    dbRows.conns = [{ id: 'c1', name: 'OpenAI', kind: 'openai', base_url: 'https://api.openai.com/v1', model: 'gpt-a', api_key_enc: store.encryptApiKey('sk-xyz-12345678'), api_key_hint: null, updated_by: null, updated_at: null }];
    dbRows.routes = [
      { task: 'board_match', connection_id: 'c1', model: 'gpt-b', updated_by: null, updated_at: null },
      { task: 'recruit_lane', connection_id: 'c1', model: null, updated_by: null, updated_at: null },
      { task: 'selection_recall', connection_id: 'gone', model: null, updated_by: null, updated_at: null },
    ];
    expect(await store.resolveAiTarget('board_match')).toMatchObject({ kind: 'openai', model: 'gpt-b', apiKey: 'sk-xyz-12345678' });
    expect(await store.resolveAiTarget('recruit_lane')).toMatchObject({ model: 'gpt-a' });
    expect(await store.resolveAiTarget('selection_recall')).toMatchObject({ kind: 'ollama' });
    expect(await store.resolveAiTarget('irecruit_match')).toMatchObject({ kind: 'ollama' });
  });
  it('ทุกงานเรียกผ่าน aiChat พร้อมชื่องาน · ไม่มีใครเรียก ollamaChat ตรงแล้ว', () => {
    const sites: Array<[string, string]> = [
      ['api/_lib/boardCandidateMatcher.ts', 'board_match'],
      ['api/_lib/irecruitCandidateMatcher.ts', 'irecruit_match'],
      ['api/_lib/recruitLaneMatcher.ts', 'recruit_lane'],
      ['api/_lib/selectionRecallMatcher.ts', 'selection_recall'],
      ['api/_lib/candidateSpecAnalyzer.ts', 'candidate_spec'],
    ];
    for (const [f, task] of sites) {
      const src = read(f);
      expect(src, f).toContain(`task: '${task}'`);
      expect(src, f).not.toContain('ollamaChat(');
    }
    expect(read('api/_lib/matchPrecomputeWorker.ts')).toContain("await isAiConfigured('board_match')");
  });
});

describe('ตัวเชื่อมแต่ละเจ้า', () => {
  it('OpenAI: /chat/completions · Bearer key · บังคับ JSON · อ่าน choices', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":1}' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await chatWithTarget(
      { kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-x', apiKey: 'sk-1', source: 't' },
      { messages: [{ role: 'user', content: 'hi' }], format: 'json', temperature: 0.1 },
    );
    expect(out).toBe('{"ok":1}');
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer sk-1');
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ model: 'gpt-x', response_format: { type: 'json_object' }, temperature: 0.1 });
  });
  it('Claude: /v1/messages · x-api-key · system แยก + สั่ง JSON · รวมข้อความ text', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await chatWithTarget(
      { kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-x', apiKey: 'sk-ant', source: 't' },
      { messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'u' }], format: 'json' },
    );
    expect(out).toBe('{"a":1}');
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    const h = calls[0].init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('sk-ant');
    expect(h['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.system).toContain('sys');
    expect(body.system).toContain('JSON');
    expect(body.messages).toEqual([{ role: 'user', content: 'u' }]);
  });
  it('🔴 key ผิด/ล้ม = ข้อความคนอ่าน · ไม่มี key/ที่อยู่ในข้อความ', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{"error":"bad key sk-1"}', { status: 401 })) as unknown as typeof fetch;
    await expect(
      chatWithTarget({ kind: 'openai', baseUrl: 'https://secret.internal/v1', model: 'm', apiKey: 'sk-1', source: 't' }, { messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toThrow('API key ใช้ไม่ได้');
    globalThis.fetch = vi.fn(async () => {
      throw new Error('fetch failed');
    }) as unknown as typeof fetch;
    const err = await chatWithTarget({ kind: 'openai', baseUrl: 'https://secret.internal/v1', model: 'm', apiKey: 'sk-1', source: 't' }, { messages: [{ role: 'user', content: 'x' }] }).catch((e) => e as Error);
    expect(err.message).not.toContain('secret.internal');
    expect(err.message).not.toContain('sk-1');
  });
  it('ไม่มี AI ให้ใช้เลย = บอกให้ไปตั้งที่หน้าตั้งค่า', async () => {
    const keep = process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_BASE_URL;
    store.invalidateAiSettings();
    await expect(aiChat({ task: 'board_match', messages: [] })).rejects.toThrow('ตั้งค่า › AI ที่ใช้คิดงาน');
    process.env.OLLAMA_BASE_URL = keep;
  });
});

describe('หน้าจอ', () => {
  it('แท็บอยู่กลุ่มระบบอัตโนมัติ · ช่อง key เป็น password · เว้นว่าง = คง key เดิม', () => {
    expect(read('src/lib/settingsNav.ts')).toContain("automation: ['lumosMode', 'callScripts', 'aiSettings',");
    const tab = read('src/pages/settings/AiSettingsTab.tsx');
    expect(tab).toContain('type="password"');
    expect(tab).toContain('เว้นว่างไว้ = ใช้ key เดิม');
    expect(read('src/pages/settings/AdminSettings.tsx')).toContain("{activeTab === 'aiSettings' && <AiSettingsTab />}");
  });
});

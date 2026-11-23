// @vitest-environment node
/**
 * อ่านบัตรด้วยโมเดลบนเซิร์ฟเวอร์ Ollama ของบริษัท (เจ้าของ 23 พ.ย. 2569 "อยากใช้ Ollama")
 * ข้อความทดสอบเป็นบัตรจำลอง (เลขบัตร 0 ทั้งหมด · ไม่ใช่ของใคร)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { isCloudModel, listOcrModels, plainOcrText, serverOcr, ServerOcrUnavailable } from '../../api/_lib/documents/serverOcr';
import { OCR_ENGINE, isOcrEngine, serverOcrEngine } from '../../src/lib/documents/ocrFields';

const ID_MD =
  '**บัตรประจำตัวประชาชน**\n\n| | |\n|---|---|\n| เลขประจำตัวประชาชน | 0000000000000 |\n\nชื่อตัวและชื่อสกุล นาย ทดลอง อ่านเอกสาร\nName Mr. TEST\nLast name DOCUMENT\nเกิดวันที่ 15 ม.ค. 2538\nที่อยู่ 99/1 แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร\n';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('ภาพบัตรห้ามออกนอกบริษัท', () => {
  it('โมเดล :cloud ไม่ขึ้นในรายชื่อ และสั่งอ่านไม่ได้', async () => {
    expect(isCloudModel('glm-5.3:cloud')).toBe(true);
    expect(isCloudModel('deepseek-v4-pro:cloud')).toBe(true);
    expect(isCloudModel('scb10x/typhoon-ocr1.5-3b:latest')).toBe(false);
    vi.stubEnv('OLLAMA_BASE_URL', 'http://ollama.test');
    vi.stubEnv('OLLAMA_MODEL', 'qwen3.5:9b');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ models: [{ name: 'glm-5.3:cloud' }, { name: 'scb10x/typhoon-ocr1.5-3b:latest' }, { name: 'qwen3.5:9b' }] }))));
    expect(await listOcrModels()).toEqual({ ok: true, models: ['qwen3.5:9b', 'scb10x/typhoon-ocr1.5-3b:latest'] });
    await expect(serverOcr('glm-5.3:cloud', Buffer.from('x'), 'id')).rejects.toBeInstanceOf(ServerOcrUnavailable);
  });

  it('หน้าตั้งค่าบันทึกโมเดล :cloud ไม่ได้ · ต้องอยู่ในรายชื่อที่เซิร์ฟเวอร์มีจริง', () => {
    const src = readFileSync('api/_handlers/document-settings.ts', 'utf8');
    expect(src).toContain("if (isCloudModel(v)) return sendError(res, 400");
    expect(src).toContain("if (!list.models.includes(v)) return sendError(res, 400");
  });
});

describe('ข้อความจากโมเดล → ช่องข้อมูล', () => {
  it('ถอด markdown แล้วใช้ตัวแยกช่องเดิม · ป้ายตัวอ่านบอกชื่อโมเดล', async () => {
    expect(plainOcrText(ID_MD)).not.toMatch(/\*\*|\|/);
    vi.stubEnv('OLLAMA_BASE_URL', 'http://ollama.test');
    vi.stubEnv('OLLAMA_MODEL', 'qwen3.5:9b');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: { content: ID_MD } })));
    vi.stubGlobal('fetch', fetchMock);
    const r = await serverOcr('scb10x/typhoon-ocr1.5-3b:latest', Buffer.from('ภาพ'), 'id');
    expect(r.engine).toBe('Ollama · scb10x/typhoon-ocr1.5-3b:latest');
    expect(r.fields).toMatchObject({ prefix: 'นาย', firstName: 'ทดลอง', lastName: 'อ่านเอกสาร', nationalId: '0000000000000' });
    // ส่งภาพเป็น base64 ไปที่ /api/chat ของเซิร์ฟเวอร์บริษัทเท่านั้น
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ollama.test/api/chat');
    expect(JSON.parse(String(init.body)).messages[0].images).toEqual([Buffer.from('ภาพ').toString('base64')]);
  });

  it('เซิร์ฟเวอร์ล่ม / อ่านไม่ออก = ServerOcrUnavailable (หน้าผู้สมัครอ่านในมือถือแทน)', async () => {
    vi.stubEnv('OLLAMA_BASE_URL', 'http://ollama.test');
    vi.stubEnv('OLLAMA_MODEL', 'qwen3.5:9b');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    await expect(serverOcr('scb10x/typhoon-ocr1.5-3b:latest', Buffer.from('x'), 'id')).rejects.toBeInstanceOf(ServerOcrUnavailable);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: { content: '   ' } }))));
    await expect(serverOcr('scb10x/typhoon-ocr1.5-3b:latest', Buffer.from('x'), 'id')).rejects.toBeInstanceOf(ServerOcrUnavailable);
  });

  it('ชุดเอกสารรับผลจากตัวอ่านทั้งสองแบบ · ป้ายแปลก ๆ ไม่รับ', () => {
    expect(isOcrEngine(OCR_ENGINE)).toBe(true);
    expect(isOcrEngine(serverOcrEngine('scb10x/typhoon-ocr1.5-3b:latest'))).toBe(true);
    expect(isOcrEngine('Ollama · <script>')).toBe(false);
    expect(isOcrEngine('GPT')).toBe(false);
  });
});

describe('หน้าผู้สมัคร', () => {
  it('อ่านที่เซิร์ฟเวอร์ก่อนเมื่อตั้งโมเดลไว้ · ล้มเมื่อไหร่อ่านในมือถือต่อ', () => {
    const src = readFileSync('src/pages/public/ApplicantDocumentsPage.tsx', 'utf8');
    expect(src).toContain('serverOcr.current = config.serverOcr === true;');
    expect(src).toMatch(/if \(serverOcr\.current && state\) \{[\s\S]*readApplicantImageOnServer\(state\.inviteKey, fileId\)[\s\S]*return;[\s\S]*\} catch \{[\s\S]*\}\n {4}\}\n {4}try \{\n {6}const ocr = await loadOcr\(\);/);
  });
});

describe('ที่อยู่เซิร์ฟเวอร์ AI แก้จากหน้าจอได้', () => {
  it('ใช้การเชื่อมต่อ Ollama ที่ตั้งในหน้า "AI ที่ใช้คิดงาน" ก่อน แล้วค่อยถอยไปค่าในเซิร์ฟเวอร์', () => {
    const src = readFileSync('api/_lib/documents/serverOcr.ts', 'utf8');
    expect(src).toContain('return saved ?? getOllamaConfig()?.baseUrl ?? null;');
    expect(readFileSync('api/_lib/aiSettingsStore.ts', 'utf8')).toContain("const c = conns.find((x) => x.kind === 'ollama' && x.base_url);");
  });
});

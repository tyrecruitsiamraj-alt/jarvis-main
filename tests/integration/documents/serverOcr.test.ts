/**
 * อ่านบัตรที่เซิร์ฟเวอร์ Ollama ของบริษัท (เจ้าของ 23 พ.ย. 2569) — ทั้งเส้นบนฐานทดสอบในเครื่อง · เซิร์ฟเวอร์ AI เป็นของจำลอง
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { HAS_DB, createLink, openLink, publicHandler, settingsHandler, uploadKind, world, type World } from './fixtures';
import { call, documentImage } from './harness';

const d = HAS_DB ? describe : describe.skip;
const MODEL = 'scb10x/typhoon-ocr1.5-3b:latest';
const CARD = 'เลขประจำตัวประชาชน 0000000000000\nชื่อตัวและชื่อสกุล นาย ทดลอง อ่านเอกสาร\nเกิดวันที่ 15 ม.ค. 2538\n';

d('อ่านบัตรที่เซิร์ฟเวอร์บริษัท', () => {
  let w: World;
  const realFetch = globalThis.fetch;
  const seen: string[] = [];

  beforeAll(async () => {
    vi.stubEnv('OLLAMA_BASE_URL', 'http://ollama.test');
    vi.stubEnv('OLLAMA_MODEL', 'qwen3.5:9b');
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.startsWith('http://ollama.test')) return realFetch(input, init);
      seen.push(url.replace('http://ollama.test', ''));
      if (url.endsWith('/api/tags')) return new Response(JSON.stringify({ models: [{ name: MODEL }, { name: 'glm-5.3:cloud' }] }));
      return new Response(JSON.stringify({ message: { content: CARD } }));
    });
    w = await world();
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const put = (body: Record<string, unknown>) => call(settingsHandler, { method: 'PUT', cookie: w.admin.cookie, body });

  it('หน้าตั้งค่า: รายชื่อจากเซิร์ฟเวอร์จริงไม่มี :cloud · บันทึก :cloud / ชื่อที่ไม่มีไม่ได้', async () => {
    const g = await call(settingsHandler, { cookie: w.admin.cookie });
    expect(g.json.ocrModels).toEqual([MODEL]);
    expect(g.json.ocrModel).toBe('');
    expect((await put({ ocrModel: 'glm-5.3:cloud' })).status).toBe(400);
    expect((await put({ ocrModel: 'ไม่มีจริง:1b' })).status).toBe(400);
    expect((await put({ ocrModel: MODEL })).status).toBe(200);
    expect((await call(settingsHandler, { cookie: w.admin.cookie })).json.ocrModel).toBe(MODEL);
  });

  it('ผู้สมัครแนบบัตร → เซิร์ฟเวอร์อ่าน → ได้ชื่อ/เลขบัตร · ป้ายบอกโมเดล · ทะเบียนบ้านไม่อ่าน', async () => {
    const cfg = await call(publicHandler, { query: { action: 'config' } });
    expect(cfg.json.serverOcr).toBe(true);
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite, 'Somchai LINE');
    const idUp = await uploadKind(o, 'id', documentImage(31));
    const r = await call(publicHandler, { method: 'POST', cookie: o.cookie, body: { action: 'ocr', k: o.k, id: idUp.json.id } });
    expect(r.status).toBe(200);
    expect(r.json.engine).toBe(`Ollama · ${MODEL}`);
    expect(r.json.fields).toMatchObject({ firstName: 'ทดลอง', lastName: 'อ่านเอกสาร', nationalId: '0000000000000' });
    expect(seen).toContain('/api/chat');
    const house = await uploadKind(o, 'house', documentImage(32));
    expect((await call(publicHandler, { method: 'POST', cookie: o.cookie, body: { action: 'ocr', k: o.k, id: house.json.id } })).status).toBe(400);
    // ภาพของลิงก์อื่นอ่านไม่ได้
    const other = await openLink((await createLink(w.staffLba, w.appLba)).invite, 'Ying LINE');
    expect((await call(publicHandler, { method: 'POST', cookie: other.cookie, body: { action: 'ocr', k: other.k, id: idUp.json.id } })).status).toBe(404);
  });

  it('ปิด (อ่านในมือถือ) = 503 ให้หน้าผู้สมัครอ่านในมือถือ · config บอก serverOcr false', async () => {
    expect((await put({ ocrModel: '' })).status).toBe(200);
    expect((await call(publicHandler, { query: { action: 'config' } })).json.serverOcr).toBe(false);
    const link = await createLink(w.staffLbd, w.appLbd);
    const o = await openLink(link.invite, 'Somchai LINE');
    const idUp = await uploadKind(o, 'id', documentImage(33));
    const r = await call(publicHandler, { method: 'POST', cookie: o.cookie, body: { action: 'ocr', k: o.k, id: idUp.json.id } });
    expect(r.status).toBe(503);
    expect(r.json.error).toBe('ocr_unavailable');
  });
});

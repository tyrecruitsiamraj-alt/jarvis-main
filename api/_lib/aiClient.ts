/**
 * ═══ ตัวเรียก AI ตัวเดียวของงานคิด (แมท/อ่านสเปค) — เลือกเจ้าได้จากหน้าตั้งค่า (17 ต.ค. 2569) ═══
 *
 * ทุกงานเรียก `aiChat({ task, ... })` → ดูว่างานนั้นตั้งให้ใช้ AI ตัวไหน (`resolveAiTarget`) แล้วยิงตามชนิด:
 *   - ollama    → `/api/chat` (ตัวเดิม `ollamaChat`)
 *   - openai    → `/chat/completions` (OpenAI และเจ้าที่ใช้รูปแบบเดียวกัน: Groq · Together · LM Studio · vLLM ฯลฯ)
 *   - anthropic → `/v1/messages` (Claude)
 * ไม่ได้ตั้ง = Ollama จากไฟล์ตั้งค่าเซิร์ฟเวอร์แบบเดิม — ระบบเดิมทำงานเหมือนเดิมทุกอย่างจนกว่า admin จะเลือกใหม่
 *
 * ⚠️ เจ้าภายนอก = ข้อมูลที่อยู่ใน prompt (สกิล อายุ พื้นที่ของผู้สมัคร · ไม่มีชื่อ/เบอร์) ออกไปนอกเครื่องบริษัท
 * ⚠️ ข้อความ error ที่ถึงจอห้ามมีที่อยู่เซิร์ฟเวอร์/key — รายละเอียดอยู่ใน log
 */
import { ollamaChat, type OllamaMessage } from './ollamaClient.js';
import { resolveAiTarget, type AiTarget } from './aiSettingsStore.js';
import { logError, logInfo } from './logger.js';
import type { AiTask } from '../../src/lib/aiSettings.js';

export type AiChatOptions = {
  task: AiTask;
  messages: OllamaMessage[];
  format?: 'json';
  timeoutMs?: number;
  numCtx?: number;
  think?: boolean;
  temperature?: number;
};

const BUSY_MESSAGE = 'AI ค้นหาไม่ตอบตอนนี้ (อาจกำลังทำงานหนัก) — ลองใหม่อีกสักครู่';
export const AI_NOT_CONFIGURED_MESSAGE = 'ยังไม่ได้ตั้ง AI ที่ใช้คิดงาน — ตั้งได้ที่ ตั้งค่า › AI ที่ใช้คิดงาน';

/** งานนี้มี AI ให้ใช้ไหม (ตั้งจากหน้าจอ หรือ Ollama จากไฟล์ตั้งค่า) — ใช้แทน `getOllamaConfig()` ตรง ๆ */
export async function isAiConfigured(task: AiTask): Promise<boolean> {
  return Boolean(await resolveAiTarget(task));
}

export async function aiChat(options: AiChatOptions): Promise<string> {
  const target = await resolveAiTarget(options.task);
  if (!target) throw new Error(AI_NOT_CONFIGURED_MESSAGE);
  return chatWithTarget(target, options);
}

/** ยิงตรงไปที่เป้าหมาย — ใช้ทั้งงานจริงและปุ่ม "ทดสอบ" ในหน้าตั้งค่า */
export async function chatWithTarget(target: AiTarget, options: Omit<AiChatOptions, 'task'>): Promise<string> {
  if (target.kind === 'ollama') {
    return ollamaChat(options, { baseUrl: target.baseUrl, model: target.model });
  }
  const timeoutMs = options.timeoutMs ?? 180_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const content = target.kind === 'openai' ? await openaiChat(target, options, controller.signal) : await anthropicChat(target, options, controller.signal);
    logInfo('ai.chat.ok', { kind: target.kind, model: target.model, chars: content.length });
    return content;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logError('ai.chat.fail', { kind: target.kind, model: target.model, baseUrl: target.baseUrl, message: message.slice(0, 300) });
    if (message.includes('abort')) throw new Error('AI ใช้เวลานานเกินไป — ลองใหม่อีกครั้ง');
    if (message === 'fetch failed' || /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|network/i.test(message)) {
      throw new Error(BUSY_MESSAGE);
    }
    throw e instanceof Error ? e : new Error(message);
  } finally {
    clearTimeout(timer);
  }
}

/** สถานะ HTTP ที่พลาดจากฝั่งเจ้า AI → ข้อความบนจอ (ไม่มี body ดิบ — อาจมีรายละเอียดบัญชี) */
export function providerHttpError(status: number): Error {
  if (status === 401 || status === 403) return new Error('API key ใช้ไม่ได้ หรือไม่มีสิทธิ์ใช้โมเดลนี้');
  if (status === 404) return new Error('ไม่พบโมเดลนี้ หรือที่อยู่เซิร์ฟเวอร์ไม่ถูก');
  if (status === 429) return new Error('ใช้งานเกินโควตาของเจ้า AI — รอสักครู่หรือเช็กยอดเงินในบัญชี');
  if (status >= 500) return new Error(BUSY_MESSAGE);
  return new Error(`เจ้า AI ตอบ HTTP ${status}`);
}

async function openaiChat(t: AiTarget, o: Omit<AiChatOptions, 'task'>, signal: AbortSignal): Promise<string> {
  const res = await fetch(`${t.baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(t.apiKey ? { Authorization: `Bearer ${t.apiKey}` } : {}) },
    body: JSON.stringify({
      model: t.model,
      messages: o.messages,
      ...(o.temperature === undefined ? {} : { temperature: o.temperature }),
      ...(o.format === 'json' ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw providerHttpError(res.status);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('AI ตอบกลับว่าง');
  return content;
}

async function anthropicChat(t: AiTarget, o: Omit<AiChatOptions, 'task'>, signal: AbortSignal): Promise<string> {
  const system = o.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = o.messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
  // Claude ไม่มีโหมดบังคับ JSON แบบ Ollama/OpenAI — สั่งใน system แทน (ทุกงานของเราขอ JSON อยู่แล้วใน prompt)
  const sys = o.format === 'json' ? `${system}\n\nตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น`.trim() : system;
  const res = await fetch(`${t.baseUrl}/v1/messages`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...(t.apiKey ? { 'x-api-key': t.apiKey } : {}),
    },
    body: JSON.stringify({
      model: t.model,
      max_tokens: 4096,
      ...(sys ? { system: sys } : {}),
      messages: rest,
      ...(o.temperature === undefined ? {} : { temperature: o.temperature }),
    }),
  });
  if (!res.ok) throw providerHttpError(res.status);
  const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  const content = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('').trim();
  if (!content) throw new Error('AI ตอบกลับว่าง');
  return content;
}

/** รายชื่อโมเดลที่เจ้านั้นมี — ใช้เติม dropdown ในหน้าตั้งค่า · ดึงไม่ได้ = [] (ให้พิมพ์เอง) */
export async function listProviderModels(t: AiTarget): Promise<string[]> {
  try {
    const signal = AbortSignal.timeout(10_000);
    if (t.kind === 'ollama') {
      const r = await fetch(`${t.baseUrl}/api/tags`, { signal });
      if (!r.ok) return [];
      const d = (await r.json()) as { models?: Array<{ name?: string }> };
      return (d.models ?? []).map((m) => m.name ?? '').filter(Boolean);
    }
    if (t.kind === 'openai') {
      const r = await fetch(`${t.baseUrl}/models`, { signal, headers: t.apiKey ? { Authorization: `Bearer ${t.apiKey}` } : {} });
      if (!r.ok) return [];
      const d = (await r.json()) as { data?: Array<{ id?: string }> };
      return (d.data ?? []).map((m) => m.id ?? '').filter(Boolean).sort();
    }
    const r = await fetch(`${t.baseUrl}/v1/models`, {
      signal,
      headers: { 'anthropic-version': '2023-06-01', ...(t.apiKey ? { 'x-api-key': t.apiKey } : {}) },
    });
    if (!r.ok) return [];
    const d = (await r.json()) as { data?: Array<{ id?: string }> };
    return (d.data ?? []).map((m) => m.id ?? '').filter(Boolean);
  } catch {
    return [];
  }
}

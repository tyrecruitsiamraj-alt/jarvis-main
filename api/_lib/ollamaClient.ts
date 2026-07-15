import { logError, logInfo } from './logger.js';

export type OllamaMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export function getOllamaConfig(): { baseUrl: string; model: string } | null {
  const baseUrl = (process.env.OLLAMA_BASE_URL || '').trim().replace(/\/$/, '');
  const model = (process.env.OLLAMA_MODEL || '').trim();
  if (!baseUrl || !model) return null;
  return { baseUrl, model };
}

export async function checkOllamaReachable(timeoutMs = 8_000): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  const cfg = getOllamaConfig();
  if (!cfg) {
    return { ok: false, error: 'ตั้งค่า OLLAMA_BASE_URL และ OLLAMA_MODEL ใน .env.local ก่อน' };
  }
  try {
    const res = await fetch(`${cfg.baseUrl}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      return { ok: false, error: `Ollama ตอบ HTTP ${res.status}` };
    }
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    const models = (data.models || []).map((m) => m.name || '').filter(Boolean);
    const hasModel = models.some((n) => n === cfg.model || n.startsWith(`${cfg.model}:`));
    if (!hasModel) {
      return {
        ok: false,
        error: `ไม่พบโมเดล ${cfg.model} บน Ollama (มี: ${models.slice(0, 5).join(', ') || 'ไม่มี'})`,
      };
    }
    return { ok: true, models };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === 'fetch failed' || /timeout|ETIMEDOUT|ECONNREFUSED/i.test(message)) {
      return {
        ok: false,
        error: `เชื่อมต่อ Ollama ไม่ได้ที่ ${cfg.baseUrl}`,
      };
    }
    return { ok: false, error: message };
  }
}

function defaultNumCtx(): number {
  const raw = Number(process.env.OLLAMA_NUM_CTX || '');
  return Number.isFinite(raw) && raw >= 2048 ? raw : 32_768;
}

export async function ollamaChat(options: {
  messages: OllamaMessage[];
  format?: 'json';
  timeoutMs?: number;
  numCtx?: number;
  think?: boolean;
}): Promise<string> {
  const cfg = getOllamaConfig();
  if (!cfg) {
    throw new Error('ตั้งค่า OLLAMA_BASE_URL และ OLLAMA_MODEL ใน .env.local ก่อน');
  }

  const timeoutMs = options.timeoutMs ?? 180_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${cfg.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.model,
        messages: options.messages,
        stream: false,
        // ค่า default ของ Ollama คือ num_ctx 4096 — prompt ยาว (skill references) จะโดนตัดเงียบ ๆ จนโมเดลตอบว่าง
        options: { num_ctx: options.numCtx ?? defaultNumCtx() },
        ...(options.think === undefined ? {} : { think: options.think }),
        ...(options.format === 'json' ? { format: 'json' } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }

    const data = (await res.json()) as {
      message?: { content?: string; thinking?: string };
      done_reason?: string;
    };
    // โมเดลแบบ thinking (เช่น qwen3.5) อาจใส่คำตอบไว้ใน thinking แล้วปล่อย content ว่าง
    const content = data.message?.content?.trim() || data.message?.thinking?.trim();
    if (!content) {
      throw new Error(
        `Ollama ตอบกลับว่าง (done_reason=${data.done_reason || 'unknown'}) — prompt อาจยาวเกิน num_ctx`,
      );
    }
    logInfo('ollama.chat.ok', { model: cfg.model, chars: content.length });
    return content;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logError('ollama.chat.fail', { message, baseUrl: cfg.baseUrl });
    if (message.includes('abort')) {
      throw new Error('Ollama ใช้เวลานานเกินไป — ลองใหม่อีกครั้ง');
    }
    if (
      message === 'fetch failed' ||
      /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|network/i.test(message)
    ) {
      throw new Error(
        `เชื่อมต่อ Ollama ไม่ได้ที่ ${cfg.baseUrl} — ตรวจสอบว่าเครื่องรัน API เข้าถึงพอร์ต 11434 ได้ (VPN/ไฟร์วอลล์) หรือลอง OLLAMA_BASE_URL=http://127.0.0.1:11434 ถ้ารัน Ollama บนเครื่องนี้`,
      );
    }
    throw e instanceof Error ? e : new Error(message);
  } finally {
    clearTimeout(timer);
  }
}

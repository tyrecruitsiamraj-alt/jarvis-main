/**
 * ผู้ช่วย AI คุยกับ OpenAI ด้วย fetch ตรง (13 พ.ย. 2569 · แปลงจาก KNOWA) — ใช้กุญแจ/ที่อยู่/รุ่นจาก ตั้งค่า › AI ที่ใช้คิดงาน งาน "ผู้ช่วยแชท"
 * ⚠️ ข้อความผิดพลาดบอกเท่าที่หลักฐานบอก ("ปลายทางตอบ 401") · ห้าม log กุญแจหรือข้อความแชท (มีข้อมูลคนอยู่ข้างใน)
 */
import type { AiTarget } from '../aiSettingsStore.js';

export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ToolSpec = {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export class OpenAiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const SETTINGS = 'ตั้งค่า › AI ที่ใช้คิดงาน';
function explain(status: number, body: string): string {
  if (status === 401) return `OpenAI ไม่รับกุญแจนี้ (ปลายทางตอบ 401) — ตรวจกุญแจที่ ${SETTINGS}`;
  if (status === 429)
    return body.includes('insufficient_quota')
      ? 'บัญชี OpenAI หมดโควตา/ยอดเงิน (ปลายทางตอบ 429 insufficient_quota)'
      : 'OpenAI ขอให้รอสักครู่ (ปลายทางตอบ 429) — ลองใหม่อีกครั้ง';
  if (status === 404) return `ไม่พบรุ่นที่ตั้งไว้ในบัญชีนี้ (ปลายทางตอบ 404) — เลือกรุ่นใหม่ที่ ${SETTINGS}`;
  return `OpenAI ตอบ ${status}`;
}

export async function chatCompletion(opts: {
  target: AiTarget;
  messages: ChatMessage[];
  tools: ToolSpec[];
  signal: AbortSignal;
}): Promise<Extract<ChatMessage, { role: 'assistant' }>> {
  const send = (withParallel: boolean) =>
    fetch(`${opts.target.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.target.apiKey ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.target.model,
        messages: opts.messages,
        tools: opts.tools,
        ...(withParallel ? { parallel_tool_calls: false } : {}),
      }),
      signal: opts.signal,
    });
  let res = await send(true);
  let text = await res.text();
  // บางรุ่น (สายเหตุผล) ไม่รับพารามิเตอร์นี้ → ส่งใหม่โดยไม่ใส่ แล้วรับมือหลายคำสั่งเองที่ route
  if (res.status === 400 && text.includes('parallel_tool_calls')) {
    res = await send(false);
    text = await res.text();
  }
  if (!res.ok) throw new OpenAiError(explain(res.status, text), res.status);
  const json = JSON.parse(text) as { choices?: { message?: Extract<ChatMessage, { role: 'assistant' }> }[] };
  const msg = json.choices?.[0]?.message;
  if (!msg) throw new OpenAiError('OpenAI ตอบกลับมาแบบไม่มีข้อความ', 502);
  return { role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls?.length ? msg.tool_calls : undefined };
}

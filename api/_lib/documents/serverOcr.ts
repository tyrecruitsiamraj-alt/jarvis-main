/**
 * อ่านบัตรประชาชน / ใบขับขี่ ด้วยโมเดลบนเซิร์ฟเวอร์ Ollama ของบริษัท (เจ้าของ 23 พ.ย. 2569 "อยากใช้ Ollama")
 *
 * - เลือกโมเดลจากรายชื่อที่เซิร์ฟเวอร์มีจริงที่หน้าตั้งค่า (ห้ามฝังชื่อรุ่น · บทเรียน 30 ต.ค. โมเดลถูกลบแล้วไม่มีใครรู้)
 * - 🔴 โมเดลที่ลงท้าย ":cloud" ส่งข้อมูลออกไปประมวลผลนอกบริษัท — ห้ามใช้กับภาพบัตร (ไม่ขึ้นในรายชื่อ · บันทึกไม่ได้ · อ่านไม่ได้)
 * - อ่านไม่ได้/ช้าเกิน/ยังไม่ตั้ง = โยน `ServerOcrUnavailable` → หน้าผู้สมัครใช้ตัวอ่านในมือถือ (Tesseract) แทน
 * - ไม่เขียนข้อความที่อ่านได้ลง log (มีเลขบัตร ชื่อ ที่อยู่)
 */
import { getOllamaConfig } from '../ollamaClient.js';
import { logInfo } from '../logger.js';
import { readOcrFields, serverOcrEngine, type OcrResult } from '../../../src/lib/documents/ocrFields.js';
import type { UploadKind } from '../../../src/lib/documents/documentTypes.js';

export class ServerOcrUnavailable extends Error {}

/** ภาพบัตรห้ามออกนอกบริษัท — โมเดล cloud ของ Ollama ส่งงานไปเครื่องภายนอก */
export const isCloudModel = (name: string): boolean => /(^|[:-])cloud$/i.test(name.trim());

export const SERVER_OCR_TIMEOUT_MS = 100_000;
/** โมเดลที่ไม่มีคนใช้สักพักถูกปิด เปิดใหม่ใช้ 35+ วินาที (วัด 23 พ.ย. 2569: เปิดค้าง = บัตรละ ~1.5 วินาที) */
export const OCR_KEEP_ALIVE = '30m';
const PROMPT = 'Extract all text from the image. Return plain text in natural reading order.';

const baseUrl = (): string | null => getOllamaConfig()?.baseUrl ?? null;

export type OcrModelList = { ok: true; models: string[] } | { ok: false; error: string };

/** รายชื่อโมเดลที่ใช้อ่านบัตรได้ (ตัด cloud ออก) — ใช้ทั้งหน้าตั้งค่าและตอนตรวจก่อนบันทึก */
export async function listOcrModels(timeoutMs = 8_000): Promise<OcrModelList> {
  const base = baseUrl();
  if (!base) return { ok: false, error: 'ยังไม่ได้ตั้งเซิร์ฟเวอร์ AI ของบริษัท' };
  try {
    const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return { ok: false, error: `เซิร์ฟเวอร์ AI ตอบ ${r.status}` };
    const data = (await r.json()) as { models?: Array<{ name?: string }> };
    const models = (data.models ?? []).map((m) => (m.name ?? '').trim()).filter((n) => n && !isCloudModel(n));
    return { ok: true, models: [...new Set(models)].sort() };
  } catch {
    // ที่อยู่เซิร์ฟเวอร์ภายในห้ามขึ้นจอ
    return { ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์ AI ไม่ได้' };
  }
}

/** ข้อความจากโมเดลอ่านเอกสารมักเป็น markdown — ถอดเครื่องหมายออกก่อนแยกช่อง */
export function plainOcrText(raw: string): string {
  return raw
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/<[^>]{1,40}>/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*\|?[-:\s|]+\|?\s*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * เปิดโมเดลรอไว้ตั้งแต่ผู้สมัครเปิดลิงก์ — ถึงตอนถ่ายบัตรโมเดลพร้อมแล้ว · ไม่รอผล ไม่ส่งภาพ (Ollama: generate ไม่มี prompt = โหลดโมเดลอย่างเดียว)
 */
export function warmOcrModel(model: string): void {
  const base = baseUrl();
  if (!model || !base || isCloudModel(model)) return;
  void fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({ model, keep_alive: OCR_KEEP_ALIVE }),
  }).catch(() => undefined);
}

export async function serverOcr(model: string, bytes: Buffer, kind: UploadKind): Promise<OcrResult> {
  const base = baseUrl();
  if (!model || !base) throw new ServerOcrUnavailable('ยังไม่ได้เลือกโมเดลอ่านบัตร');
  if (isCloudModel(model)) throw new ServerOcrUnavailable('โมเดลนี้ส่งข้อมูลออกนอกบริษัท ใช้อ่านบัตรไม่ได้');
  const started = Date.now();
  let text = '';
  try {
    const r = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(SERVER_OCR_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: OCR_KEEP_ALIVE,
        options: { temperature: 0 },
        messages: [{ role: 'user', content: PROMPT, images: [bytes.toString('base64')] }],
      }),
    });
    if (!r.ok) throw new ServerOcrUnavailable(`เซิร์ฟเวอร์ AI ตอบ ${r.status}`);
    const data = (await r.json()) as { message?: { content?: unknown } };
    text = typeof data.message?.content === 'string' ? data.message.content : '';
  } catch (e) {
    logInfo('documents.server_ocr', { ok: false, kind, ms: Date.now() - started });
    if (e instanceof ServerOcrUnavailable) throw e;
    throw new ServerOcrUnavailable('อ่านภาพที่เซิร์ฟเวอร์ไม่ได้');
  }
  const plain = plainOcrText(text);
  logInfo('documents.server_ocr', { ok: plain.length > 0, kind, ms: Date.now() - started });
  if (!plain) throw new ServerOcrUnavailable('เซิร์ฟเวอร์อ่านภาพนี้ไม่ออก');
  // โมเดลไม่บอกความมั่นใจ — อ่านได้ = 90 · ช่องที่แยกไม่ได้มีคำเตือนของตัวแยกช่องเอง
  return readOcrFields(plain, kind, 90, serverOcrEngine(model));
}

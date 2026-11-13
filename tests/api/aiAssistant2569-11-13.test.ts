/**
 * ผู้ช่วย AI แชทมุมขวาล่าง (เจ้าของ 13 พ.ย. 2569) — ด่านความปลอดภัยที่โค้ดตัดสิน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_CATALOG } from '../../api/_lib/aiAssistant/apiCatalog.generated';
import { maskPersonal, resolveCall, searchApi } from '../../api/_lib/aiAssistant/tools';
import { inventedValue, maskUserMessages, restorePersonal } from '../../api/_lib/aiAssistant/guards';
import type { ChatMessage } from '../../api/_lib/aiAssistant/openai';
import { aiChatLinkLabel } from '@/lib/aiChatLinks';

const read = (p: string) => readFileSync(p, 'utf8');

describe('สารบัญคำสั่ง', () => {
  it('ตรงกับเส้นที่เปิดจริงใน registry ทุกเส้น (เพิ่ม/แก้เส้นแล้วลืม npm run ai:catalog = เทสต์ตก)', () => {
    const reg = [...read('api/_handlers/registry.ts').matchAll(/^\s*'(\/api\/[^']+)':/gm)].map((m) => m[1]).sort();
    expect(API_CATALOG.map((e) => e.path).sort()).toEqual(reg);
  });
  it('คำอธิบายเต็ม ไม่ตัดสั้น (บทเรียน KNOWA) · เส้นที่ส่งงานให้ Lumos ถูกติดธงว่าไปถึงคนจริง', () => {
    const dispatch = API_CATALOG.find((e) => e.path === '/api/lumos/dispatch')!;
    expect(dispatch.reachesPeople).toBe(true);
    expect(API_CATALOG.find((e) => e.path === '/api/application-dispatch')!.reachesPeople).toBe(true);
    expect(API_CATALOG.find((e) => e.path === '/api/matching/job-postings')!.reachesPeople).toBe(true);
    expect(Math.max(...API_CATALOG.map((e) => e.doc.length))).toBeGreaterThan(1000);
  });
});

describe('รายการห้าม (เจ้าของ Choice "ไม่ให้สั่งเลย" งานที่ไปถึงคนจริง)', () => {
  const refused = (m: string, p: string) => !resolveCall(m, p).ok;
  it('ส่ง AI โทร · แผนติดตาม · Autopost/Scrap · ตั้งค่าที่เปลี่ยนวิธีโทร = สั่งไม่ได้', () => {
    expect(refused('POST', '/api/lumos/dispatch')).toBe(true);
    expect(refused('POST', '/api/application-dispatch')).toBe(true);
    expect(refused('POST', '/api/follow')).toBe(true);
    expect(refused('POST', '/api/matching/job-postings')).toBe(true);
    expect(refused('PUT', '/api/lumos/dispatch-mode')).toBe(true);
    expect(refused('PUT', '/api/call-scripts')).toBe(true);
    expect(refused('POST', '/api/siamraj/unit-notes')).toBe(true);
  });
  it('ล็อกอิน · กุญแจ · หน้าสาธารณะ · ตัวผู้ช่วยเอง · อัปโหลดไฟล์ = สั่งไม่ได้ทุกแบบ', () => {
    expect(refused('GET', '/api/auth/me')).toBe(true);
    expect(refused('GET', '/api/ai-settings')).toBe(true);
    expect(refused('GET', '/api/integration-keys')).toBe(true);
    expect(refused('GET', '/api/public/jobs')).toBe(true);
    expect(refused('POST', '/api/ai/chat')).toBe(true);
    expect(refused('POST', '/api/job-application-document')).toBe(true);
  });
  it('อ่านได้ (รวมเส้นที่เขียนแล้วไปถึงคนจริง) · งานบันทึกทั่วไปขึ้นการ์ดได้ · เส้นที่ไม่มี/method ผิด = ปฏิเสธ', () => {
    expect(resolveCall('GET', '/api/follow?limit=5').ok).toBe(true);
    expect(resolveCall('GET', '/api/siamraj/unit-requests?limit=50').ok).toBe(true);
    expect(resolveCall('POST', '/api/application-contacts').ok).toBe(true);
    expect(refused('GET', '/api/nope')).toBe(true);
    expect(refused('PATCH', '/api/home-kpis')).toBe(true);
    expect(refused('GET', '/api/../etc/passwd')).toBe(true);
  });
  it('สารบัญที่ AI ค้นบอกว่าเส้นไหนอ่านได้อย่างเดียว · คำค้นมีเครื่องหมายคำพูดก็หาเจอ', () => {
    expect(searchApi('"lumos" dispatch')).toContain('(ผู้ช่วยอ่านได้อย่างเดียว)');
    expect(searchApi("'application-contacts'")).toContain('/api/application-contacts');
  });
});

describe('ปิดเบอร์ · อีเมล · เลข 13 หลัก ก่อนถึง OpenAI', () => {
  it('ทุกรูปแบบที่เจอในข้อมูลผู้สมัคร', () => {
    const s = maskPersonal('โทร 0812345678 · 081-234-5678 · +66 81 234 5678 · 66812345678 · บ้าน 02-123-4567 · a.b@siamraj.com · 1103700012345 · 1-1037-00012-34-5');
    expect(s).not.toMatch(/\d{7,}/);
    expect(s).not.toContain('@');
    expect(s.match(/\[เบอร์\]/g)).toHaveLength(5);
    expect(s.match(/\[เลข 13 หลัก\]/g)).toHaveLength(2);
  });
  it('ตัวเลขทั่วไป (ยอด · วันที่ · เลขใบขอ) ไม่โดนปิด', () => {
    expect(maskPersonal('ใบ LBM6909002 · 23,000 บาท · 2026-11-13 · 37 กลุ่ม')).toBe('ใบ LBM6909002 · 23,000 บาท · 2026-11-13 · 37 กลุ่ม');
  });
});

describe('ด่านโค้ด: ห้ามแต่งข้อมูลเอง · ค่าส่วนตัวที่ผู้ใช้พิมพ์ใช้ได้โดย OpenAI ไม่เห็น', () => {
  const history: ChatMessage[] = [
    { role: 'user', content: 'บันทึกผลติดต่อคุณสมชาย เบอร์ 081-234-5678 ว่า ติดต่อได้ นัดสัมภาษณ์พรุ่งนี้' },
    { role: 'tool', tool_call_id: 't1', content: 'HTTP 200\n{"name":"สมชาย ใจดี","position":"พนักงานขับรถ"}' },
  ];
  it('ข้อความผู้ใช้: เบอร์กลายเป็นป้ายมีเลข · เลขเดิมทุกรอบ · คืนค่าจริงตอนขึ้นการ์ด', () => {
    const a = maskUserMessages(history);
    expect((a.messages[0] as { content: string }).content).toContain('[เบอร์#1]');
    expect((a.messages[0] as { content: string }).content).not.toContain('081');
    expect(maskUserMessages(history).vault.get('[เบอร์#1]')).toBe('081-234-5678');
    expect(restorePersonal({ phone: '[เบอร์#1]' }, a.vault)).toEqual({ body: { phone: '081-234-5678' }, unresolved: false });
    expect(restorePersonal({ phone: '[เบอร์]' }, a.vault).unresolved).toBe(true);
  });
  it('ข้อความที่ผู้ใช้พิมพ์ / อ่านจากระบบ = ผ่าน · AI แต่งเอง = ไม่ขึ้นการ์ด', () => {
    const masked = maskUserMessages(history).messages;
    expect(inventedValue({ note: 'นัดสัมภาษณ์พรุ่งนี้', status: 'ok' }, masked)).toBeNull();
    expect(inventedValue({ name: 'สมชาย ใจดี' }, masked)).toBeNull();
    expect(inventedValue({ note: 'ผู้สมัครสนใจมาก พร้อมเริ่มงานทันที' }, masked)).toBe('ผู้สมัครสนใจมาก พร้อมเริ่มงานทันที');
  });
});

describe('ใช้ได้เฉพาะ admin + supervisor · หน้าจอ', () => {
  it('เส้นแชทตรวจบทบาทที่เซิร์ฟเวอร์ · ปุ่มแชทขึ้นเฉพาะสองบทบาทนี้', () => {
    expect(read('api/_handlers/ai-chat.ts')).toContain("withAuth(handler, { roles: ['admin', 'supervisor'] })");
    expect(read('src/App.tsx')).toMatch(/user\?\.role === "admin" \|\| user\?\.role === "supervisor" \? \(\s*<Suspense fallback=\{null\}>\s*<AiChat \/>/);
  });
  it('กุญแจ OpenAI จากหน้าตั้งค่าเท่านั้น ไม่ถอยไป Ollama · nginx รอเส้นนี้ 95 วิ · โค้ดตัดเองที่ 85 วิ', () => {
    expect(read('src/lib/aiSettings.ts')).toContain("'assistant_chat'");
    expect(read('api/_lib/aiSettingsStore.ts')).toContain("t.kind === 'openai' && t.apiKey && t.model");
    expect(read('docker/nginx.conf')).toContain('location = /api/ai/chat');
    expect(read('api/_handlers/ai-chat.ts')).toContain('const DEADLINE_MS = 85_000;');
  });
  it('ลิงก์ในคำตอบแสดงเป็นคำ ไม่โชว์ id', () => {
    expect(aiChatLinkLabel('/jobs/siamraj/siamraj-pre%3ALBM6909002')).toBe('เปิดหน้าใบขอ');
    expect(aiChatLinkLabel('/jobs/board?view=dashboard')).toBe('หน้าภาพรวม');
    expect(aiChatLinkLabel('/follow')).toBe('หน้าติดตาม');
  });
});

describe('ตั้งผู้ช่วยในกล่องเดียวแบบ KNOWA (เจ้าของ 13 พ.ย. 2569 "ตั้งไรเยอะแยะ")', () => {
  it('รุ่นจากบัญชีจริง ตัดรุ่นภาพ/เสียง/ฝังเวกเตอร์ · ไม่ฝังชื่อรุ่น', async () => {
    const { assistantChatModels, ROUTED_AI_TASKS } = await import('@/lib/aiSettings');
    expect(assistantChatModels(['text-embedding-3-small', 'gpt-x-mini', 'gpt-x-audio', 'whisper-1', 'o9', 'dall-e-3'])).toEqual(['gpt-x-mini', 'o9']);
    expect(ROUTED_AI_TASKS).not.toContain('assistant_chat');
  });
  it('กล่องผู้ช่วยอยู่บนสุดของหน้า · ตารางงานเดิมไม่มีแถวผู้ช่วยซ้ำ และบันทึกตารางไม่ทับค่าผู้ช่วย', () => {
    const tab = read('src/pages/settings/AiSettingsTab.tsx');
    expect(tab.indexOf('<AssistantAiCard')).toBeLessThan(tab.indexOf('งานไหนใช้ AI ตัวไหน</h3>'));
    expect(tab).toContain('ROUTED_AI_TASKS.map((t) => ({ task: t, connection_id');
    const card = read('src/pages/settings/AssistantAiCard.tsx');
    expect(card).toContain("saveAiRoutes([{ task: 'assistant_chat', connection_id: c.id, model }])");
    expect(card).toContain('type="password"');
  });
});

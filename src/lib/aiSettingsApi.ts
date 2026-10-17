/** หน้าตั้งค่า › AI ที่ใช้คิดงาน (17 ต.ค. 2569) — เรียก `/api/ai-settings` (admin) */
import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage } from '@/lib/api';
import type { AiConnectionInput, AiSettingsView, AiTask } from '@/lib/aiSettings';

async function post<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const r = await apiFetch('/api/ai-settings', { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await readErrorMessage(r, fallback));
  return (await r.json()) as T;
}

export async function fetchAiSettings(): Promise<AiSettingsView> {
  const r = await apiFetch('/api/ai-settings', { cache: 'no-store' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดการตั้งค่า AI ไม่สำเร็จ'));
  return (await r.json()) as AiSettingsView;
}

export async function saveAiConnection(connection: AiConnectionInput): Promise<AiSettingsView> {
  return (await post<{ settings: AiSettingsView }>({ action: 'save_connection', connection }, 'บันทึกไม่สำเร็จ')).settings;
}

export async function deleteAiConnection(id: string): Promise<AiSettingsView> {
  return (await post<{ settings: AiSettingsView }>({ action: 'delete_connection', id }, 'ลบไม่สำเร็จ')).settings;
}

export async function saveAiRoutes(
  routes: Array<{ task: AiTask; connection_id: string | null; model: string | null }>,
): Promise<AiSettingsView> {
  return (await post<{ settings: AiSettingsView }>({ action: 'save_routes', routes }, 'บันทึกไม่สำเร็จ')).settings;
}

export type AiTestResult = { ok: boolean; ms: number; reply?: string; error?: string };

/** ทดสอบ — ส่งร่าง (ยังไม่บันทึก) หรือ id ที่บันทึกแล้ว · ไม่เขียนอะไรลงฐาน */
export async function testAiConnection(
  input: { connection: AiConnectionInput } | { connection_id: string; model?: string | null },
): Promise<AiTestResult> {
  return post<AiTestResult>({ action: 'test', ...input }, 'ทดสอบไม่สำเร็จ');
}

export async function listAiModels(input: { connection: AiConnectionInput } | { connection_id: string }): Promise<string[]> {
  return (await post<{ models: string[] }>({ action: 'models', ...input }, 'ดึงรายชื่อโมเดลไม่สำเร็จ')).models;
}

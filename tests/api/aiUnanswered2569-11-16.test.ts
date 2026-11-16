import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

/** เจ้าของ 16 พ.ย. 2569 "Ai เก็บอะไรที่ไม่มีคำตอบมา แล้วบอกหน่อยว่าไม่มีคำตอบแล้วจะดูยังไง" */
const calls: Array<{ sql: string; params: unknown[] }> = [];
vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(async (sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    return { rows: [], rowCount: 1 };
  }),
  isPgUndefinedTable: () => false,
}));

import { AI_TOOLS } from '../../api/_lib/aiAssistant/tools';
import { recordUnanswered } from '../../api/_lib/aiAssistant/unanswered';

describe('ผู้ช่วย AI: จดคำถามที่ตอบไม่ได้', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('จดคำถามล่าสุด + ขาดอะไร · ปิดเบอร์/อีเมลก่อนจด · คำถามเดิมไม่จดซ้ำใน 30 นาที', async () => {
    await recordUnanswered({ userId: 'u1', name: 'นิ', question: 'ผู้สมัครใหม่ทั้งหมดวันนี้ โทร 0812345678', missing: 'ไม่มีช่องที่ตรง a@b.co' });
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/insert into .*ai_unanswered/s);
    expect(calls[0].sql).toContain('where not exists');
    expect(calls[0].params).toEqual(['u1', 'นิ', 'ผู้สมัครใหม่ทั้งหมดวันนี้ โทร [เบอร์]', 'ไม่มีช่องที่ตรง [อีเมล]', 30]);
  });

  it('คำถามว่าง = ไม่จด', async () => {
    await recordUnanswered({ userId: 'u1', name: 'นิ', question: '   ', missing: 'x' });
    expect(calls).toHaveLength(0);
  });

  it('มีเครื่องมือ note_unanswered + แชทจดแล้วตอบต่อ (จดล้มไม่ทำแชทล้ม) + กติกาบอกผู้ใช้', () => {
    expect(AI_TOOLS.map((t) => t.function.name)).toContain('note_unanswered');
    const chat = readFileSync('api/_handlers/ai-chat.ts', 'utf8');
    expect(chat).toContain("call.function.name === 'note_unanswered'");
    expect(chat).toMatch(/recordUnanswered\([\s\S]*?\.catch\(/);
    expect(chat).toContain('จดคำถามนี้ไว้ให้ผู้ดูแลระบบแล้ว');
  });

  it('ดูได้ที่ ตั้งค่า › AI ที่ใช้คิดงาน · admin เท่านั้น · กด "ดูแล้ว" ไม่ลบแถว', () => {
    expect(readFileSync('src/pages/settings/AiSettingsTab.tsx', 'utf8')).toContain('<AssistantUnansweredCard />');
    const h = readFileSync('api/_handlers/ai-unanswered.ts', 'utf8');
    expect(h).toContain("withAuth(handler, { roles: ['admin'] })");
    const lib = readFileSync('api/_lib/aiAssistant/unanswered.ts', 'utf8');
    expect(lib).toContain('set cleared_at = now()');
    expect(lib).not.toMatch(/delete from/i);
    expect(readFileSync('api/_handlers/registry.ts', 'utf8')).toContain("'/api/ai/unanswered': aiUnansweredHandler");
  });
});

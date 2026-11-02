/**
 * กระดิ่งไม่ดึงแจ้งเตือนตอนแท็บซ่อน · กลับมาเห็นจอดึงทันที + ดัชนีให้ตรงคำสั่ง (เจ้าของ 2 พ.ย. 2569 "งั้นทำเลย")
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../', p), 'utf8');

describe('กระดิ่งแจ้งเตือน', () => {
  it('รอบ 1 นาทีข้ามตอนแท็บซ่อน · กลับมาเห็นจอดึงทันที · ถอด listener ตอนเลิกใช้', () => {
    const src = read('src/contexts/NotificationContext.tsx');
    expect(src).toContain("if (document.visibilityState === 'hidden') return;");
    expect(src).toContain("document.addEventListener('visibilitychange', onVisible);");
    expect(src).toContain("document.removeEventListener('visibilitychange', onVisible);");
    expect(src).toContain('const POLL_MS = 60_000;');
  });

  it('migration เพิ่มดัชนีอย่างเดียว ตรงกับ order by created_at desc ของคนเดียว', () => {
    const sql = read('migrations/171_app_notifications_recent_idx.sql');
    expect(sql).toMatch(/create index if not exists app_notifications_recent_idx\s+on app_notifications \(recipient_user_id, created_at desc\)/);
    expect(sql).toMatch(/create index if not exists app_notifications_type_recent_idx\s+on app_notifications \(recipient_user_id, type, created_at desc\)/);
    expect(sql).not.toMatch(/drop |delete |update /i);
  });
});

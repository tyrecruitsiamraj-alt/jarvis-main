/**
 * โพสต์เอง: คนละแถวต่อคนที่วาง (เจ้าของ 20 พ.ย. 2569 "ฉันใช้บัญชีฉันเพราะฉันไม่เคยให้ Pakorn กดเลย")
 * เดิม (ลิงก์ · วัน) แถวเดียว — คนที่สองวางลิงก์โพสต์ = เขียนทับลิงก์ของคนแรก แต่ชื่อยังเป็นคนแรก
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('ลิงก์โพสต์ต่อคนที่วาง', () => {
  it('migration 194: ไม่ซ้ำที่ (ลิงก์ · วัน · คนวาง) · ไม่แตะข้อมูล', () => {
    const sql = readFileSync('migrations/194_posting_link_posts_per_poster.sql', 'utf8');
    expect(sql).toContain('create unique index if not exists recruit_posting_link_posts_link_day_poster on recruit_posting_link_posts (link_id, day, posted_by_user_id);');
    expect(sql).toContain('drop constraint if exists recruit_posting_link_posts_pkey;');
    expect(sql).not.toMatch(/^\s*(delete|update|insert|truncate)\b/im);
  });
  it('บันทึกด้วย key ใหม่ · ช่วง deploy ก่อน migrate (42P10) ใช้ key เดิม · error อื่นโยนต่อ', () => {
    const src = readFileSync('api/_lib/jobPostActions.ts', 'utf8');
    expect(src).toContain("await upsert('link_id, day, posted_by_user_id');");
    expect(src).toContain("if ((e as { code?: string })?.code !== '42P10') throw e;");
  });
});

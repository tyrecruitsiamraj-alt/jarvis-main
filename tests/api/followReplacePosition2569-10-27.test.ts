/** ตำแหน่งคนไปแทน — Spare (เจ้าของ 27 ต.ค. 2569 "ช่องส่งคนแทนเพิ่มตำแหน่ง Spare" · Choice ช่องตำแหน่งในฟอร์ม) */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REPLACE_POSITIONS } from '@/lib/followReplacement';
import { groupFollowEntries } from '@/lib/followGrouping';
import type { FollowEntry } from '@/lib/followApi';

describe('ตำแหน่งคนไปแทน', () => {
  it('มีตัวเลือก Spare · ฟอร์มส่งเฉพาะแท็บส่งคนแทน · server เก็บ/แก้ได้', () => {
    expect(REPLACE_POSITIONS).toContain('Spare');
    const page = readFileSync('src/pages/follow/FollowPage.tsx', 'utf8');
    expect(page).toContain("...(replaceView ? { replace_position: replacePosition || null } : {})");
    const api = readFileSync('api/_handlers/follow.ts', 'utf8');
    expect(api).toContain('replacePosition: cut(body.replace_position, 60)');
    expect(api).toContain("hasOwnProperty.call(body, 'replace_position')");
  });

  it('แถวในตารางได้ตำแหน่งจากรอบล่าสุดที่ระบุ', () => {
    const e = (over: Partial<FollowEntry>): FollowEntry =>
      ({ id: 'a', recipient_name: 'ทดสอบ แทน', recipient_phone: '0811111111', topic: 'ติดตามส่งคนแทน', note: null, cancelled: false, call_status: 'pending', call_outcome: null, created_at: '2026-10-27T01:00:00Z', scheduled_at: '2026-10-28T01:00:00Z', ...over }) as FollowEntry;
    const [g] = groupFollowEntries([e({ id: 'a' }), e({ id: 'b', created_at: '2026-10-27T02:00:00Z', replace_position: 'Spare' })], new Date('2026-10-27T03:00:00Z'));
    expect(g.replacePosition).toBe('Spare');
  });
});

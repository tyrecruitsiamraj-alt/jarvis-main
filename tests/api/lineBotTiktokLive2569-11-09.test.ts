// @vitest-environment node
/**
 * ผู้สมัครจากบอท LINE So Work = ช่องทาง TikTok Live (เจ้าของ 9 พ.ย. 2569 "ไม่มีที่อื่น นับเป็น TikTok Live ได้เลย")
 * เดิมผู้สมัครเลือกเองในฟอร์ม 41 คนกระจาย Tiktok 19 · Tiktok Live 17 · Facebook 3 · Webjob 2
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LINE_BOT_CHANNEL, LINE_BOT_CHANNEL_LABEL, referralSourceOfChannel } from '@/lib/referralChannel';
import { subChannelOf } from '@/lib/channelSub';
import { funnelChannelOf } from '@/lib/homeOverviewFunnel';

describe('บอท LINE → Tiktok · Tiktok Live', () => {
  it('ป้ายเดียวกับหน้าจัดช่องทาง · กราฟนับเป็น Tiktok · ช่องทางรอง Tiktok Live', () => {
    expect(LINE_BOT_CHANNEL_LABEL).toBe('Tiktok · Tiktok Live');
    expect(referralSourceOfChannel(LINE_BOT_CHANNEL_LABEL)).toBe('tiktok');
    expect(funnelChannelOf({ channelLabel: LINE_BOT_CHANNEL_LABEL, referralSource: 'line_oa' })).toBe('Tiktok');
    expect(subChannelOf(LINE_BOT_CHANNEL_LABEL, 'line_oa')).toBe(LINE_BOT_CHANNEL.name);
  });
  it('ฟอร์มล็อกช่องทางเมื่อมี lid + lsig · ลิงก์ที่ Gen ยังชนะ', () => {
    const src = readFileSync('src/components/jobs/PublicApplyDialog.tsx', 'utf8');
    expect(src).toContain("const fromLineBot = Boolean(searchParams.get('lid') && searchParams.get('lsig'));");
    expect(src).toContain('posting?.channelLabel?.trim() || (fromLineBot ? LINE_BOT_CHANNEL_LABEL : null)');
  });
  it('ฝั่ง API ตั้งช่องทางเองเมื่อลายเซ็นบอทผ่าน ไม่เชื่อค่าจากหน้าเว็บ', () => {
    const src = readFileSync('api/_handlers/public/apply.ts', 'utf8');
    expect(src).toContain('if (lineUserId && !lockedByLink) {');
    expect(src).toContain('channelLabel = LINE_BOT_CHANNEL_LABEL;');
  });
});

// @vitest-environment node
/**
 * 🔴 ลิงก์ที่ Gen ล็อกช่องทาง (เจ้าของ 6 ต.ค. 2569 "Link ที่ Gen ต้อง Lock ช่องทางด้วยสิ่" · เคยสั่ง 2 ต.ค.)
 * ชื่อช่องทางจริงบนลิงก์ (6 ต.ค.): Facebook Group/Page/Ads · LINE OA · Tiktok · ป้าย/ใบปลิว · ลิงก์กลาง (ไม่ระบุ)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { referralSourceOfChannel } from '../../src/lib/referralChannel';

const code = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('ชื่อช่องทางของลิงก์ → ค่าในใบสมัคร', () => {
  it('ช่องทางจริงทุกแบบ', () => {
    expect(referralSourceOfChannel('Facebook Group')).toBe('facebook');
    expect(referralSourceOfChannel('Facebook Group · กลุ่มคนหางาน ชลบุรี')).toBe('facebook');
    expect(referralSourceOfChannel('Facebook Ads · Facebook Ads')).toBe('facebook');
    expect(referralSourceOfChannel('Facebook Page')).toBe('facebook');
    expect(referralSourceOfChannel('Tiktok')).toBe('tiktok');
    expect(referralSourceOfChannel('ป้าย/ใบปลิว')).toBe('flyer');
    expect(referralSourceOfChannel('LINE OA')).toBe('other');
  });
  it('ลิงก์กลาง (ไม่มีช่องทาง) = ไม่ล็อก', () => {
    expect(referralSourceOfChannel(null)).toBeNull();
    expect(referralSourceOfChannel('  ')).toBeNull();
  });
});

describe('ล็อกทั้งหน้าเว็บและฝั่ง API', () => {
  it('ฟอร์ม: ลิงก์มีช่องทาง = ช่องเลือกถูกปิด โชว์ชื่อช่องทางของลิงก์ · ส่งค่าตามลิงก์', () => {
    const src = code('src/components/jobs/PublicApplyDialog.tsx');
    expect(src).toContain('data-testid="apply-channel-locked"');
    expect(src).toContain('referral_source: lockedSource ?? (referralSource || null)');
    expect(code('src/pages/public/PublicPostingApplyPage.tsx')).toContain('channelLabel: info.channelLabel');
  });
  it('API: มี link_id = บันทึกช่องทางตามลิงก์เสมอ ไม่เชื่อค่าจากหน้าเว็บ', () => {
    const src = code('api/_handlers/public/apply.ts');
    expect(src).toContain('referralSourceOfChannel(rows[0]?.channel_label)');
    expect(src).toContain('if (locked) v.referralSource = locked;');
  });
});

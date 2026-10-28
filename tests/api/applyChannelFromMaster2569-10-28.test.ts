import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// เจ้าของ 28 ต.ค. 2569 "มันต้องยึดตามช่องทางหลัก" → "ยึดตาม /recruit/channels" · Choice ใช้รายการเดียวกันในหน้าสมัคร
describe('ช่อง "เห็นประกาศจากช่องทางไหน" ใช้ช่องทางหลักจากหน้าจัดช่องทาง', () => {
  it('หน้าสมัครโหลดจาก /api/public/channels ไม่ใช่ 5 ค่าตายตัว · ส่ง channel_id', () => {
    const dlg = readFileSync('src/components/jobs/PublicApplyDialog.tsx', 'utf8');
    expect(dlg).toContain('fetchPublicChannels()');
    expect(dlg).not.toContain('REFERRAL_SOURCES.map');
    expect(dlg).toContain('channel_id: lockedChannel ? null : referralSource || null');
    expect(readFileSync('src/lib/publicApplicationsApi.ts', 'utf8')).toContain("apiFetch('/api/public/channels')");
  });

  it('เส้นสาธารณะคืนแค่ id/ชื่อของช่องทางหลักที่เปิดใช้ · ลงทะเบียนแล้ว', () => {
    const h = readFileSync('api/_handlers/public/channels.ts', 'utf8');
    expect(h).toContain('listRecruitChannels(false)');
    expect(h).toContain('children: (c.children ?? []).map((k) => ({ id: k.id, name: k.name }))');
    expect(readFileSync('api/_handlers/registry.ts', 'utf8')).toContain("'/api/public/channels': publicChannelsHandler");
  });

  it('ฝั่งรับใบสมัครไม่เชื่อชื่อจากหน้าเว็บ — อ่านชื่อจากฐานด้วย id · ต้องเป็นช่องทางหลักที่เปิดใช้ · ลิงก์ล็อกชนะ', () => {
    const a = readFileSync('api/_handlers/public/apply.ts', 'utf8');
    expect(a).toContain('where c.id = $1::uuid and c.is_active = true and (c.parent_id is null or p.is_active = true)');
    expect(a).toContain('if (!lockedByLink && typeof rawChannelId');
    expect(a).toContain('posting_id, link_id, channel_id, channel_label');
  });
});

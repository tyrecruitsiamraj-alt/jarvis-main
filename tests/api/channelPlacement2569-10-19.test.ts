// @vitest-environment node
/** ช่องทางที่ได้คนลงงาน (เจ้าของ 19 ต.ค. 2569 · นับตามวันแจ้งเข้า · ช่องทางหลัก กดดูย่อยได้) */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildChannelPlacement, mainChannelOf, UNKNOWN_CHANNEL } from '../../src/lib/channelPlacement';

const W = { from: '2026-10-01', to: '2026-10-31' };

describe('mainChannelOf', () => {
  it('รวมชื่อช่องทางเป็นชุดเดียว · TikTok ไลฟ์แยก', () => {
    expect(mainChannelOf('Tiktok', 'SOWORK Driver')).toBe('TikTok');
    expect(mainChannelOf('tiktok', 'ลิงก์ระบบเรา')).toBe('TikTok');
    expect(mainChannelOf('Tiktok', 'Live')).toBe('TikTok ไลฟ์สด');
    expect(mainChannelOf('Line AI LBD', 'Line Ai')).toBe('Line AI LBD');
    expect(mainChannelOf('Facebook Group', 'x')).toBe('Facebook กลุ่ม');
    expect(mainChannelOf(null, null)).toBe('ไม่ระบุ');
  });
});

describe('buildChannelPlacement', () => {
  const regs = [
    { phone9: '811111111', at: '2026-09-01T03:00:00Z', channel: 'Facebook Group', sub: 'กลุ่ม A' },
    { phone9: '811111111', at: '2026-10-02T03:00:00Z', channel: 'Tiktok', sub: 'SOWORK Driver' }, // ล่าสุดก่อนแจ้งเข้า = TikTok
    { phone9: '822222222', at: '2026-10-05T03:00:00Z', channel: 'Line AI LBD', sub: 'Line Ai' },
    { phone9: '833333333', at: '2026-10-20T03:00:00Z', channel: 'Tiktok', sub: 'SOWORK Driver' }, // ลงทะเบียนหลังแจ้งเข้า = ไม่นับเป็นช่องทาง
    { phone9: '844444444', at: '2024-01-01T03:00:00Z', channel: 'Tiktok', sub: 'x' }, // เกิน 365 วัน
  ];
  const informs = [
    { phone9: '811111111', at: '2026-10-10T00:00:00Z' },
    { phone9: '822222222', at: '2026-10-05T00:00:00Z' }, // แจ้งเข้าวันเดียวกับลงทะเบียน = นับ
    { phone9: '833333333', at: '2026-10-12T00:00:00Z' },
    { phone9: '844444444', at: '2026-10-12T00:00:00Z' },
    { phone9: '855555555', at: '2026-09-30T00:00:00Z' }, // นอกช่วง
  ];
  const out = buildChannelPlacement(regs, informs, W);
  const row = (c: string) => out.rows.find((r) => r.channel === c)!;
  it('ลงงานทุกแถวรวมกัน = แจ้งเข้าในช่วง · ไม่รู้ช่องทางแยกแถวท้าย', () => {
    expect(out.informed).toBe(4);
    expect(out.rows.reduce((n, r) => n + r.placed, 0)).toBe(out.informed);
    expect(out.matched).toBe(2);
    expect(row(UNKNOWN_CHANNEL).placed).toBe(2);
    expect(out.rows[out.rows.length - 1].channel).toBe(UNKNOWN_CHANNEL);
  });
  it('ใช้การลงทะเบียนล่าสุดก่อนแจ้งเข้า · ลงทะเบียนนับตามวันลงทะเบียนในช่วง', () => {
    expect(row('TikTok').placed).toBe(1);
    expect(row('TikTok').registered).toBe(2);
    expect(row('Line AI LBD').placed).toBe(1);
    expect(row('TikTok').subs[0]).toEqual({ name: 'SOWORK Driver', registered: 2, placed: 1 });
  });
});

describe('หน้าภาพรวม', () => {
  it('การ์ดช่องทางที่ได้คนลงงาน · API อ่าน iRecruit + ลิงก์ระบบเรา + ERP แจ้งเข้าที่ไม่ยกเลิก', () => {
    expect(readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8')).toContain('<ChannelPlacementTable data={data.channelPlacement} />');
    const sql = readFileSync('api/_lib/channelPlacementSql.ts', 'utf8');
    expect(sql).toContain('FROM recruit_register r');
    expect(sql).toContain("activeInformWhereSql('IH')");
    expect(sql).toContain("not ilike 'irecruit%'");
  });
});

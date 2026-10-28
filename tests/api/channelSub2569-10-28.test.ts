import { describe, expect, it } from 'vitest';
import { subChannelOf } from '../../src/lib/channelSub';

describe('ตัวกรองช่องทาง = ช่องทางรองเท่านั้น (เจ้าของ 28 ต.ค. 2569 "Tiktok 138 · TikTok 49 ต่างกันยังไง")', () => {
  it('Tiktok จากหน้าช่องทาง กับ TikTok ที่ผู้สมัครเลือกในฟอร์มเก่า = ตัวเดียวกัน', () => {
    expect(subChannelOf('Tiktok', null)).toBe('Tiktok');
    expect(subChannelOf(null, 'tiktok')).toBe('Tiktok');
    expect(subChannelOf('TikTok', null)).toBe('Tiktok');
  });

  it('ป้ายใหม่ "หลัก · รอง" → รอง · ป้ายเก่า "Facebook Group · กลุ่ม…" → Facebook Group', () => {
    expect(subChannelOf('Tiktok · Tiktok Live', null)).toBe('Tiktok Live');
    expect(subChannelOf('Facebook · Facebook Group', null)).toBe('Facebook Group');
    expect(subChannelOf('Webjob · Jobthai', null)).toBe('Jobthai');
    expect(subChannelOf('Facebook Group · กลุ่มหางานขับรถ', null)).toBe('Facebook Group');
  });

  it('iRecruit · รอง → รอง · iRecruit เดี่ยวคงไว้ · ฟอร์มเก่า ใบปลิว → ป้าย/ใบปลิว · ไม่มีอะไร = ว่าง', () => {
    expect(subChannelOf('iRecruit · Jobthai', null)).toBe('Jobthai');
    expect(subChannelOf('iRecruit', null)).toBe('iRecruit');
    expect(subChannelOf(null, 'flyer')).toBe('ป้าย/ใบปลิว');
    expect(subChannelOf(null, 'other')).toBe('อื่นๆ');
    expect(subChannelOf('', null)).toBe('');
  });
});

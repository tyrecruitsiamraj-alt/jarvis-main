import { describe, it, expect } from 'vitest';
import {
  CHANNEL_ADMIN_PAGE_SIZE,
  channelPageCount,
  clampChannelPage,
  channelPageOffset,
  channelRangeLabel,
  channelNameError,
  channelNameChanged,
  channelDeleteWarning,
} from '../../src/lib/recruitChannelAdmin';

describe('channelPageCount', () => {
  it('ไม่มีของเลยยังนับเป็น 1 หน้า', () => {
    expect(channelPageCount(0)).toBe(1);
  });
  it('ปัดขึ้นเสมอ', () => {
    expect(channelPageCount(25)).toBe(1);
    expect(channelPageCount(26)).toBe(2);
    expect(channelPageCount(4345)).toBe(174);
  });
  it('กัน pageSize เพี้ยน', () => {
    expect(channelPageCount(10, 0)).toBe(10);
    expect(channelPageCount(-5)).toBe(1);
  });
});

describe('clampChannelPage', () => {
  it('บีบให้อยู่ในช่วงเสมอ', () => {
    expect(clampChannelPage(0, 100)).toBe(1);
    expect(clampChannelPage(99, 100)).toBe(4);
    expect(clampChannelPage(2, 100)).toBe(2);
  });
  it('ลบจนหน้าท้ายว่าง → เด้งกลับหน้าสุดท้ายที่มีของ', () => {
    // เคยอยู่หน้า 3 (51–75) แล้วเหลือ 30 แถว → ต้องเหลือหน้า 2
    expect(clampChannelPage(3, 30)).toBe(2);
  });
  it('ค่าที่ไม่ใช่ตัวเลขถือเป็นหน้า 1', () => {
    expect(clampChannelPage(Number.NaN, 100)).toBe(1);
  });
});

describe('channelPageOffset', () => {
  it('หน้าแรก offset 0 · หน้าถัดไปเลื่อนทีละ pageSize', () => {
    expect(channelPageOffset(1)).toBe(0);
    expect(channelPageOffset(2)).toBe(CHANNEL_ADMIN_PAGE_SIZE);
    expect(channelPageOffset(174)).toBe(4325);
  });
});

describe('channelRangeLabel', () => {
  it('บอกช่วงจริงที่เห็นอยู่', () => {
    expect(channelRangeLabel(2, 4345, 25)).toBe('26–50 จาก 4,345');
  });
  it('หน้าสุดท้ายไม่เต็มหน้า — ปลายช่วงต้องไม่เกิน total', () => {
    expect(channelRangeLabel(174, 4345, 20)).toBe('4,326–4,345 จาก 4,345');
  });
  it('ไม่มีของ', () => {
    expect(channelRangeLabel(1, 0, 0)).toBe('ไม่มีรายการ');
  });
});

describe('channelNameError', () => {
  it('ว่าง/เว้นวรรคล้วน = ไม่ผ่าน', () => {
    expect(channelNameError('')).toBe('ต้องระบุชื่อช่องทาง');
    expect(channelNameError('   ')).toBe('ต้องระบุชื่อช่องทาง');
  });
  it('ยาวเกิน 200 = ไม่ผ่าน', () => {
    expect(channelNameError('ก'.repeat(201))).toContain('ยาวเกิน');
  });
  it('ชื่อปกติผ่าน', () => {
    expect(channelNameError(' Facebook Group ')).toBeNull();
  });
});

describe('channelNameChanged', () => {
  it('ต่างกันจริงถึงนับว่าเปลี่ยน', () => {
    expect(channelNameChanged('Facebook', 'Facebook')).toBe(false);
    expect(channelNameChanged('Facebook', ' Facebook ')).toBe(false);
    expect(channelNameChanged('Facebook', 'Facebook Group')).toBe(true);
  });
});

describe('channelDeleteWarning', () => {
  it('มีลูก → ต้องบอกจำนวนที่จะหายไปด้วย (FK cascade)', () => {
    const msg = channelDeleteWarning({ name: 'Facebook Group', childCount: 4187 });
    expect(msg).toContain('4,187');
    expect(msg).toContain('จะถูกลบไปด้วย');
  });
  it('ไม่มีลูก → ข้อความสั้น', () => {
    expect(channelDeleteWarning({ name: 'Jobthai' })).toContain('ลิงก์ที่สร้างไว้แล้วยังใช้ได้');
  });
});

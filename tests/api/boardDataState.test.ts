import { describe, expect, it } from 'vitest';

import {
  canShowNumbers,
  combineFeedStates,
  dataAgeLabel,
  ledgerStateText,
  LEDGER_STATE_TEXT,
  UNKNOWN_NUMBER,
  type FeedState,
} from '../../src/lib/boardDataState';

/**
 * "กำลังโหลด" ≠ "พัง" ≠ "ไม่มีสิทธิ์" — และไม่มีอันไหนแปลว่า 0
 *
 * 🔴 มาจากของจริง: กล่องงานเปิดไม่ติด 4 ใน 6 ครั้ง แล้วตอนตายขึ้นเลข 0 ทุกก้อน
 * ทั้งที่ของจริงมีใบขอ 304 ใบ (29-31 ส.ค. 2569)
 */
describe('รวมสภาพหลายเส้นเป็นสภาพเดียว', () => {
  it('ทุกเส้นพร้อม = พร้อม (โชว์เลขได้)', () => {
    const s = combineFeedStates('ready', 'ready', 'ready');
    expect(s).toEqual({ status: 'ready', reason: null });
    expect(canShowNumbers(s)).toBe(true);
  });

  it('มีเส้นไหนกำลังโหลด = กำลังโหลด · ยังโชว์เลขไม่ได้', () => {
    const s = combineFeedStates('ready', 'loading', 'ready');
    expect(s.status).toBe('loading');
    expect(canShowNumbers(s)).toBe(false);
  });

  it('🔴 เส้นเดียวพัง = พังทั้งชุด — ห้ามโชว์เลขบางส่วนที่ดูเหมือนจริง', () => {
    const s = combineFeedStates('ready', 'ready', 'failed');
    expect(s).toEqual({ status: 'broken', reason: 'failed' });
    expect(canShowNumbers(s)).toBe(false);
  });

  it('🔴 ไม่มีสิทธิ์ชนะพังธรรมดา — เพราะทางแก้คนละเรื่อง', () => {
    expect(combineFeedStates('failed', 'forbidden').reason).toBe('forbidden');
    expect(combineFeedStates('forbidden', 'failed').reason).toBe('forbidden');
  });

  it('พังชนะกำลังโหลด — โหลดเสร็จอีกเส้นก็ไม่ได้แปลว่าเลขใช้ได้', () => {
    expect(combineFeedStates('loading', 'failed').status).toBe('broken');
  });

  it('ไม่ส่งเส้นไหนมาเลย = พร้อม (ไม่มีอะไรให้รอ)', () => {
    expect(combineFeedStates().status).toBe('ready');
  });

  it('ทุกส่วนผสมที่มีเส้นพัง ต้องโชว์เลขไม่ได้เสมอ', () => {
    const all: FeedState[] = ['loading', 'ready', 'failed', 'forbidden'];
    for (const a of all) {
      for (const b of all) {
        const broken = a === 'failed' || a === 'forbidden' || b === 'failed' || b === 'forbidden';
        if (broken) expect(canShowNumbers(combineFeedStates(a, b))).toBe(false);
      }
    }
  });
});

describe('ข้อความที่ขึ้นจอของแต่ละสภาพ', () => {
  it('ปกติ = ไม่ต้องขึ้นอะไร', () => {
    expect(ledgerStateText({ status: 'ready', reason: null })).toBeNull();
  });

  it('พังธรรมดา = ให้กดลองใหม่ได้', () => {
    const t = ledgerStateText({ status: 'broken', reason: 'failed' });
    expect(t).toBe(LEDGER_STATE_TEXT.failed);
    expect(t?.canRetry).toBe(true);
  });

  it('🔴 ไม่มีสิทธิ์ = ห้ามให้ปุ่มลองใหม่ (กดกี่ครั้งก็ไม่สำเร็จ)', () => {
    const t = ledgerStateText({ status: 'broken', reason: 'forbidden' });
    expect(t).toBe(LEDGER_STATE_TEXT.forbidden);
    expect(t?.canRetry).toBe(false);
  });

  it('กำลังโหลด = ไม่มีปุ่มลองใหม่ (ยังไม่รู้ว่าจะพังไหม)', () => {
    expect(ledgerStateText({ status: 'loading', reason: null })?.canRetry).toBe(false);
  });

  it('พังแต่ไม่รู้เหตุ ถอยไปข้อความ "อ่านตัวเลขไม่ได้"', () => {
    expect(ledgerStateText({ status: 'broken', reason: null })).toBe(LEDGER_STATE_TEXT.failed);
  });

  it('🔴 ทุกข้อความต้องบอกว่า "ยังบอกไม่ได้" ไม่ใช่ "ไม่มีงาน"', () => {
    expect(LEDGER_STATE_TEXT.failed.hint).toMatch(/ไม่ใช่ว่าไม่มีงาน/);
    expect(UNKNOWN_NUMBER).not.toBe('0');
    expect(UNKNOWN_NUMBER).toBe('—');
  });
});

/**
 * ป้ายบอกอายุข้อมูล — ของสดไม่ต้องรบกวนสายตา แต่ของเก่าเพราะต่อไม่ติดต้องบอกเสมอ
 */
describe('ป้ายอายุข้อมูล', () => {
  it('ไม่รู้อายุ = ไม่ต้องขึ้นอะไร', () => {
    expect(dataAgeLabel(null)).toBeNull();
  });

  it('สดกว่าหนึ่งนาที = ไม่ต้องขึ้น (ไม่รบกวนสายตา)', () => {
    expect(dataAgeLabel(5, 'live')).toBeNull();
    expect(dataAgeLabel(59, 'cache')).toBeNull();
  });

  it('เก่าพอควร = บอกเป็นนาที', () => {
    expect(dataAgeLabel(180, 'cache')).toBe('ข้อมูลเมื่อ 3 นาทีที่แล้ว');
  });

  it('เก่ามาก = บอกเป็นชั่วโมง', () => {
    expect(dataAgeLabel(7_200, 'cache')).toBe('ข้อมูลเมื่อ 2 ชั่วโมงที่แล้ว');
  });

  it('🔴 หยิบสำเนาเก่ามาเพราะต่อไม่ติด = ต้องบอกเสมอ ถึงจะเพิ่งดึงมาก็ตาม', () => {
    const label = dataAgeLabel(5, 'stale-after-error');
    expect(label).not.toBeNull();
    expect(label).toMatch(/ต่อระบบงานหลักไม่ติด/);
  });
});

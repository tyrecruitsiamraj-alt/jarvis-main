import { afterEach, describe, expect, it } from 'vitest';
import {
  getIrecruitSqlServerConfig,
  getIrecruitSqlServerPool,
  isIrecruitEnabled,
} from '../../api/_lib/irecruitSqlServer.js';

/**
 * สวิตช์ปิดการเชื่อม iRecruit (เจ้าของสั่ง 9 ก.ย. 2569 — "หยุดเชื่อมก่อน เดี๋ยวบอก")
 *
 * เทสต์นี้คุมสองเรื่อง:
 *   1. ปิดแล้วต้องไม่ต่อฐาน **แม้ env ครบทุกตัว** (ไม่ใช่แค่ค่าหาย)
 *   2. เปิดกลับได้ด้วยการลบตัวแปรตัวเดียว โดยรหัสผ่านยังอยู่ครบ
 */

const KEYS = [
  'IRECRUIT_ENABLED',
  'IRECRUIT_DB_HOST',
  'IRECRUIT_DB_USER',
  'IRECRUIT_DB_PASSWORD',
  'IRECRUIT_DB_NAME',
  'DB_NAME',
  'DB_HOST',
] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function fullCredentials() {
  process.env.IRECRUIT_DB_HOST = '10.0.0.9';
  process.env.IRECRUIT_DB_USER = 'someuser';
  process.env.IRECRUIT_DB_PASSWORD = 'somepass';
  process.env.IRECRUIT_DB_NAME = 'irecruit';
  delete process.env.DB_NAME;
  delete process.env.DB_HOST;
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('สวิตช์ IRECRUIT_ENABLED', () => {
  it('ไม่ตั้งค่า = เปิดตามเดิม (ของเก่าต้องไม่พังเพราะสวิตช์นี้)', () => {
    fullCredentials();
    delete process.env.IRECRUIT_ENABLED;
    expect(isIrecruitEnabled()).toBe(true);
    expect(getIrecruitSqlServerConfig()).not.toBeNull();
  });

  it.each(['false', 'FALSE', '0', 'off', 'no', ' No '])(
    'ค่า %o = ปิด แม้ env ครบทุกตัว',
    (value) => {
      fullCredentials();
      process.env.IRECRUIT_ENABLED = value;
      expect(isIrecruitEnabled()).toBe(false);
      // จุดตายจุดเดียว: คืน null เหมือน "ยังไม่ได้ตั้งค่า" ทุกทางเข้าจึงตอบ 503 เอง
      expect(getIrecruitSqlServerConfig()).toBeNull();
    },
  );

  it('ปิดแล้วขอ pool ต้องโยนข้อความไทยที่บอกวิธีเปิดกลับ ไม่ใช่ไปต่อฐาน', async () => {
    fullCredentials();
    process.env.IRECRUIT_ENABLED = 'false';
    await expect(getIrecruitSqlServerPool()).rejects.toThrow(/ปิดการเชื่อม iRecruit/);
  });

  it('ปิดแล้วรหัสผ่านยังอยู่ครบ — เปิดกลับด้วยการลบตัวแปรตัวเดียว', () => {
    fullCredentials();
    process.env.IRECRUIT_ENABLED = 'false';
    expect(getIrecruitSqlServerConfig()).toBeNull();
    expect(process.env.IRECRUIT_DB_PASSWORD).toBe('somepass');

    delete process.env.IRECRUIT_ENABLED;
    expect(getIrecruitSqlServerConfig()).not.toBeNull();
  });

  it('ค่าอื่นที่ไม่ใช่คำปิด (เช่น true) = เปิด — กัน typo ทำระบบดับเงียบ', () => {
    fullCredentials();
    for (const v of ['true', '1', 'on', 'yes']) {
      process.env.IRECRUIT_ENABLED = v;
      expect(isIrecruitEnabled()).toBe(true);
    }
  });
});

/**
 * LINE Bot So Work: แจ้งส่งใบสมัครสำเร็จ เพิ่ม ชื่อ + ลิงก์เปิดใบใน So Recruit (ทีมบอทขอ 22 พ.ย. 2569)
 * ทีมสรรหาเห็นแค่ชื่อ LINE ต้องไล่หาใบเอง → ส่ง title_prefix · first_name · last_name · application_url ใน body เดิม
 * ช่องที่ไม่มีค่าไม่ส่ง · ไม่ส่งเบอร์/เลขบัตร · ลิงก์ต้อง https และเปิดได้เฉพาะคนที่ล็อกอิน
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { appBaseUrlOfRequest, applicationCreatedBody, applicationUrlOf } from '../../api/_lib/lineBotSoWork';
import { applicantWorkLink } from '../../src/lib/recruitRm';

const LID = `U${'a1'.repeat(16)}`;
const APP = '0b6f2a1e-3c4d-4e5f-8a9b-0c1d2e3f4a5b';
const base = { applicationId: APP, lineUserId: LID, jobId: 'siamraj-sql:OPL6911011', createdAt: new Date('2026-11-22T03:15:00Z') };

describe('body ของ application.created', () => {
  it('มีชื่อ + ลิงก์เปิดใบ ต่อจากช่องเดิม (endpoint และลายเซ็นไม่เปลี่ยน)', () => {
    const body = JSON.parse(
      applicationCreatedBody({ ...base, titlePrefix: 'นาย', firstName: ' สมชาย ', lastName: 'ใจดี', appBaseUrl: 'https://jarvis.example.dev' }),
    );
    expect(body).toEqual({
      event: 'application.created',
      application_id: APP,
      line_user_id: LID,
      request_no: 'OPL6911011',
      title_prefix: 'นาย',
      first_name: 'สมชาย',
      last_name: 'ใจดี',
      application_url: `https://jarvis.example.dev/jobs/board?view=list&list=all&open=${APP}`,
      created_at: '2026-11-22T10:15:00+07:00',
    });
  });

  it('ช่องที่ไม่มีค่าไม่ส่ง (ไม่ส่งค่าว่าง/null แทน)', () => {
    const body = JSON.parse(applicationCreatedBody({ ...base, titlePrefix: null, firstName: 'สมชาย', lastName: '  ', appBaseUrl: null }));
    expect(Object.keys(body).sort()).toEqual(['application_id', 'created_at', 'event', 'first_name', 'line_user_id', 'request_no']);
  });

  it('ไม่มีเบอร์โทร เลขบัตร ที่อยู่ ในสิ่งที่ส่ง', () => {
    const body = applicationCreatedBody({ ...base, titlePrefix: 'นาย', firstName: 'สมชาย', lastName: 'ใจดี', appBaseUrl: 'https://jarvis.example.dev' });
    expect(body).not.toMatch(/phone|citizen|national|address|province/i);
  });
});

describe('ลิงก์เปิดใบสมัคร', () => {
  it('ใช้ทางเดียวกับที่หน้าเว็บเปิดผู้สมัคร (หลังล็อกอิน) และต้องเป็น https', () => {
    expect(applicationUrlOf('https://jarvis.example.dev/', APP)).toBe(`https://jarvis.example.dev${applicantWorkLink(APP)}`);
    expect(applicationUrlOf('http://jarvis.example.dev', APP)).toBeUndefined();
    expect(applicationUrlOf('jarvis.example.dev', APP)).toBeUndefined();
    expect(applicationUrlOf('https://jarvis.example.dev/some/path', APP)).toBeUndefined();
    expect(applicationUrlOf(null, APP)).toBeUndefined();
    // หน้านี้อยู่หลังด่านล็อกอิน
    const appTsx = readFileSync('src/App.tsx', 'utf8');
    expect(appTsx.indexOf('path="/jobs/board"')).toBeGreaterThan(appTsx.indexOf('const ProtectedRoutes'));
  });
});

describe('ต้นทางของหน้าเว็บจากคำขอส่งใบ', () => {
  const saved = process.env.APP_PUBLIC_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.APP_PUBLIC_URL;
    else process.env.APP_PUBLIC_URL = saved;
  });

  it('ตั้ง APP_PUBLIC_URL (https) ไว้ = ใช้ค่านั้น', () => {
    process.env.APP_PUBLIC_URL = 'https://recruit.example.dev/';
    expect(appBaseUrlOfRequest({ origin: 'https://other.example', host: 'other.example' })).toBe('https://recruit.example.dev');
  });

  it('ไม่ตั้ง = ใช้ Origin เมื่อเป็นโฮสต์เดียวกับ API และเป็น https เท่านั้น', () => {
    delete process.env.APP_PUBLIC_URL;
    expect(appBaseUrlOfRequest({ origin: 'https://jarvis.example.dev', host: 'jarvis.example.dev' })).toBe('https://jarvis.example.dev');
    // ฟอร์มฝังเว็บอื่นยิงข้ามโดเมน — ไม่เอา Origin ของเว็บนั้นมาทำลิงก์
    expect(appBaseUrlOfRequest({ origin: 'https://partner.example', host: 'jarvis.example.dev' })).toBeNull();
    expect(appBaseUrlOfRequest({ origin: 'http://localhost:8080', host: 'localhost:8080' })).toBeNull();
    expect(appBaseUrlOfRequest({ host: 'jarvis.example.dev' })).toBeNull();
    expect(appBaseUrlOfRequest(undefined)).toBeNull();
  });

  it('หน้าสมัครส่งชื่อกับต้นทางให้ตัวแจ้งบอท', () => {
    const api = readFileSync('api/_handlers/public/apply.ts', 'utf8');
    expect(api).toContain('titlePrefix: v.titlePrefix,');
    expect(api).toContain('firstName: v.firstName,');
    expect(api).toContain('lastName: v.lastName,');
    expect(api).toContain('appBaseUrl: appBaseUrlOfRequest(req.headers),');
  });
});

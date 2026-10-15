import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  IRECRUIT_IMPORT_CREATED_BY,
  irecruitInstant,
  irecruitUncalledSql,
  isIrecruitImportEnabled,
  thaiMobile,
  toImportValue,
} from '../../api/_lib/irecruitApplicantImport';

/** ดึงชื่อจาก iRecruit เข้าแท็บผู้สมัคร (เจ้าของสั่ง 15 ต.ค. 2569) */
describe('ดึงชื่อจาก iRecruit', () => {
  const env = process.env.IRECRUIT_APPLICANT_IMPORT_ENABLED;
  afterEach(() => {
    if (env === undefined) delete process.env.IRECRUIT_APPLICANT_IMPORT_ENABLED;
    else process.env.IRECRUIT_APPLICANT_IMPORT_ENABLED = env;
  });

  it('หยิบเฉพาะ RM · 30 วัน · ยังไม่ถูกโทร (ไม่มีบันทึกกดโทร และไม่มีผลติดต่อ — คีย์ uuid)', () => {
    const sql = irecruitUncalledSql();
    for (const g of [
      "rr.owner = 'RM'",
      "rr.status = 'A'",
      'rr.deleted_at IS NULL',
      'DATEADD(day, -30, GETDATE())',
      'recruit_logs_call lc WHERE lc.register_id = rr.uuid',
      'recruit_contact c WHERE c.register_id = rr.uuid',
    ]) {
      expect(sql).toContain(g);
    }
  });

  it('แปลงแถว: เบอร์ 10 หลัก · เพศ M/F · อายุนอก 15–80 = ไม่รู้ · ช่องทางขึ้นต้น iRecruit', () => {
    const v = toImportValue({
      uuid: 'u1', first_name: ' ทดสอบ ', last_name: 'ระบบ', phone_number: '081-234-5678', age: 90, sex: 'M',
      province_name: 'กรุงเทพมหานคร', district_name: null, job_name: 'พนักงานขับรถ', channel_name: 'Facebook',
      line_id: '-', created_at: '2026-10-10T03:00:00Z',
    });
    expect(v).toMatchObject({
      full_name: 'ทดสอบ ระบบ', phone: '0812345678', age: null, gender: 'male', province: 'กรุงเทพมหานคร',
      position_interest: 'พนักงานขับรถ', line_id: null, channel_label: 'iRecruit · Facebook',
      // 🔴 นาฬิกาไทย 03:00 ที่ driver อ่านเป็น UTC = 20:00 UTC ของวันก่อน (15 ต.ค. 2569 เดิมเกินไป 7 ชม.)
      created_at: '2026-10-09T20:00:00.000Z',
    });
    expect(toImportValue({ uuid: 'u2', first_name: null, last_name: null, phone_number: '0812345678' } as never)).toBeNull();
    expect(irecruitInstant(new Date('2026-10-15T16:31:46Z'))?.toISOString()).toBe('2026-10-15T09:31:46.000Z');
    expect(irecruitInstant('2026-10-15 16:31:46')?.toISOString()).toBe('2026-10-15T09:31:46.000Z');
    expect(irecruitInstant(null)).toBeNull();
    expect(thaiMobile('66812345678')).toBe('0812345678');
    expect(thaiMobile('021234567')).toBeNull();
  });

  it('🔴 เฉพาะเซิร์ฟเวอร์จริง · ปิดด้วย env ได้', () => {
    expect(isIrecruitImportEnabled(false)).toBe(false);
    process.env.IRECRUIT_APPLICANT_IMPORT_ENABLED = 'false';
    expect(isIrecruitImportEnabled(true)).toBe(false);
  });

  it('🔴 ใบที่ดึงมา = ใบนำเข้า (AI ไม่โทรเอง · คนกดส่ง) · ไม่ดึงเบอร์ที่มีใน jarvis · กันดึงซ้ำด้วย uuid · server เปิดตอนบูต', () => {
    expect(IRECRUIT_IMPORT_CREATED_BY).toBe('iRecruit');
    const src = readFileSync('api/_lib/irecruitApplicantImport.ts', 'utf8');
    expect(src).toContain('where phone_e164 = any($1::text[])');
    expect(src).toContain('on conflict (register_uuid) do nothing');
    expect(readFileSync('server/local-api.ts', 'utf8')).toContain('startIrecruitImportWorker();');
    // ตัวส่ง AI อัตโนมัติหยิบเฉพาะใบที่ไม่มีคนคีย์
    expect(readFileSync('api/_lib/applicationDispatchRetry.ts', 'utf8')).toContain('a.created_by_name is null');
  });
});

/**
 * ผู้รับผิดชอบของใบที่ดึงจาก iRecruit (เจ้าของ 16 ต.ค. 2569 "ผู้รับผิดชอบยังไม่ขึ้นเลย" ·
 * "ผู้รับผิดชอบ ก็ทีม online อะ ว่าน เจมส์" · Choice "ดึงชื่อมาด้วย + เติม 382 ใบเก่า")
 * iRecruit `recruit_register.responsible_id` = `admins.staff_id` · ชื่อที่โชว์ = ชื่อเล่นหน้าผู้ใช้งาน jarvis (จับด้วยอีเมล) → ชื่อใน iRecruit
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { irecruitResponsibleName, irecruitUncalledSql, toImportValue } from '../../api/_lib/irecruitApplicantImport';

const display = (email: string) => (email === 'online.a@example.com' ? 'ออนไลน์ ก' : null);

describe('ชื่อผู้รับผิดชอบ', () => {
  it('อีเมลตรงผู้ใช้ jarvis = ชื่อเล่น · ไม่มีบัญชี = ชื่อใน iRecruit · ไม่มีทั้งคู่ = null', () => {
    expect(irecruitResponsibleName({ responsible_email: ' Online.A@example.com ', responsible_name: 'ชื่อเต็ม ก' }, display)).toBe('ออนไลน์ ก');
    expect(irecruitResponsibleName({ responsible_email: 'other@example.com', responsible_name: 'ชื่อเต็ม ข' }, display)).toBe('ชื่อเต็ม ข');
    expect(irecruitResponsibleName({ responsible_email: null, responsible_name: null }, display)).toBeNull();
  });

  it('ใบใหม่ที่ดึงมา ได้ผู้รับผิดชอบติดมาด้วย', () => {
    const v = toImportValue(
      {
        uuid: 'AbC123xyz456QwE',
        first_name: 'ทดสอบ',
        last_name: 'ระบบ',
        phone_number: '0812345678',
        age: 30,
        sex: 'M',
        province_name: null,
        district_name: null,
        job_name: null,
        channel_name: null,
        line_id: null,
        created_at: null,
        responsible_email: 'online.a@example.com',
        responsible_name: 'ชื่อเต็ม ก',
      } as never,
      display,
    );
    expect(v?.responsible_name).toBe('ออนไลน์ ก');
  });

  it('SQL ดึงผู้รับผิดชอบจาก admins ด้วย staff_id', () => {
    const sql = irecruitUncalledSql();
    expect(sql).toContain('LEFT JOIN admins adm ON adm.staff_id = rr.responsible_id');
    expect(sql).toContain('adm.email AS responsible_email, adm.name AS responsible_name');
  });
});

describe('เติมใบเก่า', () => {
  const src = readFileSync('api/_lib/irecruitApplicantImport.ts', 'utf8');
  it('🔴 เขียนเฉพาะช่องผู้รับผิดชอบที่ยังว่าง ตาม id · ทุกรอบดึง · error ไม่ทำให้รอบล้ม', () => {
    expect(src).toContain("`update ${APPS} set responsible_name = $2 where id = $1::uuid and nullif(btrim(responsible_name), '') is null`");
    expect(src).toMatch(/try \{\s*out\.responsibleFilled = await backfillIrecruitResponsible\(\);\s*\} catch/);
    expect(src).toContain('responsible_name)\n         values');
  });
  it('รหัสใบ iRecruit ตรวจก่อนต่อเข้า SQL (ตัวอักษร/ตัวเลขเท่านั้น)', () => {
    expect(src).toContain('const UUID_TEXT_RE = /^[0-9A-Za-z-]{6,64}$/;');
    expect(/^[0-9A-Za-z-]{6,64}$/.test("x'; drop")).toBe(false);
  });
});

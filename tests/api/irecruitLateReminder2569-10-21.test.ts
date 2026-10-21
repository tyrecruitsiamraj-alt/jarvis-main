/**
 * รายชื่อ iRecruit ที่ค้าง (เจ้าของ 21 ต.ค. 2569 "ข้อ 2 ทำ") — ทีมทำใน iRecruit ⇒ ใช้สถานะ iRecruit (W) ไม่ใช่การกดโทรใน Jarvis
 * วัดจริง 21 ต.ค.: ดึงมา 300 คน ไม่มีใครกดโทรจาก Jarvis แต่ iRecruit ทำไปแล้ว 210 · ค้างจริง 90
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { irecruitLateHours, irecruitPullState, lateText, IRECRUIT_LATE_HOURS } from '@/lib/irecruitPullStatus';
import { irecruitLateSql, matchUsersByName, IRECRUIT_LATE_LINK } from '../../api/_lib/irecruitLateReminder';

const read = (p: string) => readFileSync(p, 'utf8');

describe('สถานะ iRecruit ของรายชื่อที่ดึงมา', () => {
  it('W รอ · A สำเร็จ · อื่น ไม่สำเร็จ · ไม่มีค่า = ไม่รู้', () => {
    expect(irecruitPullState('W')).toBe('waiting');
    expect(irecruitPullState('A')).toBe('done');
    expect(irecruitPullState('C')).toBe('failed');
    expect(irecruitPullState(null)).toBeNull();
  });
  it('ค้าง = ยังรอ และเกิน 24 ชม. · ทำแล้วไม่นับว่าค้าง', () => {
    const now = Date.parse('2026-10-21T10:00:00Z');
    expect(IRECRUIT_LATE_HOURS).toBe(24);
    expect(irecruitLateHours('W', '2026-10-20T09:00:00Z', now)).toBe(25);
    expect(irecruitLateHours('W', '2026-10-20T12:00:00Z', now)).toBeNull();
    expect(irecruitLateHours('C', '2026-10-10T09:00:00Z', now)).toBeNull();
    expect(lateText(25)).toBe('ค้าง 25 ชม.');
    expect(lateText(72)).toBe('ค้าง 3 วัน');
  });
  it('ตัวดึงอ่านสถานะกลับทุกรอบ (อ่านอย่างเดียวฝั่ง iRecruit) · แถวโชว์สถานะ + ค้างกี่ชั่วโมง', () => {
    const imp = read('api/_lib/irecruitApplicantImport.ts');
    expect(imp).toContain('out.statusSynced = await syncIrecruitImportStatus();');
    expect(imp).toContain('RTRIM(rr.process_status) AS process_status');
    expect(imp).not.toMatch(/UPDATE\s+recruit_register/i);
    expect(read('migrations/158_irecruit_import_status.sql')).toContain('add column if not exists irecruit_status text null');
    expect(read('src/components/recruit-rm/RmTable.tsx')).toContain('data-testid="irecruit-pull-status"');
  });
});

describe('แจ้งเตือนเช้าละครั้งถึงผู้รับผิดชอบ', () => {
  it('นับเฉพาะ iRecruit ที่ยัง W เกิน 24 ชม. ไม่นับที่ยกเลิกข้อมูล · ลิงก์ไปกล่อง iRecruit', () => {
    const sql = irecruitLateSql();
    expect(sql).toContain("a.created_by_name = 'iRecruit'");
    expect(sql).toContain("i.irecruit_status = 'W'");
    expect(sql).toContain('application_cancellations');
    expect(IRECRUIT_LATE_LINK).toBe('/jobs/board?view=list&list=irecruit_pull');
  });
  it('ชื่อผู้รับผิดชอบ → ผู้ใช้ด้วยชื่อเล่น/ชื่อเต็ม/อีเมล · ชื่อซ้ำหลายคนไม่เดา', () => {
    const users = [
      { id: 'u1', nickname: 'เจมส์', full_name: 'James A', email: 'james@x' },
      { id: 'u2', nickname: 'ว่าน', full_name: null, email: null },
      { id: 'u3', nickname: 'ฟ้า', full_name: null, email: null },
      { id: 'u4', nickname: 'ฟ้า', full_name: null, email: null },
    ];
    const m = matchUsersByName(['เจมส์', 'ว่าน', 'ฟ้า', 'ไม่มีคนนี้'], users);
    expect(m.get('เจมส์')).toBe('u1');
    expect(m.get('ว่าน')).toBe('u2');
    expect(m.has('ฟ้า')).toBe(false);
    expect(m.has('ไม่มีคนนี้')).toBe(false);
    expect(read('server/local-api.ts')).toContain('startIrecruitLateReminderWorker();');
  });
});

// @vitest-environment node
/**
 * 🔴 แก้ตามรายงาน QA รอบ 2 (5 ต.ค. 2569 · เจ้าของ "อนุมัติให้แก้ ทั้งหมด")
 * pin โครงไว้กันย้อนกลับ — ตรรกะหลักมีเทสต์ของตัวเองที่ followGrouping / trends / followAftercareMove
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { friendlyErrorText, NETWORK_ERROR_TEXT } from '../../src/lib/friendlyError';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

describe('friendlyErrorText — error บนจอเป็นภาษาคน', () => {
  it('เน็ตหลุด = ต่อเซิร์ฟเวอร์ไม่ได้', () => {
    expect(friendlyErrorText(new TypeError('Failed to fetch'), 'x')).toBe(NETWORK_ERROR_TEXT);
    expect(friendlyErrorText(new TypeError('Load failed'), 'x')).toBe(NETWORK_ERROR_TEXT);
  });
  it('อังกฤษดิบ / ว่าง = ข้อความของจุดนั้น', () => {
    expect(friendlyErrorText(new Error('Internal server error'), 'โหลดไม่ได้')).toBe('โหลดไม่ได้');
    expect(friendlyErrorText(new Error(''), 'โหลดไม่ได้')).toBe('โหลดไม่ได้');
    expect(friendlyErrorText(null, 'โหลดไม่ได้')).toBe('โหลดไม่ได้');
  });
  it('ข้อความไทยจากเซิร์ฟเวอร์ส่งต่อตามเดิม (บอกเหตุจริง)', () => {
    expect(friendlyErrorText(new Error('เวลาที่ผ่านมาแล้วตั้งไม่ได้'), 'x')).toBe('เวลาที่ผ่านมาแล้วตั้งไม่ได้');
  });
});

describe('หน้าติดตาม — โหลด / ล้ม / ว่าง แยกกัน', () => {
  const page = read('src/pages/follow/FollowPage.tsx');
  it('ยังไม่เคยโหลดสำเร็จ = โครงหน้า ไม่ใช่ 0 / ตามครบแล้ว', () => {
    expect(page).toContain('{lastLoadedAt === null ? (');
    expect(page).toContain('data-testid="follow-first-load"');
  });
  it('โหลดสำเร็จ (รวมรอบเงียบ) ล้างแถบล้ม · แถบล้มอยู่บนสุดมีปุ่มลองใหม่', () => {
    const reload = page.slice(page.indexOf('const reload = useCallback'), page.indexOf('const reload = useCallback') + 900);
    expect(reload).toMatch(/setLastLoadedAt\(new Date\(\)\);[\s\S]*setError\(null\);/);
    expect(page).toMatch(/role="alert"[\s\S]{0,400}\{error\}/);
  });
  it('ปุ่มในป๊อปพลาด = toast (เห็นทั้งที่ป๊อปเปิดอยู่) ไม่ใช่แถบระดับหน้า', () => {
    for (const msg of ['ยกเลิกไม่สำเร็จ', 'ลบไม่สำเร็จ', 'ปิดงานไม่สำเร็จ', 'ย้อนสถานะไม่สำเร็จ', 'ลงผลโทรไม่สำเร็จ', 'ล้างผลโทรไม่สำเร็จ']) {
      expect(page).toContain(`toast.error(friendlyErrorText(err, '${msg}'))`);
    }
    expect(page.match(/setError\(/g)?.length).toBe(2);
  });
});

describe('กันจอขาว', () => {
  it('แถบ iRecruit ตรวจรูปคำตอบ + อ่าน rule แบบปลอดภัย', () => {
    const bar = read('src/components/follow/IrecruitReplaceSyncBar.tsx');
    expect(bar).toContain("if (!next?.rule || !next.summary) throw new Error('ดึงไม่สำเร็จ');");
    expect(bar).toContain('status.rule?.aiFrom');
    expect(bar).not.toContain('(ก่อนหน้านั้นคนโทร)');
  });
  it('เก็บไปโทรเอง: skipped ไม่มี = []', () => {
    expect(read('src/lib/publicApplicationsApi.ts')).toContain('skipped: Array.isArray(out?.skipped) ? out.skipped : []');
  });
  it('ลิงก์ไม่มีรหัสไม่ถูกโชว์', () => {
    expect(read('src/components/jobs/GenApplyLinkDialog.tsx')).toContain('.filter((l) => Boolean(l?.code))');
    expect(read('src/components/jobs/AddChannelLinks.tsx')).toContain("if (!link?.code) throw new Error('สร้างลิงก์ไม่สำเร็จ');");
  });
});

describe('คำบนจอ — ตัดประโยคอธิบาย / ไม่มีรหัสอังกฤษดิบ', () => {
  it('รหัสผลโทรในสรุปของ Lumos กลายเป็นคำไทยของงานติดตาม', async () => {
    const { thaiOutcomeWords } = await import('../../src/lib/followPlanning');
    expect(thaiOutcomeWords('ผลลัพธ์ที่บันทึกไว้คือ confirmed')).not.toMatch(/confirmed/);
    expect(thaiOutcomeWords('สถานะ preparing')).toBe('สถานะ กำลังเตรียมสาย');
    expect(thaiOutcomeWords('ข้อความปกติ')).toBe('ข้อความปกติ');
  });
  it('ไม่มีข้อความช่วงห้ามโทร 20:00–08:00 บนจอแล้ว (ยกเลิก 28 ก.ย.)', () => {
    for (const f of [
      'src/components/recruit-rm/CallChoiceConfirmDialog.tsx',
      'src/pages/jobs/UnitRequestTabPage.tsx',
      'src/components/jobs/JobRecallSuggestions.tsx',
      'src/components/dashboard/LumosCallRatePanel.tsx',
    ]) {
      expect(read(f), f).not.toMatch(/20:00–08:00/);
    }
  });
  it('ประโยคยาวที่ QA เจอหายจากจอ', () => {
    const gone: Array<[string, string]> = [
      ['src/pages/follow/FollowPage.tsx', 'ทำทีละขั้น — ใครก่อน'],
      ['src/pages/follow/FollowPage.tsx', '① คนที่จะติดตาม'],
      ['src/components/follow/StaffContactField.tsx', 'เลือกชื่อแล้วเบอร์ขึ้นเอง'],
      ['src/components/follow/FollowPlanningCalendar.tsx', 'ไม่ถูกนำมาหาร'],
      ['src/components/follow/FollowPlanningCalendar.tsx', 'ไม่ใช่เฉพาะวันที่เลือก'],
      ['src/components/follow/FollowEditDialog.tsx', 'ใครกรอกคนนั้นเป็นเจ้าของ'],
      ['src/components/follow/RoundScriptNote.tsx', 'แก้บทได้ที่หน้าตั้งค่า'],
      ['src/components/follow/FollowCallRoundsPanel.tsx', '(Call Pipeline)'],
      ['src/components/jobs/JobBoardView.tsx', 'ตัวเลขข้างบนทั้งหมดไม่นับส่วนนี้'],
      ['src/lib/recruitRm.ts', 'ล็อกต้องเช็คสิทธิ์ BU'],
    ];
    for (const [f, text] of gone) expect(read(f), `${f}: ${text}`).not.toContain(text);
  });
});

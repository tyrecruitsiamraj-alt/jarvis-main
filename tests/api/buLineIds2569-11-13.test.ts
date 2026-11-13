/**
 * แอดไลน์ประจำ BU ในข้อความประกาศ (เจ้าของ 13 พ.ย. 2569 "ในแคปชั่นต้องใส่ id line ด้วย" · Choice ID กลางแยก BU · "แอดไลน์ : xxx")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import { buildAutopostCaption } from '@/lib/autopostCaption';
import { isLineBu, lineIdCaptionLine, normalizeLineId } from '@/lib/buLineIds';
import { groupOfSettingsTab } from '@/lib/settingsNav';

const JOB = {
  id: 'siamraj-sql:LBD6911001',
  request_no: 'LBD6911001',
  unit_name: 'บริษัท ตัวอย่าง',
  staff_title_name: 'พนักงานขับรถ',
  location_address: 'เขตคลองเตย กรุงเทพมหานคร',
  request_positions: 1,
  monthly_income_base: 15000,
  work_schedule: 'จันทร์–ศุกร์ 08.00–17.00 น.',
} as unknown as JobRequest;
const CONTACT = { name: 'แบงค์', phone: '090-197-8522' };

describe('แอดไลน์ในข้อความประกาศ', () => {
  it('ตั้งไว้ = บรรทัด "แอดไลน์ : xxx" ต่อจากโทรติดต่อ ก่อนลิงก์สมัคร', () => {
    const lines = buildAutopostCaption(JOB, { contact: CONTACT, link: 'https://x/apply/p/abc', lineId: '@abc1234' }).split('\n');
    const i = lines.indexOf('แอดไลน์ : @abc1234');
    expect(i).toBeGreaterThan(lines.findIndex((l) => l.startsWith('โทรติดต่อ')));
    expect(lines[i + 1]).toMatch(/^หรือสมัครงานได้ที่/);
  });
  it('ไม่ได้ตั้ง = ไม่มีบรรทัด', () => {
    expect(buildAutopostCaption(JOB, { contact: CONTACT, link: null, lineId: null })).not.toContain('แอดไลน์');
  });
  it('ตัวกรองค่า: ว่าง = ลบ · @ หน้าสุดได้ · ไทย/ช่องว่าง = ผิด', () => {
    expect(normalizeLineId('  ')).toBeNull();
    expect(normalizeLineId(' @abc_1.2-3 ')).toBe('@abc_1.2-3');
    expect(normalizeLineId('ไลน์ไอดี')).toBe('invalid');
    expect(normalizeLineId('a b')).toBe('invalid');
    expect(lineIdCaptionLine('x1')).toBe('แอดไลน์ : x1');
    expect(isLineBu('LBD')).toBe(true);
    expect(isLineBu('XX')).toBe(false);
  });
  it('หน้าตั้งค่ามีแท็บ อยู่กลุ่มข้อมูลอ้างอิง · Autopost/โพสต์เอง ส่ง lineId ของ BU ใบ', () => {
    expect(groupOfSettingsTab('lineIds')).toBe('data');
    for (const f of ['src/components/jobs/AutopostDialog.tsx', 'src/components/jobs/ManualPostPanel.tsx']) {
      expect(readFileSync(f, 'utf8')).toContain('useBuLineId(jobBuOf(job))');
    }
  });
  it('migration เพิ่มอย่างเดียว', () => {
    expect(readFileSync('migrations/178_bu_line_ids.sql', 'utf8')).not.toMatch(/\b(drop|alter|update|delete)\b/i);
  });
});

import { describe, it, expect } from 'vitest';
import {
  jobSectorLabel,
  unitNamesForSendReplacement,
  unitRequestSearchBlob,
  requestActionLabel,
  requestActionOrTypeLabel,
} from '../../src/lib/unitRequestDisplay';
import { JOB_TYPE_LABELS } from '@/types';
import type { JobRequest } from '@/types';

function job(partial: Partial<JobRequest> & { unit_name: string }): JobRequest {
  return {
    id: '1',
    job_type: 'new_hire',
    job_category: 'driver',
    status: 'open',
    created_at: '2026-01-01',
    ...partial,
  };
}

describe('unitNamesForSendReplacement', () => {
  it('returns unique unit names only when send_replacement is true', () => {
    const names = unitNamesForSendReplacement([
      job({ unit_name: 'Alpha', send_replacement: true }),
      job({ unit_name: 'Beta', send_replacement: false }),
      job({ unit_name: 'Alpha', send_replacement: true }),
      job({ unit_name: 'Gamma', send_replacement: null }),
    ]);
    expect(names).toEqual(['Alpha']);
  });

  it('sorts Thai locale order', () => {
    const names = unitNamesForSendReplacement([
      job({ unit_name: 'ข', send_replacement: true }),
      job({ unit_name: 'ก', send_replacement: true }),
    ]);
    expect(names).toEqual(['ก', 'ข']);
  });
});

/**
 * 🔴 ด่านของบั๊ก "พิมพ์ เอกชน แล้วเจอทุกใบ" (แก้ 25 ส.ค. 2569)
 * feed จาก ERP ฮาร์ดโค้ด `job_category: 'private'` ทุกใบ ⇒ ห้ามเอาค่านั้นมาแสดง/ค้นหา
 */
describe('jobSectorLabel — ราชการ/เอกชนของจริง', () => {
  it('ใบขอจาก ERP ที่ทีมระบุว่าราชการ ต้องขึ้น "ราชการ" ไม่ใช่ "เอกชน" ตาม job_category', () => {
    const j = job({ unit_name: 'ก', job_category: 'private', unit_sector: 'government' });
    expect(jobSectorLabel(j)).toBe('ราชการ');
  });

  it('🔴 ใบขอจาก ERP ที่ยังไม่มีใครระบุ ต้องขึ้น "ยังไม่ระบุ" ห้ามเดาเป็นเอกชน', () => {
    const j = job({ unit_name: 'ก', job_category: 'private', unit_sector: null });
    expect(jobSectorLabel(j)).toBe('ยังไม่ระบุ');
    expect(unitRequestSearchBlob(j)).not.toContain('เอกชน');
  });

  it('งานในตาราง jobs ของเราเอง (ไม่มี unit_sector) ยังใช้ job_category เหมือนเดิม', () => {
    const j = job({ unit_name: 'ก', job_category: 'government' });
    expect(j.unit_sector).toBeUndefined();
    expect(jobSectorLabel(j)).toBe('ราชการ');
  });

  it('ค้นหาด้วยคำว่า "ราชการ" เจอเฉพาะใบที่ระบุว่าราชการ', () => {
    const gov = unitRequestSearchBlob(job({ unit_name: 'ก', unit_sector: 'government' }));
    const priv = unitRequestSearchBlob(job({ unit_name: 'ข', unit_sector: 'private' }));
    expect(gov).toContain('ราชการ');
    expect(priv).not.toContain('ราชการ');
    expect(priv).toContain('เอกชน');
  });
});

/**
 * 🔴 helper กลางที่เดียวของคำนำหน้า "สาเหตุที่ขอ: " (เจ้าของเคาะ 5 ก.ย. 2569)
 * ทุกจอ (การ์ดใบขอ/บอร์ดสาธารณะ/Dashboard ชิป/JobListPage คอลัมน์-การ์ด) ต้องเรียกฟังก์ชันนี้
 * ห้ามพิมพ์คำนำหน้าซ้ำเอง — เทสต์นี้กันไม่ให้หลุดกลับไปพิมพ์ค่า ERP ดิบ ๆ
 */
describe('requestActionLabel / requestActionOrTypeLabel — คำนำหน้า "สาเหตุที่ขอ: "', () => {
  it('มีค่า ERP จริง → เติมคำนำหน้า "สาเหตุที่ขอ: "', () => {
    const j = job({ unit_name: 'ก', request_action_name: 'ลาออก' });
    expect(requestActionLabel(j)).toBe('สาเหตุที่ขอ: ลาออก');
    expect(requestActionOrTypeLabel(j)).toBe('สาเหตุที่ขอ: ลาออก');
  });

  it('ไม่มีค่า ERP จริง → requestActionLabel คืน null (ไม่ใช่ประเภทงานปลอม ๆ)', () => {
    const j = job({ unit_name: 'ก', job_type: 'new_hire' });
    expect(requestActionLabel(j)).toBeNull();
  });

  it('ไม่มีค่า ERP จริง → requestActionOrTypeLabel ถอยไปใช้ JOB_TYPE_LABELS โดยไม่ติดคำนำหน้า', () => {
    const j = job({ unit_name: 'ก', job_type: 'new_hire' });
    expect(requestActionOrTypeLabel(j)).toBe(JOB_TYPE_LABELS.new_hire);
  });
});

describe('publicJobCardSubtitle — หน้าประกาศไม่โชว์สาเหตุที่ขอ/ชื่อคนเก่า (เจ้าของสั่ง 5 ต.ค. 2569)', () => {
  it('เหลือแค่รายละเอียดตำแหน่ง · ไม่มี "สาเหตุที่ขอ" · ไม่มีชื่อพนักงานคนเก่า · "ไม่ระบุ" = ว่าง', async () => {
    const { publicJobCardSubtitle, jobBoardCardSubtitle } = await import('../../src/lib/unitRequestDisplay');
    const job = {
      request_action_name: 'ลาออก',
      job_description_code_2: 'รถผู้บริหาร',
      resigned_employee_name: 'คนเก่า สมมุติ',
      job_type: 'driver',
    } as never;
    expect(publicJobCardSubtitle(job)).toBe('รถผู้บริหาร');
    expect(publicJobCardSubtitle(job)).not.toContain('ลาออก');
    expect(publicJobCardSubtitle(job)).not.toContain('คนเก่า');
    expect(publicJobCardSubtitle({ job_description_code_2: 'ไม่ระบุ' } as never)).toBe('');
    // ฝั่งเจ้าหน้าที่ยังเห็นครบเหมือนเดิม
    expect(jobBoardCardSubtitle(job)).toContain('สาเหตุที่ขอ: ลาออก');
  });
  it('การ์ดสาธารณะ + ตัวอย่างหน้า 4 ใช้ตัวนี้', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const view = readFileSync(join(process.cwd(), 'src/components/jobs/JobBoardView.tsx'), 'utf8');
    expect(view).toContain('(isStaff ? jobBoardCardSubtitle(job) : publicJobCardSubtitle(job))');
    const preview = readFileSync(join(process.cwd(), 'src/components/jobs/PublicJobCardPreview.tsx'), 'utf8');
    expect(preview).toContain('const subtitle = publicJobCardSubtitle(job);');
  });
});

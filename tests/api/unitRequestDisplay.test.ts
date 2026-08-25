import { describe, it, expect } from 'vitest';
import { jobSectorLabel, unitNamesForSendReplacement, unitRequestSearchBlob } from '../../src/lib/unitRequestDisplay';
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

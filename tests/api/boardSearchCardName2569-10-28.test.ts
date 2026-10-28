import { describe, expect, it } from 'vitest';
import { jobBoardSearchBlob } from '@/lib/jobBoardSearch';
import type { JobRequest } from '@/types';

/** เจ้าของ 28 ต.ค. 2569 "ปุ่มค้นหาก็ค้นชื่อไม่เจอ" — ค้นด้วยชื่อที่ขึ้นบนการ์ด (จุดทำงาน) · รหัสไซต์ · เจ้าหน้าที่ */
const job = {
  id: 'siamraj-sql:SQ6909016',
  request_no: 'SQ6909016',
  unit_name: 'บริษัท สยามราชธานี จำกัด (มหาชน)',
  work_site_name: 'SO',
  site_code: '99LBDL0003',
  recruiter_name: 'เล็ก',
  status: 'open',
} as unknown as JobRequest;

describe('ช่องค้นหากล่องงาน', () => {
  it('เจอด้วยชื่อบนการ์ด · รหัสไซต์ · ชื่อเจ้าหน้าที่ · ของเดิมยังค้นได้', () => {
    const blob = jobBoardSearchBlob(job);
    for (const q of ['so', '99lbdl0003', 'เล็ก', 'sq6909016', 'สยามราชธานี']) expect(blob, q).toContain(q);
  });
});

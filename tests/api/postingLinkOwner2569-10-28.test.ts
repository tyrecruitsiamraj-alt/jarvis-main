import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { postingLinkOwner } from '@/lib/recruitPostings';

/** เจ้าของ 28 ต.ค. 2569 "บอกเพิ่มหน่อยว่าลิงก์นี้ใครรับผิดชอบ · มันจะมีคนอื่นสร้างด้วย" */
describe('ผู้รับผิดชอบของลิงก์', () => {
  it('คนกดสร้างลิงก์ก่อน → ลิงก์เก่าใช้ผู้รับผิดชอบของประกาศ → คนสร้างประกาศ (ตัดโดเมน)', () => {
    expect(postingLinkOwner({ createdByName: 'มิ้นท์' }, { responsibleName: 'ว่าน', createdByName: 'a@siamraj.com' })).toBe('มิ้นท์');
    expect(postingLinkOwner({ createdByName: null }, { responsibleName: 'ว่าน', createdByName: 'a@siamraj.com' })).toBe('ว่าน');
    expect(postingLinkOwner({ createdByName: null }, { responsibleName: null, createdByName: 'pakkorn.k@siamraj.com' })).toBe('pakkorn.k');
    expect(postingLinkOwner({ createdByName: 'x@siamraj.com' }, null)).toBe('x');
    expect(postingLinkOwner({}, null)).toBe(null);
  });
  it('ลิงก์ใหม่จำคนกด (ทั้งสร้างประกาศและ Gen link เพิ่ม) · ช่องเลือกลิงก์ของ Autopost บอกชื่อ · ยังไม่รัน 170 ก็สร้างได้', () => {
    const store = readFileSync('api/_lib/recruitPostings.ts', 'utf8');
    expect(store).toContain('INSERT INTO ${linksTable} (posting_id, channel_id, channel_label, code, note, created_by_user_id, created_by_name)');
    expect(store).toContain('if (withCreator && isUndefinedColumn(e)) {');
    expect(readFileSync('api/_handlers/recruit-postings.ts', 'utf8')).toContain('createdByUserId: req.user?.sub ?? null,\n          createdByName: req.user?.email ?? null,\n        });\n        return res.status(201).json(link);');
    expect(readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8')).toContain('const owner = postingLinkOwner(l, openPosting);');
    expect(readFileSync('migrations/170_posting_link_creator.sql', 'utf8')).toContain('add column if not exists created_by_user_id uuid null');
  });
});

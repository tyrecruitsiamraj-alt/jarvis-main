/**
 * การ์ดกล่องงานบอกว่าประกาศล่าสุดวันไหน ใครประกาศ (เจ้าของ 1 พ.ย. 2569)
 * ข้อมูลมาจากทะเบียนประกาศ (`job_public_releases.released_at / released_by_name`) — กดประกาศซ้ำ = วันที่ใหม่
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { formatYmdTh, toYmdBangkok } from '@/lib/dateTh';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../', p), 'utf8');

describe('ประกาศล่าสุดบนการ์ดกล่องงาน', () => {
  it('การ์ดขึ้น "ล่าสุด วันที่ โดย ชื่อ" ข้างชิปประกาศแล้ว', () => {
    const card = read('src/components/jobs/BoardJobCard.tsx');
    expect(card).toContain('data-testid="board-card-released-at"');
    expect(card).toMatch(/readiness\.kind === 'released' && release/);
    expect(card).toContain('ล่าสุด {formatYmdTh(toYmdBangkok(new Date(release.released_at)))}');
    expect(card).toContain('` โดย ${release.released_by_name}`');
  });

  it('กล่องงานส่งแถวทะเบียนประกาศของใบให้การ์ด (จับคู่ด้วย buildJobKeyIndex)', () => {
    const view = read('src/components/jobs/JobBoardView.tsx');
    expect(view).toContain('release={releaseByJob.get(job.id) ?? null}');
    expect(view).toMatch(/releaseByJob = useMemo\(\s*\(\) => buildJobKeyIndex/);
  });

  it('วันที่เป็นเวลากรุงเทพ — ประกาศ 23:30 น. ไทย ยังเป็นวันเดียวกัน', () => {
    expect(formatYmdTh(toYmdBangkok(new Date('2026-10-28T16:30:00Z')))).toBe('28 ต.ค. 2569');
    expect(formatYmdTh(toYmdBangkok(new Date('2026-10-28T17:30:00Z')))).toBe('29 ต.ค. 2569');
  });
});

describe('ชื่อคนประกาศไม่ขึ้นอีเมล (QA 2 พ.ย. 2569)', () => {
  it('listReleases ถอยไปค่าที่บันทึกตอนกดแบบตัดโดเมนอีเมล', () => {
    const sql = read('api/_lib/jobPublicReleases.ts');
    expect(sql).toContain("nullif(split_part(btrim(r.released_by_name), '@', 1), '')) as released_by_name");
    expect(sql).not.toMatch(/nullif\(btrim\(u\.full_name\), ''\), r\.released_by_name\)/);
  });
});

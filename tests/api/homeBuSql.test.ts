// @vitest-environment node
/**
 * BU กลางของหน้าหลัก (29 ก.ย. 2569 · เจ้าของเคาะ "BU เดียวคุมทั้งหน้า")
 * 🔴 ด่าน: (1) ไม่ส่ง bu = คิวรีเดิมเป๊ะ (หน้าเดิมไม่ขยับ) (2) ส่ง bu = ทุกตารางต่อ join + where ของ BU กลาง
 * (3) รับรหัสไซต์ (LML) หรือแผนก (LM) ได้ แปลงเป็นชุดแผนกเสมอ · รหัสมั่ว = ไม่กรอง
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const B = await import('../../api/_lib/homeBuSql.js');
const { loadCounts } = await import('../../api/_handlers/office-floor.js');

beforeEach(() => {
  dbQuery.mockReset();
  dbQuery.mockResolvedValue({ rows: [{}] });
});

describe('parseBuParam', () => {
  it('รหัสไซต์/แผนก → ชุดแผนก · ตัวพิมพ์เล็กได้ · มั่ว/ว่าง = null', () => {
    expect(B.parseBuParam('lml')).toBe('LM');
    expect(B.parseBuParam('LM')).toBe('LM');
    expect(B.parseBuParam(' LBD ')).toBe('LBD');
    expect(B.parseBuParam('DSL')).toBe('DS');
    expect(B.parseBuParam("LBD'; drop")).toBeNull();
    expect(B.parseBuParam('X1')).toBeNull();
    expect(B.parseBuParam('')).toBeNull();
    expect(B.parseBuParam(undefined)).toBeNull();
    expect(B.parseBuParam(['LBD'])).toBeNull();
  });
});

describe('นิพจน์ BU รายตาราง', () => {
  it('ทุกตัวแปลงเป็นชุดแผนก (ผ่าน trendBuSql) และใช้ alias ของตัวเอง ไม่ชนกัน', () => {
    for (const expr of [B.appBuSql('a'), B.queueBuSql('q'), B.followBuSql('f'), B.holdBuSql('h'), B.aftercareBuSql('p')]) {
      expect(expr).toContain("when 'LML' then 'LM'");
    }
    expect(B.appBuJoin('a')).toContain('a_bm.job_id = a.job_id');
    expect(B.holdBuJoin('h')).toContain('h_bm.job_id = h.job_id');
    expect(B.followBuJoin('f')).toContain('f_bu.id = f.created_by');
    const qj = B.queueBuJoins('q');
    expect(qj).toContain('q_bm.job_id = q.job_ref');
    expect(qj).toContain("q.person_ref = 'app-' || q_ba.id::text");
    expect(qj).toContain("q.person_ref = 'follow-' || q_bf.id::text");
  });

  it('คิวโทร: งานติดตาม = แผนกคนคีย์ → ไซต์รายการ · อื่น ๆ = ไซต์ใบขอ → แผนกบนใบสมัคร (กติกาเดียวกับยอดส่ง Lumos)', () => {
    const q = B.queueBuSql('q');
    expect(q.indexOf('q_bu.department_code')).toBeLessThan(q.indexOf('q_bf.site_code'));
    expect(q.indexOf('q_bm.site_code')).toBeLessThan(q.indexOf('q_ba.department_code'));
  });
});

describe('office-floor + bu', () => {
  const sqls = () => dbQuery.mock.calls.map((c) => String(c[0]));

  it('🔴 ไม่ส่ง bu = คิวรีเดิม ไม่มี join/where ของ BU และไม่มีพารามิเตอร์', async () => {
    await loadCounts(null);
    for (const s of sqls()) {
      expect(s).not.toMatch(/_bm\b|_bu\b|_ba\b|_bf\b/);
      expect(s).not.toContain('$1');
    }
    for (const c of dbQuery.mock.calls) expect(c[1]).toBeUndefined();
  });

  it('ส่ง bu = ทุกคิวรี (ใบสมัคร · คิว · คนรับไปโทร · ติดตาม · รอเลือกวิธีโทร · หลังเริ่มงาน) กรอง BU กลางด้วย $1', async () => {
    await loadCounts('LM');
    const all = sqls();
    expect(all.length).toBe(6);
    for (const s of all) expect(s).toMatch(/= \$1/);
    for (const c of dbQuery.mock.calls) expect(c[1]).toEqual(['LM']);
    // หาคิวรีด้วยคอลัมน์ของมันเอง (คิวรีใบสมัครมี subquery ของคิวอยู่ข้างใน)
    const by = (col: string) => all.find((s) => s.includes(col)) ?? '';
    expect(by('as untouched')).toContain('a_bm.job_id = a.job_id');
    expect(by('as waiting_result')).toContain('q_bm.job_id = q.job_ref');
    expect(by('as holds_active')).toContain('h_bm.job_id = h.job_id');
    expect(by('as past_due')).toContain('f_bu.id = f.created_by');
    expect(by('from aftercare_people p')).toContain('p.closed_at is null');
  });
});

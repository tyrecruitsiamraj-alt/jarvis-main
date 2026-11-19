// @vitest-environment node
/**
 * Gen link เลือกผู้รับผิดชอบได้ (เจ้าของ 19 พ.ย. 2569
 * "พวกนี้มีเจ้าหน้าที่สรรหารับผิดชอบนะ ตอน gen link เพิ่มให้สามารถเลือกคนรับผิดชอบด้วยเลย")
 * 🔴 ด่าน: id ที่ส่งมาต้องเป็นผู้ใช้จริง ยังใช้งาน สายสรรหา (หรือคนกดเอง) · ลิงก์เก็บทั้งผู้รับผิดชอบและคนกด ·
 *    ชื่อบนลิงก์ / ใบประวัติ / ใครเอาเข้ามา / งานรายคน = ผู้รับผิดชอบ › คนกด
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUniqueViolation: () => false,
  isPgUndefinedTable: () => false,
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/http.js', async (orig) => ({ ...(await orig<typeof import('../../api/_lib/http.js')>()), withRbac: (h: unknown) => h }));
vi.mock('../../api/_lib/departmentScope.js', () => ({
  loadUserDepartmentScope: async () => ({ mode: 'code', codes: ['LBD'] }),
}));
vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({ isSiamrajRequestInScope: async () => true }));
vi.mock('../../api/_lib/recruitPostingKinds.js', () => ({ isActivePostingKind: async () => true }));
vi.mock('../../api/_lib/postingLinkHits.js', () => ({ recordDailyLinkHit: async () => undefined, loadFbGroupStats: async () => [] }));
vi.mock('../../api/_lib/recruitPostings.js', async (orig) => ({
  ...(await orig<typeof import('../../api/_lib/recruitPostings.js')>()),
  getRecruitPosting: async (id: string) => ({ id, jobId: null, departmentCode: 'LBD', links: [] }),
}));

const { default: handler } = (await import('../../api/_handlers/recruit-postings.js')) as unknown as {
  default: (req: unknown, res: unknown) => Promise<void>;
};
const { resolveLinkResponsible, linkOwnerSql } = await import('../../api/_lib/recruitPostings.js');
const { LINK_RESPONSIBLE_LANES } = await import('@/lib/recruitPostings');

const ACTOR = '00000000-0000-0000-0000-00000000000a';
const OTHER = '00000000-0000-0000-0000-00000000000b';
/** ผู้ใช้ในฐาน: OTHER = สายสรรหา ชื่อเล่น บี · ACTOR = คนกด (ไม่อยู่สายสรรหา) */
let users: Record<string, string> = {};

function run(body: unknown) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return handler(
    { method: 'POST', body, query: {}, user: { sub: ACTOR, email: 'tangmay@siamraj.com', role: 'staff' } },
    { status, setHeader: vi.fn() },
  ).then(() => ({ code: (status.mock.calls[0] as unknown[] | undefined)?.[0], body: json.mock.calls[0]?.[0] }));
}

const linkInserts = () => dbQuery.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO recruit_posting_links'));

beforeEach(() => {
  users = { [OTHER]: 'บี', [ACTOR]: 'ตังเมย์' };
  dbQuery.mockReset().mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('from users u') && sql.includes('job_lanes')) {
      const [picked, actor] = params as string[];
      // ฐานจำลอง: OTHER อยู่สายสรรหา · ACTOR ผ่านได้เพราะเป็นคนกดเอง
      const ok = picked === OTHER || (picked === actor && picked === ACTOR);
      return { rows: ok && users[picked] ? [{ id: picked, name: users[picked] }] : [] };
    }
    if (sql.includes('INSERT INTO recruit_postings')) {
      return { rows: [{ id: 'p-new', job_id: null, standalone_kind: 'valet', department_code: 'LBD', title: 'Valet', status: 'open', created_at: '2026-11-19T03:00:00Z', updated_at: '2026-11-19T03:00:00Z' }] };
    }
    if (sql.includes('INSERT INTO recruit_posting_links')) {
      const p = params as string[];
      const respIdx = sql.includes('responsible_user_id') ? p.length - 2 : -1;
      const owner = respIdx >= 0 ? users[p[respIdx]] : users[p[5]];
      return { rows: [{ id: 'l1', posting_id: p[0], channel_id: null, channel_label: null, code: p[3], note: null, hit_count: 0, created_at: '2026-11-19T03:00:00Z', creator_name: owner }] };
    }
    return { rows: [] };
  });
});

describe('API ตรวจผู้รับผิดชอบว่าเป็นเจ้าหน้าที่จริง', () => {
  it('ไม่เลือก = null (ไม่ยิงฐาน) · ไม่ใช่ uuid = ล้ม · ไม่พบในรายชื่อ = ล้ม', async () => {
    await expect(resolveLinkResponsible({ pickedUserId: '', actorUserId: ACTOR, scopeCodes: null })).resolves.toBeNull();
    await expect(resolveLinkResponsible({ pickedUserId: null, actorUserId: ACTOR, scopeCodes: null })).resolves.toBeNull();
    expect(dbQuery).not.toHaveBeenCalled();
    await expect(resolveLinkResponsible({ pickedUserId: 'ว่าน', actorUserId: ACTOR, scopeCodes: null })).rejects.toThrow('ต้องเลือกผู้รับผิดชอบ');
    await expect(
      resolveLinkResponsible({ pickedUserId: '00000000-0000-0000-0000-0000000000ff', actorUserId: ACTOR, scopeCodes: null }),
    ).rejects.toThrow('ต้องเลือกผู้รับผิดชอบ');
  });

  it('คำถามฐาน: ยังใช้งาน · คนกดเอง หรือสายสรรหา/ทีม Online ที่มีชื่อเล่น ใน BU ที่คนกดเห็น (ชุดเดียวกับรายชื่อในฟอร์ม)', async () => {
    await expect(resolveLinkResponsible({ pickedUserId: OTHER, actorUserId: ACTOR, scopeCodes: ['LBD'] })).resolves.toEqual({ userId: OTHER, name: 'บี' });
    const [sql, params] = dbQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('u.is_active');
    expect(sql).toContain('u.id = $2::uuid');
    expect(sql).toContain("$3::text[] && coalesce(u.job_lanes, '{}'::text[])");
    expect(sql).toContain("coalesce(btrim(u.nickname), '') <> ''");
    expect(sql).toContain('upper(btrim(u.department_code)) = any($4::text[])');
    expect(params).toEqual([OTHER, ACTOR, ['recruiter', 'online'], ['LBD']]);
    expect(LINK_RESPONSIBLE_LANES).toEqual(['recruiter', 'online']);
  });

  it('Gen link เพิ่ม: id มั่ว = 400 ไม่สร้างลิงก์ · id ที่ไม่มีในรายชื่อ = 400', async () => {
    expect((await run({ postingId: 'p1', responsibleUserId: 'DROP TABLE' })).code).toBe(400);
    expect((await run({ postingId: 'p1', responsibleUserId: '00000000-0000-0000-0000-0000000000ff' })).code).toBe(400);
    expect(linkInserts()).toHaveLength(0);
  });

  it('Gen link เพิ่ม: เลือกคนอื่น = ลิงก์เก็บผู้รับผิดชอบ + คนกดจริง · ชื่อบนลิงก์ = ผู้รับผิดชอบ', async () => {
    const r = await run({ postingId: 'p1', responsibleUserId: OTHER });
    expect(r.code).toBe(201);
    expect(r.body.createdByName).toBe('บี');
    const [[sql, params]] = linkInserts() as Array<[string, unknown[]]>;
    expect(sql).toContain('created_by_user_id, created_by_name');
    expect(sql).toContain('responsible_user_id, responsible_name');
    expect(params[5]).toBe(ACTOR);
    expect(params[6]).toBe('tangmay@siamraj.com');
    expect(params.slice(-2)).toEqual([OTHER, 'บี']);
  });

  it('Gen link เพิ่ม: ไม่ส่งผู้รับผิดชอบ = ทางเดิม (ไม่อ้างคอลัมน์ 190) ลิงก์เป็นของคนกด', async () => {
    const r = await run({ postingId: 'p1' });
    expect(r.code).toBe(201);
    expect(r.body.createdByName).toBe('ตังเมย์');
    const [[sql]] = linkInserts() as Array<[string]>;
    expect(sql).not.toContain('responsible_user_id');
  });

  it('สร้างประกาศกล่องลอย: ผู้รับผิดชอบลงทั้งประกาศและทุกลิงก์ · ไม่เชื่อ responsibleName ที่ส่งมา', async () => {
    const r = await run({
      standaloneKind: 'valet',
      departmentCode: 'LBD',
      title: 'Valet parking',
      responsibleUserId: OTHER,
      responsibleName: 'ชื่อปลอม',
      channels: [{ channelId: 'c1', label: 'Facebook' }, { channelId: 'c2', label: 'Line' }],
    });
    expect(r.code).toBe(201);
    const posting = dbQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO recruit_postings')) as [string, unknown[]];
    // $12 responsible_name · $13 responsible_user_id · $16/$17 คนกด
    expect(posting[1][11]).toBe('บี');
    expect(posting[1][12]).toBe(OTHER);
    expect(posting[1][15]).toBe(ACTOR);
    const links = linkInserts() as Array<[string, unknown[]]>;
    expect(links).toHaveLength(2);
    for (const [, p] of links) {
      expect(p[5]).toBe(ACTOR);
      expect(p.slice(-2)).toEqual([OTHER, 'บี']);
    }
  });

  it('สร้างประกาศ: id ผู้รับผิดชอบที่ไม่ผ่าน = 400 ไม่สร้างประกาศ', async () => {
    const r = await run({ standaloneKind: 'valet', departmentCode: 'LBD', title: 'Valet', responsibleUserId: '00000000-0000-0000-0000-0000000000ff' });
    expect(r.code).toBe(400);
    expect(dbQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false);
  });
});

describe('ผู้รับผิดชอบที่เลือกมาก่อนคนกด ทุกที่ที่บอกว่าลิงก์เป็นของใคร', () => {
  it('linkOwnerSql (รายการลิงก์ · "Gen link ล่าสุด … โดย" · ใบประวัติ): ผู้รับผิดชอบ › คนกด', () => {
    const sql = linkOwnerSql('l.id', 'l.posting_id');
    expect(sql).toContain('left join users ru on ru.id = lk.responsible_user_id');
    expect(sql.indexOf('ru.nickname')).toBeLessThan(sql.indexOf('lu.nickname'));
    expect(sql.indexOf('lk.responsible_name')).toBeLessThan(sql.indexOf('lu.nickname'));
  });

  it('ภาพรวม "ใครเอาเข้ามา" · งานรายคน นับเป็นของผู้รับผิดชอบ', () => {
    const overview = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
    expect(overview).toContain('(select coalesce((select nullif(btrim(ru.email), \'\') from ${USERS_TABLE} ru where ru.id = l.responsible_user_id),');
    const activity = readFileSync('api/_handlers/staff-activity.ts', 'utf8');
    expect(activity).toContain("const LINK_OWNER = 'coalesce(l.responsible_user_id, l.created_by_user_id)';");
    expect(activity).not.toMatch(/where l\.created_by_user_id = \$3/);
    expect(activity).toContain('join ${USERS} u on u.id = ${LINK_OWNER}');
  });

  it('migration 190 เพิ่มอย่างเดียว', () => {
    const sql = readFileSync('migrations/190_posting_link_responsible.sql', 'utf8');
    expect(sql).toContain('add column if not exists responsible_user_id uuid null');
    expect(sql).toContain('add column if not exists responsible_name text null');
    expect(sql).not.toMatch(/\b(update|delete|drop)\b/i);
  });
});

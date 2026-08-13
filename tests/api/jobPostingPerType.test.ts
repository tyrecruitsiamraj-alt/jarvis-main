// @vitest-environment node
/**
 * กันซ้ำของคำขอโพสหาคน — ตั้งแต่ migration 080 กันระดับ **(ใบขอ, ประเภท)** ไม่ใช่ระดับใบขอ
 *
 * เจ้าของสั่ง 13 ส.ค. 2569: ใบเดียวส่งได้ทั้ง Content และ Scraping ("เลือกอันไหน
 * อันนั้นก็ซ่อน แล้วโชว์อันที่ยังไม่ได้เลือกไว้") · ของเดิมกดประเภทที่สองแล้วได้คำขอ
 * เดิมกลับมาเงียบ ๆ = ปุ่มที่กดแล้วไม่เกิดอะไร ซึ่งแย่กว่าปุ่มหาย
 *
 * ⚠️ ถ้าเทสต์ไฟล์นี้ล้ม แปลว่ามีคนเอา guard ระดับใบขอกลับมา — ปุ่มจะกลับไปหลอกอีก
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { createJobPostingRequest, getActiveJobPostingForJob, listActiveJobPostingsForJob } =
  await import('../../api/_lib/jobPostingRequests.js');

const calls: Array<{ sql: string; params: unknown[] }> = [];

function row(requestType: 'content' | 'scraping') {
  return {
    id: `id-${requestType}`,
    job_id: 'siamraj-sql:OPL1',
    request_no: 'OPL1',
    request_type: requestType,
    status: 'pending',
    reason: null,
    requested_by: null,
    requested_by_name: null,
    job_snapshot: null,
    created_at: '2026-08-13T03:00:00.000Z',
    updated_at: '2026-08-13T03:00:00.000Z',
  };
}

beforeEach(() => {
  calls.length = 0;
  vi.mocked(dbQuery).mockReset();
});

describe('createJobPostingRequest — กันซ้ำต่อประเภท ไม่ใช่ต่อใบขอ', () => {
  it('มี Content อยู่แล้ว แล้วขอ Scraping → ต้องสร้างใหม่ ไม่ใช่คืนอันเดิม', async () => {
    vi.mocked(dbQuery).mockImplementation(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] });
      // คิวรีแรก = เช็คของเดิมเฉพาะ scraping → ไม่เจอ · คิวรีที่สอง = insert
      if (/insert/i.test(sql)) return { rows: [row('scraping')] } as never;
      return { rows: [] } as never;
    });

    const created = await createJobPostingRequest({
      jobId: 'siamraj-sql:OPL1',
      requestType: 'scraping',
    });

    expect(created.request_type).toBe('scraping');
    // คิวรีเช็คของเดิมต้องมี request_type อยู่ในเงื่อนไข — ไม่งั้นกันซ้ำทั้งใบเหมือนเดิม
    expect(calls[0].sql).toContain('request_type');
    expect(calls[0].params).toContain('scraping');
    expect(calls.some((c) => /insert/i.test(c.sql))).toBe(true);
  });

  it('มี Content อยู่แล้ว แล้วขอ Content ซ้ำ → คืนอันเดิม ไม่ insert', async () => {
    vi.mocked(dbQuery).mockImplementation(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] });
      if (/insert/i.test(sql)) return { rows: [row('content')] } as never;
      return { rows: [row('content')] } as never;
    });

    const created = await createJobPostingRequest({ jobId: 'siamraj-sql:OPL1', requestType: 'content' });
    expect(created.id).toBe('id-content');
    expect(calls.some((c) => /insert/i.test(c.sql))).toBe(false);
  });

  it('ไม่ระบุประเภทถือเป็น content (ค่าเริ่มต้นเดิม)', async () => {
    vi.mocked(dbQuery).mockImplementation(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] });
      return { rows: [row('content')] } as never;
    });
    await createJobPostingRequest({ jobId: 'siamraj-sql:OPL1' });
    expect(calls[0].params).toContain('content');
  });
});

describe('getActiveJobPostingForJob / listActiveJobPostingsForJob', () => {
  it('ไม่ส่งประเภทมา = ดูทุกประเภท (พฤติกรรมเดิม ไม่พังของเก่า)', async () => {
    vi.mocked(dbQuery).mockImplementation(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] });
      return { rows: [row('content')] } as never;
    });
    await getActiveJobPostingForJob('siamraj-sql:OPL1');
    // เทียบเฉพาะท่อน where — request_type อยู่ในรายการคอลัมน์ที่ select อยู่แล้วเสมอ
    const where = calls[0].sql.slice(calls[0].sql.toLowerCase().indexOf('where'));
    expect(where).not.toContain('request_type');
    expect(calls[0].params).not.toContain('content');
  });

  it('คืนคำขอ active ทุกประเภทของใบนั้น — หน้าเว็บใช้ตัดสินว่าปุ่มไหนซ่อน', async () => {
    vi.mocked(dbQuery).mockImplementation(async () => ({ rows: [row('content'), row('scraping')] }) as never);
    const items = await listActiveJobPostingsForJob('siamraj-sql:OPL1');
    expect(items.map((i) => i.request_type).sort()).toEqual(['content', 'scraping']);
  });

  it('ตารางยังไม่ migrate ก็ไม่พังทั้งหน้า (คืนว่าง)', async () => {
    // ตัวเช็คของไฟล์นี้ดูจากข้อความ error ไม่ใช่ code (ดู isMissingTable)
    vi.mocked(dbQuery).mockImplementation(async () => {
      throw new Error('relation "job_posting_requests" does not exist');
    });
    expect(await listActiveJobPostingsForJob('siamraj-sql:OPL1')).toEqual([]);
    expect(await getActiveJobPostingForJob('siamraj-sql:OPL1')).toBeNull();
  });
});

describe('migration 080 — index ต้องคุมระดับ (ใบขอ, ประเภท)', () => {
  it('ผ่อน unique index เดิมและสร้างตัวใหม่ที่รวม request_type', () => {
    const sql = readFileSync(
      path.join(process.cwd(), 'migrations/080_job_posting_active_per_type.sql'),
      'utf8',
    );
    expect(sql).toContain('drop index if exists job_posting_requests_active_job_idx');
    expect(sql).toMatch(/on job_posting_requests \(job_id, request_type\)/);
    // เงื่อนไข active ต้องเป็นชุดเดิมเป๊ะ ไม่งั้นคำขอที่ปิดไปแล้วจะกลับมากันซ้ำ
    expect(sql).toContain("where status in ('pending', 'in_progress', 'posted')");
  });
});

// @vitest-environment node
/**
 * ใบสมัครซ้ำกับ iRecruit = AI ไม่โทรเอง ติดป้ายให้คนเลือก (เจ้าของ Choice 12 ต.ค. 2569 · migration 143)
 * ซ้ำ = เบอร์เดียวกันสมัคร iRecruit ภายใน 14 วัน · อ่าน iRecruit ไม่ได้ = ส่ง AI ตามเดิม · ใบที่จดว่าซ้ำแล้วไม่ต้องเช็คซ้ำ
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const dbQuery = vi.fn();
const irecruitSqlQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', async (orig) => ({ ...(await orig<object>()), dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/irecruitSqlServer.js', () => ({ irecruitSqlQuery: (...a: unknown[]) => irecruitSqlQuery(...a) }));

import { irecruitPhoneVariants, splitIrecruitDuplicates, IRECRUIT_DUP_DAYS } from '../../api/_lib/irecruitDuplicates.js';

const NOW = new Date('2026-10-12T05:00:00Z');

beforeEach(() => {
  dbQuery.mockReset().mockResolvedValue({ rows: [] });
  irecruitSqlQuery.mockReset().mockResolvedValue([]);
});

describe('ซ้ำกับ iRecruit', () => {
  it('เบอร์ → รูปที่ iRecruit เก็บ (10 หลัก + 9 หลักขาด 0) · +66 แปลงได้ · อ่านไม่ออก = null', () => {
    expect(irecruitPhoneVariants('081-234-5678')).toEqual(['0812345678', '812345678']);
    expect(irecruitPhoneVariants('+66812345678')).toEqual(['0812345678', '812345678']);
    expect(irecruitPhoneVariants('1234')).toBeNull();
    expect(IRECRUIT_DUP_DAYS).toBe(14);
  });

  it('🔴 สมัคร iRecruit ภายใน 14 วัน = ไม่ส่ง + จด · เกิน 14 วัน/ไม่เจอ = ส่ง', async () => {
    irecruitSqlQuery.mockResolvedValue([
      { id: 11, phone_number: '0811111111', created_at: '2026-10-05T03:00:00Z' }, // 7 วันก่อน = ซ้ำ
      { id: 12, phone_number: '822222222', created_at: '2026-09-01T03:00:00Z' }, // 41 วันก่อน = ไม่ซ้ำ
    ]);
    const apps = [
      { id: 'a1', phone: '0811111111', created_at: NOW },
      { id: 'a2', phone: '0822222222', created_at: NOW },
      { id: 'a3', phone: '0833333333', created_at: NOW },
    ];
    const r = await splitIrecruitDuplicates(apps);
    expect(r.send.map((a) => a.id)).toEqual(['a2', 'a3']);
    expect(r.dups.map((d) => [d.app.id, d.dup.irecruitId])).toEqual([['a1', 11]]);
    const [sql, params] = irecruitSqlQuery.mock.calls[0];
    expect(String(sql)).toMatch(/phone_number IN \('0811111111','811111111','0822222222','822222222','0833333333','833333333'\)/);
    expect((params as { oldest: Date }).oldest.toISOString()).toBe(new Date(NOW.getTime() - 14 * 86_400_000).toISOString());
    const insert = dbQuery.mock.calls.find(([q]) => /insert into .*application_irecruit_dups/.test(String(q)));
    expect(insert?.[1]?.[0]).toEqual(['a1']);
  });

  it('🔴 อ่าน iRecruit ไม่ได้ = ส่งทุกใบ (เจ้าของเลือก) · ไม่โยนออกไป', async () => {
    irecruitSqlQuery.mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await splitIrecruitDuplicates([{ id: 'a1', phone: '0811111111', created_at: NOW }]);
    expect(r.send.map((a) => a.id)).toEqual(['a1']);
    expect(r.dups).toEqual([]);
  });

  it('ใบที่จดว่าซ้ำไว้แล้ว = ไม่ส่ง ไม่ต้องถาม iRecruit ซ้ำ', async () => {
    dbQuery.mockImplementation(async (q: string) =>
      /select application_id/.test(q) ? { rows: [{ application_id: 'a1', irecruit_register_id: '9', irecruit_applied_at: '2026-10-05T03:00:00Z' }] } : { rows: [] },
    );
    const r = await splitIrecruitDuplicates([{ id: 'a1', phone: '0811111111', created_at: NOW }]);
    expect(r.send).toEqual([]);
    expect(irecruitSqlQuery).not.toHaveBeenCalled();
  });

  it('🔴 ตัวส่ง AI อัตโนมัติทั้ง 3 เส้นผ่านตัวกรองนี้ · ปุ่มส่ง AI ที่คนกดเองไม่ผ่าน', () => {
    const read = (p: string) => readFileSync(p, 'utf8');
    expect(read('api/_handlers/public/apply.ts')).toMatch(/splitIrecruitDuplicates\(\[\{ id, phone: v\.phone/);
    expect(read('api/_lib/incomeReadyDispatch.ts')).toMatch(/splitIrecruitDuplicates\(rows\)/);
    const worker = read('api/_lib/callChoiceWorker.ts');
    expect(worker).toMatch(/splitIrecruitDuplicates\(all\)/);
    expect(worker).toMatch(/not exists \(select 1 from \$\{IRECRUIT_DUPS\}/);
    expect(read('api/_handlers/application-dispatch.ts')).not.toMatch(/splitIrecruitDuplicates/);
  });
});

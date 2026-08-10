// @vitest-environment node
/**
 * ธง "เพิ่งมีผลโทรว่าไม่สนใจ" บนหน้าจองตัว
 *
 * หลักการ: ผลโทร **ไม่** เด้งสถานะจองอัตโนมัติ (เบอร์ผิด/คนละคนก็มี — กติกาข้อ 8)
 * ธงนี้แค่ทำให้คนเห็นสัญญาณแล้วตัดสินใจกดโยนกลับเอง จึงเป็น "ของแถม":
 * พังก็แค่ไม่มีธง ลิสต์จองต้องมาเสมอ
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { loadDeclinedCallWarnings } = await import('../../api/_lib/proposalCallWarnings.js');

const undefinedTable = Object.assign(new Error('no relation'), { code: '42P01' });
const paramsOf = (i: number) => (vi.mocked(dbQuery).mock.calls[i]?.[1] ?? []) as unknown[];

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  vi.mocked(dbQuery).mockResolvedValue({ rows: [] } as never);
});

describe('loadDeclinedCallWarnings', () => {
  it('แปลงเบอร์เป็น E.164 + ตัดซ้ำ/ค่าว่าง ก่อนยิงคิวรี', async () => {
    await loadDeclinedCallWarnings(['081-234-5678', '0812345678', null, '', 'ไม่ใช่เบอร์']);
    expect(paramsOf(0)[0]).toEqual(['+66812345678']);
  });

  it('ไม่มีเบอร์เลย = ไม่แตะ DB', async () => {
    const map = await loadDeclinedCallWarnings([null, '', undefined]);
    expect(map.size).toBe(0);
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('มีผลทั้งจากคนและ AI — เก็บตัวที่ใหม่กว่า', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({
        rows: [{ phone_e164: '+66812345678', result_scope: 'job', held_by_name: 'ตั้ม', released_at: '2026-08-09T10:00:00Z', held_at: '2026-08-09T09:00:00Z' }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ phone: '+66812345678', updated_at: '2026-08-10T02:00:00Z' }],
      } as never);
    const map = await loadDeclinedCallWarnings(['0812345678']);
    const w = map.get('+66812345678');
    expect(w?.at).toBe('2026-08-10T02:00:00Z');
    expect(w?.byName).toBeNull(); // ตัวที่ชนะคือฝั่ง AI
  });

  it('ฝั่งคนใหม่กว่า = ได้ scope + ชื่อคนบันทึก (all = สัญญาณแรง)', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({
        rows: [{ phone_e164: '+66812345678', result_scope: 'all', held_by_name: 'ตั้ม', released_at: '2026-08-10T05:00:00Z', held_at: '2026-08-10T04:00:00Z' }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ phone: '+66812345678', updated_at: '2026-08-09T02:00:00Z' }],
      } as never);
    const w = (await loadDeclinedCallWarnings(['0812345678'])).get('+66812345678');
    expect(w?.scope).toBe('all');
    expect(w?.byName).toBe('ตั้ม');
  });

  it('ตารางฝั่งใดฝั่งหนึ่งยังไม่ migrate = ข้ามแหล่งนั้น ไม่พังทั้งก้อน', async () => {
    vi.mocked(dbQuery)
      .mockRejectedValueOnce(undefinedTable)
      .mockResolvedValueOnce({
        rows: [{ phone: '+66812345678', updated_at: '2026-08-10T02:00:00Z' }],
      } as never);
    const map = await loadDeclinedCallWarnings(['0812345678']);
    expect(map.get('+66812345678')?.outcome).toBe('declined');
  });

  it('เบอร์ที่ไม่มีผล declined = ไม่ติดธง', async () => {
    const map = await loadDeclinedCallWarnings(['0898765432']);
    expect(map.size).toBe(0);
  });
});

// @vitest-environment node
/**
 * ที่เก็บนโยบายการโทร (migration 073)
 *
 * ⚠️ หน้าจอตั้งค่า + `GET/PUT /api/lumos/call-policy` **ถูกถอดออกแล้ว** (เจ้าของสั่ง 10 ส.ค. 2569)
 * ค่าที่อยู่ในตารางยังคุมการโทรจริงอยู่เหมือนเดิม — ที่เก็บจึงยังต้องมีเทสต์
 *
 * จุดที่ต้องคุมแน่น ๆ:
 * - ตารางยังไม่ migrate = ค่าเริ่มต้นในโค้ด (พฤติกรรม production เดิมเป๊ะ)
 * - DB ล้มเหตุอื่น = โยนต่อ — ไม่งั้นระบบเงียบ ๆ ใช้เพดานโทรคนละชุดกับที่ตั้งไว้
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const {
  getCallFollowupPolicy,
  setCallFollowupPolicy,
  clearCallFollowupPolicyCache,
} = await import('../../api/_lib/callFollowupPolicyStore.js');
const { DEFAULT_CALL_FOLLOWUP_POLICY } = await import('../../src/lib/callFollowupPolicy.js');

const undefinedTable = Object.assign(new Error('no relation'), { code: '42P01' });
const otherDbError = Object.assign(new Error('connection terminated'), { code: '57P01' });

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  vi.mocked(dbQuery).mockResolvedValue({ rows: [] } as never);
  clearCallFollowupPolicyCache();
});

describe('getCallFollowupPolicy — ที่เก็บ', () => {
  it('ตารางยังไม่ migrate = ค่าเริ่มต้นในโค้ด (ไม่พัง)', async () => {
    vi.mocked(dbQuery).mockRejectedValueOnce(undefinedTable);
    await expect(getCallFollowupPolicy()).resolves.toEqual(DEFAULT_CALL_FOLLOWUP_POLICY);
  });

  it('DB ล้มเหตุอื่น ต้องโยนต่อ ไม่กลืน', async () => {
    vi.mocked(dbQuery).mockRejectedValueOnce(otherDbError);
    await expect(getCallFollowupPolicy()).rejects.toThrow();
  });

  it('ค่าเพี้ยนจาก DB ถูก normalize เข้าขอบเขต (เพดาน 1–10 ครั้ง)', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({
      rows: [{ payload: { maxAttempts: 99, quietFromHour: 21, quietToHour: 7 } }],
    } as never);
    const p = await getCallFollowupPolicy();
    expect(p.maxAttempts).toBe(10);
    expect(p.quietFromHour).toBe(21);
    expect(p.quietToHour).toBe(7);
    expect(p.retryGapHours).toBe(DEFAULT_CALL_FOLLOWUP_POLICY.retryGapHours);
  });

  it('มี cache — เรียกซ้ำใน TTL ไม่ยิง DB รอบสอง · ล้างแล้วยิงใหม่', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ payload: { maxAttempts: 5 } }] } as never);
    await getCallFollowupPolicy();
    await getCallFollowupPolicy();
    expect(dbQuery).toHaveBeenCalledTimes(1);
    clearCallFollowupPolicyCache();
    await getCallFollowupPolicy();
    expect(dbQuery).toHaveBeenCalledTimes(2);
  });

  it('setCallFollowupPolicy เขียนแล้วล้าง cache ให้ทันที', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ payload: { maxAttempts: 2 } }] } as never);
    await getCallFollowupPolicy(); // อุ่น cache
    const saved = await setCallFollowupPolicy(
      { ...DEFAULT_CALL_FOLLOWUP_POLICY, maxAttempts: 2 },
      'admin@example.com',
    );
    expect(saved.maxAttempts).toBe(2);
    // cache ถูกล้าง — อ่านรอบถัดไปยิง DB ใหม่ (insert 1 + select 2)
    await getCallFollowupPolicy();
    expect(dbQuery).toHaveBeenCalledTimes(3);
  });
});

describe('การ wiring — จุดที่ใช้นโยบายต้องอ่านจากที่เก็บ ไม่ใช่ค่า hardcode', () => {
  it('callFollowup.ts เดินนโยบายด้วย getCallFollowupPolicy ทั้ง 2 ทาง (AI + คน)', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('api/_lib/callFollowup.ts', 'utf-8');
    const hits = src.match(/policy: await getCallFollowupPolicy\(\)/g) ?? [];
    expect(hits.length).toBe(2);
    expect(src).not.toMatch(/policy: DEFAULT_CALL_FOLLOWUP_POLICY/);
  });

  it('insertQueueItems ตั้ง next_attempt_at ให้พ้นช่วงห้ามโทรตั้งแต่ตอนเข้าคิว', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('api/_lib/lumosDispatch.ts', 'utf-8');
    const block = src.slice(src.indexOf('async function insertQueueItems'));
    // ของใหม่ต้องเคารพช่วงเวลาโทรด้วย ไม่ใช่แค่โทรซ้ำ — ถอดออกเมื่อไหร่
    // งานที่กดส่งตอน 19:55 จะถูก Lumos หยิบไปโทรตอน 21:00 ได้อีก
    expect(block).toMatch(/shiftOutOfQuietHours/);
    expect(block).toMatch(/insert into[\s\S]*next_attempt_at/);
  });
});

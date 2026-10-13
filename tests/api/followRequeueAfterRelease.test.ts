// @vitest-environment node
/**
 * ═══ ปลดบล็อกเบอร์แล้ว **สายที่ค้างต้องกลับเข้าคิว** (เจ้าของสั่ง 17 ก.ย. 2569) ═══
 *
 * > *"แก้ ๆ ๆ อย่าพึ่งบล็อคเบอร์ แก้เลย ๆ"*
 *
 * เคสจริงที่ทำให้ต้องมีไฟล์นี้: เบอร์หนึ่งถูกพักอัตโนมัติวันที่ 17 ก.ย. · รอบของวันที่ 18
 * ถูกตั้งไว้เรียบร้อยแต่ตอนเข้าคิวโดนปัดเป็น `dispatch_state = 'suppressed'`
 * **โดยไม่มีแถวในคิวเลย** ⇒ คนมาปลดบล็อกทีหลังก็ไม่มีอะไรพากลับ สายหายเงียบ
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. ปลดแล้วต้องพารอบที่ **ยังไม่ถึงเวลา** กลับเข้าคิวจริง
 * 2. เอาเฉพาะเบอร์ที่ปลด — เบอร์อื่นที่ยังโดนพักอยู่ห้ามติดร่างแหไปด้วย
 * 3. จด `dispatch_state` ใหม่ ไม่งั้นจอยังโชว์ว่า "ไม่ได้ส่งให้ AI" ทั้งที่ส่งแล้ว
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const dbQuery = vi.fn();
const pushReminders = vi.fn();

vi.mock('../../api/_lib/postgres.js', async () => {
  const actual = await vi.importActual<typeof import('../../api/_lib/postgres.js')>(
    '../../api/_lib/postgres.js',
  );
  return { ...actual, dbQuery: (...a: unknown[]) => dbQuery(...a) };
});
vi.mock('../../api/_lib/lumosPushClient.js', () => ({
  pushReminders: (...a: unknown[]) => pushReminders(...a),
  cancelPushedReminder: vi.fn(),
  getLumosPushConfig: () => ({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' }),
  pushInterviews: vi.fn(),
  cancelPushedInterview: vi.fn(),
  getEventStatus: vi.fn(),
}));

const { listPhonesWithStuckSuppressedFollows, requeueSuppressedFollowEntries } = await import('../../api/_lib/lumosDispatch.js');

const staffName = async () => 'ขวัญ';
/**
 * พรุ่งนี้ HH:00 เวลาไทย — 🔴 สองรอบของคนเดียวกันต้องอยู่ **วันเดียวกัน** ถึงจะเป็นแผนเดียว (1 เบอร์ 1 วัน = 1 แผน · 9 ต.ค. 2569)
 * (เดิมใช้ +14/+15 ชม. — รันหลัง 09:00 สองรอบข้ามเที่ยงคืน กลายเป็น 2 แผนตามกติกา)
 */
const tomorrowAt = (hh: number) => {
  const ymd = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  return new Date(`${ymd}T${String(hh).padStart(2, '0')}:00:00+07:00`);
};

/** สองรอบของคนเดียวกันที่โดนปัดทิ้งตอนเบอร์ถูกพัก + อีกคนที่เป็นคนละเบอร์ */
const stuck = [
  {
    id: 'a1',
    recipient_name: 'นายฟ้า ทดสอบ',
    recipient_phone: '0654691768',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    staff_phone: '+66898888888',
    unit_name: 'บางชัน',
    scheduled_at: tomorrowAt(9).toISOString(),
    call_times: null,
    call_round: 1,
  },
  {
    id: 'a2',
    recipient_name: 'นายฟ้า ทดสอบ',
    recipient_phone: '0654691768',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    staff_phone: '+66898888888',
    unit_name: 'บางชัน',
    scheduled_at: tomorrowAt(10).toISOString(),
    call_times: null,
    call_round: 2,
  },
  {
    id: 'b1',
    recipient_name: 'คนละเบอร์ ห้ามติดร่างแห',
    recipient_phone: '0922511703',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    staff_phone: '+66898888888',
    unit_name: 'ลาดกระบัง',
    scheduled_at: tomorrowAt(11).toISOString(),
    call_times: null,
    call_round: 1,
  },
];

const sqlSeen = () => dbQuery.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  pushReminders.mockReset().mockResolvedValue({ results: [{ event_id: 'evt' }] });
  dbQuery.mockReset();
  dbQuery.mockImplementation((sql: string) => {
    if (/dispatch_state = any\(\$1::text\[\]\)/.test(sql) && /select f\.id/i.test(sql)) {
      return Promise.resolve({ rows: stuck });
    }
    return Promise.resolve({ rows: [] });
  });
});

describe('requeueSuppressedFollowEntries', () => {
  it('🔴 ปลดเบอร์แล้วพารอบที่ยังไม่ถึงเวลาของเบอร์นั้นกลับเข้าคิว', async () => {
    const out = await requeueSuppressedFollowEntries('+66654691768', staffName);

    expect(pushReminders).toHaveBeenCalledTimes(1);
    // สองรอบของคนนั้นเท่านั้น — ไม่มีของเบอร์อื่นปนเข้ามา
    expect(Object.keys(out.states).sort()).toEqual(['a1', 'a2']);
  });

  it('🔴 เบอร์อื่นที่ยังโดนพักอยู่ ห้ามถูกปลุกตามไปด้วย', async () => {
    const out = await requeueSuppressedFollowEntries('+66654691768', staffName);
    expect(out.states.b1).toBeUndefined();
    expect(sqlSeen().some((q) => /update .*follow_entries/i.test(q) && /b1/.test(q))).toBe(false);
  });

  it('ไม่มีรอบค้างของเบอร์นั้น ⇒ ไม่ยิงอะไรออกไปเลย', async () => {
    const out = await requeueSuppressedFollowEntries('+66811111111', staffName);
    expect(out.requeued).toBe(0);
    expect(pushReminders).not.toHaveBeenCalled();
  });
});

/**
 * 🔴 13 ต.ค. 2569 (ไล่ "อะไรที่จะไม่โทร" A5 · A7): กู้ครอบ held (คนรับไปโทรเองแล้วปล่อย) + guarded (ตรวจไม่ได้ตอนนั้น)
 * เดิมกู้แค่ suppressed ⇒ สองสถานะนี้ค้างไม่มีใครส่งให้
 */
describe('ตัวกู้ครอบ held + guarded', () => {
  it('เบอร์ที่ไม่ได้ถูกถือ/ไม่ได้ถูกพักแล้ว = ได้คิวกู้ · คิวรีขอทั้ง 3 สถานะ', async () => {
    const rows = [
      { ...stuck[0], id: 'h1', recipient_phone: '0811111111', dispatch_state: 'held' },
      { ...stuck[0], id: 'g1', recipient_phone: '0822222222', dispatch_state: 'guarded' },
    ];
    dbQuery.mockImplementation((sql: string, params?: unknown[]) => {
      if (/dispatch_state = any\(\$1::text\[\]\)/.test(sql) && /select f\.id/i.test(sql)) {
        expect(params?.[0]).toEqual(['suppressed', 'held', 'guarded']);
        return Promise.resolve({ rows });
      }
      return Promise.resolve({ rows: [] }); // ไม่มีใครถือเบอร์ · ไม่มีเบอร์ถูกพัก
    });
    expect((await listPhonesWithStuckSuppressedFollows()).sort()).toEqual(['+66811111111', '+66822222222']);
  });
});

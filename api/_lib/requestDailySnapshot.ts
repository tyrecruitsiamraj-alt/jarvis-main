/**
 * ═══ ยอดใบขอเหลือหารายวัน (เจ้าของ 16 พ.ย. 2569 Choice "เพิ่ม จดทุกคืน") ═══
 * ภาพรวมเรื่อง "ใบขอเหลือหา" / "เริ่มหาแล้ว / ยังไม่เริ่ม" เทียบย้อนหลังไม่ได้เพราะไม่เคยจดยอด ณ แต่ละวัน
 * → จด BU × ขั้นที่ติด × เริ่มหาแล้ว/ยังไม่เริ่ม (ใบ + อัตรา) จากใบชุดเดียวกับหน้าภาพรวม (`loadOpenStuckRequestsAll`)
 * - ทุกชั่วโมงเขียนทับยอดของ "วันนี้" (ลบแล้วใส่ในธุรกรรมเดียว) ⇒ ยอดของวัน = รอบสุดท้ายของวันนั้น · รันซ้ำ/หลายเครื่องไม่ซ้ำ
 * - ตารางใหม่ (`181_recruit_request_daily.sql`) ไม่แตะข้อมูลเดิม · ยังไม่ migrate = ข้าม ไม่ล้ม
 * - ปิดด้วย REQUEST_DAILY_SNAPSHOT_ENABLED=false
 */
import { dbQuery, dbTransaction } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError, logInfo } from './logger.js';
import { toBangkokYmd } from './businessDate.js';
import { STUCK_PHASES, stuckPhaseOf, type StuckDailyRow, type StuckRequest } from '../../src/lib/recruitStuck.js';
import { isStartedRequest } from '../../src/lib/recruitTopics.js';

const table = tableInAppSchema('recruit_request_daily');

export type RequestDailyRow = StuckDailyRow;

/** ใบที่ยังเปิด → แถวยอดรายวัน (BU × ขั้น × เริ่มหา) · ใบไม่รู้ BU = ไม่นับ (เหมือนกราฟ BU) */
export function dailyRowsOf(day: string, rows: readonly StuckRequest[]): RequestDailyRow[] {
  const m = new Map<string, RequestDailyRow>();
  for (const r of rows) {
    const bu = (r.bu ?? '').trim();
    if (!bu) continue;
    const phase = stuckPhaseOf(r.reason);
    const started = isStartedRequest(r);
    const key = `${bu}|${phase}|${started}`;
    const row = m.get(key) ?? { day, bu, phase, started, requests: 0, positions: 0 };
    row.requests += 1;
    row.positions += Math.max(0, Number(r.remaining) || 0);
    m.set(key, row);
  }
  const order = (p: string) => STUCK_PHASES.findIndex((x) => x.key === p);
  return [...m.values()].sort((a, b) => a.bu.localeCompare(b.bu) || order(a.phase) - order(b.phase) || Number(b.started) - Number(a.started));
}

const isMissingTable = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === '42P01';

/** จดยอดของวันนี้ (เขียนทับ) — คืนจำนวนแถว · ตารางยังไม่มี = null */
export async function runRequestDailySnapshotOnce(
  loadOpen: () => Promise<StuckRequest[]>,
  now = new Date(),
): Promise<number | null> {
  const day = toBangkokYmd(now);
  const rows = dailyRowsOf(day, await loadOpen());
  try {
    await dbTransaction(async (client) => {
      await client.query(`delete from ${table} where day = $1::date`, [day]);
      for (const r of rows) {
        await client.query(
          `insert into ${table} (day, bu, phase, started, requests, positions) values ($1::date, $2, $3, $4, $5, $6)`,
          [r.day, r.bu, r.phase, r.started, r.requests, r.positions],
        );
      }
    });
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
  return rows.length;
}

/** ยอดรายวันของช่วง (อ่านอย่างเดียว) · `buSet` null = ทุก BU · ตารางยังไม่มี = [] */
export async function loadRequestDaily(opts: { from: string; to: string; buSet: readonly string[] | null }): Promise<RequestDailyRow[]> {
  try {
    const { rows } = await dbQuery<RequestDailyRow & { day: string }>(
      `select to_char(day, 'YYYY-MM-DD') as day, bu, phase, started, requests, positions from ${table}
        where day between $1::date and $2::date and ($3::text[] is null or bu = any($3::text[]))
        order by day`,
      [opts.from, opts.to, opts.buSet],
    );
    return rows.map((r) => ({ ...r, requests: Number(r.requests), positions: Number(r.positions) }));
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

const EVERY_MS = 60 * 60_000;
let running = false;
let stopped = false;

export function startRequestDailySnapshotWorker(loadOpen: () => Promise<StuckRequest[]>): boolean {
  if ((process.env.REQUEST_DAILY_SNAPSHOT_ENABLED || '').trim().toLowerCase() === 'false') return false;
  if (running) return true;
  running = true;
  stopped = false;
  void (async () => {
    // หน่วงตอนบูตให้ส่วนอื่นขึ้นก่อน
    await new Promise<void>((r) => {
      const t = setTimeout(r, 2 * 60_000);
      t.unref?.();
    });
    while (!stopped) {
      try {
        const n = await runRequestDailySnapshotOnce(loadOpen);
        logInfo('requestDailySnapshot.saved', { rows: n });
      } catch (e) {
        logError('requestDailySnapshot', e);
      }
      await new Promise<void>((r) => {
        const t = setTimeout(r, EVERY_MS);
        t.unref?.();
      });
    }
    running = false;
  })();
  return true;
}

export function stopRequestDailySnapshotWorker(): void {
  stopped = true;
}

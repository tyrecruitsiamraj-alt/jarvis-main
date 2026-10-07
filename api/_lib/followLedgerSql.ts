/**
 * ═══ สมุดบัญชีติดตาม — โหลดสายกับรายการจาก audit (หน้าหลัก `?ledger=follow` · 7 ต.ค. 2569) ═══
 * สายชุดเดียวกับการ์ด (ไม่รวมดูแลหลังเริ่มงาน · BU เดียวกัน) · หมวดจาก `categorizeFollowRows` · ไม่ส่งเบอร์
 * ยอดคิดที่ `src/lib/followLedger.ts` (pure) — ที่นี่แค่บอกว่าแต่ละสายเข้า/ส่ง/จบเมื่อไหร่ ใครทำ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { categorizeFollowRows, FOLLOW_ENTRY_CATEGORY_COLS, FOLLOW_QUEUE_CALL_COLS } from './followCategory.js';
import { followBuJoin, followBuSql } from './homeBuSql.js';
import { FOLLOW_QUEUE_MATCH } from './homeAiShareSql.js';
import { AFTERCARE_TOPIC } from '../../src/lib/aftercareRounds.js';
import { FOLLOW_TEAM_REPLACEMENT } from '../../src/lib/followReplacement.js';
import { journeyResultOf } from '../../src/lib/followJourney.js';
import { exitTime, type LedgerCall, type LedgerNote } from '../../src/lib/followLedger.js';

const FOLLOW_TABLE = tableInAppSchema('follow_entries');
const QUEUE_TABLE = tableInAppSchema('lumos_dispatch_queue');
const AUDIT_TABLE = tableInAppSchema('audit_logs');

const NOTE_ACTIONS: Record<string, LedgerNote['kind']> = {
  'follow.update': 'edit',
  'follow.schedule.replace': 'reschedule',
  'follow.reopen': 'reopen',
  'follow.staff_call_clear': 'staffClear',
  'irecruit_replace_sync.edit': 'irecruitEdit',
};

const iso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function loadFollowLedger(
  start: Date | null,
  end: Date | null,
  bu: string | null,
): Promise<{ calls: LedgerCall[]; notes: LedgerNote[] }> {
  const { rows } = await dbQuery<Record<string, unknown>>(
    `select ${FOLLOW_ENTRY_CATEGORY_COLS}, f.call_mode, f.follow_team, f.unit_name,
            f.created_at, f.created_by_name, f.staff_called_by_name, f.updated_at as entry_updated_at,
            ${followBuSql('f')} as ledger_bu,
            q.first_result_at, q.updated_at as queue_updated_at,
            coalesce(q.push_accepted_at, q.pushed_at, q.first_delivered_at) as sent_at,
            ${FOLLOW_QUEUE_CALL_COLS}
       from ${FOLLOW_TABLE} f
       ${followBuJoin('f')}
       left join ${QUEUE_TABLE} q on ${FOLLOW_QUEUE_MATCH}
      where f.topic is distinct from $3::text
        and ($1::timestamptz is null or f.created_at < $1::timestamptz)
        and ($2::text is null or ${followBuSql('f')} = $2::text)`,
    [end ? end.toISOString() : null, bu, AFTERCARE_TOPIC],
  );

  // ใครทำ: ยกเลิก (หน้าติดตาม / ยกเลิกทั้งวันทั้งคน / iRecruit) + รายการที่ไม่กระทบยอด
  const { rows: audits } = await dbQuery<{ action: string; entity_id: string | null; user_name: string | null; new_value: string | null; created_at: unknown }>(
    `select l.action, l.entity_id, l.user_name, l.new_value, l.created_at
       from ${AUDIT_TABLE} l
      where l.action = any($1::text[])
      order by l.created_at`,
    [['follow.cancel', 'irecruit_replace_sync.cancel', ...Object.keys(NOTE_ACTIONS)]],
  );
  const cancelBy = new Map<string, string>();
  const notes: LedgerNote[] = [];
  for (const a of audits) {
    const at = iso(a.created_at);
    const id = text(a.entity_id);
    if (!at || !id) continue;
    if (a.action === 'follow.cancel' || a.action === 'irecruit_replace_sync.cancel') {
      const who = a.action === 'irecruit_replace_sync.cancel' ? 'iRecruit' : (text(a.user_name) ?? 'ระบบ');
      let ids = [id];
      try {
        const v = a.new_value ? (JSON.parse(a.new_value) as { cancelledIds?: unknown }) : null;
        if (Array.isArray(v?.cancelledIds)) ids = v.cancelledIds.map(String);
      } catch {
        /* ค่าไม่ใช่ JSON = สายเดียว */
      }
      for (const x of ids) cancelBy.set(x, who);
      continue;
    }
    const kind = NOTE_ACTIONS[a.action];
    if (kind) notes.push({ callId: id, at, kind, by: kind === 'irecruitEdit' ? 'iRecruit' : text(a.user_name) });
  }

  const derived = categorizeFollowRows(rows);
  const s = start ? start.getTime() : -Infinity;
  const e = end ? end.getTime() : Infinity;
  const noted = new Set(notes.filter((n) => Date.parse(n.at) >= s && Date.parse(n.at) < e).map((n) => n.callId));
  const calls: LedgerCall[] = [];
  for (const r of rows) {
    const id = String(r.id);
    const d = derived.get(id);
    const createdAt = iso(r.created_at);
    if (!d || !createdAt) continue;
    const staffOutcome = text(r.staff_call_outcome);
    const outcome = staffOutcome ?? text(r.call_outcome);
    const result = journeyResultOf(d.category, outcome);
    const fallback = iso(r.queue_updated_at) ?? iso(r.entry_updated_at) ?? createdAt;
    const irecruit = /^irecruit-replace:/.test(String(r.source_ref ?? ''));
    let exit: LedgerCall['exit'] = null;
    if (d.category === 'cancelled') {
      exit = {
        kind: 'cancel',
        at: iso(r.cancelled_at) ?? fallback,
        by: cancelBy.get(id) ?? (irecruit ? 'iRecruit' : 'ระบบ'),
        result,
      };
    } else if (d.category === 'agreed' || d.category === 'lost' || d.category === 'unreachable' || d.category === 'other') {
      exit = staffOutcome
        ? { kind: 'result', at: iso(r.staff_called_at) ?? fallback, by: text(r.staff_called_by_name) ?? 'คนโทร', result }
        : { kind: 'result', at: iso(r.first_result_at) ?? fallback, by: 'AI', result };
    }
    const c: LedgerCall = {
      id,
      name: text(r.recipient_name) ?? '—',
      unit: text(r.unit_name),
      bu: text(r.ledger_bu),
      team: r.follow_team === FOLLOW_TEAM_REPLACEMENT ? 'replacement' : 'main',
      caller: d.caller,
      scheduledAt: iso(r.scheduled_at) ?? createdAt,
      createdAt,
      createdBy: text(r.created_by_name) ?? (irecruit ? 'iRecruit' : null),
      sentAt: d.caller === 'ai' ? iso(r.sent_at) : null,
      exit,
    };
    // สายที่จบก่อนช่วงและไม่มีรายการในช่วง = ไม่ต้องส่ง (ไม่กระทบยกมา/คงเหลือ)
    const out = exitTime(c);
    if (out !== null && out < s && !noted.has(id) && !(c.sentAt && Date.parse(c.sentAt) >= s)) continue;
    calls.push(c);
  }
  return { calls, notes };
}

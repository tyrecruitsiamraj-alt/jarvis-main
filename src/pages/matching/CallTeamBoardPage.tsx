import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import NameAvatar from '@/components/shared/NameAvatar';
import { apiFetch } from '@/lib/apiFetch';
import { parseAppUserList } from '@/lib/userApi';
import type { User } from '@/types';
import {
  dumpCallHoldsForUser,
  fetchTeamCallQueue,
  transferCallHold,
  CALL_RESULT_LABEL,
  EMPTY_TALLY,
  type CallHold,
  type CallResultOutcome,
  type CallResultTally,
} from '@/lib/callHoldsApi';
import { RefreshCw } from 'lucide-react';

/**
 * บอร์ดภาระงานโทรของทีม — เห็นว่าใครถืออะไรค้าง แล้วเกลี่ยงานได้จากที่เดียว
 *
 * ทำ 3 อย่าง: โอนงานรายคน · คืนให้ AI โทรต่อ · เทกองของคนที่ลาป่วย/ลาออกทั้งหมด
 * ทุก action ลง audit log (ดู api/_handlers/matching-call-holds.ts)
 *
 * ⚠️ **เป็น section ไม่ใช่หน้า** — เจ้าของสั่ง 7 ส.ค. 2569 ให้ยุบมารวมกับ "โทรของฉัน"
 * ที่ `/matching/my-calls` หน้าเดียว จึงไม่มี PageHeader ของตัวเอง
 * เส้นทางเดิม `/matching/call-team` ถูกเปลี่ยนเป็น redirect ไว้กัน bookmark เก่าพัง
 *
 * สิทธิ์: API `?team=1` ตอบ 403 ให้คนที่ไม่ใช่ supervisor+ อยู่แล้ว (ยังคงไว้)
 * ส่วนหน้าที่ห่ออยู่จำกัดเป็น admin เท่านั้นตามที่เจ้าของสั่งให้ซ่อนก่อน
 */

const OUTCOME_TONE: Record<CallResultOutcome, ToneKey> = {
  confirmed: 'success',
  declined: 'danger',
  reschedule_requested: 'warn',
  no_answer: 'neutral',
  wrong_person: 'neutral',
};

/** ค้างเกินเท่านี้ = ดองแล้ว ควรทวง/โยกงาน (ล็อกอายุ 1 วัน) */
const STALE_MS = 20 * 60 * 60 * 1000;
/** เพดานที่ถือได้ต่อคน — ตรงกับที่คุยไว้ ใช้คิดความยาวแถบภาระ */
const HOLD_CAP = 10;

type HolderRow = {
  name: string;
  userId: string | null;
  holds: CallHold[];
  staleCount: number;
  oldestMs: number;
};

/** หัวข้อของ section — แทน PageHeader เดิมตอนที่ยังเป็นหน้าแยก */
const SectionHeading: React.FC = () => (
  <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
    <h2 className={cn('text-base font-semibold', DASH.cellStrong)}>ภาระงานโทรของทีม</h2>
    <p className={cn('text-xs', DASH.muted)}>เห็นว่าใครถืออะไรค้าง แล้วเกลี่ยงานได้จากที่เดียว</p>
  </div>
);

export const CallTeamBoardSection: React.FC = () => {
  const [holds, setHolds] = useState<CallHold[]>([]);
  const [tally, setTally] = useState<CallResultTally>(EMPTY_TALLY);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const now = Date.now();

  const load = useCallback(() => {
    setLoading(true);
    void fetchTeamCallQueue().then((data) => {
      setHolds(data.holds);
      setTally(data.tally);
      setForbidden(data.forbidden);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    void apiFetch('/api/app-users')
      .then(async (r) => (r.ok ? parseAppUserList(await r.json()) : []))
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  /**
   * จัดกลุ่มตามคนถือ — `heldByName` เป็นสิ่งเดียวที่ API ส่งกลับ (ไม่ส่ง userId เพื่อไม่ให้รั่ว)
   * จึงจับคู่ชื่อกับรายชื่อผู้ใช้เพื่อได้ userId ที่ใช้เทกอง
   */
  const holders = useMemo<HolderRow[]>(() => {
    const byName = new Map<string, CallHold[]>();
    for (const h of holds) {
      const key = h.heldByName || 'ไม่ทราบผู้ถือ';
      const list = byName.get(key) ?? [];
      list.push(h);
      byName.set(key, list);
    }
    return [...byName.entries()]
      .map(([name, list]) => {
        const match = users.find((u) => u.email === name || u.full_name === name);
        const oldest = Math.min(...list.map((h) => new Date(h.heldAt).getTime()));
        return {
          name,
          userId: match?.id ?? null,
          holds: list,
          staleCount: list.filter((h) => now - new Date(h.heldAt).getTime() >= STALE_MS).length,
          oldestMs: now - oldest,
        };
      })
      .sort((a, b) => b.holds.length - a.holds.length);
  }, [holds, users, now]);

  /** คนที่ยังไม่ถืออะไรเลย — หัวหน้าเห็นว่าใครว่าง */
  const idleUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          (u.role === 'staff' || u.role === 'supervisor') &&
          !holders.some((h) => h.name === u.email || h.name === u.full_name),
      ),
    [users, holders],
  );

  const doTransfer = async (hold: CallHold, toUserId: string) => {
    const target = users.find((u) => u.id === toUserId);
    setBusy(hold.id);
    setError(null);
    setNotice(null);
    try {
      await transferCallHold(hold.id, toUserId, target?.full_name ?? target?.email ?? null);
      setNotice(
        `โอน ${hold.candidateName || hold.candidateRef} ให้ ${target?.full_name || 'ผู้ใช้'} แล้ว — นับเวลาใหม่ 1 วัน`,
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โอนงานไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const doDump = async (row: HolderRow, reason: 'manual' | 'to_ai') => {
    if (!row.userId) {
      setError(`หา user id ของ "${row.name}" ไม่ได้ — เทกองไม่ได้ ให้โอนรายคนแทน`);
      return;
    }
    setBusy(row.name);
    setError(null);
    setNotice(null);
    try {
      const count = await dumpCallHoldsForUser(row.userId, reason);
      setNotice(
        `เทกองของ ${row.name} แล้ว ${count.toLocaleString('th-TH')} คน — ${
          reason === 'to_ai' ? 'คืนให้ AI โทรต่อ' : 'คืนเข้าถังกลางให้คนอื่นกดรับ'
        }`,
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เทกองไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  if (forbidden) {
    return (
      <section className="space-y-3">
        <SectionHeading />
        <div className={cn('rounded-2xl border p-6 text-center', DASH.card)}>
          <p className={cn('text-sm font-semibold', DASH.cellStrong)}>ไม่มีสิทธิ์ดูส่วนนี้</p>
          <p className={cn('mt-1 text-xs', DASH.muted)}>
            ภาระงานโทรของทีมเปิดให้เฉพาะหัวหน้า/แอดมิน — งานโทรของตัวเองดูได้ที่ด้านบน
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <SectionHeading />

      <div className={cn('rounded-2xl border p-4', DASH.card)}>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <p className={DASH.eyebrow}>ถืออยู่รวม</p>
            <p className={cn('font-mono text-3xl font-extrabold tabular-nums', DASH.cellStrong)}>
              {holds.length.toLocaleString('th-TH')}
            </p>
            <p className={cn('text-xs', DASH.muted)}>
              {holders.length.toLocaleString('th-TH')} คนถืออยู่ · ว่าง{' '}
              {idleUsers.length.toLocaleString('th-TH')} คน
            </p>
          </div>
          <div>
            <p className={DASH.eyebrow}>ผลโทรของทีมวันนี้</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(Object.keys(OUTCOME_TONE) as CallResultOutcome[]).map((key) => (
                <span key={key} className={TONE[OUTCOME_TONE[key]].chip}>
                  {CALL_RESULT_LABEL[key]}{' '}
                  <span className="font-mono tabular-nums">
                    {(tally.byOutcome[key] ?? 0).toLocaleString('th-TH')}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
              TONE.neutral.soft,
              TONE.neutral.value,
              TONE.neutral.softHover,
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> รีเฟรช
          </button>
        </div>
      </div>

      {notice ? (
        <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.success.soft, TONE.success.value)}>
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.danger.soft, TONE.danger.value)}>
          {error}
        </p>
      ) : null}

      {loading && holds.length === 0 ? (
        <p className={cn('px-1 text-sm', DASH.muted)}>กำลังโหลด…</p>
      ) : holders.length === 0 ? (
        <div className={cn('rounded-2xl border p-6 text-center', DASH.card)}>
          <p className={cn('text-sm font-semibold', DASH.cellStrong)}>
            ยังไม่มีใครถืองานโทรอยู่
          </p>
          <p className={cn('mt-1 text-xs', DASH.muted)}>
            เจ้าหน้าที่กด “รับไปโทรเอง” ที่หน้า Matching แล้วจะขึ้นที่นี่
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {holders.map((row) => {
            const loadPercent = Math.min(100, Math.round((row.holds.length / HOLD_CAP) * 100));
            const hot = row.staleCount > 0;
            const rowBusy = busy === row.name;
            return (
              <div key={row.name} className={cn('overflow-hidden rounded-2xl border', DASH.card)}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <NameAvatar name={row.name} size="md" />
                  <div className="min-w-0">
                    <p className={cn('text-sm font-semibold', DASH.cellStrong)}>{row.name}</p>
                    <p className={cn('text-[11px]', DASH.muted)}>
                      ถือ {row.holds.length.toLocaleString('th-TH')} คน
                      {hot ? (
                        <span className={cn('ml-1 font-semibold', TONE.danger.value)}>
                          · ค้างเกิน 20 ชม. {row.staleCount.toLocaleString('th-TH')} คน
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {/* แถบภาระ — เทียบกับเพดาน 10 คน/คน */}
                  <div className="min-w-[110px] flex-1">
                    <div className={cn('h-2 overflow-hidden rounded-full', TONE.neutral.soft)}>
                      <div
                        className={cn('h-full rounded-full', hot ? 'bg-red-500' : 'bg-blue-500')}
                        style={{ width: `${loadPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void doDump(row, 'to_ai')}
                      disabled={rowBusy || !row.userId}
                      title={!row.userId ? 'จับคู่ผู้ใช้ไม่ได้ — โอนรายคนแทน' : 'คืนทั้งกองให้ AI โทรต่อ'}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50',
                        TONE.info.soft,
                        TONE.info.value,
                        TONE.info.softHover,
                      )}
                    >
                      คืน AI ทั้งกอง
                    </button>
                    <button
                      type="button"
                      onClick={() => void doDump(row, 'manual')}
                      disabled={rowBusy || !row.userId}
                      title={!row.userId ? 'จับคู่ผู้ใช้ไม่ได้ — โอนรายคนแทน' : 'คืนเข้าถังกลางให้คนอื่นกดรับ'}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50',
                        TONE.warn.soft,
                        TONE.warn.value,
                        TONE.warn.softHover,
                      )}
                    >
                      เทกองเข้าถังกลาง
                    </button>
                  </div>
                </div>

                {/* รายคนที่ถืออยู่ + โอนให้ใครก็ได้ */}
                <div className={cn('border-t', DASH.divider)}>
                  {row.holds.map((hold) => {
                    const stale = now - new Date(hold.heldAt).getTime() >= STALE_MS;
                    return (
                      <div
                        key={hold.id}
                        className={cn(
                          'flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2 last:border-b-0',
                          DASH.divider,
                          stale && TONE.danger.soft,
                        )}
                      >
                        <span className={cn('text-xs font-medium', DASH.cell)}>
                          {hold.candidateName || `#${hold.candidateRef}`}
                        </span>
                        <span className={cn('font-mono text-[11px]', DASH.muted)}>
                          {hold.requestNo || hold.jobId}
                        </span>
                        <span className={cn('text-[11px]', stale ? TONE.danger.value : DASH.muted)}>
                          รับเมื่อ{' '}
                          {new Date(hold.heldAt).toLocaleString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <select
                          aria-label={`โอน ${hold.candidateName || hold.candidateRef} ให้`}
                          defaultValue=""
                          disabled={busy === hold.id}
                          onChange={(e) => {
                            const v = e.target.value;
                            e.currentTarget.value = '';
                            if (v) void doTransfer(hold, v);
                          }}
                          className="ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="">โอนให้…</option>
                          {users
                            .filter((u) => u.email !== row.name && u.full_name !== row.name)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.full_name || u.email}
                              </option>
                            ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {idleUsers.length > 0 ? (
            <div className={cn('rounded-2xl border p-4', DASH.card)}>
              <p className={DASH.eyebrow}>ว่างอยู่ — รับงานได้</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {idleUsers.map((u) => (
                  <span key={u.id} className={TONE.success.chip}>
                    {u.full_name || u.email}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default CallTeamBoardSection;

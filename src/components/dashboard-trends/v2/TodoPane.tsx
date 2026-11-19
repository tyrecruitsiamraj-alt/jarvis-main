/**
 * แผงข้างของการ์ด "ต้องทำ" (เจ้าของ 19 พ.ย. 2569 "กดแล้วให้ทำจากหน้านี้เลย … เด้งกราฟแท่งแยก Bu พอกดไปขึ้นรวมก่อน
 * แล้วกด Bu ไหนก็เป็นของ BU นั้นๆแล้วทำจากหน้านี้ได้เลย")
 * คนชุดเดียวกับเลขบนการ์ด (`?todo=` → `backlogPeople`) · กราฟแท่ง BU + รายชื่อรวมก่อน · กด BU = เหลือ BU นั้น
 * ปุ่มชุดเดียวกับหน้าเดิม ทำทีละแถว (Choice): สนใจรอโทร / ยังไม่มีใครโทร = เก็บไปโทรเอง · ส่ง AI โทร (ยืนยันในแถวก่อนยิงสายจริง)
 * นัดเลยวัน = มา · ไม่มา · ทำแล้วแถวอยู่ที่เดิม เปลี่ยนเป็นผล (ของบนจอไม่ขยับ)
 */
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { applicantWorkLink } from '@/lib/recruitRm';
import { fetchApplicantNames, fetchTodoPeople, type ApplicantNameRow, type TodoBucket } from '@/lib/recruitOverviewApi';
import { chooseApplicationCall, recordAppointmentAttendance } from '@/lib/publicApplicationsApi';
import { friendlyErrorText } from '@/lib/friendlyError';
import { thaiDate } from '@/lib/periodPick';
import { BU_UNKNOWN, pageOf } from '@/lib/recruitAudience';
import { MonthCompareBars } from './MonthCompareBars';
import { Pager, fmt } from './V2Parts';

const ALL = 'ทุก BU';
type RowState = { kind: 'busy' } | { kind: 'confirmAi' } | { kind: 'done'; text: string } | { kind: 'error'; text: string };

export default function TodoPane({ todo, bu, listHref }: { todo: TodoBucket; bu: string | null; listHref: string }) {
  const [people, setPeople] = React.useState<Array<{ id: string; bu: string }> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pick, setPick] = React.useState(ALL);
  const [page, setPage] = React.useState(1);
  const [names, setNames] = React.useState<{ key: string; rows: Map<string, ApplicantNameRow> | null }>({ key: '', rows: null });
  const [state, setState] = React.useState<Record<string, RowState>>({});

  React.useEffect(() => {
    let alive = true;
    setPeople(null);
    setError(null);
    fetchTodoPeople(todo, bu)
      .then((items) => alive && setPeople(items.map((p) => ({ id: p.id, bu: p.bu?.trim() || BU_UNKNOWN }))))
      .catch((e: unknown) => alive && setError(friendlyErrorText(e, 'โหลดรายชื่อไม่ได้')));
    return () => {
      alive = false;
    };
  }, [todo, bu]);

  const groups = React.useMemo(() => {
    const by = new Map<string, number>();
    for (const p of people ?? []) by.set(p.bu, (by.get(p.bu) ?? 0) + 1);
    return [...by.entries()].map(([key, n]) => ({ key, byMonth: { all: n } })).sort((a, b) => b.byMonth.all - a.byMonth.all);
  }, [people]);
  const shown = React.useMemo(() => (people ?? []).filter((p) => pick === ALL || p.bu === pick), [people, pick]);
  const pg = pageOf(shown, page);
  const key = pg.slice.map((p) => p.id).join(',');

  React.useEffect(() => {
    if (!key) return;
    let alive = true;
    setNames({ key, rows: null });
    fetchApplicantNames(key.split(','))
      .then((rows) => alive && setNames({ key, rows: new Map(rows.map((r) => [r.id, r])) }))
      .catch(() => alive && setNames({ key, rows: new Map() }));
    return () => {
      alive = false;
    };
  }, [key]);

  const set = (id: string, s: RowState | null) =>
    setState((cur) => {
      const next = { ...cur };
      if (s) next[id] = s;
      else delete next[id];
      return next;
    });
  const choose = async (id: string, choice: 'manual' | 'ai') => {
    set(id, { kind: 'busy' });
    try {
      const out = await chooseApplicationCall([id], choice);
      set(id, out.done > 0 ? { kind: 'done', text: choice === 'manual' ? 'เก็บไปโทรเองแล้ว' : 'ส่ง AI โทรแล้ว' } : { kind: 'error', text: out.skipped[0]?.reason || 'ทำไม่ได้' });
    } catch (e) {
      set(id, { kind: 'error', text: friendlyErrorText(e, 'ทำไม่สำเร็จ') });
    }
  };
  const attend = async (id: string, appointmentAt: string, result: 'showed' | 'no_show') => {
    set(id, { kind: 'busy' });
    try {
      await recordAppointmentAttendance({ applicationId: id, appointmentAt, result });
      set(id, { kind: 'done', text: result === 'showed' ? 'บันทึก มา แล้ว' : 'บันทึก ไม่มา แล้ว' });
    } catch (e) {
      set(id, { kind: 'error', text: friendlyErrorText(e, 'บันทึกไม่สำเร็จ') });
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!people) return <Skeleton className="h-64 rounded-xl" />;
  const loadingNames = names.key !== key || names.rows === null;

  return (
    <section className="space-y-3" data-testid="v2-todo-pane">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{fmt(people.length)} คน · แยกตาม BU</h3>
        <Button asChild size="xs" variant="ghost">
          <Link to={listHref}>ดูในหน้าผู้สมัคร</Link>
        </Button>
      </div>
      <MonthCompareBars
        groups={groups}
        months={['all']}
        unit="คน"
        seriesName={() => 'คน'}
        onPick={(k) => {
          setPick(k);
          setPage(1);
        }}
        testId="v2-todo-bu-chart"
      />
      <div className="flex flex-wrap items-center gap-2">
        {[{ key: ALL, n: people.length }, ...groups.map((g) => ({ key: g.key, n: g.byMonth.all }))].map((g) => (
          <Button
            key={g.key}
            type="button"
            size="xs"
            variant={pick === g.key ? 'default' : 'outline'}
            onClick={() => {
              setPick(g.key);
              setPage(1);
            }}
          >
            {g.key} {fmt(g.n)}
          </Button>
        ))}
      </div>
      <ul className="divide-y rounded-xl border" data-testid="v2-todo-list">
        {pg.slice.length === 0 ? <li className={cn('px-3 py-3 text-sm', DASH.muted)}>ไม่มีรายการ</li> : null}
        {pg.slice.map((p) => {
          const r = names.rows?.get(p.id);
          const s = state[p.id];
          const sub = loadingNames
            ? [p.bu]
            : [
                p.bu,
                r?.unit_name || r?.job_title || 'ยังไม่ผูกใบขอ',
                todo === 'overdue_now' && r?.appointment_at ? `นัด ${thaiDate(r.appointment_at.slice(0, 10))}` : null,
                r?.claimed_by ? `อยู่กับ ${r.claimed_by}` : 'ยังไม่มีคนเก็บ',
              ];
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0 text-sm">
                <div className="font-medium">{loadingNames ? 'กำลังโหลด…' : r?.full_name || 'ไม่พบชื่อ'}</div>
                <div className={cn('text-xs', DASH.sub)}>{sub.filter(Boolean).join(' · ')}</div>
              </div>
              {/* ปุ่มกับผลอยู่ช่องเดียวกัน — ทำแล้วแถวไม่ขยับ */}
              <div className="flex min-h-8 flex-wrap items-center justify-end gap-1.5">
                {s?.kind === 'done' ? (
                  <span className={cn('text-xs font-medium', TONE.success.value)}>{s.text}</span>
                ) : s?.kind === 'confirmAi' ? (
                  <>
                    <Button type="button" size="xs" onClick={() => void choose(p.id, 'ai')}>
                      ยืนยันส่ง AI โทร
                    </Button>
                    <Button type="button" size="xs" variant="ghost" onClick={() => set(p.id, null)}>
                      ยกเลิก
                    </Button>
                  </>
                ) : (
                  <>
                    {s?.kind === 'error' ? <span className={cn('text-xs', TONE.danger.value)}>{s.text}</span> : null}
                    {todo === 'overdue_now' ? (
                      <>
                        <Button type="button" size="xs" variant="outline" disabled={s?.kind === 'busy' || loadingNames || !r?.appointment_at} onClick={() => r?.appointment_at && void attend(p.id, r.appointment_at, 'showed')}>
                          มา
                        </Button>
                        <Button type="button" size="xs" variant="outline" disabled={s?.kind === 'busy' || loadingNames || !r?.appointment_at} onClick={() => r?.appointment_at && void attend(p.id, r.appointment_at, 'no_show')}>
                          ไม่มา
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" size="xs" variant="outline" disabled={s?.kind === 'busy' || loadingNames} onClick={() => void choose(p.id, 'manual')}>
                          เก็บไปโทรเอง
                        </Button>
                        {/* ส่ง AI ได้เฉพาะใบที่ผูกใบขอ (ใบไม่ผูก = เปิดไปเลือกใบขอที่หน้าผู้สมัคร) */}
                        {!loadingNames && r?.job_id ? (
                          <Button type="button" size="xs" variant="outline" disabled={s?.kind === 'busy'} onClick={() => set(p.id, { kind: 'confirmAi' })}>
                            ส่ง AI โทร
                          </Button>
                        ) : null}
                      </>
                    )}
                    <Button asChild size="xs" variant="ghost">
                      <Link to={applicantWorkLink(p.id)}>
                        <ExternalLink aria-hidden /> เปิด
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Pager {...pg} onPage={setPage} testId="v2-todo-pager" />
    </section>
  );
}

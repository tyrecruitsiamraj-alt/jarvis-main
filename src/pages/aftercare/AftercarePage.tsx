import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { useListPagination } from '@/hooks/useListPagination';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { EM_DASH } from '@/lib/displayFallback';
import { formatYmdDmyBe } from '@/lib/dateTh';
import {
  fetchAftercarePeople,
  moveToAftercare,
  updateAftercare,
  type AftercarePerson,
} from '@/lib/aftercareApi';
import BoardPersonPicker from '@/components/follow/BoardPersonPicker';
import AftercarePlanningCalendar from '@/components/aftercare/AftercarePlanningCalendar';
import { aftercareMissingStartDate } from '@/lib/aftercarePlanning';
import { listFollowEntries, type FollowEntry } from '@/lib/followApi';
import { toYmdBangkok } from '@/lib/dateTh';
import { pickerDisplayName } from '@/lib/boardPickerApi';
import {
  AFTERCARE_TOPIC,
  aftercareRoundsSummary,
  buildAftercareRounds,
} from '@/lib/aftercareRounds';
import { buildFollowPrefillPath } from '@/lib/followPrefill';
import { LoaderCircle, RefreshCw, UserCheck, Users } from 'lucide-react';

/**
 * หน้า **"ดูแลหลังเริ่มงาน"** (Phase 7.3-7.5 · ชื่อหน้าเจ้าของเคาะเอง)
 *
 * คนเข้ามาจากปุ่ม [ย้ายไปดูแลหลังเริ่มงาน] ในกล่อง "โทรครบแล้ว" บนหน้า Follow
 *
 * 🔴 **ไม่ทำระบบโทรใหม่** — ปุ่มตั้งรอบโทรพาไปหน้า Follow พร้อมชื่อ/เบอร์/เรื่อง/หน่วยงาน
 * (โครง follow เดิมทำเรื่องรอบ/ผล/ปฏิทินให้อยู่แล้ว · เพิ่มระบบที่สองคือของสองชุดต้องดูแล)
 * 🔴 **วันเริ่มงานไม่รู้ = บอกตรง ๆ** ว่ายังตั้งรอบไม่ได้ — ห้ามเดาจากวันที่ย้ายเข้ามา
 * ⚠️ ตารางยังไม่ migrate (`migrated: false`) → หน้าเปิดได้และบอกว่ายังว่าง ไม่ใช่จอพัง
 */
const AftercarePage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<AftercarePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrated, setMigrated] = useState(true);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [savingPhone, setSavingPhone] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * เลือกชื่อจากบอร์ด ERP มาเพิ่มเข้าความดูแล (เจ้าของสั่ง 1 ก.ย. 2569:
   * *"เพิ่มให้ดึงชื่อคนเพื่อเอามาโทรจาก erp ทำเหมือนหน้าติดตามที่กดปุ่มมีชื่อให้เลือก"*)
   * 🔴 ใช้ `BoardPersonPicker` **ตัวเดียวกับหน้าติดตาม** — ขอบเขตรายชื่อ/การค้นหา
   * จึงเหมือนกันเป๊ะ ไม่ต้องมีลิสต์คนสองชุดที่วันหนึ่งจะไม่ตรงกัน
   */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  /**
   * สายจริงของงาน "ถามความเป็นอยู่ฯ" — มาจากหน้าติดตาม (หน้านี้ไม่มีระบบโทรของตัวเอง)
   * ⚠️ โหลดไม่ได้ = ปฏิทินยังขึ้นได้ แค่ไม่มีชั้น "สายจริง" · ห้ามทำให้หน้าพังทั้งหน้า
   */
  const [calls, setCalls] = useState<FollowEntry[]>([]);
  const [calMonth, setCalMonth] = useState(() => toYmdBangkok(new Date()).slice(0, 7));

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAftercarePeople(includeClosed)
      .then((d) => {
        setItems(d.items);
        setMigrated(d.migrated !== false);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'โหลดรายชื่อไม่สำเร็จ'))
      .finally(() => setLoading(false));
    /* สายจริงของหัวข้อนี้ — พลาดแล้วปฏิทินยังขึ้นได้ (แค่ไม่มีชั้น "สายจริง") จึงกลืน error */
    listFollowEntries()
      .then((rows) => setCalls(rows.filter((r) => r.topic === AFTERCARE_TOPIC)))
      .catch(() => setCalls([]));
  }, [includeClosed]);

  useEffect(load, [load]);

  /** หมุดเวลาเดียวต่อ render — ทุกแถวคิด "เลยกำหนดไหม" จากจุดเดียวกัน */
  const now = new Date();

  const open = useMemo(() => items.filter((p) => !p.closed_at), [items]);
  const needStartDate = useMemo(() => open.filter((p) => !p.start_date), [open]);
  const overdueCount = useMemo(
    () =>
      open.filter((p) => buildAftercareRounds(p.start_date, now).some((r) => r.overdue)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  const { pageItems, bar } = useListPagination(items);

  const saveStartDate = async (phone: string, value: string) => {
    setSavingPhone(phone);
    setNotice(null);
    try {
      const next = await updateAftercare({ phone, start_date: value || null });
      setItems((cur) => cur.map((p) => (p.phone_e164 === phone ? next : p)));
      setNotice(`บันทึกวันเริ่มงานของ ${next.full_name} แล้ว — ตั้งรอบโทรได้เลย`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingPhone(null);
    }
  };

  const closeCare = async (p: AftercarePerson) => {
    setSavingPhone(p.phone_e164);
    setNotice(null);
    try {
      await updateAftercare({ phone: p.phone_e164, close: true, close_reason: 'ผ่านช่วงดูแลแล้ว' });
      setNotice(`ปิดการดูแล ${p.full_name} แล้ว`);
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'ปิดการดูแลไม่สำเร็จ');
    } finally {
      setSavingPhone(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="ดูแลหลังเริ่มงาน"
        subtitle="คนที่ตามครบแล้วและเริ่มงานจริง — ตั้งรอบโทรถามความเป็นอยู่ 3 / 7 / 30 วัน"
      />

      <div className="mt-4 space-y-3">
        {/* สรุปที่ลงมือได้ (7.5) — ทุกเลขบอกหน่วยและมีทางไปต่อ */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className={cn('rounded-xl border px-3 py-2', TONE.info.soft)}>
            <p className={cn('text-[11px] font-medium', DASH.muted)}>กำลังดูแล</p>
            <p className={cn('text-xl font-bold tabular-nums', TONE.info.num)}>
              {open.length.toLocaleString('th-TH')} คน
            </p>
          </div>
          <div className={cn('rounded-xl border px-3 py-2', needStartDate.length > 0 ? TONE.warn.soft : TONE.neutral.soft)}>
            <p className={cn('text-[11px] font-medium', DASH.muted)}>ยังไม่ระบุวันเริ่มงาน</p>
            <p className={cn('text-xl font-bold tabular-nums', needStartDate.length > 0 ? TONE.warn.num : TONE.success.value)}>
              {needStartDate.length.toLocaleString('th-TH')} คน
            </p>
            <p className={cn('text-[10px]', DASH.muted)}>ตั้งรอบโทรไม่ได้จนกรอกวัน</p>
          </div>
          <div className={cn('rounded-xl border px-3 py-2', overdueCount > 0 ? TONE.danger.soft : TONE.neutral.soft)}>
            <p className={cn('text-[11px] font-medium', DASH.muted)}>เลยรอบที่ควรโทร</p>
            <p className={cn('text-xl font-bold tabular-nums', overdueCount > 0 ? TONE.danger.num : TONE.success.value)}>
              {overdueCount.toLocaleString('th-TH')} คน
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm"
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={adding}
            className="inline-flex min-h-[40px] items-center gap-1.5 px-4 py-2 text-sm touch-manipulation"
          >
            <Users className="h-4 w-4" aria-hidden />
            {adding ? 'กำลังเพิ่ม…' : 'เพิ่มคนจากบอร์ด ERP'}
          </Button>
          <Button variant="secondary" size="sm" type="button" onClick={load} disabled={loading} >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden /> รีเฟรช
          </Button>
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(e) => setIncludeClosed(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            รวมคนที่ปิดการดูแลแล้ว
          </label>
        </div>

        {notice ? (
          <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.info.soft, TONE.info.value)}>{notice}</p>
        ) : null}

        {/* ═══ ปฏิทิน Planning (เจ้าของสั่ง 1 ก.ย. 2569) ═══
            *"ขอเป็นภาพแบบ Planning ให้เห็นว่าแต่ละวันต้องโทรหาใครอะไรยังไงบ้าง"*
            รูปเดียวกับหน้าติดตาม — แถว = คน · คอลัมน์ = วัน */}
        {!loading && open.length > 0 ? (
          <AftercarePlanningCalendar
            people={open}
            calls={calls}
            month={calMonth}
            onMonthChange={setCalMonth}
            missingStartDate={aftercareMissingStartDate(open).length}
            onOpenCell={(row) =>
              navigate(
                buildFollowPrefillPath({
                  name: row.person.full_name,
                  phone: row.person.phone_e164,
                  topic: AFTERCARE_TOPIC,
                  unitName: row.person.unit_name ?? undefined,
                }),
              )
            }
          />
        ) : null}

        {!migrated ? (
          <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.warn.soft, TONE.warn.value)}>
            ยังไม่ได้รัน migration 107 บนฐานนี้ — หน้านี้จะว่างจนรัน (`node scripts/migrate.mjs`)
          </p>
        ) : null}

        {error ? (
          <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.danger.soft, TONE.danger.value)}>
            {error} —{' '}
            <button type="button" onClick={load} className="underline">
              ลองใหม่
            </button>
          </p>
        ) : loading ? (
          <p className={cn('rounded-xl border px-3 py-6 text-center text-sm', DASH.card, DASH.muted)}>
            <LoaderCircle className="mr-1.5 inline h-4 w-4 animate-spin" /> กำลังโหลด…
          </p>
        ) : items.length === 0 ? (
          <div className={cn('rounded-xl border px-4 py-10 text-center', DASH.card)}>
            <UserCheck className={cn('mx-auto h-8 w-8', DASH.muted)} />
            <p className="mt-2 text-sm font-medium text-foreground">ยังไม่มีใครอยู่ในความดูแล</p>
            <p className={cn('mt-1 text-xs', DASH.muted)}>
              คนเข้ามาที่นี่ได้สองทาง — กด "ย้ายไปดูแลหลังเริ่มงาน" จากกล่อง <b>โทรครบแล้ว</b> บนหน้า Follow
              หรือกดเพิ่มเองจากบอร์ด ERP
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setPickerOpen(true)} >
                เพิ่มคนจากบอร์ด ERP
              </Button>
              <Button variant="secondary" size="sm" type="button" onClick={() => navigate('/follow')} >
                ไปหน้า Follow
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="space-y-1.5">
              {pageItems.map((p) => {
                const rounds = buildAftercareRounds(p.start_date, now);
                const busy = savingPhone === p.phone_e164;
                return (
                  <li
                    key={p.phone_e164}
                    className={cn('rounded-xl border px-3 py-2.5 text-sm', DASH.card, p.closed_at ? 'opacity-70' : '')}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0">
                        <b className={DASH.cellStrong}>{p.full_name}</b>
                        <span className={cn('ml-1.5 font-mono text-[11px]', DASH.muted)}>{p.phone_e164}</span>
                        {p.closed_at ? (
                          <span className={cn('ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold', TONE.neutral.chip)}>
                            ปิดการดูแลแล้ว
                          </span>
                        ) : null}
                        <span className={cn('block text-xs', DASH.muted)}>
                          {p.unit_name || EM_DASH}
                          {p.site_code ? ` · ${p.site_code}` : ''}
                          {p.moved_by_name ? ` · ย้ายโดย ${p.moved_by_name}` : ''}
                        </span>
                      </span>
                      {!p.closed_at ? (
                        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy || rounds.length === 0}
                            title={
                              rounds.length === 0
                                ? 'กรอกวันเริ่มงานก่อนจึงตั้งรอบโทรได้'
                                : 'ไปตั้งตารางโทรที่หน้า Follow พร้อมชื่อ/เบอร์/เรื่อง'
                            }
                            onClick={() =>
                              navigate(
                                buildFollowPrefillPath({
                                  name: p.full_name,
                                  phone: p.phone_e164,
                                  topic: AFTERCARE_TOPIC,
                                  unitName: p.unit_name ?? undefined,
                                }),
                              )
                            }
                            className={cn(
                              'inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold disabled:opacity-40',
                              TONE.primary.outline,
                            )}
                          >
                            ตั้งรอบโทรถามความเป็นอยู่
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void closeCare(p)}
                            className={cn(
                              'inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold disabled:opacity-40',
                              TONE.neutral.outline,
                            )}
                          >
                            ปิดการดูแล
                          </button>
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        วันเริ่มงาน
                        <input
                          type="date"
                          defaultValue={p.start_date ?? ''}
                          disabled={busy || !!p.closed_at}
                          onChange={(e) => void saveStartDate(p.phone_e164, e.target.value)}
                          className="jarvis-soft-field min-h-[32px] text-xs disabled:opacity-50"
                        />
                        {p.start_date ? (
                          <span className={DASH.muted}>({formatYmdDmyBe(p.start_date)})</span>
                        ) : null}
                      </label>
                      <span
                        className={cn(
                          'text-[11px]',
                          rounds.length === 0
                            ? TONE.warn.value
                            : rounds.some((r) => r.overdue)
                              ? TONE.danger.value
                              : DASH.muted,
                        )}
                      >
                        {aftercareRoundsSummary(rounds)}
                      </span>
                    </div>

                    {rounds.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {rounds.map((r) => (
                          <span
                            key={r.days}
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                              r.overdue ? cn(TONE.danger.soft, TONE.danger.value) : cn(TONE.info.soft, TONE.info.value),
                            )}
                          >
                            {r.label} · {formatYmdDmyBe(r.date)}
                            {r.overdue ? ' (เลยแล้ว)' : ''}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <ListPaginationBar {...bar} />
          </>
        )}
      </div>

      {/* เลือกชื่อจากบอร์ด ERP — ตัวเดียวกับหน้าติดตาม (เจ้าของสั่ง 1 ก.ย. 2569)
          ⚠️ เพิ่มแล้ว **ยังไม่รู้วันเริ่มงาน** ⇒ ตั้งรอบโทรไม่ได้จนกว่าจะกรอกวัน
          (กติกาเดิมของหน้านี้: ห้ามเดาวันเริ่มงานจากวันที่ย้ายเข้ามา) */}
      <BoardPersonPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(person) => {
          setPickerOpen(false);
          const phone = (person.mobile || '').trim();
          if (!phone) {
            setError('คนนี้ไม่มีเบอร์ในบอร์ด — เพิ่มเข้าความดูแลไม่ได้ (คีย์หลักของหน้านี้คือเบอร์)');
            return;
          }
          setAdding(true);
          setError(null);
          setNotice(null);
          void moveToAftercare({
            phone,
            full_name: pickerDisplayName(person),
            /* ⚠️ **ไม่เดาหน่วยงานจาก `area` ของบอร์ด** — นั่นคือ "พื้นที่ที่เขาสะดวก"
               (เช่น "เขตพระโขนง กรุงเทพมหานคร") ไม่ใช่หน่วยงานที่ไปทำงาน
               ปล่อยว่างให้คนกรอกเอง ดีกว่าเติมค่าที่ดูเหมือนจริงแต่ผิด */
            source: 'manual',
          })
            .then((added) => {
              setNotice(
                `เพิ่ม ${added.full_name} เข้าความดูแลแล้ว — กรอกวันเริ่มงานก่อน จึงจะตั้งรอบโทรได้`,
              );
              return load();
            })
            .catch((e: unknown) =>
              setError(e instanceof Error ? e.message : 'เพิ่มเข้าความดูแลไม่สำเร็จ'),
            )
            .finally(() => setAdding(false));
        }}
      />
    </div>
  );
};

export default AftercarePage;

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import SearchField from '@/components/shared/SearchField';
import { Phone, LoaderCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import NameAvatar from '@/components/shared/NameAvatar';
import { DASH, TONE } from '@/lib/designTokens';
import { getTotalPages, type PageSizeOption } from '@/lib/pagination';
import DateRangeCalendarPicker, {
  isYmdInRange,
  type DateRangeYmd,
} from '@/components/shared/DateRangeCalendarPicker';

/**
 * คนของเรา · ตามถังบนบอร์ด — รายชื่อทั้ง 3 ถัง (To do / ไม่มีงาน / Re Use) กดดูทีละถัง
 * เข้าจาก tile บน Matching Dashboard (?bucket=todo|no_job|reuse)
 * รายชื่อเรียงลงมาเป็นแถว (ไม่ใช่การ์ดข้าง ๆ กัน) และกดแถวเพื่อดูรายละเอียดคนได้
 */
type BoardPerson = {
  card_id: number;
  full_name: string;
  nick_name: string | null;
  skills: string | null;
  area: string | null;
  mobile: string | null;
  age: number | null;
  required_salary: number | null;
  last_activity_at: string | null;
  column_label: string | null;
  job1_name: string | null;
  job2_name: string | null;
  application_no: string | null;
  application_date: string | null;
  sex_code: string | null;
  province_name: string | null;
  amphur_name: string | null;
  full_address: string | null;
  site_name: string | null;
  work_place: string | null;
  remarks: string | null;
};

/**
 * ถังบนบอร์ด — สีมาจาก token กลางตามความหมายที่ล็อกไว้ใน designTokens.ts
 * (เดิมเป็นจานสีของหน้านี้เอง ไม่มีคู่ `dark:` เลย ถังทั้ง 4 จึงเป็นพาสเทลสว่างในโหมดมืด)
 *   todo (พร้อมลงงาน) → success · no_job (รอตำแหน่ง) → warn
 *   reuse (คนเก่า) → violet   · in_process (เสนอใบอื่นอยู่) → info
 */
const BUCKETS = [
  {
    key: 'todo',
    match: 'to do',
    title: 'รอลงงาน (To do)',
    desc: 'ผ่านสัมภาษณ์ พร้อมลงงานทันที — AI แมทถังนี้ก่อนเสมอ',
    headCls: TONE.success.value,
    boxCls: TONE.success.soft,
    /** สีแถบสัดส่วน — ใช้ token `dot` เพราะเป็นคลาส bg จริง ประกอบชื่อคลาสเองไม่ได้ (Tailwind purge ไม่เห็น) */
    barCls: TONE.success.dot,
  },
  {
    key: 'no_job',
    match: 'ไม่มีงาน',
    title: 'รองาน (ไม่มีงาน)',
    desc: 'ผ่านคัดเลือกแต่ยังไม่มีตำแหน่งให้ลง — AI ค้นต่อเมื่อ To do ไม่ถึงเป้า',
    headCls: TONE.warn.value,
    boxCls: TONE.warn.soft,
    /** สีแถบสัดส่วน — ใช้ token `dot` เพราะเป็นคลาส bg จริง ประกอบชื่อคลาสเองไม่ได้ (Tailwind purge ไม่เห็น) */
    barCls: TONE.warn.dot,
  },
  {
    key: 'reuse',
    match: 're use',
    title: 'คนเก่า (Re Use)',
    desc: 'เคยผ่านงานมาแล้ว — เลือกส่ง AI โทรเองได้ ไม่เข้า auto (เช็คสถานะก่อนส่ง)',
    headCls: TONE.violet.value,
    boxCls: TONE.violet.soft,
    /** สีแถบสัดส่วน — ใช้ token `dot` เพราะเป็นคลาส bg จริง ประกอบชื่อคลาสเองไม่ได้ (Tailwind purge ไม่เห็น) */
    barCls: TONE.violet.dot,
  },
  {
    key: 'in_process',
    match: 'in process',
    title: 'กำลังเสนอใบอื่น (In process)',
    desc: 'ถูกเสนอกับใบขออื่นอยู่ — เลือกส่งเองได้ ไม่เข้า auto (เช็คก่อนว่าใบเดิมจบแล้วหรือยัง)',
    headCls: TONE.info.value,
    boxCls: TONE.info.soft,
    /** สีแถบสัดส่วน — ใช้ token `dot` เพราะเป็นคลาส bg จริง ประกอบชื่อคลาสเองไม่ได้ (Tailwind purge ไม่เห็น) */
    barCls: TONE.info.dot,
  },
  // สองถังปลายทาง — เจ้าของสั่งเอามาโชว์ด้วย 10 ส.ค. 2569
  // ⚠️ ทั้งคู่ "จบเรื่องแล้ว" ไม่ถูกเอาไปแมท/ส่งโทร — มีไว้ให้เห็นภาพรวมว่าคนไหลไปไหน
  {
    key: 'done',
    match: 'done',
    title: 'ได้งานแล้ว (Done)',
    desc: 'ลงงานเรียบร้อยแล้ว — ไม่เข้าการแมทและไม่ถูกส่งโทร',
    headCls: TONE.primary.value,
    boxCls: TONE.primary.soft,
    /** สีแถบสัดส่วน — ใช้ token `dot` เพราะเป็นคลาส bg จริง ประกอบชื่อคลาสเองไม่ได้ (Tailwind purge ไม่เห็น) */
    barCls: TONE.primary.dot,
  },
  {
    key: 'drop',
    match: 'drop',
    title: 'ตกไป (Drop)',
    desc: 'ไม่ไปต่อแล้ว — เก็บไว้ดูสัดส่วนว่าหลุดไปเท่าไหร่',
    headCls: TONE.danger.value,
    boxCls: TONE.danger.soft,
    /** สีแถบสัดส่วน — ใช้ token `dot` เพราะเป็นคลาส bg จริง ประกอบชื่อคลาสเองไม่ได้ (Tailwind purge ไม่เห็น) */
    barCls: TONE.danger.dot,
  },
] as const;

function personBlob(p: BoardPerson): string {
  return [p.full_name, p.nick_name, p.skills, p.area, p.mobile].filter(Boolean).join(' ').toLowerCase();
}

function sexLabel(code: string | null): string | null {
  const c = (code || '').trim().toUpperCase();
  if (!c) return null;
  if (c === 'M' || c === '1' || c === 'ชาย') return 'ชาย';
  if (c === 'F' || c === '2' || c === 'หญิง') return 'หญิง';
  return c;
}

/**
 * สมัครมากี่วันแล้ว (เจ้าของสั่ง 10 ส.ค. 2569) — นับจาก `application_date` ของ iRecruit
 * ⚠️ ตัดเวลาออกทั้งสองฝั่งก่อนลบ ไม่งั้น "สมัครเมื่อเช้า" กับ "เมื่อวานดึก" จะได้ 0 วันเท่ากัน
 * คืน null เมื่อไม่มีวันที่/อ่านไม่ออก — หน้าเว็บจะไม่โชว์ป้าย ดีกว่าโชว์ "NaN วัน"
 */
function daysSinceApplied(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.floor((startOf(new Date()) - startOf(d)) / 86_400_000);
  return diff >= 0 ? diff : null;
}

/** ป้ายอายุใบสมัคร — ยิ่งนานยิ่งร้อน (เกณฑ์เดียวกับความรู้สึกของทีม: 7/30/90 วัน) */
function appliedAgeTone(days: number): 'success' | 'info' | 'warn' | 'danger' {
  if (days <= 7) return 'success';
  if (days <= 30) return 'info';
  if (days <= 90) return 'warn';
  return 'danger';
}

function thaiDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** แถวข้อมูลใน dialog — ซ่อนแถวที่ไม่มีค่า ไม่ให้เห็นช่องว่างเปล่า */
const DetailRow: React.FC<{ label: string; value: React.ReactNode | null }> = ({ label, value }) =>
  value ? (
    <div className={cn('flex gap-2 border-b py-1.5 last:border-0', DASH.divider)}>
      <span className="w-28 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 flex-1 text-xs', DASH.cell)}>{value}</span>
    </div>
  ) : null;

const OurPeoplePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [people, setPeople] = useState<BoardPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  /** หน้าปัจจุบันของแต่ละถัง (คีย์ = bucket key) — ค้นหาเมื่อไหร่รีเซ็ตทุกถัง */
  const [pageByBucket, setPageByBucket] = useState<Record<string, number>>({});
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  /** เดือนที่กรองอยู่จากปฏิทินวันที่สมัคร (YYYY-MM) — null = ไม่กรอง */
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  /**
   * ช่วงวันแบบละเอียด (เจ้าของสั่ง 22 ส.ค. 2569: *"หน้าผู้สมัครขอเป็นแบบ filter แบบ
   * calendar ที่กดแล้วข้อมูลเปลี่ยนตามวันที่เลือก"*)
   *
   * อยู่คู่กับแท่งเดือนเดิม **ไม่แทนกัน** — แท่งเดือนตอบ "เดือนไหนคนสมัครเยอะ"
   * (เป็นกราฟด้วย) ส่วนปฏิทินตอบ "เอาช่วงนี้" · เลือกอันหนึ่งแล้วอีกอันถูกล้างให้
   * เพื่อไม่ให้เกิดสองตัวกรองซ้อนกันแล้วคนอ่านไม่รู้ว่าเหลือเท่านี้เพราะอะไร
   */
  const [dateRange, setDateRange] = useState<DateRangeYmd | null>(null);
  /** คนที่กดดูรายละเอียดอยู่ */
  const [detail, setDetail] = useState<BoardPerson | null>(null);
  /** ถังที่กดดูอยู่ — โชว์ทีละถัง (ค่าเริ่มจาก ?bucket= เช่น tile บน dashboard) */
  const [activeBucket, setActiveBucket] = useState<string>(() => {
    const b = searchParams.get('bucket');
    return BUCKETS.some((x) => x.key === b) ? (b as string) : 'todo';
  });

  useEffect(() => {
    apiFetch('/api/matching/board-candidates?people=1')
      .then(async (r) => {
        if (!r.ok) throw new Error(`โหลดรายชื่อไม่สำเร็จ (HTTP ${r.status})`);
        const d = (await r.json()) as { people?: BoardPerson[] };
        setPeople(d.people ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'โหลดรายชื่อไม่สำเร็จ'));
  }, []);

  /**
   * ปฏิทินจากวันที่สมัคร (เจ้าของสั่ง 10 ส.ค. 2569) — 12 เดือนล่าสุดที่มีคนสมัครจริง
   * กดเดือน = กรองรายชื่อทุกถังเหลือเฉพาะคนที่สมัครเดือนนั้น · กดซ้ำ = ปลด
   * แพตเทิร์นเดียวกับแท่งเดือนบน Dashboard (เดือนที่เลือกเข้ม เดือนอื่นหรี่)
   */
  const monthOptions = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of people ?? []) {
      const d = p.application_date ? new Date(p.application_date) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      count.set(ym, (count.get(ym) ?? 0) + 1);
    }
    return [...count.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 12)
      .reverse()
      .map(([ym, n]) => ({ ym, n }));
  }, [people]);
  const maxMonth = Math.max(...monthOptions.map((m) => m.n), 0);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const filtered = (people ?? []).filter((p) => {
      if (terms.length > 0 && !terms.every((t) => personBlob(p).includes(t))) return false;
      if (dateRange) {
        // ไม่รู้วันสมัคร = ตกออกเมื่อกรองวัน (เหมือนหน้ารายชื่อผู้สมัคร)
        const ymd = (p.application_date || '').slice(0, 10);
        if (!isYmdInRange(/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null, dateRange)) return false;
      }
      if (!activeMonth) return true;
      const d = p.application_date ? new Date(p.application_date) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === activeMonth;
    });
    return BUCKETS.map((b) => ({
      ...b,
      items: filtered.filter((p) => (p.column_label || '').trim().toLowerCase() === b.match),
    }));
  }, [people, query, activeMonth, dateRange]);

  const setQueryAndResetPages = (q: string) => {
    setQuery(q);
    setPageByBucket({});
  };

  return (
    <div className="relative">
      {/* ช่องค้นหาอยู่แถวเดียวกับหัวเรื่องแบบหน้า Dashboard (เจ้าของสั่ง 10 ส.ค. 2569) */}
      <PageHeader
        title="ผู้สมัคร"
        subtitle="คนของเราแยกตามถังบนบอร์ด"
        actions={
          <SearchField
            value={query}
            onChange={(e) => setQueryAndResetPages(e.target.value)}
            placeholder="ค้นชื่อ / สกิล / พื้นที่ / เบอร์"
            wrapperClassName="w-full sm:w-[22rem]"
          />
        }
      />
      <div className="px-4 md:px-6 space-y-4 pb-8">

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!people && !error ? (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" aria-hidden /> กำลังโหลดรายชื่อ…
          </p>
        ) : null}

        {/* ปฏิทินวันที่สมัคร — กดเดือนเพื่อกรองรายชื่อทุกถัง (เจ้าของสั่ง 10 ส.ค. 2569)
            แพตเทิร์นเดียวกับแท่งเดือนบน Dashboard: เดือนที่เลือกเข้ม เดือนอื่นหรี่ กดซ้ำเพื่อปลด */}
        {people && monthOptions.length > 0 ? (
          <div className={cn('rounded-2xl border p-3', DASH.card)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={DASH.eyebrow}>ปฏิทินวันที่สมัคร · 12 เดือนล่าสุด</p>
              {/* เลือกช่วงวันละเอียด (เจ้าของสั่ง 22 ส.ค. 2569) — เลือกแล้วล้างเดือนที่ติ๊กไว้
                  ไม่ให้สองตัวกรองซ้อนกันจนคนอ่านไม่รู้ว่าเหลือเท่านี้เพราะอะไร */}
              <DateRangeCalendarPicker
                value={dateRange}
                onChange={(next) => {
                  setDateRange(next);
                  if (next) setActiveMonth(null);
                  setPageByBucket({});
                }}
              />
              {activeMonth ? (
                <button
                  type="button"
                  onClick={() => setActiveMonth(null)}
                  className={cn('text-[11px] font-semibold underline', TONE.info.value)}
                >
                  ล้างตัวกรองเดือน
                </button>
              ) : (
                <p className={cn('text-[11px]', DASH.muted)}>กดเดือนเพื่อดูเฉพาะคนที่สมัครเดือนนั้น</p>
              )}
            </div>
            <div className="mt-2 flex items-end gap-1.5">
              {monthOptions.map((m) => {
                const active = activeMonth === m.ym;
                const [yy, mm] = m.ym.split('-');
                return (
                  <button
                    key={m.ym}
                    type="button"
                    onClick={() => {
                      // กดเดือน = ล้างช่วงวัน (สมมาตรกับข้างบน — ให้เหลือตัวกรองวันเดียวเสมอ)
                      setActiveMonth(active ? null : m.ym);
                      setDateRange(null);
                      setPageByBucket({});
                    }}
                    aria-pressed={active}
                    title={`${m.ym} · สมัคร ${m.n.toLocaleString('th-TH')} คน`}
                    className="flex min-w-0 flex-1 flex-col items-center gap-1"
                  >
                    <span className="flex h-14 w-full items-end">
                      <span
                        className={cn(
                          'w-full rounded-t-[5px] rounded-b-sm transition-all',
                          active ? TONE.primary.dot : 'bg-slate-300 dark:bg-slate-600',
                          activeMonth && !active && 'opacity-30',
                        )}
                        style={{ height: `${Math.max(8, Math.round((m.n / Math.max(maxMonth, 1)) * 100))}%` }}
                      />
                    </span>
                    <span
                      className={cn(
                        'w-full truncate text-center text-[10px] tabular-nums',
                        active ? cn('font-bold', TONE.primary.value) : DASH.muted,
                      )}
                    >
                      {mm}/{yy.slice(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* แท็บถัง — กดดูทีละถัง */}
        {people ? (
          /* visual control ของถัง (เจ้าของสั่ง 10 ส.ค. 2569) — ไม่ใช่ชิปตัวเลขเปล่า:
             แต่ละถังมีเลขใหญ่ + % ของทั้งหมด + แถบสัดส่วน กวาดตาแล้วรู้ทันทีว่าถังไหนหนา
             ถังที่กดอยู่เข้มและมีวงแหวน ถังอื่นเรียบ (แพตเทิร์นเดียวกับแท่งเดือนบน Dashboard) */
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {grouped.map((b) => {
              const total = grouped.reduce((sum, x) => sum + x.items.length, 0);
              const pct = total > 0 ? Math.round((b.items.length / total) * 100) : 0;
              const active = activeBucket === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setActiveBucket(b.key)}
                  title={`${b.title} — ${b.desc}`}
                  aria-pressed={active}
                  className={cn(
                    'rounded-2xl border px-3 py-2.5 text-left transition-all',
                    active
                      ? cn(b.boxCls, 'ring-2 ring-offset-1 ring-offset-transparent')
                      : cn(TONE.neutral.soft, TONE.neutral.softHover, 'opacity-70 hover:opacity-100'),
                  )}
                >
                  <div className={cn('truncate text-[11px] font-medium', active ? b.headCls : TONE.neutral.value)}>
                    {b.title}
                  </div>
                  <div className={cn('mt-0.5 text-2xl font-bold leading-none tabular-nums', active ? b.headCls : TONE.neutral.value)}>
                    {b.items.length.toLocaleString('th-TH')}
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className={cn('h-full rounded-full', active ? b.barCls : 'bg-slate-400')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{pct}% ของทั้งหมด</div>
                </button>
              );
            })}
          </div>
        ) : null}

        {grouped
          .filter((bucket) => bucket.key === activeBucket)
          .map((bucket) => {
            const totalPages = getTotalPages(bucket.items.length, pageSize);
            const page = Math.min(pageByBucket[bucket.key] ?? 1, totalPages);
            const start = (page - 1) * pageSize;
            const pageItems = bucket.items.slice(start, start + pageSize);
            const goTo = (next: number) => {
              setPageByBucket((prev) => ({
                ...prev,
                [bucket.key]: Math.min(Math.max(next, 1), totalPages),
              }));
              window.scrollTo({ top: 0 });
            };
            return (
              <div
                key={bucket.key}
                className={cn('glass-card rounded-[1.5rem] border p-3 md:p-4 space-y-2.5', bucket.boxCls)}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className={cn('text-sm font-semibold', bucket.headCls)}>
                    {bucket.title} · {bucket.items.length} คน
                  </h3>
                  <p className="text-[11px] text-muted-foreground">{bucket.desc}</p>
                </div>
                {bucket.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {query.trim() ? 'ไม่พบตามคำค้นในถังนี้' : 'ไม่มีคนในถังนี้'}
                  </p>
                ) : (
                  <>
                    {/* รายชื่อเรียงลงมาเป็นแถว — กดแถวเพื่อดูรายละเอียด */}
                    <div className="space-y-1.5">
                      {pageItems.map((p) => (
                        // แถวเป็น div (ไม่ใช่ button) เพราะมีลิงก์โทรซ้อนอยู่ข้างใน — ลิงก์ในปุ่มกดไม่ติด
                        <div
                          key={p.card_id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setDetail(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setDetail(p);
                            }
                          }}
                          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/80 bg-white/75 px-3 py-2.5 text-left transition-colors hover:border-blue-300/70 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/60 dark:hover:border-blue-500/50 dark:hover:bg-slate-900"
                        >
                          <NameAvatar name={p.full_name} size="md" />
                          <div className="min-w-0 flex-1">
                            <p className={cn('truncate text-sm', DASH.cellStrong, 'font-semibold')}>
                              {p.full_name}
                              {p.nick_name ? (
                                <span className="font-normal text-muted-foreground"> ({p.nick_name})</span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {p.skills || 'ไม่ระบุสกิล'}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
                              {/* สมัครมากี่วันแล้ว — ยิ่งนานยิ่งร้อน (เจ้าของสั่ง 10 ส.ค. 2569) */}
                              {(() => {
                                const d = daysSinceApplied(p.application_date);
                                if (d == null) return null;
                                return (
                                  <span
                                    className={cn('font-semibold', TONE[appliedAgeTone(d)].value)}
                                    title={`วันที่สมัคร ${thaiDate(p.application_date) ?? '—'}`}
                                  >
                                    สมัครมา {d.toLocaleString('th-TH')} วัน
                                  </span>
                                );
                              })()}
                              {p.area ? <span>{p.area}</span> : null}
                              {p.age ? <span>อายุ {p.age}</span> : null}
                              {p.required_salary ? (
                                <span>ขอ {p.required_salary.toLocaleString()} บ.</span>
                              ) : null}
                            </div>
                          </div>
                          {p.mobile ? (
                            <a
                              href={`tel:${p.mobile}`}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(TONE.info.chip, 'shrink-0 hover:underline')}
                            >
                              <Phone className="h-2.5 w-2.5" /> {p.mobile}
                            </a>
                          ) : null}
                          <ChevronRight className="h-4 w-4 shrink-0 text-blue-500" aria-hidden />
                        </div>
                      ))}
                    </div>
                    <ListPaginationBar
                      page={page}
                      pageSize={pageSize}
                      totalItems={bucket.items.length}
                      totalPages={totalPages}
                      pageFrom={start + 1}
                      pageTo={start + pageItems.length}
                      onPageChange={goTo}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPageByBucket({});
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}
      </div>

      {/* รายละเอียดคน — ข้อมูลจากบอร์ด iRecruit ที่ API ส่งมาพร้อมรายชื่อแล้ว */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {detail?.full_name}
              {detail?.nick_name ? (
                <span className="font-normal text-muted-foreground"> ({detail.nick_name})</span>
              ) : null}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detail?.column_label ? `อยู่ถัง ${detail.column_label}` : 'รายละเอียดผู้สมัคร'}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3">
              <div className={cn(DASH.card, 'px-3 py-2')}>
                <DetailRow label="ตำแหน่งที่คัดไว้" value={detail.job1_name} />
                <DetailRow label="ตำแหน่งสำรอง" value={detail.job2_name} />
                <DetailRow label="เงินเดือนที่ขอ" value={detail.required_salary ? `${detail.required_salary.toLocaleString()} บาท` : null} />
                <DetailRow label="อายุ" value={detail.age ? `${detail.age} ปี` : null} />
                <DetailRow label="เพศ" value={sexLabel(detail.sex_code)} />
                <DetailRow
                  label="เบอร์โทร"
                  value={
                    detail.mobile ? (
                      <a href={`tel:${detail.mobile}`} className={cn('font-medium hover:underline', TONE.info.value)}>
                        {detail.mobile}
                      </a>
                    ) : null
                  }
                />
                <DetailRow label="พื้นที่" value={detail.area} />
                <DetailRow label="ที่อยู่" value={detail.full_address} />
                <DetailRow label="ไซต์งานเดิม" value={detail.site_name} />
                <DetailRow label="สถานที่ทำงาน" value={detail.work_place} />
                <DetailRow label="เลขใบสมัคร" value={detail.application_no} />
                <DetailRow label="วันที่สมัคร" value={thaiDate(detail.application_date)} />
                <DetailRow label="อัปเดตล่าสุด" value={thaiDate(detail.last_activity_at)} />
                <DetailRow label="หมายเหตุ" value={detail.remarks} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                ข้อมูลอ่านจากบอร์ด iRecruit — แก้ไขที่ระบบ iRecruit เท่านั้น
              </p>
              <div className="flex justify-end gap-2">
                {detail.mobile ? (
                  <a href={`tel:${detail.mobile}`} className="jarvis-btn-primary px-4 py-2">
                    <Phone className="h-3 w-3" /> โทร
                  </a>
                ) : null}
                <button type="button" onClick={() => setDetail(null)} className="jarvis-btn-ghost px-4 py-2">
                  ปิด
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OurPeoplePage;

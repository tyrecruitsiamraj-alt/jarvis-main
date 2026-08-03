import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Phone, Search, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';

/**
 * คนของเรา · ตามถังบนบอร์ด — รายชื่อทั้ง 3 ถัง (To do / ไม่มีงาน / Re Use) แยกกล่องชัด ๆ
 * เข้าจาก tile บน Matching Dashboard (?bucket=todo|no_job|reuse) แล้วเลื่อนมาที่กล่องนั้นให้เลย
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
};

const BUCKETS = [
  {
    key: 'todo',
    match: 'to do',
    title: 'รอลงงาน (To do)',
    desc: 'ผ่านสัมภาษณ์ พร้อมลงงานทันที — AI แมทถังนี้ก่อนเสมอ',
    headCls: 'text-emerald-800',
    boxCls: 'border-emerald-200/80 bg-emerald-50/40',
  },
  {
    key: 'no_job',
    match: 'ไม่มีงาน',
    title: 'รองาน (ไม่มีงาน)',
    desc: 'ผ่านคัดเลือกแต่ยังไม่มีตำแหน่งให้ลง — AI ค้นต่อเมื่อ To do ไม่ถึงเป้า',
    headCls: 'text-amber-800',
    boxCls: 'border-amber-200/80 bg-amber-50/40',
  },
  {
    key: 'reuse',
    match: 're use',
    title: 'คนเก่า (Re Use)',
    desc: 'เคยผ่านงานมาแล้ว — เลือกส่ง AI โทรเองได้ ไม่เข้า auto (เช็คสถานะก่อนส่ง)',
    headCls: 'text-violet-800',
    boxCls: 'border-violet-200/80 bg-violet-50/40',
  },
] as const;

function personBlob(p: BoardPerson): string {
  return [p.full_name, p.nick_name, p.skills, p.area, p.mobile].filter(Boolean).join(' ').toLowerCase();
}

const PAGE_SIZE = 20;

const OurPeoplePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [people, setPeople] = useState<BoardPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  /** หน้าปัจจุบันของแต่ละกล่อง (คีย์ = bucket key) — ค้นหาเมื่อไหร่รีเซ็ตทุกกล่อง */
  const [pageByBucket, setPageByBucket] = useState<Record<string, number>>({});
  const boxRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrolledRef = useRef(false);

  useEffect(() => {
    apiFetch('/api/matching/board-candidates?people=1')
      .then(async (r) => {
        if (!r.ok) throw new Error(`โหลดรายชื่อไม่สำเร็จ (HTTP ${r.status})`);
        const d = (await r.json()) as { people?: BoardPerson[] };
        setPeople(d.people ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'โหลดรายชื่อไม่สำเร็จ'));
  }, []);

  // เข้าจาก tile บน dashboard → เลื่อนไปกล่องนั้นครั้งเดียวหลังข้อมูลมา
  useEffect(() => {
    if (!people || scrolledRef.current) return;
    const bucket = searchParams.get('bucket');
    if (!bucket) return;
    scrolledRef.current = true;
    // การ์ดหลายร้อยใบ + ระยะไกลหลักหมื่น px — smooth โดน browser ตัดกลางทาง ใช้เลื่อนทันทีแทน
    window.setTimeout(() => {
      requestAnimationFrame(() =>
        boxRefs.current[bucket]?.scrollIntoView({ behavior: 'auto', block: 'start' }),
      );
    }, 250);
  }, [people, searchParams]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const filtered = (people ?? []).filter((p) =>
      terms.length === 0 ? true : terms.every((t) => personBlob(p).includes(t)),
    );
    return BUCKETS.map((b) => ({
      ...b,
      items: filtered.filter((p) => (p.column_label || '').trim().toLowerCase() === b.match),
    }));
  }, [people, query]);

  const setQueryAndResetPages = (q: string) => {
    setQuery(q);
    setPageByBucket({});
  };

  return (
    <div className="relative">
      <PageHeader title="ผู้สมัคร" subtitle="คนของเราแยกตามถังบนบอร์ด — To do · ไม่มีงาน · Re Use" />
      <div className="px-4 md:px-6 space-y-4 pb-8">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQueryAndResetPages(e.target.value)}
            placeholder="ค้นชื่อ / สกิล / พื้นที่ / เบอร์"
            className="jarvis-soft-field pl-10"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!people && !error ? (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" aria-hidden /> กำลังโหลดรายชื่อ…
          </p>
        ) : null}

        {grouped.map((bucket) => {
          const totalPages = Math.max(1, Math.ceil(bucket.items.length / PAGE_SIZE));
          const page = Math.min(pageByBucket[bucket.key] ?? 1, totalPages);
          const pageItems = bucket.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
          const goTo = (next: number) => {
            setPageByBucket((prev) => ({ ...prev, [bucket.key]: Math.min(Math.max(next, 1), totalPages) }));
            boxRefs.current[bucket.key]?.scrollIntoView({ behavior: 'auto', block: 'start' });
          };
          return (
          <div
            key={bucket.key}
            ref={(el) => {
              boxRefs.current[bucket.key] = el;
            }}
            className={cn('glass-card scroll-mt-20 rounded-[1.5rem] border p-3 md:p-4 space-y-2.5', bucket.boxCls)}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={cn('text-sm font-semibold', bucket.headCls)}>
                {bucket.title} · {bucket.items.length} คน
                {totalPages > 1 ? (
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                    แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, bucket.items.length)}
                  </span>
                ) : null}
              </h3>
              <p className="text-[11px] text-muted-foreground">{bucket.desc}</p>
            </div>
            {bucket.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {query.trim() ? 'ไม่พบตามคำค้นในถังนี้' : 'ไม่มีคนในถังนี้'}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {pageItems.map((p) => (
                  <div key={p.card_id} className="rounded-xl border border-white/80 bg-white/75 px-3 py-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {p.full_name}
                      {p.nick_name ? <span className="font-normal text-muted-foreground"> ({p.nick_name})</span> : null}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {p.skills || 'ไม่ระบุสกิล'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
                      {p.area ? <span>{p.area}</span> : null}
                      {p.age ? <span>อายุ {p.age}</span> : null}
                      {p.required_salary ? <span>ขอ {p.required_salary.toLocaleString()} บ.</span> : null}
                      {p.mobile ? (
                        <a
                          href={`tel:${p.mobile}`}
                          className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                        >
                          <Phone className="h-2.5 w-2.5" /> {p.mobile}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {totalPages > 1 ? (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button type="button" disabled={page <= 1} onClick={() => goTo(page - 1)} className="jarvis-btn-ghost">
                  ← ก่อนหน้า
                </button>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  หน้า {page}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => goTo(page + 1)}
                  className="jarvis-btn-ghost"
                >
                  ถัดไป →
                </button>
              </div>
            ) : null}
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default OurPeoplePage;

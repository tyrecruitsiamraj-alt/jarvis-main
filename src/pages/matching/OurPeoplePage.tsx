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
import { TONE } from '@/lib/designTokens';
import { getTotalPages, type PageSizeOption } from '@/lib/pagination';

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
  {
    key: 'in_process',
    match: 'in process',
    title: 'กำลังเสนอใบอื่น (In process)',
    desc: 'ถูกเสนอกับใบขออื่นอยู่ — เลือกส่งเองได้ ไม่เข้า auto (เช็คก่อนว่าใบเดิมจบแล้วหรือยัง)',
    headCls: 'text-sky-800',
    boxCls: 'border-sky-200/80 bg-sky-50/40',
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

function thaiDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** แถวข้อมูลใน dialog — ซ่อนแถวที่ไม่มีค่า ไม่ให้เห็นช่องว่างเปล่า */
const DetailRow: React.FC<{ label: string; value: React.ReactNode | null }> = ({ label, value }) =>
  value ? (
    <div className="flex gap-2 border-b border-slate-100 py-1.5 last:border-0">
      <span className="w-28 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-xs text-foreground">{value}</span>
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
      <PageHeader title="ผู้สมัคร" subtitle="คนของเราแยกตามถังบนบอร์ด — To do · ไม่มีงาน · Re Use · In process" />
      <div className="px-4 md:px-6 space-y-4 pb-8">
        <SearchField
          value={query}
          onChange={(e) => setQueryAndResetPages(e.target.value)}
          placeholder="ค้นชื่อ / สกิล / พื้นที่ / เบอร์"
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!people && !error ? (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" aria-hidden /> กำลังโหลดรายชื่อ…
          </p>
        ) : null}

        {/* แท็บถัง — กดดูทีละถัง */}
        {people ? (
          <div className="flex flex-wrap gap-1.5">
            {grouped.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setActiveBucket(b.key)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  activeBucket === b.key
                    ? cn('font-semibold', b.boxCls, b.headCls)
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {b.title} · {b.items.length}
              </button>
            ))}
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
                            <p className="truncate text-sm font-semibold text-foreground">
                              {p.full_name}
                              {p.nick_name ? (
                                <span className="font-normal text-muted-foreground"> ({p.nick_name})</span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {p.skills || 'ไม่ระบุสกิล'}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
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
              <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
                <DetailRow label="ตำแหน่งที่คัดไว้" value={detail.job1_name} />
                <DetailRow label="ตำแหน่งสำรอง" value={detail.job2_name} />
                <DetailRow label="เงินเดือนที่ขอ" value={detail.required_salary ? `${detail.required_salary.toLocaleString()} บาท` : null} />
                <DetailRow label="อายุ" value={detail.age ? `${detail.age} ปี` : null} />
                <DetailRow label="เพศ" value={sexLabel(detail.sex_code)} />
                <DetailRow
                  label="เบอร์โทร"
                  value={
                    detail.mobile ? (
                      <a href={`tel:${detail.mobile}`} className="font-medium text-sky-700 hover:underline">
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
                <DetailRow label="รหัสการ์ด" value={`#${detail.card_id}`} />
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

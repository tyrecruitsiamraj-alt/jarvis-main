import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react';
import type { JobRequest } from '@/types';
import { fetchSiamrajClosedRequests } from '@/lib/siamrajUnitRequestsApi';
import { jobBoardCardTitle, unitRequestCardSubtitle } from '@/lib/unitRequestDisplay';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { EM_DASH, dashIfEmpty } from '@/lib/displayFallback';
import SearchField from '@/components/shared/SearchField';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { getTotalPages, type PageSizeOption } from '@/lib/pagination';
import { closedRangeForDays } from '@/lib/closedRequestRange';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * แท็บ "ปิดแล้ว" ของบอร์ดรับสมัคร (เจ้าของสั่ง 17 ส.ค. 2569: *"ใบไหนปิดแล้วย้ายงาน
 * ไปหน้าปิดแล้วได้ไหม จะได้รู้ว่ามีใบไหนปิดไปแล้ว"*)
 *
 * ⚠️ **ไม่ได้ "ย้าย" ใบจริง ๆ** — ใบขอปิดแล้วหลุดจากกล่องงานเองอยู่แล้ว เพราะกล่องงาน
 * ถามหาเฉพาะใบที่ยังเปิด (`openStaffingRequestWhere`) แท็บนี้คือ**ที่ที่ใบพวกนั้นไปโผล่**
 * ไม่ใช่การย้ายข้อมูล — ฝั่ง ERP เป็นเจ้าของสถานะ เราไม่เขียนอะไรกลับ
 *
 * ⚠️ ต้องมีช่วงวันที่เสมอ — ใบปิดสะสมย้อนหลังหลายปี ดึงทั้งหมดคือรอเป็นนาที
 * เริ่มที่ 30 วันล่าสุด แล้วให้เลือกช่วงยาวขึ้นเองได้
 *
 * นิยาม "ปิด" ใช้ชุดเดียวกับ KPI ปิดใบขอบน Dashboard (`siamrajSqlServerClosed`)
 * — แจ้งเข้าแล้ว หรือใบถูกปิด/ยกเลิก · เลขจึงตรงกันทั้งสองหน้า
 */

const RANGES = [
  { days: 30, label: '30 วัน' },
  { days: 90, label: '90 วัน' },
  { days: 180, label: '6 เดือน' },
  { days: 365, label: '1 ปี' },
] as const;

const ClosedRequestsPanel: React.FC = () => {
  const navigate = useNavigate();
  const [days, setDays] = useState<number>(30);
  const [rows, setRows] = useState<JobRequest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = closedRangeForDays(days);
      setRows(await fetchSiamrajClosedRequests(from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดใบขอที่ปิดแล้วไม่สำเร็จ');
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const list = rows ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    // ค้นหลายคำ = ต้องเจอทุกคำ (แพตเทิร์นเดียวกับตัวกรองบอร์ด)
    const words = needle.split(/\s+/);
    return list.filter((j) => {
      const hay = [j.request_no, j.unit_name, j.job_description_code_1, j.location_address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [rows, q]);

  const totalPages = getTotalPages(filtered.length, pageSize);
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const closedPositions = useMemo(
    () => filtered.reduce((s, j) => s + (Number(j.position_units) || 0), 0),
    [filtered],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/70 bg-secondary/40 px-3.5 py-2.5 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <CheckCircle2 className={cn('h-4 w-4', TONE.success.value)} />
          ปิดแล้ว {filtered.length.toLocaleString('th-TH')} ใบ
        </span>
        <span className="text-xs text-muted-foreground">
          · รวม {closedPositions.toLocaleString('th-TH')} อัตรา
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => {
                setDays(r.days);
                setPage(1);
              }}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-semibold',
                days === r.days ? TONE.info.solid : TONE.neutral.outline,
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className={cn(
            'ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50',
            TONE.neutral.outline,
          )}
        >
          {loading ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          รีเฟรช
        </button>
      </div>

      <SearchField
        compact
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder="ค้นหาเลขที่ใบขอ, หน่วยงาน, ตำแหน่ง…"
      />

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading && !rows ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">ไม่มีใบขอที่ปิดในช่วงนี้</p>
          <p className="mt-1 text-xs text-muted-foreground">ลองขยายช่วงวันที่ดู</p>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {visible.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => navigateToUnitRequest(j, navigate, { returnTo: '/jobs/board?view=closed' })}
                  className="grid w-full gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-card px-3.5 py-2.5 text-left text-sm hover:bg-accent/40 sm:grid-cols-[1.6fr_1.2fr_auto] sm:items-center"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">
                      {jobBoardCardTitle(j)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {dashIfEmpty(unitRequestCardSubtitle(j))}
                    </span>
                  </span>
                  <span className="min-w-0 text-xs text-muted-foreground">
                    <span className="block truncate font-mono">{j.request_no ?? EM_DASH}</span>
                    <span className="block truncate">
                      ปิด {j.closed_date ? formatYmdDmyBe(j.closed_date) : EM_DASH}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'justify-self-start rounded-full px-2.5 py-0.5 text-xs font-semibold sm:justify-self-end',
                      TONE.success.chip,
                    )}
                  >
                    {(Number(j.position_units) || 0).toLocaleString('th-TH')} อัตรา
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <ListPaginationBar
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filtered.length}
            pageFrom={(currentPage - 1) * pageSize + 1}
            pageTo={Math.min(currentPage * pageSize, filtered.length)}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
};

export default ClosedRequestsPanel;

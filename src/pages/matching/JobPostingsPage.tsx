import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { useListPagination } from '@/hooks/useListPagination';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { DASH, TONE } from '@/lib/designTokens';
import { Copy, Check, ExternalLink } from 'lucide-react';
import {
  listJobPostingRequests,
  updateJobPostingStatus,
  jobPostingStatusLabel,
  jobPostingStatusChip,
  type JobPostingRequest,
  type JobPostingStatus,
  type JobSnapshot,
} from '@/lib/jobPostingRequestsApi';

/**
 * ปุ่มขั้นต่อไปตามประเภทงาน — Scraping ไม่มีสถานะ "โพสแล้ว"
 *
 * 🔴 **ป้ายปุ่มต้องเป็นคำสั่ง ไม่ใช่ชื่อสถานะ** (audit มุมพนักงานใหม่ 26 ส.ค. 2569):
 * เดิมเขียนว่า "โพสแล้ว" / "ตรวจรับแล้ว" / "ได้คนแล้ว" ซึ่งอ่านเหมือน**ป้ายบอกสถานะ
 * ปัจจุบัน** ทั้งที่เป็นปุ่มเปลี่ยนสถานะ · แถมอยู่แถวเดียวกับ "ยกเลิก" ⇒ คนใหม่ไม่กล้ากด
 * หรือกดผิด · เติมคำว่า "บันทึกว่า" ข้างหน้าแล้วอ่านออกทันทีว่าเป็นการกระทำ
 */
function nextStatuses(item: JobPostingRequest): { status: JobPostingStatus; label: string }[] | undefined {
  if (item.status === 'pending') return [
    { status: 'in_progress', label: 'รับไปทำ' },
    { status: 'cancelled', label: 'ยกเลิก' },
  ];
  if (item.status === 'in_progress') return [
    item.request_type === 'scraping'
      ? { status: 'completed', label: 'บันทึกว่าตรวจรับแล้ว' }
      : { status: 'posted', label: 'บันทึกว่าโพสแล้ว' },
    { status: 'cancelled', label: 'ยกเลิก' },
  ];
  if (item.status === 'posted') return [
    { status: 'filled', label: 'บันทึกว่าได้คนแล้ว' },
    { status: 'cancelled', label: 'ยกเลิก' },
  ];
  return undefined;
}

/**
 * แปลรหัสเพศจาก ERP เป็นคำไทย — `M`/`F`/`O` เป็นรหัสดิบที่เคยหลุดขึ้นจอ
 * รหัสที่ไม่รู้จักคืนค่าเดิมไปตามตรง (ห้ามซ่อน ห้ามเดา)
 */
const GENDER_TEXT: Record<string, string> = {
  M: 'ชาย',
  F: 'หญิง',
  O: 'ไม่จำกัดเพศ',
};

function genderText(v: string | null | undefined): string | null {
  const raw = (v ?? '').trim();
  if (!raw) return null;
  return GENDER_TEXT[raw.toUpperCase()] ?? raw;
}

/**
 * ใบนี้เป็นชุดทดลองหรือเปล่า — ดูจาก `job_id` ที่ไม่ได้มาจาก ERP
 * ใบขอจริงมี `job_id` รูป `siamraj-sql:XXX` / `pre:XXX` เสมอ
 * 🔴 ห้ามซ่อนแถวทดลอง — แค่ติดป้าย (ซ่อน = คนที่ตั้งใจสร้างมันหาไม่เจอ)
 */
function isDemoRequest(it: { job_id: string }): boolean {
  const id = String(it.job_id ?? '');
  return !id.startsWith('siamraj-sql:') && !id.startsWith('pre:') && !id.startsWith('sql:');
}

function num(v: number | null | undefined): string | null {
  return v == null || Number.isNaN(Number(v)) ? null : Number(v).toLocaleString('th-TH');
}

/** รายละเอียดใบขอที่แนบมากับคำขอ (job_snapshot) — ให้ทีมปลายทางเห็นครบโดยไม่ต้องต่อ MSSQL */
function SnapshotDetails({ snap }: { snap: JobSnapshot | null }) {
  if (!snap) {
    return (
      <p className={cn('rounded-lg px-2.5 py-1.5 text-[11px]', TONE.neutral.soft, DASH.muted)}>
        คำขอเก่า — ไม่มีรายละเอียดใบขอแนบ (คำขอที่สร้างหลังจากนี้จะแนบให้อัตโนมัติ)
      </p>
    );
  }
  const age =
    snap.age_min != null || snap.age_max != null
      ? `${snap.age_min ?? '—'}–${snap.age_max ?? '—'} ปี`
      : null;
  const rows: { label: string; value: string | null }[] = [
    { label: 'หน่วยงาน', value: snap.unit_name ?? null },
    { label: 'พื้นที่', value: snap.location ?? null },
    { label: 'จำนวน', value: num(snap.qty) ? `${num(snap.qty)} อัตรา` : null },
    { label: 'รายได้', value: num(snap.income) ? `฿${num(snap.income)}` : null },
    /* 🔴 รหัสดิบจาก ERP เคยโผล่ขึ้นจอตรง ๆ เช่น "เพศ: O" — คนใหม่อ่านไม่ออก */
    { label: 'เพศ', value: genderText(snap.gender) },
    { label: 'อายุ', value: age },
    { label: 'เวลาทำงาน', value: snap.work_schedule ?? null },
    { label: 'แผนก', value: snap.department ?? null },
    /* 🔴 วันที่ทั้งระบบเป็น พ.ศ. — ตรงนี้เคยโชว์ ISO ดิบ (2024-05-01) ปนอยู่ที่เดียว */
    { label: 'วันที่ต้องการ', value: snap.required_date ? formatYmdDmyBe(snap.required_date) : null },
    { label: 'หมายเหตุ', value: snap.note ?? null },
  ].filter((r) => r.value);

  if (rows.length === 0) return null;
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-[11px] sm:grid-cols-2',
        TONE.neutral.soft,
      )}
    >
      {rows.map((r) => (
        <div key={r.label} className="flex gap-1.5">
          <dt className={cn('shrink-0', DASH.muted)}>{r.label}:</dt>
          <dd className={cn('min-w-0 break-words', DASH.cellStrong)}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = id;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={id}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono',
        TONE.neutral.soft,
        TONE.neutral.value,
        TONE.neutral.softHover,
      )}
    >
      {copied ? <Check className={cn('h-2.5 w-2.5', TONE.success.value)} /> : <Copy className="h-2.5 w-2.5" />}
      {id.slice(0, 8)}
    </button>
  );
}

/**
 * `embedded` = ถูกวางเป็น **เนื้อของแท็บบนบอร์ดรับสมัคร** (เจ้าของสั่ง 17 ส.ค. 2569
 * ให้ย้ายมารวมที่บอร์ด) — ซ่อนหัวหน้าและปุ่มย้อนกลับ เพราะบอร์ดมีหัวของตัวเองแล้ว
 * สองหัวซ้อนกันคือสิ่งที่ทำให้แท็บอื่นดูไม่เหมือนกัน
 * route เดิม `/matching/job-postings` ยังอยู่เป็นทางถอย (เปิดตรงได้เหมือนเดิม)
 */
const JobPostingsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [rawItems, setRawItems] = useState<JobPostingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | JobPostingStatus>('all');
  const [error, setError] = useState<string | null>(null);
  /**
   * 🔴 **ขอบเขตต้องตรงกับหน้าแรก** (audit มุมพนักงานใหม่ 26 ส.ค. 2569)
   * บอร์ดหน้าแรกนับ "ส่งไปทำ Content · กำลังทำ" **เฉพาะคำขอของใบขอที่ยังเปิดอยู่**
   * ส่วนหน้านี้เดิมนับทุกคำขอ ⇒ หน้าแรกขึ้น 1 แต่หน้านี้ขึ้น 5 (4 ใบที่เกินคือชุดทดลอง)
   * คนใหม่กดจากหน้าแรกมาแล้วเจอคนละเลข สรุปว่าระบบมั่ว
   * ⇒ ค่าตั้งต้นของหน้านี้ = **เฉพาะใบขอที่ยังเปิด** (เท่าหน้าแรก) · สลับดูทั้งหมดได้
   */
  const [openOnly, setOpenOnly] = useState(true);
  const { jobs: openJobs } = useUnitRequestsFeed();

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listJobPostingRequests(filterStatus === 'all' ? undefined : filterStatus);
      setRawItems(data);
    } catch {
      setError('โหลดรายการไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const patchStatus = async (id: string, status: JobPostingStatus) => {
    setError(null);
    try {
      const item = await updateJobPostingStatus(id, status);
      setRawItems((prev) => prev.map((it) => (it.id === item.id ? item : it)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อัปเดตไม่สำเร็จ');
    }
  };

  /** id ของใบขอที่ยังเปิด — รูป `siamraj-sql:XXX` ตรงกับ `job_id` ของคำขอโพสต์ */
  const openIds = useMemo(() => new Set(openJobs.map((j) => String(j.id))), [openJobs]);

  /**
   * รายการที่โชว์จริง — กรองตามขอบเขตก่อนนับทุกอย่าง
   * ⚠️ ยังไม่รู้ชุดใบเปิด (กำลังโหลด) = **ไม่กรอง** ดีกว่ากรองทิ้งจนดูเหมือนไม่มีของ
   */
  const items = useMemo(() => {
    if (!openOnly || openIds.size === 0) return rawItems;
    return rawItems.filter((it) => openIds.has(String(it.job_id)));
  }, [rawItems, openOnly, openIds]);

  const hiddenCount = rawItems.length - items.length;

  const counts = useMemo(() => {
    const c: Record<JobPostingStatus, number> = { pending: 0, in_progress: 0, posted: 0, completed: 0, filled: 0, cancelled: 0 };
    for (const it of items) c[it.status]++;
    return c;
  }, [items]);

  /**
   * แบ่งหน้า (เจ้าของสั่ง 22 ส.ค. 2569) — คำขอสะสมเรื่อย ๆ ไม่มีวันลด
   * ใช้ hook กลางตัวเดียวกับทุกหน้า จึงได้ dropdown ต่อหน้าชุดเดียวกัน
   */
  const { pageItems, bar, resetPage } = useListPagination(items);

  return (
    <div>
      {embedded ? null : (
        <PageHeader
          title="คำขอโพสหางานใหม่"
          subtitle="ใบขอที่หาคนของเราไม่ได้ — ทีมคอนเทนต์/สรรหารับ ID ไปโพสหาคนต่อ"
          backPath="/matching"
        />
      )}
      <div className="px-4 md:px-6 space-y-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            คำขอทั้งหมด {filterStatus === 'all' ? `(${items.length})` : ''}
          </h2>
          {/* สลับขอบเขต — ค่าตั้งต้นตรงกับหน้าแรก · บอกด้วยว่าซ่อนไปกี่ใบ ไม่ให้หายเงียบ */}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => {
                setOpenOnly(e.target.checked);
                resetPage();
              }}
              className="h-3.5 w-3.5 accent-primary"
            />
            เฉพาะใบขอที่ยังเปิดอยู่
            {openOnly && hiddenCount > 0 ? (
              <span className="text-muted-foreground/70">(ซ่อนอยู่ {hiddenCount})</span>
            ) : null}
          </label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as 'all' | JobPostingStatus);
              resetPage(); // เปลี่ยนตัวกรอง = กลับหน้า 1 (ไม่งั้นค้างหน้าที่ไม่มีของ)
            }}
            className="jarvis-soft-field min-h-[40px] text-xs w-auto"
          >
            <option value="all">ทุกสถานะ</option>
            {(['pending', 'in_progress', 'posted', 'completed', 'filled', 'cancelled'] as JobPostingStatus[]).map((s) => (
              <option key={s} value={s}>
                {jobPostingStatusLabel(s)} {filterStatus === 'all' ? `(${counts[s]})` : ''}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-white/80 bg-white/30 px-4 py-8 text-center">
            ยังไม่มีคำขอโพสหางาน — สร้างได้จากหน้า Matching เมื่อใบขอไม่มีคนของเรา
          </p>
        ) : (
          <ul className="space-y-3">
            {pageItems.map((it) => (
              <li key={it.id} className="glass-card rounded-2xl border border-white/70 p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={jobPostingStatusChip(it.status)}>
                    {jobPostingStatusLabel(it.status)}
                  </span>
                  {/* ประเภทงานที่ส่งต่อ — ความหมายล็อกไว้ที่ token: Scraping = teal · ทีมคอนเทนต์ = orange */}
                  <span className={it.request_type === 'scraping' ? TONE.teal.chip : TONE.orange.chip}>
                    {it.request_type === 'scraping' ? 'Scraping' : 'Content'}
                  </span>
                  <CopyIdButton id={it.id} />
                  <span className="text-[11px] text-muted-foreground ml-auto">{formatWhen(it.created_at)}</span>
                </div>
                <h3 className={cn('text-sm', DASH.cellStrong, 'font-semibold')}>
                  {/* 🔴 ชุดทดลองต้องมีป้ายแยก — เดิมปนกับของจริงจนแยกไม่ออก
                      ต้องอ่านเนื้อในถึงจะรู้ (audit มุมพนักงานใหม่ 26 ส.ค. 2569) */}
                  {isDemoRequest(it) ? (
                    <span
                      title="ชุดข้อมูลทดลอง ไม่ใช่ใบขอจริง — ห้ามเอาไปโพสต์หรือติดต่อใคร"
                      className={cn(
                        'mr-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 align-middle text-[10px] font-bold',
                        TONE.warn.chip,
                      )}
                    >
                      ทดลอง
                    </span>
                  ) : null}
                  {it.job_snapshot?.position || 'ตำแหน่งไม่ระบุ'}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  เลขที่ใบขอ: <span className="font-mono">{it.request_no || it.job_id}</span>
                </p>
                <SnapshotDetails snap={it.job_snapshot} />
                {it.reason ? (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{it.reason}</p>
                ) : null}
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                  {it.requested_by_name ? <span>ขอโดย {it.requested_by_name}</span> : null}
                  <a
                    href={`/matching/match?jobId=${encodeURIComponent(it.job_id)}`}
                    className={cn('inline-flex items-center gap-0.5 hover:underline', TONE.primary.value)}
                  >
                    เปิดใบขอ <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                {nextStatuses(it) ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {nextStatuses(it)!.map((n) => (
                      <button
                        key={n.status}
                        type="button"
                        onClick={() => void patchStatus(it.id, n.status)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-[11px] font-medium',
                          n.status === 'cancelled'
                            ? cn(TONE.danger.soft, TONE.danger.value, TONE.danger.softHover)
                            : cn('border-transparent', TONE.primary.solid),
                        )}
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* แถบเลขหน้า — ตัวเดียวกับทุกหน้าในระบบ (10/20/30/40/50) */}
        {!loading && items.length > 0 ? <ListPaginationBar {...bar} /> : null}
      </div>
    </div>
  );
};

export default JobPostingsPage;

import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, FileText, MapPin, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { REQUEST_LEAD_KIND_LABEL, type RequestLeadKind } from '@/lib/requestLeadKind';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import {
  APPLICANT_BUCKET_LABEL,
  APPLICANT_NOT_CALLED,
  EMPTY_REQUEST_FILTER,
  REQUEST_FUNNEL_LABEL,
  districtOf,
  provinceOf,
  requestsOfFunnelKey,
  sortRequests,
  type RequestFunnelKey,
  LEAD_ORDER,
  REQUEST_SECTOR_LABEL,
  REQUEST_SECTOR_UNSET,
  appsOfChannelKey,
  appsOfRequests,
  applicantSuccessRanking,
  buildApplicantChannelRows,
  buildProvinceAreas,
  buildRequestFunnel,
  filterRequestRows,
  isRequestFilterActive,
  requestAreaOptions,
  requestSiteOptions,
  type ApplicantChannelRow,
  type RecruitRequestRow,
  type RequestSector,
  type RequestTabFilter,
} from '@/lib/recruitRequestTab';
import { OverviewCard, SectionError } from './RecruitOverviewParts';

/**
 * แท็บใบขอ ภาพรวมงานสรรหา (เจ้าของ 29 ต.ค. 2569 · แบบร่างที่เจ้าของเคาะ) — ตัวคิดอยู่ `recruitRequestTab.ts` ที่เดียว
 * ตัวกรองบนสุดคุมข้อ 1 · 3 · 4 · `trend` = การ์ดแนวโน้มใบขอเดิม (ไม่กรอง) · `children` = การ์ดที่ย้ายมาจากแท็บกรอกเข้ามา
 */
const ALL = '__all';
const PROVINCES_SHOWN = 8;
const DISTRICTS_SHOWN = 8;

/** กล่องที่กดแล้วขึ้นรายการใบขอ (เจ้าของ 29 ต.ค. 2569 "มันต้องกดแล้วบอกสิ่ว่าใบไหนบ้าง") */
function Tile({
  label,
  value,
  unit,
  sub,
  tone,
  picked,
  onPick,
  testId,
}: {
  label: string;
  value: number;
  unit: string;
  sub: string;
  tone?: 'success' | 'danger' | 'primary';
  picked: boolean;
  onPick: () => void;
  testId: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={picked}
      onClick={onPick}
      className={cn(
        'h-auto flex-col items-stretch justify-start gap-0 whitespace-normal rounded-xl bg-muted/50 p-3 text-left font-normal hover:bg-muted',
        picked && 'ring-2 ring-ring',
      )}
      data-testid={testId}
    >
      <span className={cn('text-xs', DASH.sub)}>{label}</span>
      <span className={cn('text-2xl font-medium tabular-nums', tone ? TONE[tone].num : 'text-foreground')}>
        {fmt(value)}
        <span className={cn('ml-1 text-sm font-normal', DASH.sub)}>{unit}</span>
      </span>
      <span className={cn('text-xs tabular-nums', DASH.sub)}>{sub}</span>
    </Button>
  );
}

/** รายการใบขอของกล่อง/อำเภอที่กด — จำนวนแถว = เลขบนกล่อง · ต้องหามากสุดขึ้นก่อน */
function RequestList({ title, rows, onClose }: { title: string; rows: readonly RecruitRequestRow[]; onClose: () => void }) {
  return (
    <div className="space-y-2 rounded-xl border border-border p-3" data-testid="request-tab-list">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {title} · {fmt(rows.length)} ใบ
        </p>
        <Button type="button" variant="ghost" size="xs" onClick={onClose}>
          <X aria-hidden />
          ปิด
        </Button>
      </div>
      <div className="max-h-96 overflow-auto rounded-lg border border-border">
        <Table className="min-w-[44rem]">
          <TableHeader>
            <TableRow className={DASH.tableHead}>
              <TableHead className="text-xs">ใบขอ</TableHead>
              <TableHead className="text-xs">หน่วยงาน · ตำแหน่ง</TableHead>
              <TableHead className="text-xs">พื้นที่</TableHead>
              <TableHead className="text-right text-xs">ขอ</TableHead>
              <TableHead className="text-right text-xs">หาได้</TableHead>
              <TableHead className="text-right text-xs">ยกเลิก</TableHead>
              <TableHead className={cn('text-right text-xs', TONE.warn.value)}>ต้องหา</TableHead>
              <TableHead className="text-right text-xs">คนกรอก</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className={cn('py-4 text-center text-sm', DASH.sub)}>
                  ไม่มีใบขอ
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((r) => (
              <TableRow key={r.requestNo} data-testid="request-tab-list-row">
                <TableCell className="whitespace-nowrap text-sm tabular-nums">
                  {r.requestNo}
                  <span className={cn('block text-xs', DASH.sub)}>{r.released ? 'ประกาศแล้ว' : 'ยังไม่ประกาศ'}</span>
                </TableCell>
                <TableCell className="text-sm">
                  {r.unitName ?? r.siteName ?? '—'}
                  {r.position ? <span className={cn('block text-xs', DASH.sub)}>{r.position}</span> : null}
                </TableCell>
                <TableCell className="text-sm">
                  {provinceOf(r)}
                  <span className={cn('block text-xs', DASH.sub)}>{districtOf(r)}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.requested)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', TONE.success.value)}>{fmt(r.filled)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', TONE.danger.value)}>{fmt(r.cancelled)}</TableCell>
                <TableCell className={cn('text-right font-medium tabular-nums', TONE.warn.value)}>{fmt(r.remaining)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.applications)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Bar({ value, max, tone }: { value: number; max: number; tone: 'neutral' | 'warn' | 'success' }) {
  return (
    <span className="block h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className={cn('block h-full rounded-full transition-all duration-700 motion-reduce:transition-none', TONE[tone].dot)} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </span>
  );
}

function AreaSelect({ label, value, options, onChange, disabled, testId }: { label: string; value: string | null; options: Array<{ value: string; n: number }>; onChange: (v: string | null) => void; disabled?: boolean; testId: string }) {
  return (
    <div className="flex min-w-36 flex-1 flex-col gap-1">
      <Label className={cn('text-xs font-normal', DASH.sub)}>{label}</Label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)} disabled={disabled}>
        <SelectTrigger className="h-9 text-sm" aria-label={label} data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>ทั้งหมด</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.value} · {fmt(o.n)} ใบ
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * ตัวกรองบนสุดที่ส่งให้การ์ดอื่นของแท็บ (QA 30 ต.ค. 2569 · เจ้าของเลือก "ตัวกรองภาพรวม Online ไปถึงทุกการ์ด")
 * `rows`/`prevRows` = ใบที่ผ่านตัวกรอง (ช่วงนี้/ช่วงก่อน) · `appsOf` = รายชื่อของใบที่ผ่านตัวกรอง (ไม่กรอง = ชุดเดิม)
 */
export type RequestTabScope = {
  active: boolean;
  rows: RecruitRequestRow[] | null;
  prevRows: RecruitRequestRow[] | null;
  appsOf: (list: readonly RecruitAppFact[]) => RecruitAppFact[];
};

/** ชื่อความเร่ง · `unknown` = ใบที่ไม่มีวันต้องการคน */
const leadLabelOf = (k: string) => (k === 'unknown' ? 'ไม่ระบุ' : REQUEST_LEAD_KIND_LABEL[k as RequestLeadKind]);

export default function RequestTab({
  rows,
  prevRows = null,
  rowsError,
  apps,
  trend,
  children,
  scoped,
}: {
  rows: readonly RecruitRequestRow[] | null;
  /** ใบช่วงก่อน — การ์ดแนวโน้มเทียบช่วงก่อนด้วยตัวกรองเดียวกัน */
  prevRows?: readonly RecruitRequestRow[] | null;
  rowsError: string | null;
  /** ใบสมัครที่กรอกในช่วง (cohort) */
  apps: readonly RecruitAppFact[];
  trend: (scope: RequestTabScope) => React.ReactNode;
  children?: (scope: RequestTabScope) => React.ReactNode;
  /**
   * การ์ดที่เปลี่ยนตามตัวกรองบนสุด + ช่องทางที่กดในตาราง "คนที่กรอกมา" (ตำแหน่งที่สมัคร · เหตุผลที่ไม่สำเร็จ)
   * เจ้าของ 29 ต.ค. 2569 "ไม่ได้บอกช่องทางหรอ" → Choice "กดช่องทางในตารางแล้วการ์ดเปลี่ยนตาม" · `channel` = ชื่อแถวที่กด (null = ทุกช่องทาง)
   */
  scoped?: (apps: readonly RecruitAppFact[], channel: string | null) => React.ReactNode;
}) {
  const [f, setF] = useState<RequestTabFilter>(EMPTY_REQUEST_FILTER);
  const active = isRequestFilterActive(f);
  const picked = useMemo(() => (rows ? filterRequestRows(rows, f) : []), [rows, f]);
  const options = useMemo(() => requestAreaOptions(rows ?? [], f), [rows, f]);
  const sites = useMemo(() => requestSiteOptions(rows ?? []), [rows]);
  const funnel = useMemo(() => buildRequestFunnel(picked), [picked]);
  const areas = useMemo(() => buildProvinceAreas(picked), [picked]);
  const pickedPrev = useMemo(() => (prevRows ? filterRequestRows(prevRows, f) : null), [prevRows, f]);
  /** ใบ (ทั้งช่วงนี้และช่วงก่อน) ที่ผ่านตัวกรอง — รายชื่อของการ์ดอื่นกรองด้วยชุดนี้ */
  const scope = useMemo<RequestTabScope>(() => {
    const all = [...picked, ...(pickedPrev ?? [])];
    return {
      active,
      rows: rows ? picked : null,
      prevRows: pickedPrev,
      appsOf: (list) => appsOfRequests(list, active ? all : null),
    };
  }, [active, rows, picked, pickedPrev]);
  const filteredApps = useMemo(() => scope.appsOf(apps), [scope, apps]);
  const appRows = useMemo(() => buildApplicantChannelRows(filteredApps), [filteredApps]);
  /** แถวช่องทางที่กด (คีย์ของ `buildApplicantChannelRows`) · null = ทุกช่องทาง */
  const [channel, setChannel] = useState<{ key: string; name: string } | null>(null);
  const scopedRef = useRef<HTMLDivElement>(null);
  const channelApps = useMemo(() => appsOfChannelKey(filteredApps, channel?.key ?? null), [filteredApps, channel]);
  const set = (patch: Partial<RequestTabFilter>) => setF((cur) => ({ ...cur, ...patch }));
  /** กล่องที่กดดูรายการใบ · null = ไม่ได้กด */
  const [pick, setPick] = useState<RequestFunnelKey | null>(null);
  const togglePick = (k: RequestFunnelKey) => setPick((cur) => (cur === k ? null : k));

  return (
    <div className="space-y-3">
      {/* ─── ตัวกรอง (เจ้าของ 29 ต.ค. 2569): ประเภทงาน · Code Site จากไซต์ที่มีใบขอ · จังหวัด อำเภอ ตำบล ─── */}
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-3" data-testid="request-tab-filters">
        <div className="flex min-w-32 flex-1 flex-col gap-1">
          <Label className={cn('text-xs font-normal', DASH.sub)}>ประเภทงาน</Label>
          <Select value={f.sector ?? ALL} onValueChange={(v) => set({ sector: v === ALL ? null : (v as RequestSector | 'unset') })}>
            <SelectTrigger className="h-9 text-sm" aria-label="ประเภทงาน" data-testid="request-tab-sector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทั้งหมด</SelectItem>
              {(['private', 'government', 'bank'] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {REQUEST_SECTOR_LABEL[s]}
                </SelectItem>
              ))}
              <SelectItem value="unset">{REQUEST_SECTOR_UNSET}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-48 flex-[2] flex-col gap-1">
          <Label className={cn('text-xs font-normal', DASH.sub)}>Code Site</Label>
          <SearchableSelect
            value={f.siteCode ?? ALL}
            onChange={(v) => set({ siteCode: v === ALL ? null : v })}
            options={[
              { value: ALL, label: 'ทั้งหมด' },
              ...sites.map((o) => ({ value: o.value, label: `${o.value} · ${o.name} · ${fmt(o.n)} ใบ`, keywords: `${o.name} ${o.unit}` })),
            ]}
            searchPlaceholder="พิมพ์รหัสหรือชื่อไซต์"
            ariaLabel="Code Site"
            className="h-9 text-sm"
          />
        </div>
        <AreaSelect label="จังหวัด" value={f.province} options={options.provinces} onChange={(v) => set({ province: v, district: null, subdistrict: null })} testId="request-tab-province" />
        <AreaSelect label="อำเภอ" value={f.district} options={options.districts} onChange={(v) => set({ district: v, subdistrict: null })} disabled={!f.province} testId="request-tab-district" />
        <AreaSelect label="ตำบล" value={f.subdistrict} options={options.subdistricts} onChange={(v) => set({ subdistrict: v })} disabled={!f.district} testId="request-tab-subdistrict" />
        {active ? (
          <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setF(EMPTY_REQUEST_FILTER)}>
            <X aria-hidden />
            ล้างตัวกรอง
          </Button>
        ) : null}
      </div>

      {rows === null ? <SectionError message={rowsError ?? 'อ่านใบขอไม่ได้'} /> : null}

      {/* ─── 1. ใบขอเข้ามา ─── */}
      <OverviewCard icon={FileText} title="ใบขอเข้ามา">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="request-tab-funnel">
          <Tile label="ใบขอเข้ามา" value={funnel.total} unit="ใบ" sub={`ขอ ${fmt(funnel.requested)} คน`} picked={pick === 'all'} onPick={() => togglePick('all')} testId="request-tab-total" />
          <Tile label="ยกเลิก" value={funnel.cancelled.requests} unit="ใบ" sub={`ยกเลิก ${fmt(funnel.cancelled.people)} คน`} tone="danger" picked={pick === 'cancelled'} onPick={() => togglePick('cancelled')} testId="request-tab-cancelled" />
          <Tile label="ปิดแล้ว" value={funnel.closed.requests} unit="ใบ" sub={`หาได้ ${fmt(funnel.closed.filled)} คน`} tone="success" picked={pick === 'closed'} onPick={() => togglePick('closed')} testId="request-tab-closed" />
          <Tile label="ดำเนินการสรรหา" value={funnel.active.requests} unit="ใบ" sub={`ต้องหาจริง ${fmt(funnel.active.remaining)} คน`} tone="primary" picked={pick === 'active'} onPick={() => togglePick('active')} testId="request-tab-active" />
        </div>
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="flex justify-between gap-3 text-sm">
            <span>ดำเนินการสรรหา</span>
            <span className="font-medium tabular-nums">{fmt(funnel.active.requests)} ใบ</span>
          </p>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            {(
              [
                [
                  'notReleased',
                  `${fmt(funnel.active.notReleased)} ใบ${funnel.active.notReleasedWithApps.requests ? ` · มีคนกรอก ${fmt(funnel.active.notReleasedWithApps.requests)} ใบ ${fmt(funnel.active.notReleasedWithApps.applications)} คน` : ''}`,
                  'request-tab-not-released',
                ],
                ['releasedNoApps', `${fmt(funnel.active.releasedNoApps)} ใบ`, 'request-tab-released-empty'],
                ['releasedWithApps', `${fmt(funnel.active.releasedWithApps)} ใบ · ${fmt(funnel.active.applications)} คน`, 'request-tab-released-apps'],
              ] as const
            ).map(([k, value, testId]) => (
              <Button
                key={k}
                type="button"
                variant="ghost"
                aria-pressed={pick === k}
                onClick={() => togglePick(k)}
                className={cn('h-auto justify-between gap-2 whitespace-normal rounded-lg bg-muted/50 px-3 py-2 text-left font-normal hover:bg-muted', pick === k && 'ring-2 ring-ring')}
                data-testid={testId}
              >
                <span>{REQUEST_FUNNEL_LABEL[k]}</span>
                <span className="font-medium tabular-nums">{value}</span>
              </Button>
            ))}
          </div>
        </div>
        {pick ? <RequestList title={REQUEST_FUNNEL_LABEL[pick]} rows={requestsOfFunnelKey(picked, pick)} onClose={() => setPick(null)} /> : null}
      </OverviewCard>

      {/* ─── 2. แนวโน้มใบขอ — นับชุดเดียวกับการ์ดบน + ตัวกรอง ─── */}
      {trend(scope)}

      {/* ─── 3. พื้นที่ไหนขาดคน (โน้ตเจ้าของ: กดจังหวัดเห็นอำเภอ · ฉุกเฉิน/ย้อนหลัง/ล่วงหน้า · บอกใบและคน) ─── */}
      <ProvinceCard areas={areas} rows={picked} />

      {/* ─── 4. คนที่กรอกมา แยกช่องทาง ─── */}
      <ApplicantCard
        total={appRows.total}
        groups={appRows.groups}
        pickedKey={channel?.key ?? null}
        onPick={(r) => {
          const off = channel?.key === r.key || r.key === 'total';
          setChannel(off ? null : { key: r.key, name: r.name });
          // การ์ดที่เปลี่ยนอยู่ไกลลงไป — เลื่อนจอไปให้เห็น (QA 30 ต.ค. 2569 "กดแล้วนึกว่าไม่มีอะไรเกิดขึ้น")
          if (!off) requestAnimationFrame(() => scopedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }}
      />

      {children ? children(scope) : null}
      {scoped ? (
        <div ref={scopedRef} className="scroll-mt-20">
          {scoped(channelApps, channel?.name ?? null)}
        </div>
      ) : null}
    </div>
  );
}

function ProvinceCard({
  areas,
  rows,
}: {
  areas: ReturnType<typeof buildProvinceAreas>;
  rows: readonly RecruitRequestRow[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [allDistricts, setAllDistricts] = useState(false);
  /** อำเภอ/ความเร่งที่กดดูใบ (ในจังหวัดที่กางอยู่) · null = ไม่ได้กด (เจ้าของ 29 ต.ค. 2569 "ตรงนี้ก้กดแล้วโชว์ใบขอด้วย") */
  const [detail, setDetail] = useState<{ kind: 'district' | 'lead'; value: string } | null>(null);
  const isDetail = (kind: 'district' | 'lead', value: string) => detail?.kind === kind && detail.value === value;
  const toggleDetail = (kind: 'district' | 'lead', value: string) => setDetail(isDetail(kind, value) ? null : { kind, value });
  const max = Math.max(1, ...areas.map((a) => a.requested));
  const shown = all ? areas : areas.slice(0, PROVINCES_SHOWN);
  return (
    <OverviewCard icon={MapPin} title="พื้นที่ไหนขาดคน">
      <div className={cn('flex flex-wrap gap-4 text-xs', DASH.sub)}>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-sm', TONE.neutral.dot)} aria-hidden />
          ขอมา
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-sm', TONE.warn.dot)} aria-hidden />
          ต้องหาตอนนี้
        </span>
      </div>
      <ul className="space-y-1" data-testid="request-tab-provinces">
        {areas.length === 0 ? <li className={cn('py-3 text-center text-sm', DASH.sub)}>ไม่มีใบขอ</li> : null}
        {shown.map((p) => (
          <li key={p.name}>
            <Button
              type="button"
              variant="ghost"
              className="grid h-auto w-full grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 whitespace-normal rounded-xl px-2 py-2 text-left font-normal"
              aria-expanded={open === p.name}
              onClick={() => {
                setOpen(open === p.name ? null : p.name);
                setDetail(null);
              }}
              data-testid="request-tab-province-row"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm">
                <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open !== p.name && '-rotate-90')} aria-hidden />
                <span className="truncate">{p.name}</span>
              </span>
              <span className="space-y-1">
                <Bar value={p.requested} max={max} tone="neutral" />
                <Bar value={p.remaining} max={max} tone="warn" />
              </span>
              <span className="text-right text-xs tabular-nums">
                <span className="block text-sm text-foreground">
                  {fmt(p.requests)} ใบ · {fmt(p.requested)} คน
                </span>
                <span className={TONE.warn.value}>ต้องหา {fmt(p.remaining)} คน</span>
              </span>
            </Button>
            {open === p.name ? (
              <div className="mb-2 ml-2 space-y-3 rounded-xl bg-muted/40 p-3" data-testid="request-tab-province-detail">
                {/* 3 ความเร่ง + ไม่ระบุ (ใบที่ไม่มีวันต้องการคน) — รวมกัน = ยอดของจังหวัด (QA 30 ต.ค. 2569) */}
                <div className="grid gap-2 sm:grid-cols-4">
                  {[...LEAD_ORDER, 'unknown' as const].map((k) => (
                    <Button
                      key={k}
                      type="button"
                      variant="ghost"
                      aria-pressed={isDetail('lead', k)}
                      onClick={() => toggleDetail('lead', k)}
                      className={cn('h-auto justify-between gap-2 whitespace-normal rounded-lg bg-card px-3 py-2 text-left text-sm font-normal', isDetail('lead', k) && 'ring-2 ring-ring')}
                      data-testid="request-tab-lead"
                    >
                      <span>{leadLabelOf(k)}</span>
                      <span className="tabular-nums">
                        {fmt(p.lead[k].requests)} ใบ · {fmt(p.lead[k].requested)} คน
                      </span>
                    </Button>
                  ))}
                </div>
                <ul className="divide-y divide-border rounded-lg bg-card">
                  {(allDistricts ? p.districts : p.districts.slice(0, DISTRICTS_SHOWN)).map((d) => (
                    <li key={d.name}>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-pressed={isDetail('district', d.name)}
                        onClick={() => toggleDetail('district', d.name)}
                        className={cn('flex h-auto w-full flex-wrap items-center justify-between gap-x-3 gap-y-0.5 whitespace-normal rounded-none px-3 py-2 text-left text-sm font-normal', isDetail('district', d.name) && 'bg-muted')}
                        data-testid="request-tab-district-row"
                      >
                        <span className="min-w-0">{d.name}</span>
                        <span className="ml-auto text-right tabular-nums">
                          {fmt(d.requests)} ใบ · {fmt(d.requested)} คน
                          <span className={cn('ml-2 text-xs', TONE.warn.value)}>ต้องหา {fmt(d.remaining)}</span>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
                {p.districts.length > DISTRICTS_SHOWN ? (
                  <Button type="button" variant="outline" size="xs" onClick={() => setAllDistricts((v) => !v)}>
                    {allDistricts ? 'ซ่อน' : `ดูทั้งหมด ${fmt(p.districts.length)} อำเภอ`}
                  </Button>
                ) : null}
                {detail ? (
                  <RequestList
                    title={`${p.name} · ${detail.kind === 'lead' ? leadLabelOf(detail.value) : detail.value}`}
                    rows={sortRequests(
                      rows.filter((r) => provinceOf(r) === p.name && (detail.kind === 'lead' ? (r.leadKind ?? 'unknown') === detail.value : districtOf(r) === detail.value)),
                    )}
                    onClose={() => setDetail(null)}
                  />
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {areas.length > PROVINCES_SHOWN ? (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setAll((v) => !v)}>
          {all ? 'ซ่อน' : `ดูทั้งหมด ${fmt(areas.length)} จังหวัด`}
        </Button>
      ) : null}
    </OverviewCard>
  );
}

const CALLED_COLS = [
  { key: 'yes', tone: 'success' },
  { key: 'no', tone: 'danger' },
  { key: 'unreached', tone: null },
  { key: 'unclear', tone: null },
  { key: 'staff', tone: null },
] as const;

function ChannelRow({
  r,
  level,
  open,
  onToggle,
  picked,
  onPick,
}: {
  r: ApplicantChannelRow;
  level: 0 | 1 | 2 | 3;
  open?: boolean;
  onToggle?: () => void;
  /** แถวที่กดอยู่ — การ์ดตำแหน่ง/เหตุผลข้างล่างเป็นของช่องทางนี้ */
  picked?: boolean;
  onPick?: () => void;
}) {
  const num = (n: number, cls?: string) => <TableCell className={cn('text-right tabular-nums', cls)}>{fmt(n)}</TableCell>;
  return (
    <TableRow className={cn(level === 0 && 'bg-muted/40 font-medium hover:bg-muted/40', picked && 'bg-muted')} data-testid={`request-tab-channel-${level}`}>
      {/* ชื่อช่องทางค้างซ้ายตอนเลื่อนตาราง (มือถือ · QA 30 ต.ค. 2569) */}
      <TableCell className={cn('sticky left-0 z-10 whitespace-nowrap text-sm', picked || level === 0 ? 'bg-muted' : 'bg-card', level === 2 && 'pl-9', level === 3 && 'pl-14')}>
        <span className="flex items-center gap-1">
          {onToggle ? (
            <Button type="button" variant="ghost" size="iconXs" className="-ml-2" aria-expanded={open} aria-label={open ? `ปิด ${r.name}` : `เปิด ${r.name}`} onClick={onToggle}>
              <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} aria-hidden />
            </Button>
          ) : null}
          {onPick ? (
            <Button type="button" variant="link" size="xs" className={cn('h-auto px-0 py-2 text-foreground', level <= 1 && 'font-medium')} aria-pressed={picked} onClick={onPick}>
              {r.name}
            </Button>
          ) : (
            r.name
          )}
        </span>
      </TableCell>
      {num(r.total, 'font-medium')}
      {num(r.notCalled)}
      {num(r.counts.queued)}
      {num(r.counts.retry)}
      {num(r.called, 'border-l border-border font-medium')}
      {CALLED_COLS.map((c) => (
        <React.Fragment key={c.key}>{num(r.counts[c.key], c.tone ? TONE[c.tone].value : undefined)}</React.Fragment>
      ))}
      <TableCell className="text-right font-medium tabular-nums">{r.yesPct === null ? '—' : `${r.yesPct}%`}</TableCell>
    </TableRow>
  );
}

function ApplicantCard({
  total,
  groups,
  pickedKey,
  onPick,
}: {
  total: ApplicantChannelRow;
  groups: ApplicantChannelRow[];
  pickedKey: string | null;
  onPick: (r: ApplicantChannelRow) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (k: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const rowProps = (r: ApplicantChannelRow) => ({
    r,
    picked: pickedKey === r.key,
    onPick: () => onPick(r),
    ...(r.children?.length ? { open: open.has(r.key), onToggle: () => toggle(r.key) } : {}),
  });
  const ranking = applicantSuccessRanking(groups);
  const rankMax = Math.max(1, ...ranking.map((r) => r.yesPct ?? 0));
  return (
    <OverviewCard icon={Users} title={`คนที่กรอกมา ${fmt(total.total)} คน`}>
      <div className="overflow-x-auto rounded-xl border border-border" data-testid="request-tab-applicants">
        <Table className="min-w-[60rem]">
          <TableHeader>
            <TableRow className={DASH.tableHead}>
              <TableHead className="sticky left-0 z-10 bg-card text-xs">ช่องทาง</TableHead>
              <TableHead className="text-right text-xs">ทั้งหมด</TableHead>
              <TableHead className="text-right text-xs">AI ไม่โทร</TableHead>
              <TableHead className="text-right text-xs">{APPLICANT_BUCKET_LABEL.queued}</TableHead>
              <TableHead className="text-right text-xs">{APPLICANT_BUCKET_LABEL.retry}</TableHead>
              <TableHead className="border-l border-border text-right text-xs">โทรแล้ว</TableHead>
              {CALLED_COLS.map((c) => (
                <TableHead key={c.key} className={cn('text-right text-xs', c.tone && TONE[c.tone].value)}>
                  {APPLICANT_BUCKET_LABEL[c.key]}
                </TableHead>
              ))}
              <TableHead className="text-right text-xs">% สนใจ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ChannelRow {...rowProps(total)} level={0} picked={pickedKey === null} />
            {groups.map((g) => (
              <React.Fragment key={g.key}>
                <ChannelRow {...rowProps(g)} level={1} />
                {open.has(g.key)
                  ? (g.children ?? []).map((c) => (
                      <React.Fragment key={c.key}>
                        <ChannelRow {...rowProps(c)} level={2} />
                        {open.has(c.key) ? (c.children ?? []).map((cc) => <ChannelRow key={cc.key} {...rowProps(cc)} level={3} />) : null}
                      </React.Fragment>
                    ))
                  : null}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2 rounded-xl bg-muted/40 p-3 text-sm" data-testid="request-tab-not-called">
          <p className="font-medium">AI ไม่โทร {fmt(total.notCalled)} คน</p>
          {APPLICANT_NOT_CALLED.map((k) => (
            <p key={k} className="flex justify-between gap-3">
              <span>{APPLICANT_BUCKET_LABEL[k]}</span>
              <span className="text-right tabular-nums">
                {fmt(total.counts[k])}
                {groups
                  .filter((g) => g.counts[k] > 0)
                  .map((g) => ` · ${g.name} ${fmt(g.counts[k])}`)
                  .join('')}
              </span>
            </p>
          ))}
        </div>
        <div className="space-y-2 rounded-xl bg-muted/40 p-3 text-sm" data-testid="request-tab-success">
          <p className="font-medium">ช่องทางไหนได้คนสนใจเยอะ</p>
          {ranking.length === 0 ? <p className={DASH.sub}>ยังไม่มีช่องทางที่โทรครบ 10 คน</p> : null}
          {ranking.map((r) => (
            <p key={r.key} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-2">
              <span className="truncate">{r.name}</span>
              <Bar value={r.yesPct ?? 0} max={rankMax} tone="success" />
              <span className="text-right tabular-nums">
                {r.yesPct}% · {fmt(r.counts.yes)}/{fmt(r.called - r.counts.staff)}
              </span>
            </p>
          ))}
        </div>
      </div>
    </OverviewCard>
  );
}

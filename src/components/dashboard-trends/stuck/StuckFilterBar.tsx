import React from 'react';
import { X } from 'lucide-react';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import {
  EMPTY_REQUEST_FILTER,
  REQUEST_SECTOR_LABEL,
  REQUEST_SECTOR_UNSET,
  isRequestFilterActive,
  requestAreaOptions,
  requestRecruiterOptions,
  requestSiteOptions,
  requestSubtypeOptions,
  type RecruitRequestRow,
  type RequestSector,
  type RequestTabFilter,
} from '@/lib/recruitRequestTab';

const ALL = '__all';

/**
 * ═══ แถบกรองบนสุดของหน้าภาพรวม (ชุดเดียวกับแท็บใบขอเดิม · 4 พ.ย. 2569 "filter ตรงนี้ต้องตอบได้ทั้งหมด") ═══
 * เจ้าหน้าที่สรรหา · ประเภทงาน · งานย่อย · Code Site · จังหวัด · อำเภอ · ตำบล — ตัวเลือกนับจากใบที่เหลือหา (`rows`)
 * ค่าที่เลือกคุมทุกส่วนของหน้า (ใบขอ · รายชื่อ · แหล่งที่มา · พื้นที่ · เทียบเดือน · เหตุผล)
 */
export default function StuckFilterBar({
  rows,
  appRecruiters,
  value,
  onChange,
}: {
  rows: readonly RecruitRequestRow[];
  /** เจ้าหน้าที่ของใบที่มีคนกรอก (รวมใบที่ปิดแล้ว) — ให้เลือกคนที่ไม่มีใบค้างได้ */
  appRecruiters: Iterable<string | null>;
  value: RequestTabFilter;
  onChange: (next: RequestTabFilter) => void;
}) {
  const f = value;
  const set = (patch: Partial<RequestTabFilter>) => onChange({ ...f, ...patch });
  const recruiters = React.useMemo(() => requestRecruiterOptions(rows, appRecruiters), [rows, appRecruiters]);
  const options = React.useMemo(() => requestAreaOptions(rows, f), [rows, f]);
  const sites = React.useMemo(() => requestSiteOptions(rows), [rows]);
  const subtypes = React.useMemo(() => requestSubtypeOptions(rows), [rows]);
  const active = isRequestFilterActive(f);

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/5" data-testid="request-tab-filters">
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <Label className={cn('text-xs font-normal', DASH.sub)}>เจ้าหน้าที่สรรหา</Label>
        <SearchableSelect
          value={f.recruiter ?? ALL}
          onChange={(v) => set({ recruiter: v === ALL ? null : v })}
          options={[{ value: ALL, label: 'ทุกคน' }, ...recruiters.map((o) => ({ value: o.value, label: `${o.label} · ${fmt(o.n)} ใบ` }))]}
          searchPlaceholder="พิมพ์ชื่อเจ้าหน้าที่"
          ariaLabel="เจ้าหน้าที่สรรหา"
          className="h-9 text-sm"
        />
      </div>
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
      <div className="flex min-w-32 flex-1 flex-col gap-1">
        <Label className={cn('text-xs font-normal', DASH.sub)}>งานย่อย</Label>
        <Select value={f.subtype ?? ALL} onValueChange={(v) => set({ subtype: v === ALL ? null : v })} disabled={subtypes.length === 0 && !f.subtype}>
          <SelectTrigger className="h-9 text-sm" aria-label="งานย่อย" data-testid="request-tab-subtype">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทั้งหมด</SelectItem>
            {subtypes.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label} · {fmt(o.n)} ใบ
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-48 flex-[2] flex-col gap-1">
        <Label className={cn('text-xs font-normal', DASH.sub)}>Code Site</Label>
        <SearchableSelect
          value={f.siteCode ?? ALL}
          onChange={(v) => set({ siteCode: v === ALL ? null : v })}
          options={[{ value: ALL, label: 'ทั้งหมด' }, ...sites.map((o) => ({ value: o.value, label: `${o.value} · ${o.name} · ${fmt(o.n)} ใบ`, keywords: `${o.name} ${o.unit}` }))]}
          searchPlaceholder="พิมพ์รหัสหรือชื่อไซต์"
          ariaLabel="Code Site"
          className="h-9 text-sm"
        />
      </div>
      <AreaSelect label="จังหวัด" value={f.province} options={options.provinces} onChange={(v) => set({ province: v, district: null, subdistrict: null })} testId="request-tab-province" />
      <AreaSelect label="อำเภอ" value={f.district} options={options.districts} onChange={(v) => set({ district: v, subdistrict: null })} disabled={!f.province} testId="request-tab-district" />
      <AreaSelect label="ตำบล" value={f.subdistrict} options={options.subdistricts} onChange={(v) => set({ subdistrict: v })} disabled={!f.district} testId="request-tab-subdistrict" />
      {active ? (
        <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => onChange(EMPTY_REQUEST_FILTER)}>
          <X aria-hidden />
          ล้างตัวกรอง
        </Button>
      ) : null}
    </div>
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

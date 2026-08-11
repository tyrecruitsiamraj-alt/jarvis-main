import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import SearchField from '@/components/shared/SearchField';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  REFERRAL_SOURCES,
  REFERRAL_SOURCE_LABEL,
} from '@/lib/publicApplicationsApi';
import { countActiveRmFilters, toggleInList, type RmFilters } from '@/lib/recruitRm';

/**
 * Filter ด้านซ้ายของหน้างานสรรหา (RM)
 *
 * ⚠️ ทุกกลุ่มมาจากฟิลด์ที่**มีจริงในใบสมัคร** — HTML ระบบเดิมมีกลุ่ม "ข้อมูลเจาะจง"
 * 19 ช่องกับ "ประเภทงาน LBD/LBA" ซึ่งเป็นการจัดประเภทของระบบเก่าที่ข้อมูลฝั่งเรา
 * ยังไม่มีให้กรอง — ใส่มาก็เป็น checkbox ที่ติ๊กแล้วไม่มีอะไรเกิดขึ้น
 * จึงแทนด้วยกลุ่มที่กรองได้จริงตอนนี้: ช่องทางสมัคร · จังหวัด · สถานะ
 * (พอฝั่งใบสมัครมีข้อมูลประเภทงานเมื่อไหร่ ค่อยเติมกลุ่มกลับมา — โครงรองรับอยู่แล้ว)
 */

const GroupTitle: React.FC<{ children: React.ReactNode; count?: number }> = ({ children, count }) => (
  <div className="mt-4 flex items-baseline gap-2 first:mt-0">
    <p className={DASH.eyebrow}>{children}</p>
    {count ? (
      <span className={cn('text-[10px] font-semibold', TONE.primary.value)}>เลือก {count}</span>
    ) : null}
  </div>
);

const CheckRow: React.FC<{ label: string; checked: boolean; onToggle: () => void }> = ({
  label,
  checked,
  onToggle,
}) => (
  <label
    className={cn(
      'flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-[12px] leading-snug',
      'hover:bg-slate-100 dark:hover:bg-slate-800',
      checked ? DASH.cellStrong : DASH.cell,
    )}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={onToggle}
      className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-sky-600"
    />
    <span className="min-w-0">{label}</span>
  </label>
);

const RmFilterSidebar: React.FC<{
  filters: RmFilters;
  onChange: (next: RmFilters) => void;
  /** จังหวัดที่มีคนสมัครจริง — คำนวณจากข้อมูลที่โหลดมา (provincesFromApplications) */
  provinces: string[];
}> = ({ filters, onChange, provinces }) => {
  const [provinceSearch, setProvinceSearch] = useState('');
  const activeCount = countActiveRmFilters(filters);

  const shownProvinces = useMemo(() => {
    const q = provinceSearch.trim();
    return q ? provinces.filter((p) => p.includes(q)) : provinces;
  }, [provinces, provinceSearch]);

  const set = <K extends keyof RmFilters>(key: K, value: RmFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <aside className={cn('w-full shrink-0 rounded-2xl border p-3 lg:w-64', DASH.card)}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-sm font-bold', DASH.cellStrong)}>ตัวกรอง</p>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ channels: [], provinces: [], statuses: [] })}
            className="jarvis-btn-ghost"
          >
            ล้าง ({activeCount})
          </button>
        ) : null}
      </div>

      <GroupTitle count={filters.channels.length}>ช่องทางสมัคร</GroupTitle>
      <div className="mt-1 space-y-0.5">
        {REFERRAL_SOURCES.map((c) => (
          <CheckRow
            key={c}
            label={REFERRAL_SOURCE_LABEL[c]}
            checked={filters.channels.includes(c)}
            onToggle={() => set('channels', toggleInList(filters.channels, c))}
          />
        ))}
      </div>

      <GroupTitle count={filters.provinces.length}>จังหวัด</GroupTitle>
      <SearchField
        compact
        value={provinceSearch}
        onChange={(e) => setProvinceSearch(e.target.value)}
        placeholder="ค้นหาจังหวัด…"
        wrapperClassName="mt-1"
        className="text-[12px]"
      />
      <div className="mt-1 max-h-44 space-y-0.5 overflow-y-auto pr-1">
        {shownProvinces.length === 0 ? (
          <p className={cn('px-1.5 py-1 text-[11px]', DASH.muted)}>
            {provinces.length === 0 ? 'ยังไม่มีข้อมูลจังหวัดจากใบสมัคร' : 'ไม่พบจังหวัดที่ค้น'}
          </p>
        ) : (
          shownProvinces.map((p) => (
            <CheckRow
              key={p}
              label={p}
              checked={filters.provinces.includes(p)}
              onToggle={() => set('provinces', toggleInList(filters.provinces, p))}
            />
          ))
        )}
      </div>

      <GroupTitle count={filters.statuses.length}>สถานะใบสมัคร</GroupTitle>
      <div className="mt-1 space-y-0.5">
        {APPLICATION_STATUSES.map((s) => (
          <CheckRow
            key={s}
            label={APPLICATION_STATUS_LABEL[s]}
            checked={filters.statuses.includes(s)}
            onToggle={() => set('statuses', toggleInList(filters.statuses, s))}
          />
        ))}
      </div>
    </aside>
  );
};

export default RmFilterSidebar;

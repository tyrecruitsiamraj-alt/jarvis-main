import React from 'react';
import { bkkWhen } from '@/lib/bkkWhen';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FieldSelect } from '@/components/shared/FieldSelect';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import {
  soFilterBus,
  soFilterGroups,
  soFilterProvinces,
  soFilterSectors,
  soGroupLabel,
  soGroupStatsText,
  soGroupUsable,
  soGroupLinkKey,
  soGroupView,
  type SoOptAccount,
  type SoOptGroup,
} from '@/lib/soScraping';
import type { UnitSector } from '@/lib/unitSector';
import { fbGroupStatOf, fetchFbGroupStats, type FbGroupStats } from '@/lib/recruitPostingsApi';

/** "ลิงก์เรา คลิก 766 · กรอก 167" ยอดทั้งหมดตั้งแต่สร้างลิงก์ (ต่างจากสถิติ 30 วันของ So Scraping ที่นำหน้า) */
const ourStatsText = (st: { clicks: number; apps: number }) => `ลิงก์เรา คลิก ${NUM.format(st.clicks)} · กรอก ${NUM.format(st.apps)}`;

const NUM = new Intl.NumberFormat('th-TH');

/**
 * ═══ เลือกกลุ่ม Facebook ตอน Gen link (เจ้าของ 2 พ.ย. 2569) ═══
 * 4 พ.ย. 2569 "Gen link ทำแบบเดียวกันด้วย" — ตัวเลือกเดียวกับป๊อป Autopost (`SoGroupFilterPicker`):
 * ธุรกิจ → เอกชน/ราชการ → จังหวัด · ขึ้นเฉพาะกลุ่มที่ใช้ได้ (ไม่มีบัญชี = ซ่อนแค่กลุ่มที่แอดมินพัก) · ไม่ติ๊กให้
 */
export default function SoGroupPicker({
  groups,
  jobBu,
  jobSector = null,
  value,
  onChange,
}: {
  groups: readonly SoOptGroup[] | null;
  /** ธุรกิจของใบขอ · null = ไม่รู้ (กล่องลอย) */
  jobBu: string | null;
  /** ราชการ/เอกชนของใบขอ — ค่าตั้งต้นของช่องเลือก */
  jobSector?: UnitSector | null;
  value: readonly string[];
  /** รับตัวอัปเดตจากค่าล่าสุด — กดติดกันเร็ว ๆ ต้องไม่ทับกัน */
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  if (groups === null) return <p className="text-xs text-muted-foreground">กำลังโหลดกลุ่ม Facebook…</p>;
  if (groups.length === 0) return <p className={cn('text-xs', TONE.warn.value)}>ยังไม่มีกลุ่ม Facebook ใน So Scraping — เพิ่มที่ ตั้งค่า → กลุ่มโพสต์</p>;
  return (
    <SoGroupFilterPicker
      idPrefix="genlink"
      testPrefix="genlink"
      groups={groups}
      allGroups={groups}
      jobBu={jobBu}
      jobSector={jobSector}
      account={null}
      picked={value}
      cap={null}
      onToggle={(ids, on) => onChange((prev) => (on ? [...new Set([...prev, ...ids])] : prev.filter((x) => !ids.includes(x))))}
    />
  );
}

const NONE_KEY = '__none__';
const ALL_PROVINCES = '__all__';

/**
 * 2 · กลุ่ม Facebook — ธุรกิจ → เอกชน/ราชการ → จังหวัด (ไม่เลือก = ทุกจังหวัด) แล้วติ๊กกลุ่ม (เจ้าของ 4 พ.ย. 2569 Journey)
 * ขึ้นเฉพาะกลุ่มที่โพสต์ได้ด้วยบัญชีนี้ (`soGroupUsable`) — แอดมินพัก · ห้ามโพสต์ · ต้องตอบคำถาม · ใบนี้เพิ่งลง = ไม่ขึ้น
 * ค่าตั้งต้น = ธุรกิจ/ประเภทของใบขอ (ถ้ามีกลุ่ม) · ช่องติ๊กทั้งรายการไม่เกินโพสต์ที่บัญชีเหลือ
 */
export function SoGroupFilterPicker({
  idPrefix,
  testPrefix,
  groups,
  allGroups,
  jobBu,
  jobSector,
  account,
  picked,
  recent,
  cap,
  onToggle,
}: {
  /** id ของช่องติ๊ก (ไม่ชนกันเมื่อมีหลายป๊อป) */
  idPrefix: string;
  /** data-testid ขึ้นต้น — autopost · genlink */
  testPrefix: 'autopost' | 'genlink';
  /** กลุ่มที่บัญชีนี้โพสต์ได้ (ก่อนกรองสถานะ) เรียงโพสต์ได้ 30 วันมากไปน้อย */
  groups: readonly SoOptGroup[];
  /** ทุกกลุ่ม — ชื่อซ้ำต่อท้ายรหัสกลุ่ม ตรงกับชื่อบนลิงก์ */
  allGroups: readonly SoOptGroup[];
  jobBu: string | null;
  jobSector: UnitSector | null;
  /** บัญชีที่จะโพสต์ — สถานะกลุ่มคิดจากบัญชีนี้ · Gen link = null (ดูแค่กลุ่มโดนพัก) */
  account: SoOptAccount | null;
  picked: readonly string[];
  /** กลุ่มที่ใบนี้เพิ่งสั่งโพสต์ใน 3 วัน (Autopost) */
  recent?: ReadonlySet<string>;
  /** ติ๊กได้สูงสุด (โพสต์ที่บัญชีเหลือวันนี้) · null = ไม่จำกัด */
  cap: number | null;
  onToggle: (ids: string[], on: boolean) => void;
}) {
  const usable = React.useMemo(() => groups.filter((g) => soGroupUsable(g, account)), [groups, account]);
  // คลิก · กรอก จากลิงก์ของกลุ่ม ยอดทั้งหมด (เจ้าของ 10 พ.ย. 2569 "ต่อไปเวลาเลือกกลุ่ม Auto post ได้เลือกกลุ่มถูก")
  const [ours, setOurs] = React.useState<FbGroupStats | null>(null);
  React.useEffect(() => {
    let alive = true;
    void fetchFbGroupStats().then((s) => alive && setOurs(s));
    return () => {
      alive = false;
    };
  }, []);
  const [buPick, setBuPick] = React.useState<string | null | undefined>(undefined);
  const [sectorPick, setSectorPick] = React.useState<UnitSector | null | undefined>(undefined);
  const [province, setProvince] = React.useState('');

  // ค่าที่ใช้จริง = ที่เลือกไว้ถ้ายังมีในตัวเลือก ไม่งั้นค่าตั้งต้น (ของใบขอ → ตัวแรก)
  const bus = soFilterBus(usable, jobBu);
  const has = <T,>(list: readonly { value: T }[], v: T | undefined) => v !== undefined && list.some((x) => x.value === v);
  const bu = has(bus, buPick) ? (buPick as string | null) : has(bus, jobBu) ? jobBu : (bus[0]?.value ?? null);
  const sectors = soFilterSectors(usable, bu, jobSector);
  const sector = has(sectors, sectorPick) ? (sectorPick as UnitSector | null) : has(sectors, jobSector) ? jobSector : (sectors[0]?.value ?? null);
  const provinces = soFilterProvinces(usable, bu, sector);
  const prov = provinces.includes(province) ? province : '';
  const list = soFilterGroups(usable, { bu, sector, province: prov });

  const ids = list.map((g) => g.id);
  const n = ids.filter((id) => picked.includes(id)).length;
  /** ติ๊กครบเพดานแล้ว — ช่องที่ยังไม่ติ๊กเป็นสีเทา กดไม่ได้ (เอาออกได้เสมอ) */
  const full = cap !== null && picked.length >= cap;

  if (usable.length === 0) {
    return (
      <p className={cn('rounded-xl border border-border/70 px-3 py-2 text-sm', TONE.warn.value)} data-testid={`${testPrefix}-no-usable-group`}>
        {account ? 'ไม่มีกลุ่มที่บัญชีนี้โพสต์ได้ตอนนี้ — เลือกบัญชีอื่น' : 'ไม่มีกลุ่มที่โพสต์ได้ตอนนี้'}
      </p>
    );
  }
  return (
    <div className="space-y-2" data-testid={`${testPrefix}-groups`}>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">ธุรกิจ</Label>
          <FieldSelect
            value={bu ?? NONE_KEY}
            onChange={(v) => setBuPick(v === NONE_KEY ? null : v)}
            ariaLabel="ธุรกิจของกลุ่ม"
            testId={`${testPrefix}-filter-bu`}
            options={bus.map((b) => ({ value: b.value ?? NONE_KEY, label: b.label }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">เอกชน / ราชการ</Label>
          <FieldSelect
            value={sector ?? NONE_KEY}
            onChange={(v) => setSectorPick(v === NONE_KEY ? null : (v as UnitSector))}
            ariaLabel="เอกชนหรือราชการ"
            testId={`${testPrefix}-filter-sector`}
            options={sectors.map((x) => ({ value: x.value ?? NONE_KEY, label: x.label }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">จังหวัด</Label>
          <FieldSelect
            value={prov || ALL_PROVINCES}
            onChange={(v) => setProvince(v === ALL_PROVINCES ? '' : v)}
            ariaLabel="จังหวัดของกลุ่ม"
            testId={`${testPrefix}-filter-province`}
            options={[{ value: ALL_PROVINCES, label: 'ทุกจังหวัด' }, ...provinces.map((p) => ({ value: p, label: p }))]}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/70">
        <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
          <Checkbox
            id={`${idPrefix}-all`}
            checked={n === 0 ? false : n === ids.length ? true : 'indeterminate'}
            disabled={ids.length === 0}
            onCheckedChange={(v) => onToggle(ids, v === true)}
            aria-label="เลือกทุกกลุ่มในรายการนี้"
          />
          <Label htmlFor={`${idPrefix}-all`} className="flex-1 text-sm font-medium tabular-nums text-foreground" data-testid={`${testPrefix}-list-head`}>
            โพสต์ได้ {NUM.format(ids.length)} กลุ่ม · เลือก {NUM.format(n)}
          </Label>
        </div>
        {list.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">ไม่มีกลุ่มที่โพสต์ได้ในตัวเลือกนี้</p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto px-3 py-2">
            {list.map((g) => (
              // ติ๊กครบเพดานแล้ว = แถวที่ยังไม่ติ๊กเป็นสีเทา (สเปค 6.2)
              <li key={g.id} className={cn('flex items-start gap-2', full && !picked.includes(g.id) && 'opacity-50')} data-testid={`${testPrefix}-group-row`}>
                <Checkbox
                  id={`${idPrefix}-group-${g.id}`}
                  checked={picked.includes(g.id)}
                  disabled={full && !picked.includes(g.id)}
                  onCheckedChange={(v) => onToggle([g.id], v === true)}
                  className="mt-0.5"
                />
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor={`${idPrefix}-group-${g.id}`} className="block text-sm font-normal text-foreground">
                    {soGroupLabel(g, allGroups)}
                    {/* สถานะเป็นคำจาก So Scraping เสมอ (ไม่บอกด้วยสีอย่างเดียว) · Gen link ไม่มีบัญชี = ไม่มีสถานะ */}
                    {account ? (
                      <span className={cn('font-medium', DASH.muted)} data-testid={`${testPrefix}-group-state`}>
                        {' — '}
                        {soGroupView(g, account).label}
                      </span>
                    ) : null}
                  </Label>
                  <p className={cn('text-xs', DASH.muted)}>
                    {[
                      prov && !g.provinces.includes(prov) && g.nationwide ? 'ทั่วประเทศ' : null,
                      soGroupStatsText(g.stats30d),
                      ours ? ourStatsText(fbGroupStatOf(ours, soGroupLinkKey(g), g.name)) : null,
                      bkkWhen(g.lastPostedAt) ? `โพสต์ล่าสุด ${bkkWhen(g.lastPostedAt)}` : null,
                      recent?.has(g.id) ? 'ใบนี้เพิ่งสั่งโพสต์กลุ่มนี้ใน 3 วัน' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

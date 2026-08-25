/**
 * Dropdown เลือกประเภทหน่วยงาน: ราชการ / เอกชน (เจ้าของสั่ง 25 ส.ค. 2569)
 *
 * 🔴 เก็บที่ระดับ **หน่วยงาน (site_code)** — เลือกที่ใบขอใบไหนก็มีผลกับทุกใบของหน่วยงานนั้น
 * (ใบขอ 293 ใบมาจาก 138 หน่วยงาน · ถ้าคีย์รายใบต้องกรอก 293 ครั้ง)
 * ⇒ ข้อความบนจอต้องบอกให้ชัดว่า "มีผลทั้งหน่วยงาน" ไม่งั้นคนกดคิดว่าตั้งให้ใบเดียว
 *
 * 🔴 "ยังไม่ระบุ" ต้องเป็นตัวเลือกจริง (ล้างค่าได้) และต้องดูต่างจากคำตอบจริง
 * 🔴 อยู่ในแถวที่กดแล้วเปิดใบขอ ⇒ ต้อง `stopPropagation` ทุก event ไม่งั้นกดเลือกแล้วเด้งออกจากหน้า
 * 🔴 ไม่มี site_code (ใบขอบางใบไม่มี) = โชว์ขีด ไม่ใช่ dropdown ที่กดแล้วเงียบ
 */
import * as React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DASH } from '@/lib/designTokens';
import {
  UNIT_SECTOR_OPTIONS,
  UNIT_SECTOR_UNSET_LABEL,
  type UnitSector,
} from '@/lib/unitSector';
import { cn } from '@/lib/utils';

/** ค่าที่ใช้แทน "ยังไม่ระบุ" ใน Select — Radix/Base ไม่รับ value = '' */
const UNSET = '__unset__';

export type UnitSectorSelectProps = {
  siteCode?: string | null;
  value: UnitSector | null;
  onChange: (siteCode: string, next: UnitSector | null) => void;
  /** กำลังบันทึกอยู่ — กันกดรัว */
  saving?: boolean;
  className?: string;
};

export const UnitSectorSelect: React.FC<UnitSectorSelectProps> = ({
  siteCode,
  value,
  onChange,
  saving = false,
  className,
}) => {
  const code = String(siteCode ?? '').trim();
  if (!code) {
    return (
      <span className={cn('text-xs', DASH.cellMuted, className)} title="ใบขอนี้ไม่มีรหัสหน่วยงาน">
        —
      </span>
    );
  }

  return (
    <span
      // กันคลิก/คีย์ทะลุไปโดนแถว (แถวนี้กดแล้วเปิดใบขอ)
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn('inline-block', className)}
    >
      <Select
        value={value ?? UNSET}
        disabled={saving}
        onValueChange={(v) => onChange(code, v === UNSET ? null : (v as UnitSector))}
      >
        <SelectTrigger
          className="h-8 min-h-8 w-[104px] px-2 text-xs"
          aria-label={`ประเภทหน่วยงาน ${code} — มีผลกับทุกใบขอของหน่วยงานนี้`}
          title="เลือกแล้วมีผลกับทุกใบขอของหน่วยงานนี้"
        >
          <SelectValue placeholder={UNIT_SECTOR_UNSET_LABEL} />
        </SelectTrigger>
        <SelectContent>
          {/* ตัวเลือกล้างค่า — ต้องมี ไม่งั้นเลือกผิดแล้วแก้กลับเป็น "ยังไม่ระบุ" ไม่ได้ */}
          <SelectItem value={UNSET} className="text-xs">
            {UNIT_SECTOR_UNSET_LABEL}
          </SelectItem>
          {UNIT_SECTOR_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
};

export default UnitSectorSelect;

/**
 * วันที่แบบเลือก 3 ช่อง วัน · เดือน · ปี พ.ศ. (ฟอร์มส่งเอกสารของผู้สมัคร · 22 พ.ย. 2569)
 * ค่าเป็น YYYY-MM-DD ค.ศ. · เลือกไม่ครบ/วันที่ไม่มีจริง (31 ก.พ.) = '' · ปีบนบัตรเป็น พ.ศ. จึงให้เลือกเป็น พ.ศ.
 */
import { useEffect, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const pad = (n: number) => String(n).padStart(2, '0');

type Parts = { d: string; m: string; y: string };
const partsOf = (value: string): Parts => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? { d: String(Number(m[3])), m: String(Number(m[2])), y: m[1] } : { d: '', m: '', y: '' };
};
const ymdOf = (p: Parts): string => {
  if (!p.d || !p.m || !p.y) return '';
  const ymd = `${p.y}-${pad(Number(p.m))}-${pad(Number(p.d))}`;
  return !Number.isNaN(Date.parse(ymd)) && new Date(ymd).toISOString().slice(0, 10) === ymd ? ymd : '';
};

export default function ThaiDateSelect({
  value,
  onChange,
  label,
  fromYear,
  toYear,
  disabled = false,
}: {
  value: string;
  onChange: (ymd: string) => void;
  /** ชื่อช่อง — ใช้เป็นชื่อปุ่มของแต่ละตัวเลือก */
  label: string;
  /** ช่วงปี ค.ศ. ที่เลือกได้ (รวมสองปลาย) */
  fromYear: number;
  toYear: number;
  disabled?: boolean;
}) {
  const [parts, setParts] = useState<Parts>(() => partsOf(value));
  // ค่าถูกเปลี่ยนจากข้างนอก (OCR เติม · ล้างเมื่อเปลี่ยนภาพ) — ตามให้ทัน แต่ไม่ล้างช่องที่กำลังเลือกค้างอยู่
  useEffect(() => {
    setParts((prev) => (ymdOf(prev) === value ? prev : partsOf(value)));
  }, [value]);
  // ปีที่อ่านได้จากบัตรอยู่นอกช่วง (OCR อ่านเลขผิด) — ยังโชว์ปีนั้นให้เห็นแล้วแก้ ไม่ซ่อนเป็นช่องว่าง
  const outside = Number(parts.y);
  const years = useMemo(() => {
    const list = Array.from({ length: Math.max(0, toYear - fromYear + 1) }, (_, i) => toYear - i);
    return Number.isInteger(outside) && outside > 0 && !list.includes(outside) ? [outside, ...list].sort((a, b) => b - a) : list;
  }, [fromYear, toYear, outside]);
  const set = (p: Partial<Parts>) => {
    const next = { ...parts, ...p };
    setParts(next);
    onChange(ymdOf(next));
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      <Select value={parts.d} onValueChange={(d) => set({ d })} disabled={disabled}>
        <SelectTrigger aria-label={`${label} วันที่`}>
          <SelectValue placeholder="วัน" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 31 }, (_, i) => (
            <SelectItem key={i} value={String(i + 1)}>
              {i + 1}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={parts.m} onValueChange={(m) => set({ m })} disabled={disabled}>
        <SelectTrigger aria-label={`${label} เดือน`}>
          <SelectValue placeholder="เดือน" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, i) => (
            <SelectItem key={name} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={parts.y} onValueChange={(y) => set({ y })} disabled={disabled}>
        <SelectTrigger aria-label={`${label} ปี พ.ศ.`}>
          <SelectValue placeholder="ปี พ.ศ." />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y + 543}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

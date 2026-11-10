/**
 * ช่องค้นหาในป๊อปรายชื่อ (ชุดส่งต่อ 10 พ.ย. 2569 G04) — ค้นชื่อ/เบอร์/หน่วยงาน · ดูทีละ `NAMES_PAGE` คน
 * ใช้ร่วม: รายชื่อผู้สมัคร (`JourneyNamesDialog`) · รายชื่อติดตาม (`FollowNamesDialog`)
 */
import React from 'react';
import { Input } from '@/components/ui/input';

export const NAMES_PAGE = 50;
const NUM = new Intl.NumberFormat('th-TH');

/** ตรงคำค้นไหม — ไม่สนตัวพิมพ์ใหญ่เล็ก · เบอร์เทียบเฉพาะตัวเลข (พิมพ์ 081-… หรือ 081… ได้ทั้งคู่) */
export function matchesNameQuery(fields: ReadonlyArray<string | null | undefined>, q: string): boolean {
  const k = q.trim().toLowerCase();
  if (!k) return true;
  const digits = k.replace(/\D/g, '');
  return fields.some((v) => {
    const t = (v ?? '').toLowerCase();
    return t.includes(k) || (digits.length >= 3 && t.replace(/\D/g, '').includes(digits));
  });
}

export default function NamesSearchInput({
  value,
  onChange,
  found,
  placeholder = 'ค้นหา ชื่อ เบอร์ หน่วยงาน',
  unit = 'คน',
}: {
  value: string;
  onChange: (v: string) => void;
  found: number | null;
  placeholder?: string;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-9" data-testid="names-search" />
      {found !== null ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">เจอ {NUM.format(found)} {unit}</span> : null}
    </div>
  );
}

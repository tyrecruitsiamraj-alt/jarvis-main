/**
 * ═══ เลือก BU ของผู้ใช้ — Dropdown ติ๊กได้หลาย BU (เจ้าของ 27 ต.ค. 2569 "เอาเป็น Dropdown เลย แยกกันทำไม แล้วเป็น Checkbox") ═══
 * แทนช่อง BU + ปุ่มดูเพิ่ม (26 ต.ค.) · ติ๊กแล้วบันทึกทันที · "ดูทุก BU" = ติ๊กครบ / เอาออกหมด
 * BU หลัก (`department_code` — ใช้เขียนใบใหม่/ค่าเริ่มหน้าสรุป) = ตัวเดิมถ้ายังติ๊กอยู่ ไม่งั้นตัวแรกที่ติ๊ก
 * ไม่ติ๊กเลย = ยังไม่ตั้ง (ผู้ใช้ต้องเลือกตอนเข้าครั้งแรก)
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { APP_DEPARTMENT_CODES } from '@/lib/departmentCodes';
import { userBuCodes, userBuLabel, userBuValueOf, type UserBuValue } from '@/lib/userBuPick';

export default function UserBuPicker({
  primary,
  extras,
  disabled,
  onChange,
}: {
  primary: string | null | undefined;
  extras: readonly string[] | null | undefined;
  disabled?: boolean;
  onChange: (next: UserBuValue) => void;
}) {
  const codes = userBuCodes(primary, extras);
  const all = codes.length === APP_DEPARTMENT_CODES.length;
  const toggle = (code: string, on: boolean) =>
    onChange(userBuValueOf(on ? [...codes, code] : codes.filter((c) => c !== code), primary));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="xs" disabled={disabled} className="justify-between gap-1" data-testid="user-bu-picker">
          {userBuLabel(codes)}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          checked={all}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={(v) => onChange(userBuValueOf(v ? [...APP_DEPARTMENT_CODES] : [], primary))}
          data-testid="user-bu-all"
        >
          ดูทุก BU
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {APP_DEPARTMENT_CODES.map((code) => (
          <DropdownMenuCheckboxItem
            key={code}
            checked={codes.includes(code)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(v) => toggle(code, v === true)}
          >
            {code}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

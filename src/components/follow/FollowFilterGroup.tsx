import React, { useMemo } from 'react';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import type { FollowEntry } from '@/lib/followApi';
import type { FollowRoundFilter } from '@/lib/followPlanning';
import { buildFollowCallMatrix, FOLLOW_MATRIX_ROW_LABEL, FOLLOW_MATRIX_ROWS } from '@/lib/followCallMatrix';

/**
 * ═══ แถวตัวกรองของหน้าติดตาม — สายที่ · ใครโทร · เจ้าของงาน · ใครเพิ่ม ═══
 * 🔴 ย้ายจากหัวการ์ด "ขั้นตอนของสาย (Call Pipeline)" ไปอยู่แถวเดียวกับแท็บ รายวัน/รายเดือน
 * (เจ้าของสั่ง 5 ต.ค. 2569) · ยังกรองทั้งแผงขั้นตอนและตารางเหมือนเดิม (state อยู่หน้าแม่ที่เดียว)
 * "สายที่" = dropdown (3 ต.ค. 2569 "เอาพวกนี้รวมกันเป็น Dropdown") · เลขต่อสายมาจากตารางสายรวมชุดเดียวกับแผง
 */
export default function FollowFilterGroup({
  entries,
  round,
  onRoundChange,
  children,
}: {
  /** ก้อนเดียวกับที่ส่งให้แผงขั้นตอนของสาย — เลขใน dropdown จึงตรงกับเลขบนแผง */
  entries: FollowEntry[];
  round: FollowRoundFilter;
  onRoundChange: (round: FollowRoundFilter) => void;
  /** ตัวกรองอื่นของหน้าแม่ (ใครโทร · เจ้าของงาน · ใครเพิ่ม) */
  children?: React.ReactNode;
}) {
  const matrix = useMemo(() => buildFollowCallMatrix(entries), [entries]);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="ตัวกรอง">
      <span className="inline-flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">สายที่</span>
      <ChoiceDropdown
        value={String(round)}
        options={FOLLOW_MATRIX_ROWS.map((r) => ({
          value: String(r),
          label: `${r === 'all' ? 'ทั้งหมด' : FOLLOW_MATRIX_ROW_LABEL[r]} · ${matrix[r].total.length.toLocaleString('th-TH')}`,
        }))}
        onChange={(v) => onRoundChange(v === 'all' ? 'all' : (Number(v) as 1 | 2 | 3))}
        ariaLabel="ดูเฉพาะสายที่"
        active={round !== 'all'}
      />
      </span>
      {children}
    </div>
  );
}

import React from 'react';

export type RosterBackedStaffSelectProps = {
  /** สายงานของช่อง (ใช้อ่านง่ายตอนเรียก) */
  role: 'recruiter' | 'screener' | 'opl' | 'online';
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** รายชื่อใน dropdown — หน้าผู้ใช้งานที่เดียว (19 ต.ค. 2569 · กล่องจัดการรายชื่อ Admin ถอดแล้ว) */
  optionNames: string[];
};

function nameMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export const RosterBackedStaffSelect: React.FC<RosterBackedStaffSelectProps> = ({
  label,
  value,
  onChange,
  optionNames,
}) => {
  const trimmed = value.trim();
  const inOptions =
    trimmed === '' || optionNames.some((n) => nameMatch(n, trimmed));

  const selectValue = inOptions ? value : trimmed ? value : '';

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <select
        value={selectValue}
        onChange={(e) => onChange(e.target.value)}
        className="jarvis-soft-field"
      >
        <option value="">— ไม่ระบุ —</option>
        {trimmed && !inOptions ? (
          <option value={value}>{trimmed} (ไม่อยู่ในรายการ)</option>
        ) : null}
        {optionNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
};

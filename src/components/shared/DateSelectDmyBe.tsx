import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  THAI_MONTHS,
  parseYmd,
  toYmdLocal,
  ceToBeYear,
  dmyBeToYmd,
  beYearRange,
} from '@/lib/dateTh';

export interface DateSelectDmyBeProps {
  /** YYYY-MM-DD หรือ '' ถ้า allowEmpty */
  value: string;
  onChange: (isoYmd: string) => void;
  allowEmpty?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * เลือกวันที่แบบ วัน / เดือน (ชื่อไทย) / ปี พ.ศ. — ค่าที่ส่งออกยังเป็น YYYY-MM-DD สำหรับ API
 */
const DateSelectDmyBe: React.FC<DateSelectDmyBeProps> = ({
  value,
  onChange,
  allowEmpty = false,
  disabled = false,
  className = '',
}) => {
  const [d, setD] = useState<number | ''>('');
  const [m, setM] = useState<number | ''>('');
  const [yBe, setYBe] = useState<number | ''>('');

  const yearOptions = useMemo(() => beYearRange(new Date().getFullYear(), 15), []);
  const dayOptions = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);

  useEffect(() => {
    const p = parseYmd(value);
    if (p) {
      setD(p.d);
      setM(p.m);
      setYBe(ceToBeYear(p.y));
      return;
    }
    if (allowEmpty) {
      setD('');
      setM('');
      setYBe('');
      return;
    }
    const t = parseYmd(toYmdLocal(new Date()));
    if (t) {
      setD(t.d);
      setM(t.m);
      setYBe(ceToBeYear(t.y));
    }
  }, [value, allowEmpty]);

  const tryEmit = useCallback(
    (nextD: number | '', nextM: number | '', nextYBe: number | '') => {
      if (allowEmpty && nextD === '' && nextM === '' && nextYBe === '') {
        onChange('');
        return;
      }
      if (typeof nextD === 'number' && typeof nextM === 'number' && typeof nextYBe === 'number') {
        const iso = dmyBeToYmd(nextD, nextM, nextYBe);
        if (iso) onChange(iso);
      }
    },
    [allowEmpty, onChange],
  );

  const sel = 'bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground disabled:opacity-50';

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <select
        disabled={disabled}
        value={d === '' ? '' : String(d)}
        onChange={(e) => {
          const v = e.target.value;
          const nextD = v === '' ? '' : Number(v);
          setD(nextD);
          tryEmit(nextD, m, yBe);
        }}
        className={sel}
      >
        {allowEmpty && <option value="">วัน</option>}
        {dayOptions.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <select
        disabled={disabled}
        value={m === '' ? '' : String(m)}
        onChange={(e) => {
          const v = e.target.value;
          const nextM = v === '' ? '' : Number(v);
          setM(nextM);
          tryEmit(d, nextM, yBe);
        }}
        className={sel}
      >
        {allowEmpty && <option value="">เดือน</option>}
        {THAI_MONTHS.map((mo) => (
          <option key={mo.value} value={mo.value}>
            {mo.label}
          </option>
        ))}
      </select>
      <select
        disabled={disabled}
        value={yBe === '' ? '' : String(yBe)}
        onChange={(e) => {
          const v = e.target.value;
          const nextY = v === '' ? '' : Number(v);
          setYBe(nextY);
          tryEmit(d, m, nextY);
        }}
        className={sel}
      >
        {allowEmpty && <option value="">ปี พ.ศ.</option>}
        {yearOptions.map((be) => (
          <option key={be} value={be}>
            {be}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DateSelectDmyBe;

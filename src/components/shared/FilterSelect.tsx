import React from 'react';
import { cn } from '@/lib/utils';
import { FieldSelect, type FieldSelectOption } from '@/components/shared/FieldSelect';

/** อ่าน `<option>` ที่ผู้เรียกส่งมา (รวมใน Fragment/อาร์เรย์) เป็นตัวเลือกของ `FieldSelect` */
function optionsFromChildren(children: React.ReactNode): FieldSelectOption[] {
  const out: FieldSelectOption[] = [];
  const walk = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      const el = child as React.ReactElement<{ value?: unknown; children?: React.ReactNode; disabled?: boolean }>;
      if (el.type === React.Fragment) return walk(el.props.children);
      if (el.type !== 'option') return;
      const text = React.Children.toArray(el.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join('');
      out.push({ value: String(el.props.value ?? text), label: text, disabled: el.props.disabled });
    });
  };
  walk(children);
  return out;
}

type FilterSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  selectClassName?: string;
  disabled?: boolean;
};

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
  className,
  selectClassName,
  disabled = false,
}: FilterSelectProps) {
  return (
    <div className={cn('flex flex-col gap-1 min-w-0 w-full', className)}>
      <label htmlFor={id} className="text-xs text-muted-foreground leading-snug">
        {label}
      </label>
      {/* ตัวเลือก shadcn แทน select ของเบราว์เซอร์ (QA รอบ 2 ข้อ 44 · 12 ต.ค. 2569) — ผู้เรียกยังส่ง <option> เป็นลูกได้เหมือนเดิม */}
      <FieldSelect
        id={id}
        value={value}
        disabled={disabled}
        onChange={onChange}
        options={optionsFromChildren(children)}
        className={selectClassName}
      />
    </div>
  );
}

export default FilterSelect;

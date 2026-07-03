import React from 'react';
import SearchableSelect, { type SearchableSelectOption } from '@/components/shared/SearchableSelect';

type SearchablePickerProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

/** Searchable select — empty value = no filter (shows placeholder, not "ทุกคน/ทุกคัน"). */
const SearchablePicker: React.FC<SearchablePickerProps> = ({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  className,
}) => (
  <SearchableSelect
    value={value}
    onChange={onChange}
    options={options}
    placeholder={placeholder}
    searchPlaceholder={searchPlaceholder ?? 'พิมพ์เพื่อค้นหา...'}
    emptyText={emptyText ?? 'ไม่พบรายการ'}
    disabled={disabled}
    className={className}
  />
);

export default SearchablePicker;

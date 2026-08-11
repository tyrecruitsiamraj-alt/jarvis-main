import React from 'react';
import { UserPlus, BookmarkPlus, Trash2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import SearchField from '@/components/shared/SearchField';

/**
 * แถวค้นหา + เครื่องมือ — ตาม HTML ของระบบเดิม
 *
 * ⚠️ **แท็บ "ข้อมูลผู้สมัคร" เท่านั้นที่มีเครื่องมือ Lead** (เก็บ Lead / ลบ Lead)
 * อีกสองแท็บมีแค่ ค้นหา + เพิ่มข้อมูลผู้สมัคร · คุมจาก `rmTabHasLeadTools()` ที่ lib
 *
 * "เพิ่มข้อมูลผู้สมัคร" = เปิดหน้า /apply ในแท็บใหม่ — ฟอร์มสมัครมีอยู่แล้วในระบบ
 * ไม่สร้างฟอร์มซ้ำอีกชุดให้ข้อมูลแตกเป็นสองทาง
 *
 * ⚠️ กรองสดขณะพิมพ์ (ข้อมูลอยู่ในหน้าแล้ว) แต่**คงปุ่ม "ค้นหา" ไว้** — ผู้ใช้ระบบเดิม
 * ชินกับการกด และตอนย้ายไปค้นฝั่ง server ปุ่มนี้จะเป็นตัวยิงจริงโดยไม่ต้องรื้อ layout
 */
const RmSearchBar: React.FC<{
  keyword: string;
  onKeywordChange: (v: string) => void;
  onSearch: () => void;
  showLeadTools: boolean;
  selectedCount: number;
  onSaveLead: () => void;
  onDeleteLead: () => void;
}> = ({ keyword, onKeywordChange, onSearch, showLeadTools, selectedCount, onSaveLead, onDeleteLead }) => (
  <div className="flex flex-wrap items-center gap-2">
    <SearchField
      compact
      value={keyword}
      onChange={(e) => onKeywordChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      placeholder="ค้นหาจาก ชื่อ นามสกุล เบอร์ หรือชื่องาน"
      wrapperClassName="w-full sm:w-[22rem]"
    />
    <button type="button" onClick={onSearch} className="jarvis-btn-primary shrink-0">
      ค้นหา
    </button>

    <span className={cn('hidden h-6 border-l sm:block', DASH.divider)} aria-hidden />

    <a href="/apply" target="_blank" rel="noopener noreferrer" className="jarvis-btn-secondary shrink-0">
      <UserPlus className="h-3.5 w-3.5" aria-hidden /> เพิ่มข้อมูลผู้สมัคร
      <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
    </a>

    {showLeadTools ? (
      <>
        {/* ⚠️ ทำกับ "แถวที่ติ๊กไว้" — ปิดไว้ตอนยังไม่ได้ติ๊ก · ระบบเดิมกดได้ตลอด
            แล้วเงียบเมื่อไม่ได้เลือก ซึ่งอ่านไม่ออกว่าทำงานไหม */}
        <button
          type="button"
          onClick={onSaveLead}
          disabled={selectedCount === 0}
          title={selectedCount === 0 ? 'ติ๊กเลือกแถวก่อน' : `เก็บ ${selectedCount} รายการเข้า Lead`}
          className="jarvis-btn-primary shrink-0 disabled:opacity-50"
        >
          <BookmarkPlus className="h-3.5 w-3.5" aria-hidden /> เก็บ Lead
          {selectedCount > 0 ? ` (${selectedCount})` : ''}
        </button>
        <button
          type="button"
          onClick={onDeleteLead}
          disabled={selectedCount === 0}
          title={selectedCount === 0 ? 'ติ๊กเลือกแถวก่อน' : `เอา ${selectedCount} รายการออกจาก Lead`}
          className="jarvis-btn-secondary shrink-0 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> ลบ Lead
        </button>
      </>
    ) : null}
  </div>
);

export default RmSearchBar;

import React from 'react';
import { UserPlus, BookmarkPlus, PhoneCall, Trash2, Archive, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import SearchField from '@/components/shared/SearchField';
import { LEAD_VIEW_LABEL } from '@/lib/recruitLead';

/**
 * แถวค้นหา + เครื่องมือ — ตาม HTML ของระบบเดิม
 *
 * ⚠️ **แท็บ "ข้อมูลผู้สมัคร" เท่านั้นที่มีเครื่องมือ Lead** (เก็บ Lead / ลบ Lead)
 * อีกสองแท็บมีแค่ ค้นหา + เพิ่มข้อมูลผู้สมัคร · คุมจาก `rmTabHasLeadTools()` ที่ lib
 *
 * "เพิ่มข้อมูลผู้สมัคร" = เปิดฟอร์มคีย์เอง (AddApplicantDialog) สำหรับคนที่โทรเข้ามาสมัคร
 * บันทึกลงตารางใบสมัครเดียวกับที่มาจากลิงก์ ไม่แตกเป็นสองชุด
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
  onAddApplicant: () => void;
  /**
   * "เก็บไปโทรเอง" ทีละหลายคน — **ปุ่มรวม** ของเดิมสองปุ่ม (เจ้าของเคาะ 22 ส.ค. 2569)
   * กดทีเดียว = จองใบ (claim) + ล็อกเบอร์กัน AI โทรทับ (call hold)
   */
  onHoldSelected?: () => void;
  holdingSelected?: boolean;
  /** "ส่ง AI โทร" ทีละหลายคน — 🔴 ยิงสายจริง ผู้เรียกต้องมี popup ยืนยันรายชื่อก่อนเสมอ */
  onSendAiSelected?: () => void;
  /** กำลังยิงเก็บ/ลบ Lead อยู่ — ปิดปุ่มกันกดซ้อน (ยิงทีละใบหลายใบพร้อมกัน) */
  leadBusy?: boolean;
  /** อยู่ในมุมมอง "คลังสำรอง (Lead)" อยู่ไหม — สลับป้ายปุ่มและตัวที่เน้น */
  leadView?: boolean;
  onToggleLeadView?: () => void;
}> = ({
  keyword,
  onKeywordChange,
  onSearch,
  showLeadTools,
  selectedCount,
  onSaveLead,
  onDeleteLead,
  onAddApplicant,
  onHoldSelected,
  holdingSelected = false,
  onSendAiSelected,
  leadBusy = false,
  leadView = false,
  onToggleLeadView,
}) => (
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

    <button type="button" onClick={onAddApplicant} className="jarvis-btn-secondary shrink-0">
      <UserPlus className="h-3.5 w-3.5" aria-hidden /> เพิ่มข้อมูลผู้สมัคร
    </button>

    {onHoldSelected ? (
      <button
        type="button"
        onClick={onHoldSelected}
        disabled={selectedCount === 0 || holdingSelected}
        title={
          selectedCount === 0
            ? 'ติ๊กเลือกแถวก่อน'
            : `จอง ${selectedCount} ใบ + ล็อกเบอร์กัน AI โทรทับ — ไปโทร+บันทึกผลที่แท็บการโทรของฉัน`
        }
        className="jarvis-btn-primary shrink-0 disabled:opacity-50"
      >
        <PhoneCall className="h-3.5 w-3.5" aria-hidden />
        {holdingSelected ? 'กำลังเก็บ…' : `เก็บไปโทรเอง${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
      </button>
    ) : null}

    {/* ทางเลือกที่สองของงานเดียวกัน — วางคู่กันเพื่อให้เห็นว่าเลือกได้สองทาง
        🔴 ยิงสายจริง → ผู้เรียกเปิด popup ยืนยันรายชื่อก่อนเสมอ (ปุ่มนี้แค่ถาม) */}
    {onSendAiSelected ? (
      <button
        type="button"
        onClick={onSendAiSelected}
        disabled={selectedCount === 0 || holdingSelected}
        title={
          selectedCount === 0
            ? 'ติ๊กเลือกแถวก่อน'
            : `ส่ง ${selectedCount} คนให้ AI โทร — มีหน้ายืนยันรายชื่อก่อนโทรจริง`
        }
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50',
          TONE.violet.outline,
        )}
      >
        <Bot className="h-3.5 w-3.5" aria-hidden />
        ส่ง AI โทร{selectedCount > 0 ? ` (${selectedCount})` : ''}
      </button>
    ) : null}

    {showLeadTools ? (
      <>
        {/* ⚠️ ทำกับ "แถวที่ติ๊กไว้" — ปิดไว้ตอนยังไม่ได้ติ๊ก · ระบบเดิมกดได้ตลอด
            แล้วเงียบเมื่อไม่ได้เลือก ซึ่งอ่านไม่ออกว่าทำงานไหม */}
        {/* อยู่คลังสำรองแล้วปุ่ม "เก็บ Lead" ไม่มีความหมาย (ทุกแถวเป็น Lead อยู่แล้ว)
            — ซ่อนไปเลยดีกว่าปุ่มที่กดแล้วไม่เกิดอะไร */}
        {!leadView ? (
          <button
            type="button"
            onClick={onSaveLead}
            disabled={selectedCount === 0 || leadBusy}
            title={
              selectedCount === 0
                ? 'ติ๊กเลือกแถวก่อน'
                : `ปัด ${selectedCount} รายการเข้าคลังสำรอง — หายจากรายชื่อทำงานทุกแท็บ`
            }
            className="jarvis-btn-primary shrink-0 disabled:opacity-50"
          >
            <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
            {leadBusy ? 'กำลังเก็บ…' : 'เก็บ Lead'}
            {selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDeleteLead}
          disabled={selectedCount === 0 || leadBusy}
          title={
            selectedCount === 0
              ? 'ติ๊กเลือกแถวก่อน'
              : `เรียก ${selectedCount} รายการกลับเข้ารายชื่อทำงาน`
          }
          className="jarvis-btn-secondary shrink-0 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {leadBusy ? 'กำลังลบ…' : 'ลบ Lead'}
          {leadView && selectedCount > 0 ? ` (${selectedCount})` : ''}
        </button>
        {onToggleLeadView ? (
          <button
            type="button"
            onClick={onToggleLeadView}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
              leadView ? TONE.violet.solid : cn(TONE.violet.soft, TONE.violet.value, TONE.violet.softHover),
            )}
          >
            <Archive className="h-3.5 w-3.5" aria-hidden />
            {leadView ? LEAD_VIEW_LABEL.exit : LEAD_VIEW_LABEL.enter}
          </button>
        ) : null}
      </>
    ) : null}
  </div>
);

export default RmSearchBar;

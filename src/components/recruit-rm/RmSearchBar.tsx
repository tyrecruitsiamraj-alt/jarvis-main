import React from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, PhoneCall, Bot, FileSpreadsheet, Download, Printer, UserMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import SearchField from '@/components/shared/SearchField';

/** คำในช่องค้นหาของแท็บผู้สมัคร — ใช้ทั้งแถบบนและทางถอย (คำเดียวกันสองที่) */
export const RM_SEARCH_PLACEHOLDER = 'ค้นหาจาก ชื่อ นามสกุล เบอร์ หรือชื่องาน';

/**
 * แถวค้นหา + เครื่องมือ — ตาม HTML ของระบบเดิม
 *
 * 🔴 ปุ่มต่อแท็บ (เจ้าของสั่ง 5 ต.ค. 2569) — ไม่ส่ง prop = ไม่มีปุ่ม · ผู้เรียกคุมว่าแท็บไหนได้อะไร
 * · ผู้สมัคร = เพิ่มข้อมูลผู้สมัคร · นำเข้า Excel · เก็บไปโทรเอง · ส่ง AI โทร · รายงาน (5 ปุ่มเท่านั้น
 *   — เก็บ Lead / ลบ Lead / คลังสำรอง / ดูที่ยกเลิก ถอดออกจากแถวนี้)
 * · การติดต่อ = ส่ง AI โทร + "ถอย Lead" ตอนติ๊ก (ไม่มีเก็บไปโทรเอง — รายชื่อในแท็บนี้เก็บมาแล้ว)
 * · ติดตามนัดหมาย = โหลดเป็น PDF + ส่ง AI โทร
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
  /**
   * ช่องค้นหาย้ายไปแถบบนซ้ายกระดิ่งแล้ว (เจ้าของสั่ง 27 ก.ย. 2569 "ทั้งระบบ") — แถวนี้เหลือแต่ปุ่มลงมือ
   * `false` = ทางถอยตอนไม่มีแถบบน (วาดช่อง + ปุ่ม "ค้นหา" ที่นี่เหมือนเดิม)
   */
  hideSearch?: boolean;
  selectedCount: number;
  /** ไม่ส่ง = ไม่มีปุ่ม (มีแค่แท็บผู้สมัคร · 4 ต.ค. 2569) */
  onAddApplicant?: () => void;
  /** นำเข้าผู้สมัครจาก Excel (1 ต.ค. 2569) — ไม่ส่ง = ไม่มีปุ่ม */
  onImportApplicants?: () => void;
  /** "โหลดเป็น PDF" ของแท็บติดตามนัดหมาย (ย้ายมาแถวนี้ 4 ต.ค. 2569) — ไม่ส่ง = ไม่มีปุ่ม */
  onPrintPdf?: () => void;
  /**
   * "เก็บไปโทรเอง" ทีละหลายคน — **ปุ่มรวม** ของเดิมสองปุ่ม (เจ้าของเคาะ 22 ส.ค. 2569)
   * กดทีเดียว = จองใบ (claim) + ล็อกเบอร์กัน AI โทรทับ (call hold)
   */
  onHoldSelected?: () => void;
  holdingSelected?: boolean;
  /** "ส่ง AI โทร" ทีละหลายคน — 🔴 ยิงสายจริง ผู้เรียกต้องมี popup ยืนยันรายชื่อก่อนเสมอ */
  onSendAiSelected?: () => void;
  /** "ถอย Lead" ของแท็บการติดต่อ — ส่งแถวที่ติ๊กกลับแท็บผู้สมัคร · ไม่ส่ง = ไม่มีปุ่ม */
  onReleaseSelected?: () => void;
  releasing?: boolean;
  /** ปุ่ม "รายงาน" (เติมจาก iRecruit 4 ต.ค. 2569) — ส่งออกทุกแถวที่กรองอยู่ · ไม่ส่ง = ไม่มีปุ่ม */
  onExport?: () => void;
  exportCount?: number;
}> = ({
  keyword,
  onKeywordChange,
  onSearch,
  hideSearch = false,
  selectedCount,
  onAddApplicant,
  onImportApplicants,
  onPrintPdf,
  onHoldSelected,
  holdingSelected = false,
  onSendAiSelected,
  onReleaseSelected,
  releasing = false,
  onExport,
  exportCount = 0,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    {hideSearch ? null : (
      <>
        <SearchField
          compact
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch();
          }}
          placeholder={RM_SEARCH_PLACEHOLDER}
          wrapperClassName="w-full sm:w-[22rem]"
        />
        <Button size="xs" type="button" onClick={onSearch} className="shrink-0">
          ค้นหา
        </Button>

        <span className={cn('hidden h-6 border-l sm:block', DASH.divider)} aria-hidden />
      </>
    )}

    {onAddApplicant ? (
      <Button variant="secondary" size="xs" type="button" onClick={onAddApplicant} className="shrink-0">
        <UserPlus aria-hidden /> เพิ่มข้อมูลผู้สมัคร
      </Button>
    ) : null}

    {onImportApplicants ? (
      <Button variant="secondary" size="xs" type="button" onClick={onImportApplicants} className="shrink-0">
        <FileSpreadsheet aria-hidden /> นำเข้า Excel
      </Button>
    ) : null}

    {onPrintPdf ? (
      <Button variant="secondary" size="xs" type="button" onClick={onPrintPdf} className="shrink-0">
        <Printer aria-hidden /> โหลดเป็น PDF
      </Button>
    ) : null}

    {onHoldSelected ? (
      <Button size="xs"
        type="button"
        onClick={onHoldSelected}
        disabled={selectedCount === 0 || holdingSelected}
        title={
          selectedCount === 0
            ? 'ติ๊กเลือกแถวก่อน'
            : `จอง ${selectedCount} ใบ + ล็อกเบอร์กัน AI โทรทับ — ไปโทร+บันทึกผลที่แท็บการติดต่อ`
        }
        className="shrink-0"
      >
        <PhoneCall aria-hidden />
        {holdingSelected ? 'กำลังเก็บ…' : `เก็บไปโทรเอง${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
      </Button>
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
          'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50',
          TONE.violet.outline,
        )}
      >
        <Bot className="h-3.5 w-3.5" aria-hidden />
        ส่ง AI โทร{selectedCount > 0 ? ` (${selectedCount})` : ''}
      </button>
    ) : null}

    {/* "ถอย Lead" (เจ้าของสั่ง 5 ต.ค. 2569: *"ถ้าติ๊ก Lead ให้มีคำว่า ถอยLead ขึ้นมา แล้วมันจะถูกย้ายไป หน้า ผู้สมัคร"*)
        โผล่เฉพาะตอนติ๊กแล้ว · ทำงานเดียวกับปุ่มบนแถว (release) */}
    {onReleaseSelected && selectedCount > 0 ? (
      <Button
        variant="outline"
        size="xs"
        type="button"
        onClick={onReleaseSelected}
        disabled={releasing}
        className="shrink-0"
      >
        <UserMinus aria-hidden />
        {releasing ? 'กำลังถอย…' : `ถอย Lead (${selectedCount})`}
      </Button>
    ) : null}

    {onExport ? (
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={onExport}
        disabled={exportCount === 0}
        title={exportCount === 0 ? 'ไม่มีรายชื่อให้ส่งออก' : `ส่งออก ${exportCount} รายชื่อที่กรองอยู่ เป็นไฟล์ Excel (.csv)`}
        className="shrink-0"
      >
        <Download aria-hidden /> รายงาน
      </Button>
    ) : null}
  </div>
);

export default RmSearchBar;

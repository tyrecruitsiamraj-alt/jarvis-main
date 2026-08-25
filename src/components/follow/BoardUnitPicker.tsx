import React, { useMemo, useState } from 'react';
import { filterBoardUnits, type BoardUnitOption } from '@/lib/boardUnitPicker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SearchField from '@/components/shared/SearchField';
import { Building2 } from 'lucide-react';

/**
 * เลือก **หน่วยงานจากบอร์ด** — คู่แฝดของ `BoardPersonPicker`
 * (เจ้าของสั่ง 18 ส.ค. 2569: *"หน่วยงานก็ทำเหมือนปุ่มเลือกชื่อจากบอร์ด"*)
 *
 * 18 ส.ค. 2569 (ค่ำ-2): เจ้าของแจ้งว่า *"ขึ้นไม่ครบทุกหน่วยงาน"* — เดิมยุบจากใบขอ
 * ที่ยังเปิดเท่านั้น (152 หน่วยงาน) · ตอนนี้หน้าแม่ **รวมกับหน่วยงานทั้งชุดตั้งแต่ปี 2567**
 * (~1,054) มาให้แล้ว component นี้จึงรับ `units` ที่ merge เสร็จตรง ๆ
 * ตรรกะยุบ/รวม/ค้นอยู่ที่ `boardUnitPicker.ts` (pure + เทสต์) ที่เดียว
 */
export type BoardUnitPickerProps = {
  open: boolean;
  onClose: () => void;
  /** หน่วยงานที่ merge เสร็จแล้วจากหน้าแม่ (ใบขอเปิด + หน่วยงานทั้งชุด) */
  units: BoardUnitOption[];
  onPick: (unit: BoardUnitOption) => void;
};

/**
 * เนื้อของ picker (ค้นหา + รายการ) แยกออกมาเพื่อ **ใช้ซ้ำแบบไม่ห่อ Dialog**
 *
 * 🔴 เหตุผล: Phase 6.6 ต้องเลือกหน่วยงานจากในป๊อปที่เป็น Dialog อยู่แล้ว
 * (dialog รายคนของหน้าจับคู่งาน) — **ห้าม Dialog ซ้อน Dialog** ตามกติกาโปรเจกต์
 * จึงแยกเนื้อออกมาให้ฝังตรง ๆ ได้ · ตรรกะค้นหายังเป็น `filterBoardUnits` ตัวเดียวกัน
 * (ห้ามก๊อปรายการนี้ไปไว้ที่อื่น — แก้ที่นี่ที่เดียวแล้วได้ทั้งสองแบบ)
 */
export const BoardUnitPickerBody: React.FC<{
  units: BoardUnitOption[];
  onPick: (unit: BoardUnitOption) => void;
  /** จำกัดความสูงของรายการเมื่อฝังในพื้นที่แคบ */
  listClassName?: string;
}> = ({ units, onPick, listClassName }) => {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterBoardUnits(units, query), [units, query]);

  return (
    <>
      <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นชื่อหน่วยงาน / รหัสไซต์ / เลขที่ใบขอ / ตำแหน่ง"
          wrapperClassName="w-full"
        />

      {units.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          ยังโหลดหน่วยงานไม่ได้ — ปิดหน้าต่างนี้แล้วพิมพ์ชื่อหน่วยงานเองได้
        </p>
      ) : (
        <div className={listClassName ?? 'min-h-0 flex-1 overflow-y-auto'}>
            {shown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                ไม่พบหน่วยงานที่ค้น — ลองคำสั้นลง หรือค้นด้วยรหัสไซต์
              </p>
            ) : (
              <ul className="space-y-1">
                {shown.map((u) => (
                  <li key={u.siteCode}>
                    <button
                      type="button"
                      onClick={() => onPick(u)}
                      className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-left text-xs hover:bg-secondary"
                    >
                      <span className="font-semibold text-foreground">{u.unitName}</span>
                      <span className="font-mono text-muted-foreground">{u.siteCode}</span>
                      {u.openRequests > 0 ? (
                        <span className="jarvis-chip jarvis-chip-info">
                          ใบขอเปิด {u.openRequests.toLocaleString('th-TH')}
                        </span>
                      ) : (
                        // ไม่มีใบขอเปิด = หน่วยงานที่ปิดใบไปแล้ว (ยังต้องตามคนที่ลงงานไป)
                        <span className="jarvis-chip jarvis-chip-neutral">ไม่มีใบขอเปิด</span>
                      )}
                      {u.remainingPositions > 0 ? (
                        <span className="jarvis-chip jarvis-chip-warn">
                          ยังต้องหา {u.remainingPositions.toLocaleString('th-TH')}
                        </span>
                      ) : null}
                      <span className="w-full text-[11px] text-muted-foreground">
                        {[
                          u.roles.length > 0 ? u.roles.join(' · ') : null,
                          u.sampleRequestNo ? `เช่น ${u.sampleRequestNo}` : null,
                          u.lastRequestDate ? `ใบขอล่าสุด ${u.lastRequestDate}` : null,
                        ]
                          .filter(Boolean)
                          .join(' — ') || 'ไม่ระบุตำแหน่ง'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          <p className="pt-2 text-[11px] text-muted-foreground">
            แสดง {shown.length.toLocaleString('th-TH')} จาก {units.length.toLocaleString('th-TH')}{' '}
            หน่วยงาน
            {shown.length >= 100 ? ' (พิมพ์ค้นเพิ่มเพื่อแคบผลลง)' : ''}
          </p>
        </div>
      )}
    </>
  );
};

const BoardUnitPicker: React.FC<BoardUnitPickerProps> = ({ open, onClose, units, onPick }) => (
  <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
    <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" /> เลือกหน่วยงานจากบอร์ด
        </DialogTitle>
        <DialogDescription>
          ทุกหน่วยงานที่มีใบขอตั้งแต่ปี 2567 — กดเพื่อเติมชื่อหน่วยงานและรหัสไซต์ลงฟอร์ม
          (หน่วยงานที่ยังมีใบขอเปิดอยู่ขึ้นก่อน)
        </DialogDescription>
      </DialogHeader>
      <BoardUnitPickerBody units={units} onPick={onPick} />
    </DialogContent>
  </Dialog>
);

export default BoardUnitPicker;

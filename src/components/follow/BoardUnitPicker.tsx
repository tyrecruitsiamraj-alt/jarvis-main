import React, { useMemo, useState } from 'react';
import {
  buildBoardUnitOptions,
  filterBoardUnits,
  type BoardUnitOption,
} from '@/lib/boardUnitPicker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SearchField from '@/components/shared/SearchField';
import { Building2 } from 'lucide-react';
import type { JobRequest } from '@/types';

/**
 * เลือก **หน่วยงานจากบอร์ด** — คู่แฝดของ `BoardPersonPicker`
 * (เจ้าของสั่ง 18 ส.ค. 2569: *"หน่วยงานก็ทำเหมือนปุ่มเลือกชื่อจากบอร์ด"*)
 *
 * ใช้ใบขอเปิดชุดเดียวกับที่ฟอร์มโหลดไว้อยู่แล้ว — ไม่ยิงเส้นใหม่
 * ตรรกะยุบ/ค้นอยู่ที่ `boardUnitPicker.ts` (pure + เทสต์) ที่เดียว
 */
export type BoardUnitPickerProps = {
  open: boolean;
  onClose: () => void;
  /** ใบขอที่ยังเปิด (ชุดเดียวกับ dropdown เดิม) */
  jobs: JobRequest[];
  onPick: (unit: BoardUnitOption) => void;
};

const BoardUnitPicker: React.FC<BoardUnitPickerProps> = ({ open, onClose, jobs, onPick }) => {
  const [query, setQuery] = useState('');
  const units = useMemo(() => buildBoardUnitOptions(jobs), [jobs]);
  const shown = useMemo(() => filterBoardUnits(units, query), [units, query]);

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> เลือกหน่วยงานจากบอร์ด
          </DialogTitle>
          <DialogDescription>
            หน่วยงานที่ยังมีใบขอเปิดอยู่ — กดเพื่อเติมชื่อหน่วยงานและรหัสไซต์ลงฟอร์ม
          </DialogDescription>
        </DialogHeader>

        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นชื่อหน่วยงาน / รหัสไซต์ / เลขที่ใบขอ / ตำแหน่ง"
          wrapperClassName="w-full"
        />

        {units.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ยังโหลดใบขอไม่ได้ — ปิดหน้าต่างนี้แล้วพิมพ์ชื่อหน่วยงานเองได้
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
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
                      <span className="jarvis-chip jarvis-chip-info">
                        ใบขอเปิด {u.openRequests.toLocaleString('th-TH')}
                      </span>
                      {u.remainingPositions > 0 ? (
                        <span className="jarvis-chip jarvis-chip-warn">
                          ยังต้องหา {u.remainingPositions.toLocaleString('th-TH')}
                        </span>
                      ) : null}
                      <span className="w-full text-[11px] text-muted-foreground">
                        {[u.roles.join(' · '), u.sampleRequestNo ? `เช่น ${u.sampleRequestNo}` : null]
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
      </DialogContent>
    </Dialog>
  );
};

export default BoardUnitPicker;

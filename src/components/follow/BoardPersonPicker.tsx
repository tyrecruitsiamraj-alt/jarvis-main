import React, { useEffect, useMemo, useState } from 'react';
import {
  filterPickerPeople,
  listBoardPickerPeople,
  pickerDisplayName,
  type BoardPickerPerson,
} from '@/lib/boardPickerApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SearchField from '@/components/shared/SearchField';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Users } from 'lucide-react';
import { friendlyErrorText } from '@/lib/friendlyError';

/**
 * เลือกชื่อจากบอร์ด ERP มาตั้งตารางโทรตาม (F5b · เจ้าของเคาะ 16 ส.ค. 2569)
 *
 * เดิมหน้า Follow ต้องคีย์ชื่อ+เบอร์เอง — พิมพ์ผิดคือโทรผิดคน
 * ขอบเขตรายชื่อ: ทุกถังยกเว้น Checklist + ตัดคนที่แจ้งเข้าแล้ว (server กรอง)
 * ค้นฝั่ง client เหมือนหน้า "ผู้สมัคร" — โหลดครั้งเดียวตอนเปิด
 */
export type BoardPersonPickerProps = {
  open: boolean;
  onClose: () => void;
  onPick: (person: BoardPickerPerson) => void;
};

/**
 * เนื้อของ picker (โหลด + ค้น + รายการ) แยกออกมาเพื่อ **ฝังในป๊อปเดิม** — ห้าม Dialog ซ้อน Dialog
 * (QA 5 ต.ค. 2569: ป๊อปเพิ่มคนเปิดป๊อปนี้ซ้อนอีกชั้น · แพตเทิร์นเดียวกับ `BoardUnitPickerBody`)
 */
export const BoardPersonPickerBody: React.FC<{
  onPick: (person: BoardPickerPerson) => void;
  /** จำกัดความสูงของรายการเมื่อฝังในพื้นที่แคบ */
  listClassName?: string;
}> = ({ onPick, listClassName }) => {
  const [people, setPeople] = useState<BoardPickerPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listBoardPickerPeople()
      .then((rows) => {
        if (!cancelled) setPeople(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(friendlyErrorText(e, 'โหลดรายชื่อไม่สำเร็จ'));
      });
    return () => {
      cancelled = true;
    };
  }, [rev]);

  const shown = useMemo(() => filterPickerPeople(people ?? [], query), [people, query]);

  return (
    <>
      <SearchField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นชื่อ / สกิล / พื้นที่ / เบอร์"
        wrapperClassName="w-full"
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!people && !error ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" aria-hidden />
          กำลังโหลดรายชื่อ…
        </p>
      ) : null}

      {people ? (
        <div className={listClassName ?? 'min-h-0 flex-1 overflow-y-auto'}>
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              ไม่พบชื่อที่ค้น — ลองคำสั้นลง หรือค้นด้วยเบอร์
            </p>
          ) : (
            <ul className="space-y-1">
              {shown.map((p) => (
                <li key={p.card_id}>
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-left text-xs hover:bg-secondary"
                  >
                    <span className="font-medium text-foreground">{pickerDisplayName(p)}</span>
                    {p.nick_name ? (
                      <span className="text-muted-foreground">({p.nick_name})</span>
                    ) : null}
                    <span className="font-mono text-muted-foreground">{p.mobile}</span>
                    {p.column_label ? (
                      <span className="jarvis-chip jarvis-chip-info">{p.column_label}</span>
                    ) : null}
                    {/* 🔴 ป้าย "แจ้งเข้าแล้ว" (18 ส.ค. 2569 ค่ำ-2) — คนกลุ่มนี้เพิ่งถูกเอา
                        กลับเข้ากล่องตามที่เจ้าของสั่ง ต้องเห็นชัดว่าเขา **ได้งานแล้ว**
                        ไม่งั้นเผลอตั้งเรื่องหางานให้คนที่มีงานอยู่แล้ว */}
                    {p.is_informed ? (
                      <span className="jarvis-chip jarvis-chip-success">แจ้งเข้าแล้ว</span>
                    ) : null}
                    <span className="w-full text-[11px] text-muted-foreground">
                      {[p.skills, p.area].filter(Boolean).join(' · ') || 'ไม่ระบุสกิล/พื้นที่'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="pt-2 text-[11px] text-muted-foreground">
            แสดง {shown.length.toLocaleString('th-TH')} จาก {people.length.toLocaleString('th-TH')} คน
            {shown.length >= 100 ? ' (พิมพ์ค้นเพิ่มเพื่อแคบผลลง)' : ''}
          </p>
        </div>
      ) : null}
      {error ? (
        <Button type="button" size="xs" variant="outline" onClick={() => setRev((n) => n + 1)}>
          ลองใหม่
        </Button>
      ) : null}
    </>
  );
};

const BoardPersonPicker: React.FC<BoardPersonPickerProps> = ({ open, onClose, onPick }) => (
  <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
    <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> เลือกชื่อจากบอร์ด
        </DialogTitle>
        <DialogDescription className="sr-only">เลือกชื่อจากบอร์ด</DialogDescription>
      </DialogHeader>
      {open ? <BoardPersonPickerBody onPick={onPick} /> : null}
    </DialogContent>
  </Dialog>
);

export default BoardPersonPicker;

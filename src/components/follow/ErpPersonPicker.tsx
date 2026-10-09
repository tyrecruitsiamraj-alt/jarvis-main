import React, { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import SearchField from '@/components/shared/SearchField';
import { Button } from '@/components/ui/button';
import { friendlyErrorText } from '@/lib/friendlyError';
import { formatYmdDmyBe, toYmdBangkok } from '@/lib/dateTh';
import { ERP_PEOPLE_MIN_QUERY, erpPersonDisplayName, searchErpPeople, type ErpPerson } from '@/lib/erpPeopleApi';

/**
 * ค้นชื่อจาก ERP มาเติมฟอร์มเพิ่มคนหน้าติดตาม (เจ้าของ 9 ต.ค. 2569 *"ดึงชื่อพนักงานจาก บอร์ด เอาเป็นจาก Erp แทน"*)
 * ฝังในป๊อปเดิม (ห้าม Dialog ซ้อน Dialog) · พิมพ์แล้วค้นฝั่ง server (หน่วง 350 ms · ตัดคำค้นเก่าทิ้ง)
 */
export const ErpPersonPickerBody: React.FC<{
  onPick: (person: ErpPerson) => void;
  listClassName?: string;
}> = ({ onPick, listClassName }) => {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<ErpPerson[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = query.replace(/\s/g, '').length >= ERP_PEOPLE_MIN_QUERY;

  useEffect(() => {
    if (!ready) {
      setPeople(null);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchErpPeople(query, ctrl.signal)
        .then((rows) => {
          setPeople(rows);
          setError(null);
        })
        .catch((e: unknown) => {
          if (ctrl.signal.aborted) return;
          setError(friendlyErrorText(e, 'ค้นรายชื่อไม่สำเร็จ'));
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, ready]);

  const dateOf = (iso: string | null) => (iso ? formatYmdDmyBe(toYmdBangkok(new Date(iso))) : null);

  return (
    <>
      <SearchField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นชื่อ นามสกุล ชื่อเล่น หรือเบอร์"
        wrapperClassName="w-full"
        autoFocus
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className={listClassName ?? 'min-h-0 flex-1 overflow-y-auto'}>
        {!ready ? (
          <p className="py-6 text-center text-sm text-muted-foreground">พิมพ์อย่างน้อย {ERP_PEOPLE_MIN_QUERY} ตัวอักษร</p>
        ) : loading && !people ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            กำลังค้นใน ERP…
          </p>
        ) : people && people.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">ไม่พบชื่อนี้ใน ERP</p>
        ) : people ? (
          <ul className="space-y-1" data-testid="erp-person-list">
            {people.map((p) => {
              const informed = dateOf(p.inform_date);
              const applied = dateOf(p.application_date);
              return (
                <li key={p.key}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onPick(p)}
                    className="h-auto w-full flex-wrap justify-start gap-x-2 gap-y-0.5 rounded-xl px-3 py-2 text-left text-xs font-normal"
                  >
                    <span className="font-medium text-foreground">{erpPersonDisplayName(p)}</span>
                    {p.nick_name ? <span className="text-muted-foreground">({p.nick_name})</span> : null}
                    <span className="tabular-nums text-muted-foreground">{p.mobile}</span>
                    <span className="w-full text-xs text-muted-foreground">
                      {[informed ? `แจ้งเข้า ${informed}` : applied ? `สมัคร ${applied}` : null, p.site_name]
                        .filter(Boolean)
                        .join(' · ') || 'ไม่มีวันแจ้งเข้า'}
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </>
  );
};

export default ErpPersonPickerBody;

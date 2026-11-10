/**
 * รายการใบขอในแผง "ใบขอใหม่ ประกาศไปแค่ไหน" ของหน้าหลักโฉมต้นแบบ — กดชื่อใบ = หน้าใบขอ · กด "N คน" = รายชื่อคนกรอก
 * ค้นหา (หน่วยงาน · ตำแหน่ง · เลขใบ) + ดูทีละ 50 (ชุดส่งต่อ 10 พ.ย. 2569 G04) · เปิดชุดใหม่ = key ใหม่ ⇒ คำค้นไม่ค้าง
 */
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import NamesSearchInput, { NAMES_PAGE, matchesNameQuery } from '@/components/shared/NamesSearchInput';
import type { RecruitRequestItem } from '@/lib/recruitOverviewTypes';
import { thaiDate } from '@/lib/periodPick';

const NUM = new Intl.NumberFormat('th-TH');

export default function RequestListPanel({
  list,
  onOpenRequest,
  onOpenNames,
}: {
  list: readonly RecruitRequestItem[];
  onOpenRequest: (jobId: string) => void;
  onOpenNames: (r: RecruitRequestItem) => void;
}) {
  const [term, setTerm] = useState('');
  const [limit, setLimit] = useState(NAMES_PAGE);
  const shown = useMemo(() => list.filter((r) => matchesNameQuery([r.unitName, r.position, r.requestNo], term)), [list, term]);
  return (
    <div className="space-y-2">
      {list.length > 5 ? (
        <NamesSearchInput
          value={term}
          onChange={(v) => {
            setTerm(v);
            setLimit(NAMES_PAGE);
          }}
          found={term.trim() ? shown.length : null}
          placeholder="ค้นหา หน่วยงาน ตำแหน่ง เลขใบ"
          unit="ใบ"
        />
      ) : null}
      <ul className="divide-y divide-border rounded-xl border border-border" data-testid="v5-request-list">
        {shown.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">{list.length === 0 ? 'ไม่มีใบขอ' : 'ไม่เจอใบที่ค้นหา'}</li> : null}
        {shown.slice(0, limit).map((r) => (
          <li key={r.jobId ?? r.requestNo} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
            <span className="min-w-0">
              {r.jobId ? (
                <Button type="button" variant="link" className="h-auto whitespace-normal p-0 text-left text-sm font-normal text-foreground" onClick={() => onOpenRequest(r.jobId!)}>
                  {r.unitName ?? '—'} · {r.position ?? '—'}
                </Button>
              ) : (
                <span className="text-foreground">
                  {r.unitName ?? '—'} · {r.position ?? '—'}
                </span>
              )}
              <span className="block text-xs tabular-nums text-muted-foreground">
                {r.requestNo} · เข้ามา {thaiDate(r.day)}
              </span>
            </span>
            <Button type="button" variant="link" className="h-auto shrink-0 p-0 text-sm tabular-nums" disabled={r.appIds.length === 0} onClick={() => onOpenNames(r)}>
              {NUM.format(r.applications)} คน
            </Button>
          </li>
        ))}
      </ul>
      {shown.length > limit ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setLimit((n) => n + NAMES_PAGE)}>
          ดูเพิ่ม ({NUM.format(shown.length - limit)} ใบ)
        </Button>
      ) : null}
    </div>
  );
}

/**
 * การสั่งงานรายคน — คนละแถว (เจ้าของ 19 พ.ย. 2569 Choice "ในการสั่งงาน คนละแถว") · ตัวนับ `outreachByPerson`
 * กดชื่อ = แผงโพสต์เองของคนนั้น (ลิงก์ · กลุ่ม · คนที่กรอก)
 * รายชื่อที่คนนั้นเอาเข้ามา → สนใจ → นัด → มาจริง (เจ้าของ 19 พ.ย. 2569 "เจมส์รายชื่อทั้งหมดเท่าไหร่ ไปจนถึงนัดแล้วมาเนี่ยเท่าไหร่")
 * กดเลข = แผงเรื่องเล่ารายชื่อชุดนั้น (มาจากไหน · กราฟ BU · แนวโน้ม) แบบเดียวกับกดหัวกล่อง
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { PERSON_FUNNEL_KEYS, outreachTotals, type OutreachNumbers, type OutreachPerson, type PersonFunnel } from '@/lib/outreachByPerson';
import { fmt } from './V2Parts';

const FUNNEL_LABEL: Record<keyof PersonFunnel, string> = { names: 'รายชื่อ', interested: 'สนใจ', booked: 'นัด', showed: 'มาจริง' };
const COLS: Array<[keyof OutreachNumbers, string]> = [
  ['autopost', 'Autopost (ครั้งที่สั่ง)'],
  ['gen', 'โพสต์เอง · Gen link'],
  ['posted', 'โพสต์เอง · โพสต์แล้ว'],
  ['scrap', 'Scrap (ใบ)'],
  ['clicks', 'คลิก'],
  ['applicants', 'กรอก'],
];
/** คอลัมน์ของลิงก์โพสต์เอง — กดแล้วเปิดลิงก์ของคนนั้น */
const LINK_COLS = new Set<keyof OutreachNumbers>(['gen', 'posted', 'clicks', 'applicants']);

export default function OutreachPeopleTable({
  people,
  onPerson,
  onIds,
}: {
  people: readonly OutreachPerson[] | null;
  /** กดเลขโพสต์เอง (Gen link · โพสต์แล้ว · คลิก · กรอก) = ลิงก์ของคนนั้น */
  onPerson?: (name: string) => void;
  /** กดเลขรายชื่อ/สนใจ/นัด/มาจริง */
  onIds?: (title: string, ids: readonly string[]) => void;
}) {
  if (!people) return <Skeleton className="h-40 rounded-xl" />;
  const t = outreachTotals(people);
  return (
    <section className="min-w-0 space-y-1.5" data-testid="v2-outreach-people">
      <h3 className="text-sm font-medium">รายคน</h3>
      <div className="min-w-0 max-w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ผู้รับผิดชอบ</TableHead>
              {PERSON_FUNNEL_KEYS.map((k) => (
                <TableHead key={k} className="text-right">
                  {FUNNEL_LABEL[k]}
                </TableHead>
              ))}
              {COLS.map(([k, l]) => (
                <TableHead key={k} className="text-right">
                  {l}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLS.length + PERSON_FUNNEL_KEYS.length + 1} className={DASH.sub}>
                  ไม่มีการสั่งงานในช่วงนี้
                </TableCell>
              </TableRow>
            ) : null}
            {people.map((p) => (
              <TableRow key={p.name}>
                {/* ชื่อไม่เป็นลิงก์ทุกแถว — เดิมกดได้เฉพาะคนที่มีลิงก์โพสต์เอง (เจ้าของ 19 พ.ย. 2569 "ใหม่กดดูได้ เจมส์กดดูไม่ได้มันตลกๆไหม")
                    กดเลขแทน: รายชื่อ/สนใจ/นัด/มาจริง = รายชื่อ · โพสต์เอง/คลิก/กรอก = ลิงก์ของคนนั้น */}
                <TableCell className="whitespace-nowrap">{p.name}</TableCell>
{PERSON_FUNNEL_KEYS.map((k) => (
                  <TableCell key={k} className="text-right tabular-nums">
                    {p[k].length && onIds ? (
                      <Button type="button" variant="link" size="sm" className="h-auto p-0 tabular-nums" onClick={() => onIds(`${p.name} · ${FUNNEL_LABEL[k]}`, p[k])}>
                        {fmt(p[k].length)}
                      </Button>
                    ) : (
                      <span className={cn(p[k].length === 0 && DASH.muted)}>{fmt(p[k].length)}</span>
                    )}
                  </TableCell>
                ))}
                {COLS.map(([k]) => (
                  <TableCell key={k} className={cn('text-right tabular-nums', p[k] === 0 && DASH.muted)}>
                    {onPerson && p[k] > 0 && LINK_COLS.has(k) ? (
                      <Button type="button" variant="link" size="sm" className="h-auto p-0 tabular-nums" onClick={() => onPerson(p.name)} data-testid="v2-outreach-person-links">
                        {fmt(p[k])}
                      </Button>
                    ) : (
                      fmt(p[k])
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-medium">รวม</TableCell>
              {PERSON_FUNNEL_KEYS.map((k) => (
                <TableCell key={k} className="text-right font-medium tabular-nums">
                  {t[k].length && onIds ? (
                    <Button type="button" variant="link" size="sm" className="h-auto p-0 font-medium tabular-nums" onClick={() => onIds(`ทุกคน · ${FUNNEL_LABEL[k]}`, t[k])}>
                      {fmt(t[k].length)}
                    </Button>
                  ) : (
                    fmt(t[k].length)
                  )}
                </TableCell>
              ))}
              {COLS.map(([k]) => (
                <TableCell key={k} className="text-right font-medium tabular-nums">
                  {fmt(t[k])}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

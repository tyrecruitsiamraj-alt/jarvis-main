/**
 * ═══ แถบ "ต้องทำ" เหนือแท็บหน้าหลัก (เจ้าของ 21 ต.ค. 2569) ═══
 * โหวต 4 บทบาท ข้อ D (กล่องต้องทำ) + E (ใบขอเข้ามา · ประกาศแล้ว ขึ้นบนสุด) → Choice "แถบเดียวเหนือแท็บ"
 * - แถวแรก: ใบขอเข้ามา · ประกาศแล้ว (ตัวเดียวกับแท็บทีม Online "ส่งไปประกาศ")
 * - แถวสอง: ต้องทำของแต่ละแท็บ — กดแล้วเปิดแท็บนั้นและเลื่อนไปส่วนที่มีเลขเดียวกัน
 * เลขมาจาก `/api/home-ai-share?todo=1` (ตัวนับชุดเดียวกับแท็บ) · ช่วง/BU ตามหน้า · อ่านไม่ได้ = "—"
 * 🔴 shadcn Button/Card · สีจาก TONE · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchHomeTodo } from '@/lib/homeAiShareApi';
import { homeQueryKey, type AiShareBlockKey, type AiShareWindow, type HomeTodoResponse } from '@/lib/homeAiShare';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

/** แท็บปลายทาง — `online` = ทีม Online · ที่เหลือ = หัวข้อของหน้า */
export type TodoTab = 'online' | AiShareBlockKey;

type TodoItem = { key: string; tab: TodoTab; target: string; label: string; value: number | null; tone: ToneKey };

export function todoItemsOf(d: HomeTodoResponse | null): TodoItem[] {
  return [
    { key: 'notReleased', tab: 'online', target: 'online-posting', label: 'ยังไม่ประกาศ', value: d?.requests?.notReleasedOpen ?? null, tone: 'warn' },
    { key: 'followStaff', tab: 'follow', target: 'home-intro', label: 'รอคนโทร', value: d?.followWaitingStaff ?? null, tone: 'violet' },
    { key: 'notSent', tab: 'applicants', target: 'report-steps', label: 'ไม่ได้ส่ง AI', value: d?.applicantsNotSent ?? null, tone: 'neutral' },
    { key: 'greenFree', tab: 'matching', target: 'report-extra-ต้องสั่งงาน', label: 'เขียวยังว่าง', value: d?.matchingGreenFree ?? null, tone: 'success' },
    { key: 'aftercare', tab: 'aftercare', target: 'home-intro', label: 'รอโทรหลังเริ่มงาน', value: d?.aftercareWaiting ?? null, tone: 'info' },
  ];
}

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : NUM.format(n));

const HomeTodoStrip: React.FC<{
  q: AiShareWindow & { bu?: string | null };
  tick: number;
  onGo: (tab: TodoTab, target: string) => void;
}> = ({ q, tick, onGo }) => {
  const [data, setData] = useState<{ key: string; d: HomeTodoResponse } | null>(null);
  useEffect(() => {
    let alive = true;
    const key = homeQueryKey(q);
    fetchHomeTodo(q)
      .then((d) => {
        if (alive) setData({ key, d });
      })
      .catch(() => {
        // ล้ม = เลขเดิมค้าง/ขึ้น "—" — แถบนี้เป็นทางลัด ห้ามบังหน้า
      });
    return () => {
      alive = false;
    };
  }, [q, tick]);
  const d = data?.key === homeQueryKey(q) ? data.d : null;
  const req = d?.requests ?? null;
  return (
    <Card variant="solid" className="space-y-3 p-4" data-testid="home-todo">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Button
          type="button"
          variant="ghost"
          className="h-auto gap-4 px-2 py-1 font-normal"
          onClick={() => onGo('online', 'online-posting')}
          data-testid="home-todo-requests"
        >
          <span className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">ใบขอเข้ามา</span>
            <span className="text-2xl font-medium tabular-nums text-foreground">{fmt(req?.total)}</span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">ประกาศแล้ว</span>
            <span className={cn('text-2xl font-medium tabular-nums', TONE.success.value)}>{fmt(req?.released)}</span>
          </span>
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2" data-testid="home-todo-items">
        <span className="text-sm font-medium text-foreground">ต้องทำ</span>
        {todoItemsOf(d).map((it) => (
          <Button
            key={it.key}
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 rounded-full font-normal"
            onClick={() => onGo(it.tab, it.target)}
            data-testid={`home-todo-${it.key}`}
          >
            <span className={cn('h-2 w-2 rounded-full', TONE[it.tone].dot)} aria-hidden />
            {it.label}
            <span className="font-medium tabular-nums text-foreground">{fmt(it.value)}</span>
          </Button>
        ))}
      </div>
    </Card>
  );
};

export default HomeTodoStrip;

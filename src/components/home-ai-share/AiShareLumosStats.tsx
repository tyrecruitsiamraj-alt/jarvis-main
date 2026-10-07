/**
 * ═══ เลขตามหัวข้อบอท Lumos ในการ์ดเดิมของหน้าหลัก (เจ้าของ 7 ต.ค. 2569) ═══
 * เจ้าของ: *"ฉันไม่ได้ต้องการให้เป็นแบบบอท แต่ฉันหมายถึงตัวเลขต้องได้ตามหัวข้อแบบที่บอททำ"* → Choice "ในการ์ดเดิมตาม Dropdown"
 * - หัวข้อติดตาม = งานติดตาม: งานที่ต้องติดตาม · มีผลการโทร · รอดำเนินการ · ล้มเหลว · ยกเลิก
 * - หัวข้อผู้สมัคร = งานรับสมัคร: ใบสมัคร · มีผลแล้ว · ยังรอ · ล้มเหลว · ยกเลิก + งานเก่าที่ต้องติดตาม
 * - หัวข้ออื่น (บอทไม่มี) = ไม่มีแถวนี้
 * นับงานที่ส่งให้ AI (คิว Lumos ของเรา) ช่วงเดียวกับปฏิทิน · บรรทัดบวกให้เห็น (ไม่ลงตัว = แดง) · นิยาม `src/lib/homeLumosSummary.ts`
 * 🔴 หน้าตาของหน้าหลักเดิม (ไม่ทำหน้าตาแบบบอท) · สีเลขจาก TONE · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TONE } from '@/lib/designTokens';
import type { AiShareBlockKey, AiShareWindow } from '@/lib/homeAiShare';
import { fetchHomeLumosSummary } from '@/lib/homeAiShareApi';
import { lumosBucketAddsUp, type HomeLumosSummaryResponse, type LumosBucket } from '@/lib/homeLumosSummary';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

type Tone = 'success' | 'warn' | 'danger' | 'neutral' | null;
type Cell = { key: keyof LumosBucket | 'backlog'; label: string; tone: Tone };

const FOLLOW: Cell[] = [
  { key: 'total', label: 'งานที่ต้องติดตาม', tone: null },
  { key: 'done', label: 'มีผลการโทร', tone: 'success' },
  { key: 'waiting', label: 'รอดำเนินการ', tone: 'warn' },
  { key: 'failed', label: 'ล้มเหลว', tone: 'danger' },
  { key: 'cancelled', label: 'ยกเลิก', tone: 'neutral' },
];
const APPLICANTS: Cell[] = [
  { key: 'total', label: 'ใบสมัคร', tone: null },
  { key: 'done', label: 'มีผลแล้ว', tone: 'success' },
  { key: 'waiting', label: 'ยังรอ', tone: 'warn' },
  { key: 'failed', label: 'ล้มเหลว', tone: 'danger' },
  { key: 'cancelled', label: 'ยกเลิก', tone: 'neutral' },
];

const AiShareLumosStats: React.FC<{ block: AiShareBlockKey; win: AiShareWindow; tick: number }> = ({ block, win, tick }) => {
  const shown = block === 'follow' || block === 'applicants';
  const [data, setData] = useState<HomeLumosSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const winRef = useRef(win);
  winRef.current = win;

  useEffect(() => {
    if (!shown) return;
    let alive = true;
    setError(null);
    fetchHomeLumosSummary(win)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error && e.message ? e.message : 'โหลดไม่ขึ้น ลองรีเฟรชอีกครั้ง');
      });
    return () => {
      alive = false;
    };
  }, [win, shown]);

  // อัปเดตสดรอบเดียวกับหน้า — โหลดเงียบ เลขเดิมค้างจนเลขใหม่มา
  useEffect(() => {
    if (tick === 0 || !shown) return;
    let alive = true;
    fetchHomeLumosSummary(winRef.current)
      .then((d) => {
        if (alive && d.from === winRef.current.from && d.to === winRef.current.to) {
          setData(d);
          setError(null);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick, shown]);

  if (!shown) return null;
  const current = data && data.from === win.from && data.to === win.to ? data : null;
  const b = current ? (block === 'follow' ? current.follow : current.applicants) : null;
  const cells: Cell[] = block === 'follow' ? FOLLOW : [...APPLICANTS, { key: 'backlog', label: 'งานเก่าที่ต้องติดตาม', tone: 'warn' }];
  const valueOf = (k: Cell['key']) => (k === 'backlog' ? (current?.backlog ?? null) : b ? b[k] : null);
  const failed = error ?? current?.error ?? null;

  return (
    <div className="space-y-3" data-testid={`lumos-stats-${block}`}>
      <h3 className="text-sm font-medium text-foreground">{block === 'follow' ? 'งานติดตาม' : 'งานรับสมัคร'} · ส่งให้ AI</h3>
      {failed ? <p className={cn('text-sm', TONE.danger.value)}>{failed}</p> : null}
      <div className={cn('grid grid-cols-2 gap-3', block === 'follow' ? 'sm:grid-cols-5' : 'sm:grid-cols-3 xl:grid-cols-6')}>
        {cells.map((c) => {
          const n = valueOf(c.key);
          return (
            <div key={c.key} className="space-y-1 rounded-xl border border-border/70 px-3 py-2" data-testid={`lumos-${block}-${c.key}`}>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {c.tone ? <span className={cn('h-2 w-2 rounded-full', TONE[c.tone].dot)} aria-hidden /> : null}
                {c.label}
              </span>
              {n === null ? (
                <Skeleton className="h-7 w-14" />
              ) : (
                <span className={cn('block text-xl font-light tabular-nums', n > 0 && c.tone && c.tone !== 'neutral' ? TONE[c.tone].value : 'text-foreground')}>
                  {NUM.format(n)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {b ? (
        <p className={cn('text-xs tabular-nums', lumosBucketAddsUp(b) ? 'text-muted-foreground' : TONE.danger.value)} data-testid={`lumos-${block}-sum`}>
          {NUM.format(b.done)} + {NUM.format(b.waiting)} + {NUM.format(b.failed)} + {NUM.format(b.cancelled)} ={' '}
          {NUM.format(b.done + b.waiting + b.failed + b.cancelled)}
          {lumosBucketAddsUp(b) ? '' : ` · ไม่ตรงกับ ${NUM.format(b.total)}`}
        </p>
      ) : null}
    </div>
  );
};

export default AiShareLumosStats;

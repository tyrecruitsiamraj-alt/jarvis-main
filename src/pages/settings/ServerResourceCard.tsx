/**
 * ═══ ตั้งค่า › สถานะระบบ › เครื่องเซิร์ฟเวอร์ (เจ้าของ 28 ต.ค. 2569 "เช็ค performance issue ให้ทีมันน่าจะชอบทำให้ล่ม") ═══
 * ตัวจดทุก 1 นาที `api/_lib/systemResourceSampler.ts` · ตัวคิด `src/lib/systemResources.ts`
 * ช่วงที่ตัวจดเงียบ = เครื่องค้าง ล่ม หรือ deploy · ว่างแล้วยังโชว์ตาราง (แถว "ไม่มี")
 */
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchSystemResources } from '@/lib/systemHealthApi';
import { loadLevelOf, memLevelOf, type ResourceLevel, type ResourceSummary } from '@/lib/systemResources';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const WHEN = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const NUM = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 });
const LEVEL_TEXT: Record<ResourceLevel, string> = { ok: TONE.success.value, warn: TONE.warn.value, danger: TONE.danger.value };

const when = (iso: string | null | undefined) => (iso ? WHEN.format(new Date(iso)) : '—');
const gb = (mb: number | null | undefined) => (mb == null ? '—' : `${NUM.format(mb / 1024)} GB`);

function Tile({ label, value, sub, level }: { label: string; value: string; sub: string; level?: { level: ResourceLevel; word: string } | null }) {
  return (
    <div className="space-y-1 rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-medium tabular-nums text-foreground">{value}</p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {level ? <span className={cn('font-medium', LEVEL_TEXT[level.level])}>{level.word} · </span> : null}
        {sub}
      </p>
    </div>
  );
}

const ServerResourceCard: React.FC = () => {
  const [data, setData] = useState<ResourceSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchSystemResources()
        .then((d) => {
          if (!alive) return;
          setData(d);
          setError('');
        })
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'อ่านแรม/โหลดเครื่องไม่สำเร็จ'));
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const s = data?.latest ?? null;
  const p = data?.peak24h;
  const swapUsed = s?.swapTotalMb ? (s.swapTotalMb ?? 0) - (s.swapFreeMb ?? 0) : null;

  return (
    <Card variant="solid" className="space-y-4 p-4" data-testid="server-resource-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">เครื่องเซิร์ฟเวอร์</h3>
        <p className="text-xs tabular-nums text-muted-foreground">จดล่าสุด {when(s?.sampledAt)}</p>
      </div>
      {error ? <p className={cn('text-xs', TONE.danger.value)}>{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="แรมเหลือ" value={gb(s?.memAvailableMb)} sub={`จาก ${gb(s?.memTotalMb)}`} level={memLevelOf(s?.memAvailableMb ?? null, s?.memTotalMb ?? null)} />
        <Tile label="swap ใช้อยู่" value={gb(swapUsed)} sub={s?.swapTotalMb ? `จาก ${gb(s.swapTotalMb)}` : 'ไม่มี swap'} />
        <Tile
          label="โหลดเครื่อง"
          value={s?.load1 == null ? '—' : NUM.format(s.load1)}
          sub={s?.cpuCount ? `${s.cpuCount} CPU` : '—'}
          level={loadLevelOf(s?.load1 ?? null, s?.cpuCount ?? null)}
        />
        <Tile label="แรมของเว็บ" value={gb(s?.apiRssMb)} sub={`เว็บค้างนานสุด ${NUM.format(s?.loopDelayMaxMs ?? 0)} ms`} />
      </div>

      <div className="space-y-1 text-xs tabular-nums text-foreground">
        <p className="font-medium">24 ชม. ที่ผ่านมา</p>
        <p>
          แรมเหลือน้อยสุด {gb(p?.minAvailableMb)} ({when(p?.minAvailableAt)}) · โหลดสูงสุด {p?.maxLoad1 == null ? '—' : NUM.format(p.maxLoad1)} (
          {when(p?.maxLoad1At)}) · แรมของเว็บสูงสุด {gb(p?.maxApiRssMb)} · เว็บค้างนานสุด {NUM.format(p?.maxLoopDelayMs ?? 0)} ms
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">ช่วงที่เครื่องเงียบ (7 วัน)</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">ตั้งแต่</TableHead>
              <TableHead className="text-xs">ถึง</TableHead>
              <TableHead className="text-right text-xs">นาน</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.gaps ?? []).map((g) => (
              <TableRow key={g.from}>
                <TableCell className="text-xs tabular-nums">{when(g.from)}</TableCell>
                <TableCell className="text-xs tabular-nums">{when(g.to)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{NUM.format(g.minutes)} นาที</TableCell>
              </TableRow>
            ))}
            {data && data.gaps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-xs text-muted-foreground">
                  ไม่มี
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default ServerResourceCard;

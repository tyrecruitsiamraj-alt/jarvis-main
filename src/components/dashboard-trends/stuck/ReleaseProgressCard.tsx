import React from 'react';
import { Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import type { StuckRequest } from '@/lib/recruitStuck';
import { OverviewCard } from '../RecruitOverviewParts';

/**
 * ═══ ใบขอใหม่ ประกาศไปแค่ไหน — ย้ายมาจากหน้าหลัก (เจ้าของ 9 พ.ย. 2569 "ตามร่างทั้งหมด": ประกาศเป็นงานของทีมสรรหา) ═══
 * ใบขอใหม่ = ใบที่ส่งเข้ามาในช่วง (ชุดเดียวกับกล่อง "ขอใหม่" ของสมการบนสุด) · ตามตัวกรองบนสุด · กดเลขได้รายใบ
 * ประกาศแล้ว + ยังไม่ประกาศ·ยังเปิด + ไม่ได้ประกาศ·ปิดไปแล้ว = ขอใหม่ · มีคนกรอก + ไม่มีคนกรอก = ประกาศแล้ว
 */
export default function ReleaseProgressCard({ rows, onPick }: { rows: readonly StuckRequest[]; onPick: (title: string, list: StuckRequest[]) => void }) {
  const fresh = rows.filter((r) => r.inRange !== false);
  const released = fresh.filter((r) => r.released);
  const openNot = fresh.filter((r) => !r.released && (r.state ?? 'open') === 'open');
  const closedNot = fresh.filter((r) => !r.released && (r.state ?? 'open') !== 'open');
  const withApps = released.filter((r) => r.applications > 0);
  const noApps = released.filter((r) => r.applications === 0);
  const appsOnReleased = withApps.reduce((n, r) => n + r.applications, 0);
  const box = (label: string, list: StuckRequest[], tone: ToneKey, sub?: string, testId?: string) => (
    <Button
      type="button"
      variant="ghost"
      disabled={list.length === 0}
      onClick={() => onPick(label, list)}
      className={cn('h-auto flex-col items-start gap-0 whitespace-normal rounded-xl border px-3 py-2 text-left font-normal', TONE[tone].soft)}
      data-testid={testId}
    >
      <span className={cn('text-2xl font-medium tabular-nums', TONE[tone].num)}>{fmt(list.length)}</span>
      <span className="text-xs text-foreground">{label}</span>
      {sub ? <span className={cn('text-xs tabular-nums', DASH.sub)}>{sub}</span> : null}
    </Button>
  );
  return (
    <OverviewCard icon={Megaphone} title="ใบขอใหม่ ประกาศไปแค่ไหน" sub={`${fmt(fresh.length)} ใบ`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="release-progress">
        {box('ประกาศแล้ว', released, 'info', undefined, 'release-released')}
        {box('ยังไม่ประกาศ · ยังเปิด', openNot, openNot.length ? 'warn' : 'neutral', undefined, 'release-open')}
        {box('ไม่ได้ประกาศ · ปิดไปแล้ว', closedNot, 'neutral', undefined, 'release-closed')}
        {box('มีคนกรอก', withApps, 'success', withApps.length ? `${fmt(appsOnReleased)} คน · ใบละ ~${fmt(Math.round(appsOnReleased / withApps.length))} คน` : undefined, 'release-apps')}
        {box('ไม่มีคนกรอก', noApps, noApps.length ? 'warn' : 'neutral', undefined, 'release-noapps')}
      </div>
      <p className={cn('text-xs tabular-nums', DASH.sub)} data-testid="release-sum">
        ประกาศแล้ว {fmt(released.length)} + ยังไม่ประกาศ {fmt(openNot.length)} + ปิดไปแล้ว {fmt(closedNot.length)} = {fmt(fresh.length)} · มีคนกรอก {fmt(withApps.length)} + ไม่มี {fmt(noApps.length)} = {fmt(released.length)}
      </p>
    </OverviewCard>
  );
}

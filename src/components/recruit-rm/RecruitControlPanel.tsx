import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import RecruitFunnelPanel from './RecruitFunnelPanel';
import {
  fetchRecruitRmOverview,
  type RecruitRmOverview,
} from '@/lib/recruitRmOverviewApi';

/**
 * Dashboard "ศูนย์คุมงานสรรหา" — visual control บนหน้ารายชื่อผู้สมัคร
 * (เจ้าของสั่ง 15 ส.ค. 2569: "อยากรู้หมด กันคนเก็บไปเฉย ๆ แต่คนทำงานต้องทำงานง่าย")
 *
 * - ตัวเลขทุกช่องมาจาก /api/recruit-rm-overview (นิยามที่ applicantOverviewSql ที่เดียว)
 * - กดกล่อง = ตั้ง `?bucket=` → ตารางล่างกรองด้วย**เงื่อนไขเดียวกับตัวนับ** (parity)
 * - แผงเดิม (RecruitFunnelPanel) เป็นทางถอย: endpoint พัง/ยังไม่ deploy → render แทน
 *   พร้อมป้าย "โหมดสำรอง" · บังคับมือได้ด้วย `?panel=classic`
 * - อ่านไม่ได้ = ขีด + ป้ายเหตุผล **ไม่ใช่ 0** (attendance ก่อนรัน 089)
 */

type BoxDef = {
  bucket: string | null;
  label: string;
  value: number | null;
  sub?: string | null;
  tone: ToneKey;
  title?: string;
};

function StatBox({
  box,
  active,
  onClick,
}: {
  box: BoxDef;
  active: boolean;
  onClick: (bucket: string | null) => void;
}) {
  const tone = TONE[box.tone];
  const clickable = box.bucket !== null && box.value !== null;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onClick(box.bucket)}
      title={box.title || (clickable ? 'กดเพื่อดูรายชื่อในกล่องนี้' : undefined)}
      className={cn(
        'flex min-w-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left',
        tone.soft,
        clickable ? tone.softHover : 'cursor-default',
        active ? 'ring-2 ring-ring' : '',
      )}
    >
      <span className={cn('w-full truncate text-[11px] font-semibold', DASH.muted)}>{box.label}</span>
      <span className={cn('text-xl font-bold leading-none', tone.num)}>
        {box.value === null ? '—' : box.value.toLocaleString('th-TH')}
      </span>
      {box.sub ? (
        <span className={cn('w-full truncate text-[10px]', DASH.muted)} title={box.sub}>
          {box.sub}
        </span>
      ) : null}
    </button>
  );
}

export default function RecruitControlPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<RecruitRmOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showIdleUsers, setShowIdleUsers] = useState(false);

  const classic = searchParams.get('panel') === 'classic';

  useEffect(() => {
    if (classic) return;
    let cancelled = false;
    setLoading(true);
    fetchRecruitRmOverview()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classic]);

  // ทางถอย: แผงเดิมต้องยังใช้ได้เสมอ (กติกา parallel layer)
  if (classic || failed) {
    return (
      <div className="space-y-1">
        {failed ? (
          <p className={cn('text-[11px]', DASH.muted)}>
            ⚠️ โหมดสำรอง — อ่านตัวเลขแผงใหม่ไม่ได้ (แสดงแผงภาพรวมเดิมแทน)
          </p>
        ) : null}
        <RecruitFunnelPanel />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className={cn('animate-pulse rounded-2xl border px-4 py-6 text-center text-xs', DASH.card, DASH.muted)}>
        กำลังโหลดตัวเลขศูนย์คุมงานสรรหา…
      </div>
    );
  }

  const activeBucket = searchParams.get('bucket');
  const setBucket = (bucket: string | null) => {
    if (!bucket) return;
    const params = new URLSearchParams(searchParams);
    if (params.get('bucket') === bucket) params.delete('bucket');
    else params.set('bucket', bucket);
    setSearchParams(params, { replace: true });
  };

  const { intake, calling, contact, appointment, attendance, waiting, stale, meta, recruit } = data;

  const row1: BoxDef[] = [
    {
      bucket: null,
      label: 'กรอกมาทั้งหมด',
      value: intake.total,
      sub: `เบอร์ไม่ซ้ำ ${intake.distinctPhones} · Lead ${intake.leads}`,
      tone: 'primary',
      title: 'ใบสมัครทั้งหมดใน scope ของคุณ (นับเป็นใบ — คนเดียวหลายใบนับหลายใบ)',
    },
    {
      bucket: 'bad_phone',
      label: 'เบอร์โทรผิด',
      value: intake.invalidPhone,
      sub: 'ส่ง AI โทรไม่ได้ — กดเพื่อไปแก้เบอร์',
      tone: 'danger',
    },
    {
      bucket: 'untouched',
      label: 'ยังไม่ถูกโทร',
      value: calling.untouched,
      sub: `ในคิว AI ${calling.inQueueAwaitingAi} · มีคนถือ/เก็บ ${calling.heldOrClaimed}`,
      tone: 'warn',
    },
    {
      bucket: 'called',
      label: 'โทรแล้ว',
      value: calling.called,
      sub: calling.calledViaOtherChannel > 0 ? `ในนั้นจากช่องทางอื่น ${calling.calledViaOtherChannel}` : null,
      tone: 'primary',
    },
    {
      bucket: 'contact_success',
      label: 'ติดต่อสำเร็จ',
      value: contact.success,
      sub: 'รวมคนที่คุยแล้วปฏิเสธ (= ติดต่อถึงตัว)',
      tone: 'success',
    },
    { bucket: 'contact_failed', label: 'ติดต่อไม่สำเร็จ', value: contact.failed, tone: 'danger' },
    // เส้นแบ่งสรรหา→คัดสรร (16 ส.ค.) — สนใจแล้วแต่ยังไม่มาสมัคร vs มาสมัครแล้ว (ขึ้นบอร์ด)
    {
      bucket: null,
      label: 'รอเก็บใบสมัคร',
      value: recruit ? (recruit.waitingCollect < 0 ? null : recruit.waitingCollect) : null,
      sub: 'สนใจแล้วแต่ยังไม่มาสมัคร (งานสรรหา) — ดูรายชื่อที่ชิป "รอเก็บใบสมัคร"',
      tone: 'warn',
      title: 'คนตอบสนใจตอนโทร แต่ชื่อยังไม่ขึ้นบอร์ด (ยังไม่ได้มาสมัคร)',
    },
    {
      bucket: null,
      label: 'ได้ใบสมัครแล้ว',
      value: recruit ? (recruit.collected < 0 ? null : recruit.collected) : null,
      sub: 'ชื่อขึ้นบอร์ดแล้ว (เป็นงานคัดสรรต่อ)',
      tone: 'success',
      title: 'จับคู่ด้วยเบอร์กับรายชื่อบนบอร์ด ERP',
    },
    { bucket: 'scheduled', label: 'สำเร็จ · นัดได้', value: appointment.scheduled, tone: 'success' },
    {
      bucket: 'success_unscheduled',
      label: 'สำเร็จ · ยังนัดไม่ได้',
      value: appointment.successNoAppointment,
      tone: 'warn',
    },
    {
      bucket: null,
      label: 'นัดแล้ว · มา',
      value: attendance ? attendance.showed : null,
      sub: attendance
        ? attendance.overdueNoResult > 0
          ? `เลยนัดยังไม่บันทึกผล ${attendance.overdueNoResult}`
          : `นัดข้างหน้า ${attendance.upcoming}`
        : 'เริ่มบันทึกได้เมื่อรัน migration 089',
      tone: 'success',
      title: 'บันทึกผลที่แท็บติดตามนัดหมาย (ปุ่ม ✓มาแล้ว/✗ไม่มา โผล่ตั้งแต่วันนัด)',
    },
    {
      bucket: null,
      label: 'นัดแล้ว · ไม่มา',
      value: attendance ? attendance.noShow : null,
      tone: 'danger',
      title: 'บันทึกผลที่แท็บติดตามนัดหมาย',
    },
  ];

  const agingTotal = stale.agingUncalled.d0_3 + stale.agingUncalled.d4_7 + stale.agingUncalled.over7;

  return (
    <div className={cn('space-y-3 rounded-2xl border px-4 py-3', DASH.card)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('font-bold', DASH.title)}>
          ศูนย์คุมงานสรรหา
          <span className={cn('ml-2 text-[11px] font-normal', DASH.muted)}>
            ยอดจากฐานของเรา · กดกล่องเพื่อดูรายชื่อ · กดซ้ำเพื่อล้าง
          </span>
        </p>
        {data.scope.departmentLimited ? (
          <span className={cn('text-[10px]', DASH.muted)}>เฉพาะแผนกของคุณ</span>
        ) : null}
      </div>

      {/* แถว 1 — สถานะงานเรียงตามเส้นทางของคน: เข้ามา → โทร → ติดต่อ → นัด → มา */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {row1.map((b) => (
          <StatBox key={b.label} box={b} active={activeBucket === b.bucket && b.bucket !== null} onClick={setBucket} />
        ))}
      </div>

      {/* แถว 2 — เวลา + ความเสี่ยงค้าง (ตัวจี้งาน) */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className={cn('rounded-xl border px-3 py-2', TONE.neutral.soft)}>
          <p className={cn('text-[11px] font-semibold', DASH.muted)}>เวลารอโทร (กรอก → โทรครั้งแรก)</p>
          {waiting ? (
            <p className={cn('text-sm font-bold', TONE.primary.value)}>
              โดยทั่วไป {waiting.medianHours != null ? formatHours(waiting.medianHours) : '—'}
              <span className={cn('ml-2 text-[10px] font-normal', DASH.muted)}>
                ช้าสุด 10% เกิน {waiting.p90Hours != null ? formatHours(waiting.p90Hours) : '—'} · จาก{' '}
                {waiting.sampleSize} ใบ
              </span>
            </p>
          ) : (
            <p className={cn('text-sm', DASH.muted)}>ยังไม่มีใบที่ถูกโทร</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setBucket('over5d')}
          title="กดเพื่อดูรายชื่อที่ค้างเกิน 5 วัน"
          className={cn(
            'rounded-xl border px-3 py-2 text-left',
            TONE.warn.soft,
            TONE.warn.softHover,
            activeBucket === 'over5d' ? 'ring-2 ring-ring' : '',
          )}
        >
          <p className={cn('text-[11px] font-semibold', DASH.muted)}>
            ค้างยังไม่โทร {agingTotal} ใบ (ทั้งหมดทุกช่วง)
          </p>
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className={TONE.success.value}>≤3 วัน {stale.agingUncalled.d0_3}</span>
            <span className={TONE.warn.value}>4-7 วัน {stale.agingUncalled.d4_7}</span>
            <span className={TONE.danger.value}>&gt;7 วัน {stale.agingUncalled.over7}</span>
            <span className={cn('ml-auto text-sm font-bold', TONE.danger.num)}>
              เกิน 5 วัน {stale.over5DaysUncalled}
            </span>
          </p>
        </button>

        <div
          className={cn(
            'rounded-xl border px-3 py-2',
            stale.claimedIdle.total > 0 ? TONE.danger.soft : TONE.neutral.soft,
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setBucket('claimed_idle')}
              title="กดเพื่อดูรายชื่อใบที่ถูกเก็บไปแล้วเงียบ"
              className={cn('text-left', activeBucket === 'claimed_idle' ? 'underline' : '')}
            >
              <p className={cn('text-[11px] font-semibold', DASH.muted)}>เก็บไปแล้วยังไม่โทร (เกิน 1 วัน)</p>
              <p className={cn('text-sm font-bold', stale.claimedIdle.total > 0 ? TONE.danger.num : TONE.success.value)}>
                {stale.claimedIdle.total} ใบ
              </p>
            </button>
            {stale.claimedIdle.byUser.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowIdleUsers((v) => !v)}
                className="jarvis-btn-ghost shrink-0 text-[11px]"
              >
                {showIdleUsers ? 'ซ่อนรายคน' : 'ดูรายคน'}
              </button>
            ) : null}
          </div>
          {/* เจ้าของเคาะ 15 ส.ค.: โชว์ชื่อคนเก็บบน dashboard ให้ทุกคนเห็น (ยอดรวมต่อคน) */}
          {showIdleUsers ? (
            <ul className="mt-1 space-y-0.5 text-[11px]">
              {stale.claimedIdle.byUser.map((u) => (
                <li key={u.name ?? '?'} className="flex justify-between gap-2">
                  <span className="truncate">{u.name ?? 'ไม่ทราบชื่อ'}</span>
                  <span className={cn('shrink-0 font-semibold', TONE.danger.value)}>
                    {u.count} ใบ · ค้างสุด {daysSince(u.oldestClaimedAt)} วัน
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {meta.flags.length > 0 ? (
        <p className={cn('text-[10px]', DASH.muted)}>
          {meta.flags.map((f) => `⚠️ ${f.note}`).join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} นาที`;
  if (h < 48) return `${Math.round(h * 10) / 10} ชม.`;
  return `${Math.round((h / 24) * 10) / 10} วัน`;
}

function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

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
  /** ขั้นในเส้นทางของคน — ใช้จัดกลุ่มบนจอ (เข้ามา → โทร → ติดต่อ → เก็บใบ → นัด) */
  group: StageKey;
};

/**
 * เส้นทางของคนหนึ่งคนในงานสรรหา — เรียงซ้ายไปขวาตามลำดับที่เกิดจริง
 * เดิมเป็นกล่อง 13 ใบเรียงติดกันรวดเดียว อ่านแล้วไม่รู้ว่าอันไหนมาก่อนมาหลัง
 * (เจ้าของสั่ง 17 ส.ค. 2569: *"ศูนย์คุมงานสรรหา ทำให้มันสวยกว่านี้หน่อย"*)
 */
/**
 * ⚠️ ขั้น "นัด → มาไหม" **ย้ายไปหน้าติดตามนัดหมายแล้ว** (เจ้าของสั่ง 20 ส.ค. 2569:
 * *"นัด → มาไหม ย้ายไปหน้าติดตามการนัดหมาย เพื่อให้รู้ว่านัดทั้งหมด/มา/ไม่มาเท่าไหร่"*
 * · เคาะ Choice: "แค่ย้ายก้อนนั้นไป อันอื่น ๆ เก็บไว้") — ดูที่ `RmWorkspace` แท็บ appointments
 */
const STAGES = [
  { key: 'intake', label: 'เข้ามา' },
  { key: 'call', label: 'โทร' },
  { key: 'contact', label: 'ติดต่อ' },
  { key: 'collect', label: 'เก็บใบสมัคร' },
] as const;

type StageKey = (typeof STAGES)[number]['key'];

function StatBox({
  box,
  active,
  onClick,
  total,
}: {
  box: BoxDef;
  active: boolean;
  onClick: (bucket: string | null) => void;
  /** ยอด "กรอกมาทั้งหมด" — ใช้วาดแถบสัดส่วน · null/0 = ไม่วาด */
  total: number | null;
}) {
  const tone = TONE[box.tone];
  const clickable = box.bucket !== null && box.value !== null;
  /**
   * แถบสัดส่วนเทียบยอดเข้ามา — ตัวที่ทำให้กวาดตาแล้วเห็น "คนหายไปตรงไหน"
   * โดยไม่ต้องเอาเลข 13 ช่องมาหารในหัวเอง (แพตเทิร์นเดียวกับการ์ด KPI บน Dashboard)
   * ⚠️ ไม่มีตัวหาร/ค่าอ่านไม่ได้ = ไม่วาดแถบ ห้ามวาดเป็น 0% (คนละความหมายกับ "ไม่รู้")
   */
  const percent =
    total && total > 0 && box.value !== null ? Math.min(100, (box.value / total) * 100) : null;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onClick(box.bucket)}
      title={box.title || (clickable ? 'กดเพื่อดูรายชื่อในกล่องนี้' : undefined)}
      className={cn(
        'flex min-w-0 flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors',
        tone.soft,
        clickable ? tone.softHover : 'cursor-default',
        active ? 'ring-2 ring-ring' : '',
      )}
    >
      <span className={cn('w-full truncate text-[11px] font-semibold', DASH.muted)}>{box.label}</span>
      <span className="flex w-full items-baseline gap-1.5">
        <span className={cn('text-2xl font-bold leading-none tabular-nums', tone.num)}>
          {box.value === null ? '—' : box.value.toLocaleString('th-TH')}
        </span>
        {percent !== null && box.bucket !== null ? (
          <span className={cn('text-[10px] font-medium tabular-nums', DASH.muted)}>
            {Math.round(percent)}%
          </span>
        ) : null}
      </span>
      {percent !== null ? (
        <span className="block h-[5px] w-full overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
          <span
            className={cn('block h-full rounded-full', tone.dot ?? 'bg-slate-400')}
            style={{ width: `${percent}%` }}
          />
        </span>
      ) : null}
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

  const { intake, calling, contact, waiting, stale, meta, recruit } = data;

  const row1: BoxDef[] = [
    {
      bucket: null,
      label: 'กรอกมาทั้งหมด',
      value: intake.total,
      sub: `เบอร์ไม่ซ้ำ ${intake.distinctPhones} · Lead ${intake.leads}`,
      tone: 'primary',
      title: 'ใบสมัครทั้งหมดใน scope ของคุณ (นับเป็นใบ — คนเดียวหลายใบนับหลายใบ)',
      group: 'intake',
    },
    {
      bucket: 'bad_phone',
      label: 'เบอร์โทรผิด',
      value: intake.invalidPhone,
      sub: 'ส่ง AI โทรไม่ได้ — กดเพื่อไปแก้เบอร์',
      tone: 'danger',
      group: 'intake',
    },
    {
      bucket: 'untouched',
      label: 'ยังไม่ถูกโทร',
      value: calling.untouched,
      sub: `ในคิว AI ${calling.inQueueAwaitingAi} · มีคนถือ/เก็บ ${calling.heldOrClaimed}`,
      tone: 'warn',
      group: 'call',
    },
    {
      bucket: 'called',
      label: 'โทรแล้ว',
      value: calling.called,
      sub: calling.calledViaOtherChannel > 0 ? `ในนั้นจากช่องทางอื่น ${calling.calledViaOtherChannel}` : null,
      tone: 'primary',
      group: 'call',
    },
    {
      bucket: 'contact_success',
      label: 'ติดต่อสำเร็จ',
      value: contact.success,
      sub: 'รวมคนที่คุยแล้วปฏิเสธ (= ติดต่อถึงตัว)',
      tone: 'success',
      group: 'contact',
    },
    { bucket: 'contact_failed', label: 'ติดต่อไม่สำเร็จ', value: contact.failed, tone: 'danger', group: 'contact' },
    // เส้นแบ่งสรรหา→คัดสรร (16 ส.ค.) — สนใจแล้วแต่ยังไม่มาสมัคร vs มาสมัครแล้ว (ขึ้นบอร์ด)
    {
      bucket: null,
      label: 'รอเก็บใบสมัคร',
      value: recruit ? (recruit.waitingCollect < 0 ? null : recruit.waitingCollect) : null,
      sub: 'สนใจแล้วแต่ยังไม่มาสมัคร (งานสรรหา) — ดูรายชื่อที่ชิป "รอเก็บใบสมัคร"',
      tone: 'warn',
      title: 'คนตอบสนใจตอนโทร แต่ชื่อยังไม่ขึ้นบอร์ด (ยังไม่ได้มาสมัคร)',
      group: 'collect',
    },
    {
      bucket: null,
      label: 'ได้ใบสมัครแล้ว',
      value: recruit ? (recruit.collected < 0 ? null : recruit.collected) : null,
      sub: 'ชื่อขึ้นบอร์ดแล้ว (เป็นงานคัดสรรต่อ)',
      tone: 'success',
      title: 'จับคู่ด้วยเบอร์กับรายชื่อบนบอร์ด ERP',
      group: 'collect',
    },
  ];

  /** ตัวหารของแถบสัดส่วนทุกกล่อง — ยอดใบที่กรอกเข้ามาทั้งหมด */
  const intakeTotal = intake.total;

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

      {/* เส้นทางของคน แบ่งเป็นขั้น ๆ พร้อมแถบสัดส่วนเทียบ "กรอกมาทั้งหมด"
          เดิมเป็นกล่อง 12 ใบเรียงติดกันรวดเดียว กวาดตาแล้วไม่รู้ว่าอันไหนมาก่อนมาหลัง
          และไม่รู้ว่าคนหายไปตรงขั้นไหน (เจ้าของสั่ง 17 ส.ค. 2569 ให้ทำให้อ่านง่ายกว่านี้) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {STAGES.map((stage, i) => {
          const boxes = row1.filter((b) => b.group === stage.key);
          if (boxes.length === 0) return null;
          return (
            <div key={stage.key} className="min-w-0 flex-1">
              <p className={cn('mb-1.5 flex items-center gap-1.5', DASH.eyebrow)}>
                <span
                  className={cn(
                    'inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
                    'bg-foreground/10 text-foreground/70',
                  )}
                >
                  {i + 1}
                </span>
                {stage.label}
              </p>
              <div
                className={cn(
                  'grid gap-2',
                  boxes.length >= 4 ? 'grid-cols-2' : boxes.length === 2 ? 'grid-cols-2' : 'grid-cols-1',
                )}
              >
                {boxes.map((b) => (
                  <StatBox
                    key={b.label}
                    box={b}
                    total={intakeTotal}
                    active={activeBucket === b.bucket && b.bucket !== null}
                    onClick={setBucket}
                  />
                ))}
              </div>
            </div>
          );
        })}
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

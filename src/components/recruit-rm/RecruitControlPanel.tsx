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
 * Dashboard "ศูนย์คุมงานสรรหา" — กล่อง 4 ขั้นของคนหนึ่งคน (เข้ามา → โทร → ติดต่อ → เก็บใบสมัคร)
 * (เจ้าของสั่ง 15 ส.ค. 2569: "อยากรู้หมด กันคนเก็บไปเฉย ๆ แต่คนทำงานต้องทำงานง่าย")
 *
 * 🔴 **30 ก.ย. 2569 ย้ายจากแท็บผู้สมัครมาอยู่บนสุดของแท็บภาพรวม** (เจ้าของ: *"ศูนย์คุมงานสรรหา ย้ายไปหน้า
 * dashboard · ภาพรวมของ iRecruit ก็คือ dashboard ของฉัน"* → Choice "ย้ายไปก่อน ส่วนอื่นค่อยทำ")
 * - ถอดบรรทัด "ยอดจากฐานของเรา · กดกล่องเพื่อดูรายชื่อ · กดซ้ำเพื่อล้าง" และการ์ดแถวล่าง 3 ใบ
 *   (เวลารอโทร · ค้างยังไม่โทร · เก็บไปแล้วยังไม่โทร) — เจ้าของ: *"การ์ดพวกนี้เอาออก ดูยาก แล้วชวนรกมาก"*
 * - ตัวเลขทุกช่องมาจาก /api/recruit-rm-overview (นิยามที่ applicantOverviewSql ที่เดียว)
 * - กดกล่อง = **พาไปแท็บผู้สมัคร** พร้อม `?bucket=` → ตารางกรองด้วย**เงื่อนไขเดียวกับตัวนับ** (parity) ·
 *   ล้างได้ที่แถบ "กำลังดูจากกล่อง" บนแท็บผู้สมัคร
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
  onClick,
  total,
}: {
  box: BoxDef;
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
      title={box.title || (clickable ? 'กดเพื่อดูรายชื่อในแท็บผู้สมัคร' : undefined)}
      className={cn(
        'flex min-w-0 flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors',
        tone.soft,
        clickable ? tone.softHover : 'cursor-default',
      )}
    >
      <span className={cn('w-full truncate text-[11px] font-medium', DASH.muted)}>{box.label}</span>
      <span className="flex w-full items-baseline gap-1.5">
        <span className={cn('text-2xl font-medium leading-none tabular-nums', tone.num)}>
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

  /** กดกล่อง = ไปแท็บผู้สมัครที่กรองตามกล่องนั้น (แผงนี้อยู่แท็บภาพรวมแล้ว) */
  const openBucket = (bucket: string | null) => {
    if (!bucket) return;
    // 🔴 **push ไม่ใช่ replace** (5 ก.ย. 2569) — นี่คือ "คนกดเปลี่ยนมุมมองเอง"
    // ถ้า replace ประวัติจะถูกทับ ⇒ กดย้อนกลับแล้ว **หลุดออกจากหน้านี้ไปเลย**
    // (เจ้าของทดสอบเจอเอง: อยู่กล่องงาน → กดแท็บรายชื่อผู้สมัคร → ย้อนกลับ → เด้งไปหน้าแรก)
    // ⇒ กดย้อนกลับจากแท็บผู้สมัครแล้วกลับมาภาพรวม
    const params = new URLSearchParams(searchParams);
    params.set('view', 'list');
    params.delete('tab');
    params.set('bucket', bucket);
    setSearchParams(params);
  };

  const { intake, calling, contact, meta, recruit } = data;
  /** ธงที่ยังเกี่ยวกับกล่องที่เหลือ (โทรแล้ว · เก็บใบสมัคร) — ธงของการ์ดที่ถอดไปไม่ต้องโชว์ */
  const flags = meta.flags.filter((f) => f.metric === 'called' || f.metric === 'recruit');

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

  return (
    <div className={cn('space-y-3 rounded-2xl border px-4 py-3', DASH.card)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('font-medium', DASH.title)}>ศูนย์คุมงานสรรหา</p>
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
                    'inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium',
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
                  <StatBox key={b.label} box={b} total={intakeTotal} onClick={openBucket} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {flags.length > 0 ? (
        <p className={cn('text-xs', DASH.muted)}>{flags.map((f) => `⚠️ ${f.note}`).join(' · ')}</p>
      ) : null}
    </div>
  );
}

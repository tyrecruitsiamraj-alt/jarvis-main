import { useState } from 'react';
import { Phone, MessageCircle, ArrowLeft, UserPlus, CheckCircle2 } from 'lucide-react';
import type { IrecruitCandidateMatch } from '@/lib/irecruitMatchTypes';
import { matchTierEmoji, matchTierLabel } from '@/lib/irecruitMatchTypes';
import { proposalStatusLabel, type ProposalStatus } from '@/lib/candidateProposalsApi';
import {
  describeScoreBreakdown,
  scoreMatch,
  type CriterionVerdict,
  type JobCriteria,
} from '@/lib/scoreIrecruitMatch';
import { cn } from '@/lib/utils';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Props = {
  match: IrecruitCandidateMatch;
  job: JobCriteria;
  /** proximity ของผู้สมัครต่อโซนนี้ (มาจากการกระจายเข้าสาขา) */
  area: { rank: number; reason: string };
  onPrefill?: (match: IrecruitCandidateMatch, why?: string) => void;
  /** บันทึกการเสนอ/จองตัว/ลงงานลง DB — why = เหตุผลที่เลือกโทร */
  onPropose?: (match: IrecruitCandidateMatch, status: ProposalStatus, why?: string) => void;
  /** สถานะการเสนอล่าสุดของผู้สมัครนี้ต่อใบขอ (ถ้าเคยเสนอ) */
  proposalStatus?: ProposalStatus | null;
  /** กำลังบันทึกการเสนอของผู้สมัครนี้อยู่ */
  proposalBusy?: boolean;
};

/**
 * ความหมายสีของไฟล์นี้มาจาก TONE ที่เดียว — เดิมเขียนสีมือและ **ไม่มีคู่ `dark:` เลย**
 * พอสลับโหมดมืด พื้นยังเป็นสีอ่อน (emerald-50) แต่ตัวหนังสือกลายเป็นสีอ่อนตามธีม
 * ชิปจึงจมหายไปกับพื้นของตัวเอง — วัดได้ contrast ต่ำถึง 1.8 (เกณฑ์ต้อง 4.5)
 */
function scoreTone(percent: number): ToneKey {
  if (percent >= 70) return 'success';
  if (percent >= 40) return 'warn';
  return 'neutral';
}

function scoreColor(percent: number): string {
  const t = TONE[scoreTone(percent)];
  return cn(t.soft, t.value);
}

const VERDICT_TONE: Record<CriterionVerdict, ToneKey> = {
  pass: 'success',
  fail: 'danger',
  na: 'neutral',
};

function VerdictChip({ label, verdict }: { label: string; verdict: CriterionVerdict }) {
  const tone = TONE[VERDICT_TONE[verdict] ?? 'neutral'];
  const meta = {
    icon: verdict === 'pass' ? '✓' : verdict === 'fail' ? '✗' : '–',
    className: cn(tone.soft, tone.value),
  };
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', meta.className)}>
      {label} {meta.icon}
    </span>
  );
}

function verdictText(v: CriterionVerdict): string {
  if (v === 'pass') return 'ตรงตามใบขอ';
  if (v === 'fail') return 'ไม่ตรงตามใบขอ';
  return 'ใบขอไม่ระบุ / ไม่มีข้อมูล';
}

function verdictRowClass(v: CriterionVerdict): string {
  return TONE[VERDICT_TONE[v] ?? 'neutral'].value;
}

function ScorePercentBadge({
  percent,
  breakdown,
}: {
  percent: number;
  breakdown: string[];
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'shrink-0 cursor-help rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums',
              scoreColor(percent),
            )}
          >
            {percent}%
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[260px] space-y-1 p-2.5 text-left">
          <p className="text-[11px] font-semibold">องค์ประกอบคะแนน</p>
          <ul className="space-y-0.5 text-[11px] leading-snug">
            {breakdown.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function ScoredCandidateCard({
  match,
  job,
  area,
  onPrefill,
  onPropose,
  proposalStatus,
  proposalBusy,
}: Props) {
  const [showWhy, setShowWhy] = useState(false);
  const score = scoreMatch(match, job, area);
  const breakdown = describeScoreBreakdown(score);

  // สรุปเหตุผลที่เลือกโทร/เสนอคนนี้ — ส่งไปเติมในฟอร์มเพิ่มผู้สมัคร
  const buildWhy = () =>
    [
      `${matchTierLabel(match.tier)} (คะแนน ${score.percent}%)`,
      ...breakdown.slice(1),
      `ตำแหน่งที่สมัคร: ${match.position_name || match.job_name_th || '-'}`,
      match.reason ? `เหตุผล AI: ${match.reason}` : '',
    ]
      .filter(Boolean)
      .join('\n');

  // ปุ่มจองตัว/ลงงาน — ใช้ซ้ำทั้งหน้าข้อมูลและหน้า "ทำไมเป็นคนนี้"
  const proposeButtons = onPropose ? (
    <div className="flex flex-wrap items-center gap-1.5">
      {proposalStatus ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" /> {proposalStatusLabel(proposalStatus)}
        </span>
      ) : null}
      <button
        type="button"
        disabled={proposalBusy}
        onClick={() => onPropose(match, 'reserved', buildWhy())}
        className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:bg-violet-950/50 dark:border-violet-800 dark:text-violet-300"
      >
        {proposalBusy ? 'บันทึก…' : proposalStatus === 'reserved' ? 'จองตัวแล้ว ✓' : 'จองตัว'}
      </button>
      <button
        type="button"
        disabled={proposalBusy}
        onClick={() => onPropose(match, 'placed', buildWhy())}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:border-emerald-800"
      >
        {proposalBusy ? 'บันทึก…' : proposalStatus === 'placed' ? 'ลงงานแล้ว ✓' : 'ลงงานแล้ว'}
      </button>
    </div>
  ) : null;

  // ---------- หน้า "ทำไมเป็นคนนี้ + จะโทร" ----------
  if (showWhy) {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-2.5 py-2 space-y-2 dark:bg-sky-950/50 dark:border-sky-800">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowWhy(false)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:underline dark:text-sky-300"
          >
            <ArrowLeft className="h-3 w-3" /> ย้อนกลับ
          </button>
          <ScorePercentBadge percent={score.percent} breakdown={breakdown} />
        </div>

        <p className="text-sm font-semibold text-foreground">
          {matchTierEmoji(match.tier)} {match.full_name}
        </p>

        <div className="rounded-md border border-white/70 bg-white/70 px-2.5 py-2 space-y-1.5 dark:bg-white/5 dark:border-white/10">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">ทำไมแนะนำคนนี้</p>
          <ul className="space-y-1 text-[11px]">
            <li className={verdictRowClass(score.gender)}>• เพศ: {verdictText(score.gender)}</li>
            <li className={verdictRowClass(score.age)}>• อายุ: {verdictText(score.age)}</li>
            <li className="text-sky-700 dark:text-sky-300">• พื้นที่: {score.areaLabel}</li>
            <li className="text-slate-600 dark:text-slate-300">
              • ตำแหน่งที่สมัคร: {match.position_name || match.job_name_th || 'ไม่ระบุ'}
            </li>
          </ul>
          {match.reason ? (
            <p className="pt-1 text-[11px] text-slate-600 italic border-t border-slate-100 dark:text-slate-300">
              เหตุผล AI: {match.reason}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {match.phone_number ? (
            <a
              href={`tel:${match.phone_number}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
            >
              <Phone className="h-3.5 w-3.5" /> โทร {match.phone_number}
            </a>
          ) : (
            <span className="text-[11px] text-muted-foreground">ไม่มีเบอร์โทร</span>
          )}
          {match.line_id ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:bg-white/5 dark:border-emerald-800 dark:text-emerald-300">
              <MessageCircle className="h-3.5 w-3.5" /> LINE: {match.line_id}
            </span>
          ) : null}
          {onPrefill ? (
            <button
              type="button"
              onClick={() => onPrefill(match, buildWhy())}
              className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:bg-violet-950/50 dark:border-violet-800 dark:text-violet-300"
            >
              <UserPlus className="h-3.5 w-3.5" /> เพิ่มรายละเอียดผู้สมัคร
            </button>
          ) : null}
        </div>
        {proposeButtons}
      </div>
    );
  }

  // ---------- หน้าข้อมูลผู้สมัคร (ค่าเริ่มต้น) ----------
  return (
    <div className="rounded-lg border border-white/70 bg-white/70 px-2.5 py-2 space-y-1.5 dark:bg-white/5 dark:border-white/10">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          {matchTierEmoji(match.tier)} {match.full_name}
          {proposalStatus ? (
            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-2.5 w-2.5" /> {proposalStatusLabel(proposalStatus)}
            </span>
          ) : null}
        </p>
        <ScorePercentBadge percent={score.percent} breakdown={breakdown} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <VerdictChip label="เพศ" verdict={score.gender} />
        <VerdictChip label="อายุ" verdict={score.age} />
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300">
          พื้นที่: {score.areaLabel}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500 dark:bg-white/5 dark:border-slate-800 dark:text-slate-400">
          {matchTierLabel(match.tier)}
        </span>
      </div>

      <div className="text-[11px] text-muted-foreground">
        {match.position_name || match.job_name_th || 'ไม่ระบุตำแหน่งที่สมัคร'}
        {match.sex ? ` · ${match.sex}` : ''}
        {match.age != null ? ` · อายุ ${match.age}` : ''}
        {match.location_label ? ` · ${match.location_label}` : ''}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => setShowWhy(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-950/50 dark:border-sky-800 dark:text-sky-300"
        >
          <Phone className="h-3 w-3" /> สนใจ / จะโทร
        </button>
        {onPrefill ? (
          <button
            type="button"
            onClick={() => onPrefill(match, buildWhy())}
            className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100 dark:bg-violet-950/50 dark:border-violet-800 dark:text-violet-300"
          >
            <UserPlus className="h-3 w-3" /> เพิ่มรายละเอียดผู้สมัคร
          </button>
        ) : null}
      </div>
      {proposeButtons}
    </div>
  );
}

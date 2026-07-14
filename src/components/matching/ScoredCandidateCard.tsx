import type { IrecruitCandidateMatch } from '@/lib/irecruitMatchTypes';
import { matchTierEmoji, matchTierLabel } from '@/lib/irecruitMatchTypes';
import { scoreMatch, type CriterionVerdict, type JobCriteria } from '@/lib/scoreIrecruitMatch';
import { cn } from '@/lib/utils';

type Props = {
  match: IrecruitCandidateMatch;
  job: JobCriteria;
  /** proximity ของผู้สมัครต่อโซนนี้ (มาจากการกระจายเข้าสาขา) */
  area: { rank: number; reason: string };
  onPrefill?: (match: IrecruitCandidateMatch) => void;
};

function scoreColor(percent: number): string {
  if (percent >= 70) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (percent >= 40) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function VerdictChip({ label, verdict }: { label: string; verdict: CriterionVerdict }) {
  const meta =
    verdict === 'pass'
      ? { icon: '✓', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
      : verdict === 'fail'
        ? { icon: '✗', className: 'border-red-200 bg-red-50 text-red-700' }
        : { icon: '–', className: 'border-slate-200 bg-slate-50 text-slate-500' };
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', meta.className)}>
      {label} {meta.icon}
    </span>
  );
}

export default function ScoredCandidateCard({ match, job, area, onPrefill }: Props) {
  const score = scoreMatch(match, job, area);
  return (
    <div className="rounded-lg border border-white/70 bg-white/70 px-2.5 py-2 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onPrefill?.(match)}
          className="text-left text-sm font-semibold text-blue-700 hover:underline"
        >
          {matchTierEmoji(match.tier)} {match.full_name}
        </button>
        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums', scoreColor(score.percent))}>
          {score.percent}%
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <VerdictChip label="เพศ" verdict={score.gender} />
        <VerdictChip label="อายุ" verdict={score.age} />
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
          พื้นที่: {score.areaLabel}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
          {matchTierLabel(match.tier)}
        </span>
      </div>

      <div className="text-[11px] text-muted-foreground">
        {match.position_name || match.job_name_th || 'ไม่ระบุตำแหน่งที่สมัคร'}
        {match.sex ? ` · ${match.sex}` : ''}
        {match.age != null ? ` · อายุ ${match.age}` : ''}
        {match.location_label ? ` · ${match.location_label}` : ''}
        {match.phone_number ? (
          <>
            {' · '}
            <span className="font-medium text-sky-700">{match.phone_number}</span>
          </>
        ) : null}
      </div>

      {match.reason ? (
        <p className="text-[11px] text-slate-600 italic line-clamp-2">AI: {match.reason}</p>
      ) : null}
    </div>
  );
}

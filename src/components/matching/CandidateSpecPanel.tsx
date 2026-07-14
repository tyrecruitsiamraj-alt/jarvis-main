import React, { useState } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  type CandidateSpecAnalysis,
  adjacentTierEmoji,
  compensationVerdictLabel,
  complianceVerdictLabel,
} from '@/lib/candidateSpecTypes';

type Props = {
  mode: 'compact' | 'full';
  loading?: boolean;
  error?: string | null;
  analysis: CandidateSpecAnalysis | null;
  onAnalyze?: () => void;
  onRefresh?: () => void;
};

function verdictClass(comp: CandidateSpecAnalysis['compensation_verdict']): string {
  if (comp === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (comp === 'fail') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function urgencyLabel(analysis: CandidateSpecAnalysis, long = false): string {
  if (analysis.urgency_level === 'high') return long ? 'เร่งด่วนมาก' : 'เร่งด่วน';
  if (analysis.urgency_level === 'low') return 'มีเวลา';
  return 'ปกติ';
}

function FullAnalysisBody({ analysis }: { analysis: CandidateSpecAnalysis }) {
  return (
    <>
      <p className="text-sm text-foreground leading-relaxed">{analysis.summary}</p>

      {analysis.compensation_note || analysis.compliance_note ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          {analysis.compensation_note ? (
            <p>
              <span className="font-semibold text-foreground">ค่าตอบแทน:</span>{' '}
              {analysis.compensation_note}
            </p>
          ) : null}
          {analysis.compliance_note ? (
            <p>
              <span className="font-semibold text-foreground">กฎหมาย/Compliance:</span>{' '}
              {analysis.compliance_note}
            </p>
          ) : null}
        </div>
      ) : null}

      {analysis.must_have.length > 0 ? (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground">Must Have</h4>
          <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
            {analysis.must_have.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {analysis.nice_to_have.length > 0 ? (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground">Nice to Have</h4>
          <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
            {analysis.nice_to_have.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {analysis.not_applicable.length > 0 ? (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground">ไม่จำเป็นสำหรับตำแหน่งนี้</h4>
          <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
            {analysis.not_applicable.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {analysis.adjacent_positions.length > 0 ? (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground">ตำแหน่งใกล้เคียงที่เปิดรับเพิ่มได้</h4>
          <div className="space-y-1">
            {analysis.adjacent_positions.map((row) => (
              <div key={`${row.tier}-${row.title}`} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {adjacentTierEmoji(row.tier)} {row.title}
                </span>
                {row.note ? ` — ${row.note}` : ''}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {analysis.excluded_positions.length > 0 ? (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground">ตำแหน่งที่ดูใกล้เคียงแต่ต้องตัดออก</h4>
          <div className="space-y-1">
            {analysis.excluded_positions.map((row) => (
              <div key={row.title} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">✕ {row.title}</span>
                {row.reason ? ` — ${row.reason}` : ''}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {analysis.warnings.length > 0 ? (
        <section className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-2">
          <h4 className="text-xs font-semibold text-amber-900">จุดที่ต้องระวัง</h4>
          <ul className="list-disc pl-4 text-xs text-amber-900/90 space-y-0.5">
            {analysis.warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {analysis.confirm_with_client.length > 0 ? (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground">ควรยืนยันกับหน่วยงาน</h4>
          <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
            {analysis.confirm_with_client.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {analysis.sections_markdown ? (
        <details className="rounded-lg border border-white/70 bg-white/50 px-2.5 py-2">
          <summary className="cursor-pointer text-xs font-medium text-violet-800">ดูรายงานเต็ม (Markdown)</summary>
          <pre className="mt-2 whitespace-pre-wrap text-[11px] text-muted-foreground leading-relaxed">
            {analysis.sections_markdown}
          </pre>
        </details>
      ) : null}
    </>
  );
}

export default function CandidateSpecPanel({
  mode,
  loading,
  error,
  analysis,
  onAnalyze,
  onRefresh,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className={cn('rounded-xl border border-violet-200/70 bg-violet-50/40 px-3 py-3', mode === 'full' && 'space-y-2')}>
        <div className="flex items-center gap-2 text-sm text-violet-700">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span>AI กำลังวิเคราะห์สเปคผู้สมัคร… (อาจใช้เวลา 1–3 นาที)</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3 space-y-2">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <Sparkles className="h-4 w-4" />
          <span>วิเคราะห์สเปคไม่สำเร็จ: {error}</span>
        </div>
        {onAnalyze ? (
          <button
            type="button"
            onClick={onAnalyze}
            className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50"
          >
            ลองใหม่
          </button>
        ) : null}
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/30 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-violet-800">
            <Sparkles className="h-4 w-4" />
            <span>ยังไม่ได้วิเคราะห์สเปคผู้สมัครด้วย AI</span>
          </div>
          {onAnalyze ? (
            <button
              type="button"
              onClick={onAnalyze}
              className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50"
            >
              วิเคราะห์
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (mode === 'compact' && !expanded) {
    return (
      <div className="rounded-xl border border-violet-200/70 bg-violet-50/40 px-3 py-2.5 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-violet-200 bg-white text-violet-800">
            {analysis.job_family_emoji} {analysis.job_family_label}
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
            {analysis.urgency_emoji} {urgencyLabel(analysis)}
          </Badge>
          <Badge variant="outline" className={verdictClass(analysis.compensation_verdict)}>
            {compensationVerdictLabel(analysis.compensation_verdict)}
          </Badge>
        </div>
        <p className="text-xs text-violet-900/90 leading-relaxed line-clamp-2">{analysis.summary}</p>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50"
        >
          <ChevronDown className="h-3 w-3" />
          ดูสเปคเต็ม
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200/70 bg-violet-50/30 px-3 py-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
            <Sparkles className="h-4 w-4" />
            สเปคผู้สมัคร (AI Candidate Spec)
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="border-violet-200 bg-white text-violet-800">
              {analysis.job_family_emoji} {analysis.job_family_code}. {analysis.job_family_label}
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
              {analysis.urgency_emoji} {urgencyLabel(analysis, true)}
            </Badge>
            <Badge variant="outline" className={verdictClass(analysis.compensation_verdict)}>
              {compensationVerdictLabel(analysis.compensation_verdict)}
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
              {complianceVerdictLabel(analysis.compliance_verdict)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50"
            >
              <RefreshCw className="h-3 w-3" />
              วิเคราะห์ใหม่
            </button>
          ) : null}
          {mode === 'compact' ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50"
            >
              <ChevronUp className="h-3 w-3" />
              ย่อ
            </button>
          ) : null}
        </div>
      </div>

      <FullAnalysisBody analysis={analysis} />
    </div>
  );
}

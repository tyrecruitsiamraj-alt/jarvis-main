import React, { useState } from 'react';
import { Users, RefreshCw, Phone, MessageCircle, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  type IrecruitCandidateMatch,
  type IrecruitMatchResult,
  matchTierEmoji,
  matchTierLabel,
} from '@/lib/irecruitMatchTypes';

type Props = {
  loading?: boolean;
  error?: string | null;
  result: IrecruitMatchResult | null;
  onMatch?: () => void;
  onRefresh?: () => void;
  onPrefill?: (match: IrecruitCandidateMatch) => void;
};

function tierBorderClass(tier: 'green' | 'yellow' | 'red'): string {
  if (tier === 'green') return 'border-emerald-200 bg-emerald-50/60';
  if (tier === 'red') return 'border-red-200 bg-red-50/50';
  return 'border-amber-200 bg-amber-50/60';
}

function sexLabel(sex: string | null): string {
  if (sex === 'M') return 'ชาย';
  if (sex === 'F') return 'หญิง';
  return sex || '';
}

function formatAppliedAt(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

function CandidateDetailDialog({
  match,
  onClose,
  onPrefill,
}: {
  match: IrecruitCandidateMatch | null;
  onClose: () => void;
  onPrefill?: (match: IrecruitCandidateMatch) => void;
}) {
  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {match ? matchTierEmoji(match.tier) : ''} {match?.full_name}
          </DialogTitle>
          <DialogDescription className="sr-only">รายละเอียดผู้สมัคร iRecruit</DialogDescription>
        </DialogHeader>
        {match ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                {matchTierEmoji(match.tier)} {matchTierLabel(match.tier)}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                สถานะ: {match.process_status_name}
              </Badge>
            </div>

            {match.reason ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-xs text-sky-900">
                <span className="font-semibold">เหตุผลที่ AI เสนอ:</span> {match.reason}
              </div>
            ) : null}

            <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-3 space-y-1.5">
              <DetailRow label="ตำแหน่งที่สมัคร" value={match.position_name || match.job_name_th || 'ไม่ระบุ'} />
              <DetailRow label="เพศ / อายุ" value={[sexLabel(match.sex), match.age ? `${match.age} ปี` : ''].filter(Boolean).join(' · ') || null} />
              <DetailRow
                label="น้ำหนัก / ส่วนสูง"
                value={match.weight || match.height ? `${match.weight || '-'} กก. / ${match.height || '-'} ซม.` : null}
              />
              <DetailRow label="ใบขับขี่" value={match.driving_licenses.length ? match.driving_licenses.join(', ') : null} />
              <DetailRow label="พื้นที่" value={match.location_label} />
              <DetailRow label="ที่มา" value={match.specific_name} />
              <DetailRow label="วันที่สมัคร" value={formatAppliedAt(match.applied_at)} />
              <DetailRow label="รหัสผู้สมัคร" value={`#${match.id}`} />
            </div>

            <div className="flex flex-wrap gap-2">
              {match.phone_number ? (
                <a
                  href={`tel:${match.phone_number}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-50"
                >
                  <Phone className="h-4 w-4" /> {match.phone_number}
                </a>
              ) : null}
              {match.line_id ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700">
                  <MessageCircle className="h-4 w-4" /> LINE: {match.line_id}
                </span>
              ) : null}
              {onPrefill ? (
                <button
                  type="button"
                  onClick={() => {
                    onPrefill(match);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
                >
                  เปิดฟอร์มเพิ่มผู้สมัคร
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function IrecruitMatchPanel({ loading, error, result, onMatch, onRefresh, onPrefill }: Props) {
  const [selected, setSelected] = useState<IrecruitCandidateMatch | null>(null);

  if (loading) {
    return (
      <div className="rounded-xl border border-sky-200/70 bg-sky-50/40 px-3 py-3">
        <div className="flex items-center gap-2 text-sm text-sky-700">
          <Users className="h-4 w-4 animate-pulse" />
          <span>กำลังค้นหาผู้สมัครใกล้เคียงจาก iRecruit… (อาจใช้เวลา ~30 วินาที)</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3 space-y-2">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <Users className="h-4 w-4" />
          <span>ค้นหาผู้สมัครไม่สำเร็จ: {error}</span>
        </div>
        {onMatch ? (
          <button
            type="button"
            onClick={onMatch}
            className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
          >
            ลองใหม่
          </button>
        ) : null}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/30 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-sky-800">
            <Users className="h-4 w-4" />
            <span>หาผู้สมัครใกล้เคียงจากฐาน iRecruit</span>
          </div>
          {onMatch ? (
            <button
              type="button"
              onClick={onMatch}
              className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
            >
              ค้นหา
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sky-200/70 bg-sky-50/30 px-3 py-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-900">
            <Users className="h-4 w-4" />
            ผู้สมัครใกล้เคียง (iRecruit)
          </div>
          <p className="text-[11px] text-sky-800/80">
            จับคู่กับ Family {result.job_family_code} · {result.job_family_label} ·{' '}
            {result.search_scope === 'keyword'
              ? `พบผู้สมัครตำแหน่งใกล้เคียง ${result.pool_size} คน (ค้นทั่วทั้งฐาน)`
              : `คัดจากผู้สมัครล่าสุด ${result.pool_size} คน`}{' '}
            → เสนอ {result.matches.length}
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
          >
            <RefreshCw className="h-3 w-3" />
            ค้นหาใหม่
          </button>
        ) : null}
      </div>

      {result.matches.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          ไม่พบผู้สมัครที่ใกล้เคียงในฐาน iRecruit สำหรับตำแหน่งนี้ (ลองปรับใบขอหรือขยายฐานผู้สมัคร)
        </p>
      ) : (
        <div className="space-y-2">
          {result.matches.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => setSelected(m)}
              className={`w-full rounded-lg border px-2.5 py-2 text-left transition hover:brightness-[0.98] ${tierBorderClass(m.tier)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {matchTierEmoji(m.tier)} {m.full_name}
                </span>
                <span className="flex items-center gap-1">
                  <Badge variant="outline" className="border-slate-200 bg-white text-[10px] text-slate-600">
                    {matchTierLabel(m.tier)}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </div>
              <div className="mt-0.5 text-xs text-foreground/90">
                สมัคร: {m.position_name || m.job_name_th || 'ไม่ระบุ'}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {m.location_label ? <span>{m.location_label}</span> : null}
                {m.sex || m.age ? (
                  <span>
                    {sexLabel(m.sex)}
                    {m.age ? ` ${m.age} ปี` : ''}
                  </span>
                ) : null}
                {m.driving_licenses.length ? <span>ใบขับขี่: {m.driving_licenses.join(', ')}</span> : null}
                {m.phone_number ? <span className="font-medium text-sky-700">{m.phone_number}</span> : null}
              </div>
              {m.reason ? (
                <div className="mt-1 text-[11px] text-muted-foreground italic line-clamp-2">— {m.reason}</div>
              ) : null}
              <div className="mt-1 text-[10px] font-medium text-sky-600">แตะเพื่อดูรายละเอียด →</div>
            </button>
          ))}
        </div>
      )}

      <CandidateDetailDialog match={selected} onClose={() => setSelected(null)} onPrefill={onPrefill} />
    </div>
  );
}

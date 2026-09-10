import React from 'react';
import { Gauge, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { computeJobUrgency, requestStatusLabel } from '@/lib/jobUrgency';
import { computeJobSla } from '@/lib/jobSla';
import { positionBreakdownFromJob, resolveRequestControlStatus } from '@/lib/requestControl';
import {
  DEFAULT_REQUEST_LEAD_RULES,
  REQUEST_LEAD_KIND_TONE,
  cleanRequestLeadRulesOverride,
  hasCustomLeadRules,
  requestLeadKindHint,
  resolveRequestLeadRules,
  type RequestLeadKind,
  type RequestLeadRulesOverride,
} from '@/lib/requestLeadKind';
import { saveUnitRequestMeta, siamrajExternalId } from '@/lib/siamrajUnitRequestsApi';
import type { JobRequest } from '@/types';

/**
 * เกณฑ์ความเร่งเฉพาะใบ — เจ้าของสั่ง 10 ก.ย. 2569
 *
 * > *"หลักเกณฑ์ ฉุกเฉิน / ฉุกเฉิน-ย้อนหลัง / ล่วงหน้า ทำให้ Set เป็นใบไว้หน่อย
 * > เพราะบางใบใช้คำนวณไม่เหมือนกัน แต่ถ้าไม่ Set ก็เอาของเดิมเป็น Default
 * > แก้ก็แก้ที่หน้าใบขอ"*
 *
 * ตั้ง **4 ตัวเลข** ต่อใบ · ช่องว่าง = ใช้ค่ากลาง · ค่าที่ตั้งมีผล**ทุกที่ทั้งระบบ**
 * (หน้าใบขอ · รายการใบขอ · แดชบอร์ด SLA · กราฟแยกประเภท)
 *
 * 🔴 **ตัวอย่างผลลัพธ์คำนวณสด** จากตัวเลขที่กำลังพิมพ์ ก่อนกดบันทึก — เกณฑ์พวกนี้
 * มองด้วยตาเปล่าไม่ออกว่าจะเปลี่ยนใบนี้เป็นประเภทไหน ถ้าไม่โชว์ให้เห็นก่อน
 * คนจะตั้งเลขมั่วแล้วเลขบนแดชบอร์ดขยับโดยไม่มีใครตั้งใจ
 */

const KIND_ROWS: { kind: RequestLeadKind; label: string }[] = [
  { kind: 'retroactive', label: 'ฉุกเฉิน/ย้อนหลัง' },
  { kind: 'urgent', label: 'ฉุกเฉิน' },
  { kind: 'advance', label: 'ล่วงหน้า' },
];

/** ช่องกรอกวัน — ว่าง = ใช้ค่ากลาง (placeholder บอกค่ากลางไว้แล้ว) */
function DayInput({
  id,
  label,
  hint,
  value,
  fallback,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  fallback: number;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-2">
      <Label htmlFor={id} className="text-[11px] font-medium text-foreground">
        {label}
      </Label>
      <div className="mt-1 flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          value={value}
          disabled={disabled}
          placeholder={String(fallback)}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-20 tabular-nums"
        />
        <span className="text-xs text-muted-foreground">วัน</span>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          ค่ากลาง {fallback}
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * ก้อนที่จะส่งขึ้น API — **ต้องพก override เดิมไปครบทุกคีย์**
 *
 * 🔴 ฝั่ง API เขียนทับคอลัมน์ `field_overrides` ทั้งก้อน (`upsertUnitNote`) ไม่ได้ merge ให้
 * ส่งขึ้นไปแค่ `lead_rules` เมื่อไหร่ ที่อยู่/รายได้/สวัสดิการที่ทีมแก้ไว้จะหายทันที
 * แยกออกมาเป็นฟังก์ชันเปล่าเพราะเป็นจุดที่พังแล้ว**เงียบ** — ต้องมีเทสต์จับ
 */
export function buildLeadRulesPatch(
  job: Pick<JobRequest, 'field_overrides'>,
  next: RequestLeadRulesOverride | null,
): Record<string, unknown> {
  return { ...(job.field_overrides ?? {}), lead_rules: next };
}

type Draft = { threshold: string; sla: Record<RequestLeadKind, string> };

function draftFromJob(job: JobRequest): Draft {
  const o = job.lead_rules ?? null;
  const num = (v: number | null | undefined) => (v == null ? '' : String(v));
  return {
    threshold: num(o?.urgent_threshold_days),
    sla: {
      retroactive: num(o?.sla_days?.retroactive),
      urgent: num(o?.sla_days?.urgent),
      advance: num(o?.sla_days?.advance),
    },
  };
}

/** ช่องว่าง = ไม่ได้ตั้ง — ส่ง null ให้ตัว sanitize ตัดคีย์นั้นทิ้ง */
function draftToOverride(d: Draft): RequestLeadRulesOverride | null {
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  return cleanRequestLeadRulesOverride({
    urgent_threshold_days: num(d.threshold),
    sla_days: {
      retroactive: num(d.sla.retroactive),
      urgent: num(d.sla.urgent),
      advance: num(d.sla.advance),
    },
  });
}

const RequestLeadRulesCard: React.FC<{
  job: JobRequest;
  canEdit?: boolean;
  onSaved?: (rules: RequestLeadRulesOverride | null) => void;
}> = ({ job, canEdit = true, onSaved }) => {
  const [draft, setDraft] = React.useState<Draft>(() => draftFromJob(job));
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // ใบเปลี่ยน (โหลดเสร็จ/สลับใบ) → ตั้งช่องใหม่จากค่าที่บันทึกไว้
  const savedKey = JSON.stringify(job.lead_rules ?? null);
  React.useEffect(() => {
    setDraft(draftFromJob(job));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, savedKey]);

  const pending = draftToOverride(draft);
  const rules = resolveRequestLeadRules(pending);
  const savedOverride = cleanRequestLeadRulesOverride(job.lead_rules);
  const dirty = JSON.stringify(pending) !== JSON.stringify(savedOverride);

  /**
   * ผลกับใบนี้ถ้าใช้ตัวเลขที่กำลังพิมพ์ — คำนวณด้วยท่อจริง (`computeJobUrgency` /
   * `computeJobSla`) บนสำเนาใบที่ใส่เกณฑ์ร่างเข้าไป **ห้ามคำนวณเองซ้ำที่นี่**
   * ไม่งั้นตัวอย่างจะไม่ตรงกับของจริงเวลาบันทึก
   */
  const preview = React.useMemo(() => {
    const shadow: JobRequest = { ...job, lead_rules: pending };
    const urgency = computeJobUrgency(shadow);
    const sla = computeJobSla(shadow, resolveRequestControlStatus(positionBreakdownFromJob(shadow)));
    return { kind: urgency.kind, sla };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, JSON.stringify(pending)]);

  const save = async (next: RequestLeadRulesOverride | null) => {
    const requestNo = siamrajExternalId(job) || job.request_no;
    if (!requestNo) {
      setErr('ใบขอนี้ไม่มีเลขที่ใบขอ — ตั้งเกณฑ์ไม่ได้');
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await saveUnitRequestMeta(requestNo, {
        field_overrides: buildLeadRulesPatch(job, next) as NonNullable<JobRequest['field_overrides']>,
      });
      setMsg(next ? 'บันทึกเกณฑ์ของใบนี้แล้ว' : 'กลับไปใช้ค่ากลางแล้ว');
      onSaved?.(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-card rounded-3xl p-4 border border-white/70 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Gauge className={cn('h-4 w-4', TONE.primary.value)} />
        <h2 className="text-sm font-semibold">เกณฑ์ความเร่งของใบนี้</h2>
        <span
          className={cn(
            'text-[10px]',
            hasCustomLeadRules(job.lead_rules) ? TONE.warn.chip : TONE.neutral.chip,
          )}
        >
          {hasCustomLeadRules(job.lead_rules) ? 'ตั้งเองเฉพาะใบนี้' : 'ใช้ค่ากลาง'}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        ช่องไหนไม่กรอก = ใช้ค่ากลางของระบบ · ค่าที่ตั้งไว้มีผลทุกที่ ทั้งหน้ารายการใบขอและแดชบอร์ด SLA
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <DayInput
          id="lead-threshold"
          label="เส้นแบ่ง ฉุกเฉิน ↔ ล่วงหน้า"
          hint="ห่างจากวันที่กรอกถึงวันที่ต้องการน้อยกว่านี้ = ฉุกเฉิน"
          value={draft.threshold}
          fallback={DEFAULT_REQUEST_LEAD_RULES.urgentThresholdDays}
          disabled={!canEdit || saving}
          onChange={(v) => setDraft((d) => ({ ...d, threshold: v }))}
        />
        {KIND_ROWS.map((r) => (
          <DayInput
            key={r.kind}
            id={`lead-sla-${r.kind}`}
            label={`ให้เวลาหาคน · ${r.label}`}
            hint={
              r.kind === 'retroactive'
                ? 'นับจากวันที่ยื่นใบขอ'
                : 'นับจากวันที่ต้องการคน'
            }
            value={draft.sla[r.kind]}
            fallback={DEFAULT_REQUEST_LEAD_RULES.slaDays[r.kind]}
            disabled={!canEdit || saving}
            onChange={(v) => setDraft((d) => ({ ...d, sla: { ...d.sla, [r.kind]: v } }))}
          />
        ))}
      </div>

      {/* ตัวอย่างผลลัพธ์ — บอกให้เห็นก่อนกดบันทึกว่าใบนี้จะกลายเป็นอะไร */}
      <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-muted-foreground">ใช้เกณฑ์ชุดนี้แล้ว ใบนี้คือ</span>
          <span className={cn('font-semibold', TONE[REQUEST_LEAD_KIND_TONE[preview.kind]].value)}>
            {requestStatusLabel(preview.kind)}
          </span>
          <span className="text-muted-foreground">
            · ให้เวลาหาคน <span className="tabular-nums">{preview.sla.slaDays}</span> วัน
          </span>
          {preview.sla.slaDueDate ? (
            <span className="text-muted-foreground">
              · ครบกำหนด <span className="tabular-nums">{formatYmdDmyBe(preview.sla.slaDueDate)}</span>
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {requestLeadKindHint(preview.kind, rules)}
        </p>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => save(pending)} disabled={saving || !dirty}>
            {saving ? 'กำลังบันทึก…' : 'บันทึกเกณฑ์ของใบนี้'}
          </Button>
          {savedOverride ? (
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setDraft({ threshold: '', sla: { retroactive: '', urgent: '', advance: '' } });
                void save(null);
              }}
            >
              {/* ขนาดไอคอนมาจาก variant ของปุ่ม — ห้ามใส่ h-/w- เอง (เทสต์ typographyRules คุมอยู่) */}
              <RotateCcw />
              กลับไปใช้ค่ากลาง
            </Button>
          ) : null}
          {msg ? <span className={cn('text-xs', TONE.success.value)}>{msg}</span> : null}
          {err ? <span className={cn('text-xs', TONE.danger.value)}>{err}</span> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">ดูอย่างเดียว — ไม่มีสิทธิ์แก้เกณฑ์ใบขอ</p>
      )}
    </section>
  );
};

export default RequestLeadRulesCard;

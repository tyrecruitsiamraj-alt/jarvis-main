/**
 * ตัวคำนวณของหน้าภาพรวม v2 ที่ผูกกับข้อมูลหน้า (pure) — ใช้นิยามเดิมทั้งหมด
 * `buildPersonJourney` · `peopleSteps` · `buildFollowCallers` · `whyParts` · `stuckEquation` · `recruitAudience`
 */
import type { RecruitAppFact, RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import { buildPersonJourney, buildFollowCallers, NO_CLAIMER } from '@/lib/recruitPersonJourney';
import { peopleSteps, whyParts } from '@/lib/recruitTopics';
import { bkkDay, outcomeSetsOf, type OutcomeSets } from '@/lib/recruitAudience';

/** ยอดของส่วน "ผู้สมัครและผลการติดต่อ" ตามแบบ — ลำดับเดียวกับแบบ */
export const V2_METRICS = ['apps', 'ai', 'follow', 'reached', 'allBooked', 'showed', 'erp'] as const;
export type V2Metric = (typeof V2_METRICS)[number];
export const V2_METRIC_LABEL: Record<V2Metric, string> = {
  apps: 'รายการสมัครเข้าใหม่',
  ai: 'AI โทรแล้ว',
  follow: 'สนใจหลัง AI โทร',
  reached: 'โทรต่อแล้วติดต่อได้',
  allBooked: 'นัดได้ทั้งหมด',
  showed: 'มาตามนัด',
  erp: 'พบรายการแจ้งเข้า ERP',
};

export type V2Part = { key: string; label: string; ids: string[] };
export type V2Stage = { key: V2Metric; label: string; ids: string[] | null; parts: V2Part[] };

const idsOf = (list: readonly RecruitAppFact[]) => list.map((f) => f.id ?? '').filter(Boolean);

/** ใบสมัครในช่วงที่เลือก (cohort วันที่สมัคร · ไทย) — server ส่งช่วงก่อนมาด้วย ตัดออก */
export function cohortOf(data: RecruitOverviewResponse): RecruitAppFact[] {
  const { from, to } = data.window;
  return (data.apps ?? []).filter((f) => {
    const d = bkkDay(f.createdAt);
    return d >= from && d <= to;
  });
}

/** เวลาอ้างอิงของผล — ช่วงย้อนหลัง = สิ้นวันสิ้นสุด (ผล ณ วันนั้น) · ช่วงถึงวันนี้ = เวลาที่ server สร้างข้อมูล */
export function refNowOf(data: RecruitOverviewResponse): Date {
  if (data.window.asOf) return new Date(Date.parse(`${data.window.asOf}T23:59:59.999+07:00`));
  return new Date(data.generatedAt);
}

export type V2Model = {
  cohort: RecruitAppFact[];
  byId: Map<string, RecruitAppFact>;
  sets: OutcomeSets;
  stages: Record<V2Metric, V2Stage>;
  /** สมการ: AI โทร + คนโทรเอง + รอ AI + ยังไม่มีใครโทร = รายการสมัคร */
  equation: V2Part[];
  /** ผู้ถือรายชื่อที่สนใจแล้วรอโทรเกิน 24 ชม. (id) */
  late: Set<string>;
  why: V2Part[];
};

export function buildV2Model(data: RecruitOverviewResponse): V2Model {
  const cohort = cohortOf(data);
  const now = refNowOf(data);
  const sets = outcomeSetsOf(cohort, now);
  const journey = buildPersonJourney(cohort, now);
  const steps = peopleSteps(cohort, now);
  const j = (k: string) => journey.find((s) => s.key === k);
  const step = (k: string) => steps.find((s) => s.key === k);
  const parts = (p: ReadonlyArray<{ key: string; label: string; ids?: string[] }> | undefined): V2Part[] => (p ?? []).map((x) => ({ key: x.key, label: x.label, ids: x.ids ?? [] }));
  const showedIds = idsOf(cohort.filter((f) => f.appointmentAt && f.attendance === 'showed'));
  const erpAll = cohort.length > 0 && cohort.every((f) => f.informed == null) ? null : idsOf(cohort.filter((f) => f.informed === true));
  const stages: Record<V2Metric, V2Stage> = {
    apps: { key: 'apps', label: V2_METRIC_LABEL.apps, ids: idsOf(cohort), parts: parts(j('apps')?.parts) },
    ai: { key: 'ai', label: V2_METRIC_LABEL.ai, ids: j('ai')?.ids ?? [], parts: parts(j('ai')?.parts) },
    follow: { key: 'follow', label: V2_METRIC_LABEL.follow, ids: j('follow')?.ids ?? [], parts: parts(j('follow')?.parts) },
    reached: { key: 'reached', label: V2_METRIC_LABEL.reached, ids: j('appoint')?.ids ?? [], parts: parts(j('appoint')?.parts) },
    allBooked: {
      key: 'allBooked',
      label: V2_METRIC_LABEL.allBooked,
      ids: step('allBooked')?.ids ?? [],
      parts: [...parts(step('allBooked')?.parts), ...parts(j('attend')?.parts).map((p) => ({ ...p, key: `attend:${p.key}`, label: `ผลนัด · ${p.label}` }))],
    },
    showed: {
      key: 'showed',
      label: V2_METRIC_LABEL.showed,
      ids: showedIds,
      parts: parts(j('pass')?.parts).map((p) => ({ ...p, label: p.key === 'passed' ? 'ผ่านคัดเลือก' : p.key === 'notPassed' ? 'ไม่ผ่านคัดเลือก' : 'ยังไม่บันทึกผลคัดเลือก' })),
    },
    erp: { key: 'erp', label: V2_METRIC_LABEL.erp, ids: erpAll, parts: [] },
  };
  const late = new Set(buildFollowCallers(cohort, now).flatMap((c) => c.notCalledLate));
  return {
    cohort,
    byId: new Map(cohort.map((f) => [f.id ?? '', f])),
    sets,
    stages,
    equation: parts(j('apps')?.parts),
    late,
    why: whyParts(cohort).map((p) => ({ key: p.key, label: p.label, ids: p.ids ?? [] })),
  };
}

/** ผู้รับรายชื่อของใบ (ไม่มีคนเก็บ = ยังไม่มีคนเก็บ) · ผู้พารายชื่อเข้ามา (ไม่ทราบ = ไม่ทราบคนพามา) */
export const holderOf = (f: RecruitAppFact): string => f.claimedBy?.trim() || NO_CLAIMER;
export const BRINGER_UNKNOWN = 'ไม่ทราบคนพามา';
export const bringerOf = (f: RecruitAppFact): string => f.bringer?.trim() || BRINGER_UNKNOWN;

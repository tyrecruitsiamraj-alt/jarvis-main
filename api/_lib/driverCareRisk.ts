import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const empT = tableInAppSchema('employees');
const incomeT = tableInAppSchema('driver_income_monthly');
const resignT = tableInAppSchema('driver_resignation_history');
const complaintT = tableInAppSchema('driver_complaint_event');
const riskT = tableInAppSchema('driver_risk_score');
const actionT = tableInAppSchema('driver_action_log');
const wcT = tableInAppSchema('work_calendar');

export type RiskLevel = 'low' | 'watch' | 'medium' | 'high';

export type RiskComponents = {
  income: number;
  leave: number;
  attendance: number;
  assignment: number;
  complaint: number;
  pattern: number;
  total: number;
  level: RiskLevel;
  mainReason: string;
  recommendedAction: string;
};

type EmployeeRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  position: string;
  status: string;
};

type IncomeRow = {
  income_month: string | Date;
  total_income: string | number;
  ot_hours: string | number;
};

type WcRow = {
  work_date: string | Date;
  status: string;
  client_name: string | null;
};

type ComplaintRow = {
  event_type: string;
  event_date: string | Date;
};

function toYmd(d: string | Date): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function toNum(v: string | number | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cap(n: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(n)));
}

function riskLevelFromTotal(total: number): RiskLevel {
  if (total >= 70) return 'high';
  if (total >= 50) return 'medium';
  if (total >= 30) return 'watch';
  return 'low';
}

function recommendedAction(level: RiskLevel): string {
  if (level === 'high') return 'HR/Operation โทรคุยภายใน 3 วัน และตรวจสอบรายได้/ไซต์งาน';
  if (level === 'medium') return 'HR/Operation ติดตามภายใน 7 วัน';
  if (level === 'watch') return 'Supervisor ตรวจสอบเบื้องต้น';
  return 'ติดตามตามรอบปกติ';
}

function buildMainReason(parts: { label: string; score: number }[]): string {
  const top = parts
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((p) => p.label);
  return top.length > 0 ? top.join(', ') : 'ไม่พบสัญญาณผิดปกติ';
}

function calcIncomeRisk(rows: IncomeRow[]): number {
  if (rows.length < 2) return 0;
  const sorted = [...rows].sort((a, b) => toYmd(b.income_month).localeCompare(toYmd(a.income_month)));
  const latest = sorted[0]!;
  const prev = sorted.slice(1, 3);
  if (prev.length === 0) return 0;

  const latestIncome = toNum(latest.total_income);
  const prevAvgIncome = prev.reduce((s, r) => s + toNum(r.total_income), 0) / prev.length;
  let score = 0;

  if (prevAvgIncome > 0) {
    const dropPct = ((prevAvgIncome - latestIncome) / prevAvgIncome) * 100;
    if (dropPct >= 20) score = 40;
    else if (dropPct >= 10) score = 25;
    else if (dropPct >= 5) score = 10;
  }

  const latestOt = toNum(latest.ot_hours);
  const prevOtAvg = prev.reduce((s, r) => s + toNum(r.ot_hours), 0) / prev.length;
  if (prevOtAvg > 0) {
    const otDrop = ((prevOtAvg - latestOt) / prevOtAvg) * 100;
    if (otDrop >= 30) score += 15;
  }

  return cap(score, 45);
}

function maxConsecutiveLeaveDays(rows: WcRow[]): number {
  const leaveDates = rows
    .filter((r) => r.status === 'day_off' || r.status === 'cancel_by_employee')
    .map((r) => toYmd(r.work_date))
    .sort();
  if (leaveDates.length === 0) return 0;

  let max = 1;
  let cur = 1;
  for (let i = 1; i < leaveDates.length; i += 1) {
    const prev = new Date(`${leaveDates[i - 1]}T00:00:00`);
    const curr = new Date(`${leaveDates[i]}T00:00:00`);
    const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
    if (diffDays === 1) {
      cur += 1;
      max = Math.max(max, cur);
    } else {
      cur = 1;
    }
  }
  return max;
}

function calcLeaveRisk(wcRows: WcRow[], today: Date): number {
  const leaveStatuses = new Set(['day_off', 'cancel_by_employee']);
  const t = today.getTime();
  const d30 = t - 30 * 86400000;
  const d90 = t - 90 * 86400000;

  const last30 = wcRows.filter((r) => {
    const ts = new Date(`${toYmd(r.work_date)}T00:00:00`).getTime();
    return ts >= d30 && leaveStatuses.has(r.status);
  }).length;

  const prev60 = wcRows.filter((r) => {
    const ts = new Date(`${toYmd(r.work_date)}T00:00:00`).getTime();
    return ts >= d90 && ts < d30 && leaveStatuses.has(r.status);
  }).length;

  const prevMonthlyAvg = prev60 / 2;
  let score = 0;
  if (prevMonthlyAvg > 0) {
    const increasePct = ((last30 - prevMonthlyAvg) / prevMonthlyAvg) * 100;
    if (increasePct >= 100) score = 35;
    else if (increasePct >= 50) score = 20;
    else if (increasePct >= 30) score = 10;
  }

  const consecutive = maxConsecutiveLeaveDays(wcRows);
  if (consecutive >= 3) score += 25;
  else if (consecutive >= 2) score += 15;

  return cap(score, 45);
}

function calcAttendanceRisk(wcRows: WcRow[], today: Date): number {
  const d30 = today.getTime() - 30 * 86400000;
  const recent = wcRows.filter((r) => new Date(`${toYmd(r.work_date)}T00:00:00`).getTime() >= d30);
  let score = 0;
  const late = recent.filter((r) => r.status === 'late').length;
  const noShow = recent.filter((r) => r.status === 'no_show').length;
  const cancelEmp = recent.filter((r) => r.status === 'cancel_by_employee').length;
  if (late >= 3) score += 10;
  if (noShow >= 1) score += 30;
  if (cancelEmp >= 2) score += 20;
  return cap(score, 40);
}

function calcComplaintRisk(events: ComplaintRow[], today: Date): number {
  const d60 = today.getTime() - 60 * 86400000;
  const recent = events.filter((e) => new Date(`${toYmd(e.event_date)}T00:00:00`).getTime() >= d60);
  let score = 0;
  for (const e of recent) {
    if (e.event_type === 'client_complaint' || e.event_type === 'driver_complaint') score += 20;
    if (e.event_type === 'request_transfer' || e.event_type === 'request_change_driver') score += 30;
  }
  if (recent.length >= 2) score += 25;
  return cap(score, 50);
}

async function hasResignPattern(employeeId: string, employeeCode: string, groups: string[]): Promise<boolean> {
  const { rows } = await dbQuery<{ ok: number }>(
    `select 1 as ok from ${resignT}
     where (employee_id = $1::uuid or employee_code = $2)
       and resignation_reason_group = any($3::text[])
     limit 1`,
    [employeeId, employeeCode, groups],
  );
  return rows.length > 0;
}

async function calcPatternRisk(
  employeeId: string,
  employeeCode: string,
  income: number,
  leave: number,
): Promise<number> {
  let score = 0;
  if (income > 0 && (await hasResignPattern(employeeId, employeeCode, ['income']))) score += 15;
  if (leave > 0 && (await hasResignPattern(employeeId, employeeCode, ['workload', 'personal', 'unknown']))) {
    score += 10;
  }
  if (income > 0 && leave > 0) score += 20;
  return cap(score, 25);
}

function latestSite(wcRows: WcRow[]): string {
  const sorted = [...wcRows].sort((a, b) => toYmd(b.work_date).localeCompare(toYmd(a.work_date)));
  return sorted.find((r) => r.client_name)?.client_name?.trim() || '—';
}

export async function fetchDriverEmployees(): Promise<EmployeeRow[]> {
  const { rows } = await dbQuery<EmployeeRow>(
    `select id, employee_code, first_name, last_name, position, status
     from ${empT}
     where status = 'active'
       and (
         position ilike '%ขับ%'
         or position ilike '%driver%'
         or position ilike '%valet%'
         or position ilike '%พนักงาน%'
       )
     order by employee_code asc`,
  );
  if (rows.length > 0) return rows;

  const { rows: fallback } = await dbQuery<EmployeeRow>(
    `select id, employee_code, first_name, last_name, position, status
     from ${empT}
     where status = 'active'
     order by created_at desc
     limit 50`,
  );
  return fallback;
}

export async function computeRiskForEmployee(emp: EmployeeRow, today = new Date()): Promise<RiskComponents & { siteName: string }> {
  const { rows: incomes } = await dbQuery<IncomeRow>(
    `select income_month, total_income, ot_hours
     from ${incomeT}
     where employee_id = $1
     order by income_month desc
     limit 3`,
    [emp.id],
  );

  const since90 = new Date(today);
  since90.setDate(since90.getDate() - 90);
  const { rows: wcRows } = await dbQuery<WcRow>(
    `select work_date, status, client_name
     from ${wcT}
     where employee_id = $1 and work_date >= $2::date`,
    [emp.id, toYmd(since90)],
  );

  const since60 = new Date(today);
  since60.setDate(since60.getDate() - 60);
  const { rows: complaints } = await dbQuery<ComplaintRow>(
    `select event_type, event_date
     from ${complaintT}
     where employee_id = $1 and event_date >= $2::date`,
    [emp.id, toYmd(since60)],
  );

  const income = calcIncomeRisk(incomes);
  const leave = calcLeaveRisk(wcRows, today);
  const attendance = calcAttendanceRisk(wcRows, today);
  const complaint = calcComplaintRisk(complaints, today);
  const pattern = await calcPatternRisk(emp.id, emp.employee_code, income, leave);
  const assignment = 0;

  const total = cap(income + leave + attendance + assignment + complaint + pattern, 100);
  const level = riskLevelFromTotal(total);

  const reasonParts: { label: string; score: number }[] = [];
  if (income >= 25) reasonParts.push({ label: `รายได้ลดผิดปกติ (${income})`, score: income });
  else if (income > 0) reasonParts.push({ label: `รายได้ลด ${income}%`, score: income });

  if (leave >= 20) reasonParts.push({ label: `ลาเพิ่มขึ้น (${leave})`, score: leave });
  else if (leave > 0) reasonParts.push({ label: `ลาเพิ่ม ${leave}%`, score: leave });

  if (attendance >= 30) reasonParts.push({ label: 'No-show ใน 30 วัน', score: attendance });
  else if (attendance > 0) reasonParts.push({ label: 'มาสาย/ขาดงาน', score: attendance });

  if (complaint > 0) reasonParts.push({ label: 'ลูกค้าร้องเรียน/ขอเปลี่ยนคนขับ', score: complaint });
  if (pattern > 0) reasonParts.push({ label: 'Pattern คล้ายกลุ่มลาออก', score: pattern });

  return {
    income,
    leave,
    attendance,
    assignment,
    complaint,
    pattern,
    total,
    level,
    mainReason: buildMainReason(reasonParts),
    recommendedAction: recommendedAction(level),
    siteName: latestSite(wcRows),
  };
}

export async function recalculateRiskScores(scoreDate?: string): Promise<number> {
  const today = scoreDate || new Date().toISOString().slice(0, 10);
  const drivers = await fetchDriverEmployees();
  let count = 0;

  for (const emp of drivers) {
    const risk = await computeRiskForEmployee(emp, new Date(`${today}T12:00:00`));
    await dbQuery(
      `insert into ${riskT} (
        score_date, employee_id,
        income_risk_score, leave_risk_score, attendance_risk_score,
        assignment_risk_score, complaint_risk_score, pattern_risk_score,
        total_risk_score, risk_level, main_reason, recommended_action, rule_version, updated_at
      ) values ($1::date, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'v1', now())
      on conflict (employee_id, score_date) do update set
        income_risk_score = excluded.income_risk_score,
        leave_risk_score = excluded.leave_risk_score,
        attendance_risk_score = excluded.attendance_risk_score,
        assignment_risk_score = excluded.assignment_risk_score,
        complaint_risk_score = excluded.complaint_risk_score,
        pattern_risk_score = excluded.pattern_risk_score,
        total_risk_score = excluded.total_risk_score,
        risk_level = excluded.risk_level,
        main_reason = excluded.main_reason,
        recommended_action = excluded.recommended_action,
        updated_at = now()`,
      [
        today,
        emp.id,
        risk.income,
        risk.leave,
        risk.attendance,
        risk.assignment,
        risk.complaint,
        risk.pattern,
        risk.total,
        risk.level,
        risk.mainReason,
        risk.recommendedAction,
      ],
    );
    count += 1;
  }

  // Assignment risk pass: site with >2 high or >4 medium+
  const { rows: siteAgg } = await dbQuery<{ site_name: string; high_cnt: string; med_cnt: string }>(
    `select coalesce(w.client_name, '—') as site_name,
            sum(case when r.risk_level = 'high' then 1 else 0 end) as high_cnt,
            sum(case when r.risk_level in ('high','medium') then 1 else 0 end) as med_cnt
     from ${riskT} r
     left join lateral (
       select client_name from ${wcT} w
       where w.employee_id = r.employee_id
       order by w.work_date desc limit 1
     ) w on true
     where r.score_date = $1::date
     group by coalesce(w.client_name, '—')`,
    [today],
  );

  const hotSites = new Set(
    siteAgg
      .filter((s) => Number(s.high_cnt) > 2 || Number(s.med_cnt) > 4)
      .map((s) => s.site_name),
  );

  if (hotSites.size > 0) {
    for (const emp of drivers) {
      const risk = await computeRiskForEmployee(emp, new Date(`${today}T12:00:00`));
      if (!hotSites.has(risk.siteName)) continue;
      const assignment = 10;
      const total = cap(risk.income + risk.leave + risk.attendance + assignment + risk.complaint + risk.pattern, 100);
      const level = riskLevelFromTotal(total);
      await dbQuery(
        `update ${riskT}
         set assignment_risk_score = $3, total_risk_score = $4, risk_level = $5, updated_at = now()
         where employee_id = $1 and score_date = $2::date`,
        [emp.id, today, assignment, total, level],
      );
    }
  }

  return count;
}

export async function ensureTodayRiskScores(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const { rows } = await dbQuery<{ cnt: string }>(
    `select count(*)::text as cnt from ${riskT} where score_date = $1::date`,
    [today],
  );
  if (Number(rows[0]?.cnt || 0) === 0) {
    await recalculateRiskScores(today);
  }
  return today;
}

export { riskT, actionT, empT, wcT };

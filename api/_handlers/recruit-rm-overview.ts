/**
 * GET /api/recruit-rm-overview — ตัวเลข Dashboard "ศูนย์คุมงานสรรหา" (เจ้าของสั่ง 15 ส.ค. 2569)
 *
 * นับฝั่ง SQL ทั้งหมด (เลิกนับ client จาก limit 500) · scope เดียวกับลิสต์ใบสมัคร
 * (job∈ใบขอที่เห็นได้ หรือ department_code ตรงแผนก — เลขต้องกดแล้วเจอแถวเท่ากัน)
 * · นิยามทุกถังอยู่ที่ api/_lib/applicantOverviewSql.ts **ที่เดียว** (drill-down ใช้ร่วม)
 * · อ่านไม่ได้ = null + ธง unavailable — **ไม่ใช่ 0** (0 ที่แปลว่าเช็คไม่ได้อันตรายกว่า)
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { dbQuery, isPgUndefinedTable } from '../_lib/postgres.js';
import { loadScopedJobIdSet } from '../_lib/siamrajUnitRequests.js';
import { loadUserDepartmentScope } from '../_lib/departmentScope.js';
import {
  buildAttendanceSummarySql,
  buildClaimedIdleSql,
  buildOverviewSql,
} from '../_lib/applicantOverviewSql.js';
import { logError } from '../_lib/logger.js';

type Flag = { metric: string; flag: 'unavailable' | 'partial-history' | 'proxy'; note: string };

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const scopedJobIds = await loadScopedJobIdSet(req.user);
    const dept = await loadUserDepartmentScope(req.user);
    const params: [string[] | null, string | null] = [
      scopedJobIds ? [...scopedJobIds] : null,
      dept.mode === 'code' ? dept.code : null,
    ];

    const flags: Flag[] = [];

    type OverviewRow = {
      total: number;
      distinct_phones: number;
      leads: number;
      invalid_phone: number;
      called: number;
      called_via_other: number;
      in_queue_awaiting: number;
      held_or_claimed: number;
      untouched: number;
      contact_success: number;
      contact_failed: number;
      scheduled: number;
      success_unscheduled: number;
      over5d_uncalled: number;
      uncalled_age_0_3: number;
      uncalled_age_4_7: number;
      uncalled_age_over7: number;
      wait_median_hours: number | null;
      wait_p90_hours: number | null;
      wait_sample: number;
    };

    const { rows } = await dbQuery<OverviewRow>(buildOverviewSql(), params);
    const o = rows[0];

    // เวลารอโทร: backfill 088 เป็นค่าประมาณ (updated_at เคยขยับ) — ธงติดตลอดจนกว่า
    // ข้อมูลหลังวันรัน 088 จะเป็นส่วนใหญ่ (แถวเก่าถูกล้างไปแล้ว 14 ส.ค. — ธงเผื่อ server จริง)
    if (o.wait_sample > 0) {
      flags.push({
        metric: 'waiting',
        flag: 'partial-history',
        note: 'เวลาโทรของแถวก่อนรัน migration 088 เป็นค่าประมาณ',
      });
    }
    if (o.called_via_other > 0) {
      flags.push({
        metric: 'called',
        flag: 'proxy',
        note: `ในนั้น ${o.called_via_other} ใบนับจากผลโทรของเบอร์เดียวกันในช่องทางอื่น (บอร์ด/iRecruit/Follow)`,
      });
    }

    // ใครเก็บแล้วยังไม่โทร — เจ้าของเคาะ: โชว์ชื่อบน dashboard ให้ทุกคนเห็น
    let claimedIdle: { total: number; byUser: Array<{ name: string | null; count: number; oldestClaimedAt: string }> } = {
      total: 0,
      byUser: [],
    };
    try {
      const { rows: idle } = await dbQuery<{ name: string | null; n: number; oldest_claimed_at: string }>(
        buildClaimedIdleSql(),
        params,
      );
      claimedIdle = {
        total: idle.reduce((s, r) => s + Number(r.n), 0),
        byUser: idle.map((r) => ({ name: r.name, count: Number(r.n), oldestClaimedAt: r.oldest_claimed_at })),
      };
    } catch (e) {
      if (!isPgUndefinedTable(e)) throw e;
    }

    // ผลติดตามนัด (089) — ตารางยังไม่ migrate = null + ธง (ไม่ใช่ 0)
    let attendance: { showed: number; noShow: number; overdueNoResult: number; upcoming: number } | null = null;
    try {
      const { rows: att } = await dbQuery<{
        showed: number;
        no_show: number;
        overdue_no_result: number;
        upcoming: number;
      }>(buildAttendanceSummarySql(), params);
      const t = att[0];
      attendance = {
        showed: Number(t.showed),
        noShow: Number(t.no_show),
        overdueNoResult: Number(t.overdue_no_result),
        upcoming: Number(t.upcoming),
      };
    } catch (e) {
      if (!isPgUndefinedTable(e)) throw e;
      flags.push({
        metric: 'attendance',
        flag: 'unavailable',
        note: 'เริ่มบันทึกมา/ไม่มาได้เมื่อรัน migration 089',
      });
    }

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      version: 1,
      scope: { departmentLimited: scopedJobIds !== null },
      intake: {
        total: o.total,
        distinctPhones: o.distinct_phones,
        leads: o.leads,
        invalidPhone: o.invalid_phone,
      },
      calling: {
        called: o.called,
        calledViaOtherChannel: o.called_via_other,
        inQueueAwaitingAi: o.in_queue_awaiting,
        heldOrClaimed: o.held_or_claimed,
        untouched: o.untouched,
      },
      contact: { success: o.contact_success, failed: o.contact_failed },
      appointment: { scheduled: o.scheduled, successNoAppointment: o.success_unscheduled },
      attendance,
      waiting:
        o.wait_sample > 0
          ? {
              medianHours: o.wait_median_hours == null ? null : Math.round(Number(o.wait_median_hours) * 10) / 10,
              p90Hours: o.wait_p90_hours == null ? null : Math.round(Number(o.wait_p90_hours) * 10) / 10,
              sampleSize: o.wait_sample,
            }
          : null,
      stale: {
        over5DaysUncalled: o.over5d_uncalled,
        agingUncalled: { d0_3: o.uncalled_age_0_3, d4_7: o.uncalled_age_4_7, over7: o.uncalled_age_over7 },
        claimedIdle,
      },
      meta: { generatedAt: new Date().toISOString(), definitionsVersion: 1, flags },
    });
  } catch (e) {
    logError('recruit-rm-overview', e, { userId: req.user?.sub });
    return handleApiError(res, e, 'recruit-rm-overview', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');

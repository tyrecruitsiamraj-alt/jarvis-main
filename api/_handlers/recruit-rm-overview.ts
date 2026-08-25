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
  bucketCondition,
  buildAttendanceSummarySql,
  buildAwaitingChoiceSql,
  buildClaimedIdleSql,
  buildOverviewSql,
} from '../_lib/applicantOverviewSql.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { loadBoardPhoneSet } from '../_lib/applicationBoardLink.js';
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

    // กอง "รอเลือกวิธีโทร" (104) — คอลัมน์ยังไม่ migrate = null (ไม่ใช่ 0) แล้วซ่อนกล่องไป
    let awaitingCallChoice: { total: number; oldestUnclaimedAt: string | null } | null = null;
    try {
      const { rows: aw } = await dbQuery<{ n: number; oldest_unclaimed_at: string | null }>(
        buildAwaitingChoiceSql(),
        params,
      );
      awaitingCallChoice = {
        total: Number(aw[0]?.n ?? 0),
        oldestUnclaimedAt: aw[0]?.oldest_unclaimed_at ?? null,
      };
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== '42703' && !isPgUndefinedTable(e)) throw e;
      flags.push({
        metric: 'awaitingCallChoice',
        flag: 'unavailable',
        note: 'กอง "รอเลือกวิธีโทร" ใช้ได้เมื่อรัน migration 104',
      });
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

    // เส้นแบ่งสรรหา→คัดสรร (16 ส.ค.): คนสนใจจริงที่ยังไม่ขึ้นบอร์ด = "รอเก็บใบสมัคร"
    // ขึ้นบอร์ดแล้ว = "ได้ใบสมัครแล้ว" (conversion ของสรรหา) · จับคู่ด้วยเบอร์ (proxy)
    // นับใน JS เพราะ board membership เป็น ERP (ใส่ SQL pg ไม่ได้) · interested เป็น subset เล็ก
    let recruit: { interested: number; collected: number; waitingCollect: number } | null = null;
    try {
      const boardPhones = await loadBoardPhoneSet();
      const { rows: interestedRows } = await dbQuery<{ phone_e164: string | null }>(
        `select a.phone_e164 from ${tableInAppSchema('public_job_applications')} a
          where ($1::text[] is null or a.job_id = any($1::text[])
                 or ($2::text is not null and a.department_code = $2::text))
            and ${bucketCondition('contact_success')}`,
        params,
      );
      const interested = interestedRows.length;
      if (boardPhones === null) {
        recruit = { interested, collected: -1, waitingCollect: -1 }; // -1 = อ่านบอร์ดไม่ได้
        flags.push({ metric: 'recruit', flag: 'unavailable', note: 'อ่านรายชื่อบนบอร์ด ERP ไม่ได้ — ยอดเก็บใบสมัครเช็คไม่ได้ชั่วคราว' });
      } else {
        const collected = interestedRows.filter((r) => r.phone_e164 && boardPhones.has(r.phone_e164)).length;
        recruit = { interested, collected, waitingCollect: interested - collected };
        flags.push({ metric: 'recruit', flag: 'proxy', note: 'จับคู่ "ได้ใบสมัครแล้ว" ด้วยเบอร์โทรกับรายชื่อบนบอร์ด' });
      }
    } catch (e) {
      if (!isPgUndefinedTable(e)) throw e;
    }

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      version: 1,
      scope: { departmentLimited: scopedJobIds !== null },
      recruit,
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
        awaitingCallChoice,
      },
      meta: { generatedAt: new Date().toISOString(), definitionsVersion: 1, flags },
    });
  } catch (e) {
    logError('recruit-rm-overview', e, { userId: req.user?.sub });
    return handleApiError(res, e, 'recruit-rm-overview', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');

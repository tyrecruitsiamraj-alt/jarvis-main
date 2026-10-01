/**
 * งานของทีม Online ที่ต้องทำต่อ (รอบ 4 · 29 ก.ย. 2569) — ต่อท้ายถังของหน้าหลัก (`buildNextTasks`) บนหน้าทีม Online
 *
 * เจ้าของ: *"ถ้าเป็น User รู้ไหมต้องทำงานอะไร"* → Choice "งานของฉันเป็นหลัก ย่อส่วนวิเคราะห์"
 *
 * 🔴 **กดแล้วต้องเจอเลขเท่ากัน** — ทุกงานนับจากชุดเดียวกับหน้าปลายทาง:
 *   - เลนของกล่องงาน (`lanes.scope` = `buildReleaseLedger` แบบเดียวกับหัวกล่องงาน) → `/jobs/board?lane=…`
 *   - ถังของหน้ารายชื่อ (`applicants.backlogScope` = `OVERVIEW_BUCKETS`) → `/jobs/board?view=list&bucket=…`
 *   ทั้งสองหน้า **ไม่มีตัวกรอง BU** ⇒ ใช้ยอดทั้งสิทธิ์ของคนเปิด (`scope`) ไม่ใช่ยอดตามตัวกรอง BU ของหน้า
 *   (ของเดิมรอบ 1–3 นับ "ยังไม่ Gen link" เองจากตารางประกาศ — กดไปกล่องงานแล้วเจอเลขไม่เท่า เลยถอดทิ้ง)
 * ป้าย/ปลายทางมาจากพจนานุกรมเลข (`teamOnline.lane*` · `teamOnline.unscheduled`) ที่เดียว
 * ⚠️ ไม่ใส่ "เกิน 5 วันยังไม่ถูกโทร" — ซ้อนกับถัง "ยังไม่มีใครแตะ" ของหน้าหลักที่อยู่ในลิสต์เดียวกันแล้ว (คนเดียวโผล่สองงาน)
 */
import { METRICS } from '@/lib/metricDictionary';
import type { NextTask } from '@/lib/nextTask';
import type { TeamOnlineResponse } from '@/lib/teamOnline';

const NUM = new Intl.NumberFormat('th-TH');

export function onlineTasks(data: TeamOnlineResponse | null): NextTask[] {
  const out: NextTask[] = [];
  const back = data?.applicants?.backlogScope;
  const lane = data?.lanes?.scope;
  const unscheduled = back?.stages.success_unscheduled ?? 0;
  if (unscheduled > 0) {
    out.push({
      key: 'online-unscheduled',
      title: `นัดผู้สมัครที่ติดต่อได้แล้ว ${NUM.format(unscheduled)} ใบ`,
      reason: 'คุยถึงตัวแล้วแต่ยังไม่มีบันทึกนัด (รวมคนที่คุยแล้วปฏิเสธ) — เช็คว่าใครควรนัดต่อ',
      badge: 'ยังไม่ได้นัด',
      count: unscheduled,
      tone: 'danger',
      path: METRICS['teamOnline.unscheduled'].href,
      action: 'เปิดรายชื่อผู้สมัคร',
      stepKey: 'matching',
    });
  }
  if (lane && lane.publish > 0) {
    out.push({
      key: 'online-publish',
      title: `ส่งประกาศที่มีลิงก์แล้ว ${NUM.format(lane.publish)} ใบ`,
      reason: 'Gen link แล้วเหลือแค่กดส่งประกาศ — ยังไม่ขึ้นหน้าสมัครงาน คนนอกยังไม่เห็น',
      badge: 'เหลือขั้นเดียว',
      count: lane.publish,
      tone: 'warn',
      path: METRICS['teamOnline.lanePublish'].href,
      action: 'เปิดกล่องงาน',
      stepKey: 'requests',
    });
  }
  if (lane && lane.silent > 0) {
    out.push({
      key: 'online-silent',
      title: `ดันใบที่ประกาศแล้วยังไม่มีคนสมัคร ${NUM.format(lane.silent)} ใบ`,
      reason: 'ขึ้นหน้าสมัครงานแล้วแต่ยังไม่มีใครกรอก — ลองเพิ่มช่องทางหรือปรับประกาศ',
      badge: 'ประกาศเงียบ',
      count: lane.silent,
      tone: 'warn',
      path: METRICS['teamOnline.laneSilent'].href,
      action: 'เปิดกล่องงาน',
      stepKey: 'requests',
    });
  }
  if (lane && lane.sourcing > 0) {
    out.push({
      key: 'online-sourcing',
      title: `ประกาศใบที่ยังต้องหาคน ${NUM.format(lane.sourcing)} ใบ`,
      reason: 'ยังไม่ขึ้นหน้าสมัครงาน — ค้างสะสม แก้วันนี้ไม่จบ แต่ต้องรู้ว่ากองอยู่เท่าไหร่',
      // คำเดียวกับชิปย่อยของกล่องงาน — "ยังไม่ปล่อย" บนกล่องงานคือ 320 (รวมใบที่มีคนเริ่มงานแล้ว)
      badge: 'ยังต้องหาคน',
      count: lane.sourcing,
      tone: 'info',
      path: METRICS['teamOnline.laneSourcing'].href,
      action: 'เปิดกล่องงาน',
      stepKey: 'requests',
    });
  }
  return out;
}

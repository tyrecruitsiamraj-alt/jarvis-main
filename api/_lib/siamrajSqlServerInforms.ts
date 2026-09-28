/**
 * ═══ ใบแจ้งเข้าตามวันที่จริง (หาได้แล้วรายวัน) — ERP อ่านอย่างเดียว ═══
 *
 * เจ้าของอนุญาต 28 ก.ย. 2569 (Choice "ได้ อ่านอย่างเดียว") ให้ Dashboard แนวโน้มนับ "หาได้แล้ว"
 * **ตามวันที่แจ้งเข้าจริง** แทนการเดาจากสถานะล่าสุดของใบขอ
 *
 * 🔴 ทำไมต้องมี: ยอด "หาได้แล้ว" ของ Dashboard เดิมผูกกับ **งวดของใบขอ** (เดือนที่ลูกค้าต้องการคน)
 * งวดล่าสุดจึงดูต่ำเสมอเพราะใบยังเปิดอยู่ · ผู้บริหารถาม "วันนี้/สัปดาห์นี้ทีมหาคนได้กี่คน" ต้องนับตามวันที่แจ้งเข้า
 * (กติกาโปรเจกต์: ยอดหาได้แล้วรายเดือนต้องใช้วันที่ของเหตุการณ์ ถ้าไม่มีต้องติดธงประมาณการ)
 *
 * นิยาม (ชุดเดียวกับเส้นใบขอ — ยอดต้องเทียบกันได้):
 * - ใบแจ้งเข้าที่นับ = `activeInformWhereSql` (status 'A' · ใบที่ถูกยกเลิกไม่นับ — บทเรียน 24 ก.ย.)
 * - ขอบเขต BU/ไซต์/ประเภทสัญญา = ตัวเดียวกับ throughput (`getSqlFilters` · `excludeClsContractTypeWhere`)
 * - หนึ่งใบแจ้งเข้า = หนึ่งอัตรา (ตัวเดียวกับที่ throughput นับเมื่อ inform_qty ว่าง)
 *
 * ⚠️ กรอง `IH.inform_date` ตรง ๆ ไม่ห่อฟังก์ชัน — ให้ SQL Server ใช้ดัชนีได้ถ้ามี (ห้ามเขียน CONVERT ครอบคอลัมน์ใน WHERE)
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { activeInformWhereSql } from './siamrajStaffingOpen.js';
import { excludeClsContractTypeWhere, getSqlFilters } from './siamrajSqlServerThroughput.js';
import { toBangkokYmd } from './businessDate.js';
import type { InformTrendRow } from '../../src/lib/trends/types.js';

type SqlInformDayRow = {
  request_no: string | null;
  inform_day: Date | string | null;
  cnt: number | string | null;
  department_code: string | null;
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function listSiamrajSqlServerInformDays(options: { from: string; to: string }): Promise<InformTrendRow[]> {
  const { from, to } = options;
  if (!YMD_RE.test(from) || !YMD_RE.test(to)) throw new Error('from/to must be YYYY-MM-DD');
  const filters = getSqlFilters();
  const clsExclude = excludeClsContractTypeWhere('SS');
  const rows = await siamrajSqlQuery<SqlInformDayRow>(
    `
    SELECT
      IH.request_no,
      CONVERT(date, IH.inform_date) AS inform_day,
      COUNT_BIG(*) AS cnt,
      RTRIM(SS.department_code) AS department_code
    FROM st_inform_head IH
    INNER JOIN st_request_head A ON A.request_no = IH.request_no
    INNER JOIN ms_site SS ON A.site_code = SS.site_code
    WHERE ${activeInformWhereSql('IH')}
      AND IH.inform_date >= @fromDate
      AND IH.inform_date < DATEADD(day, 1, CONVERT(date, @toDate))
      AND SS.department_code BETWEEN @deptFrom AND @deptTo
      AND A.site_code BETWEEN @siteFrom AND @siteTo
      ${clsExclude}
    GROUP BY IH.request_no, CONVERT(date, IH.inform_date), RTRIM(SS.department_code)
  `,
    { ...filters, fromDate: from, toDate: to },
  );
  const out: InformTrendRow[] = [];
  for (const r of rows) {
    const requestNo = (r.request_no || '').trim();
    const day = r.inform_day ? toBangkokYmd(r.inform_day) : '';
    const count = Number(r.cnt) || 0;
    if (!requestNo || !day || count <= 0) continue;
    out.push({
      requestNo,
      day,
      count,
      departmentCode: (r.department_code || '').trim().toUpperCase() || null,
    });
  }
  return out;
}

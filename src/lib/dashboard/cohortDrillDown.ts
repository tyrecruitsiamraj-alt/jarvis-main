import type { ThroughputRecord } from '@/lib/dashboard/throughput';
import { requestLeadKindFromDays, type RequestLeadKind } from '@/lib/requestLeadKind';

/**
 * drill-down ของการ์ด **เข้ามา / ปิดแล้ว / ยกเลิก / คงเหลือ** บน Request Control Tower
 *
 * > เจ้าของสั่ง 18 ส.ค. 2569: *"ตรง เข้ามา ปิดได้ ยกเลิก คงเหลือ กดเข้าไปต้องมีใบขอบอกด้วยสิ
 * > ต่อให้ดูเป็นรายเดือน ทั้งปี ก็ต้องขึ้น"*
 *
 * 🔴 **ตัวเลขบนการ์ดกับรายการต้องมาจากชุดเดียวกัน** — ของเดิมเลขมาจาก `throughputRecords`
 * (ยอด ERP ของใบที่กรอกในช่วง รวมใบที่ปิด/ยกเลิกไปแล้ว) แต่รายการไปกรองจาก **กองใบที่ยังเปิด
 * ในกล่องงาน** ซึ่งเป็นคนละกอง วัดจริง 18 ส.ค.: การ์ด「เข้ามา」7,548 อัตรา · 5,602 ใบ
 * แต่กดแล้วได้ 340 อัตรา · 289 ใบ ส่วนการ์ด「ยกเลิก」1,686 ใบ กดแล้ว**ว่างเปล่า**
 * ตัวนี้จึงแตกรายการจาก `throughputRecords` ชุดเดียวกับที่ `sumCohortStockByRequestDate` นับ
 * เลขกับรายการจึงตรงกันทุกโหมด (เดือน / ทั้งปี / ทั้งหมด)
 *
 * 🔴 **คีย์คือเลขที่ใบขอดิบเต็ม ๆ** — ห้ามตัดนำหน้าทิ้ง เลขท้ายซ้ำกันข้าม BU
 * (`6907002` มี 9 ใบ ข้าม 4 BU) · เปิดใบใช้ `jobId` (`siamraj-sql:<เลขดิบ>`) ไม่ใช่เลขที่โชว์
 *
 * 🔴 **อัตราที่ระบุใบไม่ได้ต้องบอก** — แถว throughput ที่ไม่มีเลขที่ใบยังถูกนับใน
 * อัตราบนการ์ด แต่ลิสต์เป็นรายใบไม่ได้ ต้องคืนออกมาให้หน้าจอขึ้นข้อความ ห้ามหายเงียบ
 */

export type CohortDrillKpi = 'total_requests' | 'closed' | 'cancelled' | 'remaining';

export type CohortDrillRow = {
  /** เลขที่ใบขอดิบจาก ERP — คีย์จัดกลุ่ม */
  requestNo: string;
  /** id เต็มไว้เปิดใบ · null = ไม่รู้ (เปิดใบไม่ได้) */
  jobId: string | null;
  /** เลขที่ใบขอแบบที่โชว์บนจอ */
  requestNoDisplay: string;
  unitName: string | null;
  siteCode: string | null;
  departmentCode: string | null;
  requestDate: string;
  /** วันที่ต้องการคน · null = ERP ไม่ได้กรอก */
  requiredDate: string | null;
  /** ล่วงหน้า / ฉุกเฉิน / ฉุกเฉิน-ย้อนหลัง — เจ้าของสั่งให้บอกบน drill-down 18 ส.ค. 2569 */
  leadKind: RequestLeadKind;
  requestActionName: string | null;
  /** อัตราของถังที่กด (เข้ามา = ทั้งใบ · ปิด/ยกเลิก/คงเหลือ = เฉพาะส่วนนั้น) */
  positions: number;
  requestPositions: number;
  filledPositions: number;
  cancelledPositions: number;
  remainingPositions: number;
};

export type CohortDrillResult = {
  rows: CohortDrillRow[];
  /** รวมอัตราของถัง — ต้องเท่าเลขใหญ่บนการ์ด */
  positions: number;
  /** จำนวนใบขอ — ต้องเท่าเลขรองบนการ์ด */
  requestCount: number;
  /** อัตราที่นับอยู่ในการ์ดแต่ระบุใบไม่ได้ (แถวไม่มีเลขที่ใบ) */
  positionsWithoutRequestNo: number;
};

function inYmdRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

/** ชนิดของแถว — ตรงกับ resolveKind ของ throughput.ts (แถวเก่าไม่มี kind ใช้ isOpen แทน) */
function resolveKind(r: ThroughputRecord): 'filled' | 'cancelled' | 'remaining' {
  if (r.kind === 'filled' || r.kind === 'cancelled' || r.kind === 'remaining') return r.kind;
  return r.isOpen ? 'remaining' : 'filled';
}

/**
 * แตก `throughputRecords` เป็นรายใบขอตามถังที่กด
 *
 * `from`/`to` ต้องเป็นช่วงเดียวกับที่ `sumCohortStockByRequestDate` ใช้คิดเลขบนการ์ด
 * ไม่งั้นเลขกับรายการหลุดจากกันอีก
 */
export function buildCohortDrillDown(
  records: ThroughputRecord[],
  from: string,
  to: string,
  kpi: CohortDrillKpi,
): CohortDrillResult {
  const byRequest = new Map<string, CohortDrillRow>();
  /** อัตราของแถวที่ไม่มีเลขที่ใบ — แยกตามถัง เพราะการ์ดแต่ละใบนับคนละถัง */
  const orphan = { total: 0, filled: 0, cancelled: 0, remaining: 0 };

  for (const r of records) {
    if (!r.requestDate || !inYmdRange(r.requestDate, from, to)) continue;
    const units = Number(r.positionUnits) || 0;
    const key = (r.requestNo || '').trim();
    if (!key) {
      orphan.total += units;
      const orphanKind = resolveKind(r);
      if (orphanKind === 'filled') orphan.filled += units;
      else if (orphanKind === 'cancelled') orphan.cancelled += units;
      else orphan.remaining += units;
      continue;
    }

    let row = byRequest.get(key);
    if (!row) {
      row = {
        requestNo: key,
        jobId: (r.jobId || '').trim() || null,
        requestNoDisplay: (r.requestNoDisplay || '').trim() || key,
        unitName: (r.unitName || '').trim() || null,
        siteCode: (r.siteCode || '').trim() || null,
        departmentCode: (r.departmentCode || '').trim().toUpperCase() || null,
        requestDate: r.requestDate,
        requiredDate: r.requiredDate ?? null,
        // แถวเก่าที่ยังไม่มี leadKind (deploy ก่อนหน้า) ให้ถอยไปคิดจากวันเอง
        leadKind: r.leadKind ?? requestLeadKindFromDays(null),
        requestActionName: (r.requestActionName || '').trim() || null,
        positions: 0,
        requestPositions: 0,
        filledPositions: 0,
        cancelledPositions: 0,
        remainingPositions: 0,
      };
      byRequest.set(key, row);
    }

    // ใบเดียวกันมาหลายแถว (ปิด/ยกเลิก/คงเหลือ) — วันที่เปิดใบใช้วันแรกสุดเสมอ
    if (r.requestDate < row.requestDate) row.requestDate = r.requestDate;

    row.requestPositions += units;
    const kind = resolveKind(r);
    if (kind === 'filled') row.filledPositions += units;
    else if (kind === 'cancelled') row.cancelledPositions += units;
    else row.remainingPositions += units;
  }

  const rows: CohortDrillRow[] = [];
  let positions = 0;
  for (const row of byRequest.values()) {
    const bucketPositions =
      kpi === 'total_requests'
        ? row.requestPositions
        : kpi === 'closed'
          ? row.filledPositions
          : kpi === 'cancelled'
            ? row.cancelledPositions
            : row.remainingPositions;
    // การ์ด「เข้ามา」นับทุกใบในช่วง · การ์ดอื่นนับเฉพาะใบที่มีอัตราในถังนั้น
    if (kpi !== 'total_requests' && bucketPositions <= 0) continue;
    rows.push({ ...row, positions: bucketPositions });
    positions += bucketPositions;
  }

  // เก่าสุดขึ้นก่อน (กฎเดียวกับบอร์ดและหน้ารายการใบขอ) · เลขที่ใบเป็นตัวตัดสินรอง
  rows.sort((a, b) =>
    a.requestDate === b.requestDate
      ? a.requestNoDisplay.localeCompare(b.requestNoDisplay, 'th')
      : a.requestDate < b.requestDate
        ? -1
        : 1,
  );

  const missing =
    kpi === 'total_requests'
      ? orphan.total
      : kpi === 'closed'
        ? orphan.filled
        : kpi === 'cancelled'
          ? orphan.cancelled
          : orphan.remaining;

  return {
    rows,
    positions: positions + missing,
    requestCount: rows.length,
    positionsWithoutRequestNo: missing,
  };
}

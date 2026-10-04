/**
 * ═══ สรุปแผนทั้งวันเป็นรูป PNG (เจ้าของสั่ง 3 ต.ค. 2569: *"สรุปแผนทั้งวันอะ ทำให้โหลดเป็นรูปได้หน่อย"*) ═══
 *
 * วาดตารางเดียวกับ `followDayReport` ลง canvas แล้วให้เบราว์เซอร์ดาวน์โหลดเป็นไฟล์
 * — เอาไว้ส่งต่อใน LINE/แชตเป็นรูปเดียว ไม่ต้องแคปจอ
 *
 * กติกา: พื้นขาวเสมอ (รูปไปโผล่ในแชตของคนอื่น ไม่ตามธีมเครื่องเรา) · ฟอนต์ Kanit
 * ตัวเดียวกับทั้งระบบ (โหลดผ่าน `document.fonts` ก่อนวาด ไม่งั้น canvas ใช้ fallback เงียบ ๆ)
 * · สีทุกสีมาจาก `TONE.*.hex` หรือชื่อสีมาตรฐาน — ห้าม hex ดิบ
 */
import { TONE } from '@/lib/designTokens';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { FOLLOW_DAY_REPORT_HEADERS, type FollowDayReport } from '@/lib/followDayReport';

type ReportRow = FollowDayReport['rows'][number];

/**
 * 🔴 แบ่งรูปเป็นหน้า (เจ้าของสั่ง 4 ต.ค. 2569: *"แผนที่บันทึกเป็นรูปพอมันเยอะ ๆ แล้วมันยาวมาก ก็โหลดเป็นรูปตามหน้า
 * มีกี่หน้าก็รูปตามนั้น"*) — หน้าละราว `perPage` แถว · **สายของคนเดียวกันไม่ขาดข้ามรูป** (ชื่อเดียวกันอยู่ติดกัน)
 * คนเดียวมีสายเกินหน้า = ยอมให้หน้านั้นยาวกว่า ดีกว่าตัดคนกลางทาง
 */
export const DAY_REPORT_ROWS_PER_IMAGE = 20;
export function paginateDayReportRows(rows: readonly ReportRow[], perPage = DAY_REPORT_ROWS_PER_IMAGE): ReportRow[][] {
  const groups: ReportRow[][] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last[0].name.trim() === r.name.trim()) last.push(r);
    else groups.push([r]);
  }
  const pages: ReportRow[][] = [];
  let cur: ReportRow[] = [];
  for (const g of groups) {
    if (cur.length > 0 && cur.length + g.length > perPage) {
      pages.push(cur);
      cur = [];
    }
    cur.push(...g);
  }
  if (cur.length > 0 || pages.length === 0) pages.push(cur);
  return pages;
}

const FONT_FAMILY = 'Kanit, sans-serif';
const font = (px: number, weight = 400) => `${weight} ${px}px ${FONT_FAMILY}`;

const PAD = 24; // ขอบรูป
const CELL_X = 14; // ช่องไฟซ้ายขวาในคอลัมน์
const ROW_H = 34;
const HEAD_H = 38;

/** บรรทัดสรุปบนหัวรูป — ข้อความเดียวกับใน Dialog (นิยามเดียว) */
export function followDayReportSummaryText(report: FollowDayReport): string {
  const n = (v: number) => v.toLocaleString('th-TH');
  const base = `${n(report.people)} คน · ${n(report.calls)} สาย · AI โทร ${n(report.ai)} · คนโทร ${n(report.manual)} · ยกเลิก ${n(report.cancelled)}`;
  // กรองอยู่ต้องบอกบนรูป — คนรับรูปต่อไม่เห็นหน้าจอ ไม่งั้นอ่านว่าเป็นของทั้งวัน
  return report.scope ? `${report.scope} — ${base}` : base;
}

/**
 * วาดรายงานลง canvas (แยกจากการดาวน์โหลด เผื่อเอาไป preview)
 * `page` = วาดเฉพาะแถวของหน้านั้น + หัวบอก "หน้า i/n" (ไม่ส่ง = ทั้งวันรูปเดียวเหมือนเดิม)
 */
export function drawFollowDayReport(
  report: FollowDayReport,
  page?: { rows: readonly ReportRow[]; index: number; total: number },
): HTMLCanvasElement {
  const headers = FOLLOW_DAY_REPORT_HEADERS;
  const pageRows = page ? page.rows : report.rows;
  const cells = pageRows.map((r) => [r.time, r.name, r.phone, r.unit, r.call, r.caller, r.result]);
  const rowCount = Math.max(1, cells.length); // ว่าง = แถว "ไม่มีแผนติดตาม" (ตารางไม่หาย)

  const measurer = document.createElement('canvas').getContext('2d');
  const widths = headers.map((h, i) => {
    if (!measurer) return 140;
    measurer.font = font(13, 600);
    let w = measurer.measureText(h).width;
    measurer.font = font(13.5);
    for (const row of cells) w = Math.max(w, measurer.measureText(row[i] ?? '').width);
    return Math.ceil(w) + CELL_X * 2;
  });
  const tableW = widths.reduce((a, b) => a + b, 0);
  const width = Math.max(560, tableW + PAD * 2);
  const tableTop = PAD + 30 + 26; // หัวเรื่อง + บรรทัดสรุป
  const height = tableTop + HEAD_H + rowCount * ROW_H + PAD;

  const canvas = document.createElement('canvas');
  const scale = 2; // วาด 2 เท่าให้คมตอนซูมในแชต
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'middle';

  // หัวเรื่อง + สรุป
  ctx.fillStyle = TONE.primary.hex;
  ctx.font = font(18, 600);
  const pageTag = page && page.total > 1 ? ` · หน้า ${page.index + 1}/${page.total}` : '';
  ctx.fillText(`แผนติดตามวันที่ ${formatYmdDmyBe(report.ymd)}${pageTag}`, PAD, PAD + 10);
  ctx.fillStyle = TONE.neutral.hex;
  ctx.font = font(13);
  ctx.fillText(followDayReportSummaryText(report), PAD, PAD + 38);

  // แถวหัวตาราง
  const x0 = PAD;
  ctx.fillStyle = TONE.primary.hex;
  ctx.fillRect(x0, tableTop, tableW, HEAD_H);
  ctx.fillStyle = 'white';
  ctx.font = font(13, 600);
  let cx = x0;
  headers.forEach((h, i) => {
    ctx.fillText(h, cx + CELL_X, tableTop + HEAD_H / 2);
    cx += widths[i];
  });

  // เนื้อตาราง
  ctx.font = font(13.5);
  if (cells.length === 0) {
    ctx.fillStyle = TONE.neutral.hex;
    const y = tableTop + HEAD_H + ROW_H / 2;
    ctx.fillText('ไม่มีแผนติดตาม', x0 + CELL_X, y);
  }
  cells.forEach((row, ri) => {
    const top = tableTop + HEAD_H + ri * ROW_H;
    const y = top + ROW_H / 2;
    const r = pageRows[ri];
    if (ri % 2 === 1) {
      // ลายทางอ่อน ๆ ให้ไล่แถวตามสายตาได้ (ค่าโปร่งบนขาว ไม่ใช่สีใหม่)
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = TONE.neutral.hex;
      ctx.fillRect(x0, top, tableW, ROW_H);
      ctx.restore();
    }
    let x = x0;
    row.forEach((cell, ci) => {
      ctx.fillStyle = r.cancelled
        ? TONE.neutral.hex
        : ci === 5 && cell === 'คนโทร'
          ? TONE.warn.hex
          : 'black';
      ctx.fillText(cell, x + CELL_X, y);
      if (r.cancelled && cell) {
        // ขีดฆ่าแถวที่ยกเลิก — ตรงกับตารางบนจอ
        const w = ctx.measureText(cell).width;
        ctx.strokeStyle = TONE.neutral.hex;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + CELL_X, y);
        ctx.lineTo(x + CELL_X + w, y);
        ctx.stroke();
      }
      x += widths[ci];
    });
  });

  // เส้นกรอบ + เส้นคั่นแนวนอน
  ctx.strokeStyle = TONE.neutral.hex;
  ctx.lineWidth = 0.5;
  for (let ri = 0; ri <= rowCount; ri++) {
    const y = tableTop + HEAD_H + ri * ROW_H;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + tableW, y);
    ctx.stroke();
  }
  ctx.strokeRect(x0, tableTop, tableW, HEAD_H + rowCount * ROW_H);

  return canvas;
}

/** canvas → ดาวน์โหลดไฟล์ PNG · `false` = เซฟไม่ได้ */
function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
        resolve(true);
      }, 'image/png');
    } catch {
      resolve(false);
    }
  });
}

/**
 * โหลดรูป PNG ของแผนวันนั้น — **หน้าละรูป** (`paginateDayReportRows`) · คืนจำนวนรูปที่เซฟได้ (0 = เซฟไม่ได้ ให้จอบอกคนใช้)
 */
export async function downloadFollowDayReportPng(report: FollowDayReport): Promise<number> {
  try {
    // ไม่รอฟอนต์ = canvas วาดด้วย fallback เงียบ ๆ (ตัวหนังสือเพี้ยนทั้งรูป)
    await Promise.all([document.fonts.load(font(18, 600)), document.fonts.load(font(13.5))]);
  } catch {
    /* ฟอนต์โหลดไม่ได้ก็ยังวาดได้ด้วย fallback */
  }
  const pages = paginateDayReportRows(report.rows);
  // กรองอยู่ให้ชื่อไฟล์บอกด้วย — โหลดหลายรูปแล้วแยกออกว่าไฟล์ไหนคืออะไร
  const scopeSlug = report.scope ? `-${report.scope.replace(/\s*·\s*/g, '-').replace(/\s+/g, '')}` : '';
  let saved = 0;
  for (const [index, rows] of pages.entries()) {
    const canvas = drawFollowDayReport(report, { rows, index, total: pages.length });
    const pageSlug = pages.length > 1 ? `-หน้า${index + 1}จาก${pages.length}` : '';
    if (await downloadCanvas(canvas, `แผนติดตาม-${report.ymd}${scopeSlug}${pageSlug}.png`)) saved += 1;
    // เว้นจังหวะระหว่างไฟล์ — เบราว์เซอร์บางตัวตัดการดาวน์โหลดที่ยิงติดกันเร็ว ๆ
    if (index < pages.length - 1) await new Promise((r) => window.setTimeout(r, 400));
  }
  return saved;
}

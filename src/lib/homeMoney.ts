/**
 * ═══ ก้อนเงิน + นาฬิกา ของหน้าหลักผู้บริหาร (เจ้าของ 24 ต.ค. 2569) — ประกอบคำตอบ `/api/home-money` ═══
 * ตัวคิดค่าปรับอยู่ `requestPenaltyLedger.ts` · ไฟล์นี้แค่สรุปตามช่วง/BU · pure (เทสต์ `homeMoney.test.ts`)
 * 🔴 "เหลือหา" และ "ค้างนาน" ไม่คิดที่นี่ — อ่านจากชุดใบขอของกล่องงานที่เดียว (`homeExec.ts`) เพราะรวมใบขอล่วงหน้าด้วย
 */
import { filledBy, requestFlow, requestFlowRole, type RequestFlowRole, type LedgerDaily, type LedgerMode, type LedgerRequest, type RequestFlow } from './requestPenaltyLedger';

export type MoneyTotals = { fine: number; deduct: number; personDays: number; requests: number };
export type MoneyRequest = {
  requestNo: string;
  bu: string | null;
  unit: string;
  position: string;
  /** สถานที่ทำงาน · null = ไม่ได้กรอก */
  place?: string | null;
  qty: number;
  filled: number;
  keyYmd: string;
  needYmd: string | null;
  endYmd: string | null;
  open: boolean;
  advance: boolean;
  finePerDay: number;
  deductPerDay: number;
  speedDays: number | null;
  lateDays: number | null;
  /** เจ้าหน้าที่สรรหาของใบ (ช่องผู้รับผิดชอบ) — null = ยังไม่มี */
  owner: string | null;
  /** คนที่เริ่มงานในช่วง */
  filledInWindow: number;
  /** คนครบในช่วง */
  closedInWindow: boolean;
  /** เหตุผลที่หยุดใบจาก ERP · null = ไม่ได้กรอก */
  stopReason: string | null;
  /** สัญญาให้ส่งคนแทนได้ไหม (true = ส่งคนแทนแล้วไม่โดนปรับวันนั้น · false = ไม่รับคนแทน · null = ไม่รู้) */
  replaceAccepted: boolean | null;
  /** เงื่อนไขส่งคนแทน เช่น "ภายใน 3 ชั่วโมงนับจากที่ได้รับแจ้ง" */
  replaceWindow: string | null;
  /** นับอยู่ในนาฬิกา "หาคนครบเฉลี่ย" (หาครบ และวันหาครบอยู่ในช่วง) — กดกล่องแล้วรายใบเท่าเลข n */
  clocked: boolean;
  /** บทบาทในสมการของช่วง (กดกล่องสมการแล้วได้รายใบชุดนี้) — null = ไม่เกี่ยวกับช่วง */
  flow: Omit<RequestFlowRole, 'relevant'> | null;
  amount: Record<LedgerMode, { days: number; personDays: number; fine: number; deduct: number; coveredPersonDays: number }>;
};

export type ClockStat = { n: number; avg: number | null; median: number | null };

export type HomeMoneyResponse = {
  window: { from: string; to: string };
  today: string;
  since: string;
  bu: string | null;
  forcedBu: boolean;
  /** ผู้ใช้หลาย BU: BU ที่สลับดูได้ (26 ต.ค. 2569) */
  buChoices?: string[] | null;
  totals: Record<LedgerMode, MoneyTotals>;
  daily: LedgerDaily;
  clocks: { speed: ClockStat; late: ClockStat };
  /** ยกมา + ขอใหม่ − หาได้ − ยกเลิก = เหลือ (คน) — ใบขอจริงใน ERP ไม่รวมใบขอล่วงหน้า */
  flow: RequestFlow;
  customerFines: { total: number; receipts: number; months: Array<{ ym: string; amount: number; receipts: number }> };
  requests: MoneyRequest[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function clock(values: number[]): ClockStat {
  if (values.length === 0) return { n: 0, avg: null, median: null };
  const s = [...values].sort((a, b) => a - b);
  const avg = Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10;
  return { n: s.length, avg, median: s[Math.floor(s.length / 2)] };
}

export function buildHomeMoney(
  ledger: { requests: LedgerRequest[]; daily: LedgerDaily },
  customerFines: ReadonlyArray<{ ymd: string; amount: number; receipts: number }>,
  ctx: {
    from: string;
    to: string;
    today: string;
    since: string;
    bu: string | null;
    forcedBu: boolean;
    ownerOf?: (requestNo: string) => string | null;
  },
): HomeMoneyResponse {
  const toEff = ctx.to > ctx.today ? ctx.today : ctx.to;
  const before = new Date(Date.parse(`${ctx.from}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const totals: Record<LedgerMode, MoneyTotals> = {
    need: { fine: 0, deduct: 0, personDays: 0, requests: 0 },
    key: { fine: 0, deduct: 0, personDays: 0, requests: 0 },
  };
  const speed: number[] = [];
  const late: number[] = [];
  const requests: MoneyRequest[] = [];

  for (const r of ledger.requests) {
    for (const m of ['need', 'key'] as const) {
      const a = r.amount[m];
      if (a.fine + a.deduct <= 0) continue;
      totals[m].fine += a.fine;
      totals[m].deduct += a.deduct;
      totals[m].personDays += a.personDays;
      totals[m].requests += 1;
    }
    // นาฬิกา: ใบที่หาครบ และวันหาครบอยู่ในช่วง
    const clocked = Boolean(r.filled >= r.qty && r.foundYmd && r.foundYmd >= ctx.from && r.foundYmd <= ctx.to);
    if (clocked) {
      if (r.speedDays != null) speed.push(r.speedDays);
      if (r.lateDays != null) late.push(r.lateDays);
    }
    const hasMoney = r.amount.need.fine + r.amount.need.deduct + r.amount.key.fine + r.amount.key.deduct > 0;
    const filledInWindow = Math.max(0, filledBy(r.starts, toEff) - filledBy(r.starts, before));
    const full = r.starts.find(([, cum]) => cum >= r.qty);
    const closedInWindow = Boolean(full && full[0] >= ctx.from && full[0] <= toEff);
    const role = requestFlowRole(r, ctx.from, toEff);
    if (!hasMoney && !r.open && filledInWindow === 0 && !closedInWindow && !role.relevant) continue;
    const { relevant, ...flowRole } = role;
    requests.push({
      requestNo: r.requestNo,
      bu: r.bu,
      unit: r.unit,
      position: r.position,
      place: r.place ?? null,
      qty: r.qty,
      filled: r.filled,
      keyYmd: r.keyYmd,
      needYmd: r.needYmd,
      endYmd: r.endYmd,
      open: r.open,
      advance: r.advance,
      finePerDay: r.finePerDay,
      deductPerDay: r.deductPerDay,
      speedDays: r.speedDays,
      lateDays: r.lateDays,
      owner: ctx.ownerOf?.(r.requestNo) ?? null,
      filledInWindow,
      closedInWindow,
      stopReason: r.stopReason ?? null,
      replaceAccepted: r.replaceAccepted ?? null,
      replaceWindow: r.replaceWindow ?? null,
      clocked,
      flow: relevant ? flowRole : null,
      amount: r.amount,
    });
  }
  for (const m of ['need', 'key'] as const) {
    totals[m].fine = round2(totals[m].fine);
    totals[m].deduct = round2(totals[m].deduct);
  }
  requests.sort((a, b) => b.amount.need.fine + b.amount.need.deduct - (a.amount.need.fine + a.amount.need.deduct));

  // ลูกค้าหักเงิน: วันที่ใบรับเงินอยู่ในช่วง (รวมปลาย) · สรุปรายเดือนไว้โชว์
  const byMonth = new Map<string, { ym: string; amount: number; receipts: number }>();
  for (const f of customerFines) {
    if (f.ymd < ctx.from || f.ymd > ctx.to) continue;
    const ym = f.ymd.slice(0, 7);
    const cur = byMonth.get(ym) ?? { ym, amount: 0, receipts: 0 };
    cur.amount = round2(cur.amount + f.amount);
    cur.receipts += f.receipts;
    byMonth.set(ym, cur);
  }
  const months = [...byMonth.values()].sort((a, b) => (a.ym < b.ym ? -1 : 1));

  return {
    window: { from: ctx.from, to: ctx.to },
    today: ctx.today,
    since: ctx.since,
    bu: ctx.bu,
    forcedBu: ctx.forcedBu,
    totals,
    daily: ledger.daily,
    clocks: { speed: clock(speed), late: clock(late) },
    flow: requestFlow(ledger.requests, ctx.from, ctx.to > ctx.today ? ctx.today : ctx.to),
    customerFines: {
      total: round2(months.reduce((a, m) => a + m.amount, 0)),
      receipts: months.reduce((a, m) => a + m.receipts, 0),
      months,
    },
    requests,
  };
}

/** ยอดของสมุดค่าปรับรายใบ (จุดเริ่มนับ = วันที่ต้องการ) — แท็บใบขอใช้แทนสูตรเดิม ให้ทั้งระบบเหลือสูตรเดียว (24 ต.ค. 2569) */
export type LedgerPick = { days: number; personDays: number; coveredPersonDays: number; fine: number; deduct: number };
export function ledgerByRequest(money: Pick<HomeMoneyResponse, 'requests'> | null): Map<string, LedgerPick> {
  const out = new Map<string, LedgerPick>();
  for (const r of money?.requests ?? []) out.set(r.requestNo.trim().toUpperCase(), r.amount.need);
  return out;
}

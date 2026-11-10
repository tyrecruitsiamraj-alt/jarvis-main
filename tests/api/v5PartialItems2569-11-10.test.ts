// @vitest-environment node
/**
 * ปิด 7 ข้อค้างของรายการตรวจรับโฉมต้นแบบ (ชุดส่งต่อ 04_NO_DATA_LOSS · 10 พ.ย. 2569)
 * H05 ใบ → รายชื่อ · H09 ดูแล/จับคู่ → รายชื่อจริง · R09 แนวโน้มใบขอรายวันในแท็บแนวโน้ม · R12 ตัวกรองย่อยไปรายงานเดิม
 * G01 ช่วง/BU ในลิงก์ของหน้าหลัก · G04 ค้นหา/เรียง/ดูทีละ 50 ในแผง · G05 มือถือ (คอลัมน์รองย้ายใต้ชื่อ)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EMPTY_REQUEST_FILTER, requestFilterFromParams, requestFilterToParams } from '@/lib/recruitRequestTab';
import { homeWindowFromParams, homeWindowToParams, legacyReportsPath } from '@/lib/jobNavigation';
import { drillRowsOf } from '@/lib/homeExec';
import { matchesNameQuery } from '@/components/shared/NamesSearchInput';

const TODAY = '2026-11-10';

describe('R12 ตัวกรองย่อยไปรายงานเดิม', () => {
  it('ไป-กลับได้ตัวกรองเดิม · ค่าว่างไม่ใส่ · ประเภทแปลก = ไม่กรอง', () => {
    const f = { ...EMPTY_REQUEST_FILTER, sector: 'bank' as const, siteCode: '67LBDL0324', province: 'กรุงเทพมหานคร', recruiter: 'ตั้ม' };
    const q = requestFilterToParams(f);
    expect(q).not.toContain('rf_district');
    const back = requestFilterFromParams(new URLSearchParams(q));
    expect(back).toEqual(f);
    expect(requestFilterFromParams(new URLSearchParams('rf_sector=hack'))).toBeNull();
    expect(requestFilterFromParams(new URLSearchParams(''))).toBeNull();
    const path = legacyReportsPath({ from: '2026-10-01', to: '2026-10-31' }, 'LBD', q);
    expect(path).toContain('&bu=LBD&rf_sector=bank');
    expect(requestFilterFromParams(new URL(`http://x${path}`).searchParams)?.province).toBe('กรุงเทพมหานคร');
  });
  it('หน้ารายงานเดิมเปิดที่ตัวกรองจากลิงก์', () => {
    const src = readFileSync('src/components/dashboard-trends/RequestTab.tsx', 'utf8');
    expect(src).toContain('useState<RequestTabFilter>(() => requestFilterFromParams(searchParams) ?? EMPTY_REQUEST_FILTER)');
  });
});

describe('G01 ช่วง/BU ในลิงก์ของหน้าหลักโฉมต้นแบบ', () => {
  it('อ่าน: ช่วง · หน่วยปฏิทิน · ทั้งหมด · ผิดรูป/เลยวันนี้ = null', () => {
    expect(homeWindowFromParams(new URLSearchParams('from=2026-10-01&to=2026-10-31&unit=month'), TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31', unit: 'month' });
    expect(homeWindowFromParams(new URLSearchParams('from=all'), TODAY)).toEqual({ from: null, to: null });
    expect(homeWindowFromParams(new URLSearchParams('from=2026-11-01&to=2026-12-31'), TODAY)).toBeNull();
    expect(homeWindowFromParams(new URLSearchParams('unit=month'), TODAY)).toBeNull();
  });
  it('เขียน: คงพารามิเตอร์อื่น (home=v5) · ทั้งหมด = from=all · BU ว่างไม่ใส่', () => {
    const p = homeWindowToParams(new URLSearchParams('home=v5&bu=LBA'), { from: '2026-11-01', to: '2026-11-10' }, null);
    expect(p.toString()).toBe('home=v5&from=2026-11-01&to=2026-11-10');
    expect(homeWindowToParams(new URLSearchParams('home=v5'), { from: null, to: null }, 'LBD').toString()).toBe('home=v5&from=all&bu=LBD');
  });
  it('เฉพาะโฉมต้นแบบ — หน้าหลักเดิมไม่อ่าน/ไม่เขียนลิงก์', () => {
    const src = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
    expect(src).toContain('(v5 ? homeWindowFromParams(searchParams, today) : null) ?? thisMonthWindow(today)');
    expect(src).toContain('if (!v5) return;\n    setSearchParams((prev) => homeWindowToParams(prev, win, bu), { replace: true });');
  });
});

describe('G04 ค้นหา/เรียงในแผง', () => {
  const row = (requestNo: string, p: Partial<{ unit: string; owner: string; qty: number; filled: number; keyYmd: string; fine: number }>) => ({
    requestNo,
    unit: p.unit ?? 'หน่วยงาน',
    position: 'ขับรถ',
    place: null,
    owner: p.owner ?? null,
    qty: p.qty ?? 1,
    filled: p.filled ?? 0,
    open: true,
    keyYmd: p.keyYmd ?? '2026-11-01',
    needYmd: null,
    finePerDay: 0,
    deductPerDay: 0,
    workDays: null,
    endYmd: null,
    amount: { need: { fine: p.fine ?? 0, deduct: 0 } },
  });
  const rows = [row('OPL1', { unit: 'ธนาคารกรุงศรี', fine: 100, keyYmd: '2026-11-03' }), row('OPL2', { owner: 'ตั้ม', qty: 5, fine: 900 }), row('OPL3', { keyYmd: '2026-10-01' })];
  it('ค่าเริ่ม = ลำดับเดิม · ค้นหาหน่วยงาน/เจ้าหน้าที่/เลขใบ ไม่สนตัวพิมพ์', () => {
    expect(drillRowsOf(rows as never, '', 'default', TODAY).map((r: { requestNo: string }) => r.requestNo)).toEqual(['OPL1', 'OPL2', 'OPL3']);
    expect(drillRowsOf(rows as never, 'กรุงศรี', 'default', TODAY)).toHaveLength(1);
    expect(drillRowsOf(rows as never, 'ตั้ม', 'default', TODAY)).toHaveLength(1);
    expect(drillRowsOf(rows as never, 'opl3', 'default', TODAY)).toHaveLength(1);
  });
  it('เรียง: ยอดมากก่อน · ขาดคนมากก่อน · ใบเก่าก่อน', () => {
    const ids = (s: 'money' | 'missing' | 'oldest') => drillRowsOf(rows as never, '', s, TODAY).map((r: { requestNo: string }) => r.requestNo);
    expect(ids('money')).toEqual(['OPL2', 'OPL1', 'OPL3']);
    expect(ids('missing')[0]).toBe('OPL2');
    expect(ids('oldest')[0]).toBe('OPL3');
  });
  it('ค้นชื่อ/เบอร์ในป๊อปรายชื่อ — เบอร์เทียบเฉพาะตัวเลข', () => {
    expect(matchesNameQuery(['สมชาย ใจดี', '+66812345678', null], 'สมชาย')).toBe(true);
    expect(matchesNameQuery(['สมชาย', '081-234-5678'], '0812345')).toBe(true);
    expect(matchesNameQuery(['สมชาย', '0812345678'], 'สมหญิง')).toBe(false);
    expect(matchesNameQuery(['ใครก็ได้'], '  ')).toBe(true);
  });
  it('ป๊อปรายชื่อ 2 ตัว + รายการใบขอ มีค้นหาและดูทีละ 50 · เปลี่ยนชั้นแผงล้างคำค้น', () => {
    for (const f of ['src/components/dashboard-trends/JourneyNamesDialog.tsx', 'src/components/home-overview/FollowNamesDialog.tsx', 'src/components/home-overview/RequestListPanel.tsx']) {
      const src = readFileSync(f, 'utf8');
      expect(src).toContain('<NamesSearchInput');
      expect(src).toContain('NAMES_PAGE');
    }
    const drill = readFileSync('src/components/home-exec/ExecDrill.tsx', 'utf8');
    expect(drill).toContain("setQ('');\n    setSort('default');");
  });
});

describe('H09 · R09 · G05', () => {
  it('H09 ดูแลหลังเริ่มงาน/จับคู่งาน กดเลข = ป๊อปรายชื่อ (ช่วง/BU เดียวกัน) · มีลิงก์ไปหน้าเต็มแยก', () => {
    const src = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
    expect(src).toContain('onClick={() => setBlockNames({ block: b.block, title: b.label, count: b.value ?? null })}');
    expect(src).toContain('<AiShareListDialog');
    expect(src).toContain('win={winQ}');
  });
  it('R09 แท็บแนวโน้มของโฉมต้นแบบมีการ์ดแนวโน้มใบขอรายวัน (ตัวเดียวกับรายงานเดิม · ตามตัวกรองบนสุด)', () => {
    const ov = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
    expect(ov).toContain("requestTrend={(rows, prevRows) => compareCard('requests', view, { rows, prevRows })}");
    const body = readFileSync('src/components/dashboard-trends/stuck/RecruitStuckBody.tsx', 'utf8');
    expect(body).toContain('requestTrend?.(data.requestRows ? (filterRequestRows(data.requestRows, filter)');
  });
  it('G05 มือถือ: ป๊อปรายชื่อซ่อนคอลัมน์รอง แล้วย้ายเบอร์/ทีม/หน่วยงานใต้ชื่อ', () => {
    for (const f of ['src/components/dashboard-trends/JourneyNamesDialog.tsx', 'src/components/home-overview/FollowNamesDialog.tsx']) {
      const src = readFileSync(f, 'utf8');
      expect(src).toContain('sm:hidden');
      expect(src).toContain('hidden whitespace-nowrap tabular-nums sm:table-cell');
    }
  });
});

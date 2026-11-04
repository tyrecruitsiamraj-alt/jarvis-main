/**
 * Journey ป๊อป Autopost (เจ้าของ 4 พ.ย. 2569 · "หลักการคือ เลือกเฉพาะที่ใช้ได้")
 * 1 บัญชี: เฉพาะที่ใช้งานได้ (โดนพัก ฯลฯ ซ่อน) · 2 กลุ่ม: ธุรกิจ → เอกชน/ราชการ → จังหวัด (ไม่เลือก = ทั้งหมด)
 * แต่ขึ้นเฉพาะกลุ่มที่โพสต์ได้ (แอดมินพัก · ห้ามโพสต์ ฯลฯ ไม่ขึ้น) · 3 เครื่อง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  soAccountUsable,
  soFilterBus,
  soFilterGroups,
  soFilterProvinces,
  soFilterSectors,
  soGroupUsable,
  soProvincesOf,
  type SoOptGroup,
} from '../../src/lib/soScraping';

const g = (id: string, over: Partial<SoOptGroup> = {}): SoOptGroup => ({
  id,
  fbGroupId: id,
  name: `กลุ่ม ${id}`,
  url: null,
  accountIds: [],
  lastPostedAt: null,
  stats30d: null,
  department: 'LBD',
  sector: 'private',
  provinces: [],
  nationwide: false,
  blocked: null,
  repostWait: null,
  ...over,
});

describe('1 บัญชี: ขึ้นเฉพาะที่ใช้ได้', () => {
  it('พร้อม / มีงานค้าง / เครื่องหลักออฟไลน์ = ขึ้น · พัก ครบโควต้า รอยืนยันตัวตน ไม่มีเครื่อง ไม่รู้สถานะ = ซ่อน', () => {
    expect(['ready', 'busy', 'worker_offline'].every((s) => soAccountUsable(s as never))).toBe(true);
    expect(['paused', 'full', 'needs_verification', 'no_worker', 'unknown'].some((s) => soAccountUsable(s as never))).toBe(false);
    expect(readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8')).toContain('opts.accounts.filter((a) => soAccountUsable(a.status))');
  });
});

describe('2 กลุ่ม: ธุรกิจ → เอกชน/ราชการ → จังหวัด · เฉพาะที่โพสต์ได้', () => {
  const acc = {
    groupStatus: [
      { groupId: 'banned', state: 'rejected', label: 'Facebook ไม่รับโพสต์', recommended: false, detail: null, url: null, seenAt: null },
      { groupId: 'ok', state: 'ok', label: 'โพสต์ได้', recommended: true, detail: null, url: null, seenAt: null },
    ],
  };
  it('ไม่ขึ้น: แอดมินพักกลุ่ม · บัญชีถูกห้าม/ต้องตอบคำถาม (recommended=false) · ใบนี้เพิ่งลง', () => {
    expect(soGroupUsable(g('ok'), acc)).toBe(true);
    expect(soGroupUsable(g('new'), acc)).toBe(true);
    expect(soGroupUsable(g('banned'), acc)).toBe(false);
    expect(soGroupUsable(g('paused', { blocked: { state: 'admin_paused', label: 'แอดมินพักกลุ่ม', detail: null, seenAt: null } }), acc)).toBe(false);
    expect(soGroupUsable(g('wait', { repostWait: { requestNo: 'OPL1', lastPostedAt: null, availableAt: null } }), acc)).toBe(false);
  });

  const groups = [
    g('p1', { provinces: ['ชลบุรี'] }),
    g('p2', { provinces: ['กรุงเทพมหานคร', 'สมุทรปราการ'] }),
    g('p3', { nationwide: true }),
    g('g1', { sector: 'government', provinces: ['ชลบุรี'] }),
    g('g2', { sector: 'government', nationwide: true }),
    g('l1', { department: 'LBA' }),
  ];
  it('ตัวเลือกมาจากกลุ่มที่มีจริง · ของใบขอขึ้นก่อน', () => {
    expect(soFilterBus(groups, 'LBA').map((b) => b.value)).toEqual(['LBA', 'LBD']);
    expect(soFilterSectors(groups, 'LBD', 'government').map((x) => x.label)).toEqual(['ราชการ', 'เอกชน']);
    expect(soFilterSectors(groups, 'LBA', null).map((x) => x.label)).toEqual(['เอกชน']);
    expect(soFilterProvinces(groups, 'LBD', 'private')).toEqual(['กรุงเทพมหานคร', 'ชลบุรี', 'สมุทรปราการ']);
  });
  it('ไม่เลือกจังหวัด = ทั้งหมดของธุรกิจ+ประเภท · เลือกจังหวัด = กลุ่มจังหวัดนั้นก่อน แล้วกลุ่มทั่วประเทศต่อท้าย', () => {
    expect(soFilterGroups(groups, { bu: 'LBD', sector: 'private', province: '' }).map((x) => x.id)).toEqual(['p1', 'p2', 'p3']);
    expect(soFilterGroups(groups, { bu: 'LBD', sector: 'private', province: 'ชลบุรี' }).map((x) => x.id)).toEqual(['p1', 'p3']);
    expect(soFilterGroups(groups, { bu: 'LBD', sector: 'government', province: 'ชลบุรี' }).map((x) => x.id)).toEqual(['g1', 'g2']);
  });
  it('จังหวัดจากฐาน (ทางถอย): แยกคอมมา · "ทั่วประเทศ" = กลุ่มทั่วประเทศ', () => {
    expect(soProvincesOf('กรุงเทพมหานคร, สมุทรปราการ')).toEqual({ provinces: ['กรุงเทพมหานคร', 'สมุทรปราการ'], nationwide: false });
    expect(soProvincesOf('ทั่วประเทศ')).toEqual({ provinces: [], nationwide: true });
    expect(soProvincesOf(null)).toEqual({ provinces: [], nationwide: false });
  });
  it('ป๊อป: 3 ช่องเลือก + ติ๊กทั้งรายการไม่เกินเพดาน · รายการว่างไม่หาย (บอกว่าไม่มี)', () => {
    const src = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    for (const id of ['autopost-filter-bu', 'autopost-filter-sector', 'autopost-filter-province']) expect(src).toContain(`testId="${id}"`);
    expect(src).toContain("{ value: ALL_PROVINCES, label: 'ทุกจังหวัด' }");
    expect(src).toContain('ไม่มีกลุ่มที่โพสต์ได้ในตัวเลือกนี้');
    expect(src).toContain('ไม่มีกลุ่มที่บัญชีนี้โพสต์ได้ตอนนี้ — เลือกบัญชีอื่น');
  });
});

// @vitest-environment node
/**
 * บัญชีที่ส่งผ่าน phone-box เลือกได้เฉพาะกลุ่มที่บัญชีอยู่จริง (เจ้าของ 25 พ.ย. 2569 · Choice "เลือกได้เฉพาะกลุ่มของบัญชี")
 * เดิมทุกบัญชีเลือกได้ทุกกลุ่มของ So Scraping ⇒ phone-box ตีกลับ "ถาวร: ไม่พบกลุ่มในรายชื่อของบัญชี" (OPL6910028 ตีกลับ 25/27)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { limitToPhoneBoxGroups, phoneBoxGroupKey, phoneBoxGroupNamesOf } from '../../src/lib/phoneBoxPosts';
import { soGroupsOfAccount } from '../../src/lib/soScraping';

const acc = { id: 'acc-tarris', groupIds: ['g1', 'g2', 'g3'], warning: null as string | null };
const groups = [
  { id: 'g1', name: 'หางานขับรถผู้บริหาร ส่วนกลาง ฯลฯ', accountIds: ['acc-tarris', 'acc-other'] },
  { id: 'g2', name: 'รับสมัครงาน​ ขับรถผู้บริหารไทย-ต่างชาติ', accountIds: ['acc-tarris'] },
  { id: 'g3', name: 'หางานระยอง', accountIds: ['acc-tarris'] },
];

describe('ชื่อกลุ่มจาก phone-box', () => {
  it('อ่านได้หลายชื่อช่อง · มีรายการแต่ไม่มีชื่อเลย / ไม่มีรายการ = อ่านไม่ได้ (null) · ว่างจริง = []', () => {
    expect(phoneBoxGroupNamesOf({ groups: [{ name: 'A' }, { group_name: 'B' }, { title: 'C' }] })).toEqual(['A', 'B', 'C']);
    expect(phoneBoxGroupNamesOf({ groups: [{ destination_mapped: true }] })).toBeNull();
    expect(phoneBoxGroupNamesOf({})).toBeNull();
    expect(phoneBoxGroupNamesOf({ groups: [] })).toEqual([]);
  });
  it('เทียบชื่อไม่สนช่องว่างล่องหน/ช่องว่างซ้ำ/ตัวพิมพ์', () => {
    expect(phoneBoxGroupKey('รับสมัครงาน​  ขับรถผู้บริหารไทย-ต่างชาติ')).toBe(phoneBoxGroupKey('รับสมัครงาน ขับรถผู้บริหารไทย-ต่างชาติ'));
    expect(phoneBoxGroupKey(' Call Center ')).toBe('call center');
  });
});

describe('จำกัดกลุ่มของบัญชีมือถือ', () => {
  it('เหลือเฉพาะกลุ่มที่ชื่อตรง · กลุ่มอื่นถอดบัญชีนี้ออก (บัญชีอื่นไม่โดน)', () => {
    const r = limitToPhoneBoxGroups(acc, groups, ['หางานขับรถผู้บริหาร ส่วนกลาง ฯลฯ', 'รับสมัครงาน ขับรถผู้บริหารไทย-ต่างชาติ']);
    expect(r.matched).toBe(2);
    expect(r.account.groupIds.sort()).toEqual(['g1', 'g2']);
    const mine = soGroupsOfAccount({ groups: r.groups as never }, r.account as never).map((g) => g.id).sort();
    expect(mine).toEqual(['g1', 'g2']);
    expect(r.groups.find((g) => g.id === 'g1')!.accountIds).toContain('acc-other');
    expect(r.groups.find((g) => g.id === 'g3')!.accountIds).not.toContain('acc-tarris');
  });
  it('อ่านไม่ได้ = ไม่มีกลุ่มให้เลือก + คำเตือน (ไม่ส่งมั่ว)', () => {
    const r = limitToPhoneBoxGroups(acc, groups, null);
    expect(r.account.groupIds).toEqual([]);
    expect(soGroupsOfAccount({ groups: r.groups as never }, r.account as never)).toEqual([]);
    expect(r.account.warning).toContain('อ่านรายชื่อกลุ่มของบัญชีมือถือไม่ได้');
  });
  it('server: ตัวประกอบตัวเลือกจำกัดกลุ่มบัญชีมือถือก่อนป๊อปและก่อนตรวจคำสั่ง', () => {
    const src = readFileSync(resolve(__dirname, '../../api/_lib/soScrapingOptions.ts'), 'utf8');
    expect(src).toContain('readPhoneBoxAccountGroupNames(baseUrl, key, route.accountId)');
    expect(src).toContain('limitToPhoneBoxGroups(a, groups, names)');
  });
});

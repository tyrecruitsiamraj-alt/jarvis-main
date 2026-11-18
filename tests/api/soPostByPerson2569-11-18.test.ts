/**
 * รายการโพสต์: ตัวกรองคนสั่ง + สรุปเป็นงาน + ใบที่ส่งผ่าน phone-box (เจ้าของ 18 พ.ย. 2569
 * "ดูแล้วงงไม่รู้ว่าโพสต์อย่างเดียวเท่าไหร่ แล้วถ้าอยากดูแค่การทำงานของใหม่ ของแบงค์หล่ะ ควรมี Filter")
 */
import { describe, expect, it } from 'vitest';
import { filterSoPostGroups, markPhoneBoxRows, soPostJobCounts, soPostPeople, soPostRowsBy, SO_POST_VIA_PHONE_BOX, type SoPostGroupRow } from '@/lib/soPostGroups';
import { phoneBoxStatusText } from '@/lib/phoneBoxPosts';

const row = (p: Partial<SoPostGroupRow>): SoPostGroupRow => ({
  requestNo: 'OPL1',
  position: 'ขับรถ',
  orderedAt: '2026-11-18T02:00:00Z',
  orderedByName: 'คิว',
  account: 'Burkhart Debe',
  fbGroupId: null,
  groupName: 'g',
  status: 'posted',
  statusLabel: 'เผยแพร่แล้ว',
  postedAt: null,
  postLink: null,
  error: null,
  reasonGroup: null,
  ...p,
});
const rows = [
  row({ requestNo: 'OPL1', orderedByName: 'คิว' }),
  row({ requestNo: 'OPL1', orderedByName: 'คิว', status: 'failed' }),
  row({ requestNo: 'OPL2', orderedByName: 'ใหม่' }),
  row({ requestNo: 'OPL3', orderedByName: 'ใหม่', status: 'not_tried_account' }),
  row({ requestNo: 'OPL4', orderedByName: null }),
];

describe('ยอดต่อคนสั่ง', () => {
  it('งาน = เลขใบขอไม่ซ้ำ · กลุ่ม = แถว · เผยแพร่แล้ว = posted · ไม่มีชื่อ = ไม่ระบุคนสั่ง', () => {
    expect(soPostPeople(rows)).toEqual([
      { name: 'คิว', jobs: 1, groups: 2, posted: 1 },
      { name: 'ใหม่', jobs: 2, groups: 2, posted: 1 },
      { name: 'ไม่ระบุคนสั่ง', jobs: 1, groups: 1, posted: 1 },
    ]);
  });
  it('กรองคนสั่ง แล้วนับงานทั้งหมด/งานที่เผยแพร่แล้ว', () => {
    const mine = soPostRowsBy(rows, 'ใหม่');
    expect(mine).toHaveLength(2);
    expect(soPostJobCounts(mine)).toEqual({ jobs: 2, postedJobs: 1 });
    expect(soPostRowsBy(rows, null)).toHaveLength(5);
  });
  it('ไม่กดสถานะ = ทุกแถว (แบ่งหน้าฝั่งเรา) · ช่องเลขนับตามคนที่กรองแล้ว', () => {
    const v = filterSoPostGroups({ statuses: [{ key: 'posted', label: 'เผยแพร่แล้ว' }], rows: soPostRowsBy(rows, 'ใหม่') }, { from: 'a', to: 'b', bu: null }, '', 1);
    expect(v.total).toBe(2);
    expect(v.rows).toHaveLength(2);
    expect(v.counts.posted).toBe(1);
    expect(v.status).toBeNull();
  });
});

describe('ใบที่ส่งผ่าน phone-box', () => {
  it('แถวบัญชี/ใบเดียวกันที่ So Scraping ไม่ได้ลอง = เผยแพร่แล้ว + เหตุ "ส่งผ่าน phone-box" · แถวอื่นไม่แตะ', () => {
    const r = markPhoneBoxRows(
      [row({ requestNo: 'OPL6911061', account: 'Gring Magail', status: 'not_tried_unknown', statusLabel: 'ไม่ทราบสาเหตุ' }), row({ requestNo: 'OPL6911061', account: 'Charls Decambra', status: 'failed' })],
      [{ requestNo: 'OPL6911061', account: 'Gring Magail' }],
      'เผยแพร่แล้ว',
    );
    expect(r[0]).toMatchObject({ status: 'posted', statusLabel: 'เผยแพร่แล้ว', error: SO_POST_VIA_PHONE_BOX });
    expect(r[1].status).toBe('failed');
  });
  it('คำสถานะจาก phone-box (uncertain = รอแอดมินอนุมัติ ตามกติกาเจ้าของ)', () => {
    expect(phoneBoxStatusText({ status: 'awaiting_executor', published: null }).text).toBe('รอมือถือโพสต์');
    expect(phoneBoxStatusText({ status: 'uncertain', published: null }).text).toBe('รอแอดมินกลุ่มอนุมัติ');
    expect(phoneBoxStatusText({ status: 'succeeded', published: true }).text).toBe('ขึ้นกลุ่มแล้ว');
    expect(phoneBoxStatusText({ status: 'weird', published: null }).text).toBe('weird');
  });
});

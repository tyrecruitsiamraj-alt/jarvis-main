// @vitest-environment node
/**
 * ช่องเลือกบัญชี Facebook ในป๊อป Autopost 3 สี (สเปค So Scraping 9 พ.ย. 2569 แทน "ไม่ใช่ ready = เลือกไม่ได้" เรื่องบัญชี)
 * เขียว ready/busy เลือกได้ · เหลือง needs_verification เลือกได้ ≤ 1 กลุ่มต่อใบ · แดง ที่เหลือ เลือกไม่ได้ แสดง warning ตรง ๆ
 * ลำดับ เขียว → เหลือง → แดง (ในสีเดียวกันตาม sort_rank) · ค่าเริ่มต้น = บัญชีแรกที่ recommended (ไม่ใช่เหลือง)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SO_VERIFY_GROUP_CAP,
  parseSoOptions,
  soAccountChoice,
  soAccountSelectable,
  soAccountStatusText,
  soAccountTone,
  soAccountsOrdered,
  soAddWithinCap,
  soDefaultAccount,
  soGroupCap,
  soPickError,
  soVerifyWarningText,
} from '@/lib/soScraping';

const RAW = {
  accounts: [
    { id: 'red-paused', name: 'Rudge Marita', status: 'paused', warning: 'บัญชีถูกพักถึง 5 พ.ย. 10:37', remaining_today: 15, sort_rank: 1, recommended: false, worker: 'SONB-RM009', session_workers: ['SONB-RM009'], group_ids: ['g1', 'g2'] },
    { id: 'yel', name: 'Thom Blake', status: 'needs_verification', remaining_today: 15, sort_rank: 2, recommended: true, worker: 'SONB-RM009', session_workers: ['SONB-RM009'], group_ids: ['g1', 'g2'] },
    { id: 'green-busy', name: 'Camy Rizk', status: 'busy', remaining_today: 5, sort_rank: 2, recommended: true, worker: 'SONB-RM009', session_workers: ['SONB-RM009'], group_ids: ['g1', 'g2'] },
    { id: 'green-ready', name: 'Gring Magail', status: 'ready', remaining_today: 9, sort_rank: 1, recommended: true, worker: 'SONB-RM009', session_workers: ['SONB-RM009'], group_ids: ['g1', 'g2'] },
    { id: 'red-full', name: 'Letisa Shatondra', status: 'full', warning: 'บัญชีนี้โพสต์ครบโควต้าวันนี้แล้ว (15/15)', remaining_today: 0, recommended: false, worker: 'SONB-RM009', group_ids: ['g1'] },
    { id: 'red-offline', name: 'Rand Mize', status: 'worker_offline', warning: 'เครื่อง SONB-RM009 ออฟไลน์อยู่', remaining_today: 1, recommended: false, worker: 'SONB-RM009', group_ids: ['g1'] },
    { id: 'red-new', name: 'New Status', status: 'shadow_banned', warning: 'Facebook จำกัดการโพสต์', recommended: false, group_ids: [] },
  ],
  groups: [
    { id: 'g1', name: 'ชมรมพนักงานขับรถ', account_ids: ['yel', 'green-ready'] },
    { id: 'g2', name: 'หางานขับรถ กทม.', account_ids: ['yel', 'green-ready'] },
  ],
  workers: [{ name: 'SONB-RM009', online: true, kinds: ['autopost'], fb_account_ids: [] }],
  scrape_accounts: [],
};
const o = parseSoOptions(RAW)!;
const acc = (id: string) => o.accounts.find((a) => a.id === id)!;

describe('3 สี · ทุกแถวมีคำคู่สี', () => {
  it('เขียว = ใช้ได้ · เหลือง = รอยืนยันตัวตน · แดง = warning ที่ส่งมาตรง ๆ (สถานะไม่รู้จักด้วย)', () => {
    expect(soAccountStatusText(acc('green-ready'))).toEqual({ text: 'ใช้ได้ · เหลือ 9 โพสต์วันนี้', tone: 'success' });
    expect(soAccountStatusText(acc('green-busy'))).toEqual({ text: 'ใช้ได้ · มีงานค้าง งานนี้ต่อคิว', tone: 'success' });
    expect(soAccountStatusText(acc('yel'))).toEqual({ text: 'รอยืนยันตัวตน · ต้องมีคนอยู่หน้าเครื่อง SONB-RM009 ตอนงานเริ่ม', tone: 'warn' });
    for (const id of ['red-paused', 'red-full', 'red-offline', 'red-new']) {
      const a = acc(id);
      expect(soAccountStatusText(a)).toEqual({ text: a.warning, tone: 'danger' });
    }
    expect(soAccountTone('no_worker')).toBe('danger');
  });
  it('เขียว/เหลือง เลือกได้ · แดงกดไม่ได้', () => {
    expect(['green-ready', 'green-busy', 'yel'].map((id) => soAccountChoice(acc(id), o.workers).disabled)).toEqual([false, false, false]);
    expect(['red-paused', 'red-full', 'red-offline', 'red-new'].every((id) => soAccountChoice(acc(id), o.workers).disabled)).toBe(true);
    expect(soAccountSelectable('needs_verification')).toBe(true);
  });
  it('ลำดับ เขียว → เหลือง → แดง · ในสีเดียวกันตาม sort_rank (ไม่มี = ลำดับเดิม)', () => {
    expect(soAccountsOrdered(o.accounts).map((a) => a.id)).toEqual(['green-ready', 'green-busy', 'yel', 'red-paused', 'red-full', 'red-offline', 'red-new']);
  });
  it('ค่าเริ่มต้น = บัญชีแรกที่ recommended แต่ไม่ใช่เหลือง', () => {
    expect(soDefaultAccount(o.accounts, null)?.id).toBe('green-busy');
    expect(soDefaultAccount(o.accounts.filter((a) => a.status !== 'busy' && a.status !== 'ready'), null)).toBeNull();
  });
});

describe('เหลือง: ไม่เกิน 1 กลุ่มต่อใบ', () => {
  it('เพดานกลุ่ม 1 · ติ๊กกลุ่มที่ 2 ไม่เข้า · เขียวยังตามโพสต์ที่เหลือ', () => {
    expect(SO_VERIFY_GROUP_CAP).toBe(1);
    expect(soGroupCap(acc('yel'))).toBe(1);
    expect(soAddWithinCap(['g1'], ['g2'], soGroupCap(acc('yel')))).toEqual(['g1']);
    expect(soGroupCap(acc('green-ready'))).toBe(9);
  });
  it('server ปฏิเสธเหลืองที่ส่งมา 2 กลุ่ม · 1 กลุ่มผ่าน', () => {
    expect(soPickError(o, 'content', { group_ids: ['g1'], account_id: 'yel' })).toBeNull();
    expect(soPickError(o, 'content', { group_ids: ['g1', 'g2'], account_id: 'yel' })).toContain('เลือกได้ 1 กลุ่มต่อใบ');
    expect(soPickError(o, 'content', { group_ids: ['g1'], account_id: 'red-full' })).toBe('บัญชีนี้โพสต์ครบโควต้าวันนี้แล้ว (15/15)');
  });
  it('คำเตือนใต้ช่องบัญชีตามสเปค · ป๊อปขึ้นเมื่อเลือกบัญชีเหลือง', () => {
    expect(soVerifyWarningText('SONB-RM009')).toBe(
      'งานนี้จะเปิด Facebook บนเครื่อง SONB-RM009 ต้องมีคนยืนยันตัวตนในหน้าต่าง Chrome ภายใน 5 นาทีหลังงานเริ่ม ถ้าไม่ทัน งานจะล้มและส่งกลุ่มให้บัญชีอื่นโพสต์แทน',
    );
    const src = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(src).toContain("account.status === 'needs_verification'");
    expect(src).toContain('soVerifyWarningText(account.worker)');
  });
});

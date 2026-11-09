/**
 * 3 พ.ย. 2569
 * 1) ตัวกรอง "ส่งคนแทน" มี Spare (เจ้าของ "จากรูปส่งคนแทน ไม่เห็นมีสแปร์") — แยกตามป้ายบนการ์ด
 * 2) ป๊อปสั่งโพสต์บอกบัญชีถูกพัก (ใช้ได้เมื่อไหร่) / ยังไม่ได้ล็อกอิน Facebook ก่อนสั่ง (So Scraping แจ้ง 3 พ.ย. 11:00)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REPLACEMENT_FILTER_OPTIONS, matchesReplacementFilter } from '@/lib/jobUrgency';
import { SO_NO_SESSION_WARNING, soAccountChoice, soAccountHasSession, soPostConfirmWarnings, type SoOptAccount } from '@/lib/soScraping';
import type { JobRequest } from '@/types';

const job = (send: boolean | null, spare?: boolean) => ({ id: 'siamraj-sql:LBM6903002', send_replacement: send, replacement_spare: spare }) as unknown as JobRequest;

describe('ตัวกรองส่งคนแทน', () => {
  it('มีตัวเลือก Spare ต่อจากต้องส่งคนแทน', () => {
    expect(REPLACEMENT_FILTER_OPTIONS.map((o) => o.label)).toEqual(['ทั้งหมด', 'ต้องส่งคนแทน', 'Spare', 'ไม่ต้องส่งคนแทน', 'ยังไม่ระบุ']);
  });
  it('Spare = ต้องส่ง + Spare · ต้องส่งคนแทน = ไม่รวม Spare (ตรงกับป้าย)', () => {
    expect(matchesReplacementFilter(job(true, true), 'spare')).toBe(true);
    expect(matchesReplacementFilter(job(true, true), 'send')).toBe(false);
    expect(matchesReplacementFilter(job(true, false), 'send')).toBe(true);
    expect(matchesReplacementFilter(job(true), 'spare')).toBe(false);
    expect(matchesReplacementFilter(job(false), 'no_send')).toBe(true);
    expect(matchesReplacementFilter(job(null), 'unset')).toBe(true);
  });
  it('ลิงก์ ?sr=spare อ่านได้', () => {
    expect(readFileSync('src/lib/jobListPageState.ts', 'utf8')).toContain("['send', 'spare', 'no_send', 'unset']");
  });
});

describe('บัญชี Facebook ในป๊อปสั่งโพสต์', () => {
  const acc = (p: Partial<SoOptAccount>) =>
    ({ id: 'a1', name: 'Donnomeachi Chardonnay', status: 'ready', pausedUntil: null, sessionWorkers: ['SONB-RM009'], postedToday: 2, dailyCap: 10, remainingToday: 8, worker: 'SONB-RM009', needsVerificationSince: null, warning: null, ...p }) as SoOptAccount;
  const workers = [{ fbAccountIds: ['a9'] }];
  it('ถูกพัก = แดง เลือกไม่ได้ · ใช้คำเตือนของ So Scraping ตรง ๆ (สเปค 3 สี 9 พ.ย. 2569)', () => {
    expect(soAccountChoice(acc({ status: 'paused', warning: 'บัญชีถูกพักถึง 5 พ.ย. 10:37' }), workers)).toEqual({ label: 'Donnomeachi Chardonnay · บัญชีถูกพักถึง 5 พ.ย. 10:37', disabled: true, tone: 'danger' });
  });
  it('ไม่มี session บนเครื่องไหน = ยังไม่ได้ล็อกอิน · เลือกได้ (เจ้าของ Choice "เลือกได้ แต่เตือนก่อนส่ง") · มีบนเครื่อง (fb_account_ids) = ป้ายปกติ', () => {
    expect(soAccountChoice(acc({ name: 'Bennie Bobbe', sessionWorkers: [] }), workers)).toEqual({ label: 'Bennie Bobbe · ใช้ได้ · เหลือ 8 โพสต์วันนี้ · ยังไม่ได้ล็อกอิน Facebook', disabled: false, tone: 'success' });
    expect(soAccountHasSession(acc({ id: 'a9', sessionWorkers: [] }), workers)).toBe(true);
    expect(soAccountChoice(acc({}), workers)).toEqual({ label: 'Donnomeachi Chardonnay · ใช้ได้ · เหลือ 8 โพสต์วันนี้', disabled: false, tone: 'success' });
  });
  it('ยังไม่ได้ล็อกอิน = เตือนก่อนส่ง ทั้งเลือกเครื่องและไม่เลือกเครื่อง', () => {
    const none = acc({ id: 'a2', sessionWorkers: [] }) as SoOptAccount;
    expect(soPostConfirmWarnings(none, null, workers)).toEqual([SO_NO_SESSION_WARNING]);
    expect(soPostConfirmWarnings(acc({}) as SoOptAccount, null, workers)).toEqual([]);
    const src = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(src).toContain('soPostConfirmWarnings(account, worker, opts?.workers ?? [])');
    expect(src).not.toContain('SO_NO_LOGIN_TEXT');
  });
  it('ป๊อปใช้ตัวนี้ (คำ + สี) · บัญชีตั้งต้น = บัญชีที่ So Scraping แนะนำ', () => {
    const src = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(src).toContain('const c = soAccountChoice(a, opts.workers);');
    expect(src).toContain('className: TONE[c.tone].value');
    expect(src).toContain('const acc = soDefaultAccount(o.accounts, jobBu);');
  });
});

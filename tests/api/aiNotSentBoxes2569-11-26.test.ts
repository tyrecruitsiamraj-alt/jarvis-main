// @vitest-environment node
/**
 * "ไม่ได้ส่ง AI" แยกเป็นกล่องตามเรื่อง (เจ้าของ 26 พ.ย. 2569)
 * > *"ไม่เอาแยกกล่องใครกล่องมันไปเลยจบ ก็ไม่ต้องมีคำว่าไม่ส่ง Ai แล้วแต่แยกมาเลยว่าเรื่องไหนที่ไม่ส่ง Ai"*
 * > Choice "พร้อมส่ง AI" · ใบขอปิดแล้ว = "เลือกใบขอที่ยังเปิด แล้วย้ายใบสมัครไป"
 * ส่ง AI ได้เฉพาะกล่องที่ส่งได้ · ตัวส่งจดเหตุลงใบทั้งตัวส่งซ้ำและปุ่มส่ง AI
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AI_BLOCK_REASON, aiBlockBoxOf } from '../../src/lib/aiBlockReasons';
import { suppressionReasonText } from '../../src/lib/callFollowupPolicy';
import {
  aiSendBlockedReasonOf,
  isInRmListView,
  RM_LIST_VIEW_LABEL,
  RM_LIST_VIEWS_SHOWN,
  RM_NOT_SENT_VIEWS,
  rmShownViewOf,
} from '../../src/lib/recruitRm';
import { rmRowStatusOf } from '../../src/lib/applicantAiAnswerText';
import { aiBlockOf } from '../../api/_handlers/recruit-overview';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

const app = (x: Partial<PublicApplication>) =>
  ({
    id: 'c41f0a52-7d3e-4b1a-9f60-2b8e5d7a1c11',
    full_name: 'สมหญิง ใจดี',
    status: 'new',
    job_id: 'siamraj-sql:LAO6910013',
    created_at: '2026-11-20T03:00:00Z',
    ...x,
  }) as PublicApplication;

describe('เหตุที่ตัวส่งจด → กล่อง', () => {
  it('ทุกข้อความของตัวส่งลงกล่องของตัวเอง (ข้อความเต็มที่มีคำอธิบายหลังขีด)', () => {
    expect(aiBlockBoxOf(AI_BLOCK_REASON.noIncome)).toBe('no_income');
    expect(aiBlockBoxOf(AI_BLOCK_REASON.requestClosed)).toBe('request_closed');
    expect(aiBlockBoxOf(AI_BLOCK_REASON.noPhone)).toBe('bad_data');
    expect(aiBlockBoxOf(AI_BLOCK_REASON.declined)).toBe('declined_job');
    expect(aiBlockBoxOf(AI_BLOCK_REASON.employed)).toBe('employed');
    expect(aiBlockBoxOf(AI_BLOCK_REASON.matchBusy)).toBe('offered_recently');
    expect(aiBlockBoxOf(AI_BLOCK_REASON.held)).toBe('kept');
    expect(aiBlockBoxOf(AI_BLOCK_REASON.scrapNoName)).toBe('no_name');
    expect(aiBlockBoxOf(AI_BLOCK_REASON.suppressed)).toBe('phone_paused');
  });
  it('เบอร์พักทุกเหตุ = เบอร์ถูกพัก · พักเพราะไม่ใช่เจ้าตัว = เบอร์โทรผิด · ข้อความเก่าก่อน 26 พ.ย. ยังจับได้', () => {
    for (const r of ['declined', 'not_looking', 'pdpa', 'manual', null]) {
      expect(aiBlockBoxOf(suppressionReasonText(r, '2026-12-03T02:00:00Z'))).toBe('phone_paused');
    }
    expect(aiBlockBoxOf(suppressionReasonText('wrong_number', '2026-12-03T02:00:00Z'))).toBe('bad_data');
    expect(aiBlockBoxOf('เบอร์นี้ถูกพักอยู่ (แจ้งว่าไม่หางานแล้ว / เบอร์เสีย)')).toBe('phone_paused');
  });
  it('เหตุที่ลองใหม่ได้ / ไม่รู้จัก = พร้อมส่ง AI (ตัวส่งตรวจซ้ำตอนกด) · ไม่มีเหตุ = null', () => {
    expect(aiBlockBoxOf(AI_BLOCK_REASON.factsUnread)).toBe('ready');
    expect(aiBlockBoxOf(AI_BLOCK_REASON.guarded)).toBe('ready');
    expect(aiBlockBoxOf('เหตุใหม่ที่ยังไม่รู้จัก')).toBe('ready');
    expect(aiBlockBoxOf(null)).toBeNull();
    expect(aiBlockBoxOf('  ')).toBeNull();
  });
});

describe('แท็บผู้สมัคร: คนเดียวอยู่กล่องเดียว · ไม่มีกล่อง "ไม่ได้ส่ง AI"', () => {
  const CASES: Array<[Partial<PublicApplication>, string]> = [
    [{}, 'ready'],
    [{ ai_block_reason: AI_BLOCK_REASON.noIncome }, 'no_income'],
    [{ ai_block_reason: AI_BLOCK_REASON.requestClosed }, 'request_closed'],
    [{ ai_block_reason: suppressionReasonText('declined', '2026-12-25T17:30:00Z') }, 'phone_paused'],
    [{ ai_block_reason: suppressionReasonText('wrong_number', '2026-12-25T17:30:00Z') }, 'bad_data'],
    [{ ai_block_reason: AI_BLOCK_REASON.declined }, 'declined_job'],
    [{ ai_block_reason: AI_BLOCK_REASON.employed }, 'employed'],
    [{ ai_block_reason: AI_BLOCK_REASON.matchBusy }, 'offered_recently'],
    [{ claimed_by_name: 'แบงค์' }, 'kept'],
    [{ call_choice: 'manual' }, 'kept'],
    [{ ai_block_reason: AI_BLOCK_REASON.scrapNoName }, 'no_name'],
    [{ phone_callable: false, ai_block_reason: AI_BLOCK_REASON.noIncome }, 'bad_data'],
    [{ irecruit_dup_at: '2026-11-20T00:00:00Z' }, 'irecruit_dup'],
    [{ last_call_status: 'cancelled' }, 'ai_cancelled'],
    [{ ai_block_reason: AI_BLOCK_REASON.factsUnread }, 'ready'],
  ];
  it.each(CASES)('%o → %s', (x, expected) => {
    const r = app(x);
    expect(rmShownViewOf(r)).toBe(expected);
    expect(RM_LIST_VIEWS_SHOWN.filter((v) => v !== 'all' && isInRmListView(r, v))).toEqual([expected]);
    // บรรทัดบนแถว = ชื่อกล่อง
    expect(rmRowStatusOf(r).title).toBe(RM_LIST_VIEW_LABEL[expected as keyof typeof RM_LIST_VIEW_LABEL]);
  });
  it('ไม่มีกล่อง "ไม่ได้ส่ง AI" บนจอ · ทุกกล่องตามเรื่องมีชื่อของตัวเอง', () => {
    expect(RM_LIST_VIEWS_SHOWN).not.toContain('not_sent');
    for (const v of RM_NOT_SENT_VIEWS) {
      expect(RM_LIST_VIEWS_SHOWN).toContain(v);
      expect(RM_LIST_VIEW_LABEL[v]).not.toMatch(/ไม่ได้ส่ง AI/);
    }
    expect(RM_LIST_VIEW_LABEL.ready).toBe('พร้อมส่ง AI');
  });
  it('เบอร์ถูกพัก: แถวบอกวันที่ AI โทรได้อีก', () => {
    expect(rmRowStatusOf(app({ ai_block_reason: suppressionReasonText('declined', '2026-12-25T17:30:00Z') })).detail).toBe(
      'เคยบอก AI ว่าไม่สนใจ · AI โทรได้อีก 26 ธ.ค.',
    );
  });
});

describe('ส่ง AI ได้เฉพาะกล่องที่ส่งได้', () => {
  it('กล่องที่ติดเรื่อง = กดไม่ได้พร้อมเหตุ', () => {
    for (const x of [
      { ai_block_reason: AI_BLOCK_REASON.noIncome },
      { ai_block_reason: suppressionReasonText('declined', '2026-12-25T17:30:00Z') },
      { ai_block_reason: AI_BLOCK_REASON.declined },
      { phone_callable: false },
      { ai_block_reason: AI_BLOCK_REASON.employed },
      { ai_block_reason: AI_BLOCK_REASON.matchBusy },
      { call_choice: 'manual' as const },
      { ai_block_reason: AI_BLOCK_REASON.scrapNoName },
      { age: 60 },
    ]) {
      expect(aiSendBlockedReasonOf(app(x))).toBeTruthy();
    }
  });
  it('พร้อมส่ง · ใบขอปิดแล้ว (เลือกใบใหม่ในป๊อป) · ซ้ำ iRecruit · ยกเลิกสาย · ไม่ผูกใบขอ = ส่งได้', () => {
    for (const x of [
      {},
      { ai_block_reason: AI_BLOCK_REASON.requestClosed },
      { irecruit_dup_at: '2026-11-20T00:00:00Z' },
      { last_call_status: 'cancelled' as const },
      { job_id: undefined },
    ]) {
      expect(aiSendBlockedReasonOf(app(x))).toBeNull();
    }
  });
  it('ปุ่มรายแถว · ปุ่มรวม · ป๊อปยืนยัน ใช้ตัวตัดสินเดียวกัน', () => {
    const table = readFileSync('src/components/recruit-rm/RmTable.tsx', 'utf8');
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    expect(table).toContain('aiSendBlockedReasonOf(r)');
    expect(ws).toContain('aiSendBlockedReasonOf(row)');
    expect(ws).toContain('sendAiBlockedReason=');
  });
});

describe('ตัวส่งจดเหตุลงใบทุกทาง + ข้อความชุดเดียว', () => {
  it('ปุ่มส่ง AI จดเหตุลงใบ (เดิมจดแค่ตัวส่งซ้ำ)', () => {
    const src = readFileSync('api/_handlers/application-call-choice.ts', 'utf8');
    expect((src.match(/await recordAiBlockReasons\(outcome\.skipped\)/g) ?? []).length).toBe(2);
  });
  it('ตัวส่งไม่เขียนข้อความเหตุเอง ใช้ชุดใน aiBlockReasons.ts', () => {
    const src = readFileSync('api/_lib/lumosDispatch.ts', 'utf8');
    expect(src).toContain("from '../../src/lib/aiBlockReasons.js'");
    expect(src).not.toContain("'ใบขอยังไม่ตั้งรายได้ —");
  });
  it('หน้าภาพรวมนับเบอร์พักแบบใหม่ถูก (เดิมหาคำว่า "พัก" — เหตุใหม่ "เคยบอก AI ว่าไม่สนใจ" ไม่มีคำนี้)', () => {
    expect(aiBlockOf(suppressionReasonText('declined', '2026-12-25T17:30:00Z'))).toEqual({ aiBlock: 'paused' });
    expect(aiBlockOf(AI_BLOCK_REASON.noIncome)).toEqual({ aiBlock: 'income' });
    expect(aiBlockOf(AI_BLOCK_REASON.declined)).toEqual({ aiBlock: 'other' });
    expect(aiBlockOf(null)).toEqual({});
  });
});

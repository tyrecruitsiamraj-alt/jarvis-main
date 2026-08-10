import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TONE } from '@/lib/designTokens';
import {
  PROPOSAL_STATUS_TONE,
  proposalStatusChip,
  type ProposalStatus,
} from '@/lib/candidateProposalsApi';
import { CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import { CALL_OUTCOMES } from '@/lib/callFollowupPolicy';
import {
  JOB_POSTING_STATUS_TONE,
  jobPostingStatusChip,
  type JobPostingStatus,
} from '@/lib/jobPostingRequestsApi';
import { FOLLOW_STATUS_TONE, FOLLOW_STATUS_CLASS } from '@/lib/followApi';

/**
 * สถานะทุกชุดต้องมีสีมาจาก token กลางที่เดียว
 *
 * ก่อนหน้านี้สถานะการเสนอถูกทำสีไว้ 3 ที่และไม่ตรงกัน (จองตัวเป็นม่วงที่ Matching
 * แต่เป็นเหลืองที่หน้าจองตัว) เทสต์นี้กันไม่ให้ใครเผลอเพิ่มตารางสีของตัวเองอีก
 */

const indexCss = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

const PROPOSAL_STATUSES: ProposalStatus[] = [
  'proposed',
  'reserved',
  'contacted',
  'placed',
  'rejected',
  'cancelled',
];

const POSTING_STATUSES: JobPostingStatus[] = [
  'pending',
  'in_progress',
  'posted',
  'completed',
  'filled',
  'cancelled',
];

/** ชิปต้องเป็น class กลางที่มีอยู่จริงใน index.css ไม่ใช่สีที่เขียนสดตรงหน้า */
function expectRealChip(chip: string, label: string) {
  expect(chip.startsWith('jarvis-chip '), `${label}: ${chip}`).toBe(true);
  const modifier = chip.split(' ')[1];
  expect(indexCss.includes(`.${modifier} {`), `${label}: ไม่มี .${modifier} ใน index.css`).toBe(true);
  expect(indexCss.includes(`.dark .${modifier} {`), `${label}: ไม่มีคู่ dark ของ .${modifier}`).toBe(true);
}

describe('สถานะการเสนอ (proposal)', () => {
  it('ครบทุกสถานะและชี้ไปที่ชิปกลางที่มีจริง', () => {
    expect(Object.keys(PROPOSAL_STATUS_TONE).sort()).toEqual([...PROPOSAL_STATUSES].sort());
    for (const s of PROPOSAL_STATUSES) expectRealChip(proposalStatusChip(s), s);
  });

  it('ความหมายตรงกับ token: จอง=ม่วง · ลงงาน=เขียว · ติดต่อ=น้ำเงิน · ปฏิเสธ=แดง', () => {
    expect(PROPOSAL_STATUS_TONE.reserved).toBe('violet');
    expect(PROPOSAL_STATUS_TONE.placed).toBe('success');
    expect(PROPOSAL_STATUS_TONE.contacted).toBe('primary');
    expect(PROPOSAL_STATUS_TONE.rejected).toBe('danger');
    expect(proposalStatusChip('reserved')).toBe(TONE.violet.chip);
  });
});

describe('สถานะคำขอโพสหางาน (job posting)', () => {
  it('ครบทุกสถานะและชี้ไปที่ชิปกลางที่มีจริง', () => {
    expect(Object.keys(JOB_POSTING_STATUS_TONE).sort()).toEqual([...POSTING_STATUSES].sort());
    for (const s of POSTING_STATUSES) expectRealChip(jobPostingStatusChip(s), s);
  });

  it('งานที่จบแล้วเป็นเขียวทั้งคู่ · ยกเลิกเป็นเทา', () => {
    expect(JOB_POSTING_STATUS_TONE.completed).toBe('success');
    expect(JOB_POSTING_STATUS_TONE.filled).toBe('success');
    expect(JOB_POSTING_STATUS_TONE.cancelled).toBe('neutral');
  });
});

describe('สถานะรายการติดตาม (follow)', () => {
  it('ชี้ไปที่ชิปกลางที่มีจริงครบทุกสถานะ', () => {
    for (const [status, tone] of Object.entries(FOLLOW_STATUS_TONE)) {
      expectRealChip(FOLLOW_STATUS_CLASS[status as keyof typeof FOLLOW_STATUS_CLASS], status);
      expect(FOLLOW_STATUS_CLASS[status as keyof typeof FOLLOW_STATUS_CLASS]).toBe(TONE[tone].chip);
    }
  });
});

describe('ไม่มีตารางสีสถานะซ้ำในหน้าเว็บ', () => {
  it('หน้าที่เคยมี STATUS_CLASS ของตัวเอง ต้องไม่ประกาศซ้ำแล้ว', () => {
    const files = [
      'src/pages/matching/ReservationsPage.tsx',
      'src/pages/matching/JobPostingsPage.tsx',
      'src/pages/matching/MatchingPage.tsx',
    ];
    for (const f of files) {
      const src = readFileSync(path.resolve(process.cwd(), f), 'utf8');
      expect(src.includes('const STATUS_CLASS'), `${f} ยังมีตารางสีของตัวเอง`).toBe(false);
    }
  });
});

/**
 * โทนของ "ผลโทร" ต้องมาจาก src/lib/callOutcomeTone.ts ที่เดียว
 *
 * เดิมแต่ละหน้าประกาศ map เอง 4 ที่ แล้วเพี้ยนกันจริง: "ไม่รับสาย" เป็นเทาใน
 * funnel/หน้างานโทร แต่เป็นเหลืองบนหน้าหลัก/การ์ด Matching — เจ้าของกวาดเจอเอง
 */
describe('โทนผลโทร — แหล่งเดียว ห้ามแตกไปประกาศซ้ำในไฟล์หน้า', () => {
  const FILES = [
    'src/components/follow/CallFunnelPanel.tsx',
    'src/components/matching/CallHoldPanel.tsx',
    // หน้า "งานโทร" (MyCallsPage) ถูกปิดไป 10 ส.ค. 2569 — บล็อก Status ย้ายมาเป็น
    // CallStatusPanel บนหน้าหลัก ตัวคุมจึงย้ายมาจับไฟล์นี้แทน
    'src/components/matching/CallStatusPanel.tsx',
    'src/pages/matching/CallTeamBoardPage.tsx',
  ];

  it('ไม่มีไฟล์หน้าไหนประกาศตารางโทนผลโทรของตัวเอง', () => {
    for (const f of FILES) {
      const src = readFileSync(path.resolve(process.cwd(), f), 'utf8');
      expect(src, f).not.toMatch(/const\s+(OUTCOME_TONE|CALL_RESULT_TONE)\s*:/);
      expect(src, f).toMatch(/from '@\/lib\/callOutcomeTone'/);
    }
  });

  it('ครบทุก outcome ที่ Lumos ส่งกลับได้ — เพิ่มค่าใหม่แล้วลืมใส่สีจะพัง', () => {
    for (const o of CALL_OUTCOMES) {
      expect(CALL_OUTCOME_TONE[o], o).toBeTruthy();
    }
    expect(Object.keys(CALL_OUTCOME_TONE).sort()).toEqual([...CALL_OUTCOMES].sort());
  });

  it('ทิศทางความหมายตรงกันทั้งชุด: จบดี=เขียว · จบไม่ดี=แดง · รอโทรซ้ำ=เหลือง · ต้องคนตาม=ส้ม', () => {
    expect(CALL_OUTCOME_TONE.confirmed).toBe('success');
    expect(CALL_OUTCOME_TONE.acknowledged).toBe('success');
    expect(CALL_OUTCOME_TONE.declined).toBe('danger');
    for (const o of ['no_answer', 'busy', 'unresponsive', 'failed', 'reschedule_requested'] as const) {
      expect(CALL_OUTCOME_TONE[o], o).toBe('warn');
    }
    expect(CALL_OUTCOME_TONE.wrong_person).toBe('orange');
    // สายที่คนกดยกเลิกไม่ใช่ผลการโทร — ต้องไม่ถูกระบายสีว่าดีหรือแย่
    expect(CALL_OUTCOME_TONE.cancelled).toBe('neutral');
  });

  it('ทุกโทนที่ใช้มีจริงใน TONE', () => {
    for (const key of Object.values(CALL_OUTCOME_TONE)) {
      expect(TONE[key], key).toBeTruthy();
    }
  });
});

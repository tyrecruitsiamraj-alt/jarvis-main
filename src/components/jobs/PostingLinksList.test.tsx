/**
 * "มีแล้ว N ลิงก์" กดแล้วเห็นทีละลิงก์ว่าเกี่ยวกับอะไร (เจ้าของ 4 ต.ค. 2569 → Choice "ครบ")
 * ช่องทาง · ตัวลิงก์ · คนกด · สมัครเข้ามา · สร้างเมื่อไหร่ · ใครสร้าง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PostingLinksList from '@/components/jobs/PostingLinksList';
import { ageRangeError } from '@/lib/ageRange';
import type { RecruitPosting } from '@/lib/recruitPostings';

const posting = {
  id: 'p1',
  jobId: 'j1',
  title: 'คนสวน สมมุติ',
  createdByName: 'tester@example.com',
  createdAt: '2026-10-04T03:00:00Z',
  status: 'open',
  links: [
    { id: 'l1', channelId: 'c1', channelLabel: 'Facebook Group', code: 'abc123', note: null, hitCount: 12, createdAt: '2026-10-04T03:00:00Z', applicationCount: 3 },
    { id: 'l2', channelId: null, channelLabel: null, code: 'zzz999', note: null, hitCount: 0, createdAt: '2026-10-04T03:00:00Z', applicationCount: 0 },
  ],
} as unknown as RecruitPosting;

describe('PostingLinksList', () => {
  it('บอกครบต่อลิงก์ · ลิงก์ไม่มีช่องทาง = ลิงก์กลาง', () => {
    render(<PostingLinksList postings={[posting]} />);
    expect(screen.getByText('Facebook Group')).toBeTruthy();
    expect(screen.getByText(/\/apply\/p\/abc123$/)).toBeTruthy();
    expect(screen.getByText(/คนกด 12 ครั้ง/)).toBeTruthy();
    expect(screen.getByText(/สมัครเข้ามา 3 คน/)).toBeTruthy();
    expect(screen.getByText('ลิงก์กลาง (ไม่ระบุช่องทาง)')).toBeTruthy();
    expect(screen.getByText(/สร้างโดย tester@example.com/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /แก้ข้อความประกาศ/ })).toBeTruthy();
  });
  it('ไม่มีประกาศ = บอกว่ายังไม่มีลิงก์ (ไม่หาย)', () => {
    render(<PostingLinksList postings={[]} />);
    expect(screen.getByText('ยังไม่มีลิงก์')).toBeTruthy();
  });
});

describe('สร้างลิงก์ได้หลายช่องทางในครั้งเดียว', () => {
  it('ฟอร์มสร้างลิงก์ส่งทุกช่องที่เลือก (ช่องละ 1 ลิงก์)', () => {
    const src = readFileSync('src/components/jobs/GenApplyLinkDialog.tsx', 'utf8');
    expect(src).toContain('<MultiChannelPicker');
    expect(src).toContain('channels: picked.map((c) => ({ channelId: c.id, label: recruitChannelLabel(c) }))');
  });
});

describe('ageRangeError', () => {
  it('ว่างได้ · นอกช่วง/สลับกัน = ผิด', () => {
    expect(ageRangeError(null, null)).toBeNull();
    expect(ageRangeError(18, 45)).toBeNull();
    expect(ageRangeError(10, 45)).toMatch(/15–80/);
    expect(ageRangeError(50, 40)).toMatch(/ไม่มากกว่า/);
  });
});

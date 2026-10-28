/**
 * ข้อความประกาศที่แก้ใน Autopost ขึ้นหน้าสมัครด้วย (เจ้าของ 28 ต.ค. 2569 Choice "ข้อความที่แก้ไปโชว์บนหน้าสมัครด้วย")
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { JobRequest } from '@/types';
import JobPublicFacts from './JobPublicFacts';
import { publicPostText } from '@/lib/postText';

afterEach(cleanup);

const CAPTION = 'รับสมัครคนสวน (หน่วยงาน เรนวูด)\n💰 รายได้ 12,600++ บาท/เดือน\nสมัครเลย: https://jarvis.siamrajathanee.dev/apply/p/6x5ua6v\nมีโอที ขึ้นอยู่กับหน่วยงาน';
const job = { id: 'j1', unit_name: 'เรนวูด', public_post_text: CAPTION } as unknown as JobRequest;

describe('publicPostText', () => {
  it('ตัดบรรทัดที่มีลิงก์ · คงขึ้นบรรทัด · ว่าง = null', () => {
    expect(publicPostText(CAPTION)).toBe('รับสมัครคนสวน (หน่วยงาน เรนวูด)\n💰 รายได้ 12,600++ บาท/เดือน\nมีโอที ขึ้นอยู่กับหน่วยงาน');
    expect(publicPostText('https://x.y/apply')).toBe(null);
    expect(publicPostText(null)).toBe(null);
  });
});

describe('การ์ดหน้าสมัคร', () => {
  it('หน้าสมัคร/การ์ดตัวอย่างโชว์ข้อความที่แก้ · การ์ดกล่องงานของเจ้าหน้าที่ไม่โชว์', () => {
    render(<JobPublicFacts job={job} />);
    expect(screen.getByTestId('job-public-post-text').textContent).toContain('มีโอที ขึ้นอยู่กับหน่วยงาน');
    expect(screen.getByTestId('job-public-post-text').textContent).not.toContain('https://');
    cleanup();
    render(<JobPublicFacts job={job} staff />);
    expect(screen.queryByTestId('job-public-post-text')).toBeNull();
  });
});

describe('เก็บกับใบขอ', () => {
  it('Autopost บันทึกเฉพาะตอนคนพิมพ์ (เปิดดูไม่เขียนฐาน) · หน้าสาธารณะส่งข้อความที่ตัดลิงก์แล้ว', () => {
    const ap = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(ap).toContain('setCaptionDirty({ text: e.target.value });');
    expect(ap).toContain("saveUnitFieldOverridesPatch(requestNo, { post_caption: pending.text })");
    expect(readFileSync('api/_handlers/public/jobs.ts', 'utf8')).toContain('public_post_text: publicPostText(');
    expect(readFileSync('api/_handlers/siamraj-unit-requests.ts', 'utf8')).toContain('if (fo.post_caption) it.public_post_text = fo.post_caption;');
  });
});

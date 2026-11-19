/**
 * ภาพรวมแบบ Mobix (เจ้าของ 18 พ.ย. 2569) — แนวโน้มรายวันจากรายชื่อในช่วง
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dailyPulse } from '@/components/dashboard-trends/v2/PulseParts';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

const fact = (p: Partial<RecruitAppFact>): RecruitAppFact => ({ createdAt: '2026-11-17T03:00:00Z', jobId: null, channelLabel: null, referralSource: null, position: null, phoneOk: true, calledByAi: false, calledByStaff: false, firstCalledAt: null, aiAnswer: null, aiAnswerAt: null, staffAnswer: null, staffAnswerAt: null, staffLastAt: null, contact: null, contactBy: null, logOk: null, logReason: null, logAt: null, appointmentAt: null, attendance: null, onBoard: null, ...p }) as RecruitAppFact;

describe('dailyPulse', () => {
  it('ทุกวันในช่วงมีแถว (ว่าง = 0) · ใบสมัครนับตามวันสมัครเวลาไทย · ผล AI นับตามวันที่ได้ผล', () => {
    const pts = dailyPulse(
      [
        fact({ createdAt: '2026-11-16T18:30:00Z' }), // 17 พ.ย. 01:30 ไทย
        fact({ createdAt: '2026-11-17T03:00:00Z', calledByAi: true, aiAnswer: 'no_answer' as never, aiAnswerAt: '2026-11-18T02:00:00Z' }),
      ],
      '2026-11-16',
      '2026-11-18',
    );
    expect(pts.map((p) => p.day)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
    expect(pts.map((p) => p.apps)).toEqual([0, 2, 0]);
    expect(pts[2].yes + pts[2].no + pts[2].noPickup + pts[2].other).toBe(1);
  });
  it('เรื่องเล่ารายชื่อในแผงข้าง: 2 คอลัมน์ ชื่อไม่โดนตัด (เจ้าของ 19 พ.ย. 2569 "ชื่อมันตกแล้วจะดูรู้เรื่องได้ไง")', () => {
    const src = readFileSync('src/components/dashboard-trends/v2/ApplicantStory.tsx', 'utf8');
    expect(src).toContain('<div className="grid gap-4 sm:grid-cols-2">');
    expect(src).not.toContain('xl:grid-cols-3');
    expect(src).not.toContain('flex-1 truncate');
  });
  it('การ์ด Autopost = ยอดสั่งโพสต์ทั้งหมดรายกลุ่ม (เจ้าของ 19 พ.ย. 2569 Choice "1,819 กลุ่ม")', () => {
    const src = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    expect(src).toContain("n: posts.key === filterKey ? posts.total : null,\n              unit: 'กลุ่ม'");
  });
  it('หน้าภาพรวมมี ต้องทำ · การสั่งงาน (Autopost/โพสต์เอง/Scrap) · แนวโน้มรายวัน · ความเคลื่อนไหวล่าสุด', () => {
    const src = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    for (const t of ['title="ต้องทำ"', 'title="การสั่งงาน"', 'title="แนวโน้มรายวัน"', 'title="ความเคลื่อนไหวล่าสุด"', "key: 'autopost'", "key: 'self'", "key: 'scrap'"]) expect(src).toContain(t);
  });
});

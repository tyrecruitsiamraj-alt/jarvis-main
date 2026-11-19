/**
 * ภาพรวมแบบ Mobix (เจ้าของ 18 พ.ย. 2569) — แนวโน้มรายวันจากรายชื่อในช่วง
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dailyPulse, pulsePoints } from '@/components/dashboard-trends/v2/PulseParts';
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
  it('รายเดือน: ทุกเดือนในช่วงมีแถว · นับเฉพาะวันในช่วง (เจ้าของ 19 พ.ย. 2569 "เลือกดูแบบรายเดือนได้ รายวันได้ไหม")', () => {
    const pts = pulsePoints(
      [
        fact({ createdAt: '2026-10-20T03:00:00Z' }),
        fact({ createdAt: '2026-11-02T03:00:00Z' }),
        fact({ createdAt: '2026-11-03T03:00:00Z', calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-11-04T03:00:00Z' }),
        fact({ createdAt: '2026-09-30T03:00:00Z' }), // นอกช่วง
      ],
      '2026-10-01',
      '2026-11-19',
      'month',
    );
    expect(pts.map((p) => p.day)).toEqual(['2026-10', '2026-11']);
    expect(pts.map((p) => p.apps)).toEqual([1, 2]);
    expect(pts[1].yes).toBe(1);
  });
  it('หน้าภาพรวม: ต้องทำ → ใบขอ → การประกาศ → การสั่งงาน · แนวโน้มอยู่ในแผงของแต่ละกล่อง ไม่มีการ์ดแนวโน้มรายวัน', () => {
    const src = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
    for (const t of ['title="ต้องทำ"', 'title="การสั่งงาน"', 'title="ความเคลื่อนไหวล่าสุด"', "key: 'autopost'", "key: 'self'", "key: 'scrap'"]) expect(src).toContain(t);
    expect(src).not.toContain('title="แนวโน้มรายวัน"');
    const at = (id: string) => src.indexOf(`data-testid="${id}"`);
    expect(at('v2-todo-card')).toBeLessThan(at('v2-requests'));
    expect(at('v2-requests')).toBeLessThan(at('v2-posting'));
    expect(at('v2-posting')).toBeLessThan(at('v2-outreach-card'));
    expect(at('v2-outreach-card')).toBeLessThan(at('v2-intake-card'));
    const story = readFileSync('src/components/dashboard-trends/v2/IntakeScopeStory.tsx', 'utf8');
    expect(story).toContain('<PulseChart points={pulsePoints(facts, from, to, grain)}');
  });
});

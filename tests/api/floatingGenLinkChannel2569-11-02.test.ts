/**
 * Gen link ของกล่องลอย: ช่องทางอยู่บนสุดและกางให้เลือกเลย (เจ้าของ 2 พ.ย. 2569 "ทำให้เลือกช่องทางตอน Genlink ได้ด้วยสิ่")
 * เดิมหุบอยู่ท้ายฟอร์มยาว หาไม่เจอ · ป๊อปของใบขอ (channelOnly) ยังกางเหมือนเดิม · ที่อื่นที่หุบยังหุบ
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(__dirname, '../../src/components/jobs/GenApplyLinkDialog.tsx'), 'utf8');

describe('Gen link กล่องลอย — ช่องทาง', () => {
  it('กล่องลอยกางรายการช่องทางเป็นค่าเริ่ม', () => {
    expect(src).toContain('setChannelsOpen(channelOnly || Boolean(standalone));');
  });

  it('กล่องลอยวางช่องทางบนสุด · ป๊อปอื่นยังอยู่ตำแหน่งเดิม (ไม่ซ้ำสองที่)', () => {
    const top = src.indexOf('{standalone ? channelSection : null}');
    const bottom = src.indexOf('{standalone ? null : channelSection}');
    const title = src.indexOf('หัวข้อประกาศ <span');
    expect(top).toBeGreaterThan(0);
    expect(bottom).toBeGreaterThan(title);
    expect(top).toBeLessThan(title);
    expect(src.match(/<MultiChannelPicker /g)).toHaveLength(1);
  });
});

describe('การ์ดกล่องลอยบอก Gen link ล่าสุด วันไหน ใครกด (เจ้าของ 2 พ.ย. 2569 Choice "โชว์บนการ์ดกล่องลอย")', () => {
  const view = fs.readFileSync(path.resolve(__dirname, '../../src/components/jobs/JobBoardView.tsx'), 'utf8');

  it('ใช้ลิงก์ที่สร้างล่าสุดของประเภท · ชื่อ = คนกด Gen จริง (postingLinkCreator) ไม่ใช่ผู้รับผิดชอบ (QA 2 พ.ย.)', () => {
    expect(view).toMatch(/l\.createdAt > a\.lastGen\.at\) a\.lastGen = \{ at: l\.createdAt, by: postingLinkCreator\(l, p\) \}/);
  });

  it('postingLinkCreator: ชื่อคนกด > คนสร้างประกาศเฉพาะลิงก์ที่สร้างพร้อมประกาศ > ไม่รู้ = null', async () => {
    const { postingLinkCreator } = await import('@/lib/recruitPostings');
    const posting = { createdByName: 'james.p@siamraj.com', createdAt: '2026-10-14T03:00:00Z' };
    expect(postingLinkCreator({ createdByName: 'ว่าน', createdAt: '2026-10-29T03:00:00Z' }, posting)).toBe('ว่าน');
    expect(postingLinkCreator({ createdByName: 'wan.k@siamraj.com', createdAt: '2026-10-29T03:00:00Z' }, posting)).toBe('wan.k');
    expect(postingLinkCreator({ createdByName: null, createdAt: '2026-10-14T03:02:00Z' }, posting)).toBe('james.p');
    expect(postingLinkCreator({ createdByName: null, createdAt: '2026-10-20T03:00:00Z' }, posting)).toBeNull();
    expect(postingLinkCreator({ createdByName: null, createdAt: '2026-10-20T03:00:00Z' }, null)).toBeNull();
  });

  it('การ์ดขึ้น "Gen link ล่าสุด วันที่ โดย ชื่อ" · ยังไม่มีลิงก์ = ไม่มีบรรทัด', () => {
    expect(view).toContain('data-testid="standalone-last-gen"');
    expect(view).toContain('Gen link ล่าสุด {formatYmdTh(toYmdBangkok(new Date(s.lastGen.at)))}');
    expect(view).toContain('{s.lastGen ? (');
  });
});

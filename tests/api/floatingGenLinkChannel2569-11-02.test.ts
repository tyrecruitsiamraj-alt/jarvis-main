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

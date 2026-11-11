/**
 * ตารางช่องทางกางในที่ (เจ้าของ 11 พ.ย. 2569 "กด facebook ก็ขยายช่องทางรองออกมา แล้วพวก tiktok ก็ยังอยู่ … ไม่ใช่กดแล้วเด้ง")
 */
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ChannelFunnelTable from './ChannelFunnelTable';
import { FUNNEL_COLUMNS, type ChannelFunnelRow, type FunnelNode } from '@/lib/channelFunnel';

const row = (channel: string, names: number): ChannelFunnelRow =>
  ({
    channel,
    ...Object.fromEntries(FUNNEL_COLUMNS.map((c) => [c.key, { value: c.key === 'names' ? names : 0, ids: [] }])),
  }) as ChannelFunnelRow;
const node = (key: string, names: number, children?: FunnelNode[]): FunnelNode => ({ ...row(key, names), key, children });

const groups: FunnelNode[] = [
  node('Facebook', 30, [
    node('Facebook Page', 5),
    node('Facebook Group', 25, [node('กลุ่มเล็ก', 3), node('กลุ่มใหญ่', 15), node('กลุ่มกลาง', 7)]),
  ]),
  node('Tiktok', 12),
];

afterEach(cleanup);

const firstCells = () => screen.getAllByRole('row').slice(1).map((r) => r.querySelector('td')?.textContent?.trim());

describe('ตารางช่องทางกางในที่', () => {
  it('กด Facebook = ช่องทางรองกางใต้แถว · Tiktok ยังอยู่ · แถว Facebook อยู่ที่เดิม · ลูกเรียงกรอกมากไปน้อย', () => {
    render(<ChannelFunnelTable groups={groups} total={row('รวม', 42)} />);
    expect(firstCells()).toEqual(['Facebook', 'Tiktok', 'รวม']);
    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));
    expect(firstCells()).toEqual(['Facebook', 'Facebook Group', 'Facebook Page', 'Tiktok', 'รวม']);
    fireEvent.click(screen.getByRole('button', { name: 'Facebook Group' }));
    expect(firstCells()).toEqual(['Facebook', 'Facebook Group', 'กลุ่มใหญ่', 'กลุ่มกลาง', 'กลุ่มเล็ก', 'Facebook Page', 'Tiktok', 'รวม']);
    expect(screen.getByRole('button', { name: 'Facebook' }).getAttribute('aria-expanded')).toBe('true');
  });
  it('กดซ้ำ = หุบ · ไม่มีแถบชั้นด้านบนที่ดันตารางลง', () => {
    render(<ChannelFunnelTable groups={groups} total={row('รวม', 42)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));
    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));
    expect(firstCells()).toEqual(['Facebook', 'Tiktok', 'รวม']);
    expect(screen.queryByTestId('channel-funnel-path')).toBeNull();
  });
});

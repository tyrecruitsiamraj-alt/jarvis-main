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

describe('คลิกกลุ่ม Facebook เป็นไส้ในของตารางช่องทาง (เจ้าของ 11 พ.ย. 2569)', () => {
  it('ช่องคลิกเฉพาะแถวที่มีลิงก์ · กลุ่มคลิกแต่ไม่มีคนกรอกยังอยู่ (0) · เรียงกรอกก่อน คลิกรอง', async () => {
    const { mergeFbGroupClicks } = await import('@/lib/fbGroupClicks');
    const tree = {
      groups: [
        { ...node('facebook', 10, [node('Facebook Group', 10, [{ ...row('กลุ่มก', 10), key: 'Facebook Group|กลุ่มก' }])]), channel: 'Facebook' },
        node('Tiktok', 4),
      ] as FunnelNode[],
      total: row('รวม', 14),
    };
    tree.groups[0].children![0] = { ...tree.groups[0].children![0], key: 'Facebook Group' };
    const merged = mergeFbGroupClicks(tree, {
      rows: [
        { group: 'กลุ่มก', clicks: 50, appIds: [], ratePct: 20, applyPresses: 3, repeatBlocked: 1 },
        { group: 'กลุ่มข', clicks: 80, appIds: [], ratePct: 0, applyPresses: 0, repeatBlocked: 0 },
      ],
      totalClicks: 130,
      totalApps: 10,
      totalPresses: 3,
      totalBlocked: 1,
    });
    render(<ChannelFunnelTable groups={merged.groups} total={merged.total} clicks={merged.clicks} />);
    expect(screen.getByRole('columnheader', { name: 'คลิก' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));
    fireEvent.click(screen.getByRole('button', { name: 'Facebook Group' }));
    expect(firstCells()).toEqual(['Facebook', 'Facebook Group', 'กลุ่มก', 'กลุ่มข', 'Tiktok', 'รวม']);
    const cellsOf = (name: string) => [...screen.getAllByRole('row').find((r) => r.querySelector('td')?.textContent?.trim() === name)!.querySelectorAll('td')].map((td) => td.textContent?.trim());
    expect(cellsOf('Facebook Group')[1]).toBe('130กดสมัคร 3สมัครซ้ำโดนกัน 1');
    expect(cellsOf('กลุ่มข')[1]).toBe('80');
    expect(cellsOf('กลุ่มข')[2]?.startsWith('0')).toBe(true);
    expect(cellsOf('Tiktok')[1]).toBe('—');
  });
});

/**
 * เลือกกลุ่ม Facebook — ค้นหาชื่อกลุ่ม (เจ้าของ 19 พ.ย. 2569 "ทำให้ค้นหาชื่อกลุ่มได้ที")
 * พิมพ์แล้วหาจากทุกกลุ่มที่โพสต์ได้ (ไม่สนธุรกิจ/ประเภท/จังหวัด · ช่องเลือกพวกนั้นกดไม่ได้ระหว่างค้นหา) · ลบคำค้น = กลับตามตัวกรองเดิม
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SoOptGroup } from '@/lib/soScraping';

vi.mock('@/lib/recruitPostingsApi', () => ({ fetchFbGroupStats: async () => null, fbGroupStatOf: () => ({ clicks: 0, apps: 0 }) }));
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const { SoGroupFilterPicker } = await import('./SoGroupPicker');

afterEach(cleanup);

const g = (id: string, name: string, department: string): SoOptGroup =>
  ({ id, fbGroupId: id, name, url: null, accountIds: [], lastPostedAt: null, stats30d: null, department, sector: 'private', provinces: [], nationwide: false, blocked: null }) as unknown as SoOptGroup;

describe('ค้นหาชื่อกลุ่ม', () => {
  it('หาข้ามธุรกิจได้ · ไม่เจอบอกตรง ๆ · ลบคำค้นกลับรายการเดิม', () => {
    const groups = [g('1', 'หางานขับรถ กรุงเทพ', 'LBD'), g('2', 'กลุ่มหางานช่างอาคาร', 'LBA'), g('3', 'หางาน บางบ่อ', 'LBA')];
    render(<SoGroupFilterPicker idPrefix="t" testPrefix="genlink" groups={groups} allGroups={groups} jobBu="LBD" jobSector="private" account={null} picked={[]} cap={null} onToggle={() => {}} />);
    const rows = () => screen.queryAllByTestId('genlink-group-row').map((r) => r.textContent ?? '');
    expect(rows().some((t) => t.includes('หางานขับรถ'))).toBe(true);
    expect(rows().some((t) => t.includes('ช่างอาคาร'))).toBe(false); // ธุรกิจ LBD
    const box = screen.getByTestId('genlink-group-search');
    fireEvent.change(box, { target: { value: 'ช่างอาคาร' } });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('กลุ่มหางานช่างอาคาร');
    expect(within(screen.getByTestId('genlink-list-head')).getByText(/เจอ 1 กลุ่ม/)).toBeTruthy();
    fireEvent.change(box, { target: { value: 'ไม่มีแน่ ๆ' } });
    expect(screen.getByText('ไม่เจอกลุ่มชื่อนี้')).toBeTruthy();
    fireEvent.change(box, { target: { value: '' } });
    expect(rows().some((t) => t.includes('หางานขับรถ'))).toBe(true);
  });
});

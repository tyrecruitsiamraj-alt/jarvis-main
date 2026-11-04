/**
 * ภาพรวมงานสรรหา (เจ้าของ 29 ต.ค. 2569): แท็บใบขอ = 1 แนวโน้มใบขอ · 2 งานตามจังหวัด
 * "งานค้างตอนนี้ ย้ายไปให้ถูกเรื่องของมัน" — ยังไม่มีใครโทร → กรอกเข้ามา · สนใจแล้วยังไม่มีคนโทรต่อ → การติดต่อ · นัดที่ยังไม่บันทึกผล → นัดหมาย
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
/** 4 พ.ย. 2569 หน้าเดียว (ไม่มีแท็บ) — ช่วงของแต่ละขั้น: ใบขอ = ก่อนส่วนการติดต่อ · การติดต่อ/นัดหมาย = ใน FoldSection ของมัน */
const section = (tab: string) => {
  const contact = src.indexOf('<FoldSection title="การติดต่อ"');
  const appt = src.indexOf('<FoldSection title="นัดหมาย"');
  if (tab === 'requests') return src.slice(0, contact);
  if (tab === 'staff') return src.slice(contact, appt);
  return src.slice(appt, src.indexOf('</FoldSection>', appt));
};

describe('งานค้างอยู่ในแท็บของมัน', () => {
  it('แท็บใบขอ = แท็บใบขอใหม่ (แนวโน้มใบขอเป็นการ์ดข้อ 2) · งานตามจังหวัดถอดแล้ว แทนด้วยพื้นที่ขาดคน (29 ต.ค. 2569)', () => {
    const req = section('requests');
    expect(req).toContain("trend={(sc) => compareCard('requests', view, { rows: sc.rows, prevRows: sc.prevRows })}");
    expect(src).not.toContain('ProvinceJobsCard');
  });
  it('แต่ละแท็บมีงานค้างก้อนของตัวเอง (ของกรอกเข้ามาย้ายไปท้ายแท็บใบขอ)', () => {
    expect(section('requests')).toContain('only="uncalled"');
    expect(section('staff')).toContain('only="waiting"');
    expect(section('appt')).toContain('only="appointments"');
  });
});

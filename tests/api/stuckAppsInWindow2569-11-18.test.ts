/**
 * ภาพรวม: เลือกช่วงวันที่แล้ว ผู้สมัครของแต่ละใบขอนับเฉพาะที่เข้ามาในช่วง (เจ้าของ 18 พ.ย. 2569
 * "เลือกช่วง 1-17 ข้อมูลทั้งหน้าต้องตามช่วง" · Choice "นับเฉพาะคนที่สมัครในช่วง")
 * เดิมนับทุกวัน ⇒ คนสมัคร 2,492 เทียบกับรายการสมัครเข้าใหม่ 2,915 ไม่ได้
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('api/_handlers/recruit-stuck.ts', 'utf8');

describe('ผู้สมัครของใบขอตามช่วงที่เลือก', () => {
  it('หน้า (buildRecruitStuck) ส่ง appsInWindow · ตัวจดยอดรายวันไม่ส่ง', () => {
    expect(src).toContain("loadStuckRequests(departmentScope, buSet, win, today, { appsInWindow: true })");
    const snap = src.slice(src.indexOf('export async function loadOpenStuckRequestsAll'), src.indexOf('export async function loadOpenStuckRequestsAll') + 400);
    expect(snap).not.toContain('appsInWindow');
  });
  it('กรองด้วยวันที่สมัครตามปฏิทินกรุงเทพ ทั้งต้นและปลายช่วง', () => {
    expect(src).toContain('toBangkokYmd(new Date(f.createdAt))');
    expect(src).toContain('d >= win.from && d <= win.to');
    expect(src).toContain('if (opts.appsInWindow && !inWin(f)) continue;');
  });
});

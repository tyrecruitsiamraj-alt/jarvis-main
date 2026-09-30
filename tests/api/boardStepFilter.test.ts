/**
 * ═══ ติดขั้น → การ์ดแต่ละใบ + หัวข้อกรอง (เจ้าของสั่ง 30 ก.ย. 2569) ═══
 * > *"ติดขั้น เอาไปไว้ในแต่ละกล่อง แล้วไปทำ Filter เอาเพื่อดูว่างานที่ติดขั้นๆๆมีเท่าไหร่"* → Choice "การ์ดใบขอแต่ละใบ"
 * 🔴 ด่าน: หัวกล่องงานไม่มีแถว "ติดขั้น" แล้ว · การ์ดบอก "ติดขั้น N" · ตัวกรองมีหัวข้อติดขั้น (ขึ้นก่อน) ·
 *    ลิงก์เก่า `?step=` ยังใช้ได้ (แปลงเป็นหัวข้อกรองให้) · นับจากตัวเดียวกับการ์ด (`releaseStepOf`)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BOARD_PRIMARY_FACETS } from '@/lib/boardFilters';

const ROOT = path.resolve(__dirname, '../..');
const code = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const HEADER = code('src/components/jobs/BoardReleaseHeader.tsx');
const BOARD = code('src/components/jobs/JobBoardView.tsx');
const CARD = code('src/components/jobs/BoardCardProgress.tsx');
const JOB_CARD = code('src/components/jobs/BoardJobCard.tsx');

describe('ติดขั้นย้ายออกจากหัวกล่องงาน', () => {
  it('🔴 หัวไม่มีแถว/ปุ่มขั้นแล้ว (props ขั้นถูกถอดด้วย)', () => {
    expect(HEADER).not.toContain('StepPill');
    expect(HEADER).not.toContain('ติดขั้น');
    expect(HEADER).not.toContain('onStepChange');
    expect(BOARD).not.toMatch(/onStepChange=/);
  });

  it('การ์ดแต่ละใบบอก "ติดขั้น N ชื่อขั้น" — ทั้งการ์ดกล่องงานที่ใช้จริง (BoardJobCard) และแถบขั้นแบบเดิม', () => {
    expect(CARD).toContain('ติดขั้น {currentStep}');
    // การ์ดที่กล่องงานวาดจริง (แบบ A) — เคยแก้แต่แถบเดิม การ์ดจริงเลยไม่ขึ้นคำว่าติดขั้น (เจอตอนตรวจบนจอ 30 ก.ย.)
    expect(JOB_CARD).toMatch(/\{step \? <span className="font-medium">ติดขั้น \{step\} <\/span> : null\}\s*\{progress\.label\}/);
  });
});

describe('หัวข้อ "ติดขั้น" ในตัวกรองกล่องงาน', () => {
  it('ขึ้นก่อนหัวข้ออื่น', () => {
    expect(BOARD_PRIMARY_FACETS[0]).toBe('step');
  });

  it('🔴 นับด้วยตัวเดียวกับการ์ด · ใบที่ปล่อยแล้วไม่ติดขั้น · ทะเบียนยังไม่พร้อม = ไม่มีหัวข้อ', () => {
    expect(BOARD).toContain('stepOf: ledgerReady ? (j) => (releaseIdx.has(j.id) ? null : releaseStepOf(j, stageFacts)) : null');
  });

  it('🔴 ลิงก์เก่า ?step= แปลงเป็น f.step แล้วล้างทิ้ง (replace — ไม่เพิ่มประวัติ)', () => {
    expect(BOARD).toMatch(/params\.delete\('step'\);[\s\S]*?selection: \{ \.\.\.current\.selection, step: \[stepParam\] \}/);
    expect(BOARD).toMatch(/\{ replace: true \},\s*\);\s*\}, \[stepParam, setSearchParams\]\);/);
    // การ์ดไม่กรองด้วย ?step= ตรง ๆ อีก (ขั้นอยู่ในตัวกรองแล้ว)
    expect(BOARD).not.toContain('filterByReleaseStep');
  });
});

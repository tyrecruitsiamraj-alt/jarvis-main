// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  SEARCH_ALL_POOLS,
  SEARCH_ALL_POOLS_AND_CALL,
  SEARCH_LEGACY_POOL,
  SEARCH_LEGACY_POOL_AND_CALL,
} from '@/lib/candidateSearchLabels';

/**
 * คำบนปุ่ม "หาคนเพิ่ม" 3 ทาง (Phase 3 · เจ้าของเคาะ "เก็บทั้ง 3 ปุ่ม แค่เปลี่ยนคำให้ต่างกันชัด")
 *
 * เทสต์นี้กันสองอย่างที่พลาดง่าย:
 * 1. คำกลับไปซ้ำกันจนแยกไม่ออก (เหตุผลที่ต้องแก้ตั้งแต่แรก)
 * 2. ชื่อระบบ ("iRecruit") หลุดขึ้นปุ่ม — เจ้าของสั่งห้ามไว้ตั้งแต่ 16 ส.ค. 2569
 */

const ALL = [
  SEARCH_LEGACY_POOL,
  SEARCH_LEGACY_POOL_AND_CALL,
  SEARCH_ALL_POOLS,
  SEARCH_ALL_POOLS_AND_CALL,
];
const read = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), 'utf8');

describe('candidateSearchLabels', () => {
  it('คำบนปุ่มทั้งสามต่างกันหมด และไม่มีคำไหนเป็นส่วนหนึ่งของอีกคำ', () => {
    const labels = ALL.map((x) => x.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const a of labels) {
      for (const b of labels) {
        if (a === b) continue;
        expect(b.includes(a), `"${b}" มี "${a}" อยู่ข้างใน — คนอ่านจะแยกไม่ออก`).toBe(false);
      }
    }
  });

  it('🔴 ห้ามมีชื่อระบบบนปุ่มหรือในคำอธิบาย (เจ้าของสั่งใช้คำที่บอกว่าได้อะไร)', () => {
    for (const x of ALL) {
      for (const text of [x.label, x.hint]) {
        expect(text.toLowerCase()).not.toContain('irecruit');
        expect(text.toLowerCase()).not.toContain('lumos');
      }
    }
  });

  it('ปุ่มที่ยิงสายจริงต้องมีคำว่า "โทร" · ปุ่มที่ไม่โทรต้องบอกว่าไม่โทร', () => {
    expect(SEARCH_LEGACY_POOL_AND_CALL.label).toContain('โทร');
    expect(SEARCH_ALL_POOLS_AND_CALL.label).toContain('โทร');
    expect(SEARCH_LEGACY_POOL.hint).toContain('ยังไม่โทร');
    expect(SEARCH_ALL_POOLS.hint).toContain('ไม่โทรหาใคร');
    // ปุ่มที่โทรต้องเตือนว่าเรียกคืนไม่ได้
    for (const x of [SEARCH_LEGACY_POOL_AND_CALL, SEARCH_ALL_POOLS_AND_CALL]) {
      expect(x.hint).toContain('เรียกคืนไม่ได้');
    }
  });

  it('🔴 ปุ่ม "ทุกกอง" สองตัวต้องแยกกันออกด้วยคำว่าโทร (บั๊กเดิม: ใช้คำเดียวกันทั้งที่ตัวหนึ่งยิงสาย)', () => {
    expect(SEARCH_ALL_POOLS.label).not.toBe(SEARCH_ALL_POOLS_AND_CALL.label);
    expect(SEARCH_ALL_POOLS.label).not.toContain('โทร');
  });

  it('เส้นที่ยิงสายจริงต้องมีขั้นยืนยันในโค้ด — ห้าม fetch(send:true) ตอนป๊อปเปิด', () => {
    const dialog = read('src/components/jobs/RecruitLaneDialog.tsx');
    expect(dialog, 'ต้องมีสเตตยืนยันก่อนยิง').toContain('confirmed');
    // effect ที่ยิงต้องมี confirmed เป็นเงื่อนไข
    expect(dialog).toMatch(/if \(!open \|\| !job \|\| !confirmed\) return;/);
  });

  it('สองปุ่มที่ไม่โทรต้องบอกขอบเขตของกองต่างกัน (กองเดียว vs ทุกกอง)', () => {
    expect(SEARCH_ALL_POOLS.label).toContain('ทุกกอง');
    expect(SEARCH_LEGACY_POOL.label).not.toContain('ทุกกอง');
  });

  it('ทุกจุดเรียกใช้ต้องอ้างค่าจากไฟล์นี้ — ห้ามพิมพ์คำเดิมค้างในหน้า', () => {
    const files = [
      'src/pages/matching/MatchingPage.tsx',
      'src/pages/jobs/UnitRequestTabPage.tsx',
      'src/components/jobs/JobBoardView.tsx',
    ];
    for (const f of files) {
      const src = read(f);
      /**
       * ตัดบรรทัดคอมเมนต์ออกก่อนตรวจ — คอมเมนต์ที่อ้างคำเดิมคือ **ประวัติที่ต้องเก็บ**
       * (อธิบายว่าปุ่มนี้เคยชื่ออะไรและทำไมเปลี่ยน) ที่ห้ามเหลือคือคำเดิมใน **JSX**
       */
      const codeOnly = src
        .split('\n')
        .filter((line) => !/^\s*(\{\/\*|\/\/|\/\*|\*)/.test(line))
        .join('\n');
      expect(codeOnly, `${f} ยังมีคำเดิม "หาคนเพิ่ม + ส่ง AI โทร" ใน JSX`).not.toContain(
        'หาคนเพิ่ม + ส่ง AI โทร',
      );
      expect(src, `${f} ต้อง import คำกลางจาก candidateSearchLabels`).toContain(
        'candidateSearchLabels',
      );
    }
  });
});

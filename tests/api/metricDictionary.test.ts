/**
 * เทสต์คุมพจนานุกรมเลข — "หนึ่งเมตริก หนึ่งนิยาม หนึ่งปลายทาง"
 *
 * 🔴 มาจาก audit มุมพนักงานใหม่ 26 ส.ค. 2569 ที่เดินจริงทุกหน้า แล้วพบว่าปัญหาที่
 * ทำร้ายคนใหม่หนักที่สุดคือ **เลขไม่ตรงกันข้ามจุด** (เจอ 9 จุดในรอบเดียว)
 * เทสต์ชุดนี้กันไม่ให้มีเลขใหม่โผล่ขึ้นหน้าแรกโดยไม่มีนิยาม/ไม่มีปลายทางที่ตรวจได้
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  METRICS,
  METRIC_KEYS,
  metricHelp,
  metricsWithLandingGap,
  type MetricKey,
  type MetricSpec,
} from '@/lib/metricDictionary';
import { CONVEYOR_BADGE_MEANING, CONVEYOR_BADGE_SHORT } from '@/lib/soRecruitNav';

const ROOT = path.resolve(__dirname, '../..');
const PANEL = path.join(ROOT, 'src/components/home/TeamBoardPanel.tsx');

describe('ทุกเลขบนหน้าแรกต้องอธิบายตัวเองได้', () => {
  it.each(METRIC_KEYS)('%s มีป้าย หน่วย และนิยามครบ', (key) => {
    const m: MetricSpec = METRICS[key];
    expect(m.label, 'label').toBeTruthy();
    expect(m.unit, 'unit').toBeTruthy();
    expect(m.what, 'what').toBeTruthy();
    // นิยามต้องเป็นประโยค ไม่ใช่คำเดียวซ้ำกับป้าย
    expect(m.what.length, `${key}.what สั้นเกินกว่าจะเป็นคำอธิบาย`).toBeGreaterThan(15);
    expect(m.what).not.toBe(m.label);
  });

  it('เมตริกที่กดได้ ต้องบอกได้ว่าไปเจอเลขนี้ตรงไหน — หรือยอมรับตรง ๆ ว่ายังไม่มี', () => {
    for (const key of METRIC_KEYS) {
      const m: MetricSpec = METRICS[key];
      if (!m.href && !m.opens) continue;
      const told = Boolean(m.landing) !== Boolean(m.landingGap);
      expect(told, `${key} ต้องมี landing หรือ landingGap อย่างใดอย่างหนึ่ง (ไม่ใช่ทั้งคู่/ไม่มีเลย)`).toBe(
        true,
      );
    }
  });

  it('เมตริกที่กดไม่ได้ ห้ามมี landing/landingGap ค้างไว้ให้สับสน', () => {
    for (const key of METRIC_KEYS) {
      const m: MetricSpec = METRICS[key];
      if (m.href || m.opens) continue;
      expect(m.landing, `${key}.landing`).toBeUndefined();
      expect(m.landingGap, `${key}.landingGap`).toBeUndefined();
    }
  });

  it('ปลายทางทุกอันเป็น path จริงในระบบ ไม่ใช่ที่แต่งขึ้น', () => {
    /** เส้นทางที่มีจริง (ตรวจจากตัว router/หน้าเพจ) — เพิ่มปลายทางใหม่ต้องมาเติมที่นี่ */
    const KNOWN = [
      '/jobs/list',
      '/jobs/board',
      '/matching/match',
      '/matching/job-postings',
      '/follow',
      '/aftercare',
    ];
    /** `?view=` ที่บอร์ดรับสมัครรองรับจริง (StaffJobBoardPage: RM_VIEWS + EXTRA_VIEWS) */
    const KNOWN_VIEWS = ['board', 'list', 'contact', 'appointments', 'postings'];
    for (const key of METRIC_KEYS) {
      const href = (METRICS[key] as MetricSpec).href;
      if (!href) continue;
      const [pathPart, query = ''] = href.split('?');
      expect(KNOWN, `${key} ชี้ไป ${pathPart} ซึ่งไม่อยู่ในรายการหน้าที่มีจริง`).toContain(pathPart);
      const view = new URLSearchParams(query).get('view');
      if (view) expect(KNOWN_VIEWS, `${key} ใช้ ?view=${view} ที่ไม่มีจริง`).toContain(view);
    }
  });

  it('metricHelp รวมนิยาม+ขอบเขต+ปลายทางไว้ก้อนเดียว และเตือนเมื่อปลายทางยังไม่มีเลข', () => {
    const withScope = metricHelp('online.unreleased');
    expect(withScope).toContain('ขอบเขต:');
    expect(withScope).toContain('กดแล้วไปที่:');
    expect(metricHelp('closing.queue_pending')).toContain('⚠ เลขนี้ยังไม่มีบนหน้าปลายทาง');
    // แถวอ่านอย่างเดียวไม่มีบรรทัดปลายทาง
    expect(metricHelp('lumos.cancelled')).not.toContain('กดแล้วไปที่:');
  });
});

/**
 * 🔴 ด่านกันคนพิมพ์ป้ายเองในตัววาด — ถ้าข้อนี้แดง แปลว่ามีเลขที่หลุดออกนอกพจนานุกรม
 * (ซึ่งคือวิธีที่ "นิยามที่สอง" งอกขึ้นมาทุกครั้ง)
 */
describe('TeamBoardPanel ต้องอ่านป้ายจากพจนานุกรมเท่านั้น', () => {
  const src = fs.readFileSync(PANEL, 'utf8');

  it('ไม่มี <Row label="..."> หรือ unit="..." หลงเหลือ', () => {
    expect(src).not.toMatch(/<Row[^>]*\slabel=/);
    expect(src).not.toMatch(/<Row[^>]*\sunit=/);
  });

  it('ไม่มี <Row to="..."> — ปลายทางมาจากพจนานุกรม ไม่ใช่พิมพ์ในตัววาด', () => {
    expect(src).not.toMatch(/<Row[^>]*\sto=/);
  });

  it('ทุก metric="..." ที่ตัววาดอ้าง มีอยู่จริงในพจนานุกรม', () => {
    const used = [...src.matchAll(/metric="([^"]+)"/g)].map((m) => m[1]);
    expect(used.length, 'ตัววาดต้องมีแถวเมตริกอยู่ — ถ้า 0 แปลว่าบอร์ดถูกยุบทิ้งอีกแล้ว').toBeGreaterThan(20);
    for (const key of used) {
      expect(METRIC_KEYS, `ตัววาดอ้าง metric="${key}" ที่ไม่มีในพจนานุกรม`).toContain(key as MetricKey);
    }
  });
});

describe('ป้ายเลขท้ายเมนูสายพาน', () => {
  it('ทุกขั้นมีคำอธิบายว่าเลขนั้นนับอะไร — เลขลอย ๆ คือที่มาของความงง', () => {
    for (const key of Object.keys(CONVEYOR_BADGE_MEANING) as Array<
      keyof typeof CONVEYOR_BADGE_MEANING
    >) {
      expect(CONVEYOR_BADGE_MEANING[key].length, key).toBeGreaterThan(10);
      expect(CONVEYOR_BADGE_SHORT[key], `${key} ขาดป้ายสั้น`).toBeTruthy();
    }
  });

  it('คีย์ของคำอธิบายกับป้ายสั้นตรงกันเป๊ะ — ขาดข้างใดข้างหนึ่งไม่ได้', () => {
    expect(Object.keys(CONVEYOR_BADGE_MEANING).sort()).toEqual(
      Object.keys(CONVEYOR_BADGE_SHORT).sort(),
    );
  });
});

/**
 * ตัวชี้วัดหนี้ที่เหลือ — ไม่ใช่เทสต์ที่ต้องเขียว "เพราะเลข 0" แต่เป็น **เพดาน**
 * ที่ห้ามเพิ่ม · ทุกครั้งที่ทำปลายทางให้มีเลขจริงแล้ว ให้ลดตัวเลขนี้ลง
 */
describe('หนี้ที่เหลือ — เมตริกที่ปลายทางยังไม่มีเลขนั้น', () => {
  const CEILING = 1;
  it(`ต้องไม่เกิน ${CEILING} จุด และห้ามเพิ่มขึ้น`, () => {
    const gaps = metricsWithLandingGap();
    expect(gaps.length, `ยังเหลือ ${gaps.length} จุด: ${gaps.join(', ')}`).toBeLessThanOrEqual(
      CEILING,
    );
  });
});

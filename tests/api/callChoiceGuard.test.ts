// @vitest-environment node
/**
 * วงจร "กันชื่อดอง" (Phase 5.7-5.10) — ด่านที่ห้ามหลุด:
 *
 * 1. **เลขบนป้ายกับนาทีที่ worker ลงมือต้องเป็นชุดเดียวกัน** (CALL_CHOICE_HOURS)
 *    ไม่งั้นคนอ่านว่า "เหลือ 3 ชม." แต่ AI โทรไปแล้ว
 * 2. **ไม่มีของ = ไม่แจ้งเตือน** — ป้ายที่เด้งทุกวันด้วยเลข 0 คือขยะ (เจ้าของย้ำเรื่องนี้)
 * 3. **ข้อความเตือนต้องบอกว่าใครดอง** ไม่ใช่แค่จำนวนใบ (ประเด็นของเจ้าของคือคนเก็บแล้วไม่โทร)
 * 4. เงื่อนไข SQL ของ "ใครโดนถอด/ใครรอเลือก" ต้องมาจาก OVERVIEW_BUCKETS ที่เดียว
 */
import { describe, expect, it } from 'vitest';
import {
  CALL_CHOICE_HOURS,
  CALL_CHOICES,
  CLAIM_IDLE_HOURS,
  buildUnclaimNotice,
  choiceCountdown,
  idleDays,
  isCallChoice,
  unclaimDedupeKey,
} from '../../src/lib/callChoiceGuard.js';
import { OVERVIEW_BUCKETS } from '../../api/_lib/applicantOverviewSql.js';

const NOW = new Date('2569-08-23T10:00:00.000Z'.replace('2569', '2026'));

describe('เกณฑ์เวลา (เจ้าของเคาะ: 1 วันทั้งสองขั้น)', () => {
  it('ดองได้ 24 ชม. · เลือกวิธีโทรได้ 24 ชม.', () => {
    expect(CLAIM_IDLE_HOURS).toBe(24);
    expect(CALL_CHOICE_HOURS).toBe(24);
  });

  it('รับเฉพาะวิธีโทร 3 ค่าที่ตรงกับ CHECK ของ migration 104', () => {
    expect([...CALL_CHOICES]).toEqual(['manual', 'ai', 'auto_ai']);
    expect(isCallChoice('manual')).toBe(true);
    expect(isCallChoice('auto_ai')).toBe(true);
    expect(isCallChoice('sms')).toBe(false);
    expect(isCallChoice(null)).toBe(false);
  });
});

describe('ป้ายนับถอยหลัง', () => {
  it('ไม่มีเวลาอ้างอิง = null (ห้ามเดาเป็น 0 ชม. ซึ่งอ่านว่ากำลังจะส่งเดี๋ยวนี้)', () => {
    expect(choiceCountdown(null, NOW)).toBeNull();
    expect(choiceCountdown(undefined, NOW)).toBeNull();
    expect(choiceCountdown('ไม่ใช่วันที่', NOW)).toBeNull();
  });

  it('ถอดมา 4 ชม. → เหลือ 20 ชม. ยังไม่ครบกำหนด', () => {
    const at = new Date(NOW.getTime() - 4 * 3_600_000).toISOString();
    const cd = choiceCountdown(at, NOW);
    expect(cd).not.toBeNull();
    expect(cd!.hoursLeft).toBe(20);
    expect(cd!.overdue).toBe(false);
    expect(cd!.label).toContain('20 ชม.');
  });

  it('เหลือไม่ถึงชั่วโมงต้องไม่พูดว่า "0 ชม." เฉย ๆ', () => {
    const at = new Date(NOW.getTime() - (24 * 3_600_000 - 600_000)).toISOString();
    const cd = choiceCountdown(at, NOW);
    expect(cd!.hoursLeft).toBe(0);
    expect(cd!.overdue).toBe(false);
    expect(cd!.label).toContain('ไม่ถึง 1 ชม.');
  });

  it('ครบ 24 ชม.แล้ว = overdue (worker รอบถัดไปส่ง AI)', () => {
    const at = new Date(NOW.getTime() - 25 * 3_600_000).toISOString();
    const cd = choiceCountdown(at, NOW);
    expect(cd!.overdue).toBe(true);
    expect(cd!.hoursLeft).toBe(0);
  });
});

describe('idleDays', () => {
  it('นับวันเต็มที่ถูกดองไว้ · อนาคต/อ่านไม่ได้ = null', () => {
    expect(idleDays(new Date(NOW.getTime() - 3.5 * 86_400_000), NOW)).toBe(3);
    expect(idleDays(new Date(NOW.getTime() + 86_400_000), NOW)).toBeNull();
    expect(idleDays(null, NOW)).toBeNull();
  });
});

describe('ข้อความเตือนหัวหน้า', () => {
  it('ไม่มีใบ = ไม่แจ้งเตือน (ห้ามส่ง "0 ใบ")', () => {
    expect(buildUnclaimNotice([], NOW)).toBeNull();
  });

  it('บอกจำนวนใบ + ชื่อคนที่ดอง + อายุนานสุด', () => {
    const notice = buildUnclaimNotice(
      [
        { applicantName: 'ก', heldByName: 'คิว', days: 2 },
        { applicantName: 'ข', heldByName: 'คิว', days: 5 },
        { applicantName: 'ค', heldByName: 'กร', days: 1 },
      ],
      NOW,
    );
    expect(notice).not.toBeNull();
    expect(notice!.title).toContain('3 ใบ');
    expect(notice!.body).toContain('คิว 2 ใบ');
    expect(notice!.body).toContain('กร 1 ใบ');
    expect(notice!.body).toContain('5 วัน');
    // ต้องบอกทางไปต่อ ไม่ใช่แค่ด่า
    expect(notice!.body).toContain('เลือกวิธีโทร');
  });

  it('ไม่รู้ชื่อคนเก็บก็ยังเตือนได้ (ไม่หายไปเงียบ)', () => {
    const notice = buildUnclaimNotice([{ applicantName: 'ก', heldByName: null, days: null }], NOW);
    expect(notice!.body).toContain('ไม่ทราบชื่อ');
  });

  it('คนเยอะเกิน 3 คนยุบเป็น "และอีก N คน"', () => {
    const notice = buildUnclaimNotice(
      ['a', 'b', 'c', 'd', 'e'].map((n) => ({ applicantName: n, heldByName: n, days: 1 })),
      NOW,
    );
    expect(notice!.body).toContain('และอีก 2 คน');
  });

  it('คีย์กันซ้ำเป็นรายวัน — เตือนวันละครั้ง ไม่ใช่ทุกรอบ worker', () => {
    const a = unclaimDedupeKey(new Date('2026-08-23T01:00:00Z'));
    const b = unclaimDedupeKey(new Date('2026-08-23T23:00:00Z'));
    const c = unclaimDedupeKey(new Date('2026-08-24T01:00:00Z'));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('เงื่อนไขถัง (นิยามเดียวกับ worker — ห้ามนิยามซ้ำ)', () => {
  it('claimed_idle ต้องดู dial stamp ด้วย (เจ้าของ: "ไม่ stamp = ถอด")', () => {
    expect(OVERVIEW_BUCKETS.claimed_idle).toContain('dialed_last_at');
    // ความคืบหน้าต้องนับเฉพาะหลังเวลาเก็บ — ของก่อน claim ไม่นับแทน
    expect(OVERVIEW_BUCKETS.claimed_idle).toContain('>= a.claimed_at');
  });

  it('awaiting_call_choice = ถูกถอดแล้ว ยังไม่เลือก และไม่มีใครเก็บใหม่', () => {
    const cond = OVERVIEW_BUCKETS.awaiting_call_choice;
    expect(cond).toContain('a.unclaimed_at is not null');
    expect(cond).toContain('a.call_choice is null');
    // 🔴 ขาดข้อนี้ = worker ส่ง AI ทับคนที่เพิ่งกดเก็บไปโทรเอง
    expect(cond).toContain('a.claimed_by is null');
  });
});

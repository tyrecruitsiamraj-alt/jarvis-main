// @vitest-environment node
/**
 * แผงสรุปงานสรรหา (RM) — 9 ตัวเลขที่เจ้าของขอ 11 ส.ค. 2569
 *
 * หัวใจที่ต้องไม่พัง 3 อย่าง:
 *   1. "ไม่รับสาย" กับ "ติดต่อไม่ได้" ต้อง**ไม่ทับกัน** และรวมกับถังที่เหลือได้เท่ายอดจริง
 *   2. นับ **หัวคน** และเอา **ผลล่าสุดของแต่ละคน** ไม่ใช่นับแถว (คนเดียวถูกโทรหลายรอบ)
 *   3. ตัวหารเป็นศูนย์ต้องคืน null ไม่ใช่ 0% — "โทรแล้วไม่มีใครรับ" กับ "ยังไม่ได้โทร" คนละเรื่อง
 */
import { describe, expect, it } from 'vitest';

import {
  CONTACT_NO_ANSWER_REASONS,
  RECRUIT_FUNNEL_STEP_PRIMARY,
  CONTACT_UNREACHABLE_REASONS,
  EMPTY_RECRUIT_FUNNEL,
  RECRUIT_FUNNEL_TILES,
  contactFailBucket,
  funnelPercent,
  splitContactFailures,
} from '../../src/lib/recruitFunnel';
import {
  buildRecruitContactFailSql,
  buildRecruitFunnelSql,
} from '../../api/_lib/recruitFunnelSql.js';

describe('แบ่งถังเหตุผล "ติดต่อไม่สำเร็จ"', () => {
  it('สองชุดต้องไม่มีชื่อซ้ำกัน — ไม่งั้นเหตุผลเดียวถูกนับสองถัง', () => {
    const overlap = CONTACT_NO_ANSWER_REASONS.filter((n) =>
      (CONTACT_UNREACHABLE_REASONS as readonly string[]).includes(n),
    );
    expect(overlap).toEqual([]);
  });

  it('ชื่อจริงจาก recruit_master_reason ตกถังถูกตัว', () => {
    expect(contactFailBucket('ปิดเครื่อง')).toBe('noAnswer');
    expect(contactFailBucket('ไม่รับสาย')).toBe('noAnswer');
    expect(contactFailBucket('ติดต่อไม่ได้')).toBe('unreachable');
    expect(contactFailBucket('หมายเลขโทรศัพท์ผิด')).toBe('unreachable');
    // เหตุผลคัดออก — ไม่ใช่เรื่องโทรไม่ติด
    expect(contactFailBucket('ข้อมูลซ้ำ')).toBe('other');
    expect(contactFailBucket('อายุน้อย/มากไป')).toBe('other');
    expect(contactFailBucket('คุณสมบัติไม่ผ่าน')).toBe('other');
  });

  it('เหตุผลว่าง/null ตกถัง other ไม่หายไปจากยอด', () => {
    expect(contactFailBucket(null)).toBe('other');
    expect(contactFailBucket('')).toBe('other');
    expect(contactFailBucket('   ')).toBe('other');
  });

  it('ตัดช่องว่างหัวท้ายก่อนเทียบ — ข้อมูลจริงมีชื่อที่มีช่องว่างติดมา', () => {
    expect(contactFailBucket('  ติดต่อไม่ได้  ')).toBe('unreachable');
  });

  it('สามถังรวมกันต้องเท่ายอดทั้งหมดเสมอ (ไม่มีเหตุผลไหนหล่นหาย)', () => {
    const rows = [
      { reasonName: 'ติดต่อไม่ได้', count: 19555 },
      { reasonName: 'ข้อมูลซ้ำ', count: 16397 },
      { reasonName: 'ไม่มีงานจ้า', count: 5459 },
      { reasonName: 'อายุน้อย/มากไป', count: 4214 },
      { reasonName: 'ปิดเครื่อง', count: 1565 },
      { reasonName: 'หมายเลขโทรศัพท์ผิด', count: 1044 },
      { reasonName: null, count: 3 },
    ];
    const s = splitContactFailures(rows);
    expect(s.noAnswer).toBe(1565);
    expect(s.unreachable).toBe(19555 + 1044);
    expect(s.other).toBe(16397 + 5459 + 4214 + 3);
    expect(s.noAnswer + s.unreachable + s.other).toBe(s.total);
    expect(s.total).toBe(rows.reduce((a, r) => a + r.count, 0));
  });

  it('รายการว่าง = ศูนย์ทุกถัง ไม่ระเบิด', () => {
    expect(splitContactFailures([])).toEqual({ noAnswer: 0, unreachable: 0, other: 0, total: 0 });
  });
});

describe('สัดส่วนบนแผง', () => {
  it('คิดเป็น % ทศนิยมหนึ่งตำแหน่ง', () => {
    expect(funnelPercent(50, 200)).toBe(25);
    expect(funnelPercent(1, 3)).toBe(33.3);
  });

  it('ตัวหารศูนย์/ติดลบ/ไม่มี = null ไม่ใช่ 0', () => {
    expect(funnelPercent(0, 0)).toBeNull();
    expect(funnelPercent(5, null)).toBeNull();
    expect(funnelPercent(5, undefined)).toBeNull();
    expect(funnelPercent(5, -1)).toBeNull();
  });
});

describe('ตัวหารของแต่ละช่อง', () => {
  /**
   * ⚠️ บทเรียนจากการวัดของจริง: ตัวหารแบบ "เป็นทอด ๆ" ให้ % เกิน 100
   * (โทรไปแล้ว 304.7% ของกรอกมา · นัดสำเร็จ+ไม่สำเร็จ 111.6% ของรับสาย)
   * เพราะขั้นก่อนหน้าไม่ได้ครอบขั้นถัดไปจริง — ทุกช่องจึงหารด้วย "กรอกมา" ช่องเดียว
   */
  it('ทุกช่อง (ยกเว้นตัวตั้งต้น) หารด้วย "กรอกมา" — ห้ามหารเป็นทอด ๆ', () => {
    for (const t of RECRUIT_FUNNEL_TILES) {
      if (t.key === 'registered') continue;
      expect(t.ofKey).toBe('registered');
    }
  });

  it('"กรอกมา" เป็นตัวตั้งต้น ไม่มีตัวหาร', () => {
    expect(RECRUIT_FUNNEL_TILES.find((t) => t.key === 'registered')?.ofKey).toBeNull();
  });

  it('ทุกช่องบนแผงต้องมีคีย์อยู่จริงในยอด — ไม่มีช่องที่อ้างค่าที่ไม่มี', () => {
    for (const t of RECRUIT_FUNNEL_TILES) {
      expect(EMPTY_RECRUIT_FUNNEL).toHaveProperty(t.key);
      if (t.ofKey) expect(EMPTY_RECRUIT_FUNNEL).toHaveProperty(t.ofKey);
    }
  });

  it('ตัวเลขหน้าปกของแต่ละขั้นตอน ต้องเป็นช่องที่อยู่ในขั้นนั้นจริง', () => {
    for (const [step, key] of Object.entries(RECRUIT_FUNNEL_STEP_PRIMARY)) {
      const tile = RECRUIT_FUNNEL_TILES.find((t) => t.key === key);
      expect(tile, `primary ของ ${step}`).toBeTruthy();
      expect(tile?.step).toBe(step);
    }
  });

  it('ครบ 9 ตัวเลขที่เจ้าของสั่ง', () => {
    const keys = RECRUIT_FUNNEL_TILES.map((t) => t.key);
    for (const k of [
      'registered',
      'called',
      'contactSuccess',
      'noAnswer',
      'unreachable',
      'appointmentSuccess',
      'appointmentFailed',
      'showedUp',
      'noShow',
    ]) {
      expect(keys).toContain(k);
    }
  });
});

describe('คิวรีฝั่ง iRecruit', () => {
  it('ไม่มีช่วงวันที่ = ไม่มีเงื่อนไขวันที่ และไม่อ้างพารามิเตอร์เลย', () => {
    const sql = buildRecruitFunnelSql(false, false);
    expect(sql).not.toContain('@p_from');
    expect(sql).not.toContain('@p_to');
  });

  it('มีช่วงวันที่ = ต่อเงื่อนไขให้ทุกตาราง ไม่ใช่แค่ตารางแรก', () => {
    const sql = buildRecruitFunnelSql(true, true);
    for (const alias of ['rr', 'lc', 'c', 'a', 'f']) {
      expect(sql).toContain(`AND ${alias}.created_at >= @p_from`);
      expect(sql).toContain(`AND ${alias}.created_at < @p_to`);
    }
  });

  it('ขอบบนเป็นแบบ "น้อยกว่า" ไม่ใช่ "น้อยกว่าเท่ากับ" (กันนับวันสุดท้ายเกิน)', () => {
    expect(buildRecruitFunnelSql(false, true)).toContain('created_at < @p_to');
    expect(buildRecruitFunnelSql(false, true)).not.toContain('created_at <= @p_to');
  });

  it('ยอด "กรอกมา" รวม Lead (Lead ตีตราทีหลัง) แต่ไม่นับใบที่ถูกลบ', () => {
    const sql = buildRecruitFunnelSql(false, false);
    expect(sql).toContain('deleted_at IS NULL');
    // ตัดออกจากตัวตั้งต้นแล้วยอดขั้นถัดไปจะเกิน 100% — วัดของจริงมาแล้ว
    expect(sql).not.toContain('is_lead IS NULL');
    // แต่ต้องนับ Lead แยกมาให้ด้วย และใช้ฐานกรองเดียวกันเพื่อให้เทียบกันได้
    expect(sql).toContain("rr.is_lead = 1");
  });

  it('"โทรไปแล้ว" นับหัวคน ไม่ใช่จำนวนครั้งที่กดโทร', () => {
    expect(buildRecruitFunnelSql(false, false)).toContain('COUNT(DISTINCT lc.register_id)');
  });

  /**
   * ⚠️ กับดักที่เจอกับข้อมูลจริง: นับแถวตรง ๆ ได้ "นัดสำเร็จ + นัดไม่สำเร็จ = 111.6%"
   * เพราะคนเดียวถูกนัดหลายรอบ (ตารางมี seq) — ต้องเอาแถวล่าสุดต่อคนเท่านั้น
   */
  it('ผลติดต่อ/นัดหมาย/ติดตามนัด เอาแถวล่าสุดต่อคน (rn = 1)', () => {
    const sql = buildRecruitFunnelSql(false, false);
    for (const alias of ['c', 'a', 'f']) {
      expect(sql).toContain(`PARTITION BY ${alias}.register_id ORDER BY ${alias}.seq DESC`);
    }
    expect((sql.match(/rn = 1/g) ?? []).length).toBe(6);
    const failSql = buildRecruitContactFailSql(false, false);
    expect(failSql).toContain('PARTITION BY c.register_id');
    // ⚠️ ต้องกรอง rn = 1 ด้วย ไม่ใช่แค่คำนวณ ROW_NUMBER ทิ้งไว้เฉย ๆ
    // ไม่งั้นสามถังรวมกันแล้วไม่เท่าจำนวนคนที่ผลล่าสุดเป็น "ไม่สำเร็จ"
    expect(failSql).toContain('lc.rn = 1');
  });

  it('คู่สถานะของแต่ละขั้นตอนต้องครอบทุกแถว — ไม่มีสถานะแปลกปลอมหล่นหาย', () => {
    const sql = buildRecruitFunnelSql(false, false);
    // นัดหมาย: A กับ "ไม่ใช่ A"
    expect(sql).toContain("status = 'A'");
    expect(sql).toContain("status <> 'A'");
    // ติดตามนัด: A · C · ที่เหลือทั้งหมด (ข้อมูลจริงมีสถานะ 'R' โผล่มา 2 แถว)
    expect(sql).toContain("status NOT IN ('A', 'C')");
  });

  it('ทุกยอดล็อก owner = RM (ไม่ปนหน่วยงานอื่น)', () => {
    const sql = buildRecruitFunnelSql(false, false);
    /**
     * ทุกครั้งที่อ่านตาราง `recruit_*` ต้องมี owner ล็อกไว้ — เทียบจำนวนให้เท่ากันเป๊ะ
     * (ไม่นับ `FROM last_*` ซึ่งอ่านจาก CTE ที่ล็อก owner ไว้แล้ว)
     */
    const reads = sql.match(/FROM recruit_\w+/g) ?? [];
    const owners = sql.match(/owner = 'RM'/g) ?? [];
    expect(reads.length).toBe(6); // 3 CTE + register ×2 + logs_call
    expect(owners.length).toBe(reads.length);
    expect(buildRecruitContactFailSql(false, false)).toContain("owner = 'RM'");
  });

  it('คิวรีเหตุผลกรองเฉพาะผลไม่สำเร็จ และ join ชื่อเหตุผลมาให้ JS แบ่งถัง', () => {
    const sql = buildRecruitContactFailSql(false, false);
    // "ไม่ใช่สำเร็จ" ไม่ใช่ "= C" — ให้เข้าคู่กับยอด contactSuccess ที่ใช้ = 'A'
    expect(sql).toContain("lc.status <> 'A'");
    expect(sql).toContain('recruit_master_reason');
    expect(sql).toContain('GROUP BY m.name');
    // ⚠️ การแบ่งถังต้องไม่อยู่ใน SQL — ต้องอยู่ที่ recruitFunnel.ts ที่เดียว
    expect(sql).not.toContain('ไม่รับสาย');
    expect(sql).not.toContain('ติดต่อไม่ได้');
  });
});

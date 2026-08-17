import { describe, expect, it } from 'vitest';
import { summarizeLeadUpdate, type LeadUpdateResult } from '../../src/lib/recruitLead';
import { buildApplicationsListQuery } from '../../api/_handlers/job-applications';

const ok = (): LeadUpdateResult => ({ ok: true });
const fail = (message: string): LeadUpdateResult => ({ ok: false, message });

describe('summarizeLeadUpdate — ปัดเป็นชุดแล้วล้มบางใบต้องไม่ถูกกลบ', () => {
  it('สำเร็จหมด → บอกจำนวนตรง ๆ ไม่มีคำว่าไม่สำเร็จ', () => {
    const s = summarizeLeadUpdate([ok(), ok(), ok()], true);
    expect(s.ok).toBe(3);
    expect(s.failed).toBe(0);
    expect(s.message).toContain('3 รายการ');
    expect(s.message).not.toContain('ไม่สำเร็จ');
  });

  it('⚠️ ล้มบางใบ → ต้องบอกทั้งจำนวนที่ล้มและเหตุผลจริง', () => {
    const s = summarizeLeadUpdate(
      [ok(), fail('ไม่มีสิทธิ์เข้าถึงใบสมัครของแผนกอื่น'), ok()],
      true,
    );
    expect(s.ok).toBe(2);
    expect(s.failed).toBe(1);
    expect(s.message).toContain('ไม่สำเร็จ 1 รายการ');
    expect(s.message).toContain('แผนกอื่น');
  });

  it('เหตุผลซ้ำกันยุบเหลืออันเดียว (ปัด 20 ใบพลาดเหตุเดียวกัน ไม่ควรได้ 20 บรรทัด)', () => {
    const results = Array.from({ length: 20 }, () => fail('ต้องรัน migration 083 ก่อน'));
    const s = summarizeLeadUpdate(results, true);
    expect(s.failed).toBe(20);
    expect(s.message.match(/migration 083/g)?.length).toBe(1);
  });

  it('คำกริยาต้องสลับตามทิศทาง — เก็บกับเรียกคืนใช้ข้อความคนละอัน', () => {
    expect(summarizeLeadUpdate([ok()], true).message).toContain('เก็บเข้าคลังสำรอง');
    expect(summarizeLeadUpdate([ok()], false).message).toContain('เอาออกจากคลังสำรอง');
  });

  it('ล้มหมด → ok = 0 แต่ยังต้องมีเหตุผลให้อ่าน', () => {
    const s = summarizeLeadUpdate([fail('พัง'), fail('พัง')], false);
    expect(s.ok).toBe(0);
    expect(s.failed).toBe(2);
    expect(s.message).toContain('พัง');
  });
});

describe('buildApplicationsListQuery — Lead ไปแท็บการติดต่อ (เปลี่ยน 14 ส.ค. 2569)', () => {
  const base = { scopedJobIds: null, viewerId: 'u1' };

  it('⚠️ ลิสต์ปกติ (RmWorkspace) ต้อง **ส่ง Lead มาด้วย** (true) — client แบ่งไปแท็บการติดต่อ', () => {
    // เจ้าของสั่ง: "เก็บ Lead → รายชื่อไปอยู่ที่การติดต่อแทน" (เดิม Lead หายเข้าคลังสำรอง)
    // isInRmTab ฝั่งหน้าเว็บแบ่ง is_lead → contact · ถ้า server กรอง Lead ออก จะไม่มีมาแบ่ง
    expect(buildApplicationsListQuery({ ...base }).leadWhere).toBe('true');
    // ?lead=1 ยังใช้ได้ (ดูเฉพาะ Lead) เผื่อ bookmark เก่า
    expect(buildApplicationsListQuery({ ...base, leadView: true }).leadWhere).toBe('is_lead');
  });

  it('⚠️ เงื่อนไข Lead ต้องอยู่ใน SQL จริง ไม่ใช่แค่คืนค่ามาเฉย ๆ', () => {
    const q = buildApplicationsListQuery({ ...base });
    expect(q.sql).toContain('{{leadWhere}}');
  });

  it('⚠️ มุมมองรายใบ (dialog กล่องงาน) ก็ต้องซ่อน Lead — ปัดแล้วต้องหายทุกที่', () => {
    const q = buildApplicationsListQuery({ ...base, jobId: 'siamraj-sql:OPL1' });
    expect(q.leadWhere).toBe('not is_lead');
    expect(q.sql).toContain('{{leadWhere}}');
  });

  it('⚠️ เงื่อนไข Lead ต้องไม่กิน param — ไม่งั้น pg นับ param ไม่ตรงแล้ว endpoint ตาย 500', () => {
    // กับดักจริงของโปรเจกต์: 'bind message supplies N parameters'
    const withJob = buildApplicationsListQuery({ ...base, jobId: 'x' });
    expect(withJob.params).toHaveLength(1);
    const feed = buildApplicationsListQuery({ ...base });
    expect(feed.params).toHaveLength(1); // viewerId ของ claimWhere เท่านั้น
    const leadFeed = buildApplicationsListQuery({ ...base, leadView: true });
    expect(leadFeed.params).toHaveLength(1);
  });

  it('จำนวน $n สูงสุดที่ SQL อ้าง ต้องเท่ากับจำนวน param ที่ส่ง (ทุกชุดเงื่อนไข)', () => {
    const cases = [
      buildApplicationsListQuery({ ...base }),
      buildApplicationsListQuery({ ...base, leadView: true }),
      buildApplicationsListQuery({ ...base, jobId: 'x' }),
      buildApplicationsListQuery({
        ...base,
        scopedJobIds: new Set(['a']),
        viewerDepartment: 'LBD',
      }),
    ];
    for (const q of cases) {
      const filled = q.sql
        .replace(/\{\{claimWhere\}\}/g, q.claimWhere)
        .replace(/\{\{leadWhere\}\}/g, q.leadWhere);
      const refs = [...filled.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
      const max = refs.length ? Math.max(...refs) : 0;
      expect(max).toBe(q.params.length);
    }
  });
});

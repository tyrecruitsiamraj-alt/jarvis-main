// @vitest-environment node
/**
 * แท็กจำนวนคลิกหน้าสาธารณะ (เจ้าของถาม 3 ก.ย. 2569)
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. **ไม่เก็บว่าใครกด** — ห้ามมี ip / user-agent / cookie ในตารางหรือโค้ด
 * 2. **นับพลาดห้ามทำให้หน้าสมัครงานล้ม** — เส้นสาธารณะคืน 204 เสมอ
 * 3. **ห้ามนับการกดของเจ้าหน้าที่** ปนกับคนนอก (เลขจะโป่งจนอ่านไม่ได้)
 * 4. ห้ามใส่ CHECK บน `action` (ของเดิมโดนมาสองรอบ: source, result_scope)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('ตาราง 115', () => {
  const sql = read('migrations/115_public_page_clicks.sql');

  it('🔴 ไม่มีช่องที่บอกว่าใครกด', () => {
    // ตัดบรรทัดคอมเมนต์ออกก่อน — คอมเมนต์พูดถึง "ไม่เก็บ IP" ได้ แต่คอลัมน์ห้ามมี
    const cols = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    expect(cols).not.toMatch(/\bip\b|ip_address|user_agent|cookie|session/i);
  });

  it('เก็บยอดรายวัน (มีคอลัมน์ day + hits)', () => {
    expect(sql).toMatch(/day\s+date not null/);
    expect(sql).toMatch(/hits\s+integer not null/);
  });

  it('ไม่มี CHECK บน action', () => {
    expect(sql).not.toMatch(/action[^\n]*check/i);
  });

  it('มี unique index ให้ upsert บวกยอดเข้าแถวเดิม', () => {
    expect(sql).toMatch(/create unique index[^;]*public_page_clicks/i);
  });
});

describe('เส้นสาธารณะ /api/public/click', () => {
  const h = read('api/_handlers/public/click.ts');

  it('🔴 คืน 204 เสมอ แม้เขียนพลาด', () => {
    expect(h).toMatch(/status\(204\)/);
    // ไม่มีทางที่ error จะหลุดไปเป็น 500 ให้หน้าสมัครเห็น
    expect(h).toMatch(/\.catch\(\(\) => undefined\)/);
  });

  it('รับเฉพาะ POST + มีเพดานกันยิงถล่ม', () => {
    expect(h).toMatch(/method !== 'POST'/);
    expect(h).toMatch(/rateLimitOrReject/);
  });
});

describe('ฝั่งจอ', () => {
  it('🔴 หน้าเจ้าหน้าที่ไม่นับ — นับเฉพาะหน้าสาธารณะ', () => {
    const board = read('src/components/jobs/JobBoardView.tsx');
    expect(board).toMatch(/if \(!isStaff\) trackPublicClick\('open_apply'/);
  });

  it('ยิงแล้วลืม ไม่หน่วงปุ่มสมัคร', () => {
    const api = read('src/lib/publicClickApi.ts');
    expect(api).toMatch(/void fetch\('\/api\/public\/click'/);
    expect(api).toMatch(/keepalive: true/);
  });

  it('ชิปยอดคลิกขึ้นเฉพาะใบที่มีคนกดจริง (ไม่ขึ้น 0 ทุกใบ)', () => {
    const board = read('src/components/jobs/JobBoardView.tsx');
    expect(board).toMatch(/if \(!c \|\| c\.apply === 0\) return null;/);
  });
});

/**
 * 🔴 ปุ่ม "ส่งให้ AI" ของแผนที่ไม่เคยถึง Lumos (เจ้าของ 26 ต.ค. 2569 "ทำตาม Journey ผ่าน UI")
 * ส่งเฉพาะวันนั้น · ห้ามยิงยกเลิกแผนเก่า (DELETE แผนที่จบแล้ว = ยกเลิกแผนอื่นของเบอร์เดียวกัน)
 * วันที่มีแผนถึง Lumos แล้ว = ปฏิเสธ ให้ไปแก้ตารางแทน
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const follow = readFileSync('api/_handlers/follow.ts', 'utf8');
const dispatch = readFileSync('api/_lib/lumosDispatch.ts', 'utf8');
const body = follow.slice(follow.indexOf('async function pushFollowDay'), follow.indexOf('const STAFF_CALL_NOT_READY'));

describe('push_day', () => {
  it('ลงทะเบียน action และส่งแบบไม่ยกเลิกแผนเก่า', () => {
    expect(follow).toContain("if (action === 'push_day') return await pushFollowDay(req, res);");
    expect(body).toContain('skipCancelOld: true');
    expect(dispatch).toContain('input.skipCancelOld ? [] : oldRefs');
  });

  it('จำกัดวันเดียวกันตามเวลาไทย + ปฏิเสธเมื่อวันนั้นมีแผนถึง Lumos แล้ว', () => {
    expect(body).toContain("(f.scheduled_at at time zone 'Asia/Bangkok')::date = ($2::timestamptz at time zone 'Asia/Bangkok')::date");
    expect(body).toContain('day.some((d) => d.sent)');
    expect(body).toContain('409');
  });

  it('รายการติดตามบอกว่าแผนยังไม่ถึง Lumos', () => {
    expect(follow).toContain('as lumos_unsent');
    expect(follow).toContain('lumos_unsent: r.lumos_unsent === true');
  });
});

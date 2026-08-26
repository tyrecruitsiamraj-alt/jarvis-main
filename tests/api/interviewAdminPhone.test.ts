// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn() }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { resolveInterviewAdminPhone } = await import('../../api/_lib/interviewAdminPhone.js');

const mockDbQuery = vi.mocked(dbQuery);

describe('resolveInterviewAdminPhone', () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    delete process.env.LUMOS_ADMIN_PHONE_OVERRIDE;
  });

  it('ช่วงทดสอบ: มี LUMOS_ADMIN_PHONE_OVERRIDE ตั้งไว้ → คืนเบอร์นั้นเสมอ ไม่แตะ DB เลย', async () => {
    process.env.LUMOS_ADMIN_PHONE_OVERRIDE = '+66614134269';
    const phone = await resolveInterviewAdminPhone('DS5812003');
    expect(phone).toBe('+66614134269');
    expect(mockDbQuery).not.toHaveBeenCalled();
  });

  it('override เป็นเบอร์ไทยรูปแบบ 0xxxxxxxxx ก็ normalize เป็น +66 ให้เอง', async () => {
    process.env.LUMOS_ADMIN_PHONE_OVERRIDE = '0812345678';
    expect(await resolveInterviewAdminPhone(null)).toBe('+66812345678');
  });

  it('ไม่มี override: ใช้เบอร์เจ้าหน้าที่สรรหาที่รับผิดชอบใบขอ ถ้ามีเบอร์ในระบบ', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ recruiter_name: 'สมหญิง', screener_name: 'สมชาย' }] } as never)
      .mockResolvedValueOnce({ rows: [{ phone: '0891112222' }] } as never);
    const phone = await resolveInterviewAdminPhone('DS5812003');
    expect(phone).toBe('+66891112222');
    expect(mockDbQuery).toHaveBeenCalledTimes(2);
  });

  it('เจ้าหน้าที่สรรหาไม่มีเบอร์ → fallback ไปเจ้าหน้าที่คัดสรร', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ recruiter_name: 'สมหญิง', screener_name: 'สมชาย' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never) // recruiter ไม่พบ user ที่มีเบอร์
      .mockResolvedValueOnce({ rows: [{ phone: '0822223333' }] } as never); // screener พบ
    const phone = await resolveInterviewAdminPhone('DS5812003');
    expect(phone).toBe('+66822223333');
  });

  it('ไม่มี assignment ของใบขอนี้เลย → สุ่มเบอร์จาก supervisor', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [] } as never) // ไม่มีแถว assignment
      .mockResolvedValueOnce({ rows: [{ phone: '0899998888' }] } as never); // random supervisor
    const phone = await resolveInterviewAdminPhone('NOT-ASSIGNED');
    expect(phone).toBe('+66899998888');
  });

  it('requestNo เป็น null (ไม่ทราบว่างานมีคนเกี่ยวข้องไหม) → สุ่มเบอร์จาก supervisor ตรง ๆ', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ phone: '0899998888' }] } as never);
    const phone = await resolveInterviewAdminPhone(null);
    expect(phone).toBe('+66899998888');
    expect(mockDbQuery).toHaveBeenCalledTimes(1);
  });

  it('ทั้งผู้รับผิดชอบและ supervisor ไม่มีเบอร์เลย → คืน null (ไม่ส่งเบอร์มั่วไป)', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ recruiter_name: 'สมหญิง', screener_name: null }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const phone = await resolveInterviewAdminPhone('DS5812003');
    expect(phone).toBeNull();
  });
});

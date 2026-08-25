/**
 * GET/PATCH /api/unit-sector — ประเภทหน่วยงาน ราชการ/เอกชน ที่ทีมระบุเอง
 * (migration 108 · เจ้าของเคาะ 25 ส.ค. 2569: *"2 ตัว เดี๋ยว User มาเลือกเอง"*)
 *
 * GET   → { sectors: { [site_code]: 'government' | 'private' } } ทั้งหมด (ตารางเล็ก 138 แถว)
 * PATCH { site_code, sector }  → บันทึก · `sector: null` = ล้างค่ากลับไป "ยังไม่ระบุ"
 *
 * 🔴 กติกาของเส้นนี้:
 * 1. **ค่ามั่วต้อง 400 ห้ามเงียบ** — `normalizeUnitSector` แยก `undefined` (มั่ว) ออกจาก
 *    `null` (ล้างค่า) ให้แล้ว · ถ้าปล่อยผ่าน ค่ามั่วจะกลายเป็นการลบของที่ทีมระบุไว้
 * 2. **ไม่มีแถว = ยังไม่ระบุ** ห้ามเติม default ให้ฝั่งไหน
 * 3. คีย์เป็น `site_code` (หน่วยงาน) ไม่ใช่เลขที่ใบขอ — 293 ใบมาจาก 138 หน่วยงาน
 * 4. ครอบ `withAuth` เฉย ๆ เหมือน `/api/siamraj-unit-notes` (ข้อมูลระดับหน่วยงาน ไม่ใช่ข้อมูลบุคคล)
 */
import { sendError, withAuth, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { normalizeUnitSector, type UnitSector } from '@/lib/unitSector';

const TABLE = tableInAppSchema('unit_sector');

type Row = { site_code: string; sector: UnitSector };

async function readAll(): Promise<Record<string, UnitSector>> {
  const { rows } = await dbQuery<Row>(`select site_code, sector from ${TABLE}`);
  const out: Record<string, UnitSector> = {};
  for (const r of rows) {
    const code = String(r.site_code ?? '').trim();
    if (code) out[code] = r.sector;
  }
  return out;
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      return res.status(200).json({ sectors: await readAll() });
    }

    if (method === 'PATCH') {
      const body = (req.body ?? {}) as { site_code?: unknown; sector?: unknown };
      const siteCode = String(body.site_code ?? '').trim();
      if (!siteCode) return sendError(res, 400, 'site_code is required');

      const sector = normalizeUnitSector(body.sector);
      // 🔴 undefined = ค่ามั่ว → ปฏิเสธ · null = ตั้งใจล้างค่า → ลบแถว
      if (sector === undefined) {
        return sendError(res, 400, "sector must be 'government', 'private' or null");
      }

      if (sector === null) {
        await dbQuery(`delete from ${TABLE} where site_code = $1`, [siteCode]);
        return res.status(200).json({ site_code: siteCode, sector: null });
      }

      await dbQuery(
        `insert into ${TABLE} (site_code, sector, updated_by, updated_by_name, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (site_code) do update
            set sector = excluded.sector,
                updated_by = excluded.updated_by,
                updated_by_name = excluded.updated_by_name,
                updated_at = now()`,
        // ⚠️ JwtUserPayload มีแค่ sub/email/role — ไม่มี id/full_name (แพตเทิร์นเดียวกับ
        //    aftercare.ts และ selection-progress.ts ที่เก็บ sub + email)
        [siteCode, sector, req.user?.sub ?? null, req.user?.email ?? null],
      );
      return res.status(200).json({ site_code: siteCode, sector });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (err) {
    return handleApiError(res, err, 'unit-sector');
  }
}

export default withAuth(handler);

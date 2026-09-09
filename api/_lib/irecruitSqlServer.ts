import sql from 'mssql';
import {
  parseSqlServerEndpoint,
  type SiamrajSqlServerConfig,
} from './siamrajSqlServer.js';

/**
 * ═══ สวิตช์ปิดการเชื่อม iRecruit (เจ้าของสั่ง 9 ก.ย. 2569) ═══
 *
 * > *"หยุดเชื่อมกับ iRecruit ก่อนได้ไหม จะเชื่อมใหม่แล้วเดี๋ยวบอก"*
 *
 * ปิดด้วย `IRECRUIT_ENABLED=false` — **ไม่ต้องลบรหัสผ่าน/โฮสต์ทิ้ง** จะได้เปิดกลับได้ทันที
 * (ลบ env ทิ้งแล้วเวลาจะต่อใหม่ต้องไปตามหาค่ามาใส่ใหม่ทั้งชุด)
 *
 * ปิดแล้วเกิดอะไร: `getIrecruitSqlServerConfig()` คืน `null` เหมือนตอน "ยังไม่ได้ตั้งค่า"
 * ซึ่งเป็นสภาพที่ทุกทางเข้ารองรับอยู่แล้ว — ตอบ 503 พร้อมข้อความไทย ไม่ใช่จอพัง
 * (`recruit-registrations` · `matching-irecruit-candidates` · `lumos-dispatch`
 *  และ `recruit-registrations?meta=1` จะรายงาน `enabled: false`)
 *
 * ⚠️ ไม่มี worker เบื้องหลังตัวไหนยิง iRecruit เอง (ตรวจแล้ว 9 ก.ย. 2569 —
 * `matchPrecomputeWorker` ใช้เฉพาะผู้สมัครบนบอร์ด) ปิดแล้วจึงไม่มีสายค้างวิ่งอยู่
 *
 * ค่าที่ถือว่า "ปิด": `false` `0` `off` `no` (ไม่ตั้งค่า = เปิดตามเดิม)
 */
export function isIrecruitEnabled(): boolean {
  const v = (process.env.IRECRUIT_ENABLED ?? '').trim().toLowerCase();
  if (v === '') return true;
  return !['false', '0', 'off', 'no'].includes(v);
}

/**
 * เหตุผลที่ใช้ iRecruit ไม่ได้ตอนนี้ — `null` = ใช้ได้ปกติ
 *
 * มีไว้เพราะสองเหตุนี้ **แก้คนละทาง** และถ้าบอกผิดคนจะไปตามหาของที่ไม่ได้หาย:
 *   ปิดสวิตช์ = ตั้งใจปิด · ค่าเชื่อมต่อครบอยู่
 *   ไม่มี config = ยังไม่ได้ใส่ค่าบนเซิร์ฟเวอร์
 */
export function irecruitUnavailableReason(): string | null {
  if (!isIrecruitEnabled()) {
    return 'ปิดการเชื่อม iRecruit ไว้ชั่วคราวตามที่สั่ง (IRECRUIT_ENABLED=false) — ค่าเชื่อมต่อยังอยู่ครบ เปิดกลับได้ทันที';
  }
  if (!getIrecruitSqlServerConfig()) {
    return 'ตั้งค่า IRECRUIT_DB_HOST / IRECRUIT_DB_USER / IRECRUIT_DB_NAME บนเซิร์ฟเวอร์ก่อน';
  }
  return null;
}

export function getIrecruitSqlServerConfig(): SiamrajSqlServerConfig | null {
  // 🔴 ปิดสวิตช์ = เหมือนยังไม่ได้ตั้งค่า — ห้ามต่อฐานแม้ env ครบ
  if (!isIrecruitEnabled()) return null;
  const explicitHost = (process.env.IRECRUIT_DB_HOST || '').trim();
  const useMainDb =
    !explicitHost && (process.env.DB_NAME || '').trim().toLowerCase() === 'irecruit';

  const hostRaw = explicitHost || (useMainDb ? (process.env.DB_HOST || '').trim() : '');
  const user = (
    process.env.IRECRUIT_DB_USER ||
    (useMainDb ? process.env.DB_USER : '') ||
    ''
  ).trim();
  const password =
    process.env.IRECRUIT_DB_PASSWORD ??
    (useMainDb ? process.env.DB_PASSWORD : '') ??
    '';
  const database = (
    process.env.IRECRUIT_DB_NAME ||
    (useMainDb ? process.env.DB_NAME : '') ||
    'irecruit'
  ).trim();

  if (!hostRaw || !user || !database) return null;

  const { server, port } = parseSqlServerEndpoint(
    hostRaw,
    process.env.IRECRUIT_DB_PORT || (useMainDb ? process.env.DB_PORT : undefined),
  );

  return {
    user,
    password,
    server,
    database,
    port,
    encrypt: (process.env.IRECRUIT_DB_ENCRYPT || process.env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate:
      (process.env.IRECRUIT_DB_TRUST_SERVER_CERTIFICATE || process.env.DB_TRUST_SERVER_CERTIFICATE || 'true')
        .toLowerCase() !== 'false',
  };
}

const globalForMssql = globalThis as unknown as { __jarvisIrecruitMssqlPool?: sql.ConnectionPool };

export async function getIrecruitSqlServerPool(): Promise<sql.ConnectionPool> {
  const cfg = getIrecruitSqlServerConfig();
  if (!cfg) {
    throw new Error(
      isIrecruitEnabled()
        ? 'Missing IRECRUIT_DB_HOST / IRECRUIT_DB_USER / IRECRUIT_DB_NAME for SQL Server'
        : 'ปิดการเชื่อม iRecruit อยู่ (IRECRUIT_ENABLED=false) — เปิดกลับด้วยการลบตัวแปรนี้หรือตั้งเป็น true',
    );
  }

  if (globalForMssql.__jarvisIrecruitMssqlPool?.connected) {
    return globalForMssql.__jarvisIrecruitMssqlPool;
  }

  try {
    const pool = new sql.ConnectionPool({
      user: cfg.user,
      password: cfg.password,
      server: cfg.server,
      database: cfg.database,
      port: cfg.port,
      options: {
        encrypt: cfg.encrypt,
        trustServerCertificate: cfg.trustServerCertificate,
      },
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
      connectionTimeout: 30000,
      requestTimeout: 60000,
    });
    await pool.connect();

    globalForMssql.__jarvisIrecruitMssqlPool = pool;
    return pool;
  } catch (e) {
    globalForMssql.__jarvisIrecruitMssqlPool = undefined;
    throw e;
  }
}

export async function irecruitSqlQuery<T>(
  queryText: string,
  inputs?: Record<string, unknown>,
): Promise<T[]> {
  const pool = await getIrecruitSqlServerPool();
  const req = pool.request();
  if (inputs) {
    for (const [key, value] of Object.entries(inputs)) {
      req.input(key, value);
    }
  }
  const result = await req.query<T>(queryText);
  return result.recordset;
}

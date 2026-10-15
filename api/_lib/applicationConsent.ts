/**
 * จดความยินยอม PDPA ของใบสมัคร (148 · เจ้าของ 15 ต.ค. 2569) — ข้อความ/ฉบับอยู่ `src/lib/pdpaConsent.ts`
 * 🔴 จดไม่สำเร็จห้ามทำให้ใบสมัครที่บันทึกแล้วล้ม (ยังไม่รัน 148 = เตือนใน log) · ใบเดิมมีแล้ว = ไม่ทับ (เวลาแรกที่ยินยอม)
 */
import { dbQuery } from './postgres.js';
import { logError } from './logger.js';
import { tableInAppSchema } from './schema.js';
import { PDPA_CONSENT_VERSION, type PdpaConsentSource } from '../../src/lib/pdpaConsent.js';

export async function recordApplicationConsent(
  ids: readonly string[],
  source: PdpaConsentSource,
  recordedBy: string | null,
): Promise<void> {
  const keys = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  if (keys.length === 0) return;
  try {
    await dbQuery(
      `insert into ${tableInAppSchema('app_application_consents')} (application_id, source, version, recorded_by)
       select unnest($1::uuid[]), $2, $3, $4
       on conflict (application_id) do nothing`,
      [keys, source, PDPA_CONSENT_VERSION, recordedBy],
    );
  } catch (e) {
    logError('application-consent.record failed (ยังไม่รัน migration 148?)', e, { count: keys.length, source });
  }
}

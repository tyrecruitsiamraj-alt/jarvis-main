/** ประเภทสัญญาจาก Siamraj `ms_site.contract_type_code` → `st_ms_contract_type` */

export type SiamrajContractTypeCode = 'B' | 'C' | 'D';

export const SIAMRAJ_CONTRACT_TYPES: {
  code: SiamrajContractTypeCode;
  name: string;
  shortName: string;
}[] = [
  { code: 'D', name: 'คนอย่างเดียว', shortName: 'คนอย่างเดียว' },
  { code: 'B', name: 'คน+รถ', shortName: 'คน+รถ' },
  { code: 'C', name: 'รถอย่างเดียว', shortName: 'รถอย่างเดียว' },
];

/**
 * "Cls" ในระบบ Siamraj = รหัสประเภทสัญญา **C** (รถอย่างเดียว)
 * เก็บที่ `ms_site.contract_type_code` อ้างอิง `st_ms_contract_type`
 */
export const SIAMRAJ_CLS_CONTRACT_TYPE_CODE: SiamrajContractTypeCode = 'C';

export const SIAMRAJ_CLS_INFO = {
  title: 'Cls คืออะไร?',
  summary:
    'Cls หมายถึงประเภทสัญญา C (รถอย่างเดียว) ใน Siamraj — หน่วยงานที่สัญญาเป็นแบบจ้างเฉพาะรถ ไม่ใช่จ้างคนขับในสัญญา',
  field: 'ms_site.contract_type_code',
  masterTable: 'st_ms_contract_type',
  jarvisPolicy:
    'Jarvis แสดงเฉพาะใบขอที่ยังต้องหาคน — ไม่รวมหน่วยงานสัญญา C (Cls), ใบที่มีเลขปิด CLS, หรือใบที่แจ้งเข้าแล้ว',
};

export function isSiamrajClsContractType(code?: string | null): boolean {
  return (code || '').trim().toUpperCase() === SIAMRAJ_CLS_CONTRACT_TYPE_CODE;
}

export function contractTypeLabel(code?: string | null): string | undefined {
  const c = (code || '').trim().toUpperCase();
  return SIAMRAJ_CONTRACT_TYPES.find((t) => t.code === c)?.name;
}

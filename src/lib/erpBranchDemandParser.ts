/** Re-export สำหรับใช้ parse ฝั่ง UI โดยไม่ต้องรอ API */
export {
  buildErpBranchDemandInput,
  parseErpBranchDemand,
  type ParsedBranchDemandItem,
  type ParsedBranchDemandResult,
} from '../../api/_lib/erpBranchDemandParser';

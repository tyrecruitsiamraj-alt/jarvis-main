import { TONE, type ToneKey } from '@/lib/designTokens';
import { screeningVerdicts, type CandidateScreening } from '@/lib/candidatePriority';
import {
  ageVerdict,
  areaVerdict,
  genderVerdict,
  normText,
  salaryVerdict,
  type CheckVerdict,
} from '@/lib/candidateVerdicts';
import type { MatchTier } from '@/lib/boardCandidateTypes';
import type { JobRequest } from '@/types';

/**
 * ชิปผลตรวจคุณสมบัติผู้สมัครเทียบใบขอ — แยกจาก MatchingPage.tsx ตอนแตกไฟล์
 * ตรรกะการตัดสินอยู่ที่ `lib/candidateVerdicts.ts` ไฟล์นี้มีแต่การแสดงผล
 * (แยกสองชั้นเพราะ react-refresh ต้องการให้ไฟล์ component export แต่ component)
 *
 * ⚠️ ลำดับชิปไล่ตามลำดับความสำคัญที่เจ้าของกำหนด — ห้ามสลับตามใจ
 * อายุ → ที่อยู่ → ประสบการณ์ → เหล้า/บุหรี่ → คดี → รายได้ (เพศ/ใบขับขี่เป็นเกณฑ์ใบขอ อยู่ท้าย)
 */

/** ผลเช็คคุณสมบัติรายข้อ — โทนกลาง: ผ่าน=เขียว · ต้องดู=เหลือง · ไม่ผ่าน=แดง · ไม่รู้=เทา */
const CHECK_META: Record<CheckVerdict, { icon: string; tone: ToneKey }> = {
  pass: { icon: '✓', tone: 'success' },
  warn: { icon: '!', tone: 'warn' },
  fail: { icon: '×', tone: 'danger' },
  unknown: { icon: '?', tone: 'neutral' },
};

export function CheckChip({ label, verdict }: { label: string; verdict: CheckVerdict }) {
  const meta = CHECK_META[verdict];
  return (
    <span className={TONE[meta.tone].chip}>
      {label} {meta.icon}
    </span>
  );
}

export default function CandidateChecklist({
  job,
  tier,
  sex,
  age,
  areaParts,
  salary,
  licenses,
  screening,
}: {
  job: JobRequest;
  tier: MatchTier;
  sex?: string | null;
  age?: number | null;
  areaParts: Array<string | null | undefined>;
  salary?: number | null;
  licenses?: string[];
  /** ผลคัดกรองที่เจ้าหน้าที่บันทึกไว้ — ไม่มี = ยังไม่ถูกถาม ชิปจะไม่โชว์ */
  screening?: CandidateScreening | null;
}) {
  const position: CheckVerdict = tier === 'green' ? 'pass' : tier === 'yellow' ? 'warn' : 'fail';
  const requiresLicense = Boolean(job.vehicle_required && normText(job.vehicle_required) !== 'ไม่ระบุ');
  const license: CheckVerdict = requiresLicense
    ? licenses == null
      ? 'unknown'
      : licenses.length > 0
        ? 'pass'
        : 'warn'
    : 'unknown';
  // สองชิปคัดกรองโชว์เฉพาะเมื่อมีคนบันทึกไว้แล้ว — ยังไม่ถาม = ไม่โชว์ ไม่ใช่โชว์เทา
  const screened = screening ? screeningVerdicts(screening) : {};
  return (
    <div className="flex flex-wrap gap-1" aria-label="ผลตรวจคุณสมบัติเบื้องต้น">
      <CheckChip label="อายุ" verdict={ageVerdict(job, age)} />
      <CheckChip label="ที่อยู่" verdict={areaVerdict(job, areaParts)} />
      <CheckChip label="ประสบการณ์" verdict={position} />
      {screened.lifestyle && screened.lifestyle !== 'unknown' ? (
        <CheckChip label="เหล้า/บุหรี่" verdict={screened.lifestyle} />
      ) : null}
      {screened.criminalRecord && screened.criminalRecord !== 'unknown' ? (
        <CheckChip label="ประวัติคดี" verdict={screened.criminalRecord} />
      ) : null}
      {salary !== undefined ? <CheckChip label="รายได้" verdict={salaryVerdict(job, salary)} /> : null}
      <CheckChip label="เพศ" verdict={genderVerdict(job.gender_requirement, sex)} />
      {requiresLicense ? <CheckChip label="ใบขับขี่" verdict={license} /> : null}
    </div>
  );
}

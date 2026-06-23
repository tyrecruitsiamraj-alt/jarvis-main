import React from 'react';
import { ChevronDown, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DRIVER_CARE_RISK_LABELS } from '@/types/driverCare';

type CriterionRow = { condition: string; score: string };

type CriterionBlock = {
  title: string;
  cap: string;
  source: string;
  rows: CriterionRow[];
  note?: string;
};

export const DRIVER_CARE_SCORING_CRITERIA: CriterionBlock[] = [
  {
    title: 'รายได้ (Income Risk)',
    cap: 'สูงสุด 45 คะแนน',
    source: 'driver_income_monthly — 3 เดือนล่าสุด',
    rows: [
      { condition: 'รายได้ลด < 5% เทียบค่าเฉลี่ย 2 เดือนก่อน', score: '0' },
      { condition: 'รายได้ลด 5–9.99%', score: '+10' },
      { condition: 'รายได้ลด 10–19.99%', score: '+25' },
      { condition: 'รายได้ลด ≥ 20%', score: '+40' },
      { condition: 'OT ลด ≥ 30% เทียบค่าเฉลี่ย 2 เดือนก่อน', score: '+15 (รวมไม่เกิน 45)' },
    ],
  },
  {
    title: 'การลา (Leave Risk)',
    cap: 'สูงสุด 45 คะแนน',
    source: 'work_calendar — สถานะ day_off, cancel_by_employee (90 วัน)',
    rows: [
      { condition: 'วันลาเพิ่ม 30–49.99% เทียบค่าเฉลี่ยรายเดือน 60 วันก่อน', score: '+10' },
      { condition: 'วันลาเพิ่ม 50–99.99%', score: '+20' },
      { condition: 'วันลาเพิ่ม ≥ 100%', score: '+35' },
      { condition: 'ลาติดต่อกัน 2 วัน', score: '+15' },
      { condition: 'ลาติดต่อกัน ≥ 3 วัน', score: '+25' },
    ],
  },
  {
    title: 'การมาทำงาน (Attendance Risk)',
    cap: 'สูงสุด 40 คะแนน',
    source: 'work_calendar — 30 วันล่าสุด',
    rows: [
      { condition: 'มาสาย (late) ≥ 3 ครั้ง', score: '+10' },
      { condition: 'No-show ≥ 1 ครั้ง', score: '+30' },
      { condition: 'ยกเลิกโดยพนักงาน (cancel_by_employee) ≥ 2 ครั้ง', score: '+20' },
    ],
  },
  {
    title: 'ข้อร้องเรียน (Complaint Risk)',
    cap: 'สูงสุด 50 คะแนน',
    source: 'driver_complaint_event — 60 วันล่าสุด',
    rows: [
      { condition: 'client_complaint หรือ driver_complaint', score: '+20 ต่อเหตุการณ์' },
      { condition: 'request_transfer หรือ request_change_driver', score: '+30 ต่อเหตุการณ์' },
      { condition: 'เหตุการณ์ซ้ำ ≥ 2 ครั้งในช่วงเวลา', score: '+25' },
    ],
  },
  {
    title: 'ไซต์งาน (Assignment Risk)',
    cap: 'สูงสุด 10 คะแนน',
    source: 'work_calendar — client/site',
    rows: [
      { condition: 'ไซต์มีคนขับเสี่ยงสูง > 2 คน หรือเสี่ยงกลาง+ > 4 คน', score: '+10' },
    ],
    note: 'คำนวณรอบที่ 2 หลังประเมินคนขับทั้งหมดในวันนั้น',
  },
  {
    title: 'Pattern ลาออก (Pattern Risk)',
    cap: 'สูงสุด 25 คะแนน',
    source: 'driver_resignation_history เทียบกับสัญญาณปัจจุบัน',
    rows: [
      { condition: 'มี Income Risk และประวัติลาออกกลุ่มรายได้', score: '+15' },
      { condition: 'มี Leave Risk และประวัติลาออก workload/personal/unknown', score: '+10' },
      { condition: 'มีทั้ง Income Risk และ Leave Risk พร้อมกัน', score: '+20' },
    ],
  },
];

export const DRIVER_CARE_LEVEL_THRESHOLDS = [
  { level: 'low' as const, range: '0 – 29', action: 'ติดตามตามรอบปกติ' },
  { level: 'watch' as const, range: '30 – 49', action: 'Supervisor ตรวจสอบเบื้องต้น' },
  { level: 'medium' as const, range: '50 – 69', action: 'HR/Operation ติดตามภายใน 7 วัน' },
  { level: 'high' as const, range: '70 – 100', action: 'HR/Operation โทรคุยภายใน 3 วัน และตรวจสอบรายได้/ไซต์งาน' },
];

const DriverCareScoringGuide: React.FC<{ defaultOpen?: boolean; className?: string }> = ({
  defaultOpen = false,
  className,
}) => {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <section className={cn('glass-card rounded-[1.5rem] border border-white/70 overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/30 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Scale className="w-4 h-4 text-orange-600 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">เกณฑ์การคิดคะแนนความเสี่ยง</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              รวมคะแนนทุกมิติ (สูงสุด 100) · กฎ v1
            </p>
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/50 pt-4">
          <div className="rounded-xl bg-muted/30 border border-border/50 p-3">
            <p className="text-xs font-medium text-foreground mb-2">สูตรรวม</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              คะแนนรวม = รายได้ + การลา + การมาทำงาน + ไซต์งาน + ข้อร้องเรียน + Pattern
              {' '}(จำกัดสูงสุด 100 คะแนน)
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-foreground mb-2">ระดับความเสี่ยง</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="text-left py-1.5 pr-2 font-medium">ระดับ</th>
                    <th className="text-left py-1.5 pr-2 font-medium">ช่วงคะแนน</th>
                    <th className="text-left py-1.5 font-medium">แนวทางติดตาม</th>
                  </tr>
                </thead>
                <tbody>
                  {DRIVER_CARE_LEVEL_THRESHOLDS.map((row) => (
                    <tr key={row.level} className="border-b border-border/30 last:border-0">
                      <td className="py-2 pr-2 font-medium text-foreground whitespace-nowrap">
                        {DRIVER_CARE_RISK_LABELS[row.level]}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap">{row.range}</td>
                      <td className="py-2 text-muted-foreground">{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            {DRIVER_CARE_SCORING_CRITERIA.map((block) => (
              <div key={block.title} className="rounded-xl border border-white/60 bg-white/35 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <h4 className="text-xs font-semibold text-foreground">{block.title}</h4>
                  <span className="text-[10px] font-medium text-orange-700 bg-orange-500/10 px-2 py-0.5 rounded-full">
                    {block.cap}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">แหล่งข้อมูล: {block.source}</p>
                <ul className="space-y-1">
                  {block.rows.map((row) => (
                    <li key={row.condition} className="flex justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{row.condition}</span>
                      <span className="font-semibold text-foreground shrink-0">{row.score}</span>
                    </li>
                  ))}
                </ul>
                {block.note ? (
                  <p className="text-[10px] text-muted-foreground mt-2 italic">{block.note}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default DriverCareScoringGuide;

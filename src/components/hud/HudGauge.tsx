/**
 * HudGauge — เกจวงแหวนบนแผง HUD (SVG ล้วน ไม่เพิ่ม lib)
 *
 * ใช้กับ "สัดส่วนที่คนต้องเห็นเป็นภาพ" เช่น ปล่อยลิงก์แล้วกี่ % ของใบที่ต้องหาคน
 * ⚠️ ห้ามใช้กับเลขที่ครอบเกือบทั้งบอร์ด — วงแหวนเต็ม/ว่างเกือบสุดอ่านไม่ได้ข้อมูลอะไร
 *    (บทเรียนเลข 271/283 ที่เจ้าของตีตก) ให้ใช้ HudStat แทน
 *
 * สีมาจาก `HUD_HEX` (เฉดสว่างของ TONE) เพราะ SVG รับ class ไม่ได้ และเฉดเข้มของ
 * `TONE[..].hex` จมหายไปกับพื้นแผง
 */
import * as React from 'react';

import { HUD, HUD_HEX, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

export type HudGaugeProps = {
  /** ค่าปัจจุบัน */
  value: number;
  /** ค่าเต็ม (0 หรือติดลบ = ถือว่าไม่มีข้อมูล วาดวงว่าง) */
  max: number;
  label: string;
  /** ข้อความกลางวง — ไม่ส่ง = โชว์เปอร์เซ็นต์ */
  center?: string;
  tone?: ToneKey;
  /** เส้นผ่านศูนย์กลาง (px) */
  size?: number;
  className?: string;
};

export const HudGauge: React.FC<HudGaugeProps> = ({
  value,
  max,
  label,
  center,
  tone = 'teal',
  size = 96,
  className,
}) => {
  const safeMax = max > 0 ? max : 0;
  const ratio = safeMax > 0 ? Math.min(1, Math.max(0, value / safeMax)) : 0;
  const pct = Math.round(ratio * 100);

  // วงแหวนเว้นช่องล่าง 90° (ทรง HUD ไม่ใช่โดนัทเต็มวง)
  const stroke = Math.max(5, Math.round(size * 0.075));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75;
  const color = HUD_HEX[tone];

  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label} ${pct}%`}
      >
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc * ratio} ${circumference}`}
          />
        </g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="font-mono text-sm font-semibold tabular-nums"
          fill={color}
        >
          {center ?? `${pct}%`}
        </text>
      </svg>
      <div className={cn(HUD.label, 'text-center')}>{label}</div>
    </div>
  );
};

export default HudGauge;

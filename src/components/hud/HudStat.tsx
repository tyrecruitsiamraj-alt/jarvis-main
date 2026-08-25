/**
 * HudStat — ช่องตัวเลขบนแผง HUD
 *
 * กติกาที่ฝังไว้ในนี้ (มาจากบทเรียนที่เจ้าของด่ามาแล้ว):
 * 1. **เลขต้องบอกหน่วยเสมอ** — "292" กับ "340" มาจากชุดเดียวกันแต่คนละหน่วย (ใบ vs อัตรา)
 *    เลขเปล่าในวงเล็บ = คนอ่านเดาหน่วยเอง แล้วสรุปว่าข้อมูลหาย (รอบยี่สิบห้า)
 * 2. **กดได้ต้องดูเหมือนกดได้** — มี `onClick` แล้วเรนเดอร์เป็น `<button>` จริง
 *    (ไม่ใช่ div ที่มี cursor-pointer) และมี hover ที่เห็นชัด
 * 3. **เรืองแสง = ต้องลงมือ** ไม่ใช่ของประดับ — `alert` ใส่เฉพาะช่องที่มีของค้างจริง
 */
import * as React from 'react';

import { HUD, HUD_HEX, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

export type HudStatProps = {
  /** ป้ายกำกับ (สั้น) */
  label: string;
  /** ตัวเลขหลัก — ส่งเป็น string ได้ถ้าจัดรูปแบบมาแล้ว */
  value: React.ReactNode;
  /** หน่วยของตัวเลข เช่น "ใบขอ" / "อัตรา" / "สาย" — **ควรใส่เสมอ** (กติกาข้อ 1) */
  unit?: string;
  /** บรรทัดล่างบอกที่มา/ส่วนย่อย */
  hint?: React.ReactNode;
  /** โทนของตัวเลข (จุดสีหน้า label ด้วย) */
  tone?: ToneKey;
  /** มีของค้างที่ต้องลงมือ → ขอบเรืองขึ้น (ใช้ให้น้อย) */
  alert?: boolean;
  /** กดแล้วเปิดรายชื่อจริง — ไม่มี onClick = ช่องอ่านเฉย ๆ */
  onClick?: () => void;
  /** ข้อความบอกว่ากดแล้วได้อะไร (อ่านด้วย screen reader / tooltip ของเบราว์เซอร์) */
  title?: string;
  className?: string;
};

export const HudStat: React.FC<HudStatProps> = ({
  label,
  value,
  unit,
  hint,
  tone = 'teal',
  alert = false,
  onClick,
  title,
  className,
}) => {
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: HUD_HEX[tone] }}
          aria-hidden
        />
        <span className={cn(HUD.label, 'truncate')}>{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={HUD.figure} style={{ color: HUD_HEX[tone] }}>
          {value}
        </span>
        {unit ? <span className={HUD.unit}>{unit}</span> : null}
      </div>
      {hint ? <div className={cn('mt-1', HUD.body, 'truncate')}>{hint}</div> : null}
    </>
  );

  const shell = cn(
    HUD.inner,
    'p-3 text-left',
    alert && 'ring-1 ring-inset',
    className,
  );
  const alertStyle = alert ? { boxShadow: `inset 0 0 0 1px ${HUD_HEX[tone]}55` } : undefined;

  if (!onClick) {
    return (
      <div className={shell} style={alertStyle} title={title}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? 'กดเพื่อดูรายชื่อ'}
      className={cn(shell, HUD.innerHover, 'w-full')}
      style={alertStyle}
    >
      {body}
    </button>
  );
};

export default HudStat;

/**
 * 3D Virtual Office — ห้องทำงานเสมือนบนหน้าแรก
 *
 * เจ้าของสั่ง 22 ส.ค. 2569: *"อยากให้หน้าหลักมีตัวละครแทนแต่ละแผนก มีโต๊ะทำงาน บอกว่า
 * แต่ละคนตอนนี้กำลังทำอะไร … พอเม้าไปจี้จะเห็นสถานะ"* → ต่อด้วย *"ทำให้เท่และดูทันสมัยกว่านี้"*
 * → เคาะสุดท้าย: *"มันคือ dashboard 3d virtual office"* ทำด้วย **CSS 3D ไม่เพิ่ม library**
 * และให้กล้อง **ขยับตามเมาส์เบา ๆ อัตโนมัติ** (ไม่ใช่ให้คนลากหมุนเอง)
 *
 * โครงสร้างที่เลือกและเหตุผล:
 * 1. **CSS 3D ไม่ใช่ WebGL** — ระบบนี้ยังไม่มี three.js เลย และหน้าแรกต้องเบา
 *    (three.js + R3F ≈ +180-220KB gzip) · CSS 3D ให้ perspective จริงโดยเพิ่ม 0 KB
 * 2. **ทุกอย่างเป็น DOM** — โต๊ะคือ `<button>` จริง → hover/กด/คีย์บอร์ด/screen reader
 *    ใช้ของ shadcn (`HoverCard`) ได้ตรง ๆ ไม่ต้องมีปุ่มโปร่งใสทับ canvas/SVG เหมือนรอบก่อน
 * 3. **ตัวหนังสือไม่เอียงตามพื้น** — โต๊ะ/คน/ป้ายเป็น "ป้ายตั้ง" ที่หมุนกลับด้วย
 *    `rotateX(-tilt)` จึงหันเข้ากล้องเสมอ อ่านออกทุกมุม (เทคนิค diorama · ดู index.css)
 * 4. **สถานะ/ประโยค/ผังห้อง/เส้นทางงาน มาจาก `src/lib/officeFloor.ts`** (pure + เทสต์)
 *    ไฟล์นี้ไม่ตัดสินอะไรเลย แค่วาด
 * 5. **มือถือไม่ใช้ฉาก** — 6 โต๊ะย่อลงจอ 375px แล้วป้ายเหลือ ~6px · เปลี่ยนเป็นรายการโต๊ะ
 *    ที่ข้อมูลเท่ากันทุกตัว (ไม่ตัดของทิ้ง ไม่ใช้เลื่อนซ้าย-ขวาที่เจ้าของสั่งเลิกไปแล้ว)
 * 6. **หยุดขยับเมื่อไม่ได้ดู** — แท็บซ่อน = ถอด class `jarvis-office-live`
 *    · `prefers-reduced-motion` = กล้องนิ่ง เส้นทางไม่วิ่ง ตัวละครไม่ขยับ (ข้อมูลยังครบ)
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import HudPanel from '@/components/hud/HudPanel';
import HudTicker, { type HudTickerItem } from '@/components/hud/HudTicker';
import { HUD, HUD_HEX, HUD_INK, HUD_SCENE } from '@/lib/designTokens';
import {
  OFFICE_BOARD,
  OFFICE_CORE,
  OFFICE_SLOTS,
  coreSpokeGeometry,
  desksNeedingAction,
  isDeskActive,
  officeHeadline,
  type Desk,
  type DeskId,
  type DeskState,
} from '@/lib/officeFloor';
import { cn } from '@/lib/utils';

/** ป้ายสั้นใต้โต๊ะ — ตัดคำว่า "โต๊ะ" ออกเพราะในฉากมันคือโต๊ะอยู่แล้ว */
const shortLabel = (label: string): string => label.replace(/^โต๊ะ\s*/, '');

/** ท่าทางตัวละครตามสถานะ (ชื่อ class อยู่ใน src/index.css) */
const POSE: Record<DeskState, string> = {
  idle: 'jarvis-office-walk',
  working: 'jarvis-office-type',
  calling: 'jarvis-office-call',
  blocked: 'jarvis-office-call',
  off: '',
};

/** มุมกล้องตั้งต้น — เอียงพอให้เห็นพื้นเป็นห้อง แต่ยังเห็นหน้าตัวละครเต็ม ๆ */
const CAMERA_BASE = { tilt: 56, spin: 0 } as const;
/** ระยะที่กล้องขยับตามเมาส์ได้ — เกินนี้เริ่มเวียนหัวและป้ายเริ่มเบียดกัน */
const CAMERA_RANGE = { tilt: 5, spin: 7 } as const;

/**
 * มาสคอตประจำทีม — หุ่นกลม ๆ ใส่ชุดสีของทีม (ตามภาพอ้างอิงที่เจ้าของส่งมา)
 *
 * ทำไมเปลี่ยนจาก "คนเส้น ๆ" เดิม: เจ้าของติว่าของเดิม *"บ้านนอกมาก"* — ตัวละครแบบ
 * เส้น/กล่องอ่านเป็นไดอะแกรม ไม่ใช่ตัวละคร · ทรงกลม + ตาโต + ไฮไลต์เงา ทำให้ดู
 * เป็นของที่ "มีชีวิต" โดยไม่ต้องพึ่ง 3D engine
 *
 * ⚠️ วาดในกรอบ 92×104 เสมอ · ผู้เรียกคุมขนาดด้วย `size` (ห้ามให้แต่ละที่วางพิกัดเอง
 * ไม่งั้นมาสคอตสูงไม่เท่ากันแล้วดูเหมือนคนละฉาก)
 */
const OfficeMascot: React.FC<{ state: DeskState; color: string; size: number }> = ({
  state,
  color,
  size,
}) => {
  const onCall = state === 'calling' || state === 'blocked';
  const shell = 'rgba(240, 248, 255, 0.96)';
  const shellShade = 'rgba(203, 225, 245, 0.9)';
  return (
    <svg width={size} height={(size * 104) / 92} viewBox="0 0 92 104" aria-hidden>
      <defs>
        <radialGradient id={`mascot-glow-${state}`} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor={HUD_SCENE.mascotSheenFrom} stopOpacity="0.95" />
          <stop offset="100%" stopColor={HUD_SCENE.mascotSheenTo} stopOpacity="0.9" />
        </radialGradient>
      </defs>
      <g className={POSE[state]}>
        {/* ตัว — แคปซูลกลม + แผงอกสีของทีม */}
        <path
          d="M 22 104 L 22 74 Q 22 52 46 52 Q 70 52 70 74 L 70 104 Z"
          fill={`url(#mascot-glow-${state})`}
        />
        <path d="M 34 104 L 34 76 Q 34 66 46 66 Q 58 66 58 76 L 58 104 Z" fill={color} opacity={0.8} />
        {/* ไหล่ */}
        <ellipse cx={24} cy={70} rx={9} ry={10} fill={shellShade} />
        <ellipse cx={68} cy={70} rx={9} ry={10} fill={shellShade} />

        {/* หัว — กลมใหญ่กว่าตัว (สัดส่วนน่ารัก) */}
        <ellipse cx={46} cy={34} rx={27} ry={25} fill={shell} />
        {/* หน้ากาก/วิเซอร์เข้ม — ที่อยู่ของตา */}
        <ellipse cx={46} cy={35} rx={20} ry={16} fill={HUD_SCENE.mascotVisor} />
        {/* ตาโต + ไฮไลต์ */}
        <ellipse cx={38} cy={34} rx={5.2} ry={6} fill={HUD_SCENE.mascotEye} />
        <ellipse cx={54} cy={34} rx={5.2} ry={6} fill={HUD_SCENE.mascotEye} />
        <circle cx={39.6} cy={31.8} r={1.7} fill={color} />
        <circle cx={55.6} cy={31.8} r={1.7} fill={color} />
        {/* ยิ้ม */}
        <path
          d="M 42 43 q 4 3.4 8 0"
          stroke="rgba(234,246,255,0.75)"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
        {/* อัญมณีบนหน้าผาก — จุดสีของทีม */}
        <circle cx={46} cy={14} r={4} fill={color} />
        <circle cx={46} cy={14} r={7} fill={color} opacity={0.22} />
        {/* หูฟัง (สีทีม) */}
        <rect x={14} y={28} width={8} height={16} rx={4} fill={color} opacity={0.9} />
        <rect x={70} y={28} width={8} height={16} rx={4} fill={color} opacity={0.9} />

        {/* แขนวางบนโต๊ะ — ขยับตอนทำงาน */}
        <g className="jarvis-office-arms">
          <path
            d="M 66 82 Q 80 84 84 96"
            stroke={shellShade}
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
        </g>
        {/* มืออีกข้าง: ยกแนบหูเมื่อกำลังโทร */}
        {onCall ? (
          <>
            <path
              d="M 26 82 Q 12 62 20 44"
              stroke={shellShade}
              strokeWidth={8}
              strokeLinecap="round"
              fill="none"
            />
            <circle
              className="jarvis-office-ring"
              cx={46}
              cy={34}
              r={36}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
            />
          </>
        ) : (
          <path
            d="M 26 82 Q 10 86 8 98"
            stroke={shellShade}
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>
    </svg>
  );
};

/**
 * โต๊ะทำงานหนึ่งชุด: เก้าอี้ + มาสคอต + จอโฮโลสองตัว + **โต๊ะที่บังตัวล่างของมาสคอต**
 * (Phase 10.1 · เจ้าของติฉากเดิม 24 ส.ค. 2569 ว่า *"ดูการ์ตูนบ้านนอกคอกนา"*)
 *
 * 🔴 ชิ้นที่ขาดไปในฉากเดิมคือ **โต๊ะ** — มาสคอตยืนบนแท่นเปล่าจึงอ่านเป็นตุ๊กตาลอย
 * แผ่นโต๊ะทับตัวล่างของมาสคอตพอดี สายตาจึงอ่านว่า "นั่งทำงานอยู่หลังโต๊ะ"
 *
 * ⚠️ วาดในกรอบคงที่ 208×124 เสมอ · ผู้เรียกย่อ/ขยายด้วย `transform: scale()`
 * ห้ามให้แต่ละแท่นวางพิกัดในกรอบเอง ไม่งั้นโต๊ะสูงไม่เท่ากันแล้วดูเหมือนคนละฉาก
 */
const STAGE = { w: 208, h: 124 } as const;

const Workstation: React.FC<{
  state: DeskState;
  color: string;
  bars: number[];
  /** อัตราย่อของแท่นนี้ — คูณพิกัดตรง ๆ */
  scale: number;
}> = ({ state, color, bars, scale }) => {
  const off = state === 'off';
  const barMax = Math.max(...bars, 1);
  /**
   * 🔴 ห้ามใช้ `transform: scale()` ครอบชิ้นนี้ — ป้ายตั้งอยู่ในบริบท CSS 3D
   * (`preserve-3d` + counter-rotate) การซ้อน transform เข้าไปอีกชั้นทำให้เกิด
   * containing block ใหม่แล้วชิ้นที่มี `perspective()`/`rotateY()` ข้างในกางออก
   * เป็นบล็อกสียักษ์พาดทั้งฉาก (เจอจริงตอนตรวจ 24 ส.ค. 2569) ⇒ คูณพิกัดเองทุกตัว
   */
  const u = (v: number) => v * scale;
  /** เส้นข้อมูลบนจอซ้าย — คงที่โดยตั้งใจ (สุ่มทุกเฟรม = จอกระพริบกวนตา) */
  const lines = [0.86, 0.62, 0.44, 0.7];
  return (
    <span className="relative block" style={{ width: u(STAGE.w), height: u(STAGE.h) }}>
      {/* พนักเก้าอี้ — อยู่หลังสุด */}
      {off ? null : (
        <span className="jarvis-office-chair" style={{ left: u(74), top: u(40), width: u(60), height: u(52) }} />
      )}

      {/* จอซ้าย — เอียงเข้าหาคนนั่ง */}
      {off ? null : (
        <span
          className="jarvis-office-panel"
          style={{
            // 🔴 ต้องประกาศใน inline style — คลาส .jarvis-office-panel มี `@apply relative`
            // ซึ่งชนะ utility `absolute` ทำให้จออยู่ใน flow แล้วกางเป็นบล็อกสียักษ์
            position: 'absolute',
            left: u(2),
            top: u(30),
            width: u(62),
            height: u(46),
            transform: 'perspective(220px) rotateY(27deg)',
            boxShadow: `inset 0 0 0 1px ${color}66, 0 0 16px ${color}2b`,
          }}
        >
          <span className="jarvis-office-screen-bar">
            <i />
            <i />
            <i />
          </span>
          <span className="mt-2 flex h-full w-full flex-col justify-center gap-[3px]">
            {lines.map((w, i) => (
              <span
                key={i}
                className="block h-[3px] rounded-full"
                style={{ width: `${w * 100}%`, background: color, opacity: 0.65 - i * 0.11 }}
              />
            ))}
          </span>
        </span>
      )}

      {/* มาสคอต — เล็กลงจากรอบก่อน เพราะมีโต๊ะกับจอช่วยเล่าแล้ว (เดิมตัวใหญ่จนดูเป็นของเล่น) */}
      <span className="absolute" style={{ left: u(70), top: u(14) }}>
        {off ? (
          <span
            className="block rounded-full"
            style={{
              width: u(60),
              height: u(60),
              background: 'rgba(255,255,255,0.05)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
            }}
          />
        ) : (
          <OfficeMascot state={state} color={color} size={u(68)} />
        )}
      </span>

      {/* จอขวา — แท่งค่าจริงของโต๊ะนี้ (ไม่ใช่กราฟหลอก) */}
      {off ? null : (
        <span
          className="jarvis-office-panel"
          style={{
            position: 'absolute',
            left: u(138),
            top: u(24),
            width: u(68),
            height: u(52),
            transform: 'perspective(240px) rotateY(-24deg)',
            boxShadow: `inset 0 0 0 1px ${color}77, 0 0 18px ${color}33`,
          }}
        >
          <span className="jarvis-office-screen-bar">
            <i />
            <i />
            <i />
          </span>
          <span className="jarvis-office-screen mt-2 flex h-full w-full items-end gap-1">
            {bars.map((v, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${Math.max(14, (v / barMax) * 100)}%`,
                  background: color,
                  opacity: 0.55 + i * 0.16,
                }}
              />
            ))}
          </span>
        </span>
      )}

      {/* โต๊ะ — ทับตัวล่างของมาสคอต · ขอบบนเรืองสีทีม */}
      <span
        className="jarvis-office-desk"
        style={{
          left: u(14),
          top: u(84),
          width: u(180),
          height: u(28),
          borderTop: `1.5px solid ${off ? 'rgba(255,255,255,0.16)' : color}`,
          opacity: off ? 0.5 : 1,
        }}
      />
      {/* แสงใต้โต๊ะบนพื้นแท่น */}
      {off ? null : (
        <span
          className="jarvis-office-desk-glow"
          style={{
            left: u(26),
            top: u(108),
            width: u(156),
            height: u(16),
            background: `radial-gradient(closest-side, ${color}55, ${color}12 62%, transparent)`,
          }}
        />
      )}
    </span>
  );
};

/** คำสั้นใต้ชื่อโต๊ะ — บอกท่าที่เห็นในฉากด้วยคำ (คนอ่านไม่ต้องเดาจากภาพ) */
const STATE_WORD: Record<DeskState, string> = {
  blocked: 'มีของค้าง',
  calling: 'กำลังโทร',
  working: 'กำลังทำงาน',
  idle: 'ว่าง',
  off: 'ยังไม่เปิดใช้',
};

export type OfficeFloorProps = {
  desks: Desk[];
  /** เวลาที่นับเลขชุดนี้ (ISO) */
  generatedAt?: string | null;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
};

const timeText = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
};

export const OfficeFloor: React.FC<OfficeFloorProps> = ({
  desks,
  generatedAt,
  loading = false,
  onRefresh,
  className,
}) => {
  const navigate = useNavigate();
  /**
   * ตั้งต้น "ขยับ" เสมอ แล้วค่อยหยุดเมื่อได้ event ว่าแท็บถูกซ่อน
   *
   * ⚠️ ห้ามตั้งต้นจาก `document.hidden` — บาง context (พรีวิวในเครื่องมือ · iframe ·
   * แท็บที่เปิดค้างไว้เบื้องหลัง) รายงาน hidden ค้างตลอดโดยไม่ยิง visibilitychange
   * ตามมา ผลคือฉากนิ่งสนิทแบบหาสาเหตุไม่เจอ (เจอจริงตอนตรวจงานรอบนี้)
   * ส่วนเรื่องเปลือง CPU: เบราว์เซอร์หยุด CSS animation ของแท็บที่ไม่ได้ดูให้เองอยู่แล้ว
   * class นี้จึงเป็นแค่ชั้นกันเพิ่ม ไม่ใช่ชั้นเดียวที่กัน
   */
  const [animate, setAnimate] = React.useState(true);

  /**
   * มุมกล้อง + อัตราย่อฉาก
   *
   * `fit` = ย่อกระดานพื้น (กว้างคงที่ 1020px ในระบบพิกัดของตัวเอง) ให้พอดีความกว้างจริงของกล่อง
   * — วัดด้วย ResizeObserver ไม่ใช่ media query เพราะกล่องนี้อยู่ในแผงที่กว้างไม่เท่ากันในแต่ละหน้า
   *
   * `camera` = เอียง/หมุนตามเมาส์ **แบบหน่วง** (เจ้าของเคาะ: ขยับเบา ๆ อัตโนมัติ ไม่ให้หมุนเอง)
   * ⚠️ เคารพ prefers-reduced-motion — คนที่ปิดแอนิเมชันได้กล้องนิ่งสนิท (ยังเห็นข้อมูลครบ)
   */
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = React.useState(1);
  const [camera, setCamera] = React.useState<{ tilt: number; spin: number }>(CAMERA_BASE);

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setFit(el.clientWidth / OFFICE_BOARD.width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const box = el.getBoundingClientRect();
      const nx = (e.clientX - box.left) / box.width - 0.5;
      const ny = (e.clientY - box.top) / box.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setCamera({
          tilt: CAMERA_BASE.tilt - ny * CAMERA_RANGE.tilt * 2,
          spin: CAMERA_BASE.spin + nx * CAMERA_RANGE.spin * 2,
        }),
      );
    };
    const onLeave = () => setCamera(CAMERA_BASE);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  React.useEffect(() => {
    const onVis = () => setAnimate(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  /** ค้นโต๊ะด้วย id — เส้นงานไหลต้องรู้สถานะของโต๊ะต้นทาง/ปลายทาง */
  const byId = React.useMemo(
    () => Object.fromEntries(desks.map((d) => [d.id, d])) as Record<DeskId, Desk>,
    [desks],
  );

  const hot = desksNeedingAction(desks);
  const ticker: HudTickerItem[] = desks
    .filter((d) => d.state !== 'off')
    .map((d) => ({
      key: d.id,
      label: shortLabel(d.label),
      value: d.backlog > 0 ? d.backlog : undefined,
      tone: d.tone,
      live: d.state === 'calling',
    }));

  return (
    <HudPanel
      eyebrow="ห้องทำงาน · สถานะสด"
      title={officeHeadline(desks)}
      subtitle={
        <>
          {/* คำแนะนำต้องตรงกับสิ่งที่มีอยู่จริงบนจอนั้น — มือถือไม่มีเมาส์และไม่มีฉากตัวละคร */}
          <span className="hidden md:inline">
            เอาเมาส์ไปจี้ตัวละครเพื่อดูว่าโต๊ะนั้นกำลังทำอะไร · กดเพื่อไปหน้างานจริง
          </span>
          <span className="md:hidden">กดโต๊ะเพื่อไปหน้างานจริง</span>
          <span className="ml-1 opacity-70">(อัปเดต {timeText(generatedAt)})</span>
        </>
      }
      right={
        onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={cn(
              HUD.inner,
              HUD.innerHover,
              'px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50',
            )}
          >
            {loading ? 'กำลังอัปเดต…' : 'รีเฟรช'}
          </button>
        ) : undefined
      }
      scan
      className={className}
    >
      {hot.length > 0 ? (
        <div className={cn('mb-3 rounded-xl px-3 py-2', HUD.inner)}>
          <div className={HUD.bodyStrong}>
            ต้องไปช่วย {hot.length} โต๊ะ:{' '}
            {hot.map((d, i) => (
              <React.Fragment key={d.id}>
                {i > 0 ? ' · ' : ''}
                <button
                  type="button"
                  onClick={() => navigate(d.href)}
                  className="underline decoration-dotted underline-offset-2"
                  style={{ color: HUD_HEX[d.tone] }}
                >
                  {shortLabel(d.label)} ({d.backlog})
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : null}

      {/* มือถือ: ไม่เอาฉาก — 6 โต๊ะย่อลงจอ 375px แล้วป้ายเหลือ ~6px อ่านไม่ออก
          และการทำให้อ่านออกต้องเลื่อนซ้าย-ขวา ซึ่งเจ้าของสั่งเลิกไปแล้ว
          จึงตอบเป็น "รายการโต๊ะ" ที่อ่านออกและกดได้ — ข้อมูลเท่ากันทุกตัว ไม่ตัดของทิ้ง */}
      <div className="space-y-1.5 md:hidden">
        {desks.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => navigate(d.href)}
            className={cn(HUD.inner, HUD.innerHover, 'flex w-full items-start gap-2.5 p-3 text-left')}
          >
            <span
              className={cn(
                'mt-1 inline-block h-2 w-2 shrink-0 rounded-full',
                d.state === 'calling' && 'motion-safe:animate-pulse',
              )}
              style={{ background: HUD_HEX[d.tone], opacity: d.state === 'off' ? 0.4 : 1 }}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn(HUD.bodyStrong, 'truncate')}>{shortLabel(d.label)}</span>
                <span className={cn('shrink-0', HUD.unit)}>{STATE_WORD[d.state]}</span>
              </span>
              <span className={cn('mt-0.5 block', HUD.body)}>{d.doing}</span>
            </span>
            {d.backlog > 0 ? (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-bold tabular-nums"
                style={{ background: HUD_HEX.danger, color: HUD_INK.hex }}
              >
                {d.backlog}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ═══ ศูนย์ปฏิบัติการเสมือน 3 มิติ (CSS 3D · ไม่มี library) ═══
          รอบยกระดับตามภาพอ้างอิงที่เจ้าของส่งมา: แท่นวงกลมล้อมแกนกลาง + มาสคอต + จอโฮโล
          เหตุผลของเทคนิคทั้งหมดอยู่หัวไฟล์นี้และใน src/index.css */}
      <div
        ref={stageRef}
        className={cn(
          'jarvis-office-stage hidden md:block',
          animate && 'jarvis-office-live',
        )}
        style={{
          aspectRatio: `${OFFICE_BOARD.width} / 430`,
          ['--office-tilt' as string]: `${camera.tilt}deg`,
          ['--office-spin' as string]: `${camera.spin}deg`,
        }}
      >
        {/* ฉากหลัง — อยู่นอก world จึงไม่เอียงตามกล้อง (ท้องฟ้าไม่ควรเอียงตามพื้น) */}
        <div className="jarvis-office-sky" />
        <div className="jarvis-office-skyline" style={{ top: '6%', height: '30%' }} />

        <div
          className="jarvis-office-world"
          style={{
            transform: `scale(${fit}) rotateX(var(--office-tilt)) rotateZ(var(--office-spin))`,
          }}
        >
          <div
            className="jarvis-office-ground"
            style={{ width: OFFICE_BOARD.width, height: OFFICE_BOARD.depth }}
          >
            <div className="jarvis-office-grid" />

            {/* ── สายข้อมูลจากแกนกลางไปแท่นของแต่ละทีม (นอนบนพื้น) ── */}
            {desks.map((d) => {
              const g = coreSpokeGeometry(d.id);
              const active = isDeskActive(d);
              const tone = HUD_HEX[d.tone];
              return (
                <div
                  key={`spoke-${d.id}`}
                  className="jarvis-office-path"
                  data-flow={active ? '1' : '0'}
                  title={`${d.label} — ${d.doing}`}
                  style={{
                    left: g.x,
                    top: g.y,
                    width: g.length,
                    transform: `rotate(${g.angleDeg}deg)`,
                    background: active
                      ? `linear-gradient(90deg, ${tone}00 0%, ${tone} 18%, ${tone} 82%, ${tone}00 100%)`
                      : `repeating-linear-gradient(90deg, ${HUD_SCENE.link} 0 4px, transparent 4px 16px)`,
                    boxShadow: active ? `0 0 14px ${tone}, 0 0 30px ${tone}55` : undefined,
                    opacity: active ? 0.95 : 0.4,
                  }}
                >
                  {/* จุดข้อมูลวิ่งจากแกนกลางไปแท่น — มีเฉพาะสายที่มีงานเดินอยู่จริง */}
                  {active ? (
                    <span
                      className="jarvis-office-spark"
                      style={{ background: tone, boxShadow: `0 0 10px ${tone}` }}
                    />
                  ) : null}
                </div>
              );
            })}

            {/* ── แท่นวงกลมของแต่ละทีม (นอนบนพื้น) ── */}
            {desks.map((d) => {
              const slot = OFFICE_SLOTS[d.id];
              const color = HUD_HEX[d.tone];
              const off = d.state === 'off';
              const hot = d.state === 'blocked' || d.state === 'calling';
              return (
                <React.Fragment key={`pod-${d.id}`}>
                  <div
                    className="jarvis-office-pod"
                    style={{
                      left: slot.x,
                      top: slot.y,
                      width: 268 * slot.scale,
                      height: 104 * slot.scale,
                      opacity: off ? 0.4 : 1,
                    }}
                  />
                  {/* แผ่นแสงกลางแท่น — จุดที่มาสคอตยืน (กันความรู้สึก "ตัวละครลอย") */}
                  {off ? null : (
                    <div
                      className="jarvis-office-pod"
                      style={{
                        left: slot.x,
                        top: slot.y,
                        width: 132 * slot.scale,
                        height: 52 * slot.scale,
                        background: `radial-gradient(closest-side, ${color}3d, ${color}14 62%, transparent)`,
                        boxShadow: 'none',
                      }}
                    />
                  )}
                  <div
                    className="jarvis-office-pod-rim"
                    data-pulse={hot ? '1' : '0'}
                    style={{
                      left: slot.x,
                      top: slot.y,
                      width: 268 * slot.scale,
                      height: 104 * slot.scale,
                      border: `${hot ? 2 : 1.5}px solid ${color}`,
                      opacity: off ? 0.22 : hot ? 0.85 : 0.5,
                      boxShadow: off
                        ? undefined
                        : `0 0 ${hot ? 34 : 20}px ${color}${hot ? '66' : '33'}, inset 0 0 26px ${color}1f`,
                    }}
                  />
                </React.Fragment>
              );
            })}

            {/* ── แกนกลาง: JARVIS Core ── */}
            <div
              className="jarvis-office-core-base"
              style={{ left: OFFICE_CORE.x, top: OFFICE_CORE.y, width: 250, height: 108 }}
            />
            <div
              className="jarvis-office-core-ring jarvis-office-pod-rim"
              style={{
                left: OFFICE_CORE.x,
                top: OFFICE_CORE.y,
                width: 196,
                height: 84,
                border: '1.5px dashed rgba(125, 211, 252, 0.55)',
              }}
            />
            <div
              className="jarvis-office-standee"
              style={{ left: OFFICE_CORE.x, top: OFFICE_CORE.y, zIndex: Math.round(OFFICE_CORE.y) }}
            >
              {/* ป้ายอยู่ **เหนือ** ลำแสง — ถ้าวางไว้ล่างจะถูกมาสคอตของแท่นหน้าบังทันที */}
              <span
                className="jarvis-office-plate mb-1 block"
                style={{
                  boxShadow:
                    '0 0 26px rgba(56,189,248,0.4), inset 0 0 0 1px rgba(125,211,252,0.55)',
                }}
              >
                <span className="block text-[13px] font-bold tracking-wide text-sky-200">
                  JARVIS Core
                </span>
                <span className="block text-[10px] text-slate-400">ศูนย์คุมการไหลของงาน</span>
              </span>
              <span className="relative block" style={{ width: 132, height: 118 }}>
                <span
                  className="jarvis-office-core-beam absolute"
                  style={{ width: 104, height: 114 }}
                />
                {/* ผนังกระจกของกระบอก + ฝาบน — ของเดิมมีแต่ลำแสงจึงอ่านเป็น "แท่งสี" */}
                <span className="jarvis-office-core-glass" style={{ width: 96, height: 104 }} />
                <span
                  className="jarvis-office-core-cap"
                  style={{ width: 96, height: 26, top: -8 }}
                />
                {/* วงแหวนแสงซ้อนในลำแสง — ตัวที่ทำให้อ่านเป็น "แกนพลังงาน" ไม่ใช่แท่งสี */}
                {[0.34, 0.6, 0.86].map((t) => (
                  <span
                    key={t}
                    className="absolute left-1/2 block rounded-[50%]"
                    style={{
                      bottom: `${t * 100}%`,
                      width: 104 - t * 34,
                      height: 16 - t * 5,
                      transform: 'translateX(-50%)',
                      border: '1px solid rgba(125,211,252,0.5)',
                      boxShadow: '0 0 14px rgba(56,189,248,0.4)',
                    }}
                  />
                ))}
              </span>
            </div>

            {/* ── มาสคอต + จอโฮโล + ป้ายชื่อทีม (ป้ายตั้ง หันเข้ากล้อง) ── */}
            {[...desks]
              .sort((a, b) => OFFICE_SLOTS[a.id].y - OFFICE_SLOTS[b.id].y)
              .map((d) => {
                const slot = OFFICE_SLOTS[d.id];
                const color = HUD_HEX[d.tone];
                const off = d.state === 'off';
                const bars = d.stats.slice(0, 3).map((st) => st.value);
                const barMax = Math.max(...bars, 1);
                return (
                  <HoverCard key={d.id} openDelay={80} closeDelay={60}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        onClick={() => navigate(d.href)}
                        aria-label={`${d.label} — ${d.doing}`}
                        title={`${d.label} — ${d.doing}`}
                        className={cn(
                          'jarvis-office-standee group focus-visible:outline-none',
                          off && 'opacity-55',
                        )}
                        style={{ left: slot.x, top: slot.y, zIndex: Math.round(slot.y) }}
                      >
                        {d.backlog > 0 ? (
                          <span
                            className="jarvis-office-alert mb-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold tabular-nums"
                            style={{
                              background: HUD_HEX.danger,
                              color: HUD_INK.hex,
                              boxShadow: `0 0 18px ${HUD_HEX.danger}88`,
                            }}
                          >
                            {d.backlog}
                          </span>
                        ) : null}

                        {/* โต๊ะทำงานหนึ่งชุด — เก้าอี้ + มาสคอต + จอสองตัว + โต๊ะบังตัวล่าง */}
                        <Workstation
                          state={d.state}
                          color={color}
                          bars={bars}
                          scale={slot.scale}
                        />

                        {/* ป้ายชื่อทีม — แผ่นเรืองแบบเดียวกับภาพอ้างอิง */}
                        <span
                          className="jarvis-office-plate mt-1.5 block transition-shadow"
                          style={{
                            boxShadow: off
                              ? 'inset 0 0 0 1px rgba(255,255,255,0.12)'
                              : `0 0 18px ${color}44, inset 0 0 0 1px ${color}88`,
                          }}
                        >
                          <span
                            className="block text-[13px] font-semibold leading-tight"
                            style={{ color: off ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.96)' }}
                          >
                            {shortLabel(d.label)}
                          </span>
                          <span
                            className="block text-[10px] leading-tight"
                            style={{ color: off ? 'rgba(255,255,255,0.42)' : color }}
                          >
                            {STATE_WORD[d.state]}
                          </span>
                        </span>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent
                      className={cn('w-80 border-white/10 text-white', HUD.popover)}
                      sideOffset={8}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold" style={{ color }}>
                          {shortLabel(d.label)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-block h-1.5 w-1.5 rounded-full',
                              d.state === 'calling' && 'motion-safe:animate-pulse',
                            )}
                            style={{ background: color }}
                          />
                          <span className={HUD.unit}>{STATE_WORD[d.state]}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm">{d.doing}</div>
                      {d.stats.length > 0 ? (
                        <div className={cn('mt-3 space-y-1.5 border-t pt-2.5', HUD.divider)}>
                          {d.stats.map((st) => (
                            <div key={st.key} className="flex items-baseline justify-between gap-3">
                              <span className={cn(HUD.label, 'normal-case')}>{st.label}</span>
                              <span className="shrink-0 whitespace-nowrap">
                                <span
                                  className="font-mono text-sm font-semibold tabular-nums"
                                  style={{ color: HUD_HEX[st.tone ?? d.tone] }}
                                >
                                  {st.value}
                                </span>
                                <span className={cn('ml-1', HUD.unit)}>{st.unit}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className={cn('mt-3', HUD.body)}>กดเพื่อไปหน้างานของทีมนี้ →</div>
                    </HoverCardContent>
                  </HoverCard>
                );
              })}
          </div>
        </div>
      </div>

      {/* แถบจุดสถานะ — เดสก์ท็อปเท่านั้น (มือถือมีรายการโต๊ะข้างบนที่บอกครบกว่าอยู่แล้ว) */}
      <HudTicker items={ticker} className="mt-3 hidden md:flex" />
    </HudPanel>
  );
};

export default OfficeFloor;

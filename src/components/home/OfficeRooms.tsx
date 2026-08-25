/**
 * ฉาก "4 ห้อง" บนหน้าแรก — ภาพ render + ชั้นข้อมูลจริงทับ (Phase 2.12 + 10.1)
 *
 * เจ้าของเคาะ 24 ส.ค. 2569: ฉากต้องเป็นภาพระดับ render (*"ถ้าไม่ได้ประมาณนี้
 * ไม่ต้องออกมานะ"*) และส่งไฟล์ภาพมาเอง — โครงจึงเป็น:
 * 1. **ภาพนิ่ง** `public/office/office-rooms.jpg` (1672×941 · เจ้าของ gen ไม่มีตัวหนังสือฝัง)
 * 2. **ชั้น DOM ทับ**: ป้ายเลขห้อง 4 อัน · การ์ดสถิติ 4 ใบ (เลขสดจาก API · กดไปหน้างาน)
 *    · ป้าย JARVIS Core — เพราะเลขที่ฝังในภาพจะตายค้างและโกหกคนดู
 * 3. **fallback บังคับ** (แผน 2.12.4): ภาพโหลดไม่ได้ → ถอยไปฉาก CSS เดิม (`OfficeFloor`)
 *    หน้าแรกห้ามมีกรอบเปล่า
 *
 * 🔴 กติกา:
 * - การจัดโต๊ะเข้าห้อง/ตัวเลข/สถานะ อยู่ที่ `src/lib/officeRooms.ts` (pure + เทสต์)
 *   ไฟล์นี้แค่วาด — ห้ามคิดเลขเอง
 * - ตำแหน่งบนภาพเป็น % จาก `ROOM_SPOTS` ที่เดียว · เปลี่ยนภาพต้องวัดใหม่ที่นั่น
 * - มือถือ (จอ < md): ไม่ใช้ภาพ — การ์ดห้อง 4 ใบเรียงลงมา ข้อมูลครบเท่ากัน
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import HudPanel from '@/components/hud/HudPanel';
import OfficeFloor from '@/components/home/OfficeFloor';
import { HUD, HUD_HEX, HUD_INK } from '@/lib/designTokens';
import type { Desk } from '@/lib/officeFloor';
import {
  ROOM_SPOTS,
  ROOM_STATE_WORD,
  buildRooms,
  roomsInOrder,
  type Room,
} from '@/lib/officeRooms';
import { cn } from '@/lib/utils';

/** ภาพฉาก — เจ้าของส่งมา 24 ส.ค. 2569 · สัดส่วนต้องตรงไฟล์จริง ไม่งั้นตำแหน่ง % เพี้ยน */
const SCENE_SRC = '/office/office-rooms.jpg';
const SCENE_RATIO = '1672 / 941';

const timeText = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
};

/** การ์ดสถิติของห้อง — ใบเดียวใช้ทั้งบนภาพ (absolute) และมุมมองมือถือ (ใน grid) */
const RoomCard: React.FC<{ room: Room; onGo: (href: string) => void; className?: string }> = ({
  room,
  onGo,
  className,
}) => {
  const color = HUD_HEX[room.tone];
  const off = room.state === 'off';
  return (
    <div
      className={cn('w-60 rounded-xl p-3', HUD.popover, off && 'opacity-70', className)}
      style={{ boxShadow: `0 0 0 1px ${color}55, 0 0 24px ${color}22, 0 14px 34px rgba(0,0,0,.45)` }}
    >
      <button
        type="button"
        onClick={() => onGo(room.href)}
        className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline-none"
        aria-label={`ห้อง ${room.name} — ${room.doing}`}
      >
        <span className="text-sm font-bold" style={{ color }}>
          {room.card}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              room.state === 'calling' && 'motion-safe:animate-pulse',
            )}
            style={{ background: color }}
          />
          <span className={HUD.unit}>{ROOM_STATE_WORD[room.state]}</span>
        </span>
      </button>
      {room.rows.length === 0 ? (
        <p className={cn(HUD.body, 'mt-2')}>{room.doing}</p>
      ) : (
        <div className={cn('mt-2 space-y-1 border-t pt-2', HUD.divider)}>
          {room.rows.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => onGo(r.href)}
              className="flex w-full items-baseline justify-between gap-3 rounded px-1 py-0.5 text-left hover:bg-white/5 focus-visible:outline-none"
            >
              <span className={cn(HUD.label, 'truncate normal-case')}>{r.label}</span>
              <span className="shrink-0 whitespace-nowrap">
                <span
                  className="font-mono text-sm font-semibold tabular-nums"
                  style={{ color: HUD_HEX[r.tone ?? room.tone] }}
                >
                  {r.value}
                </span>
                <span className={cn('ml-1', HUD.unit)}>{r.unit}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export type OfficeRoomsProps = {
  desks: Desk[];
  generatedAt?: string | null;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
};

export const OfficeRooms: React.FC<OfficeRoomsProps> = ({
  desks,
  generatedAt,
  loading = false,
  onRefresh,
  className,
}) => {
  const navigate = useNavigate();
  /**
   * ภาพโหลดไม่ได้ (ไฟล์หาย/พัง) → ถอยไปฉาก CSS เดิมทั้ง component
   * ⚠️ ตัดสินจาก onError ของ <img> จริง ไม่ใช่ fetch แยก (จะได้ไม่โหลดภาพสองรอบ)
   */
  const [sceneBroken, setSceneBroken] = React.useState(false);
  const rooms = React.useMemo(() => buildRooms(desks), [desks]);
  const ordered = React.useMemo(() => roomsInOrder(rooms), [rooms]);
  const hot = ordered.filter((r) => r.backlog > 0);

  if (sceneBroken) {
    return (
      <OfficeFloor
        desks={desks}
        generatedAt={generatedAt}
        loading={loading}
        onRefresh={onRefresh}
        className={className}
      />
    );
  }

  return (
    <HudPanel
      eyebrow="ห้องปฏิบัติการ · สถานะสด"
      title={
        hot.length > 0
          ? `ห้อง ${hot.map((r) => r.name).join(' · ')} มีของค้างต้องลงมือ`
          : 'ทั้ง 4 ห้องทำงานปกติ'
      }
      subtitle={
        <>
          <span className="hidden md:inline">กดการ์ดห้องเพื่อไปหน้างานจริง · เลขบนการ์ดเป็นของสด</span>
          <span className="md:hidden">กดห้องเพื่อไปหน้างานจริง</span>
          <span className="ml-1 opacity-70">(อัปเดต {timeText(generatedAt)})</span>
        </>
      }
      right={
        onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className={cn(HUD.body, 'inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 hover:text-white')}
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} aria-hidden />
            รีเฟรช
          </button>
        ) : null
      }
      className={className}
    >
      {/* ── เดสก์ท็อป: ภาพ + ชั้นข้อมูลทับ ── */}
      <div
        className="relative hidden w-full overflow-hidden rounded-xl md:block"
        style={{ aspectRatio: SCENE_RATIO }}
      >
        <img
          src={SCENE_SRC}
          alt="ห้องปฏิบัติการเสมือน 4 ห้อง: Online · Recruit · คัดสรร · AI Call รอบแกนกลาง JARVIS Core"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setSceneBroken(true)}
        />

        {/* ป้ายเลขห้อง — ชิปตั้งบนหัวห้องในภาพ */}
        {ordered.map((room) => {
          const spot = ROOM_SPOTS[room.id];
          const color = HUD_HEX[room.tone];
          return (
            <button
              key={`tag-${room.id}`}
              type="button"
              onClick={() => navigate(room.href)}
              className="absolute flex -translate-x-1/2 items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-left focus-visible:outline-none"
              style={{
                left: `${spot.tag.x}%`,
                top: `${spot.tag.y}%`,
                background: 'rgba(8, 15, 28, 0.82)',
                boxShadow: `0 0 0 1px ${color}88, 0 0 20px ${color}44`,
              }}
              aria-label={`ห้อง ${room.no} ${room.name} — ${room.doing}`}
              title={room.doing}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-bold"
                style={{ background: color, color: HUD_INK.hex }}
              >
                {room.no}
              </span>
              <span className="text-[13px] font-semibold text-white">{room.name}</span>
              {room.backlog > 0 ? (
                <span
                  className="rounded-full px-1.5 font-mono text-[10px] font-bold tabular-nums"
                  style={{ background: HUD_HEX.danger, color: HUD_INK.hex }}
                >
                  {room.backlog}
                </span>
              ) : null}
            </button>
          );
        })}

        {/* ป้ายแกนกลาง — ภาพมีกระบอกอยู่แล้ว ป้ายเป็นของจริงไว้บอกว่ามันคืออะไร */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-lg px-3 py-1 text-center"
          style={{
            top: '30.5%',
            background: 'rgba(8, 15, 28, 0.82)',
            boxShadow: '0 0 0 1px rgba(125,211,252,.5), 0 0 22px rgba(56,189,248,.35)',
          }}
        >
          <span className="block text-[13px] font-bold tracking-wide text-sky-200">JARVIS Core</span>
          <span className={cn('block text-[10px]', HUD.unit)}>ศูนย์คุมการไหลของงาน</span>
        </div>

        {/* การ์ดสถิติ 4 ใบ — มุมของห้องตัวเองตามภาพอ้างอิง */}
        {ordered.map((room) => {
          const { card } = ROOM_SPOTS[room.id];
          const style: React.CSSProperties = {
            left: card.anchor === 'tl' || card.anchor === 'bl' ? `${card.x}%` : undefined,
            right: card.anchor === 'tr' || card.anchor === 'br' ? `${100 - card.x}%` : undefined,
            top: card.anchor === 'tl' || card.anchor === 'tr' ? `${card.y}%` : undefined,
            bottom: card.anchor === 'bl' || card.anchor === 'br' ? `${100 - card.y}%` : undefined,
          };
          return (
            <div key={`card-${room.id}`} className="absolute hidden lg:block" style={style}>
              <RoomCard room={room} onGo={(href) => navigate(href)} />
            </div>
          );
        })}
      </div>

      {/* ── จอเล็ก: การ์ดห้องเรียงเป็นกริด (ไม่มีภาพ — ข้อมูลครบเท่ากัน) ── */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:hidden">
        {ordered.map((room) => (
          <RoomCard key={room.id} room={room} onGo={(href) => navigate(href)} className="w-full" />
        ))}
      </div>

      {/* จอ md (มีภาพแต่แคบเกินกว่าจะวางการ์ดทับ) — การ์ดลงมาอยู่ใต้ภาพ */}
      <div className="mt-2 hidden grid-cols-2 gap-2 md:grid lg:hidden">
        {ordered.map((room) => (
          <RoomCard key={room.id} room={room} onGo={(href) => navigate(href)} className="w-full" />
        ))}
      </div>
    </HudPanel>
  );
};

export default OfficeRooms;

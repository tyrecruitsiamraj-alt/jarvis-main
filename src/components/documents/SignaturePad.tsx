/**
 * ช่องเขียนลายเซ็นบนจอ (ฟอร์มส่งเอกสารของผู้สมัคร · 22 พ.ย. 2569)
 * พื้นโปร่ง เส้นเข้ม — เซิร์ฟเวอร์ถอดภาพแล้วนับเส้นหมึกจริง (`checkDrawnSignature`) ภาพเปล่า/จุดเดียวไม่ผ่าน
 * ค่าเป็น data URL ของ PNG · ล้าง = ''
 */
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

const WIDTH = 640;
const HEIGHT = 220;

export default function SignaturePad({ value, onChange, disabled = false }: { value: string; onChange: (dataUrl: string) => void; disabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  // ค่าถูกล้างจากข้างนอก (แก้ข้อมูลแล้วต้องลงนามใหม่) — ลบเส้นบนจอด้วย
  useEffect(() => {
    if (value) return;
    const el = canvas.current;
    el?.getContext('2d')?.clearRect(0, 0, el.width, el.height);
  }, [value]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * WIDTH) / r.width, y: ((e.clientY - r.top) * HEIGHT) / r.height };
  };
  const stop = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(e.currentTarget.toDataURL('image/png'));
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvas}
        width={WIDTH}
        height={HEIGHT}
        aria-label="ช่องเขียนลายเซ็น"
        data-testid="signature-pad"
        // touch-none: ลากนิ้วเขียนแล้วหน้าไม่เลื่อนตาม
        className="w-full touch-none rounded-xl border border-input bg-white"
        onPointerDown={(e) => {
          if (disabled) return;
          const ctx = e.currentTarget.getContext('2d');
          if (!ctx) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const p = point(e);
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = 'black';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d');
          if (!ctx) return;
          const p = point(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled || !value} onClick={() => onChange('')}>
        ล้างลายเซ็น
      </Button>
    </div>
  );
}

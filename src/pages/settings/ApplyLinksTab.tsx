/**
 * ═══ ตั้งค่า › ลิงก์หน้าสมัคร — ลิงก์ /apply แยก BU (+ล็อกตำแหน่ง) (เจ้าของ 27 ต.ค. 2569) ═══
 * > *"/apply จะล็อคตำแหน่งยังไง แยก BU ไว้ lbd lba lm ฯลฯ ทำผ่าน UI"* · Choice "สร้างลิงก์แยก BU จากหน้าตั้งค่า"
 * เลือก BU (+ตำแหน่ง) → ได้ลิงก์ `/apply?bu=LBD&pos=…` · server กรองงานตาม BU (`api/_handlers/public/jobs.ts`)
 * · ตำแหน่งล็อกด้วย `pos` ตัวเดิม (`resolveApplyPositionPreset`) · ไม่เก็บลงฐาน — ลิงก์คือค่าทั้งหมด
 */
import React, { useEffect, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldSelect } from '@/components/shared/FieldSelect';
import { apiFetch } from '@/lib/apiFetch';
import { APP_DEPARTMENT_CODES } from '@/lib/departmentCodes';
import { applyBuLink } from '@/lib/applyBuLink';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const ALL = '__all__';
const NUM = new Intl.NumberFormat('th-TH');

const ApplyLinksTab: React.FC = () => {
  const [bu, setBu] = useState<string>('LBD');
  const [pos, setPos] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const link = applyBuLink(window.location.origin, bu === ALL ? null : bu, pos);

  // จำนวนงานที่ลิงก์นี้จะโชว์ (BU เดียวกัน · ตำแหน่งกรองบนหน้าเว็บอีกชั้น เลขนี้นับเฉพาะ BU)
  useEffect(() => {
    let alive = true;
    setCount(null);
    apiFetch(`/api/public/jobs?limit=500${bu === ALL ? '' : `&bu=${bu}`}`)
      .then(async (r) => (r.ok ? ((await r.json()) as unknown[]) : null))
      .then((list) => alive && setCount(Array.isArray(list) ? list.length : null))
      .catch(() => alive && setCount(null));
    return () => {
      alive = false;
    };
  }, [bu]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setNotice('ก๊อปปี้ลิงก์แล้ว');
    } catch {
      setNotice('ก๊อปปี้ไม่ได้ — เลือกข้อความแล้วก๊อปเอง');
    }
  };

  return (
    <Card variant="solid" className="max-w-2xl space-y-5 p-5" data-testid="apply-links">
      <h3 className="text-lg font-medium text-foreground">ลิงก์หน้าสมัคร</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="apply-link-bu">BU</Label>
          <FieldSelect
            id="apply-link-bu"
            value={bu}
            onChange={(v) => {
              setBu(v);
              setNotice(null);
            }}
            testId="apply-link-bu"
            options={[{ value: ALL, label: 'ทุก BU' }, ...APP_DEPARTMENT_CODES.map((c) => ({ value: c, label: c }))]}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apply-link-pos">ล็อกตำแหน่ง (ถ้ามี)</Label>
          <Input
            id="apply-link-pos"
            value={pos}
            maxLength={60}
            placeholder="เช่น ขับรถ"
            onChange={(e) => {
              setPos(e.target.value);
              setNotice(null);
            }}
            data-testid="apply-link-pos"
          />
        </div>
      </div>

      <div className="space-y-2">
        <code className="block break-all rounded-lg bg-muted px-3 py-2 text-sm text-foreground" data-testid="apply-link-url">
          {link}
        </code>
        <p className="text-xs tabular-nums text-muted-foreground">
          งานที่เปิดรับใน {bu === ALL ? 'ทุก BU' : bu} ตอนนี้ {count === null ? '—' : NUM.format(count)} ใบ
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => void copy()} data-testid="apply-link-copy">
            <Copy aria-hidden /> ก๊อปปี้ลิงก์
          </Button>
          <Button asChild type="button" size="sm" variant="outline">
            <a href={link} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden /> เปิดดู
            </a>
          </Button>
          {notice ? <span className={cn('text-sm', TONE.success.value)}>{notice}</span> : null}
        </div>
      </div>
    </Card>
  );
};

export default ApplyLinksTab;

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchRecruitChannelChildren, fetchRecruitChannelRoots } from '@/lib/recruitPostingsApi';
import { recruitChannelLabel, type RecruitChannelMatch } from '@/lib/recruitPostings';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * ═══ ตัวเลือกช่องทางรับสมัคร — dropdown ช่องทางหลัก → dropdown ช่องทางรอง ═══
 *
 * เจ้าของ 28 ต.ค. 2569: *"เวลาเลือกช่องทางหลักกดมาเป็น Dropdown แล้วมีแค่ 4 อันให้เลือก
 * เลือกอันไหนเสร็จก็ขึ้นช่องทางรองของช่องทางหลักให้เลือก"* (หลักเหลือ Facebook · Tiktok · Webjob · Offline)
 * เดิม (2 ก.ย. 2569) เป็นลิสต์กด + ค้นข้ามชั้น ตอนช่องทางรองยังมี 4,345 ตัว
 *
 * - ช่องทางหลักที่มีช่องทางรอง = ต้องเลือกรองต่อ (ค่าที่ได้คือช่องทางรอง ป้าย "หลัก · รอง")
 * - ช่องทางหลักที่ไม่มีช่องทางรอง = เลือกแล้วจบที่ตัวหลัก
 * - เลือกแล้วเหลือชิปเดียว กด X เพื่อเปลี่ยน (1:1) · `MultiChannelPicker` ส่ง `value={null}` แล้วรับทีละตัว
 */

const ChannelPicker: React.FC<{
  value: RecruitChannelMatch | null;
  onChange: (next: RecruitChannelMatch | null) => void;
  /** โหลดใหม่เมื่อค่านี้เปลี่ยน (ใช้ตอน dialog เปิด) */
  reloadKey?: unknown;
  /** บรรทัดบอกใต้ตัวเลือก — ไม่ส่ง = "เลือกได้ 1 ช่อง" */
  footHint?: string;
}> = ({ value, onChange, reloadKey, footHint }) => {
  const [roots, setRoots] = useState<Array<RecruitChannelMatch & { childCount: number }>>([]);
  const [rootsLoading, setRootsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [mainId, setMainId] = useState('');
  const [children, setChildren] = useState<RecruitChannelMatch[]>([]);
  const [childLoading, setChildLoading] = useState(false);

  useEffect(() => {
    setMainId('');
    setChildren([]);
    let alive = true;
    setRootsLoading(true);
    fetchRecruitChannelRoots()
      .then((list) => {
        if (!alive) return;
        setRoots(list.map((c) => ({ id: c.id, name: c.name, parentId: null, parentName: null, isActive: c.isActive, childCount: c.childCount ?? 0 })));
        setFailed(false);
      })
      .catch(() => {
        if (!alive) return;
        setRoots([]);
        setFailed(true);
      })
      .finally(() => {
        if (alive) setRootsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const main = roots.find((r) => r.id === mainId) ?? null;

  useEffect(() => {
    if (!main || main.childCount === 0) {
      setChildren([]);
      return;
    }
    let alive = true;
    setChildLoading(true);
    fetchRecruitChannelChildren(main.id, { limit: 200 })
      .then(({ items }) => {
        if (!alive) return;
        setChildren(items.map((c) => ({ id: c.id, name: c.name, parentId: main.id, parentName: main.name, isActive: c.isActive })));
      })
      .catch(() => alive && setChildren([]))
      .finally(() => alive && setChildLoading(false));
    return () => {
      alive = false;
    };
  }, [main]);

  const pickMain = (id: string) => {
    setMainId(id);
    const r = roots.find((x) => x.id === id);
    // ช่องทางหลักที่ไม่มีช่องทางรอง = เลือกเสร็จที่ตัวหลัก
    if (r && r.childCount === 0) {
      onChange({ id: r.id, name: r.name, parentId: null, parentName: null, isActive: r.isActive });
      setMainId('');
    }
  };

  const pickSub = (id: string) => {
    const c = children.find((x) => x.id === id);
    if (!c) return;
    onChange(c);
    // โหมดเพิ่มทีละตัว (MultiChannelPicker) — ล้างให้เลือกตัวถัดไปได้เลย
    setMainId('');
  };

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn('inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-0.5 text-xs font-medium', TONE.primary.chip)}>
          <span className="truncate">{recruitChannelLabel(value)}</span>
          <Button type="button" variant="ghost" size="iconXs" onClick={() => onChange(null)} aria-label="เอาช่องทางนี้ออก เลือกใหม่" className="h-5 w-5 rounded-full">
            <X aria-hidden />
          </Button>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="channel-picker">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">ช่องทางหลัก</Label>
          <Select value={mainId} onValueChange={pickMain} disabled={rootsLoading || roots.length === 0}>
            <SelectTrigger className="h-9 text-sm" aria-label="ช่องทางหลัก">
              <SelectValue placeholder={rootsLoading ? 'กำลังโหลดช่องทาง…' : 'เลือกช่องทางหลัก'} />
            </SelectTrigger>
            <SelectContent>
              {roots.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">ช่องทางรอง</Label>
          <Select value="" onValueChange={pickSub} disabled={!main || childLoading || children.length === 0}>
            <SelectTrigger className="h-9 text-sm" aria-label="ช่องทางรอง">
              <SelectValue placeholder={!main ? 'เลือกช่องทางหลักก่อน' : childLoading ? 'กำลังโหลด…' : 'เลือกช่องทางรอง'} />
            </SelectTrigger>
            <SelectContent>
              {children.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {failed ? <p className={cn('text-xs', TONE.danger.value)}>โหลดช่องทางไม่สำเร็จ</p> : null}
      {!rootsLoading && !failed && roots.length === 0 ? <p className="text-xs text-muted-foreground">ยังไม่มีช่องทาง</p> : null}
      <p className="text-xs text-muted-foreground">{footHint ?? 'เลือกได้ 1 ช่อง'}</p>
    </div>
  );
};

export default ChannelPicker;

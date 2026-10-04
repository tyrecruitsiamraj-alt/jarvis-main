import React from 'react';
import { X } from 'lucide-react';
import ChannelPicker from '@/components/shared/ChannelPicker';
import { Button } from '@/components/ui/button';
import { recruitChannelLabel, type RecruitChannelMatch } from '@/lib/recruitPostings';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * เลือกช่องทางได้หลายช่องในครั้งเดียว → สร้างลิงก์ได้ช่องละ 1 ลิงก์ทีเดียว
 * (เจ้าของ 4 ต.ค. 2569: *"สามารถ Gen ทีละหลายๆ Link ทีเดียวได้ · ช่องเลือกเลือกได้ทีละหลายๆอัน"* — แทนข้อเคาะ 2 ก.ย. ที่ให้ 1 ช่อง)
 *
 * ใช้ตัวเลือกเดิม (`ChannelPicker` หลัก → รอง) เป็นตัวเพิ่ม — เลือกแล้วลิสต์ยังอยู่ให้เพิ่มต่อ ·
 * ที่เลือกแล้วขึ้นเป็นชิป กด X เอาออก · เลือกซ้ำช่องเดิมไม่เพิ่มซ้ำ
 * ⚠️ 1 ลิงก์ = 1 ช่องทางยังเหมือนเดิม (ผู้สมัครมาจากช่องไหนยังนับแยกได้) — แค่สร้างหลายลิงก์ในครั้งเดียว
 */
/** ฝั่ง API สร้างได้ไม่เกิน 20 ลิงก์ต่อครั้ง (`api/_lib/recruitPostings.ts` ตัดที่ 20) — ฝั่งจอกันไว้ก่อน */
const MAX_CHANNELS = 20;

const MultiChannelPicker: React.FC<{
  value: RecruitChannelMatch[];
  onChange: (next: RecruitChannelMatch[]) => void;
  reloadKey?: unknown;
}> = ({ value, onChange, reloadKey }) => {
  const add = (c: RecruitChannelMatch | null) => {
    if (!c || value.some((v) => v.id === c.id) || value.length >= MAX_CHANNELS) return;
    onChange([...value, c]);
  };
  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="ช่องทางที่เลือก">
          {value.map((c) => (
            <span
              key={c.id}
              className={cn('inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-0.5 text-xs font-medium', TONE.primary.chip)}
            >
              <span className="truncate">{recruitChannelLabel(c)}</span>
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                onClick={() => onChange(value.filter((v) => v.id !== c.id))}
                aria-label={`เอา ${recruitChannelLabel(c)} ออก`}
                className="h-5 w-5 rounded-full"
              >
                <X aria-hidden />
              </Button>
            </span>
          ))}
        </div>
      ) : null}
      {value.length >= MAX_CHANNELS ? (
        <p className={cn('text-xs', TONE.warn.value)}>เลือกได้ครั้งละไม่เกิน {MAX_CHANNELS} ช่องทาง</p>
      ) : (
        <ChannelPicker value={null} onChange={add} reloadKey={reloadKey} footHint="เลือกได้หลายช่อง ได้ลิงก์ช่องละ 1 อัน" />
      )}
    </div>
  );
};

export default MultiChannelPicker;

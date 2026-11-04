import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { soGroupLinkName, soGroupSections, soSectorBlocks, soSectorFoldOpen, type SoGroup, type SoGroupSection } from '@/lib/soScraping';
import type { UnitSector } from '@/lib/unitSector';

/**
 * ═══ เลือกกลุ่ม Facebook ตอน Gen link (เจ้าของ 2 พ.ย. 2569) ═══
 * รายชื่อจาก So Scraping (ไม่พิมพ์เอง) · หมวดตามธุรกิจ ธุรกิจของใบขอกางอยู่ ที่เหลือพับ · ไม่ติ๊กให้ (ทุกกลุ่มที่ติ๊ก = 1 ลิงก์ที่ต้องเอาไปโพสต์เอง)
 * หัวหมวดมีช่องติ๊กเลือก/เอาออกทั้งหมวด
 */
export default function SoGroupPicker({
  groups,
  jobBu,
  jobSector = null,
  value,
  onChange,
}: {
  groups: readonly SoGroup[] | null;
  /** ธุรกิจของใบขอ · null = ไม่รู้ (กล่องลอย) ทุกหมวดพับ */
  jobBu: string | null;
  /** ราชการ/เอกชนของใบขอ — หัวข้อย่อยประเภทเดียวกับใบขอขึ้นก่อน (4 พ.ย. 2569) */
  jobSector?: UnitSector | null;
  value: readonly string[];
  /** รับตัวอัปเดตจากค่าล่าสุด — กดติดกันเร็ว ๆ ต้องไม่ทับกัน */
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  if (groups === null) return <p className="text-xs text-muted-foreground">กำลังโหลดกลุ่ม Facebook…</p>;
  if (groups.length === 0) return <p className={cn('text-xs', TONE.warn.value)}>ยังไม่มีกลุ่ม Facebook ใน So Scraping — เพิ่มที่ ตั้งค่า → กลุ่มโพสต์</p>;
  const sections = soGroupSections(groups, jobBu);
  const toggle = (ids: string[], on: boolean) => onChange((prev) => (on ? [...new Set([...prev, ...ids])] : prev.filter((x) => !ids.includes(x))));
  return (
    <div className="space-y-2" data-testid="genlink-so-groups">
      {sections.map((sec) => (
        <Section key={sec.bu ?? '__none__'} section={sec} all={groups} jobSector={jobSector} value={value} onToggle={toggle} />
      ))}
    </div>
  );
}

function Section({
  section,
  all,
  jobSector,
  value,
  onToggle,
}: {
  section: SoGroupSection<SoGroup>;
  /** ทุกกลุ่ม — ชื่อซ้ำต่อท้ายรหัสกลุ่ม ตรงกับชื่อบนลิงก์ */
  all: readonly SoGroup[];
  jobSector: UnitSector | null;
  value: readonly string[];
  onToggle: (ids: string[], on: boolean) => void;
}) {
  const [open, setOpen] = React.useState(section.forJob);
  const ids = section.groups.map((g) => g.id);
  const n = ids.filter((id) => value.includes(id)).length;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border/70" data-testid={`genlink-bu-${section.bu ?? 'none'}`}>
      {/* ช่องติ๊กทั้งหมดย้ายไปหัวข้อย่อย ราชการ / เอกชน (เจ้าของ 4 พ.ย. 2569 · ติ๊กหัวธุรกิจเดียวได้ 212 ลิงก์) */}
      <div className="flex items-center gap-2 px-3 py-2">
        <p className="flex-1 text-sm font-medium tabular-nums text-foreground">
          {section.label} · เลือก {n} จาก {ids.length}
        </p>
        <CollapsibleTrigger asChild>
          <Button type="button" size="xs" variant="ghost" aria-label={open ? `พับ ${section.label}` : `กาง ${section.label}`}>
            {open ? 'พับ' : 'กาง'}
            <ChevronDown className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="max-h-64 space-y-3 overflow-y-auto border-t border-border/70 px-3 py-2">
          {/* แยก ราชการ / เอกชน ในหมวดธุรกิจ (เจ้าของ 4 พ.ย. 2569) */}
          {soSectorBlocks(section.groups, jobSector).map((block, i) => (
            <SoSectorFold
              key={block.sector ?? 'none'}
              label={block.label}
              ids={block.groups.map((g) => g.id)}
              picked={value}
              onToggle={onToggle}
              checkId={`genlink-sector-${section.bu ?? 'none'}-${block.sector ?? 'none'}`}
              defaultOpen={soSectorFoldOpen(block.sector, jobSector, i)}
              testId={`genlink-sector-${block.sector ?? 'none'}`}
            >
              <ul className="space-y-1.5">
                {block.groups.map((g) => (
                  <li key={g.id} className="flex items-start gap-2">
                    <Checkbox id={`genlink-group-${g.id}`} checked={value.includes(g.id)} onCheckedChange={(v) => onToggle([g.id], v === true)} className="mt-0.5" />
                    <Label htmlFor={`genlink-group-${g.id}`} className="text-sm font-normal text-foreground">
                      {soGroupLinkName(g, all)}
                    </Label>
                  </li>
                ))}
              </ul>
            </SoSectorFold>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}


/**
 * หัวข้อย่อย ราชการ / เอกชน ในหมวดธุรกิจ (เจ้าของ 4 พ.ย. 2569) — พับ/กางได้ · ช่องติ๊กเลือก/เอาออกทั้งหัวข้อ
 * (ย้ายมาจากหัวธุรกิจ — ติ๊กหัวธุรกิจเดียวเคยได้ทุกกลุ่มรวมราชการ 2,400 กลุ่ม)
 * พับอยู่ = ไม่วาดแถว (วาด 2,400 แถวพร้อมกันทำป๊อปหน่วง)
 */
export function SoSectorFold({
  label,
  ids,
  picked,
  onToggle,
  checkId,
  defaultOpen,
  testId,
  children,
}: {
  label: string;
  ids: readonly string[];
  picked: readonly string[];
  onToggle: (ids: string[], on: boolean) => void;
  checkId: string;
  defaultOpen: boolean;
  testId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const n = ids.filter((id) => picked.includes(id)).length;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-1.5" data-testid={testId}>
      <div className="flex items-center gap-2">
        <Checkbox
          id={checkId}
          checked={n === 0 ? false : n === ids.length ? true : 'indeterminate'}
          onCheckedChange={(v) => onToggle([...ids], v === true)}
          aria-label={`เลือกทุกกลุ่ม${label}`}
        />
        <Label htmlFor={checkId} className="flex-1 text-xs font-medium tabular-nums text-muted-foreground">
          {label} · เลือก {n} จาก {ids.length}
        </Label>
        <CollapsibleTrigger asChild>
          <Button type="button" size="xs" variant="ghost" aria-label={open ? `พับ ${label}` : `กาง ${label}`}>
            {open ? 'พับ' : 'กาง'}
            <ChevronDown className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

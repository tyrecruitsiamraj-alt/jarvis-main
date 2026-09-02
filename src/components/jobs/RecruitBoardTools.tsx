import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquareWarning, Plus, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { STANDALONE_POSTING_KINDS } from '@/lib/recruitPostings';
import { heroButton, heroButtonSolid } from '@/components/shared/PageHeroStrip';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';
import ReasonManagerDialog from '@/components/recruit-rm/ReasonManagerDialog';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { RM_TOOLBAR_LABEL, type RmToolbarKey } from '@/lib/recruitRm';

const BU_OPTIONS = ['LBD', 'LBA', 'LM', 'DS', 'SN'];

const fieldCls =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30';

/** เลือกประเภทกล่องลอย + BU ก่อนเข้าฟอร์มสร้างลิงก์ */
const StandalonePickerDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onPick: (v: { kind: string; kindLabel: string; departmentCode: string }) => void;
}> = ({ open, onClose, onPick }) => {
  const [kind, setKind] = useState<string>(STANDALONE_POSTING_KINDS[0].code);
  const [bu, setBu] = useState(BU_OPTIONS[0]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-[26rem] rounded-2xl p-0">
        <DialogHeader className="border-b border-border/50 px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold">ประกาศลอย (ไม่ผูกใบขอ)</DialogTitle>
          <DialogDescription className="text-xs">
            เลือกกล่องที่จะให้ผู้สมัครเข้า และ BU ที่รับผิดชอบ
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">ประเภทกล่อง</label>
            <select className={fieldCls} value={kind} onChange={(e) => setKind(e.target.value)}>
              {STANDALONE_POSTING_KINDS.map((k) => (
                <option key={k.code} value={k.code}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              BU * <span className="font-normal">(บังคับ — ไม่มีใบขอให้ดึงมา)</span>
            </label>
            <select className={fieldCls} value={bu} onChange={(e) => setBu(e.target.value)}>
              {BU_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              const label = STANDALONE_POSTING_KINDS.find((k) => k.code === kind)?.label ?? kind;
              onPick({ kind, kindLabel: label, departmentCode: bu });
            }}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            ถัดไป — กรอกรายละเอียด
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * แถบเครื่องมือของบอร์ดรับสมัคร — ชุดเดียวกับระบบเดิม (เจ้าของสั่ง 11 ส.ค. 2569)
 * ช่องทาง · สร้างลิงก์ · เหตุผล
 *
 * ⚠️ **ทุกปุ่มต่อเข้าของที่ทำงานจริง ไม่ได้สร้างของซ้ำ:**
 *   - "ช่องทาง"    = ปุ่มที่เคยชื่อ "จัดการช่องทาง" → พาไปหน้า `/recruit/channels`
 *                  (19 ส.ค. 2569 เปลี่ยนจากป๊อปอัปเป็นหน้าเต็มจอ — ป๊อปอัปเดิมถอดออกแล้ว)
 *   - "สร้างลิงก์"  = ปุ่มที่เคยชื่อ "ประกาศลอย" → StandalonePickerDialog + GenApplyLinkDialog เดิม
 *   - "เหตุผล"     = master เหตุผลที่ยกมาจาก `recruit_master_reason` → ReasonManagerDialog
 * เปลี่ยนแค่ชื่อบนปุ่มให้ตรงกับระบบเดิมที่ผู้ใช้คุ้น · **ฟังก์ชันไม่หายไปไหน**
 *
 * ⚠️ **ไม่มีปุ่ม "ตำแหน่งงาน" กับ "รายงาน"** — เจ้าของสั่งเอาออก
 *
 * ⚠️ ชื่อ/ลำดับปุ่มมาจาก `RM_TOOLBAR_KEYS`/`RM_TOOLBAR_LABEL` ใน `lib/recruitRm.ts`
 * **ที่เดียวกับหน้างานสรรหา (RM)** — สองที่จะไม่มีวันเพี้ยนชื่อกันเอง
 *
 * ทั้งแถบยังอยู่ใต้สิทธิ์ `recruit_postings` เหมือนเดิม (role ที่ไม่ได้เปิดจะไม่เห็นทั้งแถบ)
 */
const RecruitBoardTools: React.FC<{
  variant?: 'light' | 'onDark';
  /**
   * เมนูเสริมที่หน้าเรียกส่งเข้ามา — ต่อท้ายเมนู "ตั้งค่าบอร์ด"
   * (20 ส.ค. 2569: ใช้เก็บปุ่ม Pre-Check ที่เดิมลอยเดี่ยวอยู่กลางหน้ากล่องงาน)
   */
  extraMenuItems?: { key: string; label: string; icon: React.ElementType; onSelect: () => void }[];
}> = ({ variant = 'light', extraMenuItems = [] }) => {
  const { isFunctionEnabled } = useRolePermissions();
  const navigate = useNavigate();
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [standalone, setStandalone] = useState<
    { kind: string; kindLabel: string; departmentCode: string } | null
  >(null);

  /**
   * 🔴 **แถบนี้มีสองสิทธิ์ปนกัน** (เจ้าของสั่ง 2 ก.ย. 2569 ให้ staff เข้าถึงช่องทางได้)
   * · ปุ่ม "ช่องทาง" ใช้ `recruit_channels_manage` (staff ขึ้นไป)
   * · ปุ่ม "สร้างลิงก์ (ประกาศลอย)" กับ "เหตุผล" ยังใช้ `recruit_postings` (หัวหน้างานขึ้นไป)
   *   เพราะอันนั้นคือของที่ออกไปให้คนนอกเห็น
   * ปิดหมดทั้งสองอย่างค่อยซ่อนทั้งแถบ
   */
  const canPostings = isFunctionEnabled('recruit_postings');
  const canChannels = isFunctionEnabled('recruit_channels_manage');
  if (!canPostings && !canChannels) return null;

  /**
   * ⚠️ ปุ่ม "สร้างลิงก์" ของแถบนี้ต้องต่อท้ายว่า **(ประกาศลอย)**
   * เพราะการ์ดใบขอทุกใบบนบอร์ดมีปุ่ม "สร้างลิงก์" ของตัวเองอยู่แล้ว (ลิงก์ของใบนั้น)
   * ชื่อเหมือนกันแต่ทำคนละอย่างคือปัญหาเดียวกับที่เจ้าของเคยทักเรื่องเมนูซ้ำสองอัน
   * — อันนี้คือลิงก์ที่ไม่ผูกใบขอ (ของเดิมชื่อ "ประกาศลอย")
   */
  const LABEL: Record<RmToolbarKey, string> = {
    ...RM_TOOLBAR_LABEL,
    link: `${RM_TOOLBAR_LABEL.link} (ประกาศลอย)`,
  };

  const ICONS: Record<RmToolbarKey, typeof Settings2> = {
    channels: Settings2,
    link: Plus,
    reasons: MessageSquareWarning,
  };

  const onClickKey = (key: RmToolbarKey) => {
    setNotice(null);
    // "ช่องทาง" เป็นหน้าเต็มจอแล้ว (เจ้าของเคาะ 19 ส.ค. 2569) — ป๊อปอัปเดิมถอดออกทั้งก้อน
    if (key === 'channels') return navigate('/recruit/channels');
    if (key === 'reasons') return setReasonsOpen(true);
    if (key === 'link') return setPickerOpen(true);
    setNotice(`ปุ่ม "${RM_TOOLBAR_LABEL[key]}" — ยังไม่ได้ต่อกับระบบจริง`);
  };

  const btnCls = (key: RmToolbarKey) => {
    // "สร้างลิงก์" เป็นปุ่มหลักของแถบนี้ (เดิม "ประกาศลอย" ใช้ทรงทึบ) — คงน้ำหนักเดิมไว้
    if (variant === 'onDark') return key === 'link' ? heroButtonSolid : heroButton;
    return key === 'link'
      ? 'inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15'
      : 'inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary';
  };

  /** งานระดับตั้งค่า (ใช้ไม่บ่อย) — ยุบเข้าเมนูเดียว (เจ้าของสั่ง 20 ส.ค. 2569:
   *  จัดระเบียบหน้าบอร์ด ไม่เพิ่มของใหม่) · "สร้างลิงก์" เป็นงานประจำ คงเป็นปุ่มเด่น */
  const MENU_KEYS: RmToolbarKey[] = [
    ...(canChannels ? (['channels'] as RmToolbarKey[]) : []),
    ...(canPostings ? (['reasons'] as RmToolbarKey[]) : []),
  ];

  return (
    <>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          {/* ปล่อยประกาศ = ของที่คนนอกเห็น ⇒ ยังเป็นสิทธิ์หัวหน้างานขึ้นไป */}
          {canPostings ? (
            <button
              type="button"
              onClick={() => onClickKey('link')}
              title="สร้างลิงก์รับสมัครที่ไม่ผูกกับใบขอ"
              className={btnCls('link')}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> {LABEL.link}
            </button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger className={btnCls('channels')}>
              <Settings2 className="h-3.5 w-3.5" aria-hidden /> ตั้งค่าบอร์ด
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {MENU_KEYS.map((key) => {
                const Icon = ICONS[key];
                return (
                  <DropdownMenuItem key={key} onClick={() => onClickKey(key)}>
                    <Icon className="h-3.5 w-3.5" aria-hidden /> {RM_TOOLBAR_LABEL[key]}
                  </DropdownMenuItem>
                );
              })}
              {extraMenuItems.map((item) => (
                <DropdownMenuItem key={item.key} onClick={item.onSelect}>
                  <item.icon className="h-3.5 w-3.5" aria-hidden /> {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {notice ? (
          <p
            className={
              variant === 'onDark'
                ? 'text-[11px] font-medium text-amber-200'
                : 'text-[11px] font-medium text-amber-700 dark:text-amber-300'
            }
          >
            {notice}
          </p>
        ) : null}
      </div>

      <ReasonManagerDialog open={reasonsOpen} onClose={() => setReasonsOpen(false)} />
      <StandalonePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(v) => {
          setPickerOpen(false);
          setStandalone(v);
        }}
      />
      <GenApplyLinkDialog
        open={!!standalone}
        job={null}
        standalone={standalone}
        onClose={() => setStandalone(null)}
      />
    </>
  );
};

export default RecruitBoardTools;

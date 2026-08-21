import { cn } from '@/lib/utils';
import React, { useEffect, useState } from 'react';
import type { RecruitPosting } from '@/lib/recruitPostings';
import { updateRecruitPosting, type UpdatePostingBody } from '@/lib/recruitPostingsApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TONE } from '@/lib/designTokens';
import { Loader2, Pencil } from 'lucide-react';

const fieldCls =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30';

export type EditPostingDialogProps = {
  /**
   * true = คืน**เนื้อฟอร์มเปล่า ๆ** ไม่ห่อ Dialog — ใช้ตอนฝังเป็นแท็บในป๊อปอัปของการ์ด
   * (เจ้าของเคาะ 19 ส.ค. 2569) · 🔴 ห้ามซ้อน Dialog ใน Dialog
   */
  embedded?: boolean;
  /** ประกาศที่จะแก้ — null = ปิดกล่อง */
  posting: RecruitPosting | null;
  onClose: () => void;
  /** เรียกหลังบันทึกสำเร็จ พร้อมประกาศที่อัปเดตแล้ว (ให้หน้าเรียกเอาไปทับใน state) */
  onSaved?: (updated: RecruitPosting) => void;
};

/**
 * แก้เนื้อหาประกาศรับสมัคร (mockup rev.3 ข้อ 04 — ปุ่ม "แก้ไข" บนการ์ด)
 *
 * แก้ได้เฉพาะสิ่งที่ผู้สมัครเห็น — ประเภทกล่อง/BU/ใบขอที่ผูกไว้ **แก้ที่นี่ไม่ได้**
 * เพราะเป็นตัวกำหนดสิทธิ์การมองเห็น (กันย้ายประกาศข้าม BU) อยากย้ายให้ปิดแล้วสร้างใหม่
 * ช่องทาง/ลิงก์ก็ไม่แก้ที่นี่ — ลิงก์ที่ปล่อยออกไปแล้วต้องใช้ได้ต่อ เพิ่มช่องทางใหม่ทำที่ "สร้างลิงก์"
 */
const EditPostingDialog: React.FC<EditPostingDialogProps> = ({ posting, onClose, onSaved, embedded = false }) => {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [locationText, setLocationText] = useState('');
  const [salaryText, setSalaryText] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!posting) return;
    setError(null);
    setSaving(false);
    setSavedAt(null);
    setTitle(posting.title ?? '');
    setDetail(posting.detail ?? '');
    setLocationText(posting.locationText ?? '');
    setSalaryText(posting.salaryText ?? '');
    setContactName(posting.contactName ?? '');
    setContactPhone(posting.contactPhone ?? '');
  }, [posting]);

  const submit = async () => {
    if (!posting || saving) return;
    setSaving(true);
    setError(null);
    try {
      const patch: UpdatePostingBody = {
        title,
        detail: detail || null,
        locationText: locationText || null,
        salaryText: salaryText || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
      };
      const updated = await updateRecruitPosting(posting.id, patch);
      setSavedAt(Date.now());
      onSaved?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'แก้ประกาศไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const body = (
        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">หัวข้อประกาศ *</label>
            <input className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              รายละเอียดที่ผู้สมัครเห็น
            </label>
            <textarea
              className={`${fieldCls} min-h-[76px]`}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="เช่น ลักษณะงาน เวลาทำงาน สวัสดิการ"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">สถานที่ทำงาน</label>
            {/* 🔴 อ่านอย่างเดียว (เจ้าของสั่ง 20 ส.ค. 2569: "ไม่ให้แก้ไข...สถานที่ทำงาน
                เอา dropdown ไปใส่แทน") — ที่อยู่ก้อนนี้มาจาก ERP · พื้นที่บนประกาศแก้ที่
                dropdown จังหวัด/อำเภอ/ตำบล ในส่วน "ข้อมูลที่จะขึ้นประกาศ" ข้างล่างที่เดียว
                กันสองช่องขัดกันเอง */}
            <input className={cn(fieldCls, 'opacity-70')} value={locationText} readOnly disabled />
            <p className="text-[11px] text-muted-foreground">
              จาก ERP · แก้พื้นที่บนประกาศได้ที่ &quot;พื้นที่ทำงาน&quot; ด้านล่าง
            </p>
          </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ค่าตอบแทน</label>
              <input
                className={fieldCls}
                value={salaryText}
                onChange={(e) => setSalaryText(e.target.value)}
                placeholder="เช่น 15,000–18,000 บาท"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ผู้ติดต่อ</label>
              <input
                className={fieldCls}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">เบอร์ติดต่อ</label>
              <input
                className={fieldCls}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>

          {posting && posting.links.length > 0 ? (
            <p className={`rounded-xl px-3 py-2 text-[11px] ${TONE.neutral.soft} ${TONE.neutral.value}`}>
              ประกาศนี้มีลิงก์ {posting.links.length.toLocaleString('th-TH')} อัน — แก้ข้อความแล้ว
              ทุกลิงก์เห็นข้อความใหม่ทันที ไม่ต้องส่งลิงก์ใหม่
            </p>
          ) : null}

          {error ? <p className={`text-xs ${TONE.danger.value}`}>{error}</p> : null}
          {savedAt ? (
            <p className={`rounded-xl px-3 py-2 text-xs ${TONE.success.soft} ${TONE.success.value}`}>
              บันทึกแล้ว
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              {savedAt ? 'ปิด' : 'ยกเลิก'}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || !title.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </div>
  );

  /** ฝังเป็นแท็บในป๊อปอัปของการ์ด = คืนเนื้อฟอร์มเปล่า ๆ (ห้ามซ้อน Dialog ใน Dialog) */
  if (embedded) return body;

  return (
    <Dialog open={!!posting} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-[34rem] flex-col gap-0 overflow-hidden rounded-[1.5rem] border-border/70 p-0">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/50 bg-gradient-to-b from-primary/[0.07] to-transparent px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Pencil className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight sm:text-lg">
                แก้ไขประกาศ
              </DialogTitle>
              <DialogDescription className="mt-0.5 line-clamp-2 text-xs leading-snug">
                แก้รายละเอียดที่ผู้สมัครเห็น · ลิงก์ที่ปล่อยไปแล้วยังใช้ได้ทุกอัน
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {body}
      </DialogContent>
    </Dialog>
  );
};

export default EditPostingDialog;

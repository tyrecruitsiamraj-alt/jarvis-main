import React, { useEffect, useState } from 'react';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { buildOnlineNameOptions } from '@/lib/jobStaffNames';
import { refreshJobStaffFromApi } from '@/lib/jobStaffRemote';
import {
  applyLinkPath,
  recruitChannelLabel,
  type RecruitChannelMatch,
} from '@/lib/recruitPostings';
import { createRecruitPosting, type CreatePostingBody } from '@/lib/recruitPostingsApi';
import ChannelPicker from '@/components/shared/ChannelPicker';
import JobTitleField from '@/components/shared/JobTitleField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, ChevronDown, Copy, Link2, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { THAI_PROVINCE_NAMES_SORTED } from '@/lib/thaiProvinces';
import { inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';
import { RM_FORM_TYPES, RM_SPECIFIC_TYPES } from '@/lib/recruitRmMasters';
import { createShortLink } from '@/lib/shortLinksApi';

export type GenApplyLinkDialogProps = {
  /**
   * true = คืน**เนื้อฟอร์มเปล่า ๆ** ไม่ห่อ Dialog — ใช้ตอนฝังเป็นแท็บในป๊อปอัปของการ์ด
   * (เจ้าของเคาะ 19 ส.ค. 2569: ป๊อปอัปเดียวมีแท็บไอคอน รายละเอียด → แก้ไข → Gen link)
   * 🔴 ห้ามซ้อน Dialog ใน Dialog — ฝังต้องใช้โหมดนี้เท่านั้น
   */
  embedded?: boolean;
  open: boolean;
  job: JobRequest | null;
  onClose: () => void;
  /** สร้างประกาศลอย (ไม่ผูกใบขอ) — ส่งประเภทกล่อง + BU มาแทน job */
  standalone?: { kind: string; kindLabel: string; departmentCode: string } | null;
  onCreated?: () => void;
};

function LinkRow({ url, label }: { url: string; label?: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ผู้ใช้เลือกคัดลอกเองได้ */
    }
  };
  return (
    <div className="space-y-1">
      {label ? <p className="text-[11px] font-medium text-muted-foreground">{label}</p> : null}
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{url}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
        </button>
      </div>
    </div>
  );
}

const fieldCls =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30';

/**
 * สร้างประกาศรับสมัคร + ลิงก์ต่อช่องทาง — ทำจบในที่เดียวจากกล่องงาน
 *
 * เดิมกล่องนี้แค่คัดลอก /apply?job=<id> เปล่า ๆ ตอนนี้กรอกรายละเอียดที่ผู้สมัครจะเห็น
 * แล้วติ๊กช่องทางได้หลายช่อง → ได้ลิงก์แยกช่องทางทีเดียว รู้ว่าคนสมัครมาจากช่องไหน
 */
const GenApplyLinkDialog: React.FC<GenApplyLinkDialogProps> = ({
  open,
  job,
  onClose,
  standalone = null,
  onCreated,
  embedded = false,
}) => {
  const [picked, setPicked] = useState<RecruitChannelMatch[]>([]);
  /** ลิสต์ช่องทางหุบไว้ก่อน — กางเมื่อจะเลือกจริง (เหตุผลอยู่ที่จุดเรียกใช้) */
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [locationText, setLocationText] = useState('');
  const [salaryText, setSalaryText] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  // ── ข้อมูลที่ระบบเดิมเก็บตอนสร้างลิงก์ (เจ้าของสั่ง 11 ส.ค. 2569) ──
  const [positionName, setPositionName] = useState('');
  const [province, setProvince] = useState('');
  const [responsible, setResponsible] = useState('');
  /**
   * "ข้อมูลเจาะจง" ถูกถอดออกจากฟอร์ม 17 ส.ค. 2569 (เจ้าของสั่ง) — ไม่มีใครกรอกจริง
   * ⚠️ **ไม่ได้ลบฟิลด์ฝั่งหลังบ้าน** ประกาศเก่าที่เคยกรอกไว้ยังอ่านได้เหมือนเดิม
   * ส่งเป็น null ตลอดจากหน้านี้แทน (ลบคอลัมน์ = ข้อมูลเก่าหาย ซึ่งไม่ได้สั่ง)
   */
  const specificType = '';
  const [formType, setFormType] = useState<string>('rm');
  /** ชื่อทีม Online — ที่มาของช่อง "ผู้รับผิดชอบ" (เจ้าของสั่ง 19 ส.ค. 2569) */
  const [onlineNames, setOnlineNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<Array<{ code: string; label: string | null }>>([]);
  /** code เดิม → path สั้น · ระบบเดิมมี checkbox "ตัด URL ให้สั้นลง" */
  const [shortLinks, setShortLinks] = useState<Record<string, string>>({});
  const [shortening, setShortening] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLinks([]);
    setSaving(false);
    // เติมค่าจากใบขอให้อัตโนมัติ — ไม่ต้องพิมพ์ซ้ำสิ่งที่ ERP มีอยู่แล้ว
    /**
     * 🔴 **หัวข้อประกาศต้องนำด้วยตำแหน่งงาน ไม่ใช่ชื่อบริษัท** (แก้ 27 ส.ค. 2569)
     *
     * ของเดิมเติม `jobBoardCardTitle` = `unit_name` = **ชื่อหน่วยงาน** ลงช่องนี้
     * แล้วค่านี้ไปเป็น `<h1>` บนหน้าสมัครสาธารณะ (`PublicPostingApplyPage`)
     * ⇒ คนหางานกดลิงก์มาเจอหัวเรื่องว่า *"ธนบุรีประกอบรถยนต์"* ไม่ได้บอกว่ารับตำแหน่งอะไร
     *
     * เจอตอนให้โมเดลอ่อนสุดสวมบทพนักงานใหม่มาทำภารกิจ "ไปสร้างลิงก์รับสมัคร" —
     * มันเดินถึงฟอร์มได้ แต่ **ไม่กล้ากดปุ่มสุดท้าย (มั่นใจ 1/10)** เหตุผลข้อแรกคือ
     * *"หัวข้อประกาศ 'ธนบุรีประกอบรถยนต์' อาจไม่ใช่ตำแหน่งที่เหมาะสม"* — มันถูก
     *
     * ⚠️ เปลี่ยนแค่**ค่าตั้งต้นของประกาศใหม่** · ประกาศเก่าที่สร้างไปแล้วไม่ถูกแตะ
     */
    setTitle(
      job
        ? [publicJobPositionLabel(job), jobBoardCardTitle(job)].filter(Boolean).join(' · ')
        : standalone
          ? standalone.kindLabel
          : '',
    );
    setDetail('');
    setLocationText(job?.location_address ?? '');
    setSalaryText('');
    setContactName(job?.contact_name ?? '');
    setContactPhone(job?.contact_phone ?? '');
    // ตำแหน่ง/จังหวัด: ใบขอมีอยู่แล้ว ไม่ต้องให้พิมพ์ซ้ำ (staff_title_name = ตำแหน่งที่ขอ)
    // ประกาศลอยไม่มีใบขอ ใช้ชื่อกล่องเป็นตำแหน่งตั้งต้นแล้วแก้ได้
    setPositionName(job?.staff_title_name ?? standalone?.kindLabel ?? '');
    // จังหวัดไม่มีเป็นฟิลด์เดี่ยวในใบขอ — ถอดจากที่อยู่ด้วยตัวถอดเดิมที่ตัวกรองบอร์ดใช้
    setProvince(job ? (inferProvinceFromAddress(job.location_address || '') ?? '') : '');
    setResponsible('');
    setFormType('rm');
    setShortLinks({});
    setPicked([]);
    setChannelsOpen(false);
    /**
     * ผู้รับผิดชอบ = **ทีม Online** ที่เพิ่มไว้ในหน้าตั้งค่า (เจ้าของสั่ง 19 ส.ค. 2569)
     * เดิมดึงผู้ใช้ทั้งระบบมาให้เลือก ซึ่งได้ชื่อคนที่ไม่เกี่ยวกับงานประกาศเลย
     * ⚠️ roster เก็บเป็น **ชื่อ** ไม่ใช่ user id — ประกาศจึงบันทึกที่ `responsibleName`
     * (`responsibleUserId` เป็น null ตั้งใจ · ฟิลด์นั้นมีไว้ตอนผูกกับ user จริงเท่านั้น)
     */
    void refreshJobStaffFromApi()
      .then(() => setOnlineNames(buildOnlineNameOptions()))
      .catch(() => setOnlineNames(buildOnlineNameOptions()));
  }, [open, job, standalone]);

  /**
   * ⚠️ ล้มแล้วต้องคืนเป็นลิงก์ยาว ไม่ใช่ปล่อยติ๊กค้างทั้งที่ยังเป็นลิงก์เดิม
   * (ผู้ใช้จะคัดลอกลิงก์ยาวไปโดยคิดว่าสั้นแล้ว)
   */
  const toggleShort = async (want: boolean) => {
    if (!want) {
      setShortLinks({});
      return;
    }
    setShortening(true);
    try {
      const pairs = await Promise.all(
        links.map(async (l) => [l.code, (await createShortLink(applyLinkPath(l.code))).path] as const),
      );
      setShortLinks(Object.fromEntries(pairs));
    } catch (e) {
      setShortLinks({});
      setError(e instanceof Error ? e.message : 'ตัดลิงก์ให้สั้นไม่สำเร็จ');
    } finally {
      setShortening(false);
    }
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const body: CreatePostingBody = {
        jobId: job?.id ?? null,
        standaloneKind: job ? null : standalone?.kind ?? null,
        departmentCode: job ? job.department_code ?? null : standalone?.departmentCode ?? null,
        title,
        detail: detail || null,
        locationText: locationText || null,
        salaryText: salaryText || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        channels: picked.map((c) => ({ channelId: c.id, label: recruitChannelLabel(c) })),
        positionName: positionName.trim() || null,
        province: province || null,
        responsibleName: responsible || null,
        responsibleUserId: null,
        specificType: specificType || null,
        formType,
      };
      const created = await createRecruitPosting(body);
      setLinks(created.links.map((l) => ({ code: l.code, label: l.channelLabel })));
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างประกาศไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const heading = job ? jobBoardCardTitle(job) : standalone?.kindLabel ?? 'ประกาศรับสมัคร';

  const body = (
        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          {links.length > 0 ? (
            <div className="space-y-3">
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                สร้างประกาศแล้ว — ส่งลิงก์ตามช่องทางได้เลย ผู้สมัครที่กรอกเข้ามาจะอยู่ในกล่องนี้
              </p>
              {links.map((l) => (
                <LinkRow
                  key={l.code}
                  url={`${origin}${shortLinks[l.code] ?? applyLinkPath(l.code)}`}
                  label={l.label ?? 'ไม่ระบุช่องทาง'}
                />
              ))}
              {/* ระบบเดิมมี checkbox "ตัด URL ให้สั้นลง" — ฝั่งเรามี /api/short-links อยู่แล้ว
                  ติ๊กแล้วแปลงทุกลิงก์พร้อมกัน (ยิงซ้ำได้ ได้ code เดิม ไม่สร้างซ้ำ) */}
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 cursor-pointer accent-primary"
                  checked={Object.keys(shortLinks).length > 0}
                  disabled={shortening}
                  onChange={(e) => void toggleShort(e.target.checked)}
                />
                ตัด URL ให้สั้นลง
                {shortening ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              </label>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  หัวข้อประกาศ <span className="text-destructive">*</span>
                </label>
                <input className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} />
                {/* 🔴 บอกให้รู้ว่าค่านี้ไปโผล่ที่ไหน — คนกรอกจะได้รู้ว่าต้องเขียนให้คนนอกอ่านเข้าใจ */}
                <p className="text-[11px] leading-4 text-muted-foreground">
                  บรรทัดนี้คือ<span className="font-medium text-foreground">หัวเรื่องตัวใหญ่ที่ผู้สมัครเห็น</span>เมื่อกดลิงก์เข้ามา
                  — ควรขึ้นต้นด้วยตำแหน่งงาน
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  รายละเอียดที่ผู้สมัครเห็น <span className="font-normal opacity-70">(ไม่ใส่ก็ได้)</span>
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
                  <label className="text-xs font-medium text-muted-foreground">
                    สถานที่ทำงาน <span className="font-normal opacity-70">(ไม่ใส่ก็ได้)</span>
                  </label>
                  <input
                    className={fieldCls}
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    ค่าตอบแทน <span className="font-normal opacity-70">(ไม่ใส่ก็ได้)</span>
                  </label>
                  <input
                    className={fieldCls}
                    value={salaryText}
                    onChange={(e) => setSalaryText(e.target.value)}
                    placeholder="เช่น 15,000–18,000 บาท"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    ผู้ติดต่อ <span className="font-normal opacity-70">(ไม่ใส่ก็ได้)</span>
                  </label>
                  <input
                    className={fieldCls}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    เบอร์ติดต่อ <span className="font-normal opacity-70">(ไม่ใส่ก็ได้)</span>
                  </label>
                  <input
                    className={fieldCls}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* ── ข้อมูลที่ระบบเดิมเก็บตอนสร้างลิงก์ (เจ้าของสั่ง 11 ส.ค. 2569) ──
                  ตำแหน่ง/จังหวัดเติมจากใบขอให้แล้ว · ไม่บังคับกรอกเพื่อไม่ให้ประกาศลอย
                  ที่รีบส่งออกติดฟอร์ม แต่กรอกไว้แล้วรายงานย้อนหลังตอบได้ว่าลิงก์ไหนของงานไหน */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* ตำแหน่งของประกาศ — ลิสต์กรองตาม BU ของใบขอ/กล่องงานที่กำลังสร้างลิงก์ */}
                <JobTitleField
                  value={positionName}
                  onChange={setPositionName}
                  departmentCode={job?.department_code ?? standalone?.departmentCode ?? null}
                  inputClassName={fieldCls}
                  labelClassName="text-xs font-medium text-muted-foreground"
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">จังหวัด</label>
                  <select className={fieldCls} value={province} onChange={(e) => setProvince(e.target.value)}>
                    <option value="">ไม่ระบุ</option>
                    {THAI_PROVINCE_NAMES_SORTED.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">ผู้รับผิดชอบ</label>
                  <select
                    className={fieldCls}
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                  >
                    <option value="">ไม่ระบุ</option>
                    {onlineNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    ชื่อมาจากทีม Online (ตั้งค่า → สรรหา / คัดสรร / OPL / Online)
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">ประเภทฟอร์มการสมัคร</label>
                <div className="flex flex-wrap gap-1.5">
                  {RM_FORM_TYPES.map((f) => (
                    <button
                      key={f.code}
                      type="button"
                      onClick={() => setFormType(f.code)}
                      className={
                        formType === f.code
                          ? 'rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-semibold text-primary'
                          : 'rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-secondary'
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── ช่องทางที่จะส่ง — 🔴 **หุบไว้เป็นค่าตั้งต้น** (แก้ 27 ส.ค. 2569) ──
                  ของเดิมกางลิสต์ช่องทางทั้งหมด (30+ ช่อง) ⇒ กินครึ่งหน้าจอ
                  โมเดลที่สวมบทพนักงานใหม่มาลองทำภารกิจนี้บอกว่า
                  *"ช่องทางที่จะส่งเต็มครึ่งหน้า ยากต่อการมองหาช่องที่ต้องการ"*
                  ⚠️ ไม่เลือกช่องทางก็สร้างได้ (ได้ลิงก์กลาง 1 อัน) ⇒ หุบได้โดยไม่ขัดขวางใคร */}
              <div className="space-y-1.5 rounded-xl border border-border/60 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setChannelsOpen((v) => !v)}
                  aria-expanded={channelsOpen}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    ช่องทางที่จะส่ง{' '}
                    {picked.length > 0 ? (
                      <span className="font-semibold text-foreground">
                        — เลือกไว้ {picked.length} ช่อง
                      </span>
                    ) : (
                      <span className="font-normal opacity-70">(ไม่เลือกก็ได้ — จะได้ลิงก์กลาง 1 อัน)</span>
                    )}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      channelsOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>
                {channelsOpen ? (
                  <>
                    <ChannelPicker value={picked} onChange={setPicked} multiple reloadKey={open} />
                    <p className="text-[11px] text-muted-foreground">
                      เลือกได้หลายช่อง — ได้ลิงก์แยกช่องละอัน จะรู้ว่าคนสมัครมาจากช่องไหน
                    </p>
                  </>
                ) : null}
              </div>

              {error ? <p className="text-xs text-red-600">{error}</p> : null}

              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving || !title.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {saving ? 'กำลังสร้าง…' : 'สร้างประกาศ + ลิงก์'}
              </button>
            </>
          )}
        </div>
  );

  /** ฝังเป็นแท็บ = คืนเนื้อฟอร์มเปล่า ๆ (ห้ามซ้อน Dialog ใน Dialog) */
  if (embedded) return body;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-[34rem] flex-col gap-0 overflow-hidden rounded-[1.5rem] border-border/70 p-0">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/50 bg-gradient-to-b from-primary/[0.07] to-transparent px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Link2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight sm:text-lg">
                สร้างลิงก์รับสมัคร
              </DialogTitle>
              <DialogDescription className="mt-0.5 line-clamp-2 text-xs leading-snug">
                {heading} — กรอกรายละเอียดที่ผู้สมัครจะเห็น แล้วเลือกช่องทางที่จะส่ง
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {body}
      </DialogContent>
    </Dialog>
  );
};

export default GenApplyLinkDialog;

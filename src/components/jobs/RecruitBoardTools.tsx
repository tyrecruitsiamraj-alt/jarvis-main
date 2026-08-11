import React, { useEffect, useState } from 'react';
import { BarChart3, Loader2, MessageSquareWarning, Plus, Settings2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { STANDALONE_POSTING_KINDS, type RecruitChannel } from '@/lib/recruitPostings';
import { heroButton, heroButtonSolid } from '@/components/shared/PageHeroStrip';
import {
  fetchRecruitChannelRoots,
  fetchRecruitChannelChildren,
  createRecruitChannel,
  deleteRecruitChannel,
} from '@/lib/recruitPostingsApi';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { RM_TOOLBAR_KEYS, RM_TOOLBAR_LABEL, type RmToolbarKey } from '@/lib/recruitRm';

const BU_OPTIONS = ['LBD', 'LBA', 'LM', 'DS', 'SN'];

const fieldCls =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30';

/** จัดการช่องทาง (master 2 ระดับ) — อยู่หน้าหลักของบอร์ดตามที่เจ้าของกำหนด */
const CHANNEL_CHILD_PAGE = 50;

const ChannelManagerDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [channels, setChannels] = useState<RecruitChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mainName, setMainName] = useState('');
  const [subName, setSubName] = useState('');
  const [subParent, setSubParent] = useState('');
  /**
   * กางทีละพ่อ — ⚠️ ห้ามโหลดทรีเต็ม พ่อชื่อ "Facebook Group" มีลูก 4,187 ตัว
   * (ของจริงจาก iRecruit) เปิด dialog แล้วดึงมาหมดคือแช่ทั้งหน้า
   */
  const [openParent, setOpenParent] = useState<string | null>(null);
  const [childQuery, setChildQuery] = useState('');
  const [children, setChildren] = useState<{ items: RecruitChannel[]; total: number }>({
    items: [],
    total: 0,
  });
  const [childLoading, setChildLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setChannels(await fetchRecruitChannelRoots(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดช่องทางไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const reloadChildren = async (parentId: string, q: string) => {
    setChildLoading(true);
    try {
      setChildren(
        await fetchRecruitChannelChildren(parentId, {
          includeInactive: true,
          limit: CHANNEL_CHILD_PAGE,
          q: q.trim() || undefined,
        }),
      );
    } catch (e) {
      setChildren({ items: [], total: 0 });
      setError(e instanceof Error ? e.message : 'โหลดช่องทางรองไม่สำเร็จ');
    } finally {
      setChildLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setOpenParent(null);
    setChildQuery('');
    setChildren({ items: [], total: 0 });
    void reload();
  }, [open]);

  useEffect(() => {
    if (!openParent) return;
    const parent = openParent;
    const q = childQuery;
    const timer = setTimeout(() => void reloadChildren(parent, q), 250);
    return () => clearTimeout(timer);
  }, [openParent, childQuery]);

  const addMain = async () => {
    if (!mainName.trim()) return;
    try {
      await createRecruitChannel({ name: mainName.trim() });
      setMainName('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เพิ่มไม่สำเร็จ');
    }
  };

  const addSub = async () => {
    if (!subName.trim() || !subParent) return;
    try {
      await createRecruitChannel({ name: subName.trim(), parentId: subParent });
      setSubName('');
      await reload();
      if (openParent === subParent) await reloadChildren(subParent, childQuery);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เพิ่มไม่สำเร็จ');
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteRecruitChannel(id);
      await reload();
      if (openParent) await reloadChildren(openParent, childQuery);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-[32rem] flex-col gap-0 overflow-hidden rounded-[1.5rem] p-0">
        <DialogHeader className="shrink-0 border-b border-border/50 px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold">จัดการช่องทางรับสมัคร</DialogTitle>
          <DialogDescription className="text-xs">
            ช่องทางหลัก → ช่องทางรอง · ใช้ตอนสร้างลิงก์ เพื่อรู้ว่าผู้สมัครมาจากช่องไหน
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <input
              className={fieldCls}
              placeholder="เพิ่มช่องทางหลัก เช่น Facebook"
              value={mainName}
              onChange={(e) => setMainName(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void addMain()}
              className="shrink-0 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
            >
              เพิ่ม
            </button>
          </div>

          {channels.length > 0 ? (
            <div className="flex gap-2">
              <select className={fieldCls} value={subParent} onChange={(e) => setSubParent(e.target.value)}>
                <option value="">เลือกช่องทางหลัก…</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                className={fieldCls}
                placeholder="ช่องทางรอง"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void addSub()}
                className="shrink-0 rounded-xl border border-border px-3 text-sm font-semibold"
              >
                เพิ่ม
              </button>
            </div>
          ) : null}

          {loading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังโหลด…
            </p>
          ) : channels.length === 0 ? (
            <p className="text-xs text-muted-foreground">ยังไม่มีช่องทาง — เพิ่มช่องทางหลักก่อน</p>
          ) : (
            <ul className="space-y-2">
              {channels.map((c) => (
                <li key={c.id} className="rounded-xl border border-border/70 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setChildQuery('');
                        setChildren({ items: [], total: 0 });
                        setOpenParent((prev) => (prev === c.id ? null : c.id));
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-expanded={openParent === c.id}
                    >
                      <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                        {(c.childCount ?? 0).toLocaleString('th-TH')} ช่องรอง
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(c.id)}
                      title="ลบช่องทางนี้ (ลิงก์ที่สร้างไว้แล้วยังใช้ได้)"
                      className="shrink-0 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {openParent === c.id ? (
                    <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
                      {(c.childCount ?? 0) > CHANNEL_CHILD_PAGE ? (
                        <input
                          className={fieldCls}
                          placeholder={`ค้นในช่องรองของ ${c.name}`}
                          value={childQuery}
                          onChange={(e) => setChildQuery(e.target.value)}
                        />
                      ) : null}
                      {childLoading ? (
                        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> กำลังโหลด…
                        </p>
                      ) : children.items.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          {childQuery.trim() ? 'ไม่เจอช่องรองที่ตรงกับคำค้น' : 'ยังไม่มีช่องทางรอง'}
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            {children.items.map((k) => (
                              <span
                                key={k.id}
                                className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                              >
                                <span className="truncate">{k.name}</span>
                                <button
                                  type="button"
                                  onClick={() => void remove(k.id)}
                                  className="shrink-0 hover:text-red-600"
                                  aria-label={`ลบ ${k.name}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          {children.total > children.items.length ? (
                            <p className="text-[11px] text-muted-foreground">
                              แสดง {children.items.length.toLocaleString('th-TH')} จาก{' '}
                              {children.total.toLocaleString('th-TH')} ช่อง — พิมพ์ค้นหาเพื่อเจาะจง
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

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
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-[26rem] rounded-[1.5rem] p-0">
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
 * แถบเครื่องมือของบอร์ดรับสมัคร — **5 ปุ่มชุดเดียวกับระบบเดิม** (เจ้าของสั่ง 11 ส.ค. 2569)
 * ตำแหน่งงาน · ช่องทาง · สร้างลิงก์ · เหตุผล · รายงาน
 *
 * ⚠️ **สองปุ่มต่อเข้าของที่ทำงานอยู่แล้ว ไม่ได้สร้างของซ้ำ:**
 *   - "ช่องทาง"    = ปุ่มที่เคยชื่อ "จัดการช่องทาง" → ChannelManagerDialog เดิม
 *   - "สร้างลิงก์"  = ปุ่มที่เคยชื่อ "ประกาศลอย" → StandalonePickerDialog + GenApplyLinkDialog เดิม
 * เปลี่ยนแค่ชื่อบนปุ่มให้ตรงกับระบบเดิมที่ผู้ใช้คุ้น · **ฟังก์ชันไม่หายไปไหน**
 *
 * ⚠️ อีกสามปุ่ม (ตำแหน่งงาน · เหตุผล · รายงาน) **ยังไม่มีของฝั่งนี้** — กดแล้วขึ้น
 * ข้อความบอกตรง ๆ ว่ายังไม่ได้ต่อ ไม่ปล่อยให้กดแล้วเงียบ
 *
 * ⚠️ ชื่อ/ลำดับปุ่มมาจาก `RM_TOOLBAR_KEYS`/`RM_TOOLBAR_LABEL` ใน `lib/recruitRm.ts`
 * **ที่เดียวกับหน้างานสรรหา (RM)** — สองที่จะไม่มีวันเพี้ยนชื่อกันเอง
 *
 * ทั้งแถบยังอยู่ใต้สิทธิ์ `recruit_postings` เหมือนเดิม (role ที่ไม่ได้เปิดจะไม่เห็นทั้งแถบ)
 */
const RecruitBoardTools: React.FC<{ variant?: 'light' | 'onDark' }> = ({ variant = 'light' }) => {
  const { isFunctionEnabled } = useRolePermissions();
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [standalone, setStandalone] = useState<
    { kind: string; kindLabel: string; departmentCode: string } | null
  >(null);

  // ฟีเจอร์ปิดอยู่ (admin ยังไม่เปิดให้ role นี้) — ไม่ต้องแสดงอะไรเลย
  if (!isFunctionEnabled('recruit_postings')) return null;

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
    reports: BarChart3,
  };

  /** ปุ่มไหนต่อของจริงแล้ว — ที่เหลือขึ้นข้อความบอกว่ายังไม่ได้ทำ */
  const onClickKey = (key: RmToolbarKey) => {
    setNotice(null);
    if (key === 'channels') return setChannelsOpen(true);
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

  return (
    <>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          {RM_TOOLBAR_KEYS.map((key) => {
            const Icon = ICONS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onClickKey(key)}
                title={key === 'link' ? 'สร้างลิงก์รับสมัครที่ไม่ผูกกับใบขอ' : undefined}
                className={btnCls(key)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden /> {LABEL[key]}
              </button>
            );
          })}
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

      <ChannelManagerDialog open={channelsOpen} onClose={() => setChannelsOpen(false)} />
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

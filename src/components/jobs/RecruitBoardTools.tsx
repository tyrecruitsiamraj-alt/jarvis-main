import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Settings2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { STANDALONE_POSTING_KINDS, type RecruitChannel } from '@/lib/recruitPostings';
import {
  fetchRecruitChannels,
  createRecruitChannel,
  deleteRecruitChannel,
} from '@/lib/recruitPostingsApi';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';

const BU_OPTIONS = ['LBD', 'LBA', 'LM', 'DS', 'SN'];

const fieldCls =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30';

/** จัดการช่องทาง (master 2 ระดับ) — อยู่หน้าหลักของบอร์ดตามที่เจ้าของกำหนด */
const ChannelManagerDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [channels, setChannels] = useState<RecruitChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mainName, setMainName] = useState('');
  const [subName, setSubName] = useState('');
  const [subParent, setSubParent] = useState('');

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setChannels(await fetchRecruitChannels(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดช่องทางไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void reload();
  }, [open]);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เพิ่มไม่สำเร็จ');
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteRecruitChannel(id);
      await reload();
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
                    <span className="text-sm font-medium text-foreground">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => void remove(c.id)}
                      title="ลบช่องทางนี้ (ลิงก์ที่สร้างไว้แล้วยังใช้ได้)"
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {(c.children ?? []).length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(c.children ?? []).map((k) => (
                        <span
                          key={k.id}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {k.name}
                          <button
                            type="button"
                            onClick={() => void remove(k.id)}
                            className="hover:text-red-600"
                            aria-label={`ลบ ${k.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
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

/** ปุ่มระดับ "ตั้งค่า" ของบอร์ดรับสมัคร (เฉพาะฝั่งเจ้าหน้าที่) */
const RecruitBoardTools: React.FC = () => {
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [standalone, setStandalone] = useState<
    { kind: string; kindLabel: string; departmentCode: string } | null
  >(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setChannelsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          <Settings2 className="h-3.5 w-3.5" /> จัดการช่องทาง
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
        >
          <Plus className="h-3.5 w-3.5" /> ประกาศลอย
        </button>
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

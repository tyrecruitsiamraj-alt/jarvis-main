import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import type { RecruitPostingKind } from '@/lib/recruitPostings';
import {
  createRecruitPostingKind,
  fetchRecruitPostingKinds,
  refreshRecruitPostingKinds,
  updateRecruitPostingKind,
} from '@/lib/recruitPostingKindsApi';

/**
 * ═══ ตั้งค่าบอร์ด › ประเภทกล่อง (เจ้าของสั่ง 14 ต.ค. 2569) ═══
 * เพิ่ม · แก้ชื่อ · ปิด/เปิดใช้ — ไม่มีลบ (ประกาศเก่าอ้างรหัสอยู่) · รหัสสร้างเอง ห้ามเปลี่ยน
 * ปิดแล้ว = ไม่ขึ้นในตัวเลือก Gen link (ประกาศลอย) · กล่องที่ยังมีประกาศอยู่ยังขึ้นบนบอร์ด
 * บันทึกแล้วเรียก `refreshRecruitPostingKinds()` ให้บอร์ดกับฟอร์มเห็นชุดใหม่ทันที
 */
const PostingKindManagerDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [rows, setRows] = useState<RecruitPostingKind[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchRecruitPostingKinds({ includeInactive: true });
      setRows(list);
      setDraft(Object.fromEntries(list.map((k) => [k.code, k.label])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดประเภทกล่องไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setNewLabel('');
    void reload();
  }, [open]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await fn();
      await Promise.all([reload(), refreshRecruitPostingKinds()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    void run('new', async () => {
      await createRecruitPostingKind(label);
      setNewLabel('');
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 border-b border-border/50 px-5 py-4 text-left">
          <DialogTitle className="text-base font-medium">ประเภทกล่อง</DialogTitle>
          <DialogDescription className="sr-only">เพิ่ม แก้ชื่อ หรือปิดประเภทกล่องลอย</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {error ? (
            <p role="alert" className={cn('text-xs', TONE.danger.value)}>
              {error}
            </p>
          ) : null}

          <ul className="space-y-2" data-testid="posting-kind-list">
            {loading && rows.length === 0 ? (
              <li className="text-xs text-muted-foreground">กำลังโหลด…</li>
            ) : (
              rows.map((k) => {
                const value = draft[k.code] ?? k.label;
                const dirty = value.trim() !== k.label && value.trim() !== '';
                return (
                  <li key={k.code} className="flex items-center gap-2" data-testid="posting-kind-row">
                    <Input
                      aria-label={`ชื่อประเภท ${k.label}`}
                      value={value}
                      maxLength={80}
                      disabled={!!busy}
                      className={cn('h-9', !k.isActive && 'text-muted-foreground')}
                      onChange={(e) => setDraft((d) => ({ ...d, [k.code]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && dirty) void run(k.code, () => updateRecruitPostingKind(k.code, { label: value.trim() }));
                      }}
                    />
                    {!k.isActive ? <Badge variant="secondary">ปิดอยู่</Badge> : null}
                    {dirty ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={!!busy}
                        onClick={() => void run(k.code, () => updateRecruitPostingKind(k.code, { label: value.trim() }))}
                      >
                        บันทึก
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void run(k.code, () => updateRecruitPostingKind(k.code, { isActive: !k.isActive }))}
                    >
                      {k.isActive ? 'ปิด' : 'เปิด'}
                    </Button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="flex items-center gap-2 border-t border-border/50 pt-3">
            <Input
              aria-label="ชื่อประเภทกล่องใหม่"
              placeholder="ชื่อประเภทใหม่"
              value={newLabel}
              maxLength={80}
              disabled={!!busy}
              className="h-9"
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add();
              }}
            />
            <Button type="button" size="sm" disabled={!!busy || !newLabel.trim()} onClick={add}>
              <Plus aria-hidden /> เพิ่ม
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostingKindManagerDialog;

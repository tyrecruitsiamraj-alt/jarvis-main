import React, { useEffect, useMemo, useState } from 'react';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { createShortLink } from '@/lib/shortLinksApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Copy, Link2, Loader2, Scissors } from 'lucide-react';

export type GenApplyLinkDialogProps = {
  open: boolean;
  job: JobRequest | null;
  onClose: () => void;
};

function LinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };
  return (
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
  );
}

const GenApplyLinkDialog: React.FC<GenApplyLinkDialogProps> = ({ open, job, onClose }) => {
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [shortening, setShortening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const targetPath = job ? `/apply?job=${encodeURIComponent(job.id)}` : '/apply';
  const fullUrl = useMemo(() => `${origin}${targetPath}`, [origin, targetPath]);

  useEffect(() => {
    // reset when the dialog opens for a (possibly different) job
    setShortUrl(null);
    setError(null);
    setShortening(false);
  }, [open, job]);

  const shorten = async () => {
    if (shortening) return;
    setShortening(true);
    setError(null);
    try {
      const { path } = await createShortLink(targetPath);
      setShortUrl(`${origin}${path}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ย่อลิงก์ไม่สำเร็จ');
    } finally {
      setShortening(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex w-[calc(100%-1.5rem)] max-w-[30rem] flex-col gap-0 overflow-hidden rounded-[1.5rem] border-border/70 p-0">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/50 bg-gradient-to-b from-primary/[0.07] to-transparent px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Link2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight sm:text-lg">
                ลิงก์รับสมัครงาน
              </DialogTitle>
              <DialogDescription className="mt-0.5 line-clamp-2 text-xs leading-snug">
                {job ? jobBoardCardTitle(job) : 'บอร์ดรับสมัคร'} — ส่งให้ผู้สมัครเปิดกรอกใบสมัครได้เลย
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">ลิงก์เต็ม</p>
            <LinkRow url={fullUrl} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">ลิงก์สั้น</p>
            {shortUrl ? (
              <LinkRow url={shortUrl} />
            ) : (
              <button
                type="button"
                onClick={() => void shorten()}
                disabled={shortening}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
              >
                {shortening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                ทำลิงก์ให้สั้นลง
              </button>
            )}
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GenApplyLinkDialog;

/**
 * ป๊อป "ส่งลิงก์" ของชุดข้อสอบ (เจ้าของ 17 พ.ย. 2569) — QR ให้สแกน · ส่งทาง LINE · คัดลอกลิงก์ · โหลดรูป QR
 * QR อยู่บนพื้นขาวทุกธีม (พื้นมืดกล้องมือถือสแกนไม่ติด)
 */
import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadQuizQrPng, quizLineShareUrl } from '@/lib/skillQuizShare';

type Props = {
  /** null = ปิด */
  share: { title: string; url: string } | null;
  onOpenChange: (open: boolean) => void;
};

export default function QuizShareDialog({ share, onOpenChange }: Props) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setNotice('คัดลอกลิงก์แล้ว');
    } catch {
      setNotice('คัดลอกไม่ได้ กดค้างที่ลิงก์แล้วคัดลอกเอง');
    }
  };

  const saveQr = async () => {
    if (!share || !qrRef.current) return;
    const ok = await downloadQuizQrPng(qrRef.current, share.title, share.url);
    setNotice(ok ? 'โหลดรูป QR แล้ว' : 'โหลดรูปไม่ได้');
  };

  return (
    <Dialog
      open={share !== null}
      onOpenChange={(v) => {
        if (!v) setNotice(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{share?.title}</DialogTitle>
          <DialogDescription className="sr-only">ส่งลิงก์แบบทดสอบ</DialogDescription>
        </DialogHeader>
        {share ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl bg-white p-3">
              <QRCodeCanvas ref={qrRef} value={share.url} size={480} level="M" marginSize={1} style={{ width: 224, height: 224 }} />
            </div>
            <p className="w-full select-all break-all rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">{share.url}</p>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
              <Button asChild>
                <a href={quizLineShareUrl(share.title, share.url)} target="_blank" rel="noopener noreferrer">
                  ส่งทาง LINE
                </a>
              </Button>
              <Button type="button" variant="outline" onClick={() => void copy()}>
                คัดลอกลิงก์
              </Button>
              <Button type="button" variant="outline" onClick={() => void saveQr()}>
                โหลดรูป QR
              </Button>
            </div>
            <p className="min-h-5 text-sm text-muted-foreground">{notice}</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

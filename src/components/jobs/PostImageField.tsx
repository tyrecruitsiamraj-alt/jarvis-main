/**
 * รูปของโพสต์ในป๊อป "โพสต์เอง" (เจ้าของ 17 พ.ย. 2569 · Choice "ข้อความ+รูปพร้อมโพสต์")
 * ข้อความมีปุ่มคัดลอกต่อกลุ่มอยู่แล้ว — ตรงนี้คือรูป: ใส่รูป / เปลี่ยนรูป / โหลดรูปไปแนบใน Facebook
 * รูปเก็บต่อใบขอ (`job_post_images`) — ป๊อป Autopost ของใบเดียวกันหยิบรูปล่าสุดไปใช้ด้วย
 * 17 พ.ย. 2569 เจ้าของ "ทำให้เลือกก่อน ถ้าเลือกแนบรูปค่อยแนบ ถ้าไม่แนบแล้วต้องย้อนกลับได้" — เลือก ไม่แนบรูป/แนบรูป ก่อน
 * (ค่าเริ่ม ไม่แนบรูป · คนเรียกถือค่าไว้ ตอนเลือกกับหลังเตรียมโพสต์จึงตรงกัน · กลับไปไม่แนบ = แค่ซ่อน รูปในใบขอยังอยู่)
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { downloadPostImage, fetchLatestPostImage, postImagePath, uploadPostImage } from '@/lib/postImagesApi';
import type { JobRequest } from '@/types';

const ATTACH_CHOICES = [
  ['no', 'ไม่แนบรูป'],
  ['yes', 'แนบรูป'],
] as const;

export default function PostImageField({ job, attach, onAttachChange }: { job: JobRequest; attach: boolean; onAttachChange: (attach: boolean) => void }) {
  const [imageId, setImageId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<null | 'upload' | 'download'>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    let alive = true;
    void fetchLatestPostImage(job.id).then((id) => alive && setImageId(id));
    return () => {
      alive = false;
    };
  }, [job.id]);

  const upload = (file: File) => {
    setBusy('upload');
    setNotice(null);
    uploadPostImage(file, job.id)
      .then((id) => {
        setImageId(id);
        setNotice('ใส่รูปแล้ว');
      })
      .catch((e: unknown) => setNotice(e instanceof Error ? e.message : 'ใส่รูปไม่สำเร็จ'))
      .finally(() => setBusy(null));
  };
  const download = async () => {
    if (!imageId) return;
    setBusy('download');
    const ok = await downloadPostImage(imageId, `รูปโพสต์ ${job.request_no || job.id}`);
    setNotice(ok ? 'โหลดรูปแล้ว' : 'โหลดรูปไม่ได้');
    setBusy(null);
  };

  return (
    <section className="space-y-2" data-testid="manual-post-image">
      <Label className="text-sm font-medium">รูป</Label>
      <RadioGroup value={attach ? 'yes' : 'no'} onValueChange={(v) => onAttachChange(v === 'yes')} className="flex flex-wrap gap-4">
        {ATTACH_CHOICES.map(([v, label]) => (
          <Label key={v} htmlFor={`post-image-${v}-${job.id}`} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
            <RadioGroupItem id={`post-image-${v}-${job.id}`} value={v} />
            {label}
          </Label>
        ))}
      </RadioGroup>
      {attach ? (
        <div className="flex flex-wrap items-center gap-3">
          {imageId ? (
            <img src={postImagePath(imageId)} alt="รูปโพสต์" className="max-h-32 w-auto max-w-full rounded-lg border border-border" />
          ) : (
            <p className="text-sm text-muted-foreground">ยังไม่มีรูป</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
              {busy === 'upload' ? 'กำลังใส่รูป…' : imageId ? 'เปลี่ยนรูป' : 'ใส่รูป'}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!imageId || busy !== null} onClick={() => void download()}>
              โหลดรูป
            </Button>
          </div>
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) upload(f);
        }}
      />
      {attach ? <p className="min-h-5 text-sm text-muted-foreground">{notice}</p> : null}
    </section>
  );
}

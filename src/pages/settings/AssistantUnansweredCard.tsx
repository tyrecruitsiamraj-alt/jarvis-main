/**
 * ═══ กล่อง "คำถามที่ผู้ช่วยตอบไม่ได้" ใน ตั้งค่า › AI ที่ใช้คิดงาน (เจ้าของ 16 พ.ย. 2569
 * "Ai เก็บอะไรที่ไม่มีคำตอบมา แล้วบอกหน่อยว่าไม่มีคำตอบแล้วจะดูยังไง") ═══
 * ผู้ช่วยจดเองตอนหาข้อมูลในระบบไม่เจอ (`api/_lib/aiAssistant/unanswered.ts`) · กด "ดูแล้ว" = หายจากรายการ (แถวยังอยู่ในฐาน)
 */
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DASH, TONE } from '@/lib/designTokens';
import { formatDateTimeTh } from '@/lib/dateTh';
import { cn } from '@/lib/utils';
import { clearAiUnanswered, fetchAiUnanswered, type AiUnanswered } from '@/lib/aiSettingsApi';

export default function AssistantUnansweredCard() {
  const [items, setItems] = useState<AiUnanswered[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAiUnanswered()
      .then((v) => alive && setItems(v))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ'));
    return () => {
      alive = false;
    };
  }, []);

  const clear = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await clearAiUnanswered(id);
      setItems((list) => (list ? list.filter((x) => x.id !== id) : list));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={cn('space-y-3 rounded-2xl border p-4', DASH.card)} data-testid="assistant-unanswered">
      <h3 className="flex flex-wrap items-center gap-2 text-base font-medium">
        คำถามที่ผู้ช่วยตอบไม่ได้
        <Badge variant="secondary" className="tabular-nums">
          {items === null ? '—' : items.length.toLocaleString('th-TH')}
        </Badge>
      </h3>
      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">ใครถาม</TableHead>
              <TableHead>คำถาม</TableHead>
              <TableHead>ขาดอะไร</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items === null ? (
              <TableRow>
                <TableCell colSpan={5} className={DASH.muted}>
                  {error ? '—' : 'กำลังโหลด…'}
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className={DASH.muted}>
                  ไม่มีคำถามค้าง
                </TableCell>
              </TableRow>
            ) : (
              items.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatDateTimeTh(x.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{x.askedBy ?? '—'}</TableCell>
                  <TableCell className="min-w-48 whitespace-pre-wrap">{x.question}</TableCell>
                  <TableCell className="min-w-40">{x.missing ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void clear(x.id)} data-testid="assistant-unanswered-clear">
                      {busy === x.id ? 'กำลังบันทึก…' : 'ดูแล้ว'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

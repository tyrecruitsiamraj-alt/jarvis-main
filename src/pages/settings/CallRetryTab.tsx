/**
 * ═══ ตั้งค่า › โทรซ้ำคนไม่รับสาย (เจ้าของ 26 ต.ค. 2569) ═══
 * > *"ไม่รับสายแล้วโทรวันถัดไป ขอเป็นโทรใหม่ตอนเที่ยง · ขอหน้าไว้ตั้งเวลาผ่าน UI"*
 * Choice: เวลาถัดไปในรายการ วันเดียวกันได้ · ตั้งจำนวนครั้งได้ · ทุกงานที่ AI โทร · admin แก้
 * ตัวคำนวณเวลา `nextRetryAt` (src/lib/callFollowupPolicy.ts) · ตารางติดตามคนเริ่มงานมีเวลาของตัวเอง ไม่ใช้ค่านี้
 */
import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TimeSelect24 from '@/components/shared/TimeSelect24';
import { useAuth } from '@/contexts/AuthContext';
import { MAX_RETRY_TIMES } from '@/lib/callFollowupPolicy';
import { fetchCallFollowupPolicy, saveCallFollowupPolicy } from '@/lib/callFollowupPolicyApi';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const CallRetryTab: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('admin');
  const [maxAttempts, setMaxAttempts] = useState('3');
  const [times, setTimes] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCallFollowupPolicy()
      .then((p) => {
        if (!alive) return;
        setMaxAttempts(String(p.maxAttempts));
        setTimes(p.retryTimes);
        setLoaded(true);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ'));
    return () => {
      alive = false;
    };
  }, []);

  const touch = () => {
    setNotice(null);
    setError(null);
  };
  const max = Number(maxAttempts);
  const maxOk = Number.isInteger(max) && max >= 1 && max <= 10;
  const timesOk = times.length > 0 && times.every((t) => HHMM.test(t));

  const save = async () => {
    if (saving || !maxOk || !timesOk) return;
    setSaving(true);
    touch();
    try {
      const saved = await saveCallFollowupPolicy({ maxAttempts: max, retryTimes: times });
      setMaxAttempts(String(saved.maxAttempts));
      setTimes(saved.retryTimes);
      setNotice('บันทึกแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="solid" className="max-w-xl space-y-5 p-5" data-testid="call-retry-settings">
      <h3 className="text-lg font-medium text-foreground">โทรซ้ำคนไม่รับสาย</h3>

      <div className="space-y-1.5">
        <Label htmlFor="retry-max">โทรได้สูงสุด (ครั้ง รวมครั้งแรก)</Label>
        <Input
          id="retry-max"
          type="number"
          inputMode="numeric"
          min={1}
          max={10}
          className="w-28 tabular-nums"
          value={maxAttempts}
          disabled={!canEdit || !loaded}
          onChange={(e) => {
            setMaxAttempts(e.target.value);
            touch();
          }}
          data-testid="retry-max"
        />
        {maxAttempts && !maxOk ? <p className={cn('text-xs', TONE.danger.value)}>ใส่ 1–10</p> : null}
      </div>

      <div className="space-y-2">
        <Label>เวลาโทรซ้ำ</Label>
        <ul className="space-y-2" data-testid="retry-times">
          {times.map((t, i) => (
            <li key={i} className="flex items-center gap-2">
              <TimeSelect24
                value={t}
                disabled={!canEdit}
                label={`เวลาโทรซ้ำที่ ${i + 1}`}
                onChange={(v) => {
                  setTimes((cur) => cur.map((x, j) => (j === i ? v : x)));
                  touch();
                }}
              />
              {canEdit && times.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`ลบเวลา ${t}`}
                  onClick={() => {
                    setTimes((cur) => cur.filter((_, j) => j !== i));
                    touch();
                  }}
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit && times.length < MAX_RETRY_TIMES ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!loaded}
            onClick={() => {
              setTimes((cur) => [...cur, '17:00']);
              touch();
            }}
            data-testid="retry-add-time"
          >
            <Plus aria-hidden /> เพิ่มเวลา
          </Button>
        ) : null}
      </div>

      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {notice ? <p className={cn('text-sm', TONE.success.value)} data-testid="retry-notice">{notice}</p> : null}

      {canEdit ? (
        <Button type="button" disabled={!loaded || saving || !maxOk || !timesOk} onClick={() => void save()} data-testid="retry-save">
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
      ) : null}
    </Card>
  );
};

export default CallRetryTab;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { MessageSquarePlus, Bug, Sparkles, Wrench, CircleDot } from 'lucide-react';

type FeedbackKind = 'feature' | 'change' | 'bug' | 'other';
type FeedbackStatus = 'open' | 'in_progress' | 'done' | 'wontfix';

type FeedbackItem = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  kind: FeedbackKind;
  title: string;
  body: string;
  page_path?: string;
  status: FeedbackStatus;
  admin_note?: string;
  created_at: string;
  updated_at: string;
};

const KIND_OPTIONS: { value: FeedbackKind; label: string; hint: string; icon: typeof Sparkles }[] = [
  { value: 'feature', label: 'อยากเพิ่ม', hint: 'ฟีเจอร์ใหม่ที่ยังไม่มี', icon: Sparkles },
  { value: 'change', label: 'อยากปรับ', hint: 'เปลี่ยนการทำงาน / UI / ข้อความ', icon: Wrench },
  { value: 'bug', label: 'เจอบัค', hint: 'ใช้งานแล้วพัง / ผิด / ค้าง', icon: Bug },
  { value: 'other', label: 'อื่นๆ', hint: 'คำถามหรือเรื่องทั่วไป', icon: CircleDot },
];

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: 'รับเรื่องแล้ว',
  in_progress: 'กำลังทำ',
  done: 'เสร็จแล้ว',
  wontfix: 'ไม่ทำ',
};

const STATUS_CLASS: Record<FeedbackStatus, string> = {
  open: 'bg-amber-500/15 text-amber-800',
  in_progress: 'bg-blue-500/15 text-blue-700',
  done: 'bg-emerald-500/15 text-emerald-700',
  wontfix: 'bg-muted text-muted-foreground',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const FeedbackPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [kind, setKind] = useState<FeedbackKind>('feature');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [includePage, setIncludePage] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | FeedbackStatus>('all');
  const [loadingList, setLoadingList] = useState(true);

  const fromPath = useMemo(() => {
    const state = location.state as { from?: string } | null;
    if (state?.from?.startsWith('/')) return state.from;
    return '/';
  }, [location.state]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const r = await apiFetch(`/api/app-feedback?${params.toString()}`);
      const data = (await r.json()) as {
        items?: FeedbackItem[];
        can_manage?: boolean;
        message?: string;
      };
      if (!r.ok) {
        setError(data.message || 'โหลดรายการไม่สำเร็จ');
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setCanManage(Boolean(data.can_manage));
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setLoadingList(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setOk(null);
    if (title.trim().length < 3) {
      setError('หัวข้อต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (body.trim().length < 5) {
      setError('รายละเอียดต้องมีอย่างน้อย 5 ตัวอักษร');
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch('/api/app-feedback', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          title: title.trim(),
          body: body.trim(),
          page_path: includePage ? fromPath : undefined,
        }),
      });
      const data = (await r.json()) as { message?: string; item?: FeedbackItem };
      if (!r.ok) {
        setError(data.message || 'ส่งคำขอไม่สำเร็จ');
        return;
      }
      setOk('ส่งคำขอแล้ว — ทีมจะดูและอัปเดตสถานะให้');
      setTitle('');
      setBody('');
      setKind('feature');
      await loadList();
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setBusy(false);
    }
  };

  const patchItem = async (id: string, patch: { status?: FeedbackStatus; admin_note?: string }) => {
    setError(null);
    try {
      const r = await apiFetch('/api/app-feedback', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...patch }),
      });
      const data = (await r.json()) as { message?: string; item?: FeedbackItem };
      if (!r.ok) {
        setError(data.message || 'อัปเดตไม่สำเร็จ');
        return;
      }
      if (data.item) {
        setItems((prev) => prev.map((it) => (it.id === data.item!.id ? data.item! : it)));
      }
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }
  };

  return (
    <div>
      <PageHeader
        title="ส่งคำขอ / แจ้งบัค"
        subtitle="อยากเพิ่ม · อยากแก้ · อยากปรับ — ส่งมาได้เลย"
        backPath="/"
      />

      <div className="px-4 md:px-6 space-y-5 pb-8">
        <form
          onSubmit={(e) => void submit(e)}
          className="glass-card rounded-[1.5rem] p-4 md:p-6 border border-white/70 space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-500/12 text-blue-700 flex items-center justify-center shrink-0">
              <MessageSquarePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">สร้างคำขอใหม่</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                เขียนสั้นๆ ว่าติดตรงไหน หรืออยากได้อะไร — ยิ่งบอกหน้าจอ/ขั้นตอนชัด ยิ่งแก้ไว
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {KIND_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = kind === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setKind(opt.value)}
                  className={cn(
                    'rounded-xl border px-3 py-3 text-left transition-colors touch-manipulation',
                    active
                      ? 'border-blue-300 bg-blue-500/10 text-blue-800'
                      : 'border-white/80 bg-white/40 text-foreground hover:bg-white/70',
                  )}
                >
                  <Icon className="h-4 w-4 mb-1.5 opacity-80" />
                  <div className="text-xs font-semibold">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{opt.hint}</div>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fbTitle" className="text-xs font-medium text-muted-foreground ml-1">
              หัวข้อ
            </Label>
            <input
              id="fbTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="เช่น อยากให้ filter แผนกจำค่าเดิมได้"
              className="jarvis-soft-field min-h-[48px] w-full"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fbBody" className="text-xs font-medium text-muted-foreground ml-1">
              รายละเอียด
            </Label>
            <textarea
              id="fbBody"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={5}
              placeholder="อธิบายขั้นตอนที่ทำ, ผลที่คาดหวัง, หรือสิ่งที่ผิดพลาด"
              className="jarvis-soft-field w-full min-h-[120px] py-3 resize-y"
              required
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includePage}
              onChange={(e) => setIncludePage(e.target.checked)}
              className="rounded border-border"
            />
            แนบหน้าอ้างอิง: <span className="font-mono text-foreground">{fromPath}</span>
          </label>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {ok ? (
            <p className="text-xs text-emerald-700" role="status">
              {ok}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="jarvis-pill-btn min-h-[48px] px-6 text-sm touch-manipulation disabled:opacity-60"
          >
            {busy ? 'กำลังส่ง…' : 'ส่งคำขอ'}
          </button>
        </form>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {canManage ? 'คำขอทั้งหมด' : 'คำขอของฉัน'}
            </h2>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | FeedbackStatus)}
              className="jarvis-soft-field min-h-[40px] text-xs w-auto"
            >
              <option value="all">ทุกสถานะ</option>
              {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {loadingList ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-white/80 bg-white/30 px-4 py-8 text-center">
              ยังไม่มีคำขอ — ส่งอันแรกได้เลย
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => {
                const kindMeta = KIND_OPTIONS.find((k) => k.value === it.kind);
                return (
                  <li
                    key={it.id}
                    className="glass-card rounded-2xl border border-white/70 p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'text-[10px] font-medium px-2 py-0.5 rounded-full',
                          STATUS_CLASS[it.status],
                        )}
                      >
                        {STATUS_LABELS[it.status]}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/70 text-muted-foreground">
                        {kindMeta?.label || it.kind}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        {formatWhen(it.created_at)}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{it.title}</h3>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {it.body}
                    </p>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        โดย {it.user_name} ({it.user_email})
                      </span>
                      {it.page_path ? (
                        <span className="font-mono">หน้า {it.page_path}</span>
                      ) : null}
                    </div>
                    {it.admin_note ? (
                      <p className="text-xs rounded-lg bg-blue-500/8 border border-blue-200/50 px-3 py-2 text-blue-900">
                        หมายเหตุทีม: {it.admin_note}
                      </p>
                    ) : null}

                    {canManage ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <select
                          value={it.status}
                          onChange={(e) =>
                            void patchItem(it.id, { status: e.target.value as FeedbackStatus })
                          }
                          className="jarvis-soft-field min-h-[36px] text-xs w-auto"
                        >
                          {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="text-xs text-blue-700 underline-offset-2 hover:underline"
                          onClick={() => {
                            const note = window.prompt('หมายเหตุทีม', it.admin_note || '');
                            if (note === null) return;
                            void patchItem(it.id, { admin_note: note });
                          }}
                        >
                          ใส่หมายเหตุ
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {user ? (
          <p className="text-[11px] text-muted-foreground text-center">
            ล็อกอินเป็น {user.full_name} · คำขอจะผูกกับบัญชีนี้
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default FeedbackPage;

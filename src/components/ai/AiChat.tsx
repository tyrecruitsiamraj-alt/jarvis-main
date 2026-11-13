/**
 * ═══ ผู้ช่วย AI แชทมุมขวาล่าง (เจ้าของ 13 พ.ย. 2569 · แปลงจาก KNOWA) ═══
 * ใช้ได้: admin + supervisor · ทุกหน้าหลังล็อกอิน (เจ้าของ Choice) · เซิร์ฟเวอร์ตรวจบทบาทซ้ำที่ `/api/ai/chat`
 *
 * ⚠️ คำสั่งที่เปลี่ยนข้อมูลยิงจาก **เบราว์เซอร์นี้** หลังกด "ทำเลย" เท่านั้น — เท่ากับคนกดปุ่มเอง (ด่านสิทธิ์ · audit ทำงานครบ)
 * ⚠️ ประวัติแชทเก็บใน sessionStorage ของแท็บนี้ (เปลี่ยนหน้าไม่หาย · ปิดแท็บแล้วหาย) — ไม่ลงฐาน
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, LoaderCircle, RotateCcw, SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { aiChatLinkLabel, AI_CHAT_LINK_RE } from '@/lib/aiChatLinks';

type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
type Msg =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
type Pending = { toolCallId: string; method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; body: unknown; summary: string };

const STORE = 'jarvis-ai-chat';
const EXAMPLES = ['ใบขอไหนเหลือหาเยอะสุด 5 ใบ', 'วันนี้มีคนสมัครเข้ามากี่คน', 'เดือนนี้โพสต์เองไปกี่ใบขอ'];

function load(): { messages: Msg[]; pending: Pending | null } {
  try {
    const raw = sessionStorage.getItem(STORE);
    if (raw) return JSON.parse(raw) as { messages: Msg[]; pending: Pending | null };
  } catch {
    /* ไม่มีที่เก็บ = เริ่มแชทใหม่ */
  }
  return { messages: [], pending: null };
}

/** ลิงก์หน้าในระบบที่ผู้ช่วยบอก ให้กดได้ และแสดงเป็นคำ (ไม่โชว์ id) */
function Linkified({ text }: { text: string }) {
  const parts = text.split(AI_CHAT_LINK_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Link key={i} to={p} className="text-primary underline underline-offset-2">
            {aiChatLinkLabel(p)}
          </Link>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<'think' | 'run' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // ⚠️ ห้ามบันทึกก่อนโหลดเสร็จ — ไม่งั้นรอบแรกเขียนค่าว่างทับประวัติเดิม (บทเรียน KNOWA: เปลี่ยนหน้าแล้วแชทหาย)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const s = load();
    setMessages(s.messages);
    setPending(s.pending);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ messages, pending }));
    } catch {
      /* เก็บไม่ได้ก็ใช้ต่อได้ แค่เปลี่ยนหน้าแล้วหาย */
    }
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [ready, messages, pending, busy]);

  async function think(history: Msg[]) {
    setBusy('think');
    setError(null);
    try {
      const res = await apiFetch('/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages: history }) });
      const data = (await res.json().catch(() => null)) as { ok: true; added: Msg[]; pending?: Pending } | { ok: false; message?: string } | null;
      if (!data || !data.ok) {
        // nginx/Cloudflare ตัดก่อน (ไม่ใช่ JSON) = ช้าเกินไป
        setError((data && 'message' in data && data.message) || (res.status === 504 || res.status === 524 ? 'ผู้ช่วยตอบช้าเกินไป กด "ลองใหม่" อีกครั้ง' : 'ผู้ช่วยตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง'));
        return;
      }
      setMessages([...history, ...data.added]);
      setPending(data.pending ?? null);
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');
    } finally {
      setBusy(null);
    }
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || busy || pending) return;
    setInput('');
    const next: Msg[] = [...messages, { role: 'user', content: t }];
    setMessages(next);
    void think(next);
  }

  async function answerPending(run: boolean) {
    if (!pending || busy) return;
    const p = pending;
    let content = 'ผู้ใช้กดยกเลิก ไม่ได้ทำคำสั่งนี้';
    if (run) {
      setBusy('run');
      try {
        const res = await apiFetch(p.path, { method: p.method, body: p.body == null ? undefined : JSON.stringify(p.body) });
        content = `HTTP ${res.status}\n${(await res.text()).slice(0, 8000)}`;
      } catch {
        content = 'ส่งคำสั่งไม่สำเร็จ (เชื่อมต่อเซิร์ฟเวอร์ไม่ได้)';
      }
    }
    setPending(null);
    const next: Msg[] = [...messages, { role: 'tool', tool_call_id: p.toolCallId, content }];
    setMessages(next);
    await think(next);
  }

  function reset() {
    setMessages([]);
    setPending(null);
    setError(null);
  }

  const shown = messages.filter((m): m is Extract<Msg, { role: 'user' | 'assistant' }> => (m.role === 'user' || m.role === 'assistant') && Boolean(m.content));
  const last = messages[messages.length - 1];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="fixed bottom-24 right-4 z-40 h-12 rounded-full px-5 shadow-md lg:bottom-6 lg:right-6 print:hidden" data-testid="ai-chat-open">
          <Bot aria-hidden />
          ผู้ช่วย
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle>ผู้ช่วย AI</SheetTitle>
          <SheetDescription className="sr-only">ถามข้อมูลหรือสั่งงานในระบบ</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" data-testid="ai-chat-log">
          {shown.length === 0 && !busy ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">ถามข้อมูลหรือสั่งงานได้เลย ทำได้เท่าสิทธิ์ของคุณ งานที่เปลี่ยนข้อมูลจะขึ้นให้กดยืนยันก่อนทุกครั้ง</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <Button key={ex} type="button" variant="outline" size="sm" onClick={() => send(ex)}>
                    {ex}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {shown.map((m, i) => (
            <div
              key={i}
              className={cn(
                'whitespace-pre-wrap text-sm [overflow-wrap:anywhere]',
                m.role === 'user' ? 'ml-8 rounded-xl bg-primary/10 p-3 text-foreground' : 'mr-4 text-foreground',
              )}
            >
              {m.role === 'assistant' ? <Linkified text={m.content ?? ''} /> : m.content}
            </div>
          ))}

          {pending ? (
            <div className="space-y-3 rounded-xl border border-primary/40 p-3" data-testid="ai-chat-pending">
              <p className="text-sm font-medium text-foreground">{pending.summary}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={busy !== null} onClick={() => void answerPending(true)} data-testid="ai-chat-run">
                  {busy === 'run' ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                  {busy === 'run' ? 'กำลังทำ…' : 'ทำเลย'}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void answerPending(false)} data-testid="ai-chat-cancel">
                  ยกเลิก
                </Button>
              </div>
            </div>
          ) : null}

          {busy === 'think' ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              กำลังคิด…
            </p>
          ) : null}
          {error ? (
            <div className="space-y-2">
              <p role="alert" className={cn('text-sm', TONE.danger.value)}>
                {error}
              </p>
              {/* ข้อความล่าสุดอยู่ในประวัติแล้ว — ลองใหม่ = ส่งประวัติเดิมซ้ำ ไม่ต้องพิมพ์ใหม่ */}
              {last && last.role !== 'assistant' ? (
                <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void think(messages)} data-testid="ai-chat-retry">
                  <RotateCcw aria-hidden />
                  ลองใหม่
                </Button>
              ) : null}
            </div>
          ) : null}
          <div ref={bottom} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          {shown.length ? (
            <Button type="button" variant="ghost" size="sm" className="shrink-0" disabled={busy !== null} onClick={reset}>
              <RotateCcw aria-hidden />
              เริ่มใหม่
            </Button>
          ) : null}
          <label htmlFor="ai-chat-input" className="sr-only">
            พิมพ์ถามหรือสั่งงาน
          </label>
          <Textarea
            id="ai-chat-input"
            rows={2}
            value={input}
            placeholder={pending ? 'กดทำเลยหรือยกเลิกก่อน' : 'พิมพ์ถามหรือสั่งงาน'}
            disabled={pending !== null}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            className="min-h-11 flex-1 resize-none"
            data-testid="ai-chat-input"
          />
          <Button type="submit" size="sm" className="shrink-0" disabled={busy !== null || pending !== null || !input.trim()} data-testid="ai-chat-send">
            <SendHorizontal aria-hidden />
            ส่ง
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/**
 * กันจอขาวทั้งหน้า — หน้าใดหน้าหนึ่งพังตอนวาด (เช่น API ตอบผิดรูป) ให้เหลือกล่องบอก + ปุ่มโหลดใหม่
 * QA 17 ต.ค. 2569 ข้อ 45: ดูแลหลังเริ่มงานได้คำตอบผิดรูปแล้วจอขาวทั้งหน้า (ระบบไม่มี error boundary เลย)
 * ครอบเนื้อหาใน AppLayout · `resetKey` = path ⇒ เปลี่ยนหน้าแล้วหายเอง เมนูยังกดได้ตลอด
 */
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

type Props = { resetKey: string; children: React.ReactNode };
type State = { failed: boolean; key: string };

export default class PageErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown) {
    console.error('page crashed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="px-4 py-10 md:px-6">
        <Card role="alert" className={cn('mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl p-6 text-center', TONE.danger.soft)}>
          <p className={cn('text-sm font-medium', TONE.danger.value)}>หน้านี้แสดงไม่ได้</p>
          <p className="text-xs text-muted-foreground">ข้อมูลที่ได้มาอาจไม่ครบ ลองโหลดหน้าใหม่ หรือเลือกเมนูอื่นก่อน</p>
          <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden /> โหลดหน้าใหม่
          </Button>
        </Card>
      </div>
    );
  }
}

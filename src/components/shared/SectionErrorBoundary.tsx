import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * ═══ กันจอขาวทั้งแอปจากส่วนเดียวพัง ═══
 *
 * QA 5 ต.ค. 2569: แถบ iRecruit อ่านค่าจากคำตอบผิดรูปแล้ว throw ระหว่าง render ⇒ ทั้งแอปจอขาว
 * (ไม่มี ErrorBoundary สักตัว) · ครอบส่วนที่อ่านข้อมูลภายนอกด้วยตัวนี้ ⇒ พังเฉพาะกล่อง กดลองใหม่ได้
 */
type Props = { label: string; children: React.ReactNode };
type State = { failed: boolean };

export default class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.label}]`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Card role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-sm">
        <span className={cn('font-medium', TONE.danger.value)}>{this.props.label} แสดงไม่ได้</span>
        <Button type="button" size="xs" variant="outline" className="ml-auto" onClick={() => this.setState({ failed: false })}>
          ลองใหม่
        </Button>
      </Card>
    );
  }
}

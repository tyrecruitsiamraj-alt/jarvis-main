/**
 * ═══ ก้อน 2 — ของค้างที่ต้องจัดการตอนนี้ (แบบย่อสำหรับหัวหน้า/ผู้บริหาร) · 29 ก.ย. 2569 ═══
 *
 * ถังชุดเดียวกับ "งานของฉัน" (`buildNextTasks` · เรียงตามความเสียหายถ้าปล่อยไว้) — แต่ละเรื่องขึ้นที่เดียว กดไปทำได้
 * เจ้าหน้าที่เห็นก้อนนี้เป็นการ์ด "งานของฉัน" เต็ม (`HomeDeckV2`) แทน — ถังเดียวกัน เลขเดียวกัน
 * ถังที่เป็น 0 หรือยังไม่รู้ ไม่อยู่ในลิสต์ (ห้ามโชว์ 0 ที่ยังไม่รู้จริง)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import HomeSection from '@/components/home/HomeSection';
import type { NextTask, NextTaskTone } from '@/lib/nextTask';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const TASK_TONE: Record<NextTaskTone, ToneKey> = { danger: 'danger', warn: 'warn', info: 'info' };

const HomeStuckList: React.FC<{
  tasks: NextTask[];
  loading: boolean;
  buLabel?: string | null;
}> = ({ tasks, loading, buLabel }) => (
  <HomeSection title={`ของค้างที่ต้องจัดการตอนนี้${buLabel ? ` · ${buLabel}` : ''}`} subtitle="ตอนนี้ · เรียงตามความเร่ง">
    {tasks.length === 0 ? (
      <p className={cn('text-sm', DASH.muted)}>{loading ? 'กำลังอ่านตัวเลข…' : 'ไม่มีของค้างที่ต้องลงมือตอนนี้'}</p>
    ) : (
      <ul className="divide-y divide-border/60">
        {tasks.map((t) => (
          <li key={t.key}>
            <Link
              to={t.path}
              title={t.reason}
              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary"
            >
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs', TONE[TASK_TONE[t.tone]].chip)}>{t.badge}</span>
              {/* หัวข้อมีจำนวน + หน่วยในตัวแล้ว (`title(n)`) — ไม่พิมพ์เลขซ้ำอีกช่อง */}
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{t.title}</span>
              <ChevronRight className={cn('h-4 w-4 shrink-0', DASH.muted)} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    )}
  </HomeSection>
);

export default HomeStuckList;

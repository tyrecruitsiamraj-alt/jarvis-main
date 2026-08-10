import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Users, Search, ClipboardCheck, ArrowRight, Megaphone, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { apiFetch } from '@/lib/apiFetch';

/** ยอดการ์ด active ต่อถังบนบอร์ด iRecruit (To do / ไม่มีงาน / Re Use / In process) */
type BoardBucket = { column_id: number; label: string | null; count: number };

const BUCKET_DISPLAY: Record<string, { title: string; desc: string; cls: string; bucket: string }> = {
  'to do': { title: 'รอลงงาน (To do)', desc: 'ผ่านสัมภาษณ์ พร้อมลงงาน — AI แมทถังนี้ก่อนเสมอ', cls: TONE.success.value, bucket: 'todo' },
  'ไม่มีงาน': { title: 'รองาน (ไม่มีงาน)', desc: 'ผ่านคัดเลือกแต่ยังไม่มีตำแหน่ง — AI ค้นต่อเมื่อ To do ไม่ถึงเป้า', cls: TONE.warn.value, bucket: 'no_job' },
  're use': { title: 'คนเก่า (Re Use)', desc: 'เคยผ่านงาน — เลือกส่ง AI โทรเองได้ ไม่เข้า auto', cls: TONE.violet.value, bucket: 'reuse' },
  'in process': {
    title: 'กำลังเสนอใบอื่น (In process)',
    desc: 'ถูกเสนอใบขออื่นอยู่ — เลือกส่งเองได้ ไม่เข้า auto (เช็คว่าใบเดิมจบแล้วหรือยัง)',
    cls: TONE.info.value,
    bucket: 'in_process',
  },
};

const MatchingDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [buckets, setBuckets] = useState<BoardBucket[] | null>(null);
  const [bucketsLoading, setBucketsLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/matching/board-candidates?buckets=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.buckets)) setBuckets(d.buckets);
      })
      .catch(() => {})
      .finally(() => setBucketsLoading(false));
  }, []);

  /**
   * ⚠️ เคยมีเมนู "รายชื่อคนจอง" (`/matching/reservations`) อยู่ในชุดนี้ — เจ้าของสั่งเอาออก
   * 10 ส.ค. 2569 · **หน้านั้นยังเข้าได้จากหน้าหลัก** (การ์ด "จองตัวอยู่ / ลงงาน") จึงไม่กำพร้า
   * ถ้าวันไหนหน้าหลักเลิกลิงก์ไปด้วย ต้องหาทางเข้าใหม่ก่อน ไม่งั้นหน้าจะเข้าไม่ถึงเลย
   */
  const toolMenus: {
    path: string;
    label: string;
    desc: string;
    icon: LucideIcon;
    /** โทนของเมนู — พื้น/ไอคอนมาจาก token กลาง (มีคู่ dark ครบ) */
    tone: ToneKey;
  }[] = [
    {
      path: '/matching/match',
      label: 'Matching',
      desc: 'จับคู่ผู้สมัครกับงานตามรัศมีและคะแนน Match',
      icon: Search,
      tone: 'primary' as const,
    },
    {
      path: '/matching/pre-check',
      label: 'Pre-Check',
      desc: 'ค้นหางานใกล้ที่อยู่ผู้สมัครก่อนสมัคร',
      icon: ClipboardCheck,
      tone: 'warn' as const,
    },
    {
      path: '/matching/job-postings',
      label: 'คำขอโพสหางานใหม่',
      desc: 'ใบขอที่หาคนของเราไม่ได้ — ให้ทีมคอนเทนต์รับไปโพสต่อ',
      icon: Megaphone,
      tone: 'danger' as const,
    },
  ];

  return (
    <div className="relative">
      <PageHeader title="Matching Module" subtitle="จับคู่กับงาน" />
      <div className="px-4 md:px-6 space-y-6">
        {/* Matching + Pre-Check + คำขอโพสหางาน */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {toolMenus.map((item, i) => (
            <motion.button
              key={item.path}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(item.path)}
              className="jarvis-menu-card rounded-[1.5rem] p-4 md:p-5 border border-white/70 group touch-manipulation text-left"
            >
              <div
                className={cn(
                  'w-11 h-11 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105',
                  TONE[item.tone].tile,
                  TONE[item.tone].value,
                )}
              >
                <item.icon className="w-5 h-5" />
              </div>
              <div className="font-semibold text-foreground text-sm md:text-base">{item.label}</div>
              <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{item.desc}</div>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                เปิด
                <ArrowRight className="h-3 w-3" aria-hidden />
              </div>
            </motion.button>
          ))}
        </div>

        {/* คนของเรา · ตามถังบนบอร์ด iRecruit — ยอดจริง ณ ตอนนี้ */}
        <div className="glass-card rounded-[1.5rem] border border-white/70 p-3 md:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              คนของเรา · ตามถังบนบอร์ด
            </h3>
            {bucketsLoading ? (
              <span className="text-xs text-muted-foreground">กำลังโหลด…</span>
            ) : buckets ? (
              <span className="text-xs text-muted-foreground">
                รวม {buckets.reduce((s, b) => s + b.count, 0)} คน
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">โหลดไม่สำเร็จ</span>
            )}
          </div>
          {buckets ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {buckets.map((b) => {
                const meta = BUCKET_DISPLAY[(b.label || '').trim().toLowerCase()] ?? {
                  title: b.label || `คอลัมน์ ${b.column_id}`,
                  desc: '',
                  cls: 'text-foreground',
                  bucket: '',
                };
                return (
                  <button
                    key={b.column_id}
                    type="button"
                    onClick={() => navigate(meta.bucket ? `/matching/candidates?bucket=${meta.bucket}` : '/matching/candidates')}
                    className="jarvis-stat-tile"
                  >
                    <div className="jarvis-stat-label">{meta.title}</div>
                    <div className={cn('jarvis-stat-value', meta.cls)}>{b.count}</div>
                    {meta.desc ? (
                      <div className="jarvis-stat-sub leading-snug">{meta.desc}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* ⚠️ เคยมีบล็อก "Job Request Summary" (งานด่วน 10 + ใกล้กำหนด 10 + ป๊อปอัป "ดูงานทั้งหมด")
            ตรงนี้ — เจ้าของสั่งเอาออก 10 ส.ค. 2569 · เอาออกทั้งชุดรวม state/ป๊อปอัป/ตัวโหลด
            `useDemoAwareJobs` ที่มีไว้ให้บล็อกนี้อย่างเดียว (ไม่มีใครใช้ต่อแล้ว)
            รายการใบขอดูได้ที่หน้า Matching และหน้าหน่วยงานซึ่งมีตัวกรอง/เรียงครบกว่า */}
      </div>
    </div>
  );
};

export default MatchingDashboard;

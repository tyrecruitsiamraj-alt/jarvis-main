import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Search, ClipboardCheck, ArrowRight, Megaphone, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TONE, type ToneKey } from '@/lib/designTokens';

const MatchingDashboard: React.FC = () => {
  const navigate = useNavigate();

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

        {/* ⚠️ เคยมีการ์ด "คนของเรา · ตามถังบนบอร์ด" ตรงนี้ — เจ้าของสั่งเอาออก 10 ส.ค. 2569
            เพราะเป็นข้อมูลชุดเดียวกับหน้า "ผู้สมัคร" ซึ่งโชว์ครบ 6 ถังพร้อมสัดส่วนอยู่แล้ว
            (ที่นี่มีแค่ 4 ถัง) — เก็บไว้สองที่แล้วจะเพี้ยนกันเวลาแก้ข้างเดียว */}

        {/* ⚠️ เคยมีบล็อก "Job Request Summary" (งานด่วน 10 + ใกล้กำหนด 10 + ป๊อปอัป "ดูงานทั้งหมด")
            ตรงนี้ — เจ้าของสั่งเอาออก 10 ส.ค. 2569 · เอาออกทั้งชุดรวม state/ป๊อปอัป/ตัวโหลด
            `useDemoAwareJobs` ที่มีไว้ให้บล็อกนี้อย่างเดียว (ไม่มีใครใช้ต่อแล้ว)
            รายการใบขอดูได้ที่หน้า Matching และหน้าหน่วยงานซึ่งมีตัวกรอง/เรียงครบกว่า */}
      </div>
    </div>
  );
};

export default MatchingDashboard;

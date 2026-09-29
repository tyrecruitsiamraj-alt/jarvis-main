/**
 * ═══ ก้อน 1 — ผลงานเดือนนี้ (อัตรา) · หน้าหลักโฉม 3 ก้อน (29 ก.ย. 2569) ═══
 *
 * สมการหลักของโปรเจกต์: ยกมาต้นเดือน + ขอใหม่ − หาได้แล้ว − ยกเลิก = เหลือหา
 * ตัวเลขทั้งหมดมาจาก `/api/home-overview` (ตัวคิดเดียวกับแท็บ Dashboard) — ไฟล์นี้วาดอย่างเดียว ห้ามนับเอง
 *
 * 🔴 กติกาข้อมูล: หาได้แล้วที่ไม่มีวันแจ้งเข้า = ธงประมาณการ (snapshot_fallback) · รอบข้อมูล ERP เก่ากว่าหัวกล่องงาน
 *    = บอกทั้งสองเลขตรง ๆ ห้ามกลบ · อ่านไม่ได้ = บอกว่าอ่านไม่ได้ (ห้าม 0 ปลอม)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import HomeSection from '@/components/home/HomeSection';
import { METRICS, metricHelp, type MetricKey } from '@/lib/metricDictionary';
import type { HomeMonthResult } from '@/lib/homeOverview';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const fmt = (n: number) => NUM.format(n);
const MONTH = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });

type Tile = { key: MetricKey; value: number; sign: '' | '+' | '−'; tone: ToneKey };

function ageText(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return `${fmt(m)} นาทีก่อน`;
  return `${fmt(Math.round(m / 60))} ชั่วโมงก่อน`;
}

const HomeResultBlock: React.FC<{
  result: HomeMonthResult | null;
  loading: boolean;
  error?: string;
  /** ป้าย BU ที่กำลังดู (ไม่ส่ง = ทั้งหมดตามสิทธิ์) */
  buLabel?: string | null;
}> = ({ result, loading, error, buLabel }) => {
  const monthTitle = result ? MONTH.format(new Date(`${result.monthFrom}T12:00:00+07:00`)) : null;
  const tiles: Tile[] = result
    ? [
        { key: 'home.carried', value: result.carried, sign: '', tone: 'neutral' },
        { key: 'home.added', value: result.added, sign: '+', tone: 'primary' },
        { key: 'home.informed', value: result.informed, sign: '−', tone: 'success' },
        { key: 'home.cancelled', value: result.cancelled, sign: '−', tone: 'neutral' },
      ]
    : [];
  const byEquation = result ? result.equationEnd - result.undatedFilled + result.boardPre : 0;
  return (
    <HomeSection
      title={`ผลงานเดือนนี้${buLabel ? ` · ${buLabel}` : ''}`}
      subtitle={monthTitle ? `${monthTitle} · นับเป็นอัตรา` : 'นับเป็นอัตรา'}
      action={
        result ? (
          <span className={cn('text-xs', DASH.muted)}>ข้อมูลใบขอ ERP {ageText(result.ageSeconds)}</span>
        ) : null
      }
    >
      {error ? (
        <p className={cn('text-sm', TONE.warn.value)}>อ่านไม่ได้ — {error}</p>
      ) : !result ? (
        <p className={cn('text-sm', DASH.muted)}>{loading ? 'กำลังอ่านตัวเลข…' : 'ยังไม่มีข้อมูล'}</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {tiles.map((t) => (
              <div key={t.key} className="rounded-xl border border-border/60 p-3" title={metricHelp(t.key)}>
                <p className={cn('text-xs', DASH.muted)}>{METRICS[t.key].label}</p>
                <p className={cn('mt-1 text-2xl font-medium tabular-nums', TONE[t.tone].value)}>
                  {t.sign}
                  {fmt(t.value)}
                </p>
              </div>
            ))}
            <Link
              to={METRICS['home.remaining'].href}
              title={metricHelp('home.remaining')}
              className={cn('col-span-2 rounded-xl border p-3 transition-colors md:col-span-1', TONE.warn.soft, TONE.warn.softHover)}
            >
              <p className={cn('text-xs', DASH.muted)}>{METRICS['home.remaining'].label}</p>
              <p className={cn('mt-1 text-2xl font-medium tabular-nums', TONE.warn.value)}>{fmt(result.boardOpen)}</p>
            </Link>
          </div>
          {/* กระทบยอดให้เห็นว่าบวกลบลงตัว — ธงประมาณการ/ใบขอล่วงหน้า/รอบข้อมูลเก่า บอกเป็นตัวเลขทั้งหมด */}
          <p className={cn('text-xs tabular-nums', DASH.muted)}>
            {fmt(result.carried)} + {fmt(result.added)} − {fmt(result.informed)} − {fmt(result.cancelled)} = {fmt(result.equationEnd)}
            {result.undatedFilled > 0 ? (
              <span className={TONE.warn.value}> · หาได้แล้วที่ไม่มีวันแจ้งเข้า −{fmt(result.undatedFilled)} (ประมาณการ)</span>
            ) : null}
            {result.boardPre > 0 ? <> · ใบขอล่วงหน้าฝั่งเรา +{fmt(result.boardPre)}</> : null}
            {result.undatedFilled > 0 || result.boardPre > 0 ? <> = {fmt(byEquation)}</> : null}
            {result.unexplained !== 0 ? (
              <span className={TONE.warn.value}>
                {' '}
                · หัวกล่องงานตอนนี้ {fmt(result.boardOpen)} (สดกว่ารอบข้อมูล ERP {ageText(result.ageSeconds)})
              </span>
            ) : null}
          </p>
        </div>
      )}
    </HomeSection>
  );
};

export default HomeResultBlock;

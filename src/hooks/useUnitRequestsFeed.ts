import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { fetchSiamrajFeedMeta, fetchSiamrajUnitRequestsWithMeta } from '@/lib/siamrajUnitRequestsApi';
import { httpStatusOf } from '@/lib/apiFetch';
import type { FeedState } from '@/lib/boardDataState';
import { enrichJobsWithUrgency } from '@/lib/jobUrgency';
import { enrichJobsWithPenalty } from '@/lib/jobPenalty';
import { publishUnitRequestsFeed } from '@/lib/jobFeedBroadcast';
import { getWorkCalendarSnapshot, subscribeWorkCalendar } from '@/lib/workCalendarStore';
import type { JobRequest } from '@/types';
import { friendlyErrorText } from '@/lib/friendlyError';

const SIAMRAJ_POLL_MS = 60_000;
const UNIT_REQUESTS_FETCH_LIMIT = 500;
/** เวลาของข้อมูลชุดล่าสุดที่โหลดได้ — ประกาศระดับโมดูล (กติกา `new Intl.*`) */
const CLOCK_TH = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });

async function loadLiveJobs(fresh = false): Promise<{
  jobs: JobRequest[];
  siamrajPrimary: boolean;
  readOnly: boolean;
  dbSource: 'postgres' | 'sqlserver' | null;
  /** ข้อมูลชุดนี้เก่ากี่วินาที — `null` = ไม่รู้ (เส้นที่ไม่ได้ผ่านสำเนา) */
  ageSeconds: number | null;
}> {
  const meta = await fetchSiamrajFeedMeta();

  if (meta.enabled) {
    const live = await fetchSiamrajUnitRequestsWithMeta(UNIT_REQUESTS_FETCH_LIMIT, { fresh });
    return {
      jobs: enrichJobsWithUrgency(live.items),
      siamrajPrimary: true,
      readOnly: meta.readOnly,
      dbSource: meta.dbSource ?? null,
      ageSeconds: live.ageSeconds,
    };
  }

  const r = await apiFetch(`/api/jobs?limit=${UNIT_REQUESTS_FETCH_LIMIT}`, { cache: 'no-store' });
  if (!r.ok) {
    throw new Error(
      r.status === 401
        ? 'เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่'
        : 'โหลดรายการงานไม่สำเร็จ',
    );
  }
  const data = (await r.json()) as JobRequest[];
  return {
    jobs: Array.isArray(data) ? data : [],
    siamrajPrimary: false,
    readOnly: false,
    dbSource: null,
    ageSeconds: null,
  };
}

export function useUnitRequestsFeed(options?: { skip?: boolean }): {
  jobs: JobRequest[];
  loading: boolean;
  refreshing: boolean;
  siamrajPrimary: boolean;
  readOnly: boolean;
  dbSource: 'postgres' | 'sqlserver' | null;
  loadError: string | null;
  /** สภาพของเส้นใบขอ — `failed`/`forbidden` = ห้ามเอา `jobs` ไปคิดเลขโชว์ */
  feedState: FeedState;
  /** ข้อมูลที่ถืออยู่เก่ากี่วินาที — `null` = ไม่รู้ */
  dataAgeSeconds: number | null;
  refetch: (opts?: { fresh?: boolean }) => Promise<void>;
} {
  const skip = options?.skip ?? false;

  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(!skip);
  const [refreshing, setRefreshing] = useState(false);
  const [siamrajPrimary, setSiamrajPrimary] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [dbSource, setDbSource] = useState<'postgres' | 'sqlserver' | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** สภาพของเส้นใบขอ — หัวกล่องงานใช้ตัดสินว่าโชว์เลขได้ไหม */
  const [feedState, setFeedState] = useState<FeedState>('loading');
  /** ข้อมูลที่ถืออยู่เก่ากี่วินาที (มาจากสำเนาฝั่ง server) */
  const [dataAgeSeconds, setDataAgeSeconds] = useState<number | null>(null);
  const [calendarRev, setCalendarRev] = useState(0);
  const siamrajPrimaryRef = useRef(false);
  /** โหลดสำเร็จล่าสุดเมื่อไหร่ — `null` = ยังไม่เคยได้ข้อมูลเลย */
  const lastOkAtRef = useRef<Date | null>(null);

  const jobsWithPenalty = useMemo(() => {
    void calendarRev;
    return enrichJobsWithPenalty(jobs, getWorkCalendarSnapshot());
  }, [jobs, calendarRev]);

  useEffect(() => {
    return subscribeWorkCalendar(() => setCalendarRev((n) => n + 1));
  }, []);

  const refetch = useCallback(
    async (opts: { fresh?: boolean } = {}) => {
      if (skip) return;
      setRefreshing(true);
      try {
        const result = await loadLiveJobs(opts.fresh);
        setJobs(result.jobs);
        setSiamrajPrimary(result.siamrajPrimary);
        setReadOnly(result.readOnly);
        setDbSource(result.dbSource);
        setDataAgeSeconds(result.ageSeconds);
        siamrajPrimaryRef.current = result.siamrajPrimary;
        lastOkAtRef.current = new Date();
        setLoadError(null);
        setFeedState('ready');
      } catch (e) {
        /**
         * 🔴 **รอบดึงซ้ำล้มครั้งเดียว ห้ามล้างการ์ดทั้งบอร์ด** (QA 10 ต.ค. 2569: ดึงทุก 60 วิล้มรอบเดียว การ์ดใบขอ 363 ใบหายหมด)
         * เคยโหลดได้แล้ว = คงข้อมูลเดิม เลขยังโชว์ได้ (เป็นของจริงชุดก่อน) + บอกเวลาของข้อมูล · สิทธิ์หลุด (403) ยังล้างตามเดิม
         */
        if (lastOkAtRef.current && httpStatusOf(e) !== 403) {
          setLoadError(`อัปเดตไม่สำเร็จ ยังโชว์ข้อมูลเมื่อ ${CLOCK_TH.format(lastOkAtRef.current)} น.`);
          return;
        }
        /**
         * 🔴 **โหลดไม่ได้ ≠ ไม่มีใบขอ** (แก้ 31 ส.ค. 2569)
         * เดิม `setJobs([])` ⇒ หัวกล่องงานคำนวณจากลิสต์ว่างแล้วขึ้น 0 ทุกก้อน
         * ทั้งที่ของจริงมี 304 ใบ · ตอนนี้ล้างลิสต์แล้ว **บอกสภาพไว้ด้วย**
         * ให้หัวจอโชว์ว่ายังบอกเลขไม่ได้ แทนการโชว์ศูนย์
         */
        setJobs([]);
        setDataAgeSeconds(null);
        setFeedState(httpStatusOf(e) === 403 ? 'forbidden' : 'failed');
        setLoadError(friendlyErrorText(e, 'โหลดใบขอไม่สำเร็จ'));
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [skip],
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (skip) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetch, skip]);

  useEffect(() => {
    if (skip) return;
    const id = window.setInterval(() => {
      if (!siamrajPrimaryRef.current) return;
      // แท็บซ่อนอยู่ไม่ต้องดึง — กลับมาเห็นจอเมื่อไหร่ `visibilitychange` ดึงให้ทันที
      if (document.visibilityState === 'hidden') return;
      void refetch();
    }, SIAMRAJ_POLL_MS);

    return () => window.clearInterval(id);
  }, [refetch, skip]);

  useEffect(() => {
    siamrajPrimaryRef.current = siamrajPrimary;
  }, [siamrajPrimary]);

  useEffect(() => {
    publishUnitRequestsFeed(jobsWithPenalty, loading);
  }, [jobsWithPenalty, loading]);

  return {
    jobs: jobsWithPenalty,
    loading,
    refreshing,
    siamrajPrimary,
    readOnly,
    dbSource,
    loadError,
    feedState,
    dataAgeSeconds,
    refetch,
  };
}

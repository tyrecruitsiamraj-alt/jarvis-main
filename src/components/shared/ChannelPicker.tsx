import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

import {
  fetchRecruitChannelRoots,
  searchRecruitChannels,
} from '@/lib/recruitPostingsApi';
import { recruitChannelLabel, type RecruitChannelMatch } from '@/lib/recruitPostings';

/**
 * ตัวเลือกช่องทางรับสมัคร — ค้นหาแล้วเลือก
 *
 * ⚠️ ทำไมไม่โชว์เป็นลิสต์ทั้งก้อนเหมือนเดิม: ช่องทางที่ยกมาจากระบบเดิมมี **4,390 ช่อง**
 * (หลัก 43 · ย่อย 4,347 — พ่อชื่อ "Facebook Group" ตัวเดียวมีลูก 4,187)
 * เรนเดอร์ชิปทั้งหมดคือแช่หน้าเว็บ และหาไม่เจออยู่ดี
 *
 * ไม่พิมพ์ = เห็นช่องทางหลัก (43 ตัว กดเลือกได้เลย) · พิมพ์ = ค้นทั้งชื่อลูกและชื่อพ่อ
 */
const ChannelPicker: React.FC<{
  value: RecruitChannelMatch[];
  onChange: (next: RecruitChannelMatch[]) => void;
  multiple?: boolean;
  /** โหลดใหม่เมื่อค่านี้เปลี่ยน (ใช้ตอน dialog เปิด) */
  reloadKey?: unknown;
}> = ({ value, onChange, multiple = false, reloadKey }) => {
  const [query, setQuery] = useState('');
  const [roots, setRoots] = useState<RecruitChannelMatch[]>([]);
  const [results, setResults] = useState<RecruitChannelMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  /** ลำดับคำขอ — คำตอบที่มาช้ากว่าคำขอใหม่ต้องถูกทิ้ง ไม่งั้นผลเก่าทับผลใหม่ */
  const seqRef = useRef(0);

  useEffect(() => {
    setQuery('');
    setResults(null);
    let alive = true;
    fetchRecruitChannelRoots()
      .then((list) => {
        if (!alive) return;
        setRoots(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            parentId: null,
            parentName: null,
            isActive: c.isActive,
          })),
        );
        setFailed(false);
      })
      .catch(() => {
        if (!alive) return;
        setRoots([]);
        setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults(null);
      setLoading(false);
      return;
    }
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setLoading(true);
    const timer = setTimeout(() => {
      searchRecruitChannels(term, { limit: 50 })
        .then((list) => {
          if (seqRef.current !== seq) return;
          setResults(list);
          setLoading(false);
        })
        .catch(() => {
          if (seqRef.current !== seq) return;
          setResults([]);
          setLoading(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const pickedIds = new Set(value.map((c) => c.id));

  const toggle = (c: RecruitChannelMatch) => {
    if (!multiple) {
      onChange(pickedIds.has(c.id) ? [] : [c]);
      return;
    }
    onChange(pickedIds.has(c.id) ? value.filter((v) => v.id !== c.id) : [...value, c]);
  };

  const shown = results ?? roots;

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((c) => (
            <span
              key={c.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              <span className="truncate">{recruitChannelLabel(c)}</span>
              <button
                type="button"
                onClick={() => toggle(c)}
                aria-label={`เอา ${recruitChannelLabel(c)} ออก`}
                className="shrink-0 rounded-full p-0.5 hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาช่องทาง เช่น Facebook, Jobthai, ชื่อกลุ่ม"
          className="w-full rounded-xl border border-border bg-background py-2 pl-8 pr-3 text-sm"
        />
      </div>

      {failed ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          โหลดช่องทางไม่สำเร็จ — ลองปิดแล้วเปิดใหม่
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {loading
            ? 'กำลังค้นหา…'
            : query.trim()
              ? 'ไม่เจอช่องทางที่ตรงกับคำค้น'
              : 'ยังไม่มีช่องทาง — เพิ่มได้ที่ปุ่ม "ช่องทาง" หน้าบอร์ด'}
        </p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-1.5">
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c)}
              className={
                pickedIds.has(c.id)
                  ? 'block w-full truncate rounded-lg bg-primary/10 px-2.5 py-1.5 text-left text-xs font-medium text-primary'
                  : 'block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary'
              }
            >
              {recruitChannelLabel(c)}
            </button>
          ))}
        </div>
      )}

      {!query.trim() && roots.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          แสดงช่องทางหลัก {roots.length} ช่อง — พิมพ์เพื่อค้นช่องทางย่อย
        </p>
      ) : results && results.length >= 50 ? (
        <p className="text-[11px] text-muted-foreground">
          แสดง 50 ช่องแรก — พิมพ์ให้เจาะจงกว่านี้ถ้ายังไม่เจอ
        </p>
      ) : null}
    </div>
  );
};

export default ChannelPicker;

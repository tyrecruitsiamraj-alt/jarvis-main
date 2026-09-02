import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import {
  fetchRecruitChannelChildren,
  fetchRecruitChannelRoots,
  searchRecruitChannels,
} from '@/lib/recruitPostingsApi';
import { recruitChannelLabel, type RecruitChannelMatch } from '@/lib/recruitPostings';

/**
 * ═══ ตัวเลือกช่องทางรับสมัคร — **หลัก → รอง · เลือกได้ทีละ 1 ช่อง** ═══
 *
 * เจ้าของเคาะ 2 ก.ย. 2569: *"กดช่องทางหลัก แล้วพาไปเลือกช่องทางรองต่อ ·
 * ตอนนี้เหมือนเลือกได้หลายอันด้วย ไม่เอาดีกว่า เอาแบบ 1:1 ดีกว่า"*
 *
 * ของเดิมโชว์ช่องทางหลักเป็นลิสต์แบน ๆ + ติ๊กได้หลายช่อง — **ช่องทางรอง 4,345 ตัว
 * เลือกได้ทางเดียวคือพิมพ์ค้น** ถ้าไม่รู้ว่ามีของอยู่ก็ไม่มีวันเจอ (Haiku ทดสอบก็งงจุดนี้)
 *
 * เดินทางใหม่: หลัก 43 ตัว (ตัวที่มีลูกติดป้าย "มีช่องรอง N") → กดแล้วกางลูกของตัวนั้น
 * (ค้นในพ่อ + โหลดเพิ่มได้ เพราะ Facebook Group ตัวเดียวมีลูก 4,187) → กดลูก = จบ
 * · พ่อที่ไม่มีลูก กดแล้วเลือกเลย · ในหน้าลูกมีปุ่ม "ใช้ตัวหลักโดยไม่ระบุช่องรอง"
 * · พิมพ์ค้นหน้าแรก = ค้นข้ามทุกชั้นเหมือนเดิม (ทางลัดของคนที่รู้ชื่ออยู่แล้ว)
 *
 * 🔴 เลือกแล้ว **ซ่อนลิสต์ทันที** เหลือ chip เดียว — 1:1 ไม่มีการติ๊กเพิ่ม
 * อยากเปลี่ยนต้องกด X ก่อน (กันเข้าใจผิดว่ายังเลือกเพิ่มได้)
 */

/** โหลดลูกทีละกี่ตัว — 50 พอไล่สายตาไหว และเท่าเพดานเริ่มต้นของ API */
const CHILD_PAGE = 50;

const ChannelPicker: React.FC<{
  value: RecruitChannelMatch | null;
  onChange: (next: RecruitChannelMatch | null) => void;
  /** โหลดใหม่เมื่อค่านี้เปลี่ยน (ใช้ตอน dialog เปิด) */
  reloadKey?: unknown;
}> = ({ value, onChange, reloadKey }) => {
  const [roots, setRoots] = useState<RecruitChannelMatch[]>([]);
  /** จำนวนลูกของแต่ละพ่อ — ตัวตัดสินว่ากดแล้ว "เข้าไปเลือกต่อ" หรือ "เลือกเลย" */
  const [childCounts, setChildCounts] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState(false);

  /** พ่อที่กำลังกางลูกอยู่ — null = ยังอยู่หน้าช่องทางหลัก */
  const [parent, setParent] = useState<RecruitChannelMatch | null>(null);
  const [children, setChildren] = useState<RecruitChannelMatch[]>([]);
  const [childTotal, setChildTotal] = useState(0);
  const [childQ, setChildQ] = useState('');
  const [childLoading, setChildLoading] = useState(false);

  /** ค้นข้ามทุกชั้นจากหน้าแรก — ทางลัดของคนที่รู้ชื่ออยู่แล้ว */
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecruitChannelMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  /** ลำดับคำขอ — คำตอบที่มาช้ากว่าคำขอใหม่ต้องถูกทิ้ง ไม่งั้นผลเก่าทับผลใหม่ */
  const seqRef = useRef(0);

  useEffect(() => {
    setQuery('');
    setResults(null);
    setParent(null);
    setChildQ('');
    let alive = true;
    fetchRecruitChannelRoots()
      .then((list) => {
        if (!alive) return;
        setRoots(
          list.map((c) => ({ id: c.id, name: c.name, parentId: null, parentName: null, isActive: c.isActive })),
        );
        setChildCounts(Object.fromEntries(list.map((c) => [c.id, c.childCount ?? 0])));
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

  /* ค้นข้ามทุกชั้น (หน้าแรกเท่านั้น) — หน่วง 300ms กันยิงทุกตัวอักษร */
  useEffect(() => {
    const term = query.trim();
    if (!term || parent) {
      setResults(null);
      setSearching(false);
      return;
    }
    const seq = ++seqRef.current;
    setSearching(true);
    const timer = setTimeout(() => {
      searchRecruitChannels(term, { limit: 50 })
        .then((list) => {
          if (seqRef.current !== seq) return;
          setResults(list);
        })
        .catch(() => {
          if (seqRef.current !== seq) return;
          setResults([]);
        })
        .finally(() => {
          if (seqRef.current === seq) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, parent]);

  /* โหลดลูกของพ่อที่เปิดอยู่ — offset 0 เสมอเมื่อพ่อ/คำค้นเปลี่ยน (โหลดเพิ่มมีปุ่มแยก) */
  const loadChildren = (p: RecruitChannelMatch, q: string, offset: number) => {
    setChildLoading(true);
    fetchRecruitChannelChildren(p.id, { q: q.trim() || undefined, limit: CHILD_PAGE, offset })
      .then(({ items, total }) => {
        const mapped = items.map((c) => ({
          id: c.id,
          name: c.name,
          parentId: p.id,
          parentName: p.name,
          isActive: c.isActive,
        }));
        setChildren((prev) => (offset === 0 ? mapped : [...prev, ...mapped]));
        setChildTotal(total);
      })
      .catch(() => {
        setChildren([]);
        setChildTotal(0);
      })
      .finally(() => setChildLoading(false));
  };

  useEffect(() => {
    if (!parent) return;
    const timer = setTimeout(() => loadChildren(parent, childQ, 0), childQ ? 300 : 0);
    return () => clearTimeout(timer);
  }, [parent, childQ]);

  const pick = (c: RecruitChannelMatch) => {
    onChange(c);
    setParent(null);
    setQuery('');
    setChildQ('');
  };

  /* ── เลือกแล้ว = chip เดียว ซ่อนลิสต์ (1:1) ── */
  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <span className="truncate">{recruitChannelLabel(value)}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="เอาช่องทางนี้ออก เลือกใหม่"
            className="shrink-0 rounded-full p-0.5 hover:bg-primary/20"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
        <span className="text-[11px] text-muted-foreground">เลือกได้ 1 ช่อง — กด X เพื่อเปลี่ยน</span>
      </div>
    );
  }

  /* ── โหมดลูกของพ่อหนึ่งตัว ── */
  if (parent) {
    const shownCount = children.length;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setParent(null);
              setChildQ('');
            }}
            className="inline-flex items-center gap-0.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> ช่องทางหลัก
          </button>
          <span className="text-xs font-semibold text-foreground">{parent.name}</span>
          <span className="text-[11px] text-muted-foreground">— เลือกช่องทางรอง</span>
        </div>

        {/* บางทีก็อยากติดแค่ตัวพ่อ (เช่นลิงก์ลง Facebook เพจรวม) — ต้องมีทางนี้เสมอ */}
        <button
          type="button"
          onClick={() => pick(parent)}
          className="block w-full rounded-lg border border-dashed border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary"
        >
          ใช้ &ldquo;{parent.name}&rdquo; โดยไม่ระบุช่องทางรอง
        </button>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={childQ}
            onChange={(e) => setChildQ(e.target.value)}
            placeholder={`ค้นหาช่องรองใน ${parent.name}`}
            className="w-full rounded-xl border border-border bg-background py-2 pl-8 pr-3 text-sm"
          />
        </div>

        {childLoading && shownCount === 0 ? (
          <p className="rounded-xl bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">กำลังโหลด…</p>
        ) : shownCount === 0 ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {childQ.trim() ? 'ไม่เจอช่องรองที่ตรงกับคำค้น' : 'ช่องทางนี้ยังไม่มีช่องรอง'}
          </p>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-1.5">
            {children.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c)}
                className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary"
              >
                {c.name}
              </button>
            ))}
            {shownCount < childTotal ? (
              <button
                type="button"
                disabled={childLoading}
                onClick={() => loadChildren(parent, childQ, shownCount)}
                className="block w-full rounded-lg px-2.5 py-1.5 text-center text-xs font-medium text-primary hover:bg-secondary disabled:opacity-50"
              >
                {childLoading ? 'กำลังโหลด…' : `โหลดเพิ่ม (เห็น ${shownCount.toLocaleString('th-TH')} จาก ${childTotal.toLocaleString('th-TH')})`}
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  /* ── หน้าแรก: ช่องทางหลัก + ค้นข้ามทุกชั้น ── */
  const shown = results ?? roots;
  return (
    <div className="space-y-2">
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
          {searching
            ? 'กำลังค้นหา…'
            : query.trim()
              ? 'ไม่เจอช่องทางที่ตรงกับคำค้น'
              : 'ยังไม่มีช่องทาง — เพิ่มได้ที่ปุ่ม "ช่องทาง" หน้าบอร์ด'}
        </p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-1.5">
          {shown.map((c) => {
            const kids = results ? 0 : (childCounts[c.id] ?? 0);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => (kids > 0 ? setParent(c) : pick(c))}
                className="flex w-full items-center gap-1 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary"
              >
                <span className="min-w-0 flex-1 truncate">{recruitChannelLabel(c)}</span>
                {kids > 0 ? (
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-primary">
                    มีช่องรอง {kids.toLocaleString('th-TH')}
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      {!query.trim() ? (
        <p className="text-[11px] text-muted-foreground">
          กดช่องทางที่มีป้าย &ldquo;มีช่องรอง&rdquo; เพื่อเข้าไปเลือกช่องรองข้างใน · เลือกได้ 1 ช่องต่อลิงก์
        </p>
      ) : null}
    </div>
  );
};

export default ChannelPicker;

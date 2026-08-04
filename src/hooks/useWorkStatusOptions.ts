import { useEffect, useState } from 'react';
import {
  listWorkStatusMaster,
  builtinWorkStatusItems,
  type WorkStatusMasterItem,
} from '@/lib/workStatusMasterApi';

/**
 * ตัวเลือก "สถานะทำงาน" จาก master ใน DB (Admin แก้ได้ในหน้าตั้งค่า)
 * โหลดครั้งเดียวต่อ session แล้วแชร์ให้ทุก component — หน้าหนึ่งมีช่องสถานะได้หลายช่อง
 * ถ้าโหลดไม่ได้ ใช้ค่า built-in จากโค้ดไปก่อน เพื่อไม่ให้ dropdown ว่างจนแก้สถานะไม่ได้
 */
let cache: WorkStatusMasterItem[] | null = null;
let inflight: Promise<WorkStatusMasterItem[]> | null = null;
const subscribers = new Set<(items: WorkStatusMasterItem[]) => void>();

async function loadOnce(): Promise<WorkStatusMasterItem[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = listWorkStatusMaster()
      .then((items) => {
        cache = items.length > 0 ? items : builtinWorkStatusItems();
        subscribers.forEach((fn) => fn(cache as WorkStatusMasterItem[]));
        return cache;
      })
      .catch(() => {
        cache = builtinWorkStatusItems();
        subscribers.forEach((fn) => fn(cache as WorkStatusMasterItem[]));
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** ล้าง cache — เรียกหลัง Admin แก้ master เพื่อให้ dropdown เห็นค่าใหม่ */
export function invalidateWorkStatusOptions(): void {
  cache = null;
}

export function useWorkStatusOptions() {
  const [items, setItems] = useState<WorkStatusMasterItem[]>(() => cache ?? builtinWorkStatusItems());
  const [loaded, setLoaded] = useState(!!cache);

  useEffect(() => {
    let alive = true;
    const onUpdate = (next: WorkStatusMasterItem[]) => {
      if (alive) setItems(next);
    };
    subscribers.add(onUpdate);
    void loadOnce().then((next) => {
      if (!alive) return;
      setItems(next);
      setLoaded(true);
    });
    return () => {
      alive = false;
      subscribers.delete(onUpdate);
    };
  }, []);

  const activeItems = items.filter((i) => i.is_active);
  return {
    /** ทุกค่า (รวมที่ปิดใช้งาน) — ใช้แปลง code เป็นชื่อของใบขอเก่า */
    allItems: items,
    /** ค่าที่เลือกได้ใน dropdown */
    activeItems,
    loaded,
    labelOf: (code: string): string => items.find((i) => i.code === code)?.label ?? code,
    dateLabelOf: (code: string): string =>
      items.find((i) => i.code === code)?.date_label ?? 'วันที่',
  };
}

import { mockWorkCalendar } from '@/data/mockData';
import type { WorkCalendarEntry } from '@/types';
import { apiFetch } from '@/lib/apiFetch';
import { isDemoMode } from '@/lib/demoMode';
import { useSyncExternalStore } from 'react';

let entries: WorkCalendarEntry[] = [...mockWorkCalendar];
const listeners = new Set<() => void>();

export const WORK_CALENDAR_CHANGED_EVENT = 'jarvis-work-calendar-changed';

function emit() {
  listeners.forEach((l) => l());
}

export function getWorkCalendarSnapshot(): WorkCalendarEntry[] {
  return entries;
}

export function subscribeWorkCalendar(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  const onWin = () => onStoreChange();
  if (typeof window !== 'undefined') {
    window.addEventListener(WORK_CALENDAR_CHANGED_EVENT, onWin);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (typeof window !== 'undefined') {
      window.removeEventListener(WORK_CALENDAR_CHANGED_EVENT, onWin);
    }
  };
}

function isEntryArray(v: unknown): v is WorkCalendarEntry[] {
  return Array.isArray(v);
}

/** โหลดตารางงานจาก API (ช่วงวันที่เริ่มต้น ±60 / +120 วัน) */
export async function refreshWorkCalendarFromApi(): Promise<void> {
  if (isDemoMode()) return;
  try {
    const r = await apiFetch('/api/work-calendar');
    if (!r.ok) return;
    const data: unknown = await r.json();
    if (isEntryArray(data)) {
      entries = data;
      emit();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(WORK_CALENDAR_CHANGED_EVENT));
      }
    }
  } catch {
    /* ignore */
  }
}

export function addWorkCalendarEntry(entry: WorkCalendarEntry): void {
  entries = [...entries, entry];
  emit();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WORK_CALENDAR_CHANGED_EVENT));
  }
}

export type CreateWorkCalendarPayload = {
  employee_id: string;
  work_date: string;
  client_id?: string;
  client_name?: string;
  shift?: string;
  status?: WorkCalendarEntry['status'];
  income?: number;
  cost?: number;
  issue_reason?: string;
  notes?: string;
};

export async function createWorkCalendarAssignment(
  payload: CreateWorkCalendarPayload,
): Promise<{ ok: boolean; entry?: WorkCalendarEntry; message?: string }> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const entry: WorkCalendarEntry = {
      id: crypto.randomUUID(),
      employee_id: payload.employee_id,
      work_date: payload.work_date,
      client_id: payload.client_id,
      client_name: payload.client_name,
      shift: payload.shift,
      status: payload.status ?? 'normal_work',
      income: payload.income,
      cost: payload.cost,
      issue_reason: payload.issue_reason,
      notes: payload.notes,
      created_at: now,
      updated_at: now,
    };
    addWorkCalendarEntry(entry);
    return { ok: true, entry };
  }

  const r = await apiFetch('/api/work-calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_id: payload.employee_id,
      work_date: payload.work_date,
      client_id: payload.client_id ?? null,
      client_name: payload.client_name ?? null,
      shift: payload.shift ?? null,
      status: payload.status ?? 'normal_work',
      income: payload.income ?? null,
      cost: payload.cost ?? null,
      issue_reason: payload.issue_reason ?? null,
      notes: payload.notes ?? null,
    }),
  });
  let data: unknown = {};
  try {
    data = await r.json();
  } catch {
    /* ignore */
  }
  if (!r.ok) {
    const rec = data as { message?: string };
    return {
      ok: false,
      message: typeof rec.message === 'string' ? rec.message : 'บันทึกตารางงานไม่สำเร็จ',
    };
  }
  const entry = data as WorkCalendarEntry;
  if (entry && typeof entry.id === 'string') {
    entries = [
      entry,
      ...entries.filter(
        (e) => e.employee_id !== entry.employee_id || e.work_date !== entry.work_date,
      ),
    ];
    emit();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(WORK_CALENDAR_CHANGED_EVENT));
    }
    return { ok: true, entry };
  }
  return { ok: false, message: 'คำตอบจากเซิร์ฟเวอร์ไม่ถูกต้อง' };
}

export function useWorkCalendarEntries(): WorkCalendarEntry[] {
  return useSyncExternalStore(subscribeWorkCalendar, getWorkCalendarSnapshot, getWorkCalendarSnapshot);
}

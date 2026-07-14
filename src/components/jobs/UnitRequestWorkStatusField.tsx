import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import DateSelectDmyBe from '@/components/shared/DateSelectDmyBe';
import { cn } from '@/lib/utils';
import { saveUnitRequestWorkStatus } from '@/lib/siamrajUnitRequestsApi';
import {
  UNIT_REQUEST_WORK_STATUS_DATE_LABELS,
  UNIT_REQUEST_WORK_STATUS_LABELS,
  UNIT_REQUEST_WORK_STATUS_OPTIONS,
  formatWorkPersonsSummary,
  resolveUnitRequestWorkStatus,
  type UnitRequestWorkStatus,
} from '@/lib/unitRequestWorkStatus';

type PersonDraft = {
  key: string;
  first_name: string;
  last_name: string;
  status_date: string;
};

type SavedPayload = {
  work_status: UnitRequestWorkStatus;
  work_person_first_name: string | null;
  work_person_last_name: string | null;
  work_status_date: string | null;
  work_persons: Array<{ first_name: string; last_name: string; status_date: string | null }>;
};

type Props = {
  requestKey: string;
  initialStatus?: UnitRequestWorkStatus | null;
  initialFirstName?: string | null;
  initialLastName?: string | null;
  initialStatusDate?: string | null;
  initialPersons?: Array<{ first_name?: string | null; last_name?: string | null; status_date?: string | null }> | null;
  onSaved?: (next: SavedPayload) => void;
};

function newPersonKey() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyPerson(): PersonDraft {
  return { key: newPersonKey(), first_name: '', last_name: '', status_date: '' };
}

function personsFromInitial(
  initialPersons?: Props['initialPersons'],
  firstName?: string | null,
  lastName?: string | null,
  statusDate?: string | null,
): PersonDraft[] {
  if (initialPersons && initialPersons.length > 0) {
    return initialPersons.map((p) => ({
      key: newPersonKey(),
      first_name: p.first_name ?? '',
      last_name: p.last_name ?? '',
      status_date: (p.status_date ?? '').slice(0, 10),
    }));
  }
  if ((firstName ?? '').trim() || (lastName ?? '').trim()) {
    return [
      {
        key: newPersonKey(),
        first_name: firstName ?? '',
        last_name: lastName ?? '',
        status_date: (statusDate ?? '').slice(0, 10),
      },
    ];
  }
  return [emptyPerson()];
}

export function UnitRequestWorkStatusBadge({
  status,
  firstName,
  lastName,
  persons,
  compact,
}: {
  status?: UnitRequestWorkStatus | null;
  firstName?: string | null;
  lastName?: string | null;
  persons?: Array<{ first_name?: string | null; last_name?: string | null }> | null;
  compact?: boolean;
}) {
  const resolved = resolveUnitRequestWorkStatus(status);
  const label = UNIT_REQUEST_WORK_STATUS_LABELS[resolved];
  const person = formatWorkPersonsSummary(persons, firstName, lastName);
  const tone =
    resolved === 'in_progress'
      ? 'bg-amber-500/12 text-amber-800 border-amber-300/40'
      : resolved === 'evaluating'
        ? 'bg-orange-500/12 text-orange-800 border-orange-300/40'
        : resolved === 'waiting_inform'
          ? 'bg-sky-500/12 text-sky-800 border-sky-300/40'
          : resolved === 'waiting_interview'
            ? 'bg-violet-500/12 text-violet-800 border-violet-300/40'
            : 'bg-emerald-500/12 text-emerald-800 border-emerald-300/40';

  return (
    <span
      className={cn(
        'inline-flex flex-col items-start gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        tone,
        compact && 'max-w-[12rem]',
      )}
      title={person || label}
    >
      <span className={cn(compact && 'truncate max-w-full')}>{label}</span>
      {!compact && person ? <span className="text-[10px] font-normal opacity-80">{person}</span> : null}
    </span>
  );
}

export const UnitRequestWorkStatusEditor: React.FC<Props> = ({
  requestKey,
  initialStatus,
  initialFirstName,
  initialLastName,
  initialStatusDate,
  initialPersons,
  onSaved,
}) => {
  const { isFunctionEnabled } = useRolePermissions();
  const readOnly = !isFunctionEnabled('unit_notes_edit');

  const [status, setStatus] = useState<UnitRequestWorkStatus>(resolveUnitRequestWorkStatus(initialStatus));
  const [persons, setPersons] = useState<PersonDraft[]>(() =>
    personsFromInitial(initialPersons, initialFirstName, initialLastName, initialStatusDate),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setStatus(resolveUnitRequestWorkStatus(initialStatus));
    setPersons(personsFromInitial(initialPersons, initialFirstName, initialLastName, initialStatusDate));
    setError(null);
    setSavedMsg(null);
  }, [requestKey, initialStatus, initialFirstName, initialLastName, initialStatusDate, initialPersons]);

  const needsPerson = status !== 'in_progress';
  const dateLabel = UNIT_REQUEST_WORK_STATUS_DATE_LABELS[status];

  const baseline = useMemo(() => {
    const list = personsFromInitial(initialPersons, initialFirstName, initialLastName, initialStatusDate).map(
      (p) => ({
        first_name: p.first_name.trim(),
        last_name: p.last_name.trim(),
        status_date: p.status_date.slice(0, 10),
      }),
    );
    return {
      status: resolveUnitRequestWorkStatus(initialStatus),
      persons: list,
    };
  }, [initialStatus, initialFirstName, initialLastName, initialStatusDate, initialPersons]);

  const currentPersons = persons.map((p) => ({
    first_name: p.first_name.trim(),
    last_name: p.last_name.trim(),
    status_date: p.status_date.slice(0, 10),
  }));

  const dirty =
    status !== baseline.status ||
    JSON.stringify(needsPerson ? currentPersons : []) !==
      JSON.stringify(baseline.status === 'in_progress' ? [] : baseline.persons);

  const updatePerson = (key: string, patch: Partial<PersonDraft>) => {
    setPersons((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
    setSavedMsg(null);
  };

  const addPerson = () => {
    setPersons((prev) => [...prev, emptyPerson()]);
    setSavedMsg(null);
  };

  const removePerson = (key: string) => {
    setPersons((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.key !== key)));
    setSavedMsg(null);
  };

  const persist = async () => {
    if (readOnly || saving || !requestKey.trim()) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const payloadPersons = needsPerson
        ? currentPersons.map((p) => ({
            first_name: p.first_name,
            last_name: p.last_name,
            status_date: p.status_date || null,
          }))
        : [];
      const item = await saveUnitRequestWorkStatus(requestKey.trim(), {
        status,
        persons: payloadPersons,
      });
      const savedPersons =
        Array.isArray(item.persons) && item.persons.length > 0
          ? item.persons.map((p) => ({
              first_name: p.first_name,
              last_name: p.last_name,
              status_date: p.status_date ?? null,
            }))
          : payloadPersons;
      onSaved?.({
        work_status: resolveUnitRequestWorkStatus(item.status as UnitRequestWorkStatus),
        work_person_first_name: savedPersons[0]?.first_name ?? null,
        work_person_last_name: savedPersons[0]?.last_name ?? null,
        work_status_date: savedPersons[0]?.status_date ?? null,
        work_persons: savedPersons,
      });
      setSavedMsg('บันทึกสถานะทำงานแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะทำงาน</label>
        <select
          value={status}
          disabled={readOnly || saving}
          onChange={(e) => {
            const next = e.target.value as UnitRequestWorkStatus;
            setStatus(next);
            if (next !== 'in_progress' && persons.length === 0) setPersons([emptyPerson()]);
            setSavedMsg(null);
          }}
          className="w-full jarvis-soft-field"
        >
          {UNIT_REQUEST_WORK_STATUS_OPTIONS.map((id) => (
            <option key={id} value={id}>
              {UNIT_REQUEST_WORK_STATUS_LABELS[id]}
            </option>
          ))}
        </select>
      </div>

      {needsPerson ? (
        <div className="space-y-3">
          {persons.map((p, idx) => (
            <div key={p.key} className="space-y-3 rounded-xl border border-white/70 bg-white/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-600">คนที่ {idx + 1}</p>
                {!readOnly && persons.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removePerson(p.key)}
                    disabled={saving}
                    className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    ลบ
                  </button>
                ) : null}
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ชื่อ</label>
                  <input
                    value={p.first_name}
                    disabled={readOnly || saving}
                    onChange={(e) => updatePerson(p.key, { first_name: e.target.value })}
                    className="w-full jarvis-soft-field"
                    placeholder="ชื่อ"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">นามสกุล</label>
                  <input
                    value={p.last_name}
                    disabled={readOnly || saving}
                    onChange={(e) => updatePerson(p.key, { last_name: e.target.value })}
                    className="w-full jarvis-soft-field"
                    placeholder="นามสกุล"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {dateLabel} <span className="font-normal">(ข้ามได้ถ้ายังไม่ทราบ)</span>
                </label>
                <DateSelectDmyBe
                  value={p.status_date}
                  onChange={(v) => updatePerson(p.key, { status_date: v })}
                  allowEmpty
                  disabled={readOnly || saving}
                />
              </div>
            </div>
          ))}

          {!readOnly ? (
            <button
              type="button"
              onClick={addPerson}
              disabled={saving || persons.length >= 30}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white/60 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              เพิ่มชื่อคน
            </button>
          ) : null}
        </div>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void persist()}
            disabled={saving || !dirty}
            className="jarvis-pill-btn text-sm px-4 py-2 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกสถานะ'}
          </button>
          {savedMsg ? <span className="text-xs text-muted-foreground">{savedMsg}</span> : null}
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          ไม่มีสิทธิ์แก้ไขสถานะทำงาน — ติดต่อ Admin หรือดูที่ Settings → Role
        </p>
      )}
    </div>
  );
};

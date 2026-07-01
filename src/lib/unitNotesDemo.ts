const NOTES_KEY = 'jarvis_demo_unit_notes';
const HISTORY_KEY = 'jarvis_demo_unit_note_history';

export const UNIT_NOTES_CHANGED_EVENT = 'jarvis-unit-notes-changed';

function readMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(NOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string>) {
  window.localStorage.setItem(NOTES_KEY, JSON.stringify(map));
}

function readHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string' && !!s.trim()) : [];
  } catch {
    return [];
  }
}

function writeHistory(items: string[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

export function getDemoUnitNote(requestKey: string): string {
  return readMap()[requestKey] ?? '';
}

export function getDemoUnitNoteHistory(): string[] {
  return readHistory();
}

export function saveDemoUnitNote(requestKey: string, note: string) {
  const map = readMap();
  if (note) map[requestKey] = note;
  else delete map[requestKey];
  writeMap(map);

  if (note) {
    const lower = note.toLowerCase();
    const history = [note, ...readHistory().filter((h) => h.toLowerCase() !== lower)].slice(0, 50);
    writeHistory(history);
  }

  window.dispatchEvent(new Event(UNIT_NOTES_CHANGED_EVENT));
}

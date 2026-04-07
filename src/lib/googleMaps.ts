import { apiFetch } from '@/lib/apiFetch';

export type ParsedGoogleMapsUrl = {
  ok: boolean;
  lat?: number;
  lng?: number;
  addressCandidate?: string;
  error?: string;
};

const COORD_RE = /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/;

function tryParseCoords(text: string): { lat: number; lng: number } | null {
  const m = text.match(COORD_RE);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function parseGoogleMapsUrl(url: string): ParsedGoogleMapsUrl {
  if (!url.trim()) return { ok: false, error: 'ลิงก์ว่าง' };
  // Basic heuristics only (no network calls here).
  try {
    // 1) Newer "@lat,lng" format
    const atMatch = url.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      const lat = Number(atMatch[1]);
      const lng = Number(atMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { ok: true, lat, lng };
      }
    }

    // 2) Old "!3dLAT!4dLNG" format
    const dMatch = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (dMatch) {
      const lat = Number(dMatch[1]);
      const lng = Number(dMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { ok: true, lat, lng };
      }
    }

    const parsed = new URL(url);

    // 3) q=... might be either "lat,lng" or a human-readable query
    const q = parsed.searchParams.get('q');
    if (q) {
      const coords = tryParseCoords(q);
      if (coords) return { ok: true, ...coords };
      return { ok: true, addressCandidate: q };
    }

    // 4) ll/center might contain coords
    const ll = parsed.searchParams.get('ll');
    if (ll) {
      const coords = tryParseCoords(ll);
      if (coords) return { ok: true, ...coords };
    }

    const center = parsed.searchParams.get('center');
    if (center) {
      const coords = tryParseCoords(center);
      if (coords) return { ok: true, ...coords };
    }

    return { ok: false, error: 'ไม่สามารถดึงพิกัดหรือที่อยู่จากลิงก์ได้' };
  } catch {
    return { ok: false, error: 'รูปแบบลิงก์ไม่ถูกต้อง' };
  }
}

export async function reverseGeocodeLatLng(lat: number, lng: number): Promise<string> {
  const url = `/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
  const r = await apiFetch(url);
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(body?.error || 'ไม่สามารถแปลงพิกัดเป็นที่อยู่ได้');
  }
  const data = (await r.json()) as { address?: string };
  if (!data.address) throw new Error('ไม่พบที่อยู่จากพิกัดนี้');
  return data.address;
}


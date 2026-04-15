type Res = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

type Req = {
  method?: string;
  query?: Record<string, unknown>;
};

function toNumberOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function firstString(q: Record<string, unknown> | undefined, key: string): string {
  const v = q?.[key];
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim();
  return '';
}

type GeocodeResult = {
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
};

async function nominatimForward(address: string): Promise<{ lat: number; lng: number; formatted_address: string } | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');
  // Keep fallback geocoding inside Thailand to avoid cross-country mismatches.
  url.searchParams.set('countrycodes', 'th');
  const r = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'jarvis-main/1.0 (precheck geocode fallback)',
      Accept: 'application/json',
      'Accept-Language': 'th,en',
    },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const first = data?.[0];
  if (!first?.lat || !first?.lon) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, formatted_address: first.display_name || address };
}

async function nominatimReverse(lat: number, lng: number): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  const r = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'jarvis-main/1.0 (precheck geocode fallback)',
      Accept: 'application/json',
    },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { display_name?: string };
  return data.display_name || null;
}

export default async function handler(req: Req, res: Res) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = req.query ?? {};
  const addressQuery = firstString(q, 'address');
  const lat = toNumberOrNull(q.lat);
  const lng = toNumberOrNull(q.lng);

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';

  // Fallback to Nominatim when Google key is unavailable
  if (!apiKey) {
    try {
      if (addressQuery) {
        const f = await nominatimForward(addressQuery);
        if (!f) return res.status(404).json({ error: 'No location found for this address' });
        return res.status(200).json(f);
      }
      if (lat !== null && lng !== null) {
        const addr = await nominatimReverse(lat, lng);
        if (!addr) return res.status(404).json({ error: 'No address found for this location' });
        return res.status(200).json({ address: addr });
      }
      return res.status(400).json({ error: 'Provide address= or lat= and lng=' });
    } catch {
      return res.status(503).json({ error: 'Geocoding service is unavailable' });
    }
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('key', apiKey);

  if (addressQuery) {
    url.searchParams.set('address', addressQuery);
    url.searchParams.set('region', 'th');
    url.searchParams.set('components', 'country:TH');
  } else if (lat !== null && lng !== null) {
    url.searchParams.set('latlng', `${lat},${lng}`);
  } else {
    return res.status(400).json({ error: 'Provide address= or lat= and lng=' });
  }

  const r = await fetch(url.toString());
  if (!r.ok) {
    return res.status(500).json({ error: 'Failed to call Google Geocoding API' });
  }

  const data = (await r.json()) as { results?: GeocodeResult[]; status?: string };
  const first = data.results?.[0];
  const formatted = first?.formatted_address;
  const loc = first?.geometry?.location;
  const outLat = typeof loc?.lat === 'number' ? loc.lat : null;
  const outLng = typeof loc?.lng === 'number' ? loc.lng : null;

  if (addressQuery) {
    if (outLat === null || outLng === null || !formatted) {
      return res.status(404).json({ error: 'No location found for this address' });
    }
    return res.status(200).json({
      lat: outLat,
      lng: outLng,
      formatted_address: formatted,
    });
  }

  if (!formatted) {
    return res.status(404).json({ error: 'No address found for this location' });
  }

  return res.status(200).json({ address: formatted });
}

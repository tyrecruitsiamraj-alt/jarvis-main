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

export default async function handler(req: Req, res: Res) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const lat = toNumberOrNull(req.query?.lat);
  const lng = toNumberOrNull(req.query?.lng);

  if (lat === null || lng === null) {
    return res.status(400).json({ error: 'Missing or invalid lat/lng' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  if (!apiKey) {
    return res.status(503).json({ error: 'GOOGLE_MAPS_API_KEY is not configured' });
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', apiKey);

  const r = await fetch(url.toString());
  if (!r.ok) {
    return res.status(500).json({ error: 'Failed to call Google Geocoding API' });
  }

  const data = (await r.json()) as { results?: Array<{ formatted_address?: string }> };
  const address: string | undefined = data.results?.[0]?.formatted_address;

  if (!address) {
    return res.status(404).json({ error: 'No address found for this location' });
  }

  return res.status(200).json({ address });
}


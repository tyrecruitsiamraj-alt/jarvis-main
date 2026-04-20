/**
 * Parse `location_address` strings built like AddJobPage / AddCandidatePage:
 * "... อำเภอ/เขต {district} จังหวัด {province} รหัสไปรษณีย์ ..."
 */
export function parseJobLocationAddress(address: string): {
  province: string | null;
  district: string | null;
} {
  const s = address.trim();
  if (!s) return { province: null, district: null };

  let province: string | null = null;
  let district: string | null = null;

  const prov = s.match(/จังหวัด\s+(.+?)(?=\s+รหัสไปรษณีย์|$)/u);
  if (prov?.[1]) province = prov[1].trim() || null;

  const dist = s.match(/อำเภอ\/เขต\s+(.+?)(?=\s+จังหวัด|$)/u);
  if (dist?.[1]) district = dist[1].trim() || null;

  return { province, district };
}

export type ParsedBranchDemandItem = {
  org_name: string | null;
  branch_name_raw: string;
  branch_name_clean: string;
  requested_qty: number;
  confidence: number;
  /** เขต/อำเภอที่ดึงได้จากข้อความ (ถ้ามี) */
  district_hint: string | null;
  /** จังหวัดที่ดึงได้จากข้อความ (ถ้ามี) */
  province_hint: string | null;
};

export type ParsedBranchDemandResult = {
  raw_text: string;
  normalized_text: string;
  org_name: string | null;
  items: ParsedBranchDemandItem[];
  unparsed_segments: string[];
  parser_status: 'high_confidence' | 'fallback' | 'none';
};

export function buildErpBranchDemandInput(job: {
  unit_name?: string;
  location_address?: string;
  job_description_code_1?: string;
  job_description_code_2?: string;
  request_action_name?: string;
  request_no?: string;
}): string {
  // ที่อยู่ปฏิบัติงานมักมีหลายจุด — ให้ parser โฟกัส field นี้ก่อน
  const location = (job.location_address || '').trim();
  if (location && /จำนวน\s*\d+\s*คน|และ|and/i.test(location)) {
    return normalizeWhitespace([job.unit_name, location].filter(Boolean).join(' '));
  }
  return normalizeWhitespace(
    [
      job.unit_name,
      job.location_address,
      job.job_description_code_1,
      job.job_description_code_2,
      job.request_action_name,
      job.request_no,
    ]
      .filter(Boolean)
      .join(', '),
  );
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeDemandText(raw: string): string {
  return normalizeWhitespace(
    raw
      .replace(/[，、]/g, ',')
      .replace(/&/g, ' และ ')
      .replace(/\s+and\s+/gi, ' และ ')
      .replace(/\s*=\s*(\d+)\s*คน/gi, ' จำนวน $1 คน')
      .replace(/(\d+)\s*=\s*คน/gi, ' จำนวน $1 คน')
      // ทำให้จำนวนคนเป็น delimiter ที่ชัด
      .replace(/จำนวน\s*(\d+)\s*คน/gi, 'จำนวน $1 คน')
      .replace(/(\d+)\s*คน/g, '$1 คน')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s{2,}/g, ' '),
  );
}

const KNOWN_ORGS = [
  'บริษัท บุญรอดบริวเวอรี่ จำกัด',
  'บ.บุญรอดบริวเวอรี่',
  'บุญรอดบริวเวอรี่',
  'การประปานครหลวง',
  'การไฟฟ้านครหลวง',
  'การไฟฟ้าส่วนภูมิภาค',
  'ธนาคารกรุงศรีอยุธยา',
  'ธนาคารกรุงศรี',
  'กรุงศรี',
];

/** ข้อความอธิบายพื้นที่กว้าง — ไม่ใช่หลายสาขา */
function isBroadAreaText(text: string): boolean {
  return (
    /และปริมณฑล/i.test(text) ||
    /พระราม\s*\d+\s+และกรุงเทพ/i.test(text) ||
    /กรุงเทพ(?:มหานคร|ฯ)?\s+และ\s+ปริมณฑล/i.test(text)
  );
}

function detectOrgName(text: string): string | null {
  for (const org of KNOWN_ORGS) {
    if (text.includes(org)) return org;
  }
  const m = text.match(/^(.+?)\s+(?:สาขา|บริการ\s*\d+|ปฏิบัติงาน\s*ที่)/i);
  const candidate = m?.[1]?.trim();
  if (!candidate) return null;
  if (/^(บริษัท|บ\.|ห้าง|ธนาคาร)/i.test(candidate) || /จำกัด|มหาชน/.test(candidate)) {
    return candidate;
  }
  return null;
}

function extractDistrictHint(text: string): string | null {
  const m =
    text.match(/เขต\s*([ก-๙A-Za-z0-9.\s]+?)(?:\s+กรุงเทพ|\s+จังหวัด|,|$|จำนวน)/i) ||
    text.match(/อำเภอ\s*([ก-๙A-Za-z0-9.\s]+?)(?:\s+จังหวัด|,|$|จำนวน)/i);
  return m?.[1] ? normalizeWhitespace(m[1]) : null;
}

function extractProvinceHint(text: string): string | null {
  if (/กรุงเทพ/.test(text)) return 'กรุงเทพมหานคร';
  const m = text.match(/จังหวัด\s*([ก-๙A-Za-z0-9.]+)/);
  return m?.[1] ? normalizeWhitespace(m[1]) : null;
}

function cleanPlaceName(raw: string, orgName: string | null): string {
  let out = normalizeWhitespace(raw);
  if (orgName && out.includes(orgName)) {
    out = normalizeWhitespace(out.replace(orgName, ' '));
  }
  // ตัดชื่อองค์กรย่อที่ติดมากับที่อยู่
  out = out
    .replace(/บริษัท\s+[^,]+จำกัด(?:\s*\(มหาชน\))?/gi, ' ')
    .replace(/บ\.?\s*บุญรอดบริวเวอรี่(?:\s*จก\.?)?/gi, ' ')
    .replace(/บุญรอดบริวเวอรี่(?:\s*จก\.?)?/gi, ' ')
    .replace(/^จก\.?-?\s*/i, '')
    .replace(/^บ\.?\s*/i, '')
    .replace(/ปฏิบัติงาน\s*ที่\s*/gi, '')
    .replace(/^ที่\s*/i, '')
    .replace(/^สาขา\s*/i, '')
    .replace(/-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // ชื่อสถานที่เด่น (ห้าง / คอมเพล็กซ์) — ย่อชื่อยาวให้เหลือจุดสำคัญ
  const mall = out.match(
    /(Fashion\s*Island|Promenade|Promende|สิงห์คอมเพล็กซ์|Singha\s*Complex)/i,
  );
  if (mall?.[1] && out.length > 40) {
    const district = extractDistrictHint(out);
    return lookalikeFixes(
      normalizeWhitespace([mall[1], district ? `เขต${district}` : ''].filter(Boolean).join(' ')),
    );
  }

  // ที่อยู่ถนน + เขต
  const roadDistrict = out.match(/(ถ\.[^\s]+(?:\s+[^\s]+){0,3}).*?(เขต\s*[ก-๙A-Za-z0-9.]+)/i);
  if (roadDistrict) {
    return normalizeWhitespace(`${roadDistrict[1]} ${roadDistrict[2]}`);
  }

  return out;
}

function lookalikeFixes(name: string): string {
  return name
    .replace(/Promende/gi, 'Promenade')
    .replace(/Fashion\s*Island/gi, 'Fashion Island')
    .replace(/สิงห์\s*คอมเพล็กซ์/gi, 'สิงห์คอมเพล็กซ์');
}

function parseSegment(segment: string, orgName: string | null): ParsedBranchDemandItem | null {
  // จำนวน X คน (ท้ายประโยค) หรือ X คน
  const match =
    segment.match(/(.+?)\s*จำนวน\s*(\d+)\s*คน\s*$/i) || segment.match(/(.+?)\s*(\d+)\s*คน\s*$/i);
  if (!match) return null;

  const rawName = normalizeWhitespace(match[1]);
  const qty = Number(match[2]);
  if (!Number.isFinite(qty) || qty <= 0) return null;

  let clean = lookalikeFixes(cleanPlaceName(rawName, orgName));
  if (!clean) return null;

  const district_hint = extractDistrictHint(segment);
  const province_hint = extractProvinceHint(segment);

  // ชื่อ clean ที่อ่านง่าย: ถ้ามีเขต ให้ใส่ต่อท้ายถ้ายังไม่มี
  if (district_hint && !clean.includes(district_hint)) {
    clean = `${clean} (เขต${district_hint})`;
  }

  let confidence = 70;
  if (/จำนวน\s*\d+\s*คน/i.test(segment)) confidence += 10;
  if (district_hint) confidence += 10;
  if (/^สาขา/i.test(rawName)) confidence += 5;
  if (/Fashion|Promenade|สิงห์|คอมเพล็กซ์|Island/i.test(clean)) confidence += 5;

  return {
    org_name: orgName,
    branch_name_raw: rawName,
    branch_name_clean: clean,
    requested_qty: qty,
    confidence: Math.min(confidence, 100),
    district_hint,
    province_hint,
  };
}

/**
 * แยกสถานที่หลายจุดที่เชื่อมด้วย "และ" โดยไม่ตัดคำกลางประโยคทั่วไปเกินไป
 * เคสหลัก: "... จำนวน 2 คน และ สิงห์คอมเพล็กซ์ ... จำนวน 1 คน"
 * และ: "Fashion Island และ Promenade มีนบุรี"
 */
function splitMultiLocations(text: string): string[] {
  if (isBroadAreaText(text)) return [text];

  // ก่อนอื่น ถ้ามี pattern จำนวน X คน และ ...
  if (/จำนวน\s*\d+\s*คน\s+และ\s+/i.test(text)) {
    return text
      .split(/\s+และ\s+/i)
      .map((s) => normalizeWhitespace(s))
      .filter(Boolean);
  }

  // ปฏิบัติงานที่ A และ B (ไม่มีจำนวนคน) — ก่อน landmark split
  if (/ปฏิบัติงาน\s*ที่.+และ.+/i.test(text)) {
    const focus = normalizeWhitespace(text.replace(/^.*ปฏิบัติงาน\s*ที่\s*/i, ''));
    if (focus && focus !== text) {
      return focus
        .split(/\s+และ\s+/i)
        .map((s) => normalizeWhitespace(s))
        .filter(Boolean);
    }
  }

  // Fashion Island และ Promenade ...
  if (/\b(Fashion\s*Island|Promenade|Promende|สิงห์คอมเพล็กซ์)\b.+\sและ\s.+/i.test(text)) {
    return text
      .split(/\s+และ\s+/i)
      .map((s) => normalizeWhitespace(s))
      .filter(Boolean);
  }

  // comma-separated สาขา list
  if (text.includes(',') && !isBroadAreaText(text)) {
    return text
      .split(',')
      .map((s) => normalizeWhitespace(s))
      .filter(Boolean);
  }

  return [text];
}

function parseAndJoinSharedLocation(items: ParsedBranchDemandItem[], sharedTail: string): ParsedBranchDemandItem[] {
  // ใช้เมื่อFashion Island และ Promenade มีนบุรี — ส่วนหลังไม่มี qty ให้กระจาย qty = 1 และที่ตั้งร่วม
  if (items.length > 0) return items;
  if (isBroadAreaText(sharedTail)) return [];

  const orgName = detectOrgName(sharedTail);
  let parts = sharedTail
    .split(/\s+และ\s+/i)
    .map((s) => normalizeWhitespace(s))
    .filter(Boolean);

  const operatingFocus = normalizeWhitespace(sharedTail.replace(/^.*ปฏิบัติงาน\s*ที่\s*/i, ''));
  if (/ปฏิบัติงาน\s*ที่/i.test(sharedTail) && operatingFocus.includes(' และ ')) {
    parts = operatingFocus
      .split(/\s+และ\s+/i)
      .map((s) => normalizeWhitespace(s))
      .filter(Boolean);
  }

  if (parts.length < 2) return [];

  // ส่วนท้ายของ part สุดท้ายอาจเป็นที่ตั้งร่วม เช่น "Promenade มีนบุรี กรุงเทพฯ"
  const last = parts[parts.length - 1];
  const locationTail =
    last.match(/\s((?:มีนบุรี|บางนา|บางเขน|ห้วยขวาง|ดุสิต|ลาดพร้าว).+)$/i)?.[1] ||
    last.match(/\s(กรุงเทพ.*)$/i)?.[1] ||
    '';

  return parts.map((part, idx) => {
    let name = part;
    if (idx === parts.length - 1 && locationTail) {
      name = normalizeWhitespace(part.replace(locationTail, ''));
    }
    const full = normalizeWhitespace([name, locationTail].filter(Boolean).join(' '));
    const clean = lookalikeFixes(cleanPlaceName(full || name, orgName));
    return {
      org_name: orgName,
      branch_name_raw: full || name,
      branch_name_clean: clean || lookalikeFixes(name),
      requested_qty: 1,
      confidence: 65,
      district_hint: extractDistrictHint(full) || (locationTail.includes('มีนบุรี') ? 'มีนบุรี' : null),
      province_hint: extractProvinceHint(full) || (/กรุงเทพ/.test(full + locationTail) ? 'กรุงเทพมหานคร' : null),
    };
  });
}

export function parseErpBranchDemand(raw: string): ParsedBranchDemandResult {
  const normalized = normalizeDemandText(raw);
  const orgName = detectOrgName(normalized);

  // ตัดเลขใบงาน / คำที่รบกวนออกจากช่วงท้ายถ้ามี pattern หลายจุดในที่อยู่
  const focus = normalized;

  const segments = splitMultiLocations(focus);
  const items: ParsedBranchDemandItem[] = [];
  const unparsed: string[] = [];

  for (const segment of segments) {
    // ข้าม segment ที่สั้นหรือเป็นแค่รหัสงาน
    if (/^[A-Z]{2,}\d+$/i.test(segment) && segment.length < 20) {
      unparsed.push(segment);
      continue;
    }
    const parsed = parseSegment(segment, orgName);
    if (parsed) items.push(parsed);
    else unparsed.push(segment);
  }

  // fallback: Fashion Island และ Promenade โดยไม่มี "จำนวน X คน"
  if (items.length === 0 && /\sและ\s/i.test(normalized) && !isBroadAreaText(normalized)) {
    const joined = parseAndJoinSharedLocation([], normalized);
    if (joined.length > 0) {
      return {
        raw_text: raw,
        normalized_text: normalized,
        org_name: orgName,
        items: joined,
        unparsed_segments: [],
        parser_status: 'fallback',
      };
    }
  }

  // ถ้าแยกด้วย และ ได้หลายก้อน แต่บางก้อนไม่มีจำนวนคน — ลองประกอบจาก unparsed+parsed ไม่สำเร็จ
  if (items.length === 1 && /และ/i.test(normalized) && /จำนวน\s*\d+\s*คน.*และ.*จำนวน\s*\d+\s*คน/i.test(normalized)) {
    // reset ด้วย split ที่เข้มขึ้น
    const again = normalized.split(/\s+และ\s+/i).map((s) => normalizeWhitespace(s));
    const rebuilt: ParsedBranchDemandItem[] = [];
    for (const seg of again) {
      const p = parseSegment(seg, orgName);
      if (p) rebuilt.push(p);
    }
    if (rebuilt.length > 1) {
      return {
        raw_text: raw,
        normalized_text: normalized,
        org_name: orgName,
        items: rebuilt,
        unparsed_segments: [],
        parser_status: 'high_confidence',
      };
    }
  }

  const parser_status: ParsedBranchDemandResult['parser_status'] =
    items.length === 0
      ? 'none'
      : items.every((item) => item.confidence >= 80) && unparsed.length === 0
        ? 'high_confidence'
        : 'fallback';

  return {
    raw_text: raw,
    normalized_text: normalized,
    org_name: orgName,
    items,
    unparsed_segments: unparsed,
    parser_status,
  };
}

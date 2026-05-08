import { getAllData } from 'thai-data';

type AddressIndex = {
  provinces: string[];
  districtsByProvince: Map<string, string[]>;
  subdistrictsByDistrict: Map<string, string[]>;
  zipBySubdistrict: Map<string, string>;
};

const DISTRICT_KEY_SEP = '||';

function districtKey(province: string, district: string): string {
  return `${province}${DISTRICT_KEY_SEP}${district}`;
}

function subdistrictKey(province: string, district: string, subdistrict: string): string {
  return `${districtKey(province, district)}${DISTRICT_KEY_SEP}${subdistrict}`;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'th'));
}

function buildAddressIndex(): AddressIndex {
  const provinces = new Set<string>();
  const districtsByProvinceRaw = new Map<string, Set<string>>();
  const subdistrictsByDistrictRaw = new Map<string, Set<string>>();
  const zipBySubdistrict = new Map<string, string>();

  for (const row of getAllData()) {
    const zipCode = String(row.zipCode || '').trim();
    const provinceList = Array.isArray(row?.provinceList) ? row.provinceList : [];
    const districtList = Array.isArray(row?.districtList) ? row.districtList : [];
    const subDistrictList = Array.isArray(row?.subDistrictList) ? row.subDistrictList : [];

    const provinceNameById = new Map(
      provinceList.map((p) => [String(p.provinceId), String(p.provinceName ?? '').trim()]),
    );
    const districtById = new Map(
      districtList.map((d) => [String(d.districtId), String(d.districtName ?? '').trim()]),
    );

    for (const sub of subDistrictList) {
      const province = provinceNameById.get(sub.provinceId)?.trim() || '';
      const district = districtById.get(sub.districtId)?.trim() || '';
      const subdistrict = String(sub.subDistrictName ?? '').trim();
      if (!province || !district || !subdistrict) continue;

      provinces.add(province);
      if (!districtsByProvinceRaw.has(province)) districtsByProvinceRaw.set(province, new Set());
      districtsByProvinceRaw.get(province)?.add(district);

      const dKey = districtKey(province, district);
      if (!subdistrictsByDistrictRaw.has(dKey)) subdistrictsByDistrictRaw.set(dKey, new Set());
      subdistrictsByDistrictRaw.get(dKey)?.add(subdistrict);

      const sKey = subdistrictKey(province, district, subdistrict);
      if (!zipBySubdistrict.has(sKey) && zipCode) {
        zipBySubdistrict.set(sKey, zipCode);
      }
    }
  }

  const districtsByProvince = new Map<string, string[]>();
  for (const [province, districts] of districtsByProvinceRaw.entries()) {
    districtsByProvince.set(province, sortedUnique(districts));
  }

  const subdistrictsByDistrict = new Map<string, string[]>();
  for (const [key, subs] of subdistrictsByDistrictRaw.entries()) {
    subdistrictsByDistrict.set(key, sortedUnique(subs));
  }

  return {
    provinces: sortedUnique(provinces),
    districtsByProvince,
    subdistrictsByDistrict,
    zipBySubdistrict,
  };
}

const ADDRESS_INDEX = buildAddressIndex();

export function getProvinceOptions(): readonly string[] {
  return ADDRESS_INDEX.provinces;
}

export function getDistrictOptions(province: string): readonly string[] {
  return ADDRESS_INDEX.districtsByProvince.get(province) ?? [];
}

export function getSubdistrictOptions(province: string, district: string): readonly string[] {
  return ADDRESS_INDEX.subdistrictsByDistrict.get(districtKey(province, district)) ?? [];
}

export function getZipCodeForSubdistrict(
  province: string,
  district: string,
  subdistrict: string,
): string | null {
  return ADDRESS_INDEX.zipBySubdistrict.get(subdistrictKey(province, district, subdistrict)) ?? null;
}


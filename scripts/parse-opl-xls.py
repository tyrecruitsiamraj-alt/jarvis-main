#!/usr/bin/env python3
"""Parse Site update Excel → JSON map site_code -> OPL assignee name."""
import json
import re
import sys

import xlrd


def norm_site(v) -> str:
    s = str(v).strip()
    return s


def norm_name(v) -> str:
    s = str(v).strip()
    return s


def find_columns(headers: list[str]) -> tuple[int, int] | None:
    site_idx = None
    opl_idx = None
    for i, h in enumerate(headers):
        hl = h.strip().lower()
        if hl == "site_code":
            site_idx = i
        if "ผู้รับผิดชอบ" in h or h.strip() == "OPL ชื่อ":
            opl_idx = i
    if site_idx is not None and opl_idx is not None:
        return site_idx, opl_idx
    return None


def parse_sheet(sh) -> dict[str, str]:
    if sh.nrows < 2:
        return {}
    headers = [str(sh.cell_value(0, c)).strip() for c in range(sh.ncols)]
    cols = find_columns(headers)
    if not cols:
        return {}
    site_idx, opl_idx = cols
    out: dict[str, str] = {}
    for r in range(1, sh.nrows):
        site = norm_site(sh.cell_value(r, site_idx))
        name = norm_name(sh.cell_value(r, opl_idx))
        if site and name:
            out[site] = name
    return out


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: parse-opl-xls.py <file.xls>", file=sys.stderr)
        sys.exit(1)
    path = sys.argv[1]
    wb = xlrd.open_workbook(path, encoding_override="cp874")
    merged: dict[str, str] = {}
    sheets_used: list[str] = []
    for name in wb.sheet_names():
        sh = wb.sheet_by_name(name)
        part = parse_sheet(sh)
        if part:
            merged.update(part)
            sheets_used.append(name)
    print(
        json.dumps(
            {"siteOpl": merged, "sheets": sheets_used, "count": len(merged)},
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()

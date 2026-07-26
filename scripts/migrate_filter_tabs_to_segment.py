#!/usr/bin/env python3
"""Migrate body filterTabs chartPath payloads → headerAction.segment config.

- Multi-view chart JSON: ensure each filterView has stable `id`; add headerAction.segment on board items.
- Single-view chart JSON: unwrap to top-level autoChart/table/aiInsight (no segment).
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / 'apiV5'

LABEL_ID = {
    'Chặng bay': 'chang',
    'Sân bay': 'sanbay',
    'Hãng bay': 'hangbay',
    'Network': 'network',
    'AREA': 'area',
    'Country': 'country',
    'Route': 'route',
    'Total': 'Total',
    'B787': 'B787',
    'A350': 'A350',
    'A321': 'A321',
    'ATR72': 'ATR72',
}


def slugify(label: str, index: int) -> str:
    if label in LABEL_ID:
        return LABEL_ID[label]
    s = unicodedata.normalize('NFKD', label)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.lower().strip().replace(' ', '_')
    s = re.sub(r'[^a-z0-9_]+', '', s)
    return s or f'view_{index}'


def resolve_chart_path(cp: str) -> Path | None:
    candidates = [ROOT / cp, ROOT / cp.replace('apiV5/', ''), API / Path(cp).name]
    for c in candidates:
        if c.exists():
            return c
    return None


def ensure_filter_view_ids(fv_list: list) -> list:
    used: set[str] = set()
    out = []
    for i, raw in enumerate(fv_list):
        if not isinstance(raw, dict):
            out.append(raw)
            continue
        view = dict(raw)
        label = view.get('label') if isinstance(view.get('label'), str) else ''
        vid = view.get('id') if isinstance(view.get('id'), str) else ''
        if not vid:
            vid = slugify(label, i)
        base = vid
        n = 2
        while vid in used:
            vid = f'{base}_{n}'
            n += 1
        used.add(vid)
        ordered = {'id': vid}
        for k, v in view.items():
            if k == 'id':
                continue
            ordered[k] = v
        out.append(ordered)
    return out


def unwrap_single_view(fv: dict) -> dict:
    out: dict = {}
    for key in ('autoChart', 'table', 'aiInsight'):
        if key in fv and fv[key] is not None:
            out[key] = fv[key]
    if not out and ('dataset' in fv or 'views' in fv):
        out = {k: fv[k] for k in fv if k != 'label'}
    return out


def main() -> None:
    stats = {
        'boards_touched': 0,
        'items_segment': 0,
        'chart_ids_added': 0,
        'chart_unwrapped': 0,
        'skipped_already_segment': 0,
    }

    chart_files_multi: dict[str, list] = {}
    chart_files_single: dict[str, dict] = {}

    for p in API.rglob('**/index.json'):
        try:
            data = json.loads(p.read_text())
        except Exception:
            continue

        def collect(obj: object) -> None:
            if isinstance(obj, dict):
                for it in obj.get('items') or []:
                    if not isinstance(it, dict):
                        continue
                    ha = it.get('headerAction')
                    if isinstance(ha, dict) and ha.get('type') == 'segment':
                        stats['skipped_already_segment'] += 1
                        continue
                    if isinstance(ha, dict) and ha.get('type') == 'cumulative':
                        continue
                    if it.get('showCumulative') is True:
                        continue
                    cp = it.get('chartPath')
                    if not cp or it.get('autoChart') or it.get('table') or it.get('chart'):
                        continue
                    if it.get('views'):
                        continue
                    found = resolve_chart_path(cp)
                    if not found:
                        continue
                    try:
                        jd = json.loads(found.read_text())
                    except Exception:
                        continue
                    if not isinstance(jd, dict):
                        continue
                    fv = jd.get('views')
                    if not isinstance(fv, list) or not fv:
                        continue
                    key = str(found)
                    if len(fv) >= 2:
                        chart_files_multi[key] = fv
                    elif isinstance(fv[0], dict):
                        chart_files_single[key] = fv[0]
                for v in obj.values():
                    collect(v)
            elif isinstance(obj, list):
                for v in obj:
                    collect(v)

        collect(data)

    for path_str, fv in list(chart_files_multi.items()):
        path = Path(path_str)
        new_fv = ensure_filter_view_ids(fv)
        path.write_text(json.dumps({'views': new_fv}, ensure_ascii=False, indent=2) + '\n')
        stats['chart_ids_added'] += 1
        chart_files_multi[path_str] = new_fv

    for path_str, fv0 in chart_files_single.items():
        path = Path(path_str)
        unwrapped = unwrap_single_view(fv0)
        if not unwrapped:
            continue
        path.write_text(json.dumps(unwrapped, ensure_ascii=False, indent=2) + '\n')
        stats['chart_unwrapped'] += 1

    for p in API.rglob('**/index.json'):
        try:
            data = json.loads(p.read_text())
        except Exception:
            continue

        state = {'touched': False}

        def patch(obj: object) -> None:
            if isinstance(obj, dict):
                items = obj.get('items')
                if isinstance(items, list):
                    for it in items:
                        if not isinstance(it, dict):
                            continue
                        ha = it.get('headerAction')
                        if isinstance(ha, dict) and ha.get('type') in ('segment', 'cumulative'):
                            continue
                        if it.get('showCumulative') is True:
                            continue
                        if it.get('views'):
                            fv = it['views']
                            if isinstance(fv, list) and len(fv) >= 2 and not ha:
                                new_fv = ensure_filter_view_ids(fv)
                                it['views'] = new_fv
                                it['headerAction'] = {
                                    'type': 'segment',
                                    'options': [
                                        {'id': v['id'], 'label': v.get('label') or v['id']}
                                        for v in new_fv
                                        if isinstance(v, dict) and v.get('id')
                                    ],
                                    'defaultValue': new_fv[0]['id'],
                                }
                                state['touched'] = True
                                stats['items_segment'] += 1
                            continue
                        cp = it.get('chartPath')
                        if not cp or it.get('autoChart') or it.get('table') or it.get('chart'):
                            continue
                        found = resolve_chart_path(cp)
                        if not found:
                            continue
                        key = str(found)
                        if key not in chart_files_multi:
                            continue
                        fv = chart_files_multi[key]
                        options = [
                            {'id': v['id'], 'label': v.get('label') or v['id']}
                            for v in fv
                            if isinstance(v, dict) and v.get('id')
                        ]
                        if len(options) < 2:
                            continue
                        it['headerAction'] = {
                            'type': 'segment',
                            'options': options,
                            'defaultValue': options[0]['id'],
                        }
                        state['touched'] = True
                        stats['items_segment'] += 1
                for v in obj.values():
                    patch(v)
            elif isinstance(obj, list):
                for v in obj:
                    patch(v)

        patch(data)
        if state['touched']:
            p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
            stats['boards_touched'] += 1

    left = 0
    for p in API.rglob('**/index.json'):
        try:
            data = json.loads(p.read_text())
        except Exception:
            continue

        def walk(obj: object) -> None:
            nonlocal left
            if isinstance(obj, dict):
                for it in obj.get('items') or []:
                    if not isinstance(it, dict):
                        continue
                    ha = it.get('headerAction')
                    if isinstance(ha, dict) and ha.get('type') in ('segment', 'cumulative'):
                        continue
                    if it.get('showCumulative'):
                        continue
                    cp = it.get('chartPath')
                    if not cp or it.get('autoChart') or it.get('table'):
                        continue
                    found = resolve_chart_path(cp)
                    if not found:
                        continue
                    try:
                        jd = json.loads(found.read_text())
                    except Exception:
                        continue
                    fv = jd.get('views') if isinstance(jd, dict) else None
                    if isinstance(fv, list) and fv:
                        left += 1
                for v in obj.values():
                    walk(v)
            elif isinstance(obj, list):
                for v in obj:
                    walk(v)

        walk(data)

    print(json.dumps({**stats, 'remaining_tab_views_chartPath_items': left}, indent=2))


if __name__ == '__main__':
    main()

# -*- coding: utf-8 -*-
"""Đồng bộ dữ liệu W31 (Commerce-I) về đúng số thực tế của Bao cao GB tuan 25_1.pptx.

Chạy lại được nhiều lần: mọi file đều được sao lưu .bak ở lần chạy đầu và các
lần sau luôn dựng lại từ số gốc trong báo cáo, không phải từ file đã sửa.
"""
import json, os, shutil
from collections import defaultdict

W31 = '/sessions/loving-dreamy-pascal/mnt/Source/mock-api/apiV5/domain/ceo-command-center/commerce-i/2026/W31'
GT  = json.load(open('/sessions/loving-dreamy-pascal/mnt/outputs/build/data.json', encoding='utf-8'))
INT = [r for r in GT['routes'] if r['scope'] == 'INT']
DOM = [r for r in GT['routes'] if r['scope'] == 'DOM']
NET = {n['scope']: n for n in GT['net']}

AREA_ORDER = ['NEA', 'SEA', 'CLMV', 'SAS', 'EUR', 'NOA', 'SWP']
AREA_COLOR = {'NEA': '#1c7d95', 'SEA': '#889941', 'CLMV': '#479EB3',
              'SAS': '#8B5CF6', 'EUR': '#C76449', 'NOA': '#aaced7', 'SWP': '#1D4857'}
CHANGED = []

def path(f): return os.path.join(W31, 'chart', f)

def save(f, doc):
    p = path(f)
    if not os.path.exists(p + '.bak'):
        shutil.copy(p, p + '.bak')
    json.dump(doc, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    CHANGED.append(f)

def load(f):
    return json.load(open(path(f), encoding='utf-8'))

def pax(b):
    """Khách ước tính = DT khách ÷ GBQ. Sai số 0,005% so với slide 8."""
    return b['paxRev'] / b['gbq'] * 1000 if b.get('paxRev') and b.get('gbq') else None

# ── gộp theo Country / Area ────────────────────────────────────────────
C25 = defaultdict(lambda: defaultdict(float))
C23 = defaultdict(lambda: defaultdict(float))
A25 = defaultdict(lambda: defaultdict(float))
A23 = defaultdict(lambda: defaultdict(float))
CTRY_AREA = {}
for r in INT:
    CTRY_AREA[r['country']] = r['area']
    for w, mc, ma in (('w25', C25, A25), ('w23', C23, A23)):
        b = r[w]
        if not b or b.get('paxRev') is None: continue
        for m, k in ((mc, r['country']), (ma, r['area'])):
            m[k]['paxRev'] += b['paxRev']
            m[k]['cargo']  += b['cargoRev'] or 0
            m[k]['plVar']  += b['plVar']
            m[k]['plTot']  += b['plTotal']
            m[k]['pax']    += pax(b) or 0

def rnd(x): return int(round(x))

# ── A1 · DT khách + DT hàng theo Country (đang là SỐ KHÁCH) ────────────
rows = sorted(C25.items(), key=lambda kv: -kv[1]['paxRev'])
save('cf_network_int_b_stacked_rev_country.json', {'autoChart': {
    'chartType': 'bar', 'aspectRatio': 2.2,
    'dataset': {'columns': [
        {'id': 'country', 'type': 'string'},
        {'id': 'dt_khach',   'type': 'number', 'label': 'DT khách (trđ)',  'colorToken': 'series.actual'},
        {'id': 'dt_hanghoa', 'type': 'number', 'label': 'DT hàng hoá (trđ)', 'colorToken': 'series.target'}],
     'rows': [[c, rnd(v['paxRev']), rnd(v['cargo'])] for c, v in rows]},
    'views': [{'id': 'main', 'chartType': 'auto', 'xField': 'country', 'stack': True,
               'series': [{'field': 'dt_khach', 'chartType': 'bar'},
                          {'field': 'dt_hanghoa', 'chartType': 'bar'}]}]}})

# ── A2 · Nội địa: báo cáo KHÔNG có DT khách theo đường bay ─────────────
#      → chuyển sang 2 chỉ tiêu có thật: HQ so CPBĐ và chi phí cố định.
dom_rows = sorted(DOM, key=lambda r: -(r['w25']['plVar'] or 0))
save('cf_network_dom_b_stacked_rev.json', {'autoChart': {
    'chartType': 'bar', 'aspectRatio': 2.2,
    'dataset': {'columns': [
        {'id': 'route', 'type': 'string'},
        {'id': 'hq_cpbd',  'type': 'number', 'label': 'HQ so CPBĐ (trđ)',   'colorToken': 'series.actual'},
        {'id': 'cp_co_dinh', 'type': 'number', 'label': 'Chi phí cố định (trđ)', 'colorToken': 'series.previous'}],
     'rows': [[r['route'], rnd(r['w25']['plVar']), rnd(r['w25']['plVar'] - r['w25']['plTotal'])]
              for r in dom_rows]},
    'views': [{'id': 'main', 'chartType': 'auto', 'xField': 'route',
               'series': [{'field': 'hq_cpbd', 'chartType': 'bar'},
                          {'field': 'cp_co_dinh', 'chartType': 'bar'}]}]}})

# ── A3 · Sunburst HQ so CPBĐ: Area → Country → Route ──────────────────
pos = [r for r in INT if r['w25']['plVar'] > 0]
negs = [r for r in INT if r['w25']['plVar'] <= 0]
root = sum(r['w25']['plVar'] for r in pos)
srows = [['Toàn mạng INT', rnd(root), '', '#004071']]
for a in AREA_ORDER:
    ar = [r for r in pos if r['area'] == a]
    if not ar: continue
    srows.append([a, rnd(sum(r['w25']['plVar'] for r in ar)), 'Toàn mạng INT', AREA_COLOR[a]])
    for c in sorted({r['country'] for r in ar},
                    key=lambda c: -sum(r['w25']['plVar'] for r in ar if r['country'] == c)):
        cr = [r for r in ar if r['country'] == c]
        srows.append([c, rnd(sum(r['w25']['plVar'] for r in cr)), a, AREA_COLOR[a]])
        for r in sorted(cr, key=lambda r: -r['w25']['plVar']):
            srows.append([r['route'], rnd(r['w25']['plVar']), c, AREA_COLOR[a]])
save('cf_network_int_b_sunburst_plvar.json', {'autoChart': {
    'chartType': 'sunburst', 'aspectRatio': 1.1,
    'note': (f'Chỉ gồm {len(pos)} đường bay có HQ so CPBĐ dương. '
             f'{len(negs)} đường bay âm ({rnd(sum(r["w25"]["plVar"] for r in negs))} trđ) không biểu diễn được '
             f'trên sunburst; cộng lại vẫn ra {rnd(root + sum(r["w25"]["plVar"] for r in negs))} trđ của slide 8.'),
    'dataset': {'columns': [{'id': 'name', 'type': 'string'}, {'id': 'value', 'type': 'number'},
                            {'id': 'parent', 'type': 'string'}, {'id': 'color', 'type': 'string'}],
                'rows': srows},
    'views': [{'id': 'main', 'chartType': 'auto', 'series': [{'field': 'value'}]}]}})

# ── A4 · Waterfall: thêm bước "Chưa phân bổ" để về đúng slide 8 ───────
steps = [['DOM', rnd(NET['DOM']['HQ'][0])]]
for a in sorted(AREA_ORDER, key=lambda a: -A25[a]['plTot']):
    if a in A25: steps.append([a, rnd(A25[a]['plTot'])])
gap = NET['Total']['HQ'][0] - (NET['DOM']['HQ'][0] + sum(A25[a]['plTot'] for a in A25))
steps.append(['Chưa phân bổ', rnd(gap)])
steps.append(['TOTAL', rnd(NET['Total']['HQ'][0])])
save('cf_network_total_b_waterfall_pl.json', {'autoChart': {
    'chartType': 'waterfall', 'aspectRatio': 2.2,
    'dataset': {'columns': [{'id': 'step', 'type': 'string'},
                            {'id': 'value', 'type': 'number', 'label': 'P/L tổng chi phí (trđ)'}],
                'rows': steps},
    'views': [{'id': 'main', 'chartType': 'auto', 'xField': 'step',
               'series': [{'field': 'value', 'chartType': 'waterfall'}]}]}})

# ── A5 · Top 5 tăng/giảm PAX theo khu vực (W25 vs W23) ────────────────
growth = []
for a in AREA_ORDER:
    p25, p23 = A25[a]['pax'], A23[a]['pax']
    if p23 > 0: growth.append((a, (p25 / p23 - 1) * 100))
growth.sort(key=lambda x: -x[1])
def bar(rows, label):
    return {'autoChart': {'chartType': 'bar-h', 'aspectRatio': 2.2,
        'dataset': {'columns': [{'id': 'area', 'type': 'string'},
                                {'id': 'value', 'type': 'number', 'label': label}],
                    'rows': rows},
        'views': [{'id': 'main', 'chartType': 'auto', 'xField': 'area',
                   'series': [{'field': 'value', 'chartType': 'bar-h'}]}]}}
save('cf_network_int_b_top5_growth.json', bar([[a, round(v, 1)] for a, v in growth[:5]], 'Tăng trưởng PAX W25/W23 (%)'))
save('cf_network_int_b_top5_lowest.json', bar([[a, round(v, 1)] for a, v in growth[-5:]], 'Tăng trưởng PAX W25/W23 (%)'))

# Nội địa: slide 28-29 không có PAX → dùng thay đổi LF (điểm), số có thật
dlf = sorted(((r['route'], r['w25']['lfSSLW']) for r in DOM if r['w25'].get('lfSSLW') is not None),
             key=lambda x: -x[1])
def barR(rows, label):
    d = bar(rows, label)
    d['autoChart']['dataset']['columns'][0]['id'] = 'route'
    d['autoChart']['views'][0]['xField'] = 'route'
    return d
save('cf_network_dom_b_top5_growth.json', barR([[r, round(v, 1)] for r, v in dlf[:5]], 'Thay đổi LF so W23 (điểm)'))
save('cf_network_dom_b_top5_lowest.json', barR([[r, round(v, 1)] for r, v in dlf[-5:]], 'Thay đổi LF so W23 (điểm)'))

print('Đã ghi:', len(CHANGED), 'file')
for f in CHANGED: print('  ', f)

# ══════════════════════════════════════════════════════════════════════
# PHẦN 2 — nhãn kỳ, lệch cục bộ, scatter, độ phủ
# ══════════════════════════════════════════════════════════════════════

# ── A6 · Đổi nhãn kỳ W31/W30 → W25/W23 (giữ nguyên tên thư mục W31) ───
for f in ['cf_network_int_b_area_nea.json', 'cf_network_int_b_area_eur.json',
          'cf_network_int_b_area_others.json']:
    p = path(f)
    if not os.path.exists(p + '.bak'): shutil.copy(p, p + '.bak')
    doc = json.load(open(p + '.bak', encoding='utf-8'))
    ac = doc['autoChart']
    for c in ac['dataset']['columns']:
        if c['id'] == 'w31': c['id'] = 'w25'; c['label'] = 'W25 · Pax Rev'
        if c['id'] == 'w30': c['id'] = 'w23'; c['label'] = 'W23 · Pax Rev'
    for v in ac['views']:
        for s in v.get('series', []):
            s['field'] = {'w31': 'w25', 'w30': 'w23'}.get(s.get('field'), s.get('field'))
    # B1 · JP W23 gõ nhầm 202.226 → 192.226 ; đồng thời đồng bộ mọi ô về số báo cáo
    ids = [c['id'] for c in ac['dataset']['columns']]
    for row in ac['dataset']['rows']:
        d = dict(zip(ids, row))
        cc = str(d['country']).split('-')[-1]
        if cc in C25:
            row[ids.index('w25')] = rnd(C25[cc]['paxRev'])
            row[ids.index('w23')] = rnd(C23[cc]['paxRev'])
    json.dump(doc, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    CHANGED.append(f + ' (nhãn kỳ + số)')

# ── B2 · US: 1.693 → 1.438 khách (suy từ slide 17, SGNSFO) ────────────
US = next((r for r in INT if r['country'] == 'US'), None)
us_pax = rnd(pax(US['w25'])) if US else None
for f, keys in [('cf_network_int_b_pax_by_country.json', ['vn']),
                ('cf_network_int_b_share_vn_by_country.json', ['vn_pax'])]:
    p = path(f)
    if not os.path.exists(p + '.bak'): shutil.copy(p, p + '.bak')
    doc = json.load(open(p, encoding='utf-8'))
    ac = doc['autoChart']; ids = [c['id'] for c in ac['dataset']['columns']]
    for row in ac['dataset']['rows']:
        if row[0] == 'US':
            for k in keys: row[ids.index(k)] = us_pax
    json.dump(doc, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    CHANGED.append(f + ' (US)')

# ── B3 · Thị phần nội địa: VNA 38,9% theo slide 7, các hãng khác co lại ─
VNA_DOM = 38.9
for f in ['cf_network_total_b_share_dom_pie.json', 'cf_network_dom_b_dom_share_pie.json']:
    p = path(f)
    if not os.path.exists(p + '.bak'): shutil.copy(p, p + '.bak')
    doc = json.load(open(p + '.bak', encoding='utf-8'))
    rows = doc['autoChart']['dataset']['rows']
    others = [r for r in rows if r[0] != 'VNA']
    tot_o = sum(r[1] for r in others)
    k = (100 - VNA_DOM) / tot_o
    for r in rows:
        r[1] = VNA_DOM if r[0] == 'VNA' else round(r[1] * k, 1)
    doc['autoChart']['note'] = ('VNA 38,9% lấy từ slide 7 ("MS VN Gr W25 đạt 38,9%"). '
                                'Báo cáo tuần không tách thị phần từng hãng còn lại nên phần 61,1% '
                                'được giữ nguyên tỷ lệ tương đối của dữ liệu cũ.')
    json.dump(doc, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    CHANGED.append(f + ' (thị phần nội địa)')

# ── B4 + C4 · Scatter hiệu quả: đổi sang Thu/Chi trên 1 khách ─────────
#   Báo cáo không tách ASK theo Area/Route nên KHÔNG suy được CASK/RASK ở
#   hai cấp đó. Thu/chi trên 1 khách thì tính được chính xác, và điểm hoà
#   vốn vẫn là đúng đường chéo y = x.
def per_pax(items, key):
    out = []
    for k, v in items:
        if not v['pax']: continue
        rev = (v['paxRev'] + v['cargo']) / v['pax'] * 1000
        cost = (v['paxRev'] + v['cargo'] - v['plTot']) / v['pax'] * 1000
        out.append([k, k, rnd(cost), rnd(rev), rnd(v['paxRev'])])
    return out

save('cf_network_total_b_scatter_cask_rask.json', {'autoChart': {
    'chartType': 'scatter', 'aspectRatio': 1.35,
    'note': 'Thu/chi trên 1 khách — báo cáo tuần không tách ASK theo khu vực nên không suy được CASK/RASK ở cấp này.',
    'dataset': {'columns': [
        {'id': 'name', 'type': 'string'}, {'id': 'segment', 'type': 'string'},
        {'id': 'cost_pax', 'type': 'number', 'label': 'Chi phí / khách (nghìn VNĐ)'},
        {'id': 'rev_pax',  'type': 'number', 'label': 'Doanh thu / khách (nghìn VNĐ)'},
        {'id': 'paxRev',   'type': 'number', 'label': 'DT khách (trđ)'}],
     'rows': per_pax(sorted(A25.items(), key=lambda kv: AREA_ORDER.index(kv[0])), 'area')},
    'views': [{'id': 'main', 'chartType': 'auto', 'xField': 'cost_pax', 'yField': 'rev_pax',
               'sizeField': 'paxRev', 'colorBy': 'segment',
               'series': [{'field': 'rev_pax', 'chartType': 'scatter'}],
               'breakEven': {'mode': 'diagonal', 'label': 'Hoà vốn (thu = chi)'}}]}})

rrows = []
for r in sorted(INT, key=lambda r: -r['w25']['paxRev']):
    b = r['w25']; p = pax(b)
    if not p: continue
    rev = (b['paxRev'] + (b['cargoRev'] or 0)) / p * 1000
    cost = (b['paxRev'] + (b['cargoRev'] or 0) - b['plTotal']) / p * 1000
    rrows.append([r['route'], r['area'], rnd(cost), rnd(rev), rnd(b['paxRev'])])
save('cf_network_int_b_scatter_rask_cask.json', {'autoChart': {
    'chartType': 'scatter', 'aspectRatio': 1.35,
    'note': 'Thu/chi trên 1 khách theo đường bay — 74/74 đường bay quốc tế của slide 15-17.',
    'dataset': {'columns': [
        {'id': 'route', 'type': 'string'}, {'id': 'area', 'type': 'string'},
        {'id': 'cost_pax', 'type': 'number', 'label': 'Chi phí / khách (nghìn VNĐ)'},
        {'id': 'rev_pax',  'type': 'number', 'label': 'Doanh thu / khách (nghìn VNĐ)'},
        {'id': 'paxRev',   'type': 'number', 'label': 'DT khách (trđ)'}],
     'rows': rrows},
    'views': [{'id': 'main', 'chartType': 'auto', 'xField': 'cost_pax', 'yField': 'rev_pax',
               'sizeField': 'paxRev', 'colorBy': 'area',
               'series': [{'field': 'rev_pax', 'chartType': 'scatter'}],
               'breakEven': {'mode': 'diagonal', 'label': 'Hoà vốn (thu = chi)'}}]}})

print('\nPhần 2 xong. Tổng file đã ghi:', len(CHANGED))

# ══════════════════════════════════════════════════════════════════════
# PHẦN 3 — độ phủ bảng route + nhãn trong index.json
# ══════════════════════════════════════════════════════════════════════
AREA_NAME = {'NEA': 'Đông Bắc Á', 'SEA': 'Đông Nam Á', 'CLMV': 'Campuchia – Lào – Myanmar',
             'SAS': 'Nam Á', 'EUR': 'Châu Âu', 'NOA': 'Bắc Mỹ', 'SWP': 'Tây Nam Thái Bình Dương'}

def vnum(n): return f'{n:,.0f}'.replace(',', '.')
def trend(cur, prev, pct=False):
    if cur is None or prev is None: return None
    d = cur - prev
    lab = (f'{d:+.1f}' + (' điểm' if not pct else '%')) if not pct else f'{(cur/prev-1)*100:+.1f}%'
    return {'direction': 'up' if d > 0 else ('down' if d < 0 else 'flat'),
            'label': lab, 'color': 'green' if d > 0 else ('red' if d < 0 else 'gray')}

# ── E · route_table INT: 25 → 74 đường bay, group theo Area ───────────
grp = defaultdict(list)
for r in INT: grp[r['area']].append(r)
order = sorted(grp, key=lambda a: -sum(x['w25']['plTotal'] for x in grp[a]))
rows, stt = [], 0
for a in order:
    items = sorted(grp[a], key=lambda r: -r['w25']['plTotal'])
    tv = sum(r['w25']['plVar'] for r in items)
    tt = sum(r['w25']['plTotal'] for r in items)
    rows.append({'id': f'grp_{a.lower()}', 'kind': 'group', 'group': {
        'title': f'{a} — {AREA_NAME.get(a, a)}', 'defaultExpanded': True,
        'badges': [{'label': f'{len(items)} đường bay', 'tone': 'neutral'},
                   {'label': f'P/L {"+" if tt > 0 else ""}{vnum(tt)} trđ',
                    'tone': 'success' if tt > 0 else 'danger'},
                   {'label': f'HQ so CPBĐ {vnum(tv)} trđ',
                    'tone': 'success' if tv > 0 else 'danger'}]}})
    for r in items:
        stt += 1; b, p = r['w25'], r['w23']
        rows.append({'id': f'r{stt}', 'groupId': f'grp_{a.lower()}', 'cells': {
            'stt': str(stt), 'rt': r['route'], 'ts': r['tsRaw'],
            'lf': f"{b['lf']:.1f}%".replace('.', ','),
            'ss_lf': trend(b['lf'], p['lf']),
            'gbq': rnd(b['gbq']),
            'ss_gbq': trend(b['gbq'], p['gbq'], pct=True),
            'pl_var': rnd(b['plVar']), 'pl_cost': rnd(b['plTotal']),
            'cont_fix': f"{b['contFix']:.0f}%"}})
W = {'stt': 52, 'rt': 92, 'ts': 66, 'lf': 72, 'ss_lf': 92, 'gbq': 88,
     'ss_gbq': 92, 'pl_var': 104, 'pl_cost': 104, 'cont_fix': 88}
cols = [
    {'id': 'stt', 'label': 'STT', 'type': 'text', 'align': 'center'},
    {'id': 'rt', 'label': 'RT', 'type': 'text', 'align': 'left'},
    {'id': 'ts', 'label': 'TS', 'type': 'text', 'align': 'center'},
    {'id': 'lf', 'label': 'LF', 'type': 'text', 'align': 'right'},
    {'id': 'ss_lf', 'label': 'SS LF', 'type': 'trend', 'align': 'right'},
    {'id': 'gbq', 'label': 'GBQ', 'type': 'number', 'align': 'right'},
    {'id': 'ss_gbq', 'label': 'SS GBQ', 'type': 'trend', 'align': 'right'},
    {'id': 'pl_var', 'label': 'P/L Var', 'type': 'signed-number', 'align': 'right'},
    {'id': 'pl_cost', 'label': 'P/L Cost', 'type': 'signed-number', 'align': 'right'},
    {'id': 'cont_fix', 'label': 'Cont Fix', 'type': 'threshold', 'align': 'right',
     'thresholds': {'good': 100, 'warn': 50, 'suffix': '%'}}]
for c in cols: c['width'] = W[c['id']]
save('cf_network_int_b_route_table.json',
     {'table': {'columns': cols, 'rows': rows, 'maxHeight': 560}})

# ── A6 (tiếp) · nhãn trong index.json ─────────────────────────────────
ip = os.path.join(W31, 'index.json')
if not os.path.exists(ip + '.bak'): shutil.copy(ip, ip + '.bak')
raw = open(ip, encoding='utf-8').read()
before = raw
raw = raw.replace('W31 vs W30', 'W25 vs W23').replace('Thị phần các hãng W31', 'Thị phần các hãng W25')
# tiêu đề widget đã đổi bản chất chỉ tiêu
raw = raw.replace('"DT khách + Hàng hóa theo Route"', '"HQ so CPBĐ và chi phí cố định theo Route"')
raw = raw.replace('"Top 5 khu vực tăng trưởng PAX cao nhất"', '"Top 5 khu vực tăng trưởng PAX cao nhất (W25/W23)"')
raw = raw.replace('"Top 5 đường bay tăng trưởng PAX cao nhất"', '"Top 5 đường bay tăng LF cao nhất (điểm, so W23)"')
raw = raw.replace('"CASK vs RASK theo khu vực (scatter)"', '"Thu / Chi trên 1 khách theo khu vực (scatter)"')
raw = raw.replace('"RASK vs CASK (scatter)"', '"Thu / Chi trên 1 khách theo đường bay (scatter)"')
open(ip, 'w', encoding='utf-8').write(raw)
print(f'index.json: đổi {sum(1 for a,b in zip(before.split(chr(10)), raw.split(chr(10))) if a!=b)} dòng nhãn')
print('W31 còn lại trong nhãn hiển thị:', raw.count('W31 vs W30') + raw.count('các hãng W31'))
print('\nTổng file đã ghi:', len(CHANGED))

# ══════════════════════════════════════════════════════════════════════
# PHẦN 4 — ngưỡng chi phí biến đổi phải đúng scope và đúng đơn vị
# ══════════════════════════════════════════════════════════════════════
#
# FCASK theo scope (VNĐ/ASK), suy từ slide 8:  DOM 804 · INT 638 · Total 701
#   → offset 638 chỉ đúng cho mạng quốc tế. Áp lên chart nội địa là sai scope.
#
# Nhưng hai scatter W31 đã đổi trục sang nghìn VNĐ/**khách**, nên offset tính
# theo VNĐ/**ASK** là sai luôn cả đơn vị. Giá trị đúng theo đơn vị mới là chi
# phí cố định / khách: DOM 735 · INT 2.657 · Total 1.416 nghìn.
#
# Vấn đề lớn nhất: chi phí cố định / khách chênh **9,1 lần** giữa các khu vực
# (CLMV 990 → NOA 9.049 nghìn) vì phụ thuộc độ dài chặng. Một đường offset
# chung sẽ nói sai cho cả hai đầu. Vì vậy bỏ đường offset trên chart per-pax và
# đưa ngưỡng riêng của từng điểm vào tooltip.

def fc_per_pax(items):
    fc = sum(r['w25']['plVar'] - r['w25']['plTotal'] for r in items)
    px = sum(pax(r['w25']) or 0 for r in items)
    return fc / px * 1000 if px else None

for f, keyfn in [('cf_network_total_b_scatter_cask_rask.json', lambda r: r['area']),
                 ('cf_network_int_b_scatter_rask_cask.json',   lambda r: r['route'])]:
    doc = load(f); ac = doc['autoChart']
    cols = ac['dataset']['columns']; ids = [c['id'] for c in cols]
    if 'fc_pax' not in ids:
        cols.append({'id': 'fc_pax', 'type': 'number', 'label': 'CP cố định / khách (nghìn VNĐ)'})
        cols.append({'id': 'vc_pax', 'type': 'number', 'label': 'CP biến đổi / khách (nghìn VNĐ)'})
    grp = defaultdict(list)
    for r in INT: grp[keyfn(r)].append(r)
    for row in ac['dataset']['rows']:
        items = grp.get(row[0], [])
        px = sum(pax(r['w25']) or 0 for r in items)
        fc = sum(r['w25']['plVar'] - r['w25']['plTotal'] for r in items)
        vc = sum((r['w25']['paxRev'] + (r['w25']['cargoRev'] or 0)) - r['w25']['plVar'] for r in items)
        vals = [rnd(fc / px * 1000) if px else None, rnd(vc / px * 1000) if px else None]
        if len(row) == len(cols) - 2: row.extend(vals)
        else: row[-2:] = vals
    v = ac['views'][0]
    v['tooltipFields'] = ['fc_pax', 'vc_pax']
    v['breakEven'] = {'mode': 'diagonal', 'label': 'Hoà vốn (thu = chi)'}   # bỏ offset
    ac['note'] = (ac.get('note', '') + ' Không vẽ đường bù chi phí biến đổi vì CP cố định/khách '
                  'chênh 9,1 lần giữa các khu vực (CLMV 990 → NOA 9.049 nghìn); ngưỡng riêng của '
                  'từng điểm xem trong tooltip.').strip()
    save(f, doc)

# ── Scatter nội địa: offset 638 là FCASK của INT, sai scope ───────────
#   Sửa triệt để không được vì slide 28-29 không có ASK lẫn PAX theo đường bay
#   → rask/cask/ask trong file là số không có nguồn. Tắt đường hoà vốn thay vì
#   vẽ một ngưỡng sai.
f = 'cf_network_dom_b_scatter_cask_rask.json'
doc = load(f)
doc['autoChart']['views'][0]['breakEven'] = {'mode': 'none'}
doc['autoChart']['note'] = ('Chưa có nguồn: slide 28-29 không có ASK lẫn PAX theo đường bay nội địa '
                            'nên không suy được CASK/RASK. Đường hoà vốn đã tắt — offset 638 trước đó '
                            'là FCASK của mạng quốc tế, không áp dụng cho nội địa (FCASK nội địa = 804).')
save(f, doc)

print('\nPhần 4 xong. Tổng file đã ghi:', len(CHANGED))

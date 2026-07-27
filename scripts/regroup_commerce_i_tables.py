# -*- coding: utf-8 -*-
"""Regroup Commerce-I tables: area/route-group section rows + highlight cell types."""
import json, re, os, shutil

BASE='/sessions/loving-dreamy-pascal/mnt/Source/mock-api/apiV5/domain/ceo-command-center/commerce-i/2026/07/chart'

AREA_NAME={'NEA':'Đông Bắc Á','SEA':'Đông Nam Á','CLMV':'Campuchia – Lào – Myanmar',
           'SAS':'Nam Á','EUR':'Châu Âu','NOA':'Bắc Mỹ','SWP':'Tây Nam Thái Bình Dương','MID':'Trung Đông'}
AREA_COLOR={'NEA':'blue','SEA':'green','CLMV':'teal','SAS':'purple','EUR':'orange','NOA':'red','SWP':'teal'}
AREA_ORDER=['NEA','SEA','CLMV','SAS','EUR','NOA','SWP','MID']

def load(f):
    p=os.path.join(BASE,f)
    bak=p+'.bak'
    if os.path.exists(bak): p=bak          # luôn dựng lại từ bản gốc → chạy lại được nhiều lần
    return json.load(open(p,encoding='utf-8'))
def save(f,d):
    p=os.path.join(BASE,f)
    if not os.path.exists(p+'.bak'): shutil.copy(p,p+'.bak')
    json.dump(d,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=2)

def label_of(v):
    if isinstance(v,dict): return str(v.get('label',''))
    return str(v) if v is not None else ''

def vnum(n):
    return f'{n:,.0f}'.replace(',','.')

def pl_badge(total):
    return {'label': f'P/L {"+" if total>0 else ""}{vnum(total)} trđ',
            'tone': 'success' if total>0 else 'danger'}

def count_badge(n):
    return {'label': f'{n} đường bay', 'tone': 'neutral'}

# ─────────────────────────────────────────────────────────────
# 1) cf_network_int_b_route_table — top đường bay INT, group theo Area
# ─────────────────────────────────────────────────────────────
def build_route_table():
    f='cf_network_int_b_route_table.json'
    t=load(f)['table']
    rows=t['rows']

    buckets={}
    for r in rows:
        c=dict(r['cells'])
        area=label_of(c.get('area')) or 'KHÁC'
        buckets.setdefault(area,[]).append((r.get('id'),c))

    order=[a for a in AREA_ORDER if a in buckets]+[a for a in buckets if a not in AREA_ORDER]
    # Area nào tổng P/L cao đứng trước
    order.sort(key=lambda a:-sum(x[1].get('pl_cost') or 0 for x in buckets[a]))

    out=[]
    for area in order:
        items=buckets[area]
        gid=f'grp_{area.lower()}'
        tot_cost=sum(x[1].get('pl_cost') or 0 for x in items)
        tot_var =sum(x[1].get('pl_var')  or 0 for x in items)
        out.append({
            'id': gid, 'kind':'group',
            'group': {
                'title': f'{area} — {AREA_NAME.get(area,area)}',
                'defaultExpanded': True,
                'badges': [count_badge(len(items)), pl_badge(tot_cost),
                           {'label': f'HQ so CPBĐ {vnum(tot_var)} trđ',
                            'tone':'success' if tot_var>0 else 'danger'}],
            }})
        for rid,c in items:
            c.pop('area',None)                      # Area đã nằm ở hàng group
            out.append({'id':rid,'groupId':gid,'cells':c})

    cols=[c for c in t['columns'] if c['id']!='area']
    W={'stt':52,'rt':92,'ts':66,'lf':72,'ss_lf':92,'gbq':88,'ss_gbq':92,
       'pl_var':104,'pl_cost':104,'cont_fix':88}
    for c in cols:
        c['width']=W.get(c['id'],90)
        if c['id'] in ('pl_var','pl_cost'): c['type']='signed-number'; c['align']='right'
        if c['id']=='cont_fix':
            c['type']='threshold'; c['align']='right'
            c['thresholds']={'good':100,'warn':50,'suffix':'%'}
        if c['id']=='lf': c['align']='right'
    t['columns']=cols
    t['rows']=out
    t['maxHeight']=t.get('maxHeight',520)
    save(f,{'table':t})
    return f, len(order), len(rows)

# ─────────────────────────────────────────────────────────────
# 2) cf_network_int_b_vn_vj_table — group Area, giữ total theo Country
# ─────────────────────────────────────────────────────────────
def build_vn_vj_table():
    f='cf_network_int_b_vn_vj_table.json'
    t=load(f)['table']
    out=[]; cur=None; pending=[]

    def flush():
        nonlocal cur,pending
        if cur is None: return
        area,gid=cur
        data=[r for r in pending if not label_of(r['cells'].get('country')).endswith('Total')]
        area_tot=next((r for r in pending
                       if label_of(r['cells'].get('country'))==f'{area} Total'), None)
        badges=[count_badge(len(data))]
        if area_tot:
            tc=area_tot['cells']
            badges.append({'label': f'PAX VN {vnum(tc.get("vn_pax") or 0)}','tone':'neutral'})
            badges.append({'label': f'LF VN {tc.get("vn_lf","-")}',
                           'tone':'success' if _pct(tc.get('vn_lf'))>=80 else 'warning'})
        out.append({'id':gid,'kind':'group',
                    'group':{'title':f'{area} — {AREA_NAME.get(area,area)}',
                             'defaultExpanded':True,'badges':badges}})
        for r in pending:
            lbl=label_of(r['cells'].get('country'))
            r['groupId']=gid
            r['cells'].pop('area',None)
            if lbl==f'{area} Total':
                r['tone']='other'                        # tổng khu vực — nền xanh nhạt
            elif lbl.endswith('Total'):
                r['tone']='total'                        # tổng theo quốc gia
            out.append(r)
        cur=None; pending=[]

    for r in t['rows']:
        area=label_of(r['cells'].get('area'))
        if area and not label_of(r['cells'].get('rt')):   # hàng header giả cũ
            flush()
            cur=(area,f'grp_{area.lower()}')
            continue
        if cur: pending.append(r)
        else:   out.append(r)
    flush()

    cols=[c for c in t['columns'] if c['id']!='area']
    W={'country':96,'rt':96,'vn_fls':74,'vn_pax':86,'vn_lf':76,
       'vj_fls':74,'vj_pax':86,'vj_lf':76,'lf_ttt':84}
    for c in cols:
        c['width']=W.get(c['id'],86)
        if c['id'] in ('vn_lf','vj_lf','lf_ttt'): c['align']='right'
    t['columns']=cols
    t['rows']=out
    # Table.tsx chỉ hỗ trợ 1 cột rowspan=2 và nó phải là cột đầu tiên
    # (xem filter tại Table.tsx:281-284) — các cột còn lại phải là colspan.
    for c in cols:
        if c['id'] in ('vn_fls','vj_fls','lf_ttt'): c['groupStart']=True
    t['type']='grouped'
    t['headerGroups']=[{'label':'Country','rowspan':2},
                       {'label':'','colspan':1},
                       {'label':'VIETNAM AIRLINES','colspan':3},
                       {'label':'VIETJET','colspan':3},
                       {'label':'','colspan':1}]
    t['maxHeight']=t.get('maxHeight',560)
    save(f,{'table':t})
    return f, sum(1 for r in out if r.get('kind')=='group'), len(out)

def _pct(v):
    if not isinstance(v,str): return 0.0
    m=re.search(r'([\d,\.]+)',v)
    if not m: return 0.0
    try: return float(m.group(1).replace('.','').replace(',','.'))
    except ValueError: return 0.0

# ─────────────────────────────────────────────────────────────
# 3+4) DOM tables — group theo nhóm đường bay nội địa
# ─────────────────────────────────────────────────────────────
TRUNK={'HANSGN','HANDAD','SGNDAD'}
TOURIST_PORTS={'CXR','PQC','VCS','DLI','UIH','HUI'}
DOM_GROUPS=[
  ('trunk','Trục chính','HAN – SGN – DAD'),
  ('tour','Đường bay du lịch','Cam Ranh · Phú Quốc · Côn Đảo · Quy Nhơn · Huế · Đà Lạt'),
  ('local','Đường bay địa phương','Các cảng còn lại'),
]
def dom_group_of(rt):
    rt=(rt or '').upper()
    if rt in TRUNK: return 'trunk'
    if any(rt[i:i+3] in TOURIST_PORTS for i in (0,3)): return 'tour'
    return 'local'

def build_dom_table(f, positive):
    t=load(f)['table']
    buckets={k:[] for k,_,_ in DOM_GROUPS}
    for r in t['rows']:
        buckets[dom_group_of(label_of(r['cells'].get('rt')))].append(r)

    out=[]
    for key,title,sub in DOM_GROUPS:
        items=buckets[key]
        if not items: continue
        gid=f'grp_dom_{key}'
        tot=sum(r['cells'].get('pl_cost') or 0 for r in items)
        out.append({'id':gid,'kind':'group',
                    'group':{'title':f'{title} — {sub}','defaultExpanded':True,
                             'badges':[count_badge(len(items)), pl_badge(tot)]}})
        for r in items:
            r['groupId']=gid
            out.append(r)

    W={'stt':52,'rt':96,'ts':78,'lf':74,'dttb':92,'pl_var':110,'pl_cost':110,'cont_fix':92}
    for c in t['columns']:
        c['width']=W.get(c['id'],90)
        if c['id'] in ('pl_var','pl_cost'): c['type']='signed-number'; c['align']='right'
        if c['id']=='cont_fix':
            c['type']='threshold'; c['align']='right'
            c['thresholds']={'good':100,'warn':50,'suffix':'%'}
        if c['id']=='lf': c['align']='right'
    t['rows']=out
    t['maxHeight']=t.get('maxHeight',480)
    save(f,{'table':t})
    return f, sum(1 for r in out if r.get('kind')=='group'), len(out)

if __name__=='__main__':
    for res in [build_route_table(), build_vn_vj_table(),
                build_dom_table('cf_network_dom_b_profitable_table.json',True),
                build_dom_table('cf_network_dom_b_loss_table.json',False)]:
        print(f'{res[0]:46} groups={res[1]:<3} rows={res[2]}')

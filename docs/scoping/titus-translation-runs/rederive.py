# Independent re-derivation (second script): counts from the per-language
# files, money/tokens/time from per-call ledger entries; never reads a
# "summary" block. Usage: rederive.py <translate dir> <check dir>...
import json, sys, os, collections, glob
def load(p): return json.load(open(p))
tr = sys.argv[1]; cks = sys.argv[2:]
trl = load(f'{tr}/run.json'); book = trl['book']
calls = trl['calls']
tcost = sum(c['cost'] for c in calls); tms = sum(c['ms'] for c in calls)
print('translator', trl['model'], 'calls', len(calls), 'models answered', sorted({c['model'] for c in calls}))
print(' tokens prompt', sum(c['promptTokens'] for c in calls), 'completion', sum(c['completionTokens'] for c in calls), 'reasoning', sum(c['reasoningTokens'] or 0 for c in calls), 'reasoning-null calls', sum(c['reasoningTokens'] is None for c in calls))
checked = {}  # lang -> titles dict from the check dir that has a call for it
ccalls = []
for d in cks:
    l = load(f'{d}/run.json')
    for c in l['calls']:
        ccalls.append(c)
        checked[c['language']] = load(f'{d}/{c["language"]}/{book}.json')['titles']
print(' checker models answered', sorted({c['model'] for c in ccalls}), 'check calls', len(ccalls))
tot = collections.Counter(); crit = collections.Counter()
for lang in trl['languages']:
    t = load(f'{tr}/{lang}/{book}.json')['titles']
    g = sum(1 for v in t.values() if v.get('gates'))
    c = checked.get(lang)
    if c is None:
        print(f'  {lang}: titles={len(t)} gates={g} NOT CHECKED'); tot['titles']+=len(t); tot['gates']+=g; continue
    a = sum(1 for v in c.values() if v.get('check',{}).get('verdict')=='agree')
    d_ = sum(1 for v in c.values() if v.get('check',{}).get('verdict')=='disagree')
    nv = sum(1 for v in c.values() if 'check' not in v)
    for v in c.values():
        for x in v.get('check',{}).get('criteria',[]): crit[x]+=1
    lc = [x for x in ccalls if x['language']==lang][0]
    tc = [x for x in calls if x['language']==lang][0]
    print(f'  {lang}: titles={len(t)} gates={g} agree={a} disagree={d_} noVerdict={nv} trCost={tc["cost"]:.6f} trMs={tc["ms"]} ckCost={lc["cost"]:.6f}')
    tot['titles']+=len(t); tot['gates']+=g; tot['agree']+=a; tot['disagree']+=d_; tot['noVerdict']+=nv; tot['checkedTitles']+=len(c)
ccost = sum(c['cost'] for c in ccalls)
print(' totals', dict(tot), 'criteria', dict(crit))
print(f' translate cost {tcost:.6f} per title {tcost/tot["titles"]:.6f} titles/h {tot["titles"]/tms*3.6e6:.0f} modelSeconds {tms/1000:.1f}')
print(f' check cost {ccost:.6f} per checked title {ccost/max(tot["checkedTitles"],1):.6f} check prompt {sum(c["promptTokens"] for c in ccalls)} completion {sum(c["completionTokens"] for c in ccalls)} reasoning {sum(c["reasoningTokens"] or 0 for c in ccalls)} ms {sum(c["ms"] for c in ccalls)}')

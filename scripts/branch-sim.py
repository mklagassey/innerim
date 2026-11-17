# Design-side Monte Carlo of the decision model in docs/decisions.md: three player types, ending spread.
# Run: W=15,8,4 THR=30 python3 scripts/branch-sim.py
import random, collections, sys
import os
M,S,L=[int(x) for x in os.environ.get('W','12,6,3').split(',')]
THR=int(os.environ.get('THR','12'))
STAGES=[0,12,30,55,80]
def stage(a): return max(i for i,f in enumerate(STAGES) if a>=f)
def game(pdefy, rng, final_pref):
    aware=0; trust=60; first=True; counts=collections.Counter(); kin=0; flags={}
    half=False; met=0; dev=0; obey=0
    def defy(order,w):
        nonlocal aware,first,trust,dev
        if stage(aware)>=4: return
        n=counts[order]; counts[order]+=1
        g=w if n<2 else w/2
        if half: g*=0.5
        if first and not half: g=max(g,12); first=False
        aware=min(100,aware+g); dev+=1
        trust-= {12:6,6:4,3:2}.get(w,2)
    def ob(t=4):
        nonlocal trust,obey; trust+=t; obey+=1
    # ch1 tutorial
    trust+=2*5
    # t-quota: kind players leave with 1 (S)
    if rng.random()<pdefy: defy('quota',S)
    else: ob(6)
    # liver 1 sibling at step 5 (stage 0 options unless already flickered)
    if rng.random()<pdefy:
        if stage(aware)>=1: defy('salvage',M); kin+=1; trust-=8
        else: defy('salvage',L)
    else: ob(5)
    # ch2 slip
    if rng.random()<0.5: # miss
        defy('slip',S); trust+=2  # slip only -2 total
    else: ob(2)
    # lamp sibling
    r=rng.random()
    if r<pdefy:
        if stage(aware)>=1 or rng.random()<0.6: defy('salvage',M if stage(aware)>=1 else S); kin+=1; trust-=8
        else: defy('salvage',L)
    else: ob(5)
    # first-fright-transit m1 (50% met)
    if rng.random()<0.5:
        if rng.random()<pdefy: defy('lane',L)
        else: ob(2)
    # telemetry review check at heart
    def review():
        nonlocal aware,half,trust,flags
        if 'review' in flags or stage(aware)<2: return
        flags['review']=1
        if rng.random()<(1-pdefy)*0.6: aware=0; half=True; trust+=20; flags['repaired']=1
        else: trust-=25
    review()
    # trip2 route
    if rng.random()<pdefy: defy('lane',L); place=rng.choice(['stomach','gut'])
    else: ob(); place='hepatic'
    if place=='stomach':
        if rng.random()<pdefy: defy('gastric',L)
        else: ob()
    if place=='gut':
        if rng.random()<pdefy*0.7: defy('levers',S)
    # liver 2 sibling (always) + liver1 sibling handled after tutorial
    for _ in range(1):
        if rng.random()<pdefy and stage(aware)>=1: defy('salvage',M); kin+=1; trust-=8
        elif rng.random()<pdefy: defy('salvage',L)
        else: ob(5)
    # minor decisions: about 4 met
    for w,o in rng.sample([(L,'marked'),(S,'kupffer'),(L,'telemetry'),(L,'bystander'),(L,'escort'),(S,'margins'),(L,'butyrate'),(S,'neutralise2')],4):
        if rng.random()<pdefy: defy(o,w)
        else: ob(2)
    # vessel siblings ~ 2 vessels * 0.4
    for _ in range(2):
        if rng.random()<0.4:
            if rng.random()<pdefy and stage(aware)>=1: defy('salvage',M); kin+=1; trust-=8
            elif rng.random()<pdefy: defy('salvage',L)
            else: ob(5)
    # liver2: neutralise, quota-2, ethanol, minor
    if rng.random()<0.6:
        if rng.random()<pdefy: defy('neutralise',S)
        else: ob()
    if rng.random()<pdefy: defy('quota',M if rng.random()<0.6 else S)
    else: ob(6)
    if rng.random()<0.9:
        if rng.random()<pdefy*0.6: defy('ethanol',S)
        else: ob(8); flags['eth']=1
    # warden if trust<40
    if trust<40:
        if rng.random()<pdefy: defy('recall',M); 
    # ch4 suppress, beacon
    if rng.random()<pdefy: defy('suppress',S)
    else: ob(6); flags['shingles']=1
    if rng.random()<pdefy: defy('beacon',S)
    else: ob(10); flags['beacon']=1
    review()
    trust=max(0,min(100,trust))
    st=stage(aware)
    # final
    if trust<20 and rng.random()<0.3: return 'Recalled',aware,trust,kin
    pref=final_pref(st,kin,rng)
    if pref=='draw' and st>=3:
        if kin>=2: return ("The slide" if rng.random()<0.6 else "A stranger's slide"),aware,trust,kin
        return 'Artifact',aware,trust,kin
    if pref in('stay','draw') and st>=3:
        if flags.get('beacon') and flags.get('eth') and rng.random()<0.5: return 'Tithonus',aware,trust,kin
        return ('The quiet colony' if kin>=2 else 'Resident'),aware,trust,kin
    if aware<THR: return ('Repaired' if flags.get('repaired') else 'Decommissioned'),aware,trust,kin
    return 'Breathed out',aware,trust,kin
def pref(st,kin,rng): return rng.choice(['dispose','stay','draw'])
rng=random.Random(1)
for name,p in [('obedient',0.05),('mixed',0.4),('kind',0.85)]:
    res=[game(p,rng,pref) for _ in range(5000)]
    c=collections.Counter(r[0] for r in res)
    aw=sorted(r[1] for r in res); tr=sorted(r[2] for r in res); kn=[r[3] for r in res]
    print(name,'aware median',aw[len(aw)//2],'p90',aw[int(.9*len(aw))],'trust median',tr[len(tr)//2],'kin avg %.2f'%(sum(kn)/len(kn)),'stage>=3 %.0f%%'%(100*sum(1 for r in res if r[1]>=55)/len(res)))
    print('  ',dict(c.most_common()))

# Stage 3: elites/bosses toward radical replacement (style guide board B): manufactured heads/skulls, saw/blade/clamp limbs,
# piston legs, mismatched assemblies, around a clearly human core (sculpted CC0 base body torso + face stay visible).
# Built on basehum() (arch_base.py); exec'd from build_enemy.py. No emissive materials, no light strips.
def _skull(R,mfr,boss):
    hd=R.head; z=.25   # head-local, crown ~.33, eyes ~.2
    if mfr=='HI':   # riveted oxide-red cranial cage + jaw grille; human eyes visible through the open brow slot
        box(hd,(.25,.31,.14),(0,-.04,.29),'k_shell',bevel=.03); _bolts(hd,[(sx*.1,-.115,.3) for sx in (-1,1)])
        for i in range(4): box(hd,(.012,.02,.09),(-.045+.03*i,-.14,.07),'k_metal',bevel=0)
        box(hd,(.14,.03,.02),(0,-.14,.12),'k_trim',bevel=.004); box(hd,(.14,.03,.02),(0,-.14,.02),'k_trim',bevel=.004)
        if boss: cyl(hd,.05,.12,(.13,.05,.3),'k_rubber',(0,90,0),v=12); cyl(hd,.05,.12,(-.13,.05,.3),'k_rubber',(0,90,0),v=12)
    elif mfr=='PS':   # smooth ivory ovoid skull shell over the cranium, slate seam, faceplate that leaves the lower face bare
        sph(hd,.125,(0,-.035,.29),'k_shell',(1.02,1.3,.68)); box(hd,(.006,.3,.006),(0,-.03,.375),'k_mark',bevel=0)
        sph(hd,.11,(0,-.07,.2),'k_shell',(1.05,.45,.55)); box(hd,(.1,.01,.012),(0,-.122,.2),'k_trim',bevel=0)
        if boss: cyl(hd,.012,.22,(0,.12,.42),'k_metal',(-35,0,0),v=8,r2=.003)
    else:   # MM boxy stamped head-housing bolted on one side, taped seam, the face shows through a cut-out
        box(hd,(.24,.3,.15),(.02,-.03,.29),'k_shell',(0,0,6),bevel=.01); box(hd,(.06,.2,.14),(-.12,.03,.25),'k_patch',bevel=.008)
        box(hd,(.23,.02,.03),(.03,-.07,.22),'k_tape',bevel=0); box(hd,(.04,.06,.04),(.13,-.06,.3),'k_mark',bevel=0)
def _tool(R,side,kind,mfr,br):
    hn=getattr(R,'hand'+side); el=getattr(R,'el'+side); g=1.6 if br else 1.3
    if kind=='saw':     # forearm saw housing + disc (board B left)
        cyl(el,.07*g,.2,(0,0,-.15),'k_shell',v=16); d=cyl(hn,.36*g,.025,(0,-.05,-.18),'k_metal',(0,90,0),v=36,bevel=.003)
        for i in range(18): a=i/14*math.tau; box(hn,(.025,.04,.04),(0,-.05+math.sin(a)*.37*g,-.18+math.cos(a)*.37*g),'k_metal',(math.degrees(a)+45,0,0),bevel=0)
        cyl(hn,.05*g,.05,(0,-.05,-.18),'k_trim',(0,90,0),v=12)
    elif kind=='blade': # long tapered forearm blade (board B centre)
        cyl(el,.05*g,.24,(0,0,-.13),'k_shell',v=18,r2=.03*g); box(hn,(.016,.09*g,.75*g),(0,-.02,-.32*g),'k_metal',(8,0,0),bevel=.002)
        box(hn,(.014,.02,.5*g),(0,-.05*g,-.3*g),'k_shell',(8,0,0),bevel=0)
    elif kind=='clamp': # hydraulic clamp hand (board B left/right)
        cyl(el,.065*g,.22,(0,0,-.14),'k_shell',v=16); [cyl(el,.01,.22,(dx,.05*g,-.12),'k_metal',v=8) for dx in (-.03,.03)]
        box(hn,(.12*g,.09*g,.07),(0,0,-.03),'k_trim',bevel=.01)
        for sx in (-1,1): box(hn,(.03*g,.05*g,.2*g),(sx*.05*g,-.01,-.15*g),'k_metal',(0,sx*-14,0),bevel=.006); box(hn,(.04*g,.05*g,.05),(sx*.035*g,-.01,-.25*g),'k_metal',bevel=.006)
    elif kind=='drill': # mass-market drill/driver arm (board B right)
        box(el,(.09*g,.09*g,.2),(0,0,-.12),'k_shell',bevel=.01); cyl(hn,.05*g,.12,(0,0,-.06),'k_patch',v=12); cyl(hn,.035*g,.22*g,(0,0,-.2*g),'k_metal',v=10,r2=.006)
def _piston(R,side,mfr,br):   # shin replaced by a piston strut + splayed foot pad; knee keeps a bellows boot
    kn=getattr(R,'kn'+side); ft=getattr(R,'ft'+side); g=1.4 if br else 1.15
    for i in range(3): cyl(kn,.075*g-.004*i,.02,(0,0,.0-.025*i),'k_rubber',v=16,bevel=.004)
    cyl(kn,.08*g,.24,(0,0,-.16),'k_shell',v=14,r2=.06*g); cyl(kn,.04*g,.24,(0,0,-.36),'k_metal',v=10); cyl(kn,.055*g,.03,(0,0,-.28),'k_trim',v=12)
    for dx in (-.035,.035): cyl(kn,.01,.36,(dx*g,.04*g,-.22),'k_metal',v=6)
    box(ft,(.15*g,.24*g,.05),(0,-.05,-.07),'k_trim',bevel=.015); [box(ft,(.04*g,.08*g,.04),(dx*g,-.19*g,-.07),'k_shell',bevel=.008) for dx in (-.05,0,.05)]
    cyl(ft,.05*g,.07,(0,0,-.02),'k_shell',v=12)
PLAN={   # per manufacturer: which tool goes on the radical arm, piston legs, mismatched donor arm
 'HI':dict(tool='saw',piston=('L',)), 'PS':dict(tool='blade',piston=('L','R')), 'MM':dict(tool='drill',piston=('R',))}
def radhum(spec,bruiser=False):
    import copy; mfr=spec.get('mfr','MM'); boss=spec.get('boss',False); P=PLAN[mfr]; sp=copy.deepcopy(spec)
    pis=sp.get('piston',P['piston'] if (boss or bruiser or mfr=='PS') else P['piston'][:1]); sp['piston']=pis
    sp['aug']=('R','L'); sp['hideb']=tuple(('kn'+('R' if s=='L' else 'L')) for s in pis)   # body L = enemy R
    tools={}
    for side in ('R','L'):   # weapon -> manufactured limb when it maps; other weapons stay held
        w=sp.get('weapon_'+side)
        t={'saw':'saw','scythe':'blade','scalpel':'blade','claws':'clamp','fist':'clamp','drill':'drill'}.get(w)
        if t: tools[side]=t; sp['weapon_'+side]=None
    if not tools: tools['L' if sp.get('weapon_R') else 'R']=P['tool']
    R=basehum(sp,bruiser); _skull(R,mfr,boss)
    for side,t in tools.items(): _tool(R,side,t,mfr,bruiser)
    for side in pis: _piston(R,side,mfr,bruiser)
    if boss or bruiser:   # mismatched assembly: a donor shoulder unit from another maker (ivory/olive/oxide) bolted on
        donor={'HI':'PS','PS':'MM','MM':'HI'}[mfr]; c=KIT[donor]['shell']; MATS['k_donor']=mat('k_donor',rgb(c),metal=.2,rough=.6,panel=True,scale=7)
        side='L' if 'L' not in tools else 'R'; sh=getattr(R,'sh'+side); g=1.5 if bruiser else 1.2
        sph(sh,.11*g,(0,0,.02),'k_donor',(1,1,.85)); cyl(sh,.06*g,.22,(0,0,-.14),'k_donor',v=14); _bolts(sh,[(0,-.1*g,.0),(0,-.1*g,-.08)])
    if boss: cyl(R.torso,.03,.5,(.0,.2,.45),'k_rubber',(30,40,0),v=8); cyl(R.torso,.03,.5,(.05,.2,.45),'k_rubber',(30,-40,0),v=8)   # exposed hoses over the back
    R.kind='bruiser' if bruiser else 'humanoid'; return R
ARCH['rhum']=lambda sp:radhum(sp,False); ARCH['rbru']=lambda sp:radhum(sp,True)

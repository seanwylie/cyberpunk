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
def _head2(R,kind):
    hd=R.head
    if kind=='dome':   cyl(hd,.17,.02,(0,-.02,.27),'k_trim',v=24); sph(hd,.14,(0,-.02,.29),'k_shell',(1,1.1,.75)); box(hd,(.03,.2,.05),(0,-.02,.38),'k_mark',bevel=.01)
    elif kind=='crt':  box(hd,(.3,.26,.24),(0,-.02,.26),'k_shell',bevel=.02); box(hd,(.22,.02,.14),(0,-.155,.27),'k_trim',bevel=.005); box(hd,(.05,.05,.12),(.12,.1,.42),'k_metal',bevel=0)
    elif kind=='bucket': cyl(hd,.16,.22,(0,-.02,.28),'k_shell',v=18,r2=.13); box(hd,(.24,.02,.03),(0,-.17,.24),'k_tape',bevel=0); cyl(hd,.17,.02,(0,-.02,.18),'k_trim',v=18)
    elif kind=='periscope': box(hd,(.2,.22,.12),(0,-.02,.29),'k_shell',bevel=.015); cyl(hd,.04,.34,(.06,-.02,.5),'k_metal',v=10); box(hd,(.08,.14,.07),(.06,-.07,.68),'k_shell',bevel=.01)
    elif kind=='flat': box(hd,(.4,.24,.08),(0,-.03,.3),'k_shell',bevel=.015); [box(hd,(.03,.06,.03),(sx*.17,-.16,.3),'k_mark',bevel=0) for sx in (-1,1)]
    elif kind=='round': sph(hd,.17,(0,-.02,.27),'k_metal',(1,1,.9)); tor(hd,.16,.015,(0,-.02,.26),'k_trim'); box(hd,(.14,.02,.04),(0,-.18,.24),'k_trim',bevel=0)
def _back(R,kind,bx):
    t=R.torso; y=(.13+.045)*1.6-.045+.08
    if kind=='stacks':
        for dx in (-.09,.09): cyl(t,.05,.6,(dx,y,.65),'k_metal',v=12); cyl(t,.06,.05,(dx,y,.96),'k_rubber',v=12)
        box(t,(.3,.12,.3),(0,y-.02,.38),'k_shell',bevel=.02)
    elif kind=='reel': box(t,(.3,.1,.3),(0,y-.03,.4),'k_trim',bevel=.02); cyl(t,.2,.12,(0,y+.06,.48),'k_shell',(0,90,0),v=24); cyl(t,.09,.14,(0,y+.06,.48),'k_rubber',(0,90,0),v=14)
    elif kind=='mast':
        box(t,(.32,.1,.36),(0,y-.03,.38),'k_shell',bevel=.02)
        for dx in (-.11,.11): box(t,(.04,.04,1.0),(dx,y+.03,.75),'k_metal',bevel=0)
        for zz in (.6,.9,1.2): box(t,(.26,.03,.03),(0,y+.03,zz),'k_trim',bevel=0)
    elif kind=='toolbox': box(t,(.38,.18,.28),(0,y,.36),'k_shell',bevel=.02); box(t,(.16,.03,.04),(0,y,.52),'k_metal',bevel=0); box(t,(.36,.19,.02),(0,y,.3),'k_tape',bevel=0)
    elif kind=='drum': cyl(t,.18,.42,(0,y+.04,.42),'k_shell',(0,90,0),v=20); [box(t,(.44,.03,.03),(0,y+.04+.18*math.sin(a),.42+.18*math.cos(a)),'k_metal',(math.degrees(a),0,0),bevel=0) for a in [i*math.tau/8 for i in range(8)]]
    elif kind=='tanks':
        for dx in (-.1,.1): cyl(t,.08,.42,(dx,y,.42),'k_shell',v=14); cyl(t,.03,.06,(dx,y,.66),'k_metal',v=8)
    elif kind=='ribs':   # PS ceramic spinal frame
        for i in range(5): box(t,(.3-.03*i,.05,.04),(0,y-.04,.15+.12*i),'k_shell',bevel=.01)
        box(t,(.04,.06,.66),(0,y-.03,.4),'k_trim',bevel=.005)
def _extraarm(R,side,mfr,big):   # third arm from the chest/back corner with a small clamp (mismatched assembly)
    sx=1 if side=='R' else -1; t=R.torso; j=joint('xa'+side,t,(sx*.24,-.05,.36)); j.rotation_euler=(math.radians(-50),math.radians(sx*25),0)
    g=1.3 if big else 1.0; cyl(j,.05*g,.3*g,(0,0,-.15*g),'k_shell',v=12); cyl(j,.04*g,.06,(0,0,-.31*g),'k_rubber',v=12); cyl(j,.035*g,.26*g,(0,0,-.46*g),'k_metal',v=10)
    for d in (-1,1): box(j,(.025*g,.04*g,.14*g),(d*.035*g,0,-.64*g),'k_metal',(0,d*-15,0),bevel=.004)
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
    elif kind=='tines':  # forklift tines (stock handling)
        box(el,(.1*g,.1*g,.2),(0,0,-.12),'k_shell',bevel=.01); box(hn,(.16*g,.06,.06),(0,-.02,-.04),'k_trim',bevel=.005)
        for dx in (-.05,.05): box(hn,(.03*g,.36*g,.02),(dx*g,-.2*g,-.08),'k_metal',bevel=.003); box(hn,(.03*g,.02,.14),(dx*g,-.02,-.08),'k_metal',bevel=.003)
    elif kind=='longclaw': # oversized gantry claw on an extended forearm
        cyl(el,.07*g,.34,(0,0,-.2),'k_shell',v=14); cyl(hn,.04*g,.3,(0,0,-.14),'k_metal',v=10); box(hn,(.16*g,.12*g,.08),(0,0,-.3),'k_trim',bevel=.01)
        for d in (-1,1): box(hn,(.04*g,.06*g,.34*g),(d*.07*g,0,-.5*g),'k_metal',(0,d*-20,0),bevel=.006); box(hn,(.06*g,.06*g,.06),(d*.04*g,0,-.68*g),'k_metal',bevel=.006)
    elif kind=='hammer':  # pneumatic hammer fist
        cyl(el,.075*g,.22,(0,0,-.13),'k_shell',v=14); box(hn,(.2*g,.2*g,.22*g),(0,0,-.13*g),'k_trim',bevel=.02); [cyl(hn,.012,.2,(dx*g,.1*g,-.1),'k_metal',v=6) for dx in (-.06,.06)]
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
    L=sp.get('look',{})
    for side,t in L.get('tools',{}).items(): tools[side]=t; sp['weapon_'+side]=None
    if 'piston' in L: pis=L['piston']; sp['piston']=pis; sp['hideb']=tuple(('kn'+('R' if s=='L' else 'L')) for s in pis)
    R=basehum(sp,bruiser); hs=L.get('hs',1.3 if L else 1.0); R.head.scale=(hs,hs,hs); bpy.context.view_layer.update()
    if L.get('head'): _head2(R,L['head'])
    else: _skull(R,mfr,boss)
    if L.get('back'): _back(R,L['back'],sp.get('bulk',(1.95,1.62))[0])
    if L.get('xarm'): _extraarm(R,L['xarm'],mfr,boss)
    for side,t in tools.items(): _tool(R,side,t,mfr,bruiser)
    for side in pis: _piston(R,side,mfr,bruiser)
    if L.get('donor', not L):   # mismatched assembly: a donor shoulder unit from another maker (ivory/olive/oxide) bolted on
        donor={'HI':'PS','PS':'MM','MM':'HI'}[mfr]; c=KIT[donor]['shell']; MATS['k_donor']=mat('k_donor',rgb(c),metal=.2,rough=.6,panel=True,scale=7)
        side='L' if 'L' not in tools else 'R'; sh=getattr(R,'sh'+side); g=1.5 if bruiser else 1.2
        sph(sh,.11*g,(0,0,.02),'k_donor',(1,1,.85)); cyl(sh,.06*g,.22,(0,0,-.14),'k_donor',v=14); _bolts(sh,[(0,-.1*g,.0),(0,-.1*g,-.08)])
    if boss: cyl(R.torso,.03,.5,(.0,.2,.45),'k_rubber',(30,40,0),v=8); cyl(R.torso,.03,.5,(.05,.2,.45),'k_rubber',(30,-40,0),v=8)   # exposed hoses over the back
    g=sp.get('grow',1.0); R.root.scale=(g,g,g); bpy.context.view_layer.update()   # read larger in the same frame (R.height/ortho unchanged)
    R.kind='bruiser' if bruiser else 'humanoid'; return R
ARCH['rhum']=lambda sp:radhum(sp,False); ARCH['rbru']=lambda sp:radhum(sp,True)

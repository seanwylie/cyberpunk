# Sculpted CC0 base body for regular humanoid/bruiser mobs (tools/sprites/base, MakeHuman hm08, CC0) + manufacturer part kits.
# exec'd from build_enemy.py. A spec opts in with base=True (see specs_base.py). Same joint names as humanoid() so pose() is unchanged;
# the body is linear-blend skinned to the joints every frame (R.skin). Kits per style guide: HI = oxide red actuators, bellows, bolts;
# PS = dirty ivory ceramic, slate markings, tapered/blade; MM = olive stamped polymer with visible repairs. No emissive materials.
import numpy as np
_BASE=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','sprites','base')
KIT={'HI':dict(shell='#9a4630',trim='#4e3a30',metal='#8e8780',rubber='#2c2926',mark='#d0c09c'),
     'PS':dict(shell='#ddd3bc',trim='#56626b',metal='#9a9c97',rubber='#34373a',mark='#4a545c'),
     'MM':dict(shell='#6e7448',trim='#474b37',metal='#83857d',rubber='#33332a',mark='#c2b285')}
CLOTH={'HI':('#6e5a4c','#4e4840'),'PS':('#aab2a8','#7a807a'),'MM':('#727658','#57594a')}
def _desat(h,k=.55,mix=None):
    c=np.array([int(h[i:i+2],16) for i in (1,3,5)],float); g=c.mean(); c=g+(c-g)*k
    if mix: m=np.array([int(mix[i:i+2],16) for i in (1,3,5)],float); c=c*.5+m*.5
    return '#%02x%02x%02x'%tuple(int(max(0,min(255,v))) for v in c*.92)
def _kitmats(mfr,spec):
    K=KIT[mfr]; p=spec['palette']; sh,pa=CLOTH[mfr]
    MATS['k_shell']=mat('k_shell',rgb(K['shell']),metal=.25 if mfr!='MM' else .05,rough=.5 if mfr=='PS' else .62,panel=mfr!='PS',scale=7,wear='#d6cfbd' if mfr!='HI' else '#9a8a78')
    MATS['k_trim']=mat('k_trim',rgb(K['trim']),metal=.35,rough=.6,panel=False); MATS['k_metal']=mat('k_metal',rgb(K['metal']),metal=.85,rough=.42,panel=False,wear='#c8c6c0')
    MATS['k_rubber']=mat('k_rubber',rgb(K['rubber']),metal=0,rough=.9,panel=False,bump=.8); MATS['k_mark']=mat('k_mark',rgb(K['mark']),metal=.1,rough=.7,panel=False)
    MATS['k_tape']=mat('k_tape',rgb('#8f8466'),metal=0,rough=.95,panel=False,bump=1.0); MATS['k_patch']=mat('k_patch',rgb('#6a6c66'),metal=.4,rough=.6,panel=True,scale=9)
    MATS['b_shirt']=mat('b_shirt',rgb(_desat(p['main'],.7,sh)),metal=0,rough=.95,panel=False,bump=.9)
    MATS['b_pants']=mat('b_pants',rgb(_desat(p.get('cloth',p['dark']),.4,pa)),metal=0,rough=.95,panel=False,bump=.9)
    MATS['b_boot']=mat('b_boot',rgb('#3a3530'),metal=.05,rough=.75,panel=False); MATS['b_skin']=mat('b_skin',rgb(spec.get('skin','#7d6a5e')),metal=0,rough=.85,panel=False,bump=.15)
    MATS['b_hair']=mat('b_hair',rgb('#2e2620'),metal=0,rough=.9,panel=False,bump=1.2); MATS['b_eye']=mat('b_eye',rgb('#b9b2a2'),metal=0,rough=.4,panel=False); MATS['b_pupil']=mat('b_pupil',rgb('#141210'),metal=0,rough=.3,panel=False)
    MATS['b_brow']=mat('b_brow',rgb('#1e1814'),metal=0,rough=.9,panel=False)
    for g in ('glow',): MATS[g]=mat(g,rgb(_desat(p.get('glow','#8a7a60'),.3,'#7a7466')),metal=.2,rough=.6,panel=False)   # no emission: former light strips read as painted plates
_BD={}
def _bd(sex):
    if sex not in _BD: _BD[sex]=np.load(os.path.join(_BASE,f'body_{sex}.npz'))
    return _BD[sex]
def basehum(spec,bruiser=False):
    mfr=spec.get('mfr','MM'); _kitmats(mfr,spec); BD=_bd(spec.get('sex','m'))
    P=BD['P'].copy(); Wt=BD['W']; F=[list(r[:n]) for r,n in zip(BD['F'],BD['flen'])]; BE=[str(x) for x in BD['bones']]; dom=Wt.argmax(1)
    s=spec.get('scale',1.0); oldH=((.88+.08+.62+.1+.5) if not bruiser else (.88*.82+.08+.62*1.25+.1+.45))*s
    bx,by=spec.get('bulk',(1.95,1.62) if bruiser else (1.45,1.28)); head=dom==BE.index('headP')
    P[~head,0]*=bx; P[~head,1]=(P[~head,1]+.045)*by-.045
    k=oldH/P[:,2].max()
    R=Rig(); R.s=s; R.kind='bruiser' if bruiser else 'humanoid'; R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,.96*k)); R.hips.scale=(k,k,k)
    R.torso=joint('torso',R.hips,(0,0,.06)); R.head=joint('head',R.torso,(0,0,.62))
    for side,sx in (('L',-1),('R',1)):
        sh=joint('sh'+side,R.torso,(sx*.2*bx,0,.55)); el=joint('el'+side,sh,(0,0,-.29)); hn=joint('hand'+side,el,(0,0,-.27))
        hp=joint('hp'+side,R.hips,(sx*.115*bx,0,-.02)); kn=joint('kn'+side,hp,(0,0,-.43)); ft=joint('ft'+side,kn,(0,0,-.42))
        for nm,o in (('sh',sh),('el',el),('hand',hn),('hp',hp),('kn',kn),('ft',ft)): setattr(R,nm+side,o)
    MAPJ={'hips':'hips','torsoP':'torso','headP':'head'}
    for pb,eb in (('sh','sh'),('el','el'),('wr','hand'),('hp','hp'),('kn','kn'),('an','ft')): MAPJ[pb+'L']=eb+'R'; MAPJ[pb+'R']=eb+'L'   # body L is +x = enemy R
    R.lift={'key':1.25,'fill':2.2,'rim':2.6,'rim2':2.0}; R.hipH=.96*k; R.leg=.85*k; R.height=oldH
    # ---- which limb carries the install (hidden body faces + kit parts)
    aug=spec.get('aug',{'HI':('R',),'PS':('L',),'MM':('R',)}[mfr]) if not bruiser else spec.get('aug',('R','L') if mfr!='PS' else ('L',))
    hide=set()
    for side in aug:
        bl='L' if side=='R' else 'R'
        hide|={BE.index('wr'+bl),BE.index('el'+bl)}
    hide|={BE.index('anL'),BE.index('anR')}   # feet -> boots
    hide|={BE.index(b) for b in spec.get('hideb',())}   # radical (elite/boss) installs replace whole limb segments
    # ---- material per face: hair / skin / shirt / pants / boots
    z=BD['P'][:,2]; y=BD['P'][:,1]; x=BD['P'][:,0]; ez=BD['LM'][0][2]
    hairm=head&(z>ez+.035-.09*np.clip((y+.05)/.15,0,1))&~((np.abs(x)>.085)&(z<ez+.03))
    sleeve={'HI':.22,'PS':.12,'MM':.27}[mfr]
    def cls(v):
        b=BE[dom[v]]
        if b=='headP': return 'b_hair' if hairm[v] else 'b_skin'
        if b in('hips','torsoP'): return 'b_shirt' if z[v]>1.0 else 'b_pants'
        if b[:2]=='sh': return 'b_shirt' if z[v]>1.57-sleeve else 'b_skin'
        if b[:2] in('el','wr'): return 'b_skin'
        if b[:2] in('hp','kn'): return 'b_pants'
        if b[:2]=='an': return 'b_boot' if z[v]<.16 else 'b_pants'
        return 'b_skin'
    VC=[cls(v) for v in range(len(P))]
    OFF={'b_shirt':.014,'b_pants':.02,'b_boot':.016,'b_hair':.008,'b_skin':0.0}
    faces=[f for f in F if dom[f[0]] not in hide or len(set(dom[i] for i in f)&hide)<len(f)]
    faces=[f for f in faces if not all(dom[i] in hide for i in f)]
    me=bpy.data.meshes.new('body'); me.from_pydata((P*k).tolist(),[],faces); me.update()
    nrm=np.array([v.normal[:] for v in me.vertices]); off=np.array([OFF[c] for c in VC])*k
    if mfr=='MM': off+=np.where(np.array(VC)=='b_shirt',.006*k*np.sin(z*60+x*25),0)   # baggy folds
    Q=P*k+nrm*off[:,None]; me.vertices.foreach_set('co',Q.ravel()); me.update()
    ob=bpy.data.objects.new('body',me); sc.collection.objects.link(ob); names=['b_skin','b_shirt','b_pants','b_boot','b_hair']
    for n in names: me.materials.append(MATS[n])
    for p in me.polygons:
        vs=list(p.vertices); cs=[VC[i] for i in vs]; p.material_index=names.index(max(set(cs),key=cs.count)); p.use_smooth=True
    bpy.context.view_layer.update()
    EMP={b:getattr(R,MAPJ[b]) if MAPJ[b] not in('hips','torso','head') else {'hips':R.hips,'torso':R.torso,'head':R.head}[MAPJ[b]] for b in BE}
    REST={b:EMP[b].matrix_world.copy() for b in BE}; RH=np.c_[Q,np.ones(len(Q))]
    def skin():
        Ms=np.array([np.array(EMP[b].matrix_world@REST[b].inverted()) for b in BE]); X=np.einsum('bij,nj->nbi',Ms,RH)[:,:,:3]
        me.vertices.foreach_set('co',(Wt[:,:,None]*X).sum(1).ravel()); me.update()
    R.skin=skin
    # ---- face: eyes, brows (exaggerated for small sprites)
    hd=R.head; hz=1.64
    for E in BD['LM'][:2]:
        ex,ey,ezz=E[0],E[1],E[2]-hz; sph(hd,.016,(ex,ey+.006,ezz),'b_eye',(1,.6,.75)); sph(hd,.008,(ex,ey-.004,ezz),'b_pupil')
        box(hd,(.034,.012,.009),(ex,ey-.004,ezz+.02),'b_brow',bevel=0)
    for side in [x for x in ('L','R') if x not in spec.get('piston',())]:   # work boots: sole, upper, toe cap, laced shaft
        ft=getattr(R,'ft'+side); g=1.15 if bruiser else 1.0
        box(ft,(.11*g,.25*g,.05),(0,-.06,-.065),'b_boot',bevel=.015); box(ft,(.1*g,.19*g,.07),(0,-.04,-.02),'b_boot',bevel=.025)
        sph(ft,.05*g,(0,-.15*g,-.04),'b_boot',(1.05,1.0,.75)); cyl(ft,.058*g,.12,(0,.0,.04),'b_boot',v=14,r2=.052*g); box(ft,(.11*g,.26*g,.012),(0,-.06,-.092),'k_rubber',bevel=.004)
    t=R.torso; cw=.17*bx; yf=(-.16+.045)*by-.045-.03; yb=(.13+.045)*by-.045+.03   # manufacturer chest/back plates follow the bulked surface
    if mfr=='PS': sph(t,cw*.7,(0,yf+.01,.42),'k_shell',(1,.28,1.1)); box(t,(.008,.012,.2),(0,yf-.02,.42),'k_mark',bevel=0); sph(t,cw*.65,(0,yb,.4),'k_shell',(1,.3,1.1))
    else:
        box(t,(cw*1.3,.04,.28),(0,yf,.4),'k_shell',(-8,0,0),bevel=.02); box(t,(cw*1.3,.04,.32),(0,yb,.38),'k_shell' if mfr=='HI' else 'k_patch',bevel=.02)
        if mfr=='HI': _bolts(t,[(sx*cw*.5,yf-.022,zz) for sx in (-1,1) for zz in (.32,.48)])
        else: box(t,(cw*.45,.012,.06),(-cw*.3,yf-.022,.46),'k_tape',bevel=0)
    kits(R,spec,mfr,aug,bruiser,k); extras_b(R,spec,bruiser,bx)
    for side in ('L','R'):
        wk=spec.get('weapon_'+side)
        if wk: weapon(wk,getattr(R,'hand'+side),s)
    return R
def _bolts(j,pts,r=.008):
    for p in pts: cyl(j,r,.012,p,'k_metal',(90,0,0),v=6,bevel=0)
def kits(R,spec,mfr,aug,br,k):
    for side in aug:
        sx=1 if side=='R' else -1; sh,el,hn=getattr(R,'sh'+side),getattr(R,'el'+side),getattr(R,'hand'+side); g=1.6 if br else 1.25
        if mfr=='HI':   # oxide-red actuator arm: housing, rubber bellows at the elbow, twin pistons, bolted plates, clamp hand
            cyl(sh,.07*g,.06,(0,0,.0),'k_shell',v=16); _bolts(sh,[(sx*.0,-.07*g,.0),(sx*.05*g,-.05*g,.0)])
            cyl(sh,.052*g,.2,(0,0,-.17),'k_trim',v=14)
            for i in range(4): cyl(el,.058*g-.003*i,.018,(0,0,.02-.022*i),'k_rubber',v=16,bevel=.004)
            cyl(el,.06*g,.18,(0,0,-.16),'k_shell',v=16,r2=.052*g); box(el,(.05*g,.03,.14),(sx*.03,-.055*g,-.15),'k_shell',bevel=.01)
            for dx in (-.03,.03): cyl(el,.009,.2,(dx*g,.05*g,-.12),'k_metal',v=8)
            _bolts(el,[(sx*.03,-.071*g,-.1),(sx*.03,-.071*g,-.2),(-sx*.03,-.06*g,-.15)])
            box(hn,(.09*g,.08*g,.08),(0,0,-.03),'k_trim',bevel=.012)
            for dx in (-.03,0,.03): box(hn,(.022*g,.03,.07),(dx*g,-.02,-.1),'k_metal',bevel=.006)
            if br: cyl(sh,.075*g,.16,(0,0,-.12),'k_shell',v=16,r2=.06*g); box(sh,(.16,.18,.06),(sx*.03,0,.04),'k_shell',bevel=.02)
        elif mfr=='PS':   # dirty ivory ceramic: long tapered forearm shell, slate bands + markings, a folded forearm blade
            cyl(el,.05*g,.25,(0,0,-.13),'k_shell',v=20,r2=.028*g)
            for zz in (-.05,-.17): cyl(el,.049*g-(.2+zz)*.0,.008,(0,0,zz),'k_trim',v=20)
            box(el,(.004,.03,.05),(sx*.045*g,-.02,-.11),'k_mark',bevel=0)
            box(el,(.006,.022,.24),(sx*.05*g,.0,-.17),'k_metal',(0,sx*6,0),bevel=.002); cyl(el,.012,.02,(sx*.045*g,0,-.05),'k_trim',(0,90,0),v=8)
            for dx in (-.022,-.007,.008,.023): cyl(hn,.007,.085,(dx,-.004,-.06),'k_shell',v=8,r2=.004)
            cyl(hn,.03,.04,(0,0,-.015),'k_shell',v=14)
        else:   # MM olive stamped polymer: blocky forearm panels with seams, a mismatched replacement panel, tape + zip ties
            box(el,(.085*g,.08*g,.11),(0,0,-.07),'k_shell',bevel=.012); box(el,(.08*g,.075*g,.1),(0,0,-.19),'k_patch',(0,0,4),bevel=.012)
            for zz in (-.13,-.135): pass
            cyl(el,.052*g,.03,(0,0,-.13),'k_tape',v=14,bevel=.003); cyl(el,.05*g,.012,(0,0,-.24),'k_rubber',v=12,bevel=.002)
            box(el,(.004,.06,.03),(sx*.044*g,-.0,-.04),'k_mark',bevel=0)
            box(hn,(.09*g,.085*g,.1),(0,0,-.05),'k_shell',bevel=.014); cyl(hn,.045*g,.02,(0,0,-.005),'k_tape',v=12)
    if mfr=='PS' and not br:   # cranial plate on the side of the skull with a slate seam
        sx=-1 if 'L' in aug else 1; sph(R.head,.07,(sx*.065,-.0,.24),'k_shell',(.55,1.1,.9)); box(R.head,(.004,.08,.004),(sx*.1,-.0,.24),'k_mark',bevel=0)
    if mfr=='MM':   # stamped shin plate with a tape repair on the other leg
        side='L' if 'R' in aug else 'R'; kn=getattr(R,'kn'+side); box(kn,(.11,.04,.2),(0,-.065,-.17),'k_shell',bevel=.01); cyl(kn,.064,.025,(0,-.0,-.12),'k_tape',v=14)
    if mfr=='HI' and not br:   # heavy shoulder plate
        sx=1 if 'R' in aug else -1; box(R.torso,(.14,.17,.05),(sx*.19,-.03,.58),'k_shell',(0,sx*-14,0),bevel=.015); _bolts(R.torso,[(sx*.19,-.12,.585)])
def extras_b(R,spec,br,bx):
    t,hd=R.torso,R.head; fy,by=-.2,.12; tw=.36*bx; hz=.33   # torso-local chest front/back, shoulder width; head-local crown
    for e in spec.get('extras',()):
        if e=='tank': cyl(t,.06,.32,(.07,by+.07,.32),'k_metal',v=12); cyl(t,.06,.32,(-.07,by+.07,.32),'k_shell',v=12); box(t,(.2,.03,.04),(0,by+.03,.4),'k_trim',bevel=0)
        elif e in('robe',): box(R.hips,(tw*1.05,.3,.5),(0,-.04,-.24),'b_shirt',bevel=.03)
        elif e=='apron': box(t,(tw*.8,.02,.62),(0,fy-.02,.12),'k_mark' if spec.get('mfr')=='PS' else 'b_pants',bevel=.008)
        elif e=='cross': box(t,(.06,.01,.018),(0,fy-.035,.36),'k_mark',bevel=0); box(t,(.018,.01,.06),(0,fy-.035,.36),'k_mark',bevel=0)
        elif e=='hat': cyl(hd,.13,.02,(0,-.03,hz-.02),'k_trim',v=20); cyl(hd,.1,.07,(0,-.03,hz+.02),'b_shirt',v=20)
        elif e=='cone': cyl(hd,.12,.16,(0,-.03,hz+.04),'k_shell',v=18,r2=.02)
        elif e=='mask': box(hd,(.1,.05,.07),(0,-.17,.12),'k_shell',bevel=.015); cyl(hd,.02,.05,(0,-.2,.1),'k_trim',(90,0,0),v=8)
        elif e=='hivis':
            for zz in (.18,.38): box(t,(tw*1.1,.32,.025),(0,-.045,zz),'k_mark',bevel=0)
        elif e=='plate': box(t,(tw*.75,.03,.3),(0,fy-.02,.32),'k_shell',bevel=.012)
        elif e=='visor': box(hd,(.15,.03,.03),(0,-.155,.2),'k_trim',bevel=.005)
        elif e=='goggles': box(hd,(.16,.03,.02),(0,-.13,.27),'k_rubber',bevel=0); [cyl(hd,.022,.025,(sx*.038,-.15,.27),'k_metal',(90,0,0),v=12) for sx in (-1,1)]
        elif e=='cape': box(t,(tw*1.1,.02,.7),(0,by+.03,.15),'b_pants',(6,0,0),bevel=.01)
        elif e=='hood': sph(hd,.125,(0,.0,.2),'b_shirt',(1,1.1,1.05)); box(hd,(.2,.12,.18),(0,.06,.12),'b_shirt',bevel=.03)
        elif e=='satchel': box(R.hips,(.14,.07,.12),(-.18*bx,-.02,-.02),'b_pants',bevel=.015); box(t,(.03,.01,.5),(0,fy+.0,.25),'k_trim',(0,-40,0),bevel=0)
        elif e=='dishback': cyl(t,.015,.3,(0,by+.06,.45),'k_metal',v=6); cyl(t,.18,.03,(0,by+.12,.65),'k_shell',(70,0,0),v=24,r2=.04)
        elif e=='bell': cyl(t,.14,.25,(0,by+.16,.3),'k_shell',v=18,r2=.06); cyl(t,.04,.06,(0,by+.16,.45),'k_metal',v=8)
        elif e=='syringes':
            for i in range(3): cyl(t,.014,.12,(-.08+.04*i,by+.04,.42),'k_mark',(20,0,0),v=8)
        elif e=='halo': tor(hd,.15,.01,(0,0,hz+.12),'k_metal')
        elif e=='shield': box(R.handL,(.03,.32,.42),(0,-.1,-.08),'k_shell',bevel=.02); box(R.handL,(.035,.2,.04),(0,-.1,.04),'k_mark',bevel=0)
        elif e=='pauldrons':
            for sx in (-1,1): sph(t,.09*bx,(sx*(.2*bx+.02),0,.57),'k_shell',(1,1,.7))
        elif e=='coils':
            box(t,(.2,.05,.4),(0,by+.04,.32),'k_trim',bevel=.01)
            for i in range(3): cyl(t,.075,.04,(0,by+.1,.2+.12*i),'k_metal' if i%2 else 'k_shell',(90,0,0),v=16)
        elif e=='horns':   # forged horn pair bolted to the skull (HI)
            for sx in (-1,1): cyl(hd,.035,.26,(sx*.13,-.01,.36),'k_metal',(0,sx*-38,0),v=8,r2=.006); cyl(hd,.045,.05,(sx*.1,-.01,.33),'k_shell',(0,sx*-38,0),v=10)
        elif e=='spikes':
            for i in range(4): cyl(t,.018,.08,(0,by+.03,.15+.12*i),'k_metal',(-70,0,0),v=6,r2=.003)
        else: print('extras_b: skipped',e,flush=True)
ARCH['bhum']=lambda sp:basehum(sp,False); ARCH['bbru']=lambda sp:basehum(sp,True)

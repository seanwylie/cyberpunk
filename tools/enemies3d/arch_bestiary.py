# Bestiary archetypes (docs/BESTIARY.md): NON-ROBOT bodies. exec'd inside build_enemy.py's namespace after arch_batch2.py.
# Organic materials (flesh / chitin / wire / gel / holo) are added on top of the palette; every rig has a procedural pose in pose3() with a non-humanoid gait:
#   arach (skitter, tripod gait; spider/tick/crab+turret)  worm (slither, travelling wave; lamprey mouth)  jelly (pulse-drift, trailing tentacles; med-drone)
#   swarm (nine small things that scatter/regroup)  sac (bloated gas bag, lurch/inflate/burst; fungal stalks)  doll (stop-motion stiff mannequin)
#   many (tentacled / corpse-pile chassis, ripple walk)  phantom (hologram / glitch shards, float + flicker)
_pal0=palette
def palette(p):
    _pal0(p)
    MATS['flesh']=mat('flesh',rgb(p.get('flesh','#8a5048')),metal=0,rough=.3,panel=False,bump=.8,scale=3.0,wear='#c89a8a')
    MATS['chitin']=mat('chitin',rgb(p.get('chitin','#2c2422')),metal=.15,rough=.2,panel=False,bump=.4,wear='#8a7a66')
    MATS['wire']=mat('wire',rgb('#17181c'),metal=.25,rough=.5,panel=False,bump=.7,scale=9.0,wear='#555a60')
    g=mat('gel',rgb(p.get('gel','#a6c4b4')),metal=0,rough=.1,panel=False,bump=.15)
    try:
        b=g.node_tree.nodes['Principled BSDF']; b.inputs['Transmission Weight'].default_value=.6; b.inputs['Alpha'].default_value=.78
    except Exception: pass
    MATS['gel']=g
    h=mat('holo',rgb(p.get('glow','#60d0ff'),.8),metal=0,rough=.4,panel=False,emit=p.get('glow','#60d0ff'),bump=.05)
    try:
        b=h.node_tree.nodes['Principled BSDF']; b.inputs['Alpha'].default_value=.55; b.inputs['Emission Strength'].default_value=1.6
    except Exception: pass
    MATS['holo']=h
def seg(parent,L,r0,r1,m,loc=(0,0,0),rot=(0,0,0),v=10):
    """tapered segment hanging down -Z from `loc` (proximal radius r0 at the joint, distal r1 at the tip)"""
    return cyl(parent,r1,L,(loc[0],loc[1],loc[2]-L/2),m,rot,v=v,r2=r0,bevel=0)
def chain(parent,n,L,r0,r1,m,loc=(0,0,0),rot=(0,0,0),m2=None,tip=None):
    js=[]; p=parent; rr=r0
    for i in range(n):
        j=joint('ch',p,loc if i==0 else (0,0,-L)); 
        if i==0: j.rotation_euler=[math.radians(a) for a in rot]
        t=i/max(1,n-1); ra=r0+(r1-r0)*t; rb=r0+(r1-r0)*min(1,(i+1)/max(1,n-1))
        seg(j,L,ra,rb,m if (i%2==0 or not m2) else m2); sph(j,rb*1.05,(0,0,-L),m if not m2 else m2); js.append(j); p=j
    if tip: sph(js[-1],tip[0],(0,0,-L-.02),tip[1])
    return js
def eyes(hd,n,r,y,z,spread,m='glow'):
    for i in range(n): sph(hd,r*(1-.12*(i%2)),((i-(n-1)/2)*spread,y,z+(.03 if i%2 else 0)),m)

# ------------------------------------------------------------------ arach: spider / tick / crab
def arach(spec):
    R=Rig(); R.kind='arach'; s=spec.get('scale',1.0); ex=spec.get('extras',()); nl=spec.get('legs',8); R.root=joint('root'); hz=spec.get('hip_z',.55); R.hips=joint('hips',R.root,(0,0,hz*s)); R.hips.scale=(s,s,s); h=R.hips
    R.torso=joint('torso',h,(0,0,0)); t=R.torso; crab='crab' in ex; tick='tick' in ex
    if crab: box(t,(1.0,.8,.26),(0,0,.1),'chitin',bevel=.08); box(t,(.8,.5,.12),(0,-.05,.26),'metal',bevel=.04)
    else: sph(t,.34,(0,-.1,.1),'chitin',(1,1.25,.8))
    ab=1.0 if not tick else 1.5
    if not crab: sph(t,.42*ab,(0,.55,.2),'flesh' if tick else 'chitin',(1,1.25,.9)); 
    if 'sacglow' in ex: sph(t,.3,(0,.62,.3),'glow',(1,1.1,.8))
    for i in range(3 if not crab else 2): cyl(t,.025,.5,(-.1+i*.1,.45 if not crab else .1,.52 if not crab else .34),'wire',(70,0,i*12-12),v=6,bevel=0)
    R.head=joint('head',t,(0,-.5 if not crab else -.45,.14)); hd=R.head; sph(hd,.2 if not tick else .15,(0,-.06,0),'chitin',(1,1,.85)); eyes(hd,spec.get('eyes',4),.045,-.22,.05,.08)
    R.jaw=joint('jaw',hd,(0,-.2,-.06))
    for sx in (-1,1): cyl(R.jaw,.03,.28,(sx*.07,-.1,0),'metal' if not tick else 'flesh',(80,0,sx*-22),v=6,r2=.004)
    if 'lamprey' in ex:
        tor(hd,.11,.025,(0,-.24,-.02),'flesh',(90,0,0)); 
        for i in range(8): a=i/8*math.tau; cyl(hd,.014,.07,(math.cos(a)*.1,-.24,-.02+math.sin(a)*.1),'white',(90,0,0),v=4,r2=.002,bevel=0)
    R.gun=joint('gun',t,(0,0,.4))
    if crab:
        cyl(R.gun,.18,.12,(0,0,.06),'dark',v=18); box(R.gun,(.22,.3,.2),(0,-.04,.2),'metal',bevel=.03)
        for sx in (-1,1): cyl(R.gun,.04,.7,(sx*.08,-.4,.22),'metal',(90,0,0),v=8,bevel=0)
    R.claws=[]
    if crab:
        for sx in (-1,1):
            c=joint('claw',t,(sx*.5,-.34,.12)); R.claws.append((c,sx)); seg(c,.55,.1,.08,'chitin',(0,0,0),(0,0,0)); c.rotation_euler=(math.radians(100),0,0)
            box(c,(.2,.34,.12),(0,0,-.72),'chitin',bevel=.03); box(c,(.06,.3,.08),(sx*.06,-.05,-.9),'metal',(0,0,0),bevel=.01); box(c,(.06,.3,.08),(-sx*.06,-.05,-.9),'metal',bevel=.01)
    R.legs=[]; L1=spec.get('L1',.5); L2=spec.get('L2',.7); yaws=[-55,-18,18,55] if nl==8 else [-40,0,40]
    for i,yw in enumerate(yaws):
        for sx in (1,-1):
            hp=joint('lg',h,(sx*.2,(i-len(yaws)/2+.5)*.2,.0)); base=yw if sx>0 else 180-yw; hp.rotation_euler=(0,0,math.radians(base))
            up=joint('up',hp,(0,0,0)); up.rotation_euler=(0,math.radians(-42),0); cyl(up,.05,L1,(L1/2,0,0),'chitin',(0,90,0),v=8,r2=.035,bevel=0)
            kn=joint('kn',up,(L1,0,0)); kn.rotation_euler=(0,math.radians(118),0); sph(kn,.06,(0,0,0),'metal' if i%2==0 else 'chitin'); cyl(kn,.032,L2,(L2/2,0,0),'chitin',(0,90,0),v=8,r2=.012,bevel=0)
            R.legs.append((hp,kn,sx,i,base,up))
    R.hipH=hz*s; R.height=(1.15 if not crab else 1.0)*s*spec.get('hmul',1.0); return R
def arach_pose(R,spec,anim,f,n):
    u=f/n; ph=u*math.tau; s1=math.sin(ph); hip0=R.hipH; w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w)); wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0
    for (hp,kn,sx,i,base,up) in R.legs:
        g=((i%2==0)==(sx>0)); p2=ph if g else ph+math.pi; sw=math.sin(p2)*(26 if anim=='walk' else 0); lift=max(0,math.cos(p2))*(28 if anim=='walk' else 0)
        d=sw*(-1 if sx>0 else 1)*1; hp.rotation_euler=(0,0,math.radians(base+d+(-sx*r*12 if anim=='attack' else 0)))
        up.rotation_euler=(0,math.radians(-42-lift-(r*20 if anim=='attack' else 0)+(math.sin(ph*.5+i)*3 if anim=='idle' else 0)),0)
        if anim=='death': dd=sm(u); up.rotation_euler=(0,math.radians(-42+dd*80),0); kn.rotation_euler=(0,math.radians(118+dd*50),0)
        if anim=='hit': up.rotation_euler=(0,math.radians(-42-math.sin(u*3.14)*14),0)
    if anim=='idle': R.hips.location.z=R.hipH+s1*.012; setr(R.head,s1*3,0,math.sin(ph*.5)*8); setr(R.jaw,5+s1*4)
    elif anim=='walk': R.hips.location.z=R.hipH-abs(s1)*.03; setr(R.torso,math.sin(ph*2)*2,0,s1*5); setr(R.jaw,6)
    elif anim=='attack': R.root.location.y=-.6*r; setr(R.torso,-wind*24+r*16); setr(R.head,r*14); setr(R.jaw,wind*10+(55*r if r>.5 else 0)); R.hips.location.z=R.hipH-.05*r
    elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=rr*.24; setr(R.torso,-rr*18); setr(R.jaw,rr*30)
    elif anim=='death': d=sm(u); R.hips.location.z=R.hipH-d*(R.hipH*.7); R.root.rotation_euler=(0,math.radians(d*160),0); setr(R.jaw,d*50)
    if hasattr(R,'claws'):
        for c,sx in R.claws:
            c.rotation_euler=(math.radians(100-(r*70 if anim=='attack' else 0)+(math.sin(ph+sx)*5 if anim!='death' else 0)),0,math.radians(sx*(-r*25 if anim=='attack' else 0)))
    if anim=='attack': R.gun.location.y=-.0+r*.0; setr(R.gun,-r*6+wind*4)

# ------------------------------------------------------------------ worm: slithering, lamprey mouth
def worm(spec):
    R=Rig(); R.kind='worm'; s=spec.get('scale',1.0); N=spec.get('segs',9); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,.38*s)); R.hips.scale=(s,s,s); h=R.hips
    R.torso=joint('torso',h,(0,0,0)); t=R.torso; R.head=joint('head',t,(0,-.1,0)); hd=R.head; ex=spec.get('extras',())
    sph(hd,.3,(0,-.1,0),'flesh',(1,1.1,.95)); tor(hd,.19,.07,(0,-.38,0),'flesh',(90,0,0)); sph(hd,.14,(0,-.4,0),'dark',(1,.5,1))
    for i in range(12): a=i/12*math.tau; cyl(hd,.022,.12,(math.cos(a)*.17,-.36,math.sin(a)*.17),'white',(90,0,0),v=4,r2=.003,bevel=0)
    for i in range(6): a=i/6*math.tau+.26; cyl(hd,.016,.09,(math.cos(a)*.09,-.34,math.sin(a)*.09),'white',(90,0,0),v=4,r2=.002,bevel=0)
    eyes(hd,2,.05,-.1,.26,.2) if 'eyes' in ex else None
    R.segs=[]; p=t
    for i in range(N):
        j=joint('sg',p,(0,.26,0)); k=i/(N-1); rr=.3*(1-.55*k)+.06; sph(j,rr,(0,.12,0),'flesh' if i%2==0 else 'chitin' if 'plates' in ex else 'flesh',(1,1.25,.9))
        if 'plates' in ex and i%2==0: box(j,(rr*1.5,.1,.06),(0,.14,rr*.8),'metal',bevel=.01)
        if i%3==1: cyl(j,.02,.3,(rr*.9,.1,0),'wire',(0,90,0),v=5,bevel=0)
        R.segs.append(j); p=j
    if 'glowtail' in ex: sph(R.segs[-1],.1,(0,.36,0),'glow')
    R.hipH=.38*s; R.height=.95*s*spec.get('hmul',1.0); return R
def worm_pose(R,spec,anim,f,n):
    u=f/n; ph=u*math.tau; hip0=R.hipH; w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w)); wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0; N=len(R.segs)
    for i,j in enumerate(R.segs):
        if anim=='idle': setr(j,0,0,math.sin(ph-i*.6)*5)
        elif anim=='walk': setr(j,0,0,math.sin(ph-i*.75)*20)
        elif anim=='attack': setr(j,-(wind*8 if i<3 else 0)-r*(4 if i<3 else 0),0,math.sin(i*.8)*(10*(1-r)))
        elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); setr(j,0,0,rr*16*(1 if i%2 else -1))
        elif anim=='death': d=sm(u); setr(j,0,0,d*40*(1 if i%2 else -1)*math.sin(i))
    if anim=='idle': setr(R.head,math.sin(ph)*3,0,math.sin(ph*.5)*5); R.hips.location.z=hip0+math.sin(ph)*.008
    elif anim=='walk': setr(R.head,0,0,math.sin(ph-.2)*-12); R.hips.location.z=hip0
    elif anim=='attack': R.hips.location.z=hip0+.28*wind-.0*r; setr(R.torso,-wind*45+r*20); R.root.location.y=-.7*r; setr(R.head,-wind*15+r*25)
    elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=rr*.22; setr(R.torso,-rr*22); setr(R.head,rr*20)
    elif anim=='death': d=sm(u); R.hips.location.z=hip0-d*.2; setr(R.torso,d*25,0,d*60); setr(R.head,d*30); R.root.rotation_euler=(0,math.radians(d*100),0)

# ------------------------------------------------------------------ jelly: pulsing drifter / rogue med-drone with flesh sacs
def jelly(spec):
    R=Rig(); R.kind='jelly'; s=spec.get('scale',1.0); ex=spec.get('extras',()); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,1.15*s)); R.hips.scale=(s,s,s); h=R.hips
    R.torso=joint('torso',h,(0,0,0)); t=R.torso; R.bell=joint('bell',t,(0,0,.1))
    sph(R.bell,.5,(0,0,.1),'gel',(1,1,.62)); sph(R.bell,.28,(0,0,.06),'flesh' if 'organs' in ex else 'glow',(1,1,.8)); tor(R.bell,.46,.045,(0,0,-.1),'flesh',(0,0,0))
    if 'drone' in ex:
        sph(R.bell,.2,(0,-.1,.5),'white',(1,1,.8)); sph(R.bell,.07,(0,-.28,.52),'glow'); 
        for sx in (-1,1): cyl(R.bell,.03,.4,(sx*.2,-.2,.48),'metal',(70,0,sx*-25),v=6,bevel=0)
    R.head=t; R.tents=[]; nt=spec.get('tents',7)
    for i in range(nt):
        a=i/nt*math.tau; L=.34+.08*(i%3); js=chain(t,5,L,.05,.012,'flesh' if i%2 else 'wire',(math.cos(a)*.34,math.sin(a)*.34,-.05),(math.sin(a)*14,-math.cos(a)*14,0),tip=(.025,'glow') if 'stingtips' in ex else None); R.tents.append((js,a))
    if 'syringes' in ex:
        for k in range(3): cyl(t,.03,.4,(-.15+k*.15,-.3,-.35),'white',(180,0,0),v=6,r2=.01,bevel=0)
    R.hipH=1.15*s; R.height=1.75*s; return R
def jelly_pose(R,spec,anim,f,n):
    u=f/n; ph=u*math.tau; hip0=R.hipH; w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w)); wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0
    pulse=.5+.5*math.sin(ph*(2 if anim=='walk' else 1)); R.bell.scale=(1+.12*pulse,1+.12*pulse,1-.2*pulse) if anim in('idle','walk') else (1,1,1)
    if anim=='attack': k=1+.3*wind-.25*r; R.bell.scale=(k,k,1-.3*wind+.3*r)
    if anim=='hit': R.bell.scale=(1.15,1.15,.7)
    if anim=='death': d=sm(u); R.bell.scale=(1+d*.5,1+d*.5,1-d*.7)
    for js,a in R.tents:
        for i,j in enumerate(js):
            lag=math.sin(ph-i*.8)
            if anim=='idle': setr(j,lag*6,lag*4,0)
            elif anim=='walk': setr(j,lag*14+10,lag*8,0)
            elif anim=='attack': setr(j,-r*(60-i*8)+wind*20,0,0)
            elif anim=='hit': setr(j,math.sin(u*3.14)*20,0,0)
            elif anim=='death': d=sm(u); setr(j,d*50,0,d*20*math.sin(i+a))
    if anim=='idle': R.hips.location.z=hip0+math.sin(ph)*.06
    elif anim=='walk': R.hips.location.z=hip0+math.sin(ph*2)*.08; setr(R.torso,-12)
    elif anim=='attack': R.root.location.y=-.45*r; R.hips.location.z=hip0+.15*wind
    elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=rr*.2; setr(R.torso,-rr*14,0,rr*8)
    elif anim=='death': d=sm(u); R.hips.location.z=hip0-d*(hip0-.28); setr(R.torso,d*40,0,d*30)

# ------------------------------------------------------------------ swarm: nine small things
def swarm(spec):
    R=Rig(); R.kind='swarm'; s=spec.get('scale',1.0); n=spec.get('n',9); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,.08*s)); R.hips.scale=(s,s,s); h=R.hips; R.torso=joint('torso',h,(0,0,0)); R.head=R.torso
    rn=0; R.crit=[]; ex=spec.get('extras',()); import random as _r; rg=_r.Random(spec.get('seed',4))
    for i in range(n):
        a=i/n*math.tau+rg.random()*.5; d=.1+.34*rg.random()*(1 if i else 0); bx,by=math.cos(a)*d,math.sin(a)*d*.8
        c=joint('c',h,(bx,by,0)); R.crit.append((c,bx,by,rg.random()*6.28)); sc=.8+rg.random()*.45
        sph(c,.11*sc,(0,0,.1*sc),'chitin' if 'beetles' in ex else 'flesh',(.8,1.25,.7)); sph(c,.06*sc,(0,-.14*sc,.12*sc),'chitin',(1,1,.8)); sph(c,.022,(.03,-.2*sc,.15*sc),'glow'); sph(c,.022,(-.03,-.2*sc,.15*sc),'glow')
        if 'wired' in ex or i%3==0: cyl(c,.012,.22,(0,.16*sc,.1*sc),'wire',(70,0,0),v=4,bevel=0)
        for k in range(3):
            for sx in (-1,1): cyl(c,.01,.12,(sx*.09*sc,(k-1)*.07,.04),'metal',(0,sx*35,0),v=4,bevel=0)
        if 'exposed' in ex and i%2==0: box(c,(.07,.1,.04),(0,.02*sc,.2*sc),'metal',bevel=.01)
    R.hipH=.08*s; R.height=.6*s; return R
def swarm_pose(R,spec,anim,f,n):
    u=f/n; ph=u*math.tau; w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w)); wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0
    for k,(c,bx,by,p) in enumerate(R.crit):
        q=ph+p; x,y,z,yaw=bx,by,0,0
        if anim=='idle': x+=math.sin(q)*.03; y+=math.cos(q*1.3)*.03; yaw=math.sin(q)*25
        elif anim=='walk': x+=math.sin(q*2)*.05; y+=math.cos(q*2)*.05; z=abs(math.sin(q*2))*.06; yaw=math.sin(q)*20
        elif anim=='attack': x=bx*(1-wind*.4)*(1-r*.5); y=by*(1-wind*.4)-r*.5*(1+(k%3)*.3); z=abs(math.sin(q*3))*.1*r; yaw=0
        elif anim=='hit': x=bx*(1+.45*math.sin(u*3.14)); y=by*(1+.45*math.sin(u*3.14)); yaw=math.sin(q)*60
        elif anim=='death': d=sm(u); x=bx*(1+d*1.0); y=by*(1+d*.9); z=-d*.0; yaw=d*150*(1 if k%2 else -1)
        c.location=(x,y,z); c.rotation_euler=(math.radians(180*sm(u) if anim=='death' and k%2 else 0),0,math.radians(yaw))
    if anim=='attack': R.root.location.y=-.2*r

# ------------------------------------------------------------------ sac: bloated gas bag / fungal growth
def sac(spec):
    R=Rig(); R.kind='sac'; s=spec.get('scale',1.0); ex=spec.get('extras',()); R.root=joint('root'); hz=.42; R.hips=joint('hips',R.root,(0,0,hz*s)); R.hips.scale=(s,s,s); h=R.hips
    R.torso=joint('torso',h,(0,0,.1)); t=R.torso; R.bell=joint('bag',t,(0,0,.34))
    if 'fungal' in ex:
        sph(R.bell,.34,(0,0,0),'flesh',(1,1,.9))
        for i in range(7): a=i/7*math.tau; seg_h=.3+.12*(i%3); cyl(R.bell,.035,seg_h,(math.cos(a)*.22,math.sin(a)*.22,.32+seg_h/2),'wire',(math.sin(a)*14,-math.cos(a)*14,0),v=6,r2=.025,bevel=0); sph(R.bell,.12-.015*(i%3),(math.cos(a)*(.22+.06*math.sin(a*2)),math.sin(a)*.22,.34+seg_h),'gel' if i%2 else 'flesh',(1,1,.5)); sph(R.bell,.05,(math.cos(a)*.22,math.sin(a)*.22,.36+seg_h),'glow')
    else:
        sph(R.bell,.52,(0,0,.1),'gel',(1,1,1.1)); sph(R.bell,.34,(0,0,.1),'glow',(1,1,1.1))
        for i in range(3): tor(R.bell,.5-i*.06,.025,(0,0,.05+i*.22),'flesh',(0,0,i*10))
        for i in range(5): a=i/5*math.tau; cyl(R.bell,.02,.45,(math.cos(a)*.28,math.sin(a)*.28,.25),'wire',(math.sin(a)*40,-math.cos(a)*40,0),v=5,bevel=0)
        for i in range(2): cyl(R.bell,.07,.2,(.0+i*.2-.1,-.3,.5),'metal',(60,0,0),v=8,r2=.04,bevel=0)
    R.head=joint('head',t,(0,-.4,.28)); eyes(R.head,2,.05,-.04,0,.12) if 'eyes' in ex else None
    R.legs=[]
    for i,(sx,y) in enumerate(((-1,-.18),(1,-.18),(-1,.2),(1,.2))):
        hp=joint('lg',h,(sx*.3,y,0)); kn=joint('kn',hp,(sx*.1,0,-.22)); cyl(hp,.05,.24,(sx*.05,0,-.1),'flesh',(0,sx*-24,0),v=7,r2=.035,bevel=0); cyl(kn,.035,.26,(0,0,-.12),'chitin',(0,0,0),v=7,r2=.02,bevel=0); R.legs.append((hp,kn,sx,i))
    R.hipH=hz*s; R.height=1.25*s*spec.get('hmul',1.0); return R
def sac_pose(R,spec,anim,f,n):
    u=f/n; ph=u*math.tau; hip0=R.hipH; w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w)); wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0; b=.5+.5*math.sin(ph)
    k=1.0
    if anim=='idle': k=1+.05*b
    elif anim=='walk': k=1+.04*math.sin(ph*2)
    elif anim=='attack': k=1+.35*wind+.1*r
    elif anim=='hit': k=.88
    elif anim=='death': d=sm(u); k=1+.4*sm(u/.45)-.0 if u<.5 else 1.4-(sm((u-.5)/.5))*1.15
    R.bell.scale=(k,k,k if anim!='death' or u<.5 else max(.18,k))
    for (hp,kn,sx,i) in R.legs:
        g=(i%2==0); p2=ph if g else ph+math.pi
        if anim=='walk': setr(hp,max(0,math.sin(p2))*-28,0,sx*8); setr(kn,max(0,math.sin(p2))*36)
        elif anim=='death': setr(hp,0,0,sx*sm(u)*40)
    if anim=='idle': R.hips.location.z=hip0+math.sin(ph)*.01
    elif anim=='walk': R.hips.location.z=hip0+abs(math.sin(ph))*.1; setr(R.torso,math.sin(ph)*8,0,math.sin(ph)*6)
    elif anim=='attack': R.root.location.y=-.25*r
    elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=rr*.18; setr(R.torso,-rr*10)
    elif anim=='death': d=sm(u); R.hips.location.z=hip0-d*.12

# ------------------------------------------------------------------ doll: stop-motion mannequin stalker
def doll(spec):
    R=Rig(); R.kind='doll'; s=spec.get('scale',1.0); ex=spec.get('extras',()); hz=1.0; R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,hz*s)); R.hips.scale=(s,s,s); h=R.hips
    box(h,(.3,.2,.16),(0,0,0),'white',bevel=.05); R.torso=joint('torso',h,(0,0,.06)); t=R.torso; box(t,(.34,.2,.5),(0,0,.28),'white',bevel=.07); sph(t,.05,(0,0,.02),'metal')
    R.head=joint('head',t,(0,0,.6)); hd=R.head; sph(hd,.17,(0,0,.14),'white',(.9,.95,1.1)); box(hd,(.01,.02,.2),(.0,-.15,.14),'dark',(0,0,0),bevel=0)
    if 'smile' in ex: box(hd,(.18,.02,.012),(0,-.16,.07),'dark',bevel=0)
    if 'eyeholes' in ex:
        for sx in (-1,1): sph(hd,.035,(sx*.06,-.15,.17),'dark'); sph(hd,.014,(sx*.06,-.17,.17),'glow')
    if 'wigwire' in ex:
        for i in range(8): a=i/8*math.tau; cyl(hd,.01,.3,(math.cos(a)*.1,math.sin(a)*.1+.04,.1),'wire',(math.sin(a)*40,-math.cos(a)*40,0),v=4,bevel=0)
    R.arms=[]; alen=spec.get('alen',.55)
    for side,sx in (('L',-1),('R',1)):
        sh=joint('sh'+side,t,(sx*.23,0,.5)); el=joint('el'+side,sh,(0,0,-alen)); sph(sh,.05,(0,0,0),'metal'); seg(sh,alen,.055,.04,'white'); sph(el,.04,(0,0,0),'metal'); seg(el,alen,.04,.03,'white'); 
        for k in range(4): cyl(el,.008,.14,(sx*.03*(k-1.5)*.7,0,-alen-.06),'metal',(0,0,0),v=4,r2=.003,bevel=0)
        setattr(R,'sh'+side,sh); setattr(R,'el'+side,el); R.arms.append((sh,el,sx))
    R.legs=[]
    for side,sx in (('L',-1),('R',1)):
        hp=joint('hp'+side,h,(sx*.1,0,-.04)); kn=joint('kn'+side,hp,(0,0,-.46)); sph(hp,.045,(0,0,0),'metal'); seg(hp,.46,.05,.035,'white'); sph(kn,.04,(0,0,0),'metal'); seg(kn,.46,.035,.025,'white'); box(kn,(.07,.14,.04),(0,-.04,-.48),'white')
        setattr(R,'hp'+side,hp); setattr(R,'kn'+side,kn); R.legs.append((hp,kn,sx))
    R.hipH=hz*s; R.height=1.95*s; return R
def doll_pose(R,spec,anim,f,n):
    u=f/n; qs=math.floor(u*4)/4; ph=qs*math.tau; hip0=R.hipH; w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w)); wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0; s1=math.sin(ph); s2=-s1
    if anim=='idle': setr(R.head,(5 if f%2 else 0),0,(12 if f==2 else -4 if f==0 else 0)); setr(R.shL,2,0,-4); setr(R.shR,-2,0,4)
    elif anim=='walk':
        a=24; setr(R.hpL,s1*a); setr(R.hpR,s2*a); setr(R.knL,max(0,-math.cos(ph))*a*1.2); setr(R.knR,max(0,math.cos(ph))*a*1.2); setr(R.shL,s2*14,0,-6); setr(R.shR,s1*14,0,6); setr(R.head,0,0,s1*10); R.hips.location.z=hip0-abs(s1)*.03; setr(R.torso,6,0,-s1*3)
    elif anim=='attack':
        setr(R.torso,8+r*20-wind*14); setr(R.head,-wind*10+r*30,0,wind*22*(-1)); setr(R.shL,-wind*30-r*100,0,-14); setr(R.shR,-wind*30-r*110,0,14); setr(R.elL,-r*30); setr(R.elR,-r*30); R.root.location.y=-.55*r; setr(R.hpL,r*15); setr(R.hpR,-r*20)
    elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=rr*.2; setr(R.torso,-rr*16); setr(R.head,rr*30,0,rr*20); setr(R.shL,rr*40,0,-rr*20); setr(R.shR,rr*30,0,rr*20)
    elif anim=='death': d=sm(u); setr(R.head,d*50,0,d*40); setr(R.torso,d*80); setr(R.shL,d*50,0,-d*40); setr(R.shR,d*30,0,d*50); R.hips.location.z=hip0-d*(hip0-.2); setr(R.hpL,-d*70); setr(R.hpR,-d*40); setr(R.knL,d*100); setr(R.knR,d*130)

# ------------------------------------------------------------------ many: tentacled chassis / fused corpse pile
def many(spec):
    R=Rig(); R.kind='many'; s=spec.get('scale',1.0); ex=spec.get('extras',()); nl=spec.get('limbs',6); hz=spec.get('hip_z',.7); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,hz*s)); R.hips.scale=(s,s,s); h=R.hips
    R.torso=joint('torso',h,(0,0,0)); t=R.torso; R.head=joint('head',t,(0,-.28,.2)); hd=R.head
    sph(t,.5,(0,0,.1),'flesh',(1,1.1,.9))
    if 'pile' in ex:
        for i,(x,y,z,rr,m) in enumerate(((.3,.2,.3,.3,'cloth'),(-.3,.1,.35,.28,'flesh'),(.0,.35,.5,.3,'main'),(-.1,-.2,.5,.25,'cloth'),(.35,-.15,.1,.24,'flesh'))): sph(t,rr,(x,y,z),m,(1,1.1,.9))
        for i in range(5): box(t,(.5,.07,.07),(0,.1,.2+i*.1),'metal',(0,0,i*30),bevel=.01)
        for sx in (-1,1): box(t,(.34,.3,.3),(sx*.3,-.3,.28),'main',(0,0,sx*20),bevel=.04)
    else:
        box(t,(.7,.5,.14),(0,0,.5),'chitin',bevel=.05); box(t,(.5,.3,.2),(0,-.15,.36),'metal',bevel=.04)
    sph(hd,.2,(0,-.05,0),'flesh' if 'pile' not in ex else 'white',(1,1,.9)); eyes(hd,spec.get('eyes',3),.05,-.22,.06,.1)
    if 'maw' in ex: tor(hd,.12,.03,(0,-.24,-.06),'dark',(90,0,0)); 
    R.limbs=[]
    for i in range(nl):
        a=i/nl*math.tau+.3; x,y=math.cos(a)*.34,math.sin(a)*.34
        js=chain(h,spec.get('lsegs',5),spec.get('L',.34),.1,.025,'flesh' if i%2 else 'wire',(x,y,.02),(math.sin(a)*-80,math.cos(a)*80,0),m2='chitin' if 'chitin' in ex else None,tip=(.04,'metal' if 'claws' in ex else 'glow')); R.limbs.append((js,a))
    R.hipH=hz*s; R.height=1.5*s*spec.get('hmul',1.0); return R
def many_pose(R,spec,anim,f,n):
    u=f/n; ph=u*math.tau; hip0=R.hipH; w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w)); wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0
    for js,a in R.limbs:
        fwd=-math.sin(a)  # limbs on the -Y (front) side reach forward in attack
        for i,j in enumerate(js):
            if i==0: continue
            rip=math.sin(ph-i*.9-a*2); x=0
            if anim=='idle': x=rip*6
            elif anim=='walk': x=rip*24
            elif anim=='attack': x=-(wind*20)-r*50*max(.2,fwd)
            elif anim=='death': x=sm(u)*50
            elif anim=='hit': x=math.sin(u*3.14)*18
            j.rotation_euler=(math.radians(x),0,0)
    if anim=='idle': R.hips.location.z=hip0+math.sin(ph)*.02; setr(R.head,math.sin(ph)*4,0,math.sin(ph*.5)*8)
    elif anim=='walk': R.hips.location.z=hip0+abs(math.sin(ph))*.05; setr(R.torso,0,0,math.sin(ph)*6)
    elif anim=='attack': R.root.location.y=-.5*r; setr(R.torso,-wind*16+r*14); setr(R.head,r*16); R.hips.location.z=hip0-.06*r
    elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=rr*.22; setr(R.torso,-rr*14)
    elif anim=='death': d=sm(u); R.hips.location.z=hip0-d*(hip0-.25); setr(R.torso,d*30,0,d*20)

# ------------------------------------------------------------------ phantom: hologram figure / glitch shards (float + flicker)
def phantom(spec):
    R=Rig(); R.kind='phantom'; s=spec.get('scale',1.0); ex=spec.get('extras',()); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,.75*s)); R.hips.scale=(s,s,s); h=R.hips
    R.torso=joint('torso',h,(0,0,0)); t=R.torso; R.head=joint('head',t,(0,0,.62)); hd=R.head; R.shards=[]
    if 'glitch' in ex:
        import random as _r; rg=_r.Random(spec.get('seed',7))
        for i in range(14):
            j=joint('sd',t,(rg.uniform(-.35,.35),rg.uniform(-.2,.2),rg.uniform(0,.9))); sz=(rg.uniform(.1,.34),rg.uniform(.04,.18),rg.uniform(.06,.28)); box(j,sz,(0,0,0),'holo' if i%3 else 'glow',(rg.uniform(0,40),rg.uniform(0,40),rg.uniform(0,40)),bevel=0); R.shards.append((j,j.location.copy(),rg.random()*6.28))
        box(hd,(.2,.2,.2),(0,0,.1),'dark',(20,30,10),bevel=0); eyes(hd,2,.03,-.12,.1,.1)
    else:
        sph(hd,.17,(0,0,.1),'holo',(.9,.9,1.1)); box(t,(.4,.22,.55),(0,0,.28),'holo',bevel=.06)
        for i in range(6): tor(t,.26-abs(i-2.5)*.02,.008,(0,0,.05+i*.1),'glow',(0,0,0))
        for sx in (-1,1):
            sh=joint('sh',t,(sx*.26,0,.5)); seg(sh,.5,.05,.03,'holo'); sh.rotation_euler=(math.radians(10),0,math.radians(sx*10)); R.shards.append((sh,sh.location.copy(),sx))
        seg(h,.7,.12,.05,'holo',(0,0,-.1)); seg(h,.8,.02,.0,'glow',(0,0,-.65))
        if 'veil' in ex:
            for i in range(5): box(t,(.05,.02,.7),(-.2+i*.1,.14,.1),'holo',(8,0,0),bevel=0)
        eyes(hd,2,.025,-.16,.12,.08)
    R.hipH=.75*s; R.height=1.7*s; return R
def phantom_pose(R,spec,anim,f,n):
    u=f/n; ph=u*math.tau; hip0=R.hipH; w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w)); wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0
    for j,loc,p in R.shards:
        if 'glitch' in spec.get('extras',()):
            q=math.floor(u*8+p)*7.13; amp=.05 if anim=='idle' else .1 if anim=='walk' else .22
            j.location=(loc.x+math.sin(q)*amp,loc.y+math.cos(q*1.7)*amp,loc.z+math.sin(q*2.3)*amp*.7)
            if anim=='death': j.location=(loc.x*(1+sm(u)*2),loc.y*(1+sm(u)*2),loc.z*(1-sm(u)*.8))
        else:
            j.rotation_euler=(math.radians(10+(-r*80 if anim=='attack' else math.sin(ph+p)*6)),0,math.radians(p*(10+(r*20 if anim=='attack' else 0))))
    if anim=='idle': R.hips.location.z=hip0+math.sin(ph)*.06; setr(R.head,math.sin(ph)*4,0,math.sin(ph*.5)*8)
    elif anim=='walk': R.hips.location.z=hip0+math.sin(ph*2)*.05; setr(R.torso,-14,0,math.sin(ph)*4)
    elif anim=='attack': R.root.location.y=-.6*r; setr(R.torso,-wind*20+r*26); R.hips.location.z=hip0+.1*wind
    elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=rr*.25; setr(R.torso,-rr*20,0,rr*10)
    elif anim=='death': d=sm(u); R.hips.location.z=hip0-d*(hip0-.1); setr(R.torso,d*60); R.root.scale=(1,1,max(.1,1-d*.85))

ARCH.update({'arach':arach,'worm':worm,'jelly':jelly,'swarm':swarm,'sac':sac,'doll':doll,'many':many,'phantom':phantom})
POSE3={'arach':arach_pose,'worm':worm_pose,'jelly':jelly_pose,'swarm':swarm_pose,'sac':sac_pose,'doll':doll_pose,'many':many_pose,'phantom':phantom_pose}
_pose_prev=pose
def pose(R,spec,anim,f,n):
    if R.kind in POSE3:
        if not hasattr(R,'_base'): R._base=[(o,tuple(o.rotation_euler),tuple(o.location),tuple(o.scale)) for o in ALL if o.type=='EMPTY']
        for o,r_,l_,s_ in R._base: o.rotation_euler=r_; o.location=l_; o.scale=s_
        POSE3[R.kind](R,spec,anim,f,n); return
    return _pose_prev(R,spec,anim,f,n)

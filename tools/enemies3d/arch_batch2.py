# Batch-2 mob archetypes (exec'd inside build_enemy.py's namespace so it can use box/cyl/sph/tor/joint/MATS/Rig/sm/setr/rx):
#   crawler (6-legged low skitterer), orb (floating core + spinning rings), tread (tracked hull + turret), stilt (tall 2-legged sniper walker),
# plus quad extras (ram / crates / plates) and humanoid extras (shield / satchel). Each has a procedural pose in POSE2.
def crawler(spec):
    R=Rig(); R.kind='crawler'; s=spec.get('scale',1.0); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,.3*s)); R.hips.scale=(s,s,s); h=R.hips
    R.torso=joint('torso',h,(0,0,0)); t=R.torso; sac=spec.get('sac',False)
    sph(t,.3,(0,.0,.1),'main',(1,1.15,.7)); sph(t,.34 if not sac else .46,(0,.5,.16),'accent' if not sac else 'glow',(1,1.25,.9))
    box(t,(.32,.5,.1),(0,.1,.3),'dark',bevel=.03)
    for i in range(4): box(t,(.5-.05*i,.05,.06),(0,.26+i*.14,.46 if not sac else .52),'metal',bevel=.01)
    R.head=joint('head',t,(0,-.42,.12)); hd=R.head; sph(hd,.2,(0,-.04,0),'dark',(1,1,.8)); sph(hd,.05,(.09,-.2,.06),'glow'); sph(hd,.05,(-.09,-.2,.06),'glow')
    R.jaw=joint('jaw',hd,(0,-.16,-.06))
    for sx in (-1,1): cyl(R.jaw,.035,.3,(sx*.07,-.1,0),'metal',(80,0,sx*-25),v=6,r2=.005)
    if 'stinger' in spec.get('extras',()):
        R.tail=joint('tail',t,(0,.82,.3)); cyl(R.tail,.07,.5,(0,.2,.1),'metal',(-60,0,0),v=8,r2=.01); sph(R.tail,.08,(0,.02,0),'glow')
    else: R.tail=joint('tail',t,(0,.8,.2))
    if 'plates' in spec.get('extras',()):
        for i in range(3): box(t,(.7-.08*i,.3,.08),(0,-.05+i*.3,.38+.02*i),'metal',bevel=.02)
    if 'lamp' in spec.get('extras',()): cyl(hd,.02,.4,(0,.0,.28),'metal',v=6); sph(hd,.07,(0,0,.5),'glow')
    R.legs=[]
    for i,y in enumerate((-.25,.05,.35)):
        for sx in (-1,1):
            nm=f'{"L" if sx<0 else "R"}{i}'; hp=joint('cx'+nm,h,(sx*.28,y,.04)); kn=joint('kx'+nm,hp,(sx*.34,0,.12))
            box(hp,(.36,.07,.07),(sx*.17,0,.06),'metal',(0,0,0),bevel=.015); box(kn,(.07,.07,.46),(sx*.06,0,-.2),'dark',(0,sx*-12,0),bevel=.015); box(kn,(.1,.1,.05),(sx*.09,0,-.45),'metal')
            R.legs.append((hp,kn,sx,i))
    R.hipH=.3*s; R.height=1.0*s; return R
def orb(spec):
    R=Rig(); R.kind='orb'; s=spec.get('scale',1.0); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,1.0*s)); R.hips.scale=(s,s,s); h=R.hips
    R.torso=joint('torso',h,(0,0,0)); t=R.torso; ex=spec.get('extras',())
    sph(t,.3,(0,0,0),'white'); sph(t,.2,(0,-.16,.02),'dark',(1,.7,1)); sph(t,.1,(0,-.27,.03),'glow')
    R.rings=[]
    for i,(rr,tilt) in enumerate(((.46,0),(.58,60))):
        j=joint('ring'+str(i),t,(0,0,0)); tor(j,rr,.035+.01*i,(0,0,0),'glow' if i==0 else 'metal',(tilt,0,0)); R.rings.append(j)
    R.head=t
    for sx in (-1,1): box(t,(.08,.2,.12),(sx*.28,.05,.0),'accent',bevel=.02); cyl(t,.015,.3,(sx*.3,.1,.2),'metal',v=5)
    R.tail=joint('tail',t,(0,.3,-.1))
    for k in range(3): cyl(R.tail,.03-.007*k,.28,(0,.1+.18*k,-.12*k),'metal' if k%2 else 'dark',(-70-k*10,0,0),v=6)
    if 'cross' in ex: box(t,(.34,.05,.1),(0,-.3,.22),'glow'); box(t,(.1,.05,.34),(0,-.3,.22),'glow')
    if 'spikes' in ex:
        for i in range(8): a=i/8*math.tau; cyl(t,.04,.3,(math.cos(a)*.36,math.sin(a)*.36,.0),'metal',(0,0,0) if False else (90*math.sin(a)*1,90*math.cos(a)*-1,0),v=5,r2=.005)
    if 'bloom' in ex:
        for i in range(6): a=i/6*math.tau; box(t,(.22,.04,.4),(math.cos(a)*.38,math.sin(a)*.38,-.05),'accent',(0,0,math.degrees(a)+90),bevel=.01)
    if 'eye' in ex: sph(t,.17,(0,-.2,.0),'white',(1,.6,1)); sph(t,.09,(0,-.3,.0),'glow')
    if 'prongs' in ex:
        for sx in (-1,1): cyl(t,.04,.5,(sx*.22,-.3,.2),'metal',(90,0,sx*-18),v=6,r2=.01); sph(t,.05,(sx*.28,-.56,.2),'glow')
    if 'halo' in ex: tor(t,.4,.03,(0,0,.5),'glow')
    R.hipH=1.0*s; R.height=1.6*s; return R
def tread(spec):
    R=Rig(); R.kind='tread'; s=spec.get('scale',1.0); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,.32*s)); R.hips.scale=(s,s,s); h=R.hips; ex=spec.get('extras',())
    R.torso=joint('torso',h,(0,0,0)); t=R.torso
    box(t,(.9,1.3,.38),(0,0,.28),'main',bevel=.06); box(t,(.86,.5,.3),(0,-.5,.34),'accent',(-12,0,0),bevel=.05)
    R.wheels=[]
    for sx in (-1,1):
        box(h,(.26,1.5,.3),(sx*.58,0,0),'dark',bevel=.07)
        for y in (-.55,0,.55):
            w=joint('tw',h,(sx*.58,y,0)); R.wheels.append(w); cyl(w,.18,.3,(0,0,0),'metal',(0,90,0),v=14); cyl(w,.08,.32,(0,0,0),'accent',(0,90,0),v=8)
    R.tur=joint('tur',t,(0,.1,.5)); u=R.tur; cyl(u,.38,.22,(0,0,.1),'dark',v=20); box(u,(.56,.6,.26),(0,0,.28),'main',bevel=.05)
    R.gun=joint('gun',u,(0,-.28,.3))
    if 'mortar' in ex: cyl(R.gun,.13,.8,(0,-.2,.15),'metal',(60,0,0),v=14); cyl(R.gun,.16,.14,(0,-.5,.4),'dark',(60,0,0),v=14)
    elif 'carrier' in ex:
        for k in range(4): box(u,(.22,.22,.14),((k%2-.5)*.3,.1+(k//2)*.28,.5),'white',bevel=.02); sph(u,.05,((k%2-.5)*.3,-.01+(k//2)*.28,.6),'glow')
        cyl(R.gun,.04,.5,(0,-.2,.0),'metal',(90,0,0),v=8)
    elif 'dish' in ex: cyl(u,.03,.4,(0,.1,.5),'metal',v=6); cyl(u,.36,.06,(0,.18,.82),'white',(60,0,0),v=22,r2=.08); sph(u,.06,(0,.3,.9),'glow'); cyl(R.gun,.05,.5,(0,-.2,0),'metal',(90,0,0),v=8)
    else:
        for sx in (-1,1): cyl(R.gun,.045,.6,(sx*.1,-.3,.0),'metal',(90,0,0),v=8)
    if 'plow' in ex: box(t,(1.3,.14,.55),(0,-.74,.3),'accent',(-10,0,0),bevel=.04); box(t,(.9,.1,.34),(0,-.8,.34),'metal',bevel=.03)
    if 'shieldfront' in ex: box(t,(1.2,.12,.9),(0,-.82,.62),'metal',bevel=.05); box(t,(.8,.14,.3),(0,-.86,.8),'glow')
    if 'beacon' in ex: cyl(t,.03,.6,(.3,.4,.95),'metal',v=6); sph(t,.08,(.3,.4,1.28),'glow')
    R.head=t; R.hipH=.32*s; R.height=1.2*s; return R
def stilt(spec):
    R=Rig(); R.kind='stilt'; s=spec.get('scale',1.0); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,1.45*s)); R.hips.scale=(s,s,s); h=R.hips; ex=spec.get('extras',())
    R.torso=joint('torso',h,(0,0,0)); t=R.torso
    box(t,(.5,.7,.42),(0,0,.1),'main',bevel=.06); box(t,(.54,.3,.28),(0,-.3,.14),'accent',bevel=.04); box(t,(.4,.3,.3),(0,.4,.1),'dark',bevel=.04)
    R.head=joint('head',t,(0,-.28,.34)); hd=R.head; sph(hd,.17,(0,0,.04),'dark',(1,1.1,.9)); sph(hd,.06,(0,-.16,.04),'glow'); 
    if 'scope' in ex: cyl(hd,.05,.34,(.14,-.18,.12),'metal',(90,0,0),v=10); sph(hd,.045,(.14,-.37,.12),'glow')
    R.gun=joint('gun',t,(.12,-.3,.02)); g=R.gun; cyl(g,.05,1.7,(0,-.85,0),'metal',(90,0,0),v=10); box(g,(.12,.5,.16),(0,-.1,-.04),'dark',bevel=.03); cyl(g,.07,.2,(0,-1.7,0),'accent',(90,0,0),v=10)
    if 'cape' in ex: box(t,(.6,.05,1.0),(0,.4,-.25),'cloth',(10,0,0))
    for i in range(3): cyl(t,.03,.4,(-.2+i*.1,.5,.4),'metal',(-30,0,0),v=5)
    for side,sx in (('L',-1),('R',1)):
        hp=joint('hp'+side,h,(sx*.22,0,-.14)); kn=joint('kn'+side,hp,(0,0,-.72)); ft=joint('ft'+side,kn,(0,0,-.72)); setattr(R,'hp'+side,hp); setattr(R,'kn'+side,kn)
        box(hp,(.09,.1,.76),(0,0,-.36),'metal',bevel=.02); box(kn,(.08,.09,.76),(0,0,-.36),'dark',bevel=.02); sph(kn,.07,(0,0,0),'accent'); box(ft,(.2,.36,.07),(0,-.1,.03),'dark',bevel=.02)
    R.hipH=1.45*s; R.height=2.1*s; return R
def quad2(spec):
    R=quad(spec); ex=spec.get('extras',()); t=R.torso; hd=R.head
    if 'ram' in ex:
        box(hd,(.5,.22,.46),(0,-.26,.0),'metal',bevel=.05)
        for sx in (-1,1): cyl(hd,.07,.5,(sx*.2,-.3,.12),'accent',(70,0,sx*-25),v=8,r2=.01)
        box(t,(.62,.3,.5),(0,-.38,.15),'accent',bevel=.06)
    if 'plates' in ex:
        for i in range(3): box(t,(.62,.26,.07),(0,-.12+i*.3,.4),'metal',bevel=.02)
    if 'crates' in ex:
        for k,(x,y,z) in enumerate(((-.1,.1,.52),(.14,.38,.5),(0,-.05,.84))): box(t,(.34,.32,.3),(x,y,z),'main' if k%2 else 'accent',(0,0,k*11),bevel=.02)
        sph(t,.06,(0,.5,.7),'glow')
    if 'coat' in ex:
        for i in range(6): cyl(t,.025,.22,(-.2+.08*i,.1,.46),'glow',(0,0,0),v=5)
    return R
_orig_extras=extras
def extras(R,spec):
    _orig_extras(R,spec); t=R.torso; hd=R.head; br=R.kind=='bruiser'; by=.3 if br else .22; tw=.8 if br else .62; th=.78 if br else .62
    for e in spec.get('extras',()):
        if e=='shield': box(R.handL,(.1,.12,.12),(0,-.1,0),'metal'); box(R.handL,(.1,.66,.9),(0,-.26,-.18),'metal',bevel=.04); box(R.handL,(.12,.5,.6),(0,-.34,-.1),'accent',bevel=.03); box(R.handL,(.13,.3,.1),(0,-.37,.16),'glow')
        elif e=='satchel': box(t,(.5,.3,.4),(.2,by+.2,th*.4),'accent',bevel=.04); box(t,(.4,.04,.12),(.2,by+.37,th*.5),'glow')
        elif e=='lantern': cyl(R.handL,.02,.4,(0,-.15,.1),'metal',(90,0,0),v=6); sph(R.handL,.1,(0,-.4,.1),'glow')
        elif e=='hood': box(hd,(.5,.4,.3),(0,.05,.32),'cloth',(10,0,0),bevel=.05)
        elif e=='syringes':
            for k in range(3): cyl(t,.03,.4,(-.16+k*.16,-by-.04,th*.3),'white',(90,0,0),v=6,r2=.01)
ARCH.update({'crawler':crawler,'orb':orb,'tread':tread,'stilt':stilt,'quad':quad2})
def k_is(R,k): return R.kind==k
def pose2(R,spec,anim,f,n):
    for o in ALL:
        if o.type=='EMPTY': o.scale=(1,1,1) if not o.name=='hips' else o.scale
    if k_is(R,'tread'): R.gun.location=(0,-.28,.3)
    k=R.kind; u=f/n; ph=u*math.tau; hip0=R.hipH; s1=math.sin(ph); s2=math.sin(ph+math.pi)
    w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w)); wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0
    if k=='crawler':
        for (hp,kn,sx,i) in R.legs:
            g=(i%2==0)!=(sx<0); ss=s1 if g else s2
            if anim=='walk': setr(hp,0,0,ss*sx*-22); setr(kn,max(0,ss)*-34*sx*0+max(0,ss)*28*1,0,0)
            elif anim=='idle': setr(hp,0,0,s1*sx*3); setr(kn,s1*2)
            elif anim=='attack': setr(hp,0,0,sx*(-10-r*15)); setr(kn,-r*22 if i==0 else r*14)
            elif anim=='hit': setr(hp,0,0,sx*r*18); 
            elif anim=='death': d=sm(u); setr(hp,0,0,sx*d*38); setr(kn,0,0,sx*d*48)
        if anim=='idle': R.hips.location.z=hip0+s1*.01; setr(R.head,s1*3,0,math.sin(ph*.5)*6); setr(R.jaw,4+s1*3)
        elif anim=='walk': R.hips.location.z=hip0-abs(s1)*.03; setr(R.torso,math.sin(ph*2)*2,0,s1*4); setr(R.head,0,0,-s1*4); setr(R.jaw,6)
        elif anim=='attack': R.root.location.y=-.55*r; setr(R.torso,-wind*20+r*12); setr(R.head,r*14); setr(R.jaw,wind*10+(60*r if r>.5 else 0)); setr(R.tail,r*40,0,0)
        elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=rr*.22; setr(R.torso,-rr*16); setr(R.jaw,rr*30)
        elif anim=='death': d=sm(u); R.hips.location.z=hip0-d*.2; R.root.rotation_euler=(0,math.radians(d*170),0); setr(R.jaw,d*50)
        return
    if k=='orb':
        if anim=='idle': R.hips.location.z=hip0+s1*.07; setr(R.rings[0],0,0,u*360); setr(R.rings[1],0,u*360,0); setr(R.tail,s1*6,0,s2*8)
        elif anim=='walk': R.hips.location.z=hip0+s1*.06; setr(R.torso,-10); setr(R.rings[0],0,0,u*720); setr(R.rings[1],0,u*720,0); setr(R.tail,s1*14,0,s2*10)
        elif anim=='attack':
            R.root.location.y=-.35*r; R.hips.location.z=hip0+.12*wind-.04*r; setr(R.rings[0],0,0,u*1080); setr(R.rings[1],0,u*1080,0); R.rings[0].scale=(1+r*.5,1+r*.5,1+r*.5); R.rings[1].scale=(1+r*.35,1+r*.35,1+r*.35); setr(R.torso,-wind*12+r*14)
        elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=rr*.22; setr(R.torso,-rr*18,0,rr*10); setr(R.rings[0],0,0,rr*40)
        elif anim=='death': d=sm(u); R.hips.location.z=hip0-d*(hip0-.3); setr(R.torso,d*60,0,d*40); setr(R.rings[0],0,0,d*200); setr(R.rings[1],0,d*160,0); R.rings[0].scale=(1-d*.5,)*3 if False else (1-d*.4,1-d*.4,1-d*.4)
        return
    if k=='tread':
        if anim=='idle': R.hips.location.z=hip0+s1*.006; setr(R.tur,0,0,s1*6); setr(R.gun,s1*1.5)
        elif anim=='walk':
            for wh in R.wheels: setr(wh,-u*360*2)
            R.hips.location.z=hip0+abs(s1)*.015; setr(R.torso,s1*.8,0,s1*1.2); setr(R.tur,0,0,s1*3)
        elif anim=='attack': R.root.location.y=.06*r*-1; setr(R.tur,0,0,-wind*10+r*8); setr(R.gun,-r*6+wind*8); R.gun.location.y=-.28+r*.2*(1 if u>.35 else 0)+wind*.0; R.torso.location.y=r*.1
        elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=rr*.15; setr(R.torso,-rr*7,0,rr*4); setr(R.tur,0,0,rr*12)
        elif anim=='death': d=sm(u); R.hips.location.z=hip0-d*.1; R.root.rotation_euler=(math.radians(d*14),math.radians(d*38),0); setr(R.tur,0,0,d*50); setr(R.gun,d*-25)
        return
    if k=='stilt':
        a=30
        if anim=='idle': R.hips.location.z=hip0+s1*.02; setr(R.head,0,0,math.sin(ph*.5)*14); setr(R.gun,s1*1.5); setr(R.hpL,-3); setr(R.hpR,3)
        elif anim=='walk':
            R.hips.location.z=hip0-abs(s1)*.07; setr(R.hpL,s1*a); setr(R.hpR,s2*a); setr(R.knL,max(0,-math.cos(ph))*a*1.5+6); setr(R.knR,max(0,math.cos(ph))*a*1.5+6); setr(R.torso,5,0,-s1*4); setr(R.head,0,0,s1*6)
        elif anim=='attack':
            kick=max(0,1-abs(u-.42)*6); setr(R.torso,-wind*6-kick*8); R.root.location.y=kick*.2; setr(R.gun,-wind*3+kick*10); setr(R.head,0,0,0); R.hips.location.z=hip0-.18*wind*0
            setr(R.hpL,-r*12); setr(R.hpR,r*10); setr(R.knL,r*16+6); setr(R.knR,r*20+6)
        elif anim=='hit': rr=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=rr*.2; setr(R.torso,-rr*14,0,rr*6); setr(R.head,rr*14); setr(R.knL,rr*14); setr(R.knR,rr*14)
        elif anim=='death':
            d=sm(u); d2=sm((u-.3)/.7); R.hips.location.z=hip0-d*(hip0-.35); setr(R.hpL,-d*80); setr(R.hpR,-d*70); setr(R.knL,d*140); setr(R.knR,d*130); setr(R.torso,d2*65,0,d2*12); setr(R.head,d2*22)
        return
POSE2=True

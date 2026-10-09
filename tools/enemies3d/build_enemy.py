# Blender (bpy) enemy/boss sprite renderer: reusable archetypes (humanoid, bruiser, turret, hover) + per-enemy specs -> 8-direction animated frames.
# Run: /workspace/bv/bin/python build_enemy.py OUTDIR  [env: IDS=worker,sawhand  ANIMS=idle,walk  DIRS=S,SE  FRAMES=0,2  RES=320  SAMPLES=24  TEST=1]
# Models face -Y at rest (toward the camera = screen "S"), same camera / lights / direction convention as tools/sprites/build_char.py.
import bpy, math, sys, os, json, time
from mathutils import Vector
OUT=sys.argv[1]; RES=int(os.environ.get('RES','320')); SAMPLES=int(os.environ.get('SAMPLES','24'))
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from specs import SPECS, ANIM_SPEC
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
def rgb(h,k=1.0): return tuple((int(h[i:i+2],16)/255)**2.2*k for i in (1,3,5))+(1,)
# ---------------- materials: stamped panels (brick seams), noise grit, edge wear ----------------
def mat(name,col,metal=.35,rough=.6,panel=True,scale=5.0,wear='#c9c5b4',emit=None,bump=.5):
    m=bpy.data.materials.new(name); m.use_nodes=True; N=m.node_tree.nodes; L=m.node_tree.links; b=N['Principled BSDF']
    tc=N.new('ShaderNodeTexCoord'); mp=N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value=(scale,scale,scale); L.new(tc.outputs['Object'],mp.inputs['Vector'])
    nz=N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value=9; nz.inputs['Detail'].default_value=8; L.new(mp.outputs[0],nz.inputs['Vector'])
    nz2=N.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value=1.6; nz2.inputs['Detail'].default_value=3; L.new(tc.outputs['Object'],nz2.inputs['Vector'])
    base=N.new('ShaderNodeRGB'); base.outputs[0].default_value=col
    def mix(a,bb,fac,bl='MIX'):
        n=N.new('ShaderNodeMixRGB'); n.blend_type=bl
        if isinstance(fac,float): n.inputs[0].default_value=fac
        else: L.new(fac,n.inputs[0])
        L.new(a,n.inputs[1]); 
        if isinstance(bb,tuple): n.inputs[2].default_value=bb
        else: L.new(bb,n.inputs[2])
        return n.outputs[0]
    c=mix(base.outputs[0],(col[0]*.45,col[1]*.45,col[2]*.45,1),nz2.outputs['Fac'],'MIX')           # large-scale dirt variation
    c=mix(c,(.02,.018,.015,1),nz.outputs['Fac'],'MULTIPLY') if False else c
    grit=N.new('ShaderNodeMath'); grit.operation='MULTIPLY'; grit.inputs[1].default_value=.42; L.new(nz.outputs['Fac'],grit.inputs[0])
    c=mix(c,(.03,.028,.024,1),grit.outputs[0])                                                    # fine grime
    hgt=nz.outputs['Fac']
    if panel:
        br=N.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value=.55; br.inputs['Mortar Size'].default_value=.03; br.inputs['Mortar Smooth'].default_value=.3; br.inputs['Brick Width'].default_value=.9; br.inputs['Row Height'].default_value=.55; br.inputs['Color1'].default_value=(1,1,1,1); br.inputs['Color2'].default_value=(.92,.92,.92,1); br.inputs['Mortar'].default_value=(.1,.1,.1,1)
        L.new(mp.outputs[0],br.inputs['Vector']); c=mix(c,(0,0,0,1),br.outputs['Fac'],'MULTIPLY') if False else mix(c,(0,0,0,1),br.outputs['Fac'],'MULTIPLY')
        hm=N.new('ShaderNodeMath'); hm.operation='ADD'; L.new(nz.outputs['Fac'],hm.inputs[0]); L.new(br.outputs['Fac'],hm.inputs[1]); hgt=hm.outputs[0]
    bv=N.new('ShaderNodeBevel'); bv.inputs['Radius'].default_value=.012; bv.samples=3; gn=N.new('ShaderNodeNewGeometry'); dt=N.new('ShaderNodeVectorMath'); dt.operation='DOT_PRODUCT'; L.new(bv.outputs[0],dt.inputs[0]); L.new(gn.outputs['Normal'],dt.inputs[1])
    mr=N.new('ShaderNodeMapRange'); mr.inputs[1].default_value=.995; mr.inputs[2].default_value=.9; mr.clamp=True; L.new(dt.outputs['Value'],mr.inputs[0])
    wm=N.new('ShaderNodeMath'); wm.operation='MULTIPLY'; wm.inputs[1].default_value=.6; L.new(mr.outputs[0],wm.inputs[0]); c=mix(c,rgb(wear),wm.outputs[0])
    ao=N.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value=.12; ao.samples=3; c=mix(c,ao.outputs['Color'],.5,'MULTIPLY')
    L.new(c,b.inputs['Base Color']); b.inputs['Metallic'].default_value=metal; b.inputs['Roughness'].default_value=rough
    bn=N.new('ShaderNodeBump'); bn.inputs['Strength'].default_value=bump; bn.inputs['Distance'].default_value=.01; L.new(hgt,bn.inputs['Height']); L.new(bn.outputs['Normal'],b.inputs['Normal'])
    if emit: b.inputs['Emission Color'].default_value=rgb(emit); b.inputs['Emission Strength'].default_value=3.0
    return m
MATS={}
def palette(p):
    MATS.clear()
    MATS['main']=mat('main',rgb(p['main']),metal=.3,rough=.55); MATS['dark']=mat('dark',rgb(p['dark']),metal=.5,rough=.5,panel=False)
    MATS['accent']=mat('accent',rgb(p['accent']),metal=.35,rough=.6); MATS['metal']=mat('metal',rgb(p.get('metal','#6d6f70')),metal=.85,rough=.4,panel=False,wear='#d0d0cc')
    MATS['cloth']=mat('cloth',rgb(p.get('cloth',p['dark'])),metal=0,rough=.95,panel=False,bump=.9); MATS['skin']=mat('skin',rgb('#6d5646'),metal=0,rough=.8,panel=False,bump=.2)
    MATS['glow']=mat('glow',rgb(p.get('glow','#c8402a')),metal=0,rough=.5,panel=False,emit=p.get('glow','#c8402a')); MATS['white']=mat('white',rgb(p.get('white','#c9c7bd')),metal=.25,rough=.55)
# ---------------- primitives ----------------
ALL=[]
def joint(name,parent=None,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); sc.collection.objects.link(o); o.empty_display_size=.05
    if parent: o.parent=parent
    o.location=loc; ALL.append(o); return o
def _fin(o,m,parent,loc,rot,bevel,sub=0):
    o.location=loc; o.rotation_euler=[math.radians(r) for r in rot]; o.parent=parent; o.data.materials.append(MATS[m]) if hasattr(o.data,'materials') else None
    if bevel: md=o.modifiers.new('b','BEVEL'); md.width=bevel; md.segments=2; md.limit_method='ANGLE'
    if sub: o.modifiers.new('s','SUBSURF').levels=sub
    for p in o.data.polygons: p.use_smooth=bool(sub)
    ALL.append(o); return o
def box(parent,size,loc,m='main',rot=(0,0,0),bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1); o=bpy.context.object; o.scale=size; bpy.ops.object.transform_apply(scale=True); return _fin(o,m,parent,loc,rot,bevel)
def cyl(parent,r,h,loc,m='main',rot=(0,0,0),v=20,r2=None,bevel=.01):
    bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=r,radius2=r if r2 is None else r2,depth=h); o=bpy.context.object; return _fin(o,m,parent,loc,rot,bevel)
def sph(parent,r,loc,m='main',scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r,segments=24,ring_count=14); o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(scale=True); return _fin(o,m,parent,loc,(0,0,0),0,0)
for_smooth=None
# ---------------- weapons (mounted on a hand joint; rest pose points the weapon along -Y) ----------------
def weapon(kind,j,s):
    if kind=='drill':   # jackhammer
        box(j,(.16,.5,.2),(0,-.18,0),'dark'); cyl(j,.05,.5,(0,-.62,0),'metal',(90,0,0),v=10,r2=.015); box(j,(.08,.08,.34),(0,-.12,.2),'metal'); cyl(j,.035,.36,(0,.1,.3),'dark',(90,0,0),v=8)
    elif kind=='rifle':
        box(j,(.1,.62,.12),(0,-.3,0),'dark'); box(j,(.08,.3,.2),(0,-.08,-.12),'metal'); cyl(j,.025,.4,(0,-.75,.02),'metal',(90,0,0),v=8); box(j,(.09,.2,.1),(0,-.38,.1),'main')
    elif kind=='saw':   # big circular saw on the forearm, disc in the arm plane
        cyl(j,.11,.22,(0,-.1,0),'dark',(0,90,0),v=14); d=cyl(j,.62,.07,(.0,-.38,0),'metal',(0,90,0),v=40,bevel=.006)
        for i in range(18):
            a=i/18*math.tau; box(d.parent,(.07,.1,.1),(0,-.38+math.sin(a)*.66,math.cos(a)*.66),'metal',(math.degrees(a)+45,0,0),bevel=.004)
        cyl(j,.14,.13,(0,-.38,0),'accent',(0,90,0),v=14)
    elif kind=='claws':
        for i,(x,rz) in enumerate(((-.14,-12),(0,0),(.14,12))):
            box(j,(.06,.5,.07),(x,-.3,0),'metal',(0,0,rz),bevel=.012); box(j,(.05,.3,.06),(x*1.5,-.65,-.08),'metal',(35,0,rz*1.5),bevel=.01)
        box(j,(.4,.16,.2),(0,-.04,0),'dark')
    elif kind=='slab':  # huge armoured fist/shield block
        box(j,(.5,.55,.7),(0,-.25,0),'main',bevel=.05); box(j,(.4,.1,.6),(0,-.55,0),'dark'); box(j,(.5,.1,.1),(0,-.3,.4),'accent')
    elif kind=='scythe':
        cyl(j,.05,.3,(0,-.1,0),'dark',(90,0,0),v=8)
        for i in range(9):
            t=i/8; a=math.radians(-20+t*130); r=.95; box(j,(.07-.04*t,.2,.05),(0,-.15-math.sin(a)*r*.7,-.15+(1-math.cos(a))*.05+t*.1-.55*(1-math.cos(a))),'metal',(math.degrees(a)*.9,0,0),bevel=.006)
        box(j,(.16,.2,.5),(0,-.25,.1),'dark')
    elif kind=='fist':
        box(j,(.2,.24,.2),(0,-.1,0),'dark',bevel=.03)
    elif kind=='ladle':   # long-handled slag ladle / bowl
        cyl(j,.04,1.1,(0,-.5,0),'metal',(90,0,0),v=8); sph(j,.24,(0,-1.1,-.05),'dark',(1,1,.7)); sph(j,.16,(0,-1.1,.0),'glow',(1,1,.3))
    elif kind=='baton':
        cyl(j,.04,.7,(0,-.3,0),'dark',(90,0,0),v=8); cyl(j,.055,.12,(0,-.68,0),'glow',(90,0,0),v=8)
    elif kind=='scalpel':
        box(j,(.05,.3,.07),(0,-.1,0),'dark'); box(j,(.012,.62,.1),(0,-.6,0),'metal',bevel=.003); box(j,(.012,.2,.06),(0,-.98,-.02),'metal',(0,0,0),bevel=.003)
    elif kind=='none': pass
# ---------------- archetypes ----------------
class Rig: pass
def humanoid(spec,bruiser=False):
    s=spec.get('scale',1.0); R=Rig(); R.s=s; R.kind='bruiser' if bruiser else 'humanoid'; k=1.25 if bruiser else 1.0
    legL,legT,armT,torW,torD,torH,hipH=(.22*k,.9,.2*k,.62*k+(.18 if bruiser else 0),.36*k+(.1 if bruiser else 0),.62*k,.88*(.82 if bruiser else 1))
    R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,hipH*s)); R.hips.scale=(s,s,s)
    h=R.hips; bruise=1 if bruiser else 0
    box(h,(torW*.7,torD*.8,.2),(0,0,0),'dark',bevel=.03)                                                    # pelvis
    R.torso=joint('torso',h,(0,0,.08)); t=R.torso
    box(t,(torW,torD,torH),(0,0,torH/2+.04),'main',bevel=.05); box(t,(torW*1.02,torD*.4,torH*.5),(0,-torD*.5,torH*.55),'accent' if spec.get('chest_accent',True) else 'main',bevel=.03)
    box(t,(torW*.9,.08,torH*.6),(0,torD*.52,torH*.55),'dark'); box(t,(torW*1.0,torD*.9,.1),(0,0,.12),'dark',bevel=.03)
    if spec.get('pack'): box(t,(torW*.7,.22,torH*.8),(0,torD*.5+.1,torH*.55),'dark',bevel=.04); cyl(t,.05,.5,(torW*.28,torD*.5+.14,torH+.2),'metal',(0,0,0),v=8)
    for sx in (-1,1): box(t,(torW*.5,torD*.9,.16),(sx*torW*.52,0,torH+.02),'main',bevel=.05)                  # pauldrons
    if bruiser:
        for sx in (-1,1): box(t,(.34,torD*1.1,.34),(sx*(torW*.52+.06),0,torH+.06),'accent',bevel=.07)
    R.head=joint('head',t,(0,-.02 if not bruiser else -.12,torH+.1)); hd=R.head
    hs=.25*(1 if not bruiser else .9)
    if spec.get('head','helmet')=='dome':   # warden etc handled elsewhere
        sph(hd,hs,(0,0,hs),'white',(1,1,1.1))
    else:
        sph(hd,hs,(0,0,hs),'main',(1,1.05,1)); box(hd,(hs*1.5,.1,hs*.55),(0,-hs*.85,hs*1.0),'dark',bevel=.03)     # helmet + visor
        if spec.get('nvg'): cyl(hd,.05,.14,(hs*.5,-hs*1.0,hs*1.5),'dark',(90,0,0),v=10); cyl(hd,.05,.14,(-hs*.5,-hs*1.0,hs*1.5),'dark',(90,0,0),v=10)
        if spec.get('antenna'): cyl(hd,.012,.55,(hs*.7,hs*.2,hs*2.0),'metal',v=6)
    # arms: shoulder -> elbow -> hand
    aw=armT*(1.5 if bruiser else 1.15); al=(.46 if not bruiser else .5)
    for side,sx in (('L',-1),('R',1)):
        sh=joint('sh'+side,t,(sx*(torW*.5+(.1 if bruiser else .06)),0,torH-.02)); el=joint('el'+side,sh,(0,0,-al)); hn=joint('hand'+side,el,(0,0,-al))
        setattr(R,'sh'+side,sh); setattr(R,'el'+side,el); setattr(R,'hand'+side,hn)
        box(sh,(aw,aw,al*1.05),(0,0,-al/2),'main' if not bruiser else 'main',bevel=.04); box(el,(aw*.92,aw*.92,al*1.05),(0,0,-al/2),'dark' if not bruiser else 'main',bevel=.04)
        if bruiser: box(el,(aw*1.05,aw*1.05,.12),(0,0,-.02),'accent',bevel=.03)
        box(hn,(aw*.9,aw*.9,.14),(0,0,-.04),'dark',bevel=.03)
        wk=spec.get('weapon_'+side)
        if wk: weapon(wk,hn,s)
    # legs: hip -> knee -> foot
    ll=.46*(.9 if bruiser else 1); lw=.24*(1.55 if bruiser else 1.1)
    for side,sx in (('L',-1),('R',1)):
        hp=joint('hp'+side,h,(sx*torW*.26,0,-.06)); kn=joint('kn'+side,hp,(0,0,-ll)); ft=joint('ft'+side,kn,(0,0,-ll))
        setattr(R,'hp'+side,hp); setattr(R,'kn'+side,kn); setattr(R,'ft'+side,ft)
        box(hp,(lw,lw*1.05,ll*1.05),(0,0,-ll/2),'main' if bruiser else 'cloth',bevel=.04); box(kn,(lw*.9,lw,ll*1.05),(0,.0,-ll/2),'main' if bruiser else 'cloth',bevel=.04)
        box(kn,(lw*1.1,lw*1.1,.14),(0,-.03,0),'dark',bevel=.04); box(ft,(lw*1.1,lw*1.9,.14),(0,-lw*.4,.04),'dark',bevel=.04)
    R.hipH=hipH*s; R.leg=ll*2; R.height=(hipH+.08+torH+.1+hs*2)*s
    return R
def turret(spec):
    R=Rig(); R.kind='turret'; s=spec.get('scale',1.0); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,0)); R.hips.scale=(s,s,s); h=R.hips
    for i,(w,hh) in enumerate(((1.7,.18),(1.45,.16),(1.15,.2))): box(h,(w,w,hh),(0,0,.09+sum(x[1] for x in ((1.7,.18),(1.45,.16))[:i])+hh/2-.09),'dark' if i%2==0 else 'main',bevel=.04)
    for sx in (-1,1):
        for sy in (-1,1): box(h,(.28,.28,.3),(sx*.8,sy*.8,.15),'metal',bevel=.04)
    R.torso=joint('torso',h,(0,0,.55)); t=R.torso; box(t,(.95,.9,.5),(0,0,.25),'main',bevel=.06); box(t,(.8,.2,.34),(0,-.46,.3),'accent',bevel=.04); box(t,(.5,.5,.18),(0,.1,.55),'dark',bevel=.04)
    R.head=R.torso; R.gun=joint('gun',t,(0,-.45,.3)); g=R.gun
    for i in range(3):
        a=i/3*math.tau; cyl(g,.05,.8,(math.cos(a)*.08,-.4,math.sin(a)*.08),'metal',(90,0,0),v=10)
    cyl(g,.15,.2,(0,-.05,0),'dark',(90,0,0),v=14); cyl(g,.12,.12,(0,-.8,0),'accent',(90,0,0),v=14)
    cyl(t,.025,.7,(.35,.2,.8),'metal',v=6); R.height=1.3*s; return R
def hover(spec):
    R=Rig(); R.kind='hover'; s=spec.get('scale',1.0); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,1.0*s)); R.hips.scale=(s,s,s); h=R.hips
    R.torso=joint('torso',h,(0,0,0)); t=R.torso
    box(t,(.7,.4,.75),(0,0,.1),'white',bevel=.08); box(t,(.76,.44,.3),(0,0,.45),'accent',bevel=.06); box(t,(.5,.3,.5),(0,.3,.2),'dark',bevel=.05); box(t,(.5,.06,.5),(0,-.22,.1),'main',bevel=.02)
    R.head=joint('head',t,(0,-.02,.62)); hd=R.head; sph(hd,.2,(0,0,.12),'white',(1,1.1,1.15)); box(hd,(.26,.1,.1),(0,-.18,.14),'dark',bevel=.03); cyl(hd,.012,.7,(0,.05,.55),'metal',v=6); sph(hd,.03,(0,.05,.9),'glow')
    R.rotors=[]
    for i,(x,y) in enumerate(((-1,-.55),(1,-.55),(-1,.5),(1,.5))):
        arm=joint(f'rot{i}',t,(x*.52,y*.4,.45)); box(arm,(.52,.07,.07),(x*.26,0,0),'metal',bevel=.01); d=cyl(arm,.3,.04,(x*.55,0,0),'white',v=28,bevel=.006); cyl(arm,.07,.07,(x*.55,0,.04),'accent',v=10); box(arm,(.48,.05,.04),(x*.55,0,.05),'dark',bevel=.004); R.rotors.append(arm)
    for side,sx in (('L',-1),('R',1)):
        sh=joint('sh'+side,t,(sx*.45,0,.28)); el=joint('el'+side,sh,(0,0,-.42)); hn=joint('hand'+side,el,(0,0,-.42)); setattr(R,'sh'+side,sh); setattr(R,'el'+side,el); setattr(R,'hand'+side,hn)
        box(sh,(.12,.12,.46),(0,0,-.21),'metal',bevel=.02); box(el,(.1,.1,.46),(0,0,-.21),'white',bevel=.02); box(hn,(.14,.1,.2),(0,0,-.08),'dark',bevel=.02)
    for side,sx in (('L',-1),('R',1)):
        hp=joint('hp'+side,h,(sx*.2,0,-.35)); kn=joint('kn'+side,hp,(0,0,-.4)); setattr(R,'hp'+side,hp); setattr(R,'kn'+side,kn); box(hp,(.14,.14,.42),(0,0,-.2),'white',bevel=.03); box(kn,(.12,.12,.5),(0,0,-.24),'metal',bevel=.03); box(kn,(.16,.3,.08),(0,-.06,-.5),'dark',bevel=.02)
    R.hipH=1.0*s; R.height=2.2*s; return R

def extras(R,spec):
    ex=spec.get('extras',()); t=R.torso; hd=R.head; br=R.kind=='bruiser'; fy=-.3 if br else -.22; by=.3 if br else .22; tw=.8 if br else .62; th=.78 if br else .62
    for e in ex:
        if e=='tank': cyl(t,.12,.6,(.18,by+.1,th*.6),'metal',v=12); cyl(t,.12,.6,(-.18,by+.1,th*.6),'accent',v=12); cyl(t,.03,.4,(0,by-.02,th*.5),'dark',(0,90,0),v=6)
        elif e=='robe': box(R.hips,(tw*.95,.5,.62),(0,0,-.34),'cloth',bevel=.05); box(R.hips,(tw*.8,.1,.62),(0,-.26,-.36),'accent',bevel=.02)
        elif e=='apron': box(t,(tw*.8,.06,th*.95),(0,fy-.04,th*.5),'white',bevel=.02); box(t,(tw*.6,.07,.1),(0,fy-.06,th*.55),'dark',bevel=.01)
        elif e=='cross': box(t,(.3,.05,.08),(0,fy-.06,th*.65),'glow'); box(t,(.08,.05,.3),(0,fy-.06,th*.65),'glow')
        elif e=='hat': cyl(hd,.3,.1,(0,0,.46),'accent',v=20); cyl(hd,.2,.16,(0,0,.52),'main',v=20)
        elif e=='cone': cyl(hd,.28,.38,(0,0,.58),'accent',v=18,r2=.04)
        elif e=='mask': box(hd,(.34,.14,.22),(0,-.24,.2),'white',bevel=.04); cyl(hd,.07,.2,(0,-.34,.16),'dark',(90,0,0),v=10)
        elif e=='hivis':
            for z in (.28,.5): box(t,(tw*1.04,torD_(br)*1.04,.07),(0,0,th*z+.1),'glow')
        elif e=='plate': box(t,(tw*.9,.1,th*.8),(0,fy-.06,th*.55),'dark',bevel=.04); box(t,(tw*.5,.1,.12),(0,fy-.08,th*.8),'accent')
        elif e=='horns':
            for sx in (-1,1): cyl(hd,.05,.4,(sx*.22,0,.5),'metal',(0,sx*-35,0),v=8,r2=.01)
        elif e=='visor': box(hd,(.5,.08,.1),(0,-.25,.26),'glow')
def torD_(br): return .5 if br else .36

def hum2(sp,b):
    R=humanoid(sp,b); extras(R,sp); return R
def hover2(sp):
    R=hover(sp); return R
def quad(spec):
    R=Rig(); R.kind='quad'; s=spec.get('scale',1.0); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,.5*s)); R.hips.scale=(s,s,s); h=R.hips
    R.torso=joint('torso',h,(0,0,0)); t=R.torso
    box(t,(.5,.95,.42),(0,0,.1),'main',bevel=.07); box(t,(.54,.5,.3),(0,-.1,.2),'accent',bevel=.05); box(t,(.4,.5,.12),(0,.1,.36),'dark',bevel=.03)
    for i in range(5): box(t,(.06,.1,.12),(0,.3-i*.16,.42),'metal',bevel=.01)
    R.head=joint('head',t,(0,-.55,.2)); hd=R.head; box(hd,(.32,.4,.26),(0,-.1,0),'main',bevel=.05); box(hd,(.2,.24,.1),(0,-.32,-.04),'dark',bevel=.03); sph(hd,.045,(.1,-.28,.08),'glow'); sph(hd,.045,(-.1,-.28,.08),'glow')
    R.jaw=joint('jaw',hd,(0,-.2,-.1)); box(R.jaw,(.2,.3,.06),(0,-.14,0),'dark',bevel=.015)
    for sx in (-1,1): cyl(hd,.05,.2,(sx*.12,.0,.2),'metal',(0,sx*-12,0),v=6,r2=.01)
    R.tail=joint('tail',t,(0,.5,.2)); cyl(R.tail,.05,.6,(0,.3,.04),'metal',(-75,0,0),v=8,r2=.02); sph(R.tail,.07,(0,.62,.1),'glow')
    R.legs=[]
    for (nm,x,y) in (('FL',-.3,-.35),('FR',.3,-.35),('BL',-.3,.35),('BR',.3,.35)):
        hp=joint('hp'+nm,h,(x,y,.0)); kn=joint('kn'+nm,hp,(0,0,-.25)); setattr(R,'hp'+nm,hp); setattr(R,'kn'+nm,kn); R.legs.append((hp,kn))
        box(hp,(.15,.17,.28),(0,0,-.12),'main',bevel=.04); box(kn,(.11,.13,.3),(0,0,-.13),'dark',bevel=.03); box(kn,(.14,.24,.07),(0,-.04,-.27),'metal',bevel=.02)
    R.hipH=.5*s; R.height=.9*s; return R
def cart(spec):
    R=Rig(); R.kind='cart'; s=spec.get('scale',1.0); R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,.3*s)); R.hips.scale=(s,s,s); h=R.hips; fork=spec.get('fork',False)
    R.torso=joint('torso',h,(0,0,0)); t=R.torso
    box(t,(.8,1.3,.16),(0,0,.1),'dark',bevel=.04)
    R.wheels=[]
    for x,y in ((-.45,-.5),(.45,-.5),(-.45,.5),(.45,.5)):
        w=joint('wh',h,(x,y,0)); R.wheels.append(w); cyl(w,.28,.14,(0,0,0),'dark',(0,90,0),v=18); cyl(w,.13,.16,(0,0,0),'metal',(0,90,0),v=10)
    if fork:
        box(t,(.8,.7,.6),(0,.35,.5),'main',bevel=.05); box(t,(.82,.4,.3),(0,.45,.9),'accent',bevel=.04); box(t,(.5,.06,.3),(0,.0,.95),'glow'); cyl(t,.025,.8,(.3,.6,1.2),'metal',v=6)
        R.head=joint('head',t,(0,0,1.0)); sph(R.head,.2,(0,.45,.1),'dark',(1,1,.8)); sph(R.head,.045,(.08,.27,.12),'glow'); sph(R.head,.045,(-.08,.27,.12),'glow')
        R.mast=joint('mast',t,(0,-.45,.2)); box(R.mast,(.1,.08,1.2),(.25,0,.6),'metal'); box(R.mast,(.1,.08,1.2),(-.25,0,.6),'metal'); box(R.mast,(.7,.1,.1),(0,0,1.15),'dark')
        R.forks=joint('forks',R.mast,(0,0,.1)); box(R.forks,(.1,.8,.06),(.2,-.45,0),'metal',bevel=.01); box(R.forks,(.1,.8,.06),(-.2,-.45,0),'metal',bevel=.01); box(R.forks,(.6,.06,.5),(0,-.02,.3),'dark')
        R.height=1.6*s
    else:  # gurney with a strapped-in runner torso
        box(t,(.7,1.45,.12),(0,0,.5),'white',bevel=.04); box(t,(.64,1.3,.1),(0,0,.6),'accent',bevel=.04); box(t,(.1,1.4,.1),(.38,0,.7),'metal'); box(t,(.1,1.4,.1),(-.38,0,.7),'metal')
        R.head=joint('head',t,(0,.5,.8)); sph(R.head,.2,(0,0,.14),'white',(1,1,1.1)); box(R.head,(.28,.1,.1),(0,-.15,.16),'glow'); box(t,(.5,.5,.5),(0,.3,.95),'main',bevel=.05); cyl(t,.025,1.2,(.3,.6,1.3),'metal',v=6); box(t,(.18,.1,.3),(.3,.6,1.9),'glow')
        R.height=1.6*s
    R.hipH=.3*s; return R
ARCH={'humanoid':lambda sp:hum2(sp,False),'bruiser':lambda sp:hum2(sp,True),'turret':turret,'hover':hover2,'quad':quad,'cart':cart}
# ---------------- animation (procedural, per archetype) ----------------
def sm(t): t=min(1,max(0,t)); return t*t*(3-2*t)
def rx(j,d): j.rotation_euler=(math.radians(d),j.rotation_euler[1],j.rotation_euler[2])
def setr(j,x=0,y=0,z=0): j.rotation_euler=(math.radians(x),math.radians(y),math.radians(z))
def reset(R):
    for o in ALL:
        if o.type=='EMPTY' and o.name not in('root',): o.rotation_euler=(0,0,0)
    R.root.location=(0,0,0); R.root.rotation_euler=(0,0,0)
def pose(R,spec,anim,f,n):
    reset(R); u=f/n; ph=u*math.tau; hip0=R.hipH if hasattr(R,'hipH') else 0; k=R.kind
    if k=='turret':
        if anim=='idle': setr(R.gun,math.sin(ph)*2); R.torso.location.z=.55
        elif anim=='walk': setr(R.torso,0,0,math.sin(ph)*8)
        elif anim=='attack':
            r=sm(u/.4) if u<.4 else 1-sm((u-.4)/.6); R.torso.location.y=r*.18; R.torso.location.z=.55-r*.03; setr(R.torso,-r*3)
            for i,c in enumerate(R.gun.children): pass
            R.gun.rotation_euler=(0,0,(u*math.tau*3 if u<.7 else 0))
        elif anim=='hit': r=math.sin(u*math.pi); R.torso.location.y=r*.1; setr(R.torso,r*4,0,r*3)
        elif anim=='death': r=sm(u); setr(R.torso,r*28,0,r*14); R.torso.location.z=.55-r*.28; R.torso.location.y=r*.1; R.root.location.z=-r*.04
        return
    if k=='quad':
        s1=math.sin(ph); s2=math.sin(ph+math.pi); a=34
        if anim=='idle':
            R.hips.location.z=hip0+math.sin(ph)*.012; setr(R.head,math.sin(ph)*3,0,math.sin(ph*.5)*4); setr(R.tail,0,0,math.sin(ph)*14); setr(R.jaw,3)
            for (hp,kn) in R.legs: setr(kn,6)
        elif anim=='walk':
            R.hips.location.z=hip0-abs(math.sin(ph))*.05; setr(R.torso,math.sin(ph*2)*3); setr(R.tail,0,0,s1*25); setr(R.head,-math.sin(ph*2)*4,0,s1*3)
            for i,(hp,kn) in enumerate(R.legs):
                sg=s1 if i in (0,3) else s2; setr(hp,sg*a); setr(kn,max(0,-sg)*a*1.2+8)
        elif anim=='attack':
            w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w)); wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0
            R.root.location.y=-.5*r; setr(R.torso,-wind*14+r*10); setr(R.head,r*18-wind*8); setr(R.jaw,wind*10+(55*r if r>.5 else 0)); setr(R.tail,0,0,r*30)
            for i,(hp,kn) in enumerate(R.legs): setr(hp,(-1 if i<2 else 1)*r*28); setr(kn,r*16+8)
        elif anim=='hit':
            r=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=r*.2; setr(R.torso,-r*12,0,r*6); setr(R.head,r*14); setr(R.jaw,r*25)
        elif anim=='death':
            r=sm(u); R.hips.location.z=hip0-r*.28; R.root.rotation_euler=(math.radians(0),math.radians(r*85),0); setr(R.jaw,r*40); setr(R.tail,0,0,r*40)
            for (hp,kn) in R.legs: setr(hp,r*50); setr(kn,r*40)
        return
    if k=='cart':
        if anim=='idle': R.hips.location.z=hip0+math.sin(ph)*.008; setr(R.head,0,0,math.sin(ph)*5)
        elif anim=='walk':
            for w in R.wheels: setr(w,-u*360*2)
            R.hips.location.z=hip0+abs(math.sin(ph*2))*.02; setr(R.torso,math.sin(ph*2)*1.2,0,math.sin(ph)*1.5)
        elif anim=='attack':
            w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w)); wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0
            R.root.location.y=-.7*r+.15*wind; setr(R.torso,-r*5+wind*6); setr(R.head,0,0,r*12)
            for ww in R.wheels: setr(ww,-r*300)
            if hasattr(R,'forks'): R.forks.location.z=.1+r*.35; setr(R.mast,-wind*4)
        elif anim=='hit': r=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=r*.2; setr(R.torso,-r*10,0,r*6)
        elif anim=='death': r=sm(u); R.root.rotation_euler=(0,math.radians(r*70),0); R.root.location.z=-r*.0; setr(R.head,r*20)
        return
    sw=spec.get('swing',1.0)
    if anim=='idle':
        b=math.sin(ph); R.hips.location.z=hip0+b*.012; setr(R.torso,b*1.5+(5 if k=='bruiser' else 2)); setr(R.head,-b*1.0-(3 if k=='bruiser' else 0)); 
        if k!='hover':
            setr(R.shL,6+b*3); setr(R.shR,-6-b*3); setr(R.elL,-14); setr(R.elR,-14)
            if spec.get('weapon_R') in('rifle',): setr(R.shR,-48); setr(R.elR,-40); setr(R.shL,-40); setr(R.elL,-38)
            setr(R.hpL,-3); setr(R.hpR,3)
        else:
            R.hips.location.z=hip0+math.sin(ph)*.06; setr(R.shL,12+b*4); setr(R.shR,12-b*4); setr(R.hpL,4); setr(R.hpR,-4)
    elif anim=='walk':
        a=26*sw if k!='bruiser' else 20*sw; s1=math.sin(ph); s2=math.sin(ph+math.pi)
        if k=='hover':
            R.hips.location.z=hip0+math.sin(ph*2)*.05; setr(R.torso,-8+math.sin(ph*2)*1.5); setr(R.hpL,s1*8); setr(R.hpR,s2*8); setr(R.shL,10+s1*6); setr(R.shR,10+s2*6); return
        setr(R.hpL,s1*a); setr(R.hpR,s2*a); setr(R.knL,max(0,-math.cos(ph))*a*1.25+4); setr(R.knR,max(0,math.cos(ph))*a*1.25+4)
        R.hips.location.z=hip0-abs(math.sin(ph))*.06*(1 if k=='humanoid' else 1.4)+.03; setr(R.hips,0,0,s1*4*sw); setr(R.torso,(8 if k=='bruiser' else 4),0,-s1*5*sw); setr(R.head,-(5 if k=='bruiser' else 2),0,s1*2)
        setr(R.shL,s2*a*.8); setr(R.shR,s1*a*.8); setr(R.elL,-18-max(0,s2)*20); setr(R.elR,-18-max(0,s1)*20)
        if spec.get('weapon_R')=='rifle': setr(R.shR,-48+s1*3); setr(R.elR,-40); setr(R.shL,-40); setr(R.elL,-38)
    elif anim=='attack':
        w=.42; r=sm(u/w) if u<w else 1.0-sm((u-w)/(1-w))   # 0 rest -> 1 full extension (hit at u=w)
        wind=sm(u/.3)-sm((u-.3)/.12) if u<.42 else 0
        lunge=-.35*r*(1 if k!='hover' else .6)
        R.root.location.y=lunge
        setr(R.torso,(8 if k=='bruiser' else 3)+r*16-wind*10,0,wind*18-r*24); setr(R.head,-r*8); setr(R.hips,0,0,-wind*8+r*10)
        setr(R.hpL,r*22); setr(R.hpR,-r*26); setr(R.knL,r*20+6); setr(R.knR,r*30+6)
        kindR=spec.get('weapon_R'); kindL=spec.get('weapon_L')
        if kindR=='rifle':     # ranged: raise, recoil on release
            kick=max(0,1-abs(u-.42)*7); setr(R.shR,-62-kick*-10,0,-6); setr(R.elR,-22); setr(R.shL,-58); setr(R.elL,-30); R.root.location.y=kick*.12; setr(R.torso,2-kick*5)
        elif kindR=='drill':   setr(R.shR,-40-r*35+wind*55,0,-8); setr(R.elR,-30-r*22); setr(R.shL,-20-r*10+wind*20); setr(R.elL,-34)
        elif kindR=='saw':     setr(R.shR,-30-r*70+wind*150,0,-18+r*10); setr(R.elR,-20-r*28); setr(R.shL,wind*30-r*25); setr(R.elL,-20)
        elif kindR=='scythe':  setr(R.shR,-20-r*80+wind*170,0,-10); setr(R.elR,-18-r*22); setr(R.shL,-10-r*30+wind*50); setr(R.elL,-26)
        elif kindR=='slab' or kindL=='slab':
            setr(R.shR,-25-r*95+wind*120); setr(R.elR,-10-r*30); setr(R.shL,-25-r*60+wind*95); setr(R.elL,-14-r*25)
        else:
            setr(R.shR,-20-r*80+wind*120); setr(R.elR,-20); setr(R.shL,-10-r*50+wind*70); setr(R.elL,-30)
        if kindL=='claws': setr(R.shL,-30-r*85+wind*110); setr(R.elL,-30-r*20)
        if k=='hover':
            setr(R.torso,-12+r*20-wind*8); R.hips.location.z=hip0+.15*wind-.05*r
    elif anim=='hit':
        r=math.sin(min(1,u*1.3)*math.pi); R.root.location.y=r*.18; setr(R.torso,-r*14,0,r*5); setr(R.head,r*16); setr(R.hips,-r*5); setr(R.shL,r*20); setr(R.shR,r*18)
        if k!='hover': setr(R.knL,r*10); setr(R.knR,r*10)
    elif anim=='death':
        r=sm(u); r2=sm((u-.25)/.75)
        if k=='hover':
            R.hips.location.z=hip0-r*(hip0-.28); setr(R.torso,-r*35,0,r*25); setr(R.shL,40*r); setr(R.shR,60*r); setr(R.hpL,r*30); setr(R.hpR,-r*20); R.root.rotation_euler=(math.radians(-r2*40),0,math.radians(r2*20)); return
        kneel=sm(u/.45); R.hips.location.z=hip0-kneel*(hip0*.55)
        setr(R.hpL,-kneel*70); setr(R.hpR,-kneel*60); setr(R.knL,kneel*120); setr(R.knR,kneel*110)
        setr(R.torso,12*kneel+r2*75,0,r2*10); setr(R.head,r2*20); setr(R.shL,r2*60); setr(R.shR,r2*40); setr(R.elL,-20-r2*30); setr(R.elR,-20-r2*20)
        R.root.location.y=0
        R.root.rotation_euler=(0,0,0)
# ---------------- scene, camera, lights ----------------
def setup_scene(ortho):
    cam=bpy.data.cameras.new('c'); cam.type='ORTHO'; cam.ortho_scale=ortho; cam.shift_y=.30; cam.clip_end=60
    co=bpy.data.objects.new('cam',cam); sc.collection.objects.link(co); co.rotation_euler=(math.radians(60),0,0); co.location=(0,-0.866*12,0.5*12); sc.camera=co
    def sun(name,e,rot,col,ang=10):
        d=bpy.data.lights.new(name,'SUN'); d.energy=e; d.color=col; d.angle=math.radians(ang); o=bpy.data.objects.new(name,d); sc.collection.objects.link(o); o.rotation_euler=[math.radians(x) for x in rot]
    sun('key',5.0,(50,0,-38),(1.0,.94,.84),6); sun('fill',1.0,(70,0,140),(.72,.82,1.0),25); sun('rim',2.2,(125,0,170),(.8,.9,1.0),8)
    w=bpy.data.worlds.new('w'); w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(.40,.43,.46,1); w.node_tree.nodes['Background'].inputs[1].default_value=.85; sc.world=w
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=SAMPLES; sc.cycles.use_denoising=True; sc.cycles.max_bounces=4; sc.cycles.diffuse_bounces=2; sc.cycles.glossy_bounces=2; sc.cycles.use_adaptive_sampling=True; sc.cycles.adaptive_threshold=.03
    sc.render.resolution_x=RES; sc.render.resolution_y=RES; sc.render.resolution_percentage=100; sc.render.film_transparent=True; sc.view_settings.view_transform='Standard'
    sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGBA'; sc.render.threads=int(os.environ.get('THREADS','8')); sc.render.use_persistent_data=True
    return co
DIRS=['S','SW','W','NW','N','NE','E','SE']; FACE={'S':(0,-1),'SW':(-1,-1),'W':(-1,0),'NW':(-1,1),'N':(0,1),'NE':(1,1),'E':(1,0),'SE':(1,-1)}
ids=os.environ.get('IDS','worker').split(','); want=os.environ.get('ANIMS',','.join(ANIM_SPEC)).split(','); dsel=os.environ.get('DIRS'); DSEL=dsel.split(',') if dsel else DIRS
fsel=os.environ.get('FRAMES'); FSEL=[int(x) for x in fsel.split(',')] if fsel else None
for eid in ids:
    spec=SPECS[eid]; bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene; ALL.clear(); palette(spec['palette'])
    R=ARCH[spec['arch']](spec); co=setup_scene(spec.get('ortho',R.height*1.25+.7)); bpy.context.view_layer.update()
    T0=time.time(); cnt=0; os.makedirs(f'{OUT}/{eid}',exist_ok=True)
    for anim in want:
        n=ANIM_SPEC[anim]['n']; os.makedirs(f'{OUT}/{eid}/{anim}',exist_ok=True)
        for d in DSEL:
            fx,fy=FACE[d]; 
            for f in range(n):
                if FSEL and f not in FSEL: continue
                pose(R,spec,anim,f,n); R.root.rotation_euler=(R.root.rotation_euler[0],0,math.atan2(fy,fx)+math.pi/2) if anim!='death' else (0,0,math.atan2(fy,fx)+math.pi/2)
                # facing yaw applied on a parent so root offsets (lunge) follow the facing
                bpy.context.view_layer.update(); sc.render.filepath=f'{OUT}/{eid}/{anim}/{d}_{f}.png'; bpy.ops.render.render(write_still=True); cnt+=1
        print(eid,anim,cnt,f'{time.time()-T0:.0f}s',flush=True)
    from bpy_extras.object_utils import world_to_camera_view
    pv=world_to_camera_view(sc,co,Vector((0,0,0))); json.dump({'ortho':co.data.ortho_scale,'res':RES,'anchor':[pv.x,1-pv.y]},open(f'{OUT}/{eid}/meta.json','w'))
print('DONE')

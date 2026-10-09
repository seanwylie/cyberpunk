# Loot-drop 3D sprite renderer (Blender/bpy, Cycles CPU). Usage: python build_loot.py OUTDIR SHARD NSHARDS [--list] [--only name,name] [--fast]
# Renders turntable / mechanical-animation frames for every loot model into OUTDIR/<name>/<frame>.png (transparent bg).
# Names: base_<slot>_<mfr> (7 slots x 3 mfr), chip, stim, credits_<1|2|3>, orange_<slot>_<mfr>, sig_<id>, gimbal_back/front.
import bpy, bmesh, math, sys, os, json, time
from mathutils import Vector
OUT=sys.argv[1]; SHARD=int(sys.argv[2]); NSH=int(sys.argv[3]); FAST='--fast' in sys.argv
ONLY=[a for a in sys.argv if a.startswith('--only=')]; ONLY=ONLY[0][7:].split(',') if ONLY else None
NB=int(os.environ.get('NB',12)); NO=int(os.environ.get('NO',16)); RES=int(os.environ.get('RES',256)); SAMPLES=int(os.environ.get('SAMPLES',28))
def lin(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(((v/12.92) if v<=.04045 else ((v+.055)/1.055)**2.4) for v in c)+(1,)
COL={'HI':'#8f3b2e','PS':'#58708a','MM':'#707a45'}
MATS={}
def mat(key,hexc,rough=.6,metal=0.,wear='#c9b28a',grime=.45,bump=.25):
    k=(key,hexc,rough,metal)
    if k in MATS: return MATS[k]
    m=bpy.data.materials.new(key); m.use_nodes=True; nt=m.node_tree; N=nt.nodes; L=nt.links; b=N['Principled BSDF']
    tc=N.new('ShaderNodeTexCoord'); no=N.new('ShaderNodeTexNoise'); no.inputs['Scale'].default_value=9; no.inputs['Detail'].default_value=8; L.new(tc.outputs['Object'],no.inputs['Vector'])
    no2=N.new('ShaderNodeTexNoise'); no2.inputs['Scale'].default_value=55; no2.inputs['Detail'].default_value=3; L.new(tc.outputs['Object'],no2.inputs['Vector'])
    bv=N.new('ShaderNodeBevel'); bv.inputs['Radius'].default_value=.03; bv.samples=4
    gn=N.new('ShaderNodeNewGeometry'); dt=N.new('ShaderNodeVectorMath'); dt.operation='DOT_PRODUCT'; L.new(bv.outputs[0],dt.inputs[0]); L.new(gn.outputs['Normal'],dt.inputs[1])
    mr=N.new('ShaderNodeMapRange'); mr.inputs[1].default_value=.9; mr.inputs[2].default_value=.995; mr.inputs[3].default_value=1; mr.inputs[4].default_value=0; mr.clamp=True; L.new(dt.outputs['Value'],mr.inputs[0])
    gm=N.new('ShaderNodeMapRange'); gm.inputs[1].default_value=.42; gm.inputs[2].default_value=.62; gm.inputs[3].default_value=0; gm.inputs[4].default_value=grime; L.new(no.outputs['Fac'],gm.inputs[0])
    m1=N.new('ShaderNodeMixRGB'); m1.inputs[1].default_value=lin(hexc); m1.inputs[2].default_value=lin('#15130f'); L.new(gm.outputs[0],m1.inputs[0])
    m2=N.new('ShaderNodeMixRGB'); m2.inputs[2].default_value=lin(wear); L.new(mr.outputs[0],m2.inputs[0]); m2.inputs[0].default_value=0; L.new(m1.outputs[0],m2.inputs[1])
    ew=N.new('ShaderNodeMath'); ew.operation='MULTIPLY'; ew.inputs[1].default_value=.55; L.new(mr.outputs[0],ew.inputs[0]); L.new(ew.outputs[0],m2.inputs[0])
    L.new(m2.outputs[0],b.inputs['Base Color']); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    bm=N.new('ShaderNodeBump'); bm.inputs['Strength'].default_value=bump; bm.inputs['Distance'].default_value=.01; L.new(no2.outputs['Fac'],bm.inputs['Height']); L.new(bv.outputs[0],bm.inputs['Normal']); L.new(bm.outputs[0],b.inputs['Normal'])
    if 'Specular IOR Level' in b.inputs: b.inputs['Specular IOR Level'].default_value=.35
    MATS[k]=m; return m
def M(name,m=None):
    t={'bone':('#cbbf9f',.65,0),'metal':('#5b5f60',.42,.85),'soot':('#1d1f1f',.8,0),'conc':('#7d7f7b',.9,0),'orange':('#b8651f',.5,.35),'brass':('#8a7048',.4,.8),'dark':('#2b2d2d',.55,.6),'olivedk':('#31361d',.7,0)}
    if name in ('P','PD','PL'):
        base=lin and COL[m]; 
        if name=='PD': return mat('PD'+m,'#'+''.join('%02x'%int(int(base[i:i+2],16)*.5) for i in (1,3,5)),.7,.2)
        if name=='PL': return mat('PL'+m,'#'+''.join('%02x'%min(255,int(int(base[i:i+2],16)*1.25)) for i in (1,3,5)),.55,.2)
        return mat('P'+m,base,.58,.25)
    h,r,mt=t[name]; return mat(name,h,r,mt)
# ---------------------------------------------------------------- scene helpers
ROOT=None
def clear():
    global ROOT
    for o in list(bpy.data.objects):
        if o.type in ('CAMERA','LIGHT'): continue
        bpy.data.objects.remove(o,do_unlink=True)
    for me in list(bpy.data.meshes): bpy.data.meshes.remove(me)
    ROOT=bpy.data.objects.new('root',None); bpy.context.scene.collection.objects.link(ROOT); return ROOT
def mkobj(name,bm,m,parent,loc,rot,smooth=False,bev=0.0):
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth=smooth
    o=bpy.data.objects.new(name,me); bpy.context.scene.collection.objects.link(o); o.data.materials.append(m)
    o.parent=parent or ROOT; o.location=loc; o.rotation_euler=[math.radians(a) for a in rot]
    if bev>0:
        md=o.modifiers.new('b','BEVEL'); md.width=bev; md.segments=2; md.limit_method='ANGLE'
    return o
def box(loc,dims,m,rot=(0,0,0),taper=1.0,bev=.025,parent=None):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1)
    for v in bm.verts:
        s=taper if v.co.z>0 else 1.0
        v.co.x*=dims[0]*s; v.co.y*=dims[1]*s; v.co.z*=dims[2]
    return mkobj('box',bm,m,parent,loc,rot,False,bev)
def cyl(loc,r,h,m,rot=(0,0,0),r2=None,seg=28,parent=None,bev=0.012,smooth=True):
    bm=bmesh.new(); bmesh.ops.create_cone(bm,cap_ends=True,segments=seg,radius1=r,radius2=r if r2 is None else r2,depth=h)
    return mkobj('cyl',bm,m,parent,loc,rot,smooth and seg>=12,bev if seg>=12 else bev)
def sph(loc,r,m,scale=(1,1,1),parent=None,rot=(0,0,0)):
    bm=bmesh.new(); bmesh.ops.create_uvsphere(bm,u_segments=28,v_segments=18,radius=1)
    for v in bm.verts: v.co.x*=r*scale[0]; v.co.y*=r*scale[1]; v.co.z*=r*scale[2]
    return mkobj('sph',bm,m,parent,loc,rot,True)
def tor(loc,R,r,m,rot=(0,0,0),scale=(1,1,1),parent=None,seg=40):
    bm=bmesh.new()
    # build torus manually
    ns,nm=seg,12
    vs=[[bm.verts.new(((R+r*math.cos(b))*math.cos(a)*scale[0],(R+r*math.cos(b))*math.sin(a)*scale[1],r*math.sin(b)*scale[2])) for b in [j/nm*2*math.pi for j in range(nm)]] for a in [i/ns*2*math.pi for i in range(ns)]]
    for i in range(ns):
        for j in range(nm): bm.faces.new((vs[i][j],vs[(i+1)%ns][j],vs[(i+1)%ns][(j+1)%nm],vs[i][(j+1)%nm]))
    return mkobj('tor',bm,m,parent,loc,rot,True)
def empty(loc=(0,0,0),rot=(0,0,0),parent=None):
    e=bpy.data.objects.new('e',None); bpy.context.scene.collection.objects.link(e); e.parent=parent or ROOT; e.location=loc; e.rotation_euler=[math.radians(a) for a in rot]; return e
def gear(loc,r,teeth,m,parent=None,h=.12,rot=(0,0,0),tm=None):
    g=empty(loc,rot,parent); cyl((0,0,0),r*.82,h,m,seg=32,parent=g)
    for i in range(teeth):
        a=i/teeth*2*math.pi; box((math.cos(a)*r*.9,math.sin(a)*r*.9,0),(r*.28,r*.2,h),tm or m,rot=(0,0,math.degrees(a)),bev=.012,parent=g)
    cyl((0,0,h*.5+.01),r*.3,h*.5,M('dark'),seg=16,parent=g); return g
def rivets(pts,m,r=.035,parent=None):
    for p in pts: sph(p,r,m,parent=parent)
def tilt_group(rx,rz=0): return empty((0,0,0),(rx,0,rz))
# ---------------------------------------------------------------- slot models (front = -Y, up = +Z, ~1.7 tall)
def mdl_face(m,g):
    P,PD,PL=M('P',m),M('PD',m),M('PL',m); bone,met,soot=M('bone'),M('metal'),M('soot')
    sph((0,0,.12),.66,P,(.95,.84,1.1),g); box((0,-.04,-.5),(.86,.78,.4),PD,taper=1.0,bev=.04,parent=g)
    box((0,-.02,-.78),(.34,.34,.3),soot,parent=g); cyl((0,0,-.74),.3,.3,met,seg=20,parent=g)
    for s in(-1,1): cyl((s*.7,.02,.05),.17,.14,met,rot=(0,90,0),seg=20,parent=g); cyl((s*.77,.02,.05),.08,.06,bone,rot=(0,90,0),seg=16,parent=g)
    box((0,-.34,.46),(1.0,.45,.12),PD,rot=(-12,0,0),parent=g)
    if m=='HI':
        for s in(-1,1): box((s*.28,-.62,.16),(.34,.1,.17),soot,parent=g); box((s*.28,-.66,.16),(.4,.03,.04),bone,parent=g)
        for i in range(5): box((-.3+i*.15,-.66,-.5),(.07,.08,.34),soot,parent=g)
        box((0,-.66,-.2),(.14,.08,.3),PL,parent=g); rivets([(-.6,-.35,.42),(.6,-.35,.42),(-.5,-.55,-.2),(.5,-.55,-.2)],bone,parent=g)
    elif m=='PS':
        box((0,-.62,.14),(.9,.1,.13),soot,parent=g); box((0,-.67,.14),(.78,.03,.03),bone,parent=g); box((0,-.62,-.22),(.14,.06,.4),PD,parent=g)
        tor((0,-.55,-.42),.18,.025,bone,rot=(90,0,0),parent=g)
    else:
        cyl((-.26,-.58,.16),.2,.1,soot,rot=(90,0,0),parent=g); cyl((-.26,-.64,.16),.12,.08,bone,rot=(90,0,0),parent=g); sph((-.26,-.68,.16),.07,met,parent=g)
        cyl((.27,-.58,.12),.13,.1,soot,rot=(90,0,0),parent=g); cyl((.27,-.64,.12),.07,.07,mat('amberlens','#7a6a3a',.1,.2),rot=(90,0,0),parent=g)
        box((.15,-.64,-.35),(.5,.06,.22),bone,rot=(0,0,6),parent=g); rivets([(-.1,-.67,-.35),(.38,-.67,-.35)],soot,parent=g)
def mdl_brain(m,g):
    P,PD,PL=M('P',m),M('PD',m),M('PL',m); bone,met,soot,brass=M('bone'),M('metal'),M('soot'),M('brass')
    sph((0,0,.18),.7,P,(1.0,.88,.72),g); box((0,0,-.2),(1.05,.92,.26),met,bev=.04,parent=g)
    for z in(.08,.3,.5): tor((0,0,z),.66-abs(z-.18)*.5,.03,PD,scale=(1,.88,1),parent=g)
    for i in range(7): cyl((-.45+i*.15,-.12 if i%2 else .12,-.5),.045,.36,brass,seg=10,parent=g)
    cyl((0,0,.62),.1,.18,met,seg=16,parent=g); tor((0,0,.7),.14,.03,brass,parent=g)
    if m=='HI':
        for s in(-1,1): box((s*.5,0,.2),(.1,.9,.8),PD,rot=(0,-s*18,0),parent=g)
        box((0,-.45,.55),(.9,.1,.1),PD,parent=g); rivets([(-.5,-.5,-.15),(.5,-.5,-.15),(0,-.5,-.15)],bone,parent=g)
    elif m=='PS':
        tor((0,0,.18),.78,.04,bone,rot=(0,0,0),scale=(1,.9,1),parent=g); box((0,-.5,.2),(.6,.05,.12),bone,parent=g)
    else:
        box((0,-.1,.28),(1.3,.2,.12),bone,rot=(0,0,20),parent=g); tor((-.4,-.55,-.1),.14,.025,soot,rot=(90,20,0),parent=g); tor((.3,-.58,-.05),.1,.02,soot,rot=(90,-30,0),parent=g)
def mdl_torso(m,g):
    P,PD,PL=M('P',m),M('PD',m),M('PL',m); bone,met,soot,brass=M('bone'),M('metal'),M('soot'),M('brass')
    box((0,0,.12),(1.1,.66,1.1),P,taper=1.14,bev=.06,parent=g); box((0,.02,-.65),(.72,.52,.4),PD,bev=.05,parent=g)
    box((0,0,-.86),(.8,.56,.1),met,parent=g)
    for s in(-1,1): sph((s*.66,0,.56),.25,met,(1,.9,.9),g); cyl((s*.66,0,.56),.12,.5,soot,seg=12,parent=g)
    box((0,.36,.1),(.55,.1,.9),PD,parent=g); cyl((0,0,.7),.2,.2,soot,seg=16,parent=g)
    for i in range(4): box((0,-.34,.38-i*.2),(.62,.05,.07),bone,parent=g)
    box((.05,-.36,.1),(.14,.05,1.4),PD,rot=(0,0,-38),parent=g)
    cyl((-.3,-.37,-.35),.13,.1,met,rot=(90,0,0),seg=18,parent=g)
    if m=='HI': rivets([(sx*.46,-.35,z) for sx in(-1,1) for z in(.55,-.15)],bone,.05,g); box((.28,-.37,-.3),(.3,.05,.3),soot,parent=g)
    elif m=='PS': tor((0,-.35,.12),.28,.035,bone,rot=(90,0,0),parent=g); tor((0,-.35,.12),.12,.025,bone,rot=(90,0,0),parent=g)
    else: box((.25,-.36,.15),(.42,.05,.5),mat('patch','#4a4c3a',.8),rot=(0,0,8),parent=g); rivets([(.07,-.4,.38),(.43,-.4,.38),(.07,-.4,-.08),(.43,-.4,-.08)],soot,.03,g); 
    if m=='MM':
        for i in range(4): box((-.3,-.38,.4-i*.1),(.4,.03,.04),soot,parent=g)
def mdl_arm(m,g):
    P,PD,PL=M('P',m),M('PD',m),M('PL',m); bone,met,soot,brass=M('bone'),M('metal'),M('soot'),M('brass')
    sph((0,0,.72),.3,met,parent=g); cyl((0,0,.28),.22,.8,P,r2=.19,seg=24,parent=g); box((0,-.18,.45),(.34,.12,.5),PD,parent=g)
    sph((0,0,-.2),.24,met,parent=g); tor((0,0,-.2),.24,.04,brass,rot=(0,90,0),parent=g)
    f=empty((0,0,-.2),(14,0,0),g); box((0,0,-.45),(.42,.4,.78),P,taper=.78,bev=.05,parent=f); box((0,-.22,-.4),(.3,.06,.5),PL,parent=f)
    box((0,0,-.9),(.36,.34,.18),soot,parent=f)
    if m=='HI': cyl((.28,.05,-.45),.07,.8,brass,seg=14,parent=f); cyl((.28,.05,-.2),.11,.3,met,seg=14,parent=f); box((0,0,-1.0),(.5,.46,.2),PD,parent=f); rivets([(-.18,-.24,-.1),(.18,-.24,-.1)],bone,.04,f)
    elif m=='PS': box((0,-.05,-1.1),(.07,.3,.7),bone,taper=.6,parent=f); box((.0,-.2,-.7),(.1,.1,.4),met,parent=f)
    else: tor((.3,-.05,-.4),.2,.04,soot,rot=(0,90,0),scale=(1,1,1.4),parent=f); gear((.28,-.08,-.7),.16,8,met,f,rot=(0,90,0)); box((-.1,-.22,-.55),(.3,.05,.3),mat('patch','#4a4c3a',.8),rot=(0,0,10),parent=f)
def mdl_hand(m,g):
    P,PD,PL=M('P',m),M('PD',m),M('PL',m); bone,met,soot,brass=M('bone'),M('metal'),M('soot'),M('brass')
    cyl((0,0,.62),.3,.3,met,seg=22,parent=g); cyl((0,0,.62),.34,.08,brass,seg=22,parent=g)
    box((0,0,.2),(.78,.32,.62),P,taper=1.0,bev=.06,parent=g); box((0,-.18,.25),(.62,.06,.44),PD,parent=g)
    for i in range(4):
        x=-.29+i*.195; L=.34+(.06 if i in(1,2) else 0)-(.06 if i==3 else 0)
        box((x,0,-.2-L*.2),(.16,.17,L),P,bev=.03,parent=g); f2=empty((x,-.0,-.2-L*.62),(28,0,0),g); box((0,0,-L*.45),(.14,.15,L*.85),PD,bev=.03,parent=f2)
        box((x,-.1,.45-.05),(.17,.05,.1),bone,parent=g)
    box((.5,-.05,.0),(.18,.18,.4),P,rot=(0,-28,18),parent=g); box((.58,-.12,-.2),(.15,.15,.3),PD,rot=(0,-45,18),parent=g)
    if m=='HI': 
        for i in range(4): box((-.29+i*.195,-.14,.0),(.18,.07,.14),soot,parent=g)
    elif m=='PS': tor((0,-.18,.2),.18,.02,bone,rot=(90,0,0),parent=g)
    else: box((-.2,-.19,.15),(.3,.04,.25),mat('patch','#4a4c3a',.8),parent=g); rivets([(-.3,-.22,.25),(-.1,-.22,.05)],soot,.03,g)
def mdl_leg(m,g):
    P,PD,PL=M('P',m),M('PD',m),M('PL',m); bone,met,soot,brass=M('bone'),M('metal'),M('soot'),M('brass')
    cyl((0,0,.5),.27,.78,P,r2=.22,seg=24,parent=g); sph((0,0,.88),.3,met,parent=g)
    sph((0,0,.08),.25,met,parent=g); box((0,-.28,.08),(.5,.2,.5),PD,rot=(-8,0,0),parent=g)
    box((0,.02,-.42),(.46,.44,.82),P,taper=.78,bev=.05,parent=g); box((0,-.24,-.3),(.3,.06,.55),PL,parent=g)
    cyl((0,.0,-.85),.2,.2,met,seg=18,parent=g); box((0,-.02,-.98),(.56,.7,.16),soot,bev=.04,parent=g)
    cyl((.0,.32,.1),.06,.9,brass,seg=12,parent=g); cyl((0,.32,.28),.1,.4,met,seg=14,parent=g)
    if m=='HI': box((0,-.35,.08),(.62,.14,.4),PD,parent=g); rivets([(-.24,-.44,.2),(.24,-.44,.2),(-.24,-.44,-.04),(.24,-.44,-.04)],bone,.04,g)
    elif m=='PS': tor((0,0,.5),.27,.03,bone,parent=g); tor((0,0,-.1),.3,.03,bone,parent=g)
    else: box((-.1,-.27,-.5),(.3,.05,.45),mat('patch','#4a4c3a',.8),rot=(0,0,-6),parent=g); tor((.0,.15,.5),.28,.03,soot,rot=(80,0,0),parent=g)
def mdl_foot(m,g):
    P,PD,PL=M('P',m),M('PD',m),M('PL',m); bone,met,soot,brass=M('bone'),M('metal'),M('soot'),M('brass')
    box((0,.12,-.1),(.6,.95,.6),P,taper=.9,bev=.07,parent=g); sph((0,-.45,-.2),.3,P,(1,1.15,.7),g); box((0,-.5,-.05),(.5,.3,.12),PL,parent=g)
    box((0,.15,-.5),(.68,1.3,.14),soot,bev=.05,parent=g)
    for i in range(5): box((0,-.45+i*.25,-.6),(.7,.07,.08),soot,parent=g)
    cyl((0,.28,.38),.25,.5,met,seg=20,parent=g); box((0,.2,.2),(.7,.2,.12),bone,rot=(0,0,0),parent=g)
    box((0,-.18,.1),(.66,.1,.1),bone,rot=(-18,0,0),parent=g); cyl((0,.58,.05),.12,.14,met,rot=(90,0,0),seg=14,parent=g)
    if m=='HI': box((0,.62,-.1),(.5,.12,.4),PD,parent=g); rivets([(-.2,-.1,.25),(.2,-.1,.25)],bone,.04,g)
    elif m=='PS': tor((0,.28,.2),.27,.025,bone,parent=g)
    else: box((.1,-.3,.15),(.3,.05,.3),mat('patch','#4a4c3a',.8),rot=(-20,0,10),parent=g)
SLOTS={'face':mdl_face,'brain':mdl_brain,'torso':mdl_torso,'arm':mdl_arm,'hand':mdl_hand,'leg':mdl_leg,'foot':mdl_foot}
def mdl_chip(m,g):
    t=empty((0,0,0),(-55,0,0),g); pcb=mat('pcb','#1f2620',.5,.1); bone,brass,soot,met=M('bone'),M('brass'),M('soot'),M('metal')
    box((0,0,0),(1.45,1.05,.1),pcb,bev=.03,parent=t); box((0,0,.08),(.5,.5,.08),soot,bev=.015,parent=t); box((-.2,-.2,.125),(.07,.07,.02),bone,parent=t)
    for i in range(9):
        x=-.6+i*.15
        for s in(-1,1): box((x,s*.56,0),(.08,.1,.05),brass,parent=t)
    for i in range(7): box((.7,-.4+i*.133,0),(.1,.08,.05),brass,parent=t)
    for k in range(5): box((-.55+k*.12,.28,.06),(.05,.5+(k%2)*.1,.012),brass,parent=t); box((.4,-.42+k*.1,.06),(.5,.03,.012),brass,parent=t)
    box((-.5,-.15,.07),(.22,.22,.07),met,bev=.02,parent=t); cyl((.45,.3,.07),.1,.06,bone,seg=16,parent=t)
    box((-.72,0,.04),(.1,.5,.14),soot,parent=t)
def mdl_stim(m,g):
    t=empty((0,0,0),(0,0,0),g); t.rotation_euler=(math.radians(18),0,math.radians(32))
    bone,met,soot,brass,P=M('bone'),M('metal'),M('soot'),M('brass'),M('P','MM')
    cyl((0,0,.0),.2,1.0,mat('glass','#9c9a86',.25,0),seg=24,parent=t); cyl((0,0,.0),.215,.2,P,seg=24,parent=t); cyl((0,0,.3),.215,.08,met,seg=24,parent=t)
    box((0,-.19,-.08),(.1,.05,.55),soot,parent=t); box((0,-.2,-.08),(.06,.03,.35),mat('fluid','#6b5a2a',.3,0),parent=t)
    cyl((0,0,.62),.07,.45,met,seg=12,parent=t); cyl((0,0,.9),.2,.07,bone,seg=24,parent=t)
    box((0,0,.5),(.7,.12,.1),met,bev=.03,parent=t); cyl((0,0,-.58),.1,.16,brass,r2=.06,seg=16,parent=t); cyl((0,0,-.9),.035,.55,met,r2=.01,seg=10,parent=t)
def mdl_credits(n):
    def f(m,g):
        brass,met,soot,bone=M('brass'),M('metal'),M('soot'),M('bone'); plate=mat('salv','#6e6a58',.45,.7)
        specs={1:[(0,0,0,0)],2:[(0,0,0,0),(.12,.05,.14,18)],3:[(0,0,0,0),(.1,.04,.14,15),(-.08,.1,.28,-10),(.45,-.1,-.2,30),(-.4,-.15,-.22,5)]}[n]
        for (x,y,z,r) in specs:
            hx=empty((x,y,z-.2),(0,0,r),g); cyl((0,0,0),.52,.11,plate,seg=6,parent=hx,bev=.02,smooth=False); cyl((0,0,.06),.34,.03,soot,seg=6,parent=hx,smooth=False); cyl((0,0,.07),.12,.04,brass,seg=16,parent=hx)
            for k in range(3): box((math.cos(k*2.09)*.42,math.sin(k*2.09)*.42,.06),(.06,.06,.03),bone,parent=hx)
    return f
# ---------------------------------------------------------------- orange wrapper: opening plated housing, gears, kinetic parts
def orange_frame(base,m,sig=None,sigf=None):
    root=ROOT; hold=empty((0,0,.1),(0,0,0),root); item=empty((0,0,0),(0,0,0),hold); item.scale=(.92,.92,.92); base(m,item)
    orng,met,dark,brass,soot,bone=M('orange'),M('metal'),M('dark'),M('brass'),M('soot'),M('bone')
    cyl((0,0,-1.05),1.05,.14,M('conc'),seg=40,parent=root); cyl((0,0,-.96),.92,.06,dark,seg=40,parent=root)
    ring=empty((0,0,-.93),(0,0,0),root)
    for i in range(12): a=i/12*360; box((math.cos(math.radians(a))*.97,math.sin(math.radians(a))*.97,0),(.2,.12,.08),orng,rot=(0,0,a),parent=ring)
    cyl((0,0,-.88),.3,.1,met,seg=20,parent=root)
    plates=[]
    for k in range(4):
        az=45+90*k; piv=empty((math.cos(math.radians(az))*.82,math.sin(math.radians(az))*.82,-.9),(0,0,az-90),root)
        hinge=empty((0,0,0),(0,0,0),piv)  # rotates about local X (outward lean)
        box((0,0,.65),(.8,.07,1.3),mat('plate','#55564f',.5,.8),taper=.9,bev=.03,parent=hinge); box((0,-.045,.7),(.62,.03,.14),orng,parent=hinge); box((0,-.045,1.0),(.6,.03,.1),orng,parent=hinge)
        for s in(-1,1): box((s*.25,-.05,.2),(.05,.05,.3),soot,parent=hinge); cyl((s*.38,0,0),.07,.12,brass,rot=(0,90,0),seg=14,parent=piv)
        plates.append(hinge)
    g1=gear((-1.38,.2,-.93),.42,10,M('metal'),root,tm=orng); g2=gear((1.38,.2,-.93),.42,10,M('metal'),root,tm=orng); g3=gear((0,1.25,-.93),.3,8,brass,root,tm=M('metal')) if sig else None
    ex=sigf(item,hold,root) if sigf else (lambda u:None)
    def anim(u):
        c=math.cos(2*math.pi*u); op=.5-.5*c
        for h in plates: h.rotation_euler=(math.radians(-(34+46*op)),0,0)
        item.rotation_euler=(0,0,math.radians(25+360*u)); hold.location=(0,0,.12+.08*math.sin(2*math.pi*u)); ring.rotation_euler=(0,0,math.radians(30*u))
        g1.rotation_euler=(0,0,math.radians(72*u)); g2.rotation_euler=(0,0,math.radians(-72*u+18))
        if g3: g3.rotation_euler=(0,0,math.radians(-90*u))
        ex(u)
    return anim
def sig_ext(name):
    # returns builder wrapper (base slot, mfr) + extra kinetic part function
    def mk(slot,m):
        def sigf(item,hold,root):
            metl,dark,brass,soot,bone,orng,P,PD=M('metal'),M('dark'),M('brass'),M('soot'),M('bone'),M('orange'),M('P',m),M('PD',m)
            if name=='audit_core':
                r1=empty((0,0,.18),(70,0,0),item); tor((0,0,0),.95,.035,orng,parent=r1); sph((.95,0,0),.1,brass,parent=r1)
                r2=empty((0,0,.18),(-20,0,0),item); tor((0,0,0),.82,.03,bone,parent=r2); sph((0,.82,0),.08,metl,parent=r2)
                return lambda u:(setattr(r1,'rotation_euler',(math.radians(70),0,math.radians(360*u))),setattr(r2,'rotation_euler',(math.radians(-20),0,math.radians(-360*u))))
            if name=='reclaimer_ripper':
                s=empty((0,.1,-.9),(0,90,0),item); cyl((0,0,0),.55,.07,metl,seg=40,parent=s)
                for i in range(16): a=i/16*360; box((math.cos(math.radians(a))*.58,math.sin(math.radians(a))*.58,0),(.16,.1,.07),orng,rot=(0,0,a+25),parent=s)
                cyl((0,0,.0),.14,.14,brass,seg=14,parent=s)
                return lambda u:setattr(s,'rotation_euler',(math.radians(0),math.radians(90),math.radians(-720*u/ 1.0)))
            if name=='anvil_arm':
                p=empty((0,-.05,-1.0),(0,0,0),item); box((0,0,-.28),(.62,.6,.56),dark,bev=.06,parent=p); box((0,0,-.62),(.8,.5,.2),metl,parent=p); box((0,-.3,-.1),(.5,.04,.08),orng,parent=p); cyl((0,0,.4),.07,.8,brass,seg=12,parent=p)
                return lambda u:setattr(p,'location',(0,-.05,-1.0+.33*math.sin(2*math.pi*u)))
            if name=='governor_core':
                sh=empty((0,0,.55),(0,0,0),item); cyl((0,0,.0),.05,.9,metl,seg=10,parent=sh)
                for s in(0,1):
                    arm=empty((0,0,.3),(0,0,180*s),sh); box((.3,0,.0),(.6,.04,.04),brass,parent=arm); sph((.62,0,-.12),.14,dark,parent=arm); tor((.3,0,.0),.1,.015,orng,rot=(90,0,0),parent=arm)
                return lambda u:setattr(sh,'rotation_euler',(0,0,math.radians(360*u*2)))
            if name=='autosurgeon_rig':
                ss=[]
                for i,x in enumerate((-.62,.62)):
                    s=empty((x,-.2,-1.0),(90,0,0),item); cyl((0,0,0),.4,.05,bone,seg=36,parent=s); 
                    for k in range(12): a=k/12*360; box((math.cos(math.radians(a))*.42,math.sin(math.radians(a))*.42,0),(.1,.08,.05),metl,rot=(0,0,a+20),parent=s)
                    cyl((0,0,0),.08,.1,orng,seg=12,parent=s); ss.append((s,1 if i else -1))
                return lambda u:[setattr(s,'rotation_euler',(math.radians(90),0,math.radians(360*u*d*2))) for s,d in ss]
            if name=='recovered_veil':
                st=[]
                for i in range(7):
                    x=-.52+i*.17; h=empty((x,-.4,.1),(0,0,0),item); box((0,0,-.45),(.1,.02,.9+(i%3)*.15),mat('veil','#7d7966',.9,0),parent=h); box((0,-.01,-.05),(.1,.03,.05),orng,parent=h); st.append((h,i))
                return lambda u:[setattr(h,'rotation_euler',(math.radians(14*math.sin(2*math.pi*u+i*.9)),0,math.radians(6*math.sin(2*math.pi*u*2+i)))) for h,i in st]
            if name=='lazarus_rack':
                pd=[]
                for s in(-1,1):
                    h=empty((s*.5,-.1,.1),(0,0,0),item); cyl((0,0,-.2),.2,.05,metl,rot=(90,0,0),seg=24,parent=h); cyl((0,-.06,-.2),.07,.08,orng,rot=(90,0,0),seg=14,parent=h); box((0,0,.15),(.03,.03,.7),soot,parent=h); pd.append((h,s))
                    cyl((s*.3,.32,-.2),.12,.5,brass,seg=14,parent=item)
                return lambda u:[setattr(h,'location',(s*(.82+.15*math.sin(2*math.pi*u)),-.4,.1+.15*math.cos(2*math.pi*u))) for h,s in pd]
            if name=='r0_lifter':
                fk=empty((0,-.55,-.9),(0,0,0),item)
                for s in(-1,1): box((s*.3,-.35,0),(.1,.8,.08),dark,parent=fk); box((s*.3,-.7,.05),(.1,.1,.12),orng,parent=fk)
                box((0,0,.3),(.8,.08,.7),metl,parent=fk); cyl((0,-.1,.3),.1,.5,brass,seg=12,parent=fk)
                return lambda u:setattr(fk,'location',(0,-.55,-.9+.3*(.5-.5*math.cos(2*math.pi*u))))
            if name=='pool_o_legs':
                ps=[]
                for s in(-1,1): c=cyl((s*.5,-.1,-.4),.07,.8,brass,seg=12,parent=item); pc=cyl((s*.5,-.1,-.1),.12,.4,metl,seg=14,parent=item); ps.append((pc,s))
                return lambda u:[setattr(pc,'location',(s*.5,-.1,-.1+.25*math.sin(2*math.pi*u+(0 if s>0 else math.pi)))) for pc,s in ps]
        return sigf
    return mk
SIGS={'audit_core':('brain','PS'),'reclaimer_ripper':('arm','HI'),'anvil_arm':('arm','HI'),'governor_core':('brain','HI'),'autosurgeon_rig':('arm','PS'),'recovered_veil':('torso','PS'),'lazarus_rack':('torso','MM'),'r0_lifter':('leg','MM'),'pool_o_legs':('leg','HI')}
# ---------------------------------------------------------------- jobs
def jobs():
    J=[]
    for s in SLOTS:
        for m in ('HI','PS','MM'): J.append((f'base_{s}_{m}',NB,'base',lambda s=s,m=m:(SLOTS[s],m)))
    J.append(('chip',NB,'base',lambda:(mdl_chip,'MM'))); J.append(('stim',NB,'base',lambda:(mdl_stim,'MM')))
    for n in(1,2,3): J.append((f'credits_{n}',NB,'base',lambda n=n:(mdl_credits(n),'MM')))
    for s in SLOTS:
        for m in ('HI','PS','MM'): J.append((f'orange_{s}_{m}',NO,'orange',lambda s=s,m=m:(SLOTS[s],m,None)))
    J.append(('orange_chip',NO,'orange',lambda:(mdl_chip,'MM',None)))
    for k,(s,m) in SIGS.items(): J.append((f'sig_{k}',NO,'orange',lambda k=k,s=s,m=m:(SLOTS[s],m,k)))
    J.append(('gimbal_back',NO,'gimbal',lambda:'back')); J.append(('gimbal_front',NO,'gimbal',lambda:'front'))
    return J
# ---------------------------------------------------------------- render setup
sc=bpy.context.scene
def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    global sc; sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=12 if FAST else SAMPLES; sc.cycles.use_denoising=True
    sc.cycles.max_bounces=3; sc.cycles.diffuse_bounces=2; sc.cycles.glossy_bounces=2; sc.cycles.transmission_bounces=1; sc.cycles.transparent_max_bounces=2
    sc.render.film_transparent=True; sc.render.resolution_x=RES; sc.render.resolution_y=RES; sc.render.resolution_percentage=100
    sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGBA'; sc.render.threads=1; sc.view_settings.view_transform='Standard'
    sc.render.use_persistent_data=False
    w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']; bg.inputs[0].default_value=(.34,.35,.37,1); bg.inputs[1].default_value=.55
    cam=bpy.data.cameras.new('c'); cam.type='ORTHO'; co=bpy.data.objects.new('c',cam); sc.collection.objects.link(co); sc.camera=co
    el=math.radians(32); d=12; co.location=(0,-d*math.cos(el),d*math.sin(el)); co.rotation_euler=(math.radians(90)-el,0,0); cam.clip_start=.1; cam.clip_end=40
    for nm,en,col,loc,rot,size in (('key',620,(1,.86,.68),(-4,-5,7),0,3.5),('fill',160,(.62,.72,.95),(5,-3,3),0,5),('rim',320,(.9,.92,1),(2,6,5),0,3)):
        l=bpy.data.lights.new(nm,'AREA'); l.energy=en; l.color=col; l.size=size; lo=bpy.data.objects.new(nm,l); sc.collection.objects.link(lo); lo.location=loc
        tr=lo.constraints.new('TRACK_TO'); tr.target=None
        v=(-Vector(loc)).normalized(); lo.rotation_euler=v.to_track_quat('-Z','Y').to_euler()
    return co
def render(path,co):
    sc.render.filepath=path; bpy.ops.render.render(write_still=True)
def gimbal(side):
    col=M('orange') if False else mat('gring','#7b4aa0',.45,.5); met,soot=M('metal'),M('dark')
    rs=[]
    for i,(R,tilt) in enumerate(((1.0,0),(.82,60),(.66,-60))):
        e=empty((0,0,0),(0,0,0),ROOT); tor((0,0,0),R,.045,col if i!=1 else mat('gring2','#6c5a82',.45,.5),parent=e,seg=48)
        for k in range(2): box((R*(1 if k else -1),0,0),(.14,.12,.12),soot,parent=e)
        rs.append((e,tilt,i))
    pl=empty((0,0,0),(0,0,0),ROOT); pls=[]
    for k in range(3): p=box((1.12,0,0),(.2,.1,.14),soot,parent=empty((0,0,0),(0,0,k*120),pl),bev=.02); box((1.12,0,.06),(.2,.1,.03),mat('gring','#7b4aa0',.45,.5),parent=p.parent)
    def anim(u):
        a=2*math.pi*u
        for e,t,i in rs: e.rotation_euler=(math.radians(t+(0 if i==0 else 0)),math.radians(30*(i%2)),a*(1 if i!=1 else -1))
        e0=rs[0][0]; e0.rotation_euler=(math.radians(75),0,a)
        pl.rotation_euler=(math.radians(70),0,-a*2)
    return anim
def main():
    co=setup(); J=jobs(); mine=[j for i,j in enumerate(J) if i%NSH==SHARD and (not ONLY or j[0] in ONLY)]
    if '--list' in sys.argv: print([j[0] for j in J]); return
    for name,nf,kind,fn in mine:
        d=f'{OUT}/{name}'
        if os.path.exists(d) and len(os.listdir(d))>=nf: continue
        os.makedirs(d,exist_ok=True); t0=time.time(); clear(); MATS.clear(); co.data.ortho_scale={'base':2.75,'orange':3.7,'gimbal':3.0}[kind]
        co.data.clip_start=.1; co.data.clip_end=40; co.location.z=co.location.z
        if kind=='base':
            fnb,m=fn(); g=empty((0,0,0),(0,0,0),ROOT); fnb(m,g)
            for f in range(nf): ROOT.rotation_euler=(0,0,math.radians(25+360*f/nf)); render(f'{d}/{f}.png',co)
        elif kind=='orange':
            b,m,sg=fn(); an=orange_frame(b,m,sg,sig_ext(sg)(SIGS[sg][0] if sg else 'x',m) if sg else None)
            for f in range(nf): an(f/nf); render(f'{d}/{f}.png',co)
        else:
            an=gimbal(fn())
            dist=12; ccd=dist
            if fn()=='front': co.data.clip_start=dist; co.data.clip_end=40
            else: co.data.clip_start=.1; co.data.clip_end=dist
            for f in range(nf): an(f/nf); render(f'{d}/{f}.png',co)
        print(name,nf,'frames',round(time.time()-t0,1),'s',flush=True)
main()

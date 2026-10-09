# Scavenger-mechanic v2 (sculpted-look procedural meshes). Modular per body slot, Cycles CPU render, one layer render per slot.
# Run: python build_char.py OUTDIR [--test]   env: SAMPLES, RES, ANIMS="idle,run,...", DIRS="S,SE", FRAMES="0,2", TEX=texture dir
import bpy, bmesh, math, sys, json, os, time
import numpy as np
from mathutils import Vector, Euler, Matrix
from bpy_extras.object_utils import world_to_camera_view
OUT=sys.argv[1]; TEST='--test' in sys.argv
TEX=os.environ.get('TEX','/workspace/art/tex2')
RES=int(os.environ.get('RES','320')); SAMPLES=int(os.environ.get('SAMPLES','48'))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
T0=time.time()
# ===================== materials =====================
def mk_mat(name,tex,tile=1.6,rough=1.0,metal=0.0,bump=0.5,bdist=0.004,wear=None,ao=0.55,grime=0.35,spec=0.4):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; N=nt.nodes; L=nt.links; b=N['Principled BSDF']
    tc=N.new('ShaderNodeTexCoord'); mp=N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value=(tile,tile,tile); L.new(tc.outputs['Object'],mp.inputs['Vector'])
    def img(sfx,cs):
        t=N.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(f'{TEX}/{tex}_{sfx}.png'); t.image.colorspace_settings.name=cs
        t.projection='BOX'; t.projection_blend=0.3; t.interpolation='Cubic'; L.new(mp.outputs['Vector'],t.inputs['Vector']); return t
    tcol,trg,thg=img('c','sRGB'),img('r','Non-Color'),img('h','Non-Color')
    col=tcol.outputs['Color']
    def mix(a,bb,fac,blend='MIX'):
        n=N.new('ShaderNodeMixRGB'); n.blend_type=blend; n.inputs[0].default_value=fac if isinstance(fac,float) else 1.0
        if not isinstance(fac,float): L.new(fac,n.inputs[0])
        L.new(a,n.inputs[1]);
        if isinstance(bb,tuple): n.inputs[2].default_value=bb
        else: L.new(bb,n.inputs[2])
        return n.outputs[0]
    # ambient occlusion multiply
    aon=N.new('ShaderNodeAmbientOcclusion'); aon.inputs['Distance'].default_value=0.07; aon.samples=6; aon.inside=False
    col=mix(col,aon.outputs['Color'],ao,'MULTIPLY')
    # low-body grime (object Z in rest pose)
    sep=N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'],sep.inputs[0]); mr=N.new('ShaderNodeMapRange'); mr.inputs[1].default_value=0.0; mr.inputs[2].default_value=0.7; mr.inputs[3].default_value=1.0; mr.inputs[4].default_value=0.0; mr.clamp=True; L.new(sep.outputs['Z'],mr.inputs[0])
    gm=N.new('ShaderNodeMath'); gm.operation='MULTIPLY'; gm.inputs[1].default_value=grime; L.new(mr.outputs[0],gm.inputs[0])
    gg=N.new('ShaderNodeMath'); gg.operation='MULTIPLY'; L.new(gm.outputs[0],gg.inputs[0]); L.new(trg.outputs['Color'],gg.inputs[1])  # modulated by rough map noise
    col=mix(col,(0.07,0.065,0.055,1),gg.outputs[0])
    # edge wear from bevel node
    if wear:
        bv=N.new('ShaderNodeBevel'); bv.inputs['Radius'].default_value=0.012; bv.samples=6; gn=N.new('ShaderNodeNewGeometry')
        dt=N.new('ShaderNodeVectorMath'); dt.operation='DOT_PRODUCT'; L.new(bv.outputs[0],dt.inputs[0]); L.new(gn.outputs['Normal'],dt.inputs[1])
        mr2=N.new('ShaderNodeMapRange'); mr2.inputs[1].default_value=0.995; mr2.inputs[2].default_value=0.88; mr2.clamp=True; L.new(dt.outputs['Value'],mr2.inputs[0])
        nz=N.new('ShaderNodeMath'); nz.operation='MULTIPLY'; L.new(mr2.outputs[0],nz.inputs[0]); L.new(thg.outputs['Color'],nz.inputs[1]); nz.inputs[1].default_value=1.0
        nz2=N.new('ShaderNodeMath'); nz2.operation='MULTIPLY'; nz2.inputs[1].default_value=wear[1]; L.new(mr2.outputs[0],nz2.inputs[0])
        col=mix(col,wear[0],nz2.outputs[0])
    L.new(col,b.inputs['Base Color'])
    rm=N.new('ShaderNodeMath'); rm.operation='MULTIPLY'; rm.inputs[1].default_value=rough; L.new(trg.outputs['Color'],rm.inputs[0]); L.new(rm.outputs[0],b.inputs['Roughness'])
    bn=N.new('ShaderNodeBump'); bn.inputs['Strength'].default_value=bump; bn.inputs['Distance'].default_value=bdist; L.new(thg.outputs['Color'],bn.inputs['Height']); L.new(bn.outputs['Normal'],b.inputs['Normal'])
    b.inputs['Metallic'].default_value=metal; b.inputs['Specular IOR Level'].default_value=spec
    return m
def rgba(h): return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))+(1,)
M={}
M['jacket']=mk_mat('jacket','jacket',tile=1.5,rough=1.0,wear=(rgba('#b9bab0'),0.7),bump=0.9)
M['pants']=mk_mat('pants','pants',tile=1.8,rough=1.0,wear=(rgba('#6a6a62'),0.4),bump=0.9)
M['olive']=mk_mat('olive','olive',tile=1.7,rough=1.0,metal=0.25,wear=(rgba('#a4a69c'),1.0),bump=1.2,bdist=0.006)
M['ivory']=mk_mat('ivory','ivory',tile=1.9,rough=1.0,wear=(rgba('#efe9d8'),0.6),bump=1.2,bdist=0.004,spec=0.6)
M['skin']=mk_mat('skin','skin',tile=2.5,rough=1.0,bump=0.2,spec=0.3)
M['boot']=mk_mat('boot','boot',tile=2.2,rough=1.0,wear=(rgba('#6a6358'),0.7),bump=1.0)
M['canvas']=mk_mat('canvas','canvas',tile=2.4,rough=1.0,wear=(rgba('#8d8872'),0.5),bump=0.9)
M['metal']=mk_mat('metal','metal',tile=2.0,rough=0.9,metal=0.8,wear=(rgba('#b9b9b2'),0.8),bump=0.7)
M['cloth']=mk_mat('cloth','cloth',tile=2.4,rough=1.0,bump=1.0)
M['glass']=mk_mat('glass','glass',tile=2.0,rough=1.0,metal=0.0,bump=0.0,spec=1.0,ao=0.2)
M['amber']=mk_mat('amber','amber',tile=2.0,rough=1.0,bump=0.0,spec=1.0,ao=0.3)
M['rubber']=mk_mat('rubber','rubber',tile=2.0,rough=1.0,wear=(rgba('#4a4a46'),0.5),bump=0.6)
# ===================== rig (empties as joints) =====================
def pivot(name,parent,loc):
    e=bpy.data.objects.new(name,None); sc.collection.objects.link(e); e.parent=parent; e.location=loc; return e
root=pivot('root',None,(0,0,0)); body=pivot('body',root,(0,0,0.9)); hips=pivot('hips',body,(0,0,0.06))
torsoP=pivot('torsoP',hips,(0,0,0.06)); headP=pivot('headP',torsoP,(0,0,0.62))
J={}
for s,sx in (('L',1),('R',-1)):
    J['sh'+s]=pivot('sh'+s,torsoP,(0.285*sx,0,0.55)); J['el'+s]=pivot('el'+s,J['sh'+s],(0,0,-0.29)); J['wr'+s]=pivot('wr'+s,J['el'+s],(0,0,-0.27))
    J['hp'+s]=pivot('hp'+s,hips,(0.115*sx,0,-0.02)); J['kn'+s]=pivot('kn'+s,J['hp'+s],(0,0,-0.43)); J['an'+s]=pivot('an'+s,J['kn'+s],(0,0,-0.42))
bpy.context.view_layer.update()
SLOTOBJ={}; NOSH=[]
def finish(o,slot,mat,joint,bevel=0.0,bw=3,subsurf=0,solid=0.0,shade=True,noshadow=False):
    bpy.context.view_layer.objects.active=o; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    if solid>0:
        m=o.modifiers.new('so','SOLIDIFY'); m.thickness=solid; m.offset=-1; m.use_even_offset=True
    if bevel>0:
        bm=o.modifiers.new('bv','BEVEL'); bm.width=bevel; bm.segments=bw; bm.limit_method='ANGLE'; bm.angle_limit=math.radians(35)
    if subsurf>0:
        m=o.modifiers.new('ss','SUBSURF'); m.levels=subsurf; m.render_levels=subsurf
    for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(M[mat])
    if shade: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(48))
    o.parent=joint; o.matrix_parent_inverse=joint.matrix_world.inverted()
    SLOTOBJ.setdefault(slot,[]).append((o,mat,joint)); 
    if noshadow: NOSH.append(o)
    return o
def box(slot,mat,joint,size,loc,bevel=0.01,rot=(0,0,0),bw=3,subsurf=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rot); o=bpy.context.object; o.scale=size; return finish(o,slot,mat,joint,bevel,bw,subsurf)
def cyl(slot,mat,joint,r1,r2,h,loc,rot=(0,0,0),v=20,bevel=0.004,cap=True):
    bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=r1,radius2=r2,depth=h,location=loc,rotation=rot); o=bpy.context.object; return finish(o,slot,mat,joint,bevel)
def sph(slot,mat,joint,r,loc,scale=(1,1,1),seg=20,rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=r,location=loc); o=bpy.context.object; o.scale=scale; return finish(o,slot,mat,joint)
def torus(slot,mat,joint,R,r,loc,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R,minor_radius=r,major_segments=28,minor_segments=10,location=loc,rotation=rot); return finish(bpy.context.object,slot,mat,joint)
def bolt(slot,joint,loc,rot=(0,0,0),r=0.0085,h=0.007,mat='metal'):
    return cyl(slot,mat,joint,r,r*0.92,h,loc,rot,v=6,bevel=0.0012)
def mesh_obj(name,verts,faces):
    me=bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts],[],faces); me.update(); o=bpy.data.objects.new(name,me); sc.collection.objects.link(o); return o
def loft(slot,mat,joint,z0,z1,prof,nv=28,nu=40,mod=None,cap=(True,True),origin=(0,0,0),rot=(0,0,0),solid=0.0,bevel=0.0,delete=None,subsurf=0,noshadow=False):
    """vertical lofted tube in local axis, prof(t)->(cx,cy,rx,ry); mod(theta,z)->radial scale; delete(x,y,z)->True removes the face; rot/origin place it."""
    ts=np.linspace(0,1,nv); th=np.linspace(0,2*np.pi,nu,endpoint=False); V=[]
    for t in ts:
        cx,cy,rx,ry=prof(t); z=z0+(z1-z0)*t
        for a in th:
            m=mod(a,z) if mod else 1.0
            V.append((cx+rx*m*math.cos(a),cy+ry*m*math.sin(a),z))
    F=[]
    for i in range(nv-1):
        for j in range(nu):
            a=i*nu+j; b=i*nu+(j+1)%nu; F.append((a,b,b+nu,a+nu))
    if cap[0]: F.append(tuple(reversed(range(0,nu))))
    if cap[1]: F.append(tuple(range((nv-1)*nu,nv*nu)))
    R=Euler(rot).to_matrix(); V=[tuple(R@Vector(v)+Vector(origin)) for v in V]
    if delete:
        F=[f for f in F if not delete(*(sum((Vector(V[k]) for k in f),Vector())/len(f)))]
    o=mesh_obj('loft',V,F)
    return finish(o,slot,mat,joint,bevel,solid=solid,subsurf=subsurf,noshadow=noshadow)
def ribbon(slot,mat,joint,pts,nrm,w,th,bevel=0.003):
    """strip of width w and thickness th following points pts, pushed along unit normals nrm (outward)."""
    P=[Vector(p) for p in pts]; Nn=[Vector(n).normalized() for n in nrm]; V=[]
    for i,p in enumerate(P):
        tg=(P[min(i+1,len(P)-1)]-P[max(i-1,0)]).normalized(); sd=tg.cross(Nn[i]).normalized()
        for a,b in ((-1,0),(1,0),(1,1),(-1,1)): V.append(p+sd*w/2*a+Nn[i]*th*b)
    F=[]
    for i in range(len(P)-1):
        for k in range(4): F.append((i*4+k,i*4+(k+1)%4,(i+1)*4+(k+1)%4,(i+1)*4+k))
    F.append((3,2,1,0)); n=len(P)-1; F.append((n*4,n*4+1,n*4+2,n*4+3))
    o=mesh_obj('rib',V,F); bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(o.data); bm.free()
    return finish(o,slot,mat,joint,bevel,bw=2)
def lerp(a,b,t): return a+(b-a)*t
def sm(t): t=min(1,max(0,t)); return t*t*(3-2*t)
def prof_pts(pts):  # pts [(t,cx,cy,rx,ry)] -> prof func (smooth interp)
    ts=[p[0] for p in pts]
    def f(t):
        i=min(max(np.searchsorted(ts,t)-1,0),len(pts)-2); u=sm((t-ts[i])/(ts[i+1]-ts[i]) if ts[i+1]>ts[i] else 0)*0+((t-ts[i])/(ts[i+1]-ts[i]))
        u=u*u*(3-2*u)*0.5+u*0.5   # blend smoothstep & linear: soft but not flat
        return tuple(lerp(pts[i][k],pts[i+1][k],u) for k in range(1,5))
    return f
def W(j): return j.matrix_world.translation
# ===================== TORSO =====================
sh_L,sh_R=W(J['shL']),W(J['shR'])
# jacket silhouette (shared by straps/belt): half-widths vs z
def jr(z):  # (rx,ry,cy) of jacket at height z
    t=(z-1.0)/0.62
    if t<0.7: rx=lerp(0.172,0.205,sm(t/0.7))
    else: u=(t-0.7)/0.3; rx=lerp(0.205,0.12,u**1.6)
    ry=lerp(0.105,0.125,sm(min(1,t*1.5)))*(1-0.25*max(0,t-0.8)/0.2); return rx,ry,0.0
# pelvis / trousers hip block
loft('torso','pants',hips,0.84,1.06,prof_pts([(0,0,0.0,0.15,0.095),(0.5,0,0,0.17,0.11),(1,0,0,0.17,0.105)]),mod=lambda a,z:1+0.012*math.sin(5*a+z*30))
# dark undershirt/chest (visible through jacket opening)
loft('torso','cloth',torsoP,1.02,1.62,prof_pts([(0,0,0,0.158,0.098),(0.5,0,-0.002,0.185,0.112),(1,0,0,0.17,0.104)]),mod=lambda a,z:1+0.01*math.sin(9*a+z*40))
# neck
loft('torso','skin',torsoP,1.58,1.72,prof_pts([(0,0,0,0.065,0.07),(1,0,0,0.055,0.06)]))
# jacket body: open V front, folds, flared hem
def jmod(a,z):
    t=(z-1.0)/0.62
    return 1+(0.028*math.sin(7*a+1.4*math.sin(z*8)))*(1-t*0.6)+0.011*math.sin(z*55+a*2.0)*max(0,0.5-t)*2+0.006*math.sin(a*13+z*9)
def jdel(x,y,z):
    return y<-0.02 and abs(x)<0.055+0.14*max(0,(z-1.0))*0.35+0.02*(z>1.3)*(z-1.3)*3
loft('torso','jacket',torsoP,0.98,1.64,lambda t:(0,0.004*t,jr(0.98+0.66*t)[0],jr(0.98+0.66*t)[1]),nv=44,nu=56,mod=jmod,cap=(False,False),solid=0.016,delete=jdel)
# hem ruffle / waist bunching
loft('torso','jacket',torsoP,0.97,1.02,lambda t:(0,0,0.213+0.012*(1-t),0.134+0.01*(1-t)),nv=6,nu=48,mod=lambda a,z:1+0.02*math.sin(11*a),cap=(False,False),solid=0.014,delete=lambda x,y,z:y<-0.02 and abs(x)<0.055)
# collar (raised, open at front)
loft('torso','jacket',torsoP,1.58,1.70,lambda t:(0,0.01,0.12+0.03*t,0.115+0.025*t),nv=8,nu=36,mod=lambda a,z:1+0.015*math.sin(6*a),cap=(False,False),solid=0.014,delete=lambda x,y,z:y<-0.01 and abs(x)<0.07)
# gaiter / scarf drape on chest
loft('torso','cloth',torsoP,1.52,1.69,prof_pts([(0,0,-0.012,0.105,0.095),(0.5,0,-0.005,0.09,0.085),(1,0,0,0.075,0.075)]),mod=lambda a,z:1+0.025*math.sin(6*a+z*30))
# belt + buckle + loops
bz=1.03
loft('torso','canvas',torsoP,bz-0.04,bz+0.035,lambda t:(0,0,jr(bz)[0]+0.012,jr(bz)[1]+0.012),nv=6,nu=56,cap=(False,False),solid=0.014,bevel=0.003)
box('torso','metal',torsoP,(0.05,0.014,0.05),(0,-0.158,bz),0.004); box('torso','rubber',torsoP,(0.03,0.016,0.03),(0,-0.164,bz),0.003)
for sx in (1,-1):
    # shoulder straps (front & back), following the jacket surface
    pts=[];nr=[]
    for k in range(14):
        t=k/13; z=1.64-0.60*t; rx,ry,_=jr(z); x=0.115*sx+0.012*sx*t; yy=-ry*math.sqrt(max(0,1-(x/rx)**2))-0.004
        pts.append((x,yy,z)); nr.append((x/rx**2*0.4,-1,0.05))
    ribbon('torso','canvas',torsoP,pts,nr,0.042,0.013)
    pts=[];nr=[]
    for k in range(14):
        t=k/13; z=1.64-0.60*t; rx,ry,_=jr(z); x=0.12*sx; yy=ry*math.sqrt(max(0,1-(x/rx)**2))+0.004
        pts.append((x,yy,z)); nr.append((x/rx**2*0.4,1,0.05))
    ribbon('torso','canvas',torsoP,pts,nr,0.042,0.013)
    box('torso','metal',torsoP,(0.034,0.008,0.024),(0.116*sx,-0.145,1.30),0.002)  # strap buckle
    # front belt pouches + vials
    px=0.168*sx; py=-jr(1.02)[1]*0.92
    box('torso','canvas',torsoP,(0.085,0.06,0.115),(px,py-0.02,1.0),0.012,rot=(0,0,-0.35*sx)); box('torso','canvas',torsoP,(0.09,0.066,0.035),(px-0.005*sx,py-0.036,1.06),0.01,rot=(0.1,0,-0.35*sx))
    box('torso','metal',torsoP,(0.016,0.01,0.016),(px-0.01*sx,py-0.074,1.045),0.003)
    for k in range(4):
        a=-0.35*sx; cxv=px+(0.032*(k-1.5))*math.cos(a)*1; cyv=py-0.07+0.032*(k-1.5)*math.sin(a)*-sx*0
        cyl('torso','amber' if k%2==0 else 'glass',torsoP,0.0155,0.0155,0.095,(px+0.027*(k-1.5)*math.cos(a)*1,py-0.062-0.027*(k-1.5)*math.sin(a)*0-0.0*k,1.12),v=12,bevel=0.003)
        cyl('torso','metal',torsoP,0.0165,0.0165,0.016,(px+0.027*(k-1.5)*math.cos(a),py-0.062,1.172),v=12,bevel=0.002)
    # shoulder epaulette strap + patch tab
    box('torso','canvas',torsoP,(0.05,0.1,0.014),(0.2*sx,0.0,1.605),0.003,rot=(0,0,0))
box('torso','canvas',torsoP,(0.15,0.015,0.17),(0,jr(1.4)[1]+0.012,1.42),0.006); box('torso','rubber',torsoP,(0.11,0.017,0.12),(0,jr(1.4)[1]+0.016,1.42),0.004)  # back patch
box('torso','canvas',torsoP,(0.21,0.07,0.095),(0,jr(1.05)[1]+0.04,1.06),0.014); box('torso','canvas',torsoP,(0.22,0.075,0.03),(0,jr(1.05)[1]+0.04,1.115),0.01)  # back pouch
# rear hip tool: wrench
cyl('torso','metal',torsoP,0.008,0.008,0.2,(-0.2,0.02,0.98),(0.15,0,0.1),v=10); sph('torso','metal',torsoP,0.02,(-0.205,0.015,1.085),(1,0.5,1)); cyl('torso','rubber',torsoP,0.011,0.011,0.07,(-0.196,0.03,0.9),(0.15,0,0.1),v=10)
# ===================== HEAD (slot 'face') =====================
hb=W(headP).z  # 1.64
def headprof(t):  # t: chin..crown
    z=t
    rx=0.058+0.034*math.sin(min(1,t/0.45)*math.pi/2)**0.7 if t<0.45 else 0.092*math.sqrt(max(0.0,1-((t-0.45)/0.55)**2.2))+0.0
    ry=rx*1.12; cy=0.006+0.006*t
    if t<0.18: rx*=0.84+0.16*(t/0.18)  # chin
    return (0,cy,max(rx,0.003),max(ry,0.003))
loft('face','skin',headP,hb-0.0,hb+0.205,headprof,nv=40,nu=40,mod=lambda a,z:1+0.02*math.cos(a-math.pi/2)*0,cap=(True,False))
sph('face','skin',headP,0.014,(0,-0.1,hb+0.095),(0.9,1.3,1.5))                       # nose
sph('face','skin',headP,0.016,(0.088,0.008,hb+0.095),(0.5,0.9,1.5)); sph('face','skin',headP,0.016,(-0.088,0.008,hb+0.095),(0.5,0.9,1.5))  # ears
# goggles
gz=hb+0.118
box('face','rubber',headP,(0.178,0.045,0.05),(0,-0.1,gz),0.014,bw=4)
for sx in (1,-1):
    cyl('face','metal',headP,0.037,0.037,0.012,(0.047*sx,-0.126,gz),(math.radians(90),0,0),v=24,bevel=0.002)
    cyl('face','glass',headP,0.032,0.032,0.02,(0.047*sx,-0.13,gz),(math.radians(90),0,0),v=24,bevel=0.003)
    torus('face','metal',headP,0.036,0.0045,(0.047*sx,-0.133,gz),(math.radians(90),0,0))
loft('face','rubber',headP,gz-0.025,gz+0.025,lambda t:(0,0.006,0.1,0.113),nv=4,nu=40,cap=(False,False),solid=0.008)   # goggle strap
# gaiter (mask/neck) covering chin to under nose
loft('face','cloth',headP,hb-0.04,hb+0.1,prof_pts([(0,0,0.0,0.082,0.085),(0.5,0,0.004,0.088,0.095),(1,0,0.008,0.092,0.1)]),nv=14,nu=40,mod=lambda a,z:1+0.025*math.sin(6*a+z*40),cap=(False,False),solid=0.01,delete=lambda x,y,z:y>0.02 and z>hb+0.03)
# hood shell (open face oval), rim thickness, back peak
def hprof(t):
    rx=0.128+0.012*math.sin(t*math.pi); rx*=math.sqrt(max(0.03,1-max(0,(t-0.45)/0.55)**2)); ry=0.15*math.sqrt(max(0.03,1-max(0,(t-0.4)/0.6)**2)); cy=0.02+0.05*sm((t-0.45)/0.55)
    return (0,cy,rx,ry)
def hdel(x,y,z): return y<0 and ((x/0.088)**2+((z-(hb+0.1))/0.088)**2)<1.0
loft('face','jacket',headP,hb-0.03,hb+0.225,hprof,nv=46,nu=56,mod=lambda a,z:1+0.02*math.sin(5*a+z*14)+0.008*math.sin(a*11),cap=(False,True),solid=0.016,delete=hdel)
loft('face','jacket',headP,hb-0.08,hb-0.02,lambda t:(0,0.015,0.12+0.05*(1-t),0.13+0.04*(1-t)),nv=10,nu=44,mod=lambda a,z:1+0.03*math.sin(6*a+z*20),cap=(False,False),solid=0.014,delete=lambda x,y,z:y<-0.02 and abs(x)<0.09)   # hood cowl on shoulders
# ===================== ARMS =====================
def fingers(slot,mat,wr,base,sx,curl):
    w=W(wr); bx,by,bz2=base
    box(slot,mat,wr,(0.078,0.036,0.082),(bx,by,bz2),0.012,bw=3)
    for k,(dx,ln) in enumerate(((-0.027,0.075),(-0.009,0.085),(0.009,0.08),(0.027,0.066))):
        y=by-0.004; z=bz2-0.04; a=-0.35*curl
        for seg,(l,r) in enumerate(((ln*0.5,0.0085),(ln*0.32,0.0078),(ln*0.22,0.007))):
            cyl(slot,mat,wr,r,r*0.92,l,(bx+dx,y+math.sin(a)*l/2*0-0.0,z-l/2*math.cos(a)+0.0),(a,0,0),v=8,bevel=0.0015)
            z-=l*math.cos(a); y+=l*math.sin(a)*-1*-1*0; a-=0.4*curl*1.0
        sph(slot,mat,wr,0.007,(bx+dx,by,bz2-0.04),seg=8,rings=6)
    # thumb
    cyl(slot,mat,wr,0.01,0.009,0.045,(bx+0.045*sx,by-0.012,bz2-0.01),(-0.5,0,0.5*sx),v=8,bevel=0.0015); cyl(slot,mat,wr,0.009,0.0075,0.035,(bx+0.056*sx,by-0.03,bz2-0.04),(-0.9,0,0.6*sx),v=8,bevel=0.0012)
def sleeve(slot,sh,sx):
    z=W(sh).z
    loft(slot,'jacket',sh,z-0.19,z+0.02,lambda t:(0,0,0.066-0.01*t+0.008*(1-t),0.062-0.008*t+0.006*(1-t)),nv=18,nu=32,mod=lambda a,zz:1+0.03*math.sin(5*a+zz*22)+0.01*math.sin(zz*60),cap=(False,False),solid=0.014)
    loft(slot,'canvas',sh,z-0.205,z-0.185,lambda t:(0,0,0.08,0.076),nv=3,nu=32,cap=(False,False),solid=0.012,bevel=0.002)  # hem binding
for s,sx in (('L',1),('R',-1)):
    sh,el,wr=J['sh'+s],J['el'+s],J['wr'+s]
    shp,elp,wrp=W(sh),W(el),W(wr)
    sleeve('arm'+s,sh,sx)
    if s=='L':   # ivory ceramic augment arm
        a='armL'
        z1=shp.z-0.19
        # upper-arm plates (ceramic segments with rubber gaps)
        segs=[(z1,z1-0.045,0.058),(z1-0.052,z1-0.105,0.054)]
        for (za,zb,r) in segs: loft(a,'ivory',sh,zb,za,lambda t,r=r:(0,0,r-0.004*t,r*0.97),nv=10,nu=32,bevel=0.004)
        for zz in (z1-0.047,z1-0.108): cyl(a,'rubber',sh,0.044,0.044,0.012,(0,0,zz),v=24,bevel=0.002)
        # elbow joint: dark ball, ceramic hinge discs with bolts, hydraulic line
        sph(a,'rubber',el,0.046,(0,0,elp.z),seg=24,rings=16)
        for dx in (-1,1):
            cyl(a,'ivory',el,0.05,0.05,0.016,(0.052*dx,0,elp.z),(0,math.radians(90),0),v=28,bevel=0.003); bolt(a,el,(0.062*dx,0,elp.z),(0,math.radians(90),0),0.011,0.008)
        cyl(a,'metal',el,0.007,0.007,0.15,(0.0,-0.05,elp.z+0.04),(0.2,0,0),v=8,bevel=0.0015)
        # forearm: ceramic shell w/ ridge plates, wrist cuff, slate device
        loft(a,'ivory',el,wrp.z+0.05,elp.z-0.04,prof_pts([(0,0,0,0.04,0.038),(0.45,0,0,0.048,0.046),(1,0,0,0.05,0.05)]),nv=18,nu=32,bevel=0.004,mod=lambda a2,z:1+0.015*math.sin(4*a2))
        box(a,'ivory',el,(0.06,0.028,0.13),(0,-0.043,elp.z-0.1),0.01,rot=(0.05,0,0)); box(a,'rubber',el,(0.07,0.032,0.012),(0,-0.043,elp.z-0.17),0.003)
        loft(a,'rubber',wr,wrp.z+0.01,wrp.z+0.04,lambda t:(0,0,0.04,0.038),nv=3,nu=28,bevel=0.002); loft(a,'metal',wr,wrp.z-0.02,wrp.z+0.012,lambda t:(0,0,0.046,0.045),nv=3,nu=28,bevel=0.003)
        box(a,'glass',el,(0.026,0.012,0.034),(0.0,-0.066,wrp.z+0.07),0.003); box(a,'metal',el,(0.036,0.01,0.042),(0.0,-0.059,wrp.z+0.07),0.003)
        fingers('handL','ivory',wr,(0,0,wrp.z-0.052),sx,1.0)
    else:        # bare forearm w/ wrap, jacket sleeve above
        a='armR'
        sph(a,'skin',el,0.04,(0,0,elp.z),seg=20,rings=12)
        loft(a,'skin',sh,elp.z+0.02,shp.z-0.17,lambda t:(0,0,0.046-0.008*t,0.046-0.008*t),nv=10,nu=28)
        loft(a,'skin',el,wrp.z+0.03,elp.z,prof_pts([(0,0,0,0.036,0.034),(0.5,0,0,0.045,0.042),(1,0,0,0.042,0.04)]),nv=16,nu=28,mod=lambda a2,z:1+0.02*math.sin(3*a2+z*20))
        loft(a,'canvas',wr,wrp.z-0.02,wrp.z+0.085,lambda t:(0,0,0.043-0.005*t,0.04-0.005*t),nv=10,nu=28,cap=(False,False),solid=0.01,mod=lambda a2,z:1+0.025*math.sin(z*160),bevel=0.002)
        box(a,'metal',wr,(0.025,0.012,0.03),(0.0,-0.042,wrp.z+0.045),0.003)
        fingers('handR','skin',wr,(0,0,wrp.z-0.052),sx,1.0)
# ===================== LEGS / FEET =====================
def foot(s,an,anp):
    f='foot'+s; ox=anp.x
    # boot shaft w/ cuff
    loft(f,'boot',an,anp.z+0.08,anp.z+0.24,prof_pts([(0,ox,0.005,0.056,0.064),(0.6,ox,0.0,0.06,0.066),(1,ox,0.0,0.064,0.07)]),nv=12,nu=32,cap=(True,True),mod=lambda a,z:1+0.02*math.sin(7*a+z*40))
    loft(f,'rubber',an,anp.z+0.22,anp.z+0.255,lambda t:(ox,0,0.068,0.074),nv=3,nu=32,cap=(False,False),solid=0.01,bevel=0.003)  # padded cuff
    # foot body: loft along -Y
    ofs=(ox,anp.y+0.085,anp.z-0.028); pr=prof_pts([(0,0,0.045,0.048,0.058),(0.35,0,0.04,0.056,0.052),(0.7,0,0.03,0.058,0.044),(1,0,0.012,0.048,0.03)])
    loft(f,'boot',an,0,0.3,pr,nv=14,nu=28,origin=ofs,rot=(math.radians(90),0,0),cap=(True,True))
    loft(f,'rubber',an,0.19,0.30,lambda t:(0,0.012+0.005*t,0.049,0.033),nv=5,nu=24,origin=ofs,rot=(math.radians(90),0,0),cap=(False,True),bevel=0.002)  # toe cap
    # sole + heel + treads
    box(f,'rubber',an,(0.124,0.33,0.03),(ox,anp.y-0.065,anp.z-0.07),0.012,bw=3)
    box(f,'rubber',an,(0.12,0.07,0.05),(ox,anp.y+0.075,anp.z-0.045),0.01)
    for k in range(7): box(f,'rubber',an,(0.13,0.016,0.012),(ox,anp.y-0.19+k*0.036,anp.z-0.088),0.003,bw=2)
    # laces & hooks
    for k in range(5): box(f,'canvas',an,(0.062,0.01,0.007),(ox,anp.y-0.066-0.0,anp.z+0.095+k*0.026) if False else (ox,anp.y-0.062,anp.z+0.108+k*0.026),0.002,rot=(0.2,0,0.45*(1 if k%2 else -1)),bw=2)
    box(f,'canvas',an,(0.03,0.07,0.012),(ox,anp.y-0.03,anp.z+0.075),0.004); bolt(f,an,(ox+0.07,anp.y+0.0,anp.z+0.17),(0,math.radians(90),0),0.011,0.006)
for s,sx in (('L',1),('R',-1)):
    hp,kn,an=J['hp'+s],J['kn'+s],J['an'+s]; hpp,knp,anp=W(hp),W(kn),W(an)
    if s=='L':   # soot cargo trousers + knee pad
        l='legL'
        loft(l,'pants',hp,knp.z+0.02,hpp.z-0.01,prof_pts([(0,0,-0.004,0.06,0.066),(0.5,0,0,0.072,0.078),(1,0,0.0,0.082,0.088)]),nv=22,nu=36,mod=lambda a,z:1+0.022*math.sin(5*a+z*16)+0.01*math.sin(z*60+a),cap=(False,False))
        loft(l,'pants',kn,anp.z+0.06,knp.z+0.03,prof_pts([(0,0,0.0,0.056,0.06),(0.5,0,0.003,0.054,0.058),(1,0,0.0,0.06,0.064)]),nv=18,nu=36,mod=lambda a,z:1+0.02*math.sin(4*a+z*25)+0.012*math.sin(z*70),cap=(False,False))
        sph(l,'pants',kn,0.076,(0,0,knp.z),(1,1,1.05))
        box(l,'rubber',kn,(0.105,0.05,0.125),(0,-0.075,knp.z+0.0),0.02,bw=4,rot=(0.12,0,0)); box(l,'canvas',kn,(0.118,0.012,0.022),(0,-0.062,knp.z+0.07),0.003); box(l,'canvas',kn,(0.118,0.012,0.022),(0,-0.062,knp.z-0.07),0.003)
        bolt(l,kn,(0.04,-0.103,knp.z),(math.radians(90),0,0)); bolt(l,kn,(-0.04,-0.103,knp.z),(math.radians(90),0,0))
        box(l,'canvas',hp,(0.04,0.085,0.13),(0.108,-0.012,hpp.z-0.2),0.012,rot=(0,0,0.0)); box(l,'canvas',hp,(0.045,0.09,0.035),(0.108,-0.012,hpp.z-0.14),0.01)   # cargo pocket
        loft(l,'canvas',hp,hpp.z-0.3,hpp.z-0.265,lambda t:(0,0,0.098,0.108),nv=3,nu=32,cap=(False,False),solid=0.008,bevel=0.002)   # thigh strap
        box(l,'metal',hp,(0.02,0.012,0.028),(0.0,-0.108,hpp.z-0.282),0.003)
        loft(l,'canvas',kn,anp.z+0.2,anp.z+0.23,lambda t:(0,0,0.074,0.079),nv=3,nu=32,cap=(False,False),solid=0.008,bevel=0.002)  # shin strap
        loft(l,'pants',an,anp.z+0.06,anp.z+0.14,lambda t:(0,0,0.068-0.0*t,0.074),nv=6,nu=32,cap=(False,False),mod=lambda a,z:1+0.04*math.sin(9*a),solid=0.01) # blousing over boot
    else:        # olive stamped armour leg
        l='legR'
        loft(l,'pants',hp,knp.z,hpp.z,lambda t:(0,0,0.075-0.006*t,0.082),nv=8,nu=28); loft(l,'pants',kn,anp.z+0.1,knp.z,lambda t:(0,0,0.062,0.066),nv=8,nu=28)
        top=hpp.z-0.01
        box(l,'olive',hp,(0.15,0.042,0.30),(-0.0,-0.098,top-0.19),0.014,bw=3,rot=(0.04,0,0)); box(l,'olive',hp,(0.14,0.04,0.12),(-0.0,-0.09,top-0.06),0.014,rot=(-0.1,0,0))
        box(l,'olive',hp,(0.04,0.15,0.30),(-0.095,0.0,top-0.2),0.012); box(l,'olive',hp,(0.04,0.15,0.25),(0.095,0.0,top-0.22),0.012)
        box(l,'olive',hp,(0.16,0.045,0.04),(0,0.099,top-0.1),0.01); box(l,'olive',hp,(0.14,0.04,0.22),(0,0.098,top-0.22),0.014)
        for (bx,by) in ((-0.06,-0.121),(0.06,-0.121),(-0.06,-0.121+0.0)):
            for bz2 in (top-0.06,top-0.2,top-0.31): bolt(l,hp,(bx,by,bz2),(math.radians(90),0,0))
        box(l,'rubber',hp,(0.13,0.02,0.02),(0,-0.123,top-0.12),0.003)
        # knee joint: rubber core, metal hinge caps, kneecap plate
        sph(l,'rubber',kn,0.07,(0,0,knp.z),(1,1,1.0),seg=24,rings=14)
        for dx in (-1,1): cyl(l,'metal',kn,0.062,0.062,0.018,(0.098*dx,0,knp.z),(0,math.radians(90),0),v=28,bevel=0.003); bolt(l,kn,(0.113*dx,0,knp.z),(0,math.radians(90),0),0.012,0.008); torus(l,'rubber',kn,0.05,0.007,(0.088*dx,0,knp.z),(0,math.radians(90),0))
        box(l,'olive',kn,(0.12,0.05,0.12),(0,-0.085,knp.z+0.012),0.024,bw=4,rot=(0.2,0,0)); box(l,'olive',kn,(0.1,0.03,0.045),(0,-0.108,knp.z-0.04),0.012,rot=(0.5,0,0))
        # shin greave + calf block + side plates + hydraulic hose
        box(l,'olive',kn,(0.125,0.04,0.28),(0,-0.082,knp.z-0.2),0.014,rot=(-0.04,0,0)); box(l,'olive',kn,(0.10,0.04,0.09),(0,-0.075,knp.z-0.38),0.012)
        box(l,'olive',kn,(0.04,0.14,0.24),(-0.09,0.01,knp.z-0.22),0.012); box(l,'olive',kn,(0.04,0.14,0.24),(0.09,0.01,knp.z-0.22),0.012)
        box(l,'olive',kn,(0.14,0.07,0.22),(0,0.075,knp.z-0.2),0.02,bw=4)
        for bz2 in (knp.z-0.1,knp.z-0.22,knp.z-0.33): bolt(l,kn,(0.045,-0.104,bz2),(math.radians(90),0,0)); bolt(l,kn,(-0.045,-0.104,bz2),(math.radians(90),0,0)); bolt(l,kn,(0.112,0.01,bz2),(0,math.radians(90),0),0.008)
        cyl(l,'rubber',kn,0.009,0.009,0.33,(-0.113,-0.03,knp.z-0.2),(0.05,0,0),v=8,bevel=0.001)
        box(l,'olive',an,(0.115,0.1,0.05),(0,-0.0,anp.z+0.06),0.012,bw=3); box(l,'metal',an,(0.12,0.03,0.016),(0,-0.052,anp.z+0.1),0.003)
    foot(s,an,anp)
SLOTS=['face','torso','armL','handL','armR','handR','legL','footL','legR','footR']
# merge objects per (slot,material,joint) to cut object count
for slot in SLOTS:
    groups={}
    for (o,mat,j) in SLOTOBJ[slot]: groups.setdefault((mat,j.name),[]).append(o)
    new=[]
    for (mat,jn),objs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]
        # clear parenting but keep transform before join (all share same joint/identity world at rest -> reparent after)
        for o in objs: 
            mw=o.matrix_world.copy(); o.parent=None; o.matrix_world=mw
        if len(objs)>1: bpy.ops.object.join()
        o=bpy.context.object; o.parent=J_ if False else bpy.data.objects[jn]; o.matrix_parent_inverse=o.parent.matrix_world.inverted(); new.append(o)
    SLOTOBJ[slot]=new
HS=1.14
for o in SLOTOBJ['face']:
    bm=bmesh.new(); bm.from_mesh(o.data); c=Vector((0,0.0,hb-0.02))
    mw=o.matrix_world.copy(); mi=mw.inverted()
    for v in bm.verts: v.co=mi@(c+((mw@v.co)-c)*HS)
    bm.to_mesh(o.data); bm.free()
ALLOBJ=[o for s in SLOTS for o in SLOTOBJ[s]]
if os.environ.get('NOALLSH'):
    for o in ALLOBJ: o.visible_shadow=False
bpy.context.view_layer.update()
print('build done',len(ALLOBJ),'objs',sum(len(o.data.polygons) for o in ALLOBJ),'polys',round(time.time()-T0,1),'s',flush=True)
# ===================== camera / lights =====================
cam=bpy.data.cameras.new('c'); cam.type='ORTHO'; cam.ortho_scale=2.65; cam.shift_y=(116-64)/128*1.0
co=bpy.data.objects.new('cam',cam); sc.collection.objects.link(co); co.rotation_euler=(math.radians(60),0,0); co.location=(0,-0.866*12,0.5*12); sc.camera=co
cam.clip_end=40
viewdir=co.matrix_world.to_quaternion()@Vector((0,0,-1))
def sun(name,e,rot,col,ang=10):
    d=bpy.data.lights.new(name,'SUN'); d.energy=e; d.color=col; d.angle=math.radians(ang); o=bpy.data.objects.new(name,d); sc.collection.objects.link(o); o.rotation_euler=[math.radians(x) for x in rot]
sun('key',5.0,(50,0,-38),(1.0,0.94,0.84),6); sun('fill',1.0,(70,0,140),(0.72,0.82,1.0),25); sun('rim',2.2,(125,0,170),(0.8,0.9,1.0),8)
w=bpy.data.worlds.new('w'); w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.40,0.43,0.46,1); w.node_tree.nodes['Background'].inputs[1].default_value=0.85; sc.world=w
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=SAMPLES; sc.cycles.use_denoising=True; sc.cycles.max_bounces=4; sc.cycles.diffuse_bounces=2; sc.cycles.glossy_bounces=2; sc.cycles.transmission_bounces=2; sc.cycles.transparent_max_bounces=2
sc.cycles.use_adaptive_sampling=True; sc.cycles.adaptive_threshold=0.02
sc.render.resolution_x=RES; sc.render.resolution_y=RES; sc.render.resolution_percentage=100; sc.render.film_transparent=True; sc.view_settings.view_transform='Standard'
sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGBA'; sc.render.threads=int(os.environ.get('THREADS','8'))
sc.render.use_persistent_data=not os.environ.get('NOPERSIST')
# ===================== poses (see poses.py: keyframe curves + overlap + IK feet + spring secondary motion) =====================
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from poses import Poser
from anim_spec import SPEC
P=Poser(root,body,hips,torsoP,headP,J)
bpy.context.view_layer.update()
def sm_(t): t=min(1,max(0,t)); return t*t*(3-2*t)
for o in SLOTOBJ['torso']:
    mn=o.active_material.name if o.active_material else ''
    if mn=='jacket': P.register(o,lambda x,y,z: sm_((1.38-z)/0.36),'jacket')
    elif mn in ('canvas','amber','glass'): P.register(o,lambda x,y,z: (0.8 if abs(x)>0.13 and y<0.12 else 0.0)*sm_((1.2-z)/0.16),'pouch')
for o in SLOTOBJ['face']:
    if o.active_material and o.active_material.name=='jacket': P.register(o,lambda x,y,z: sm_((y+0.02)/0.14)*sm_((hb+0.14-z)/0.2)+0.0,'hood')
elz=W(J['elL']).z
for o in SLOTOBJ['armL']:
    if o.active_material and o.active_material.name=='metal': P.register(o,lambda x,y,z: (math.sin(math.pi*min(1,max(0,(z-(elz-0.03))/0.15))) if abs(x-W(J['shL']).x)<0.014 and -0.085<y<-0.015 and elz-0.03<z<elz+0.12 else 0.0),'hose')
print('secondary targets',[(o.name,len(o.data.vertices)) for o,_,_,_ in P.targets],flush=True)
def centroid(slot):
    pts=[]
    for o in SLOTOBJ[slot]:
        for c in o.bound_box: pts.append(o.matrix_world@Vector(c))
    return sum(pts,Vector())/len(pts)
def slot_border(slot,m=0.03):
    xs=[];ys=[]
    for o in SLOTOBJ[slot]:
        for c in o.bound_box:
            v=world_to_camera_view(sc,co,o.matrix_world@Vector(c)); xs.append(v.x); ys.append(v.y)
    x0,x1,y0,y1=min(xs)-m,max(xs)+m,min(ys)-m,max(ys)+m
    if x1-x0<0.08: c=(x0+x1)/2; x0,x1=c-0.04,c+0.04
    if y1-y0<0.08: c=(y0+y1)/2; y0,y1=c-0.04,c+0.04
    return max(0,x0),min(1,x1),max(0,y0),min(1,y1)
DIRS=['S','SW','W','NW','N','NE','E','SE']
FACE={'S':(0,-1),'SW':(-1,-1),'W':(-1,0),'NW':(-1,1),'N':(0,1),'NE':(1,1),'E':(1,0),'SE':(1,-1)}
ALLA={k:v['n'] for k,v in SPEC.items()}
want=os.environ.get('ANIMS',','.join(ALLA)).split(',')
ANIMS={k:ALLA[k] for k in want}
dsel=os.environ.get('DIRS'); DSEL=dsel.split(',') if dsel else DIRS
fsel=os.environ.get('FRAMES'); FSEL=[int(x) for x in fsel.split(',')] if fsel else None
if TEST and not fsel: FSEL=[0,2]
os.makedirs(OUT,exist_ok=True)
ofile=OUT+'/order.json'; order=json.load(open(ofile))['order'] if os.path.exists(ofile) and os.environ.get('MERGE') else {}
LAYONLY=os.environ.get('SLOTS'); SLR=LAYONLY.split(',') if LAYONLY else SLOTS
cnt=0; T1=time.time()
for anim,n in ANIMS.items():
    order.setdefault(anim,[[None]*n for _ in DIRS])
    for d in DSEL:
        di=DIRS.index(d); fx,fy=FACE[d]; root.rotation_euler=(0,0,math.atan2(fy,fx)+math.pi/2)
        for f in range(n):
            if FSEL and f not in FSEL: continue
            P.set(anim,f); bpy.context.view_layer.update(); (None if os.environ.get('NODEFORM') else P.deform(anim,f))
            cs={s:centroid(s) for s in SLOTS}
            order[anim][di][f]=sorted(range(len(SLOTS)),key=lambda i:-cs[SLOTS[i]].dot(viewdir))
            if os.environ.get('PREVIEW'):
                for o in ALLOBJ: o.hide_render=False; o.visible_camera=True; o.visible_shadow=True
                sc.render.use_border=False; sc.render.filepath=f'{OUT}/{anim}/all/{d}_{f}.png'; bpy.ops.render.render(write_still=True); cnt+=1; continue
            for s in ([] if os.environ.get('ORDERONLY') else SLR):
                for o in ALLOBJ: o.hide_render=False; o.visible_camera=False; o.visible_shadow=False
                for o in SLOTOBJ[s]: o.visible_camera=True; o.visible_shadow=True
                b=slot_border(s); sc.render.use_border=True; sc.render.use_crop_to_border=False; sc.render.border_min_x,sc.render.border_max_x,sc.render.border_min_y,sc.render.border_max_y=b
                sc.render.filepath=f'{OUT}/{anim}/{s}/{d}_{f}.png'
                try: bpy.ops.render.render(write_still=True); cnt+=1
                except RuntimeError as e:
                    print('EMPTY layer',anim,d,f,s,b,flush=True); Image_empty=bpy.data.images.new('e',RES,RES,alpha=True); Image_empty.filepath_raw=sc.render.filepath; Image_empty.file_format='PNG'; Image_empty.save()
            print(anim,d,f,f'{cnt} renders {time.time()-T1:.0f}s',flush=True)
json.dump({'layers':SLOTS,'order':order},open(ofile,'w'))
print('DONE',cnt,'renders',round(time.time()-T1),'s',flush=True)

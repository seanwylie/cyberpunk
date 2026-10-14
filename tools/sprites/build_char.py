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
MOB=os.environ.get('MOB','')
def mk_mat(name,tex,tile=1.6,rough=1.0,metal=0.0,bump=0.5,bdist=0.004,wear=None,ao=0.55,grime=0.35,spec=0.4,tint=None,coat=0.0):
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
    gm=N.new('ShaderNodeMath'); gm.operation='MULTIPLY'; gm.inputs[1].default_value=min(1.0,grime*2.6); L.new(mr.outputs[0],gm.inputs[0])
    gg=N.new('ShaderNodeMath'); gg.operation='MULTIPLY'; L.new(gm.outputs[0],gg.inputs[0]); L.new(trg.outputs['Color'],gg.inputs[1])  # modulated by rough map noise
    col=mix(col,(0.07,0.065,0.055,1),gg.outputs[0])
    # edge wear from bevel node
    if wear:
        bv=N.new('ShaderNodeBevel'); bv.inputs['Radius'].default_value=0.02; bv.samples=6; gn=N.new('ShaderNodeNewGeometry')
        dt=N.new('ShaderNodeVectorMath'); dt.operation='DOT_PRODUCT'; L.new(bv.outputs[0],dt.inputs[0]); L.new(gn.outputs['Normal'],dt.inputs[1])
        mr2=N.new('ShaderNodeMapRange'); mr2.inputs[1].default_value=0.995; mr2.inputs[2].default_value=0.88; mr2.clamp=True; L.new(dt.outputs['Value'],mr2.inputs[0])
        nz=N.new('ShaderNodeMath'); nz.operation='MULTIPLY'; L.new(mr2.outputs[0],nz.inputs[0]); L.new(thg.outputs['Color'],nz.inputs[1]); nz.inputs[1].default_value=1.0
        nz2=N.new('ShaderNodeMath'); nz2.operation='MULTIPLY'; nz2.inputs[1].default_value=min(1.0,wear[1]*2.3); L.new(mr2.outputs[0],nz2.inputs[0])
        col=mix(col,wear[0],nz2.outputs[0])
    if tint: col=mix(col,tint,1.0,'MULTIPLY')
    L.new(col,b.inputs['Base Color']); b.inputs['Coat Weight'].default_value=coat; b.inputs['Coat Roughness'].default_value=0.12
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

SEX='m' if 'body_m' in os.environ.get('BODY','body_m') else 'f'
_sk={'':rgba('#9a8a82' if SEX=='m' else '#a89890'),'mob':rgba('#a88a7c'),'boss':rgba('#8a7a70')}[MOB]
M['skin']=mk_mat('skin','skin',tile=2.5,rough=1.15,bump=0.3,spec=0.2,tint=_sk,ao=0.45,grime=0.35)
_b=M['skin'].node_tree.nodes['Principled BSDF']; _b.inputs['Subsurface Weight'].default_value=0.05; _b.inputs['Subsurface Radius'].default_value=(0.8,0.4,0.3); _b.inputs['Specular IOR Level'].default_value=0.22; _b.inputs['Subsurface Scale'].default_value=0.012
M['hairX']=mk_mat('hair','cloth',tile=6,rough=0.55,bump=1.4,bdist=0.006,tint=rgba('#3a2a22') if not MOB else rgba('#5a5450'),ao=0.7,spec=0.6)
M['aug']=(mk_mat('aug','ivory',tile=1.4,rough=0.55,bump=0.7,spec=0.55,ao=0.7,grime=0.9,coat=0.15,tint=rgba('#cfc5ae'),wear=(rgba('#4a443c'),1.0)) if not MOB else mk_mat('aug','redsteel',tile=1.6,rough=0.8,metal=0.5,bump=1.0,ao=0.6,grime=0.5,wear=(rgba('#9a958a'),0.9),tint=rgba('#c8a8a0')))
_h=bpy.data.materials.new('hair'); _h.use_nodes=True; _hn=_h.node_tree.nodes; _hl=_h.node_tree.links; _hb=_hn['Principled BSDF']
_hb.inputs['Roughness'].default_value=0.6; _hb.inputs['Specular IOR Level'].default_value=0.25; _hb.inputs['Coat Weight'].default_value=0.0
_wv=_hn.new('ShaderNodeTexWave'); _wv.wave_type='BANDS'; _wv.bands_direction='X'; _wv.inputs['Scale'].default_value=90; _wv.inputs['Distortion'].default_value=6; _wv.inputs['Detail'].default_value=4
_tc=_hn.new('ShaderNodeTexCoord'); _hl.new(_tc.outputs['Object'],_wv.inputs['Vector']); _bp=_hn.new('ShaderNodeBump'); _bp.inputs['Strength'].default_value=0.6; _bp.inputs['Distance'].default_value=0.002
_hl.new(_wv.outputs['Fac'],_bp.inputs['Height']); _hl.new(_bp.outputs['Normal'],_hb.inputs['Normal'])
_mx=_hn.new('ShaderNodeMixRGB'); _mx.blend_type='MULTIPLY'; _mx.inputs[0].default_value=0.5; _mx.inputs[1].default_value=(0.03,0.022,0.017,1); _hl.new(_wv.outputs['Color'],_mx.inputs[2]); _hl.new(_mx.outputs[0],_hb.inputs['Base Color'])
M['hair']=_h
M['augd']=mk_mat('augd','slate' if not MOB else 'iron',tile=2.0,rough=0.5,metal=0.3,bump=0.4,ao=0.5)
M['lip']=mk_mat('lip','skin',tile=3.5,rough=0.8,bump=1.2,bdist=0.003,tint=rgba('#a8705c'),ao=0.5)
M['eye']=mk_mat('eye','glass',tile=2,rough=0.15,bump=0,spec=1.0,ao=0.1,tint=rgba('#3a3028'))
_g=bpy.data.materials.new('glow'); _g.use_nodes=True; _gb=_g.node_tree.nodes['Principled BSDF']; _gc=rgba('#ffa040') if MOB else rgba('#5fe8d8'); _gb.inputs['Base Color'].default_value=_gc; _gb.inputs['Emission Color'].default_value=_gc; _gb.inputs['Emission Strength'].default_value=0.0; _gb.inputs['Base Color'].default_value=(0.03,0.032,0.035,1); _gb.inputs['Roughness'].default_value=0.6; M['glow']=_g
if MOB:
    M['jacket']=mk_mat('jacket','jacket',tile=1.5,rough=1.0,wear=(rgba('#c0a080'),0.7),bump=0.9,tint=rgba('#b0a088'))

M['pants']=mk_mat('pants','pants',tile=1.8,rough=1.0,wear=(rgba('#8a8676'),0.8),bump=1.2,grime=0.8,ao=0.7,tint={'':rgba('#c8bea4'),'mob':rgba('#7a7468'),'boss':rgba('#6a6258')}[MOB])
M['cloth']=mk_mat('cloth','cloth',tile=2.4,rough=1.0,bump=1.2,grime=0.75,ao=0.7,wear=(rgba('#8a8270'),0.5),tint={'':rgba('#d8d2c0'),'mob':rgba('#a8a090'),'boss':rgba('#8a8070')}[MOB])
M['rubber']=mk_mat('rubber','rubber',tile=2.0,rough=1.0,wear=(rgba('#4a4a46'),0.5),bump=0.6)
# ===================== rig (empties as joints) =====================
def pivot(name,parent,loc):
    e=bpy.data.objects.new(name,None); sc.collection.objects.link(e); e.parent=parent; e.location=loc; return e
root=pivot('root',None,(0,0,0)); body=pivot('body',root,(0,0,0.9)); hips=pivot('hips',body,(0,0,0.06))
torsoP=pivot('torsoP',hips,(0,0,0.06)); headP=pivot('headP',torsoP,(0,0,0.62))
J={}
for s,sx in (('L',1),('R',-1)):
    J['sh'+s]=pivot('sh'+s,torsoP,(0.2*sx,0,0.55)); J['el'+s]=pivot('el'+s,J['sh'+s],(0,0,-0.29)); J['wr'+s]=pivot('wr'+s,J['el'+s],(0,0,-0.27))
    J['hp'+s]=pivot('hp'+s,hips,(0.115*sx,0,-0.02)); J['kn'+s]=pivot('kn'+s,J['hp'+s],(0,0,-0.43)); J['an'+s]=pivot('an'+s,J['kn'+s],(0,0,-0.42))
bpy.context.view_layer.update()
SLOTOBJ={}; NOSH=[]
XOFF=0.0
def finish(o,slot,mat,joint,bevel=0.0,bw=3,subsurf=0,solid=0.0,shade=True,noshadow=False):
    if XOFF: o.location.x+=XOFF; bpy.context.view_layer.update()
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
def ribbon(slot,mat,joint,pts,nrm,w,th,bevel=0.003,taper=0):
    """strip of width w and thickness th following points pts, pushed along unit normals nrm (outward)."""
    P=[Vector(p) for p in pts]; Nn=[Vector(n).normalized() for n in nrm]; V=[]
    for i,p in enumerate(P):
        tg=(P[min(i+1,len(P)-1)]-P[max(i-1,0)]).normalized(); sd=tg.cross(Nn[i]).normalized()
        wi=w*(1-taper*i/max(len(P)-1,1))
        for a,b in ((-1,0),(1,0),(1,1),(-1,1)): V.append(p+sd*wi/2*a+Nn[i]*th*b)
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
BW=1.12 if MOB=='mob' else 1.0
_TP=[(0.86,0.150,0.100),(0.98,0.150,0.098),(1.12,0.128,0.088),(1.26,0.150,0.098),(1.40,0.170,0.108),(1.50,0.182,0.100),(1.56,0.150,0.085),(1.62,0.070,0.065)]
def body_r(z):
    for (z0,a0,b0),(z1,a1,b1) in zip(_TP,_TP[1:]):
        if z0<=z<=z1: u=sm((z-z0)/(z1-z0)); return lerp(a0,a1,u)*BW,lerp(b0,b1,u)*BW
    return (_TP[0][1]*BW,_TP[0][2]*BW) if z<_TP[0][0] else (_TP[-1][1]*BW,_TP[-1][2]*BW)
import numpy as np
BD=np.load(os.environ.get('BODY',os.path.join(os.path.dirname(os.path.abspath(__file__)),'base','body_m.npz')))
BP=BD['P']; BWT=BD['W']; BF=[list(r[:n]) for r,n in zip(BD['F'],BD['flen'])]; BN=[str(x) for x in BD['names']]; BE=[str(x) for x in BD['bones']]
_dom=BWT.argmax(1); _tor=np.isin(_dom,[BN.index('pelvis'),BN.index('spine')])
def body_r(z):
    m=_tor&(np.abs(BP[:,2]-z)<0.025)&(np.abs(BP[:,0])<0.19)
    if m.sum()<5: return 0.15,0.1
    return np.abs(BP[m,0]).max(),np.abs(BP[m,1]).max()
def jr(z):  # clothing surface (shared by straps/belt/pouches)
    rx,ry=body_r(z); return rx+0.016,ry+0.016,0.0

def bmod(a,z):   # pecs / shoulder blades / ribcage
    return 1+0.05*max(0,-math.sin(a))*max(0,math.cos(2*a+math.pi))*sm((z-1.32)/0.06)*sm((1.5-z)/0.06)+0.03*max(0,math.sin(a))*sm((z-1.3)/0.1)
def armhole(x,y,z,side=0):
    return z>1.36 and abs(x)>0.12 and (side==0 or x*side>0)
if MOB=='':   # Precision-surgical owner: fitted tank top, scarf; the install shoulder is bare
    loft('torso','cloth',torsoP,1.46,1.64,prof_pts([(0,0,-0.01,0.12,0.1),(0.5,0,-0.005,0.1,0.09),(1,0,0,0.08,0.075)]),mod=lambda a,z:1+0.04*math.sin(6*a+z*30),solid=0.01,cap=(False,False))  # scarf
    # long scarf tail hanging over the left hip
    if SEX=='f':   # one diagonal sling strap, shoulder to opposite hip, instead of a bib harness
        pts=[];nr=[]
        for k in range(16):
            t=k/15; z=1.56-0.5*t; x=-0.1+0.24*t; rx,ry,_=jr(z); yy=-ry*math.sqrt(max(0,1-min(0.95,(x/rx)**2)))-0.006
            pts.append((x,yy,z)); nr.append((x/rx**2*0.4,-1,0.05))
        ribbon('torso','canvas',torsoP,pts,nr,0.036,0.01)
    # loose cloth sash tied at the right hip, hanging to mid-thigh
    loft('torso','cloth',torsoP,0.62,1.02,lambda t:(-0.15,-0.02,0.006,0.075*(0.6+0.4*t)),nv=16,nu=16,mod=lambda a,z:1+0.25*math.sin(z*40+a),subsurf=1,rot=(0,0.18,0))
    for (sx_,x0,L0,w0) in ((1,-0.17,0.42,0.045),(1,-0.13,0.33,0.03),(1,0.15,0.36,0.04),(1,0.19,0.27,0.028),(1,-0.02,0.30,0.05)):   # torn cloth strips hanging from the belt
        pts=[];nr=[]
        for k in range(10):
            t=k/9; z=1.0-L0*t; xx=x0+0.012*math.sin(t*5+x0*40); rr=jr(min(1.0,max(0.7,z)))[1]
            pts.append((xx,-rr-0.012-0.02*t,z)); nr.append((0,-1,0))
        ribbon('torso','cloth' if x0<0 else 'canvas',torsoP,pts,nr,w0,0.004,bevel=0,taper=0.3)
    for (x0,L0) in (((0.045,0.38),(0.075,0.30)) if SEX=='m' else ()):   # scarf tails over the chest
        pts=[];nr=[]
        for k in range(12):
            t=k/11; z=1.53-L0*t; xx=x0+0.02*t+0.008*math.sin(t*6); 
            pts.append((xx,-jr(max(1.0,z))[1]-0.025-0.01*t,z)); nr.append((0,-1,0.1))
        ribbon('torso','cloth',torsoP,pts,nr,0.055,0.005,bevel=0,taper=0.25)
    loft('torso','cloth',torsoP,1.0,1.5,lambda t:(0.07,-body_r(1.0+0.5*t)[1]-0.02,0.04+0.01*t,0.008),nv=14,nu=12,mod=lambda a,z:1+0.1*math.sin(z*30),subsurf=1)
else:          # labourer: worn tee + open sleeveless work vest, right side cut away around the install
    loft('torso','cloth',torsoP,1.0,1.58,lambda t:(0,0,body_r(1.0+0.58*t)[0]+0.016,body_r(1.0+0.58*t)[1]+0.018),nv=34,nu=56,cap=(False,False),solid=0.006,
         mod=lambda a,z:1+0.015*math.sin(9*a+z*40),delete=lambda x,y,z:(z>1.5 and y<-0.02 and abs(x)<0.07) or (x<-0.14 and z>1.38))
    loft('torso','jacket',torsoP,0.94,1.6,lambda t:(0,0.004,jr(0.94+0.66*t)[0]+0.012,jr(0.94+0.66*t)[1]+0.012),nv=40,nu=56,cap=(False,False),solid=0.016,
         mod=lambda a,z:1+0.025*math.sin(7*a+1.4*math.sin(z*8))+0.008*math.sin(z*55+a*2),delete=lambda x,y,z:(y<-0.02 and abs(x)<0.06+0.05*(z-0.94)) or (abs(x)>0.15 and z>1.38))
    loft('torso','cloth',torsoP,1.5,1.68,prof_pts([(0,0,-0.012,0.115,0.1),(0.5,0,-0.005,0.095,0.088),(1,0,0,0.078,0.075)]),mod=lambda a,z:1+0.035*math.sin(6*a+z*30))  # neck rag
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
    (ribbon('torso','canvas',torsoP,pts,nr,0.042,0.013) if SEX=='m' else None)
    pts=[];nr=[]
    for k in range(14):
        t=k/13; z=1.64-0.60*t; rx,ry,_=jr(z); x=0.12*sx; yy=ry*math.sqrt(max(0,1-(x/rx)**2))+0.004
        pts.append((x,yy,z)); nr.append((x/rx**2*0.4,1,0.05))
    (ribbon('torso','canvas',torsoP,pts,nr,0.042,0.013) if SEX=='m' else None)
    (box('torso','metal',torsoP,(0.034,0.008,0.024),(0.116*sx,-0.145,1.30),0.002) if SEX=='m' else None)  # strap buckle
    # front belt pouches + vials
    px=0.168*sx; py=-jr(1.02)[1]*0.92
    box('torso','canvas',torsoP,(0.085,0.06,0.115),(px,py-0.02,1.0),0.012,rot=(0,0,-0.35*sx)); box('torso','canvas',torsoP,(0.09,0.066,0.035),(px-0.005*sx,py-0.036,1.06),0.01,rot=(0.1,0,-0.35*sx))
    box('torso','metal',torsoP,(0.016,0.01,0.016),(px-0.01*sx,py-0.074,1.045),0.003)
    for k in range(4):
        a=-0.35*sx; cxv=px+(0.032*(k-1.5))*math.cos(a)*1; cyv=py-0.07+0.032*(k-1.5)*math.sin(a)*-sx*0
        cyl('torso','amber' if k%2==0 else 'glass',torsoP,0.0155,0.0155,0.095,(px+0.027*(k-1.5)*math.cos(a)*1,py-0.062-0.027*(k-1.5)*math.sin(a)*0-0.0*k,1.12),v=12,bevel=0.003)
        cyl('torso','metal',torsoP,0.0165,0.0165,0.016,(px+0.027*(k-1.5)*math.cos(a),py-0.062,1.172),v=12,bevel=0.002)
    # shoulder epaulette strap + patch tab
    pass
box('torso','canvas',torsoP,(0.15,0.015,0.17),(0,jr(1.4)[1]+0.012,1.42),0.006); box('torso','rubber',torsoP,(0.11,0.017,0.12),(0,jr(1.4)[1]+0.016,1.42),0.004)  # back patch
box('torso','canvas',torsoP,(0.21,0.07,0.095),(0,jr(1.05)[1]+0.04,1.06),0.014); box('torso','canvas',torsoP,(0.22,0.075,0.03),(0,jr(1.05)[1]+0.04,1.115),0.01)  # back pouch
# rear hip tool: wrench
cyl('torso','metal',torsoP,0.008,0.008,0.2,(-0.2,0.02,0.98),(0.15,0,0.1),v=10); sph('torso','metal',torsoP,0.02,(-0.205,0.015,1.085),(1,0.5,1)); cyl('torso','rubber',torsoP,0.011,0.011,0.07,(-0.196,0.03,0.9),(0.15,0,0.1),v=10)
XOFF=0.0
# ===================== HEAD (slot 'face') =====================
hb=W(headP).z  # 1.64
def headprof(t):  # t: chin..crown
    z=t
    rx=0.058+0.034*math.sin(min(1,t/0.45)*math.pi/2)**0.7 if t<0.45 else 0.092*math.sqrt(max(0.0,1-((t-0.45)/0.55)**2.2))+0.0
    ry=rx*1.12; cy=0.006+0.006*t
    if t<0.18: rx*=0.84+0.16*(t/0.18)  # chin
    return (0,cy,max(rx,0.003),max(ry,0.003))

def hp_(z):
    t=(z-hb)/0.205; return headprof(min(1,max(0,t)))
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
    shp,elp,wrp=W(sh),W(el),W(wr); XOFF=shp.x
    if MOB=='mob' and s=='L': loft('arm'+s,'cloth',sh,shp.z-0.12,shp.z+0.03,lambda t:(-0.01*sx,0,0.078,0.074),nv=8,nu=32,cap=(False,False),solid=0.006,mod=lambda a,z:1+0.04*math.sin(5*a))
    if (s=='L' and MOB=='') or (s=='R' and MOB) or MOB=='boss':
        a='arm'+s; K=1.0 if MOB=='' else 1.35
        # skin upper arm under sleeve, then synthetic sleeve grafted mid-bicep with a glowing seam
        loft(a,'lip',sh,shp.z-0.262,shp.z-0.245,lambda t:(0,0,0.052*K,0.05*K),nv=3,nu=40,cap=(False,False),mod=lambda a2,z:1+0.05*math.sin(9*a2))   # healed scar tissue at the interface
        loft(a,'rubber',sh,shp.z-0.258,shp.z-0.248,lambda t:(0,0,0.0525*K,0.0505*K),nv=2,nu=48,cap=(False,False),solid=0.004)   # gasket
        for ang in range(20,360,72): cyl(a,'metal',sh,0.0045,0.0045,0.006,(0.052*math.cos(math.radians(ang)),0.05*math.sin(math.radians(ang)),shp.z-0.268),(0,math.radians(90),math.radians(ang)),v=8,bevel=0.0008)
        loft(a,'glow',sh,shp.z-0.255,shp.z-0.24,lambda t:(0,0,0.0505*K,0.0485*K),nv=2,nu=40,cap=(False,False),mod=lambda a2,z:1+0.08*math.sin(3*a2))
        loft(a,'aug',sh,elp.z+0.0,shp.z-0.245,prof_pts([(0,0,0,0.044*K,0.044*K),(0.5,0,-0.004,0.054*K,0.05*K),(1,0,0,0.052*K,0.05*K)]),nv=18,nu=40,mod=lambda a2,z:1+0.04*math.sin(2*a2+0.5)*(z>elp.z+0.03)+0.03*(abs(math.sin(a2*3))>0.97)*0,subsurf=1,cap=(False,False))
        sph(a,'augd',el,0.042*K,(0,0,elp.z),seg=28,rings=18)
        # forearm: one flowing shell, swelling like a muscle and tapering to the wrist; panel seam rings + recessed underside
        loft(a,'aug',el,wrp.z+0.02,elp.z-0.02,prof_pts([(0,0,0,0.034*K,0.032*K),(0.35,0,-0.004,0.042*K,0.04*K),(0.75,0,-0.006,0.053*K,0.05*K),(1,0,0,0.046*K,0.045*K)]),nv=28,nu=48,
             mod=lambda a2,z:1+0.06*max(0,math.cos(a2+0.6))-0.05*max(0,math.cos(a2-2.0)),subsurf=1,cap=(False,False))
        for zz in (elp.z-0.09,wrp.z+0.07): loft(a,'augd',el,zz-0.003,zz+0.003,lambda t,zz=zz:(0,0,0.049*K if zz>wrp.z+0.1 else 0.041*K,0.047*K if zz>wrp.z+0.1 else 0.039*K),nv=2,nu=48,cap=(False,False),mod=lambda a2,z:1+0.06*max(0,math.cos(a2+0.6)))
        loft(a,'glow',el,wrp.z+0.08,elp.z-0.08,lambda t:(0,-0.04*K,0.004,0.004),nv=10,nu=8,mod=lambda a2,z:1,subsurf=0)   # light line along forearm ridge
        loft(a,'augd',wr,wrp.z-0.01,wrp.z+0.025,lambda t:(0,0,0.033*K,0.031*K),nv=4,nu=32,subsurf=1)
        if not (MOB=='boss' and s=='R'): fingers('hand'+s,'aug',wr,(0,0,wrp.z-0.052),sx,1.0)
        if MOB=='':
            loft(a,'augd',el,elp.z-0.17,elp.z-0.06,lambda t:(0,0,0.0505,0.0485),nv=6,nu=48,cap=(False,False),delete=lambda x,y,z:not (y<-0.02 and x*sx>-0.01),mod=lambda a2,z:1+0.06*max(0,math.cos(a2+0.6)))   # slate marking
            loft(a,'augd',sh,shp.z-0.33,shp.z-0.26,lambda t:(0,0,0.056,0.052),nv=4,nu=48,cap=(False,False),delete=lambda x,y,z:not (x*sx>0.02))
        if MOB:  # hydraulic tendons following the forearm
            for k in (-1,1): cyl(a,'metal',el,0.007,0.007,0.2,(0.045*k,0.035,elp.z-0.13),(0.08,0,0),v=10,bevel=0.0015)
            for k in range(4): torus(a,'rubber',el,0.05*K,0.009,(0,0,elp.z-0.035-0.014*k))          # rubber bellows at elbow
            for zz in (elp.z-0.09,wrp.z+0.07):
                for ang in range(0,360,60): bolt(a,el,(0.052*K*math.cos(math.radians(ang)),0.05*K*math.sin(math.radians(ang)),zz),(0,math.radians(90),math.radians(ang)),0.008,0.008)
            if MOB=='boss' and s=='R':   # mounted saw: hub + guard bolted to the forearm, replaces the hand
                cyl('hand'+s,'augd',wr,0.05,0.05,0.07,(0,0,wrp.z-0.03),(0,math.radians(90),0),v=24,bevel=0.004)
                cyl(a,'metal',wr,0.21,0.21,0.008,(0,0,wrp.z-0.03),(0,math.radians(90),0),v=64,bevel=0.002)
                for k in range(24): box(a,'metal',wr,(0.006,0.03,0.022),(0.0,0.215*math.cos(k*math.pi/12),wrp.z-0.03+0.215*math.sin(k*math.pi/12)),0.001,rot=(k*math.pi/12+0.5,0,0))
                pass
    else:        # bare forearm w/ wrap, jacket sleeve above
        a='arm'+s
        loft(a,'canvas',wr,wrp.z-0.02,wrp.z+0.085,lambda t:(0,0,0.043-0.005*t,0.04-0.005*t),nv=10,nu=28,cap=(False,False),solid=0.01,mod=lambda a2,z:1+0.025*math.sin(z*160),bevel=0.002)
        box(a,'metal',wr,(0.025,0.012,0.03),(0.0,-0.042,wrp.z+0.045),0.003)
# ===================== LEGS / FEET =====================
def foot(s,an,anp):
    f='foot'+s; ox=anp.x
    loft(f,'boot',an,anp.z-0.02,anp.z+0.19,prof_pts([(0,ox,0.01,0.052,0.062),(0.5,ox,0.0,0.05,0.058),(1,ox,0.0,0.056,0.062)]),nv=12,nu=32,mod=lambda a,z:1+0.02*math.sin(7*a+z*40),subsurf=1)
    pr=prof_pts([(0,0,0.03,0.048,0.05),(0.35,0,0.028,0.054,0.048),(0.75,0,0.02,0.052,0.036),(1,0,0.012,0.04,0.022)])
    loft(f,'boot',an,0,0.27,pr,nv=16,nu=28,origin=(ox,anp.y+0.07,anp.z-0.04),rot=(math.radians(90),0,0),subsurf=1)
    loft(f,'rubber',an,0,0.285,lambda t:(0,0.0,0.055 if t<0.8 else 0.055-0.1*(t-0.8),0.016),nv=8,nu=28,origin=(ox,anp.y+0.075,anp.z-0.075),rot=(math.radians(90),0,0),subsurf=1)   # sole
    for k in range(4): box(f,'canvas',an,(0.06,0.008,0.006),(ox,anp.y-0.06,anp.z+0.04+k*0.03),0.002,rot=(0.25,0,0.4*(1 if k%2 else -1)),bw=2)   # laces
for s,sx in (('L',1),('R',-1)):
    hp,kn,an=J['hp'+s],J['kn'+s],J['an'+s]; hpp,knp,anp=W(hp),W(kn),W(an); XOFF=hpp.x
    if True:   # soot cargo trousers + knee pad
        l='leg'+s
        box(l,'rubber',kn,(0.105,0.05,0.125),(0,-0.075,knp.z+0.0),0.02,bw=4,rot=(0.12,0,0)); box(l,'canvas',kn,(0.118,0.012,0.022),(0,-0.062,knp.z+0.07),0.003); box(l,'canvas',kn,(0.118,0.012,0.022),(0,-0.062,knp.z-0.07),0.003)
        bolt(l,kn,(0.04,-0.103,knp.z),(math.radians(90),0,0)); bolt(l,kn,(-0.04,-0.103,knp.z),(math.radians(90),0,0))
        box(l,'canvas',hp,(0.04,0.085,0.13),(0.06*sx,-0.012,hpp.z-0.2),0.012,rot=(0,0,0.0)); box(l,'canvas',hp,(0.045,0.09,0.035),(0.06*sx,-0.012,hpp.z-0.14),0.01)   # cargo pocket
        loft(l,'canvas',hp,hpp.z-0.3,hpp.z-0.265,lambda t:(0,0,0.098,0.108),nv=3,nu=32,cap=(False,False),solid=0.008,bevel=0.002)   # thigh strap
        box(l,'metal',hp,(0.02,0.012,0.028),(0.0,-0.108,hpp.z-0.282),0.003)
        loft(l,'canvas',kn,anp.z+0.2,anp.z+0.23,lambda t:(0,0,0.074,0.079),nv=3,nu=32,cap=(False,False),solid=0.008,bevel=0.002)  # shin strap
        loft(l,'pants',an,anp.z+0.13,anp.z+0.23,lambda t:(0,0,0.068-0.008*t,0.074-0.008*t),nv=6,nu=32,cap=(False,False),mod=lambda a,z:1+0.05*math.sin(9*a),solid=0.01) # blousing over boot
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
    if MOB=='boss':
        loft(l,'aug',kn,anp.z+0.05,knp.z-0.02,prof_pts([(0,0,0,0.05,0.05),(0.6,0,-0.01,0.07,0.072),(1,0,0,0.062,0.065)]),nv=16,nu=36,subsurf=1)
        for k in (-1,1): cyl(l,'metal',kn,0.012,0.012,0.3,(0.05*k,0.06,knp.z-0.19),(0.1,0,0),v=10,bevel=0.002)
        sph(l,'augd',kn,0.07,(0,0,knp.z),(1,1,1))
    XOFF=0.0; foot(s,an,anp)
if MOB=='mob': root.scale=(1.04,1.04,1.03)
if MOB=='boss': root.scale=(1.25,1.25,1.2)
SLOTS=['face','torso','armL','handL','armR','handR','legL','footL','legR','footR']
VARIANT=os.environ.get('VARIANT')
if VARIANT:   # alternate full-body meshes on the same rig (see variants.py); VSLOTS limits which slots are replaced
    exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'variants.py')).read())
    apply_variant(VARIANT,os.environ.get('VSLOTS',','.join(SLOTS)).split(','))
# merge objects per (slot,material,joint) to cut object count
for slot in SLOTS:
    groups={}
    for (o,mat,j) in SLOTOBJ.get(slot,[]): groups.setdefault((mat,j.name),[]).append(o)
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
HS=1.0
for o in SLOTOBJ['face']:
    bm=bmesh.new(); bm.from_mesh(o.data); c=Vector((0,0.0,hb-0.02))
    mw=o.matrix_world.copy(); mi=mw.inverted()
    for v in bm.verts: v.co=mi@(c+((mw@v.co)-c)*HS)
    bm.to_mesh(o.data); bm.free()

# ===================== SCULPTED BASE BODY (MakeHuman CC0 hm08, fitted + skinned to our joints) =====================
EMP={'hips':hips,'torsoP':torsoP,'headP':headP}; EMP.update(J)
bpy.context.view_layer.update()
REST={k:e.matrix_world.copy() for k,e in EMP.items()}
_tm=bpy.data.meshes.new('tmp'); _tm.from_pydata(BP.tolist(),[],BF); _tm.update()
BNRM=np.array([v.normal[:] for v in _tm.vertices])
SLOTOF={'pelvis':'torso','spine':'torso','head':'face','uarmL':'armL','farmL':'armL','handL':'handL','uarmR':'armR','farmR':'armR','handR':'handR','thighL':'legL','shinL':'legL','footL':'footL','thighR':'legR','shinR':'legR','footR':'footR'}
fb=[]; fz=[]; fy=[]; fx=[]
for f in BF:
    w=BWT[f].sum(0); fb.append(BN[int(w.argmax())]); c=BP[f].mean(0); fx.append(c[0]); fy.append(c[1]); fz.append(c[2])
shz=W(J['shL']).z; HT=BP[:,2].max()
LM=BD['LM']; EYL,EYR,MOU,HTOP=LM[0],LM[1],LM[2],LM[3]
AUG_L=os.environ.get('AUGL','1')=='1'
groups={}   # (slot,mat,offset) -> face idx list
FTG=BD['FT']
BP=BP.copy()
for E in (EYL,EYR):
    _dx=BP[:,0]-E[0]; _dz=BP[:,2]-E[2]; _fr=(BP[:,1]<E[1]-0.005)
    up=np.exp(-(_dx/0.017)**4-((_dz-0.008)/0.006)**2)*_fr; dn=np.exp(-(_dx/0.016)**4-((_dz+0.007)/0.005)**2)*_fr
    BP[:,2]+=0.0048*up-0.0022*dn
for i,(b,x,y,z) in enumerate(zip(fb,fx,fy,fz)):
    slot=SLOTOF[b]
    if FTG[i]==1: groups.setdefault(('face','eyeball',0.0),[]).append(i); continue
    if AUG_L and (b in ('farmL','handL') or (b=='uarmL' and z<shz-0.24)): continue        # replaced by the Precision Surgical arm
    if z<0.27 and b in ('footL','footR','shinL','shinR'): continue                         # inside boots
    if SEX=='m': shirt=(b in ('spine','pelvis') and 0.98<z<1.585 and not (y<-0.04 and z>1.5 and abs(x)<0.07) and not (AUG_L and x>0.12 and z>1.4)) or (b=='uarmR' and z>shz-0.15)
    else: shirt=(b in ('spine','pelvis') and 0.98<z<1.585 and not (y<-0.02 and z>1.41+0.9*max(0,abs(x)-0.05)**1.0 and abs(x)<0.088) and not (abs(x)>0.112 and z>1.39) and not (y>0.03 and z>1.47 and abs(x)<0.07))
    pants=(b=='pelvis' and z<=1.0) or b in ('thighL','thighR') or (b in ('shinL','shinR') and z>=0.27)
    hair=b=='head' and z>EYL[2]-0.12
    if shirt: groups.setdefault((slot,'cloth' if SEX=='m' else 'tank',0.009),[]).append(i)
    elif pants: groups.setdefault((slot,'pants',0.013 if SEX=='m' else 0.008),[]).append(i)
    else: groups.setdefault((slot,'skinp',0.0),[]).append(i)
    if hair: groups.setdefault((slot,'hair',0.009 if SEX=='m' else 0.012),[]).append(i)
SKINNED=[]
def _paintmat(base,name):
    m=base.copy(); m.name=name; nt=m.node_tree; b=nt.nodes['Principled BSDF']; lk=b.inputs['Base Color'].links[0]; src=lk.from_socket
    at=nt.nodes.new('ShaderNodeAttribute'); at.attribute_name='paint'; mx=nt.nodes.new('ShaderNodeMixRGB'); mx.blend_type='MULTIPLY'; mx.inputs[0].default_value=1.0
    nt.links.new(src,mx.inputs[1]); nt.links.new(at.outputs['Color'],mx.inputs[2]); nt.links.new(mx.outputs[0],b.inputs['Base Color']); return m
M['tank']=mk_mat('tank','canvas',tile=2.4,rough=1.0,bump=1.0,grime=0.7,ao=0.6,wear=(rgba('#5a5448'),0.6),tint=rgba('#e2dccb'))
M['skinp']=_paintmat(M['skin'],'skinp')
def _facefeatures(m):
    nt=m.node_tree; N=nt.nodes; L=nt.links; b=N['Principled BSDF']; src=b.inputs['Base Color'].links[0].from_socket
    ra=N.new('ShaderNodeAttribute'); ra.attribute_name='rest'; sp=N.new('ShaderNodeSeparateXYZ'); L.new(ra.outputs['Vector'],sp.inputs[0])
    def mth(op,a,bv=None):
        n=N.new('ShaderNodeMath'); n.operation=op
        for k,v in enumerate((a,bv)):
            if v is None: continue
            if isinstance(v,(int,float)): n.inputs[k].default_value=v
            else: L.new(v,n.inputs[k])
        return n.outputs[0]
    X,Y,Z=sp.outputs['X'],sp.outputs['Y'],sp.outputs['Z']
    front=mth('LESS_THAN',Y,float(EYL[1]+0.035))
    def ell(cx,cz,sx,sz,px=2,ax=None):
        dx=mth('DIVIDE',mth('SUBTRACT',X if ax is None else ax,cx),sx); dz=mth('DIVIDE',mth('SUBTRACT',Z,cz),sz)
        d=mth('ADD',mth('POWER',mth('ABSOLUTE',dx),float(px)),mth('MULTIPLY',dz,dz))
        return mth('MULTIPLY',mth('EXPONENT',mth('MULTIPLY',d,-1.0)),front)
    def mixc(c,col,fac,mode='MIX'):
        n=N.new('ShaderNodeMixRGB'); n.blend_type=mode; L.new(fac,n.inputs[0]); L.new(c,n.inputs[1]); n.inputs[2].default_value=col; return n.outputs[0]
    c=src; hc=(0.05,0.035,0.028,1)
    for E in (EYL,EYR):
        sg=1 if E[0]>0 else -1
        bt=0.0095 if SEX=='m' else 0.0065
        b1=ell(float(E[0]-sg*0.006),float(E[2]+0.029),0.016,bt,4); b2=ell(float(E[0]+sg*0.014),float(E[2]+0.027),0.014,bt*0.85,4)
        br=mth('MINIMUM',mth('ADD',b1,b2),1.0); c=mixc(c,(0.025,0.018,0.014,1),mth('MULTIPLY',br,0.97))
        ls=ell(float(E[0]),float(E[2]+0.0105),0.019,0.0035 if SEX=='m' else 0.0045,4); c=mixc(c,(0.015,0.01,0.008,1),mth('MULTIPLY',ls,0.95))
        lw=ell(float(E[0]),float(E[2]-0.006),0.014,0.0018,4); c=mixc(c,(0.3,0.22,0.2,1),mth('MULTIPLY',lw,0.15))
    lp=ell(float(MS[0]),float(MS[2]),0.022 if SEX=='m' else 0.024,0.007 if SEX=='m' else 0.0095,4); c=mixc(c,(0.36,0.11,0.10,1) if SEX=='f' else (0.34,0.15,0.13,1),mth('MULTIPLY',lp,1.0))
    ml=ell(float(MS[0]),float(MS[2]-0.0005),0.019,0.0015,4); c=mixc(c,(0.08,0.04,0.035,1),mth('MULTIPLY',ml,0.8))
    L.new(c,b.inputs['Base Color'])
_e=bpy.data.materials.new('eyeball'); _e.use_nodes=True; _eb=_e.node_tree.nodes['Principled BSDF']; _ea=_e.node_tree.nodes.new('ShaderNodeAttribute'); _ea.attribute_name='paint'
_e.node_tree.links.new(_ea.outputs['Color'],_eb.inputs['Base Color']); _eb.inputs['Roughness'].default_value=0.12; _eb.inputs['Coat Weight'].default_value=1.0; M['eyeball']=_e
LM=BD['LM']; EYL,EYR,MOU,HTOP=LM[0],LM[1],LM[2],LM[3]
_hm=np.array([BN[int(BWT[v].argmax())]=='head' for v in range(len(BP))])
_mc=np.where(_hm&(np.abs(BP[:,0])<0.008)&(np.abs(BP[:,2]-MOU[2])<0.012))[0]; MS=np.array([0.0,-0.18,EYL[2]-0.089])
HAIRC=np.array([0.16,0.12,0.10])
_facefeatures(M['skinp'])
def paint_skin(X):
    c=np.tile([0.88,0.95,1.04],(len(X),1)); x,y,z=X[:,0],X[:,1],X[:,2]; front=y<EYL[1]+0.03; head=z>EYL[2]-0.16
    c[~head]*=np.array([0.86,0.93,1.02])
    for E in (EYL,EYR):
        dx=x-E[0]; dz=z-E[2]
        sock=np.exp(-((dx/0.028)**2+(dz/0.02)**2))*front; c*=1-0.18*sock[:,None]*np.array([1.0,0.95,0.9])
        
        arch=0.024+0.005*np.cos(dx/0.03*1.6)
        brow=np.exp(-((dx+np.sign(E[0])*0.004)/0.026)**4-((dz-arch)/(0.008 if SEX=='m' else 0.0058))**2)*front
        pass
        chk=np.exp(-((dx-np.sign(E[0])*0.012)/0.03)**2-((dz+0.035)/0.025)**2)*front; c*=1+chk[:,None]*np.array([0.06,-0.03,-0.04])
    dx=x-MS[0]; dz=z-MS[2]
    lip=np.exp(-(dx/(0.024 if SEX=='m' else 0.026))**4-((dz)/(0.0085 if SEX=='m' else 0.011))**2)*front
    c*=1-lip[:,None]*(np.array([0.25,0.5,0.5]) if SEX=='f' else np.array([0.2,0.38,0.38]))
    
    nose=np.exp(-((x)/0.012)**2-((z-(EYL[2]+MS[2])/2+0.004)/0.012)**2)*front; c*=1+nose[:,None]*np.array([0.05,-0.02,-0.03])
    if SEX=='m':   # stubble on jaw/chin/upper lip
        st=front&(z<MS[2]+0.016)&(z>EYL[2]-0.15)&(np.abs(x)<0.075)
        n=0.85+0.15*np.sin(x*900)*np.sin(z*1100)
        c[st]*=(np.array([0.74,0.73,0.76])*n[st,None])*(1-lip[st,None])+lip[st,None]
    return np.clip(c,0,1.4)
def paint_eye(X):
    c=np.zeros((len(X),3))
    for E in (EYL,EYR):
        m=np.sign(X[:,0])==np.sign(E[0]); v=X[m]-E; d=-v[:,1]/np.maximum(np.linalg.norm(v,axis=1),1e-6)
        col=np.tile([0.92,0.9,0.85],(m.sum(),1)); col[d>0.82]=[0.30,0.20,0.11]; col[d>0.95]=[0.02,0.02,0.02]; c[m]=col
    return c
def hair_mask(X):
    x,y,z=X[:,0],X[:,1],X[:,2]; ez=EYL[2]
    t=np.clip((y+0.15)/0.22,0,1); t=t*t*(3-2*t)
    zt=ez+(0.072 if SEX=='m' else 0.066)-(0.15 if SEX=='m' else 0.175)*t
    ear=(np.abs(x)>0.078)&(z<ez+0.035)&(y<0.035)
    u=np.clip((z-zt)/0.012,0,1); m=u*u*(3-2*u); m[ear]=0
    return m
def loose(R,mat,b_):
    x,y,z=R[:,0],R[:,1],R[:,2]
    if mat in ('cloth','tank'): return 0.008*(z<1.08)*np.clip((1.08-z)/0.08,0,1)+0.012*(x<-0.14)*np.clip((x*-1-0.14)/0.06,0,1)
    if mat=='pants': return 0.012*np.clip((0.45-z)/0.15,0,1)*(z<0.45) if SEX=='m' else 0*z
    return 0*z
def fold(R,mat):
    x,y,z=R[:,0],R[:,1],R[:,2]
    if mat=='pants': return 0.0045*np.sin(z*95+7*np.sin(x*45+y*30))*(0.4+0.6*(np.abs(z-0.5)<0.08)+0.8*(z<0.4))
    if mat in ('cloth','tank'): return 0.003*np.sin(z*75+x*28+5*np.sin(y*40))*(0.5+1.0*(z<1.18))
    return 0*z
EYEV=[]
for (slot,mat,off),fl in groups.items():
    vs=sorted(set(v for i in fl for v in BF[i])); rm={o:n for n,o in enumerate(vs)}
    R=BP[vs]+BNRM[vs]*(off+(fold(BP[vs],mat)+loose(BP[vs],mat,None) if off>0 else 0))[:,None] if off>0 else BP[vs].copy()
    if mat in ('cloth','tank'): R[:,2]-=0.012*np.clip((1.06-BP[vs][:,2])/0.06,0,1)   # hem hangs lower
    if mat=='hair':
        hm=hair_mask(BP[vs]); fl=[i for i in fl if hm[[rm[v] for v in BF[i]]].max()>0.05]
        vs=sorted(set(v for i in fl for v in BF[i])); rm={o:n for n,o in enumerate(vs)}; hm=hair_mask(BP[vs])
        top=np.clip((BP[vs][:,2]-(EYL[2]+0.05))/0.08,0,1)
        hof=(0.007 if SEX=='m' else 0.010)+(0.004 if SEX=='f' else 0.002)*top
        R=BP[vs]+BNRM[vs]*(hof*hm-0.009*(1-hm)+0.0025*hm*np.abs(np.sin(BP[vs][:,0]*150+BP[vs][:,2]*40+np.sin(BP[vs][:,1]*90)*2)))[:,None]
    if mat=='eyeball': EYEV.append(BP[vs]); continue
    if mat=='eyeball':
        Ec=np.where((R[:,0]>0)[:,None],EYL,EYR); R=Ec+(R-Ec)*1.22+np.array([0,-0.004,0])
    me=bpy.data.meshes.new(slot+mat); me.from_pydata(R.tolist(),[],[[rm[v] for v in BF[i]] for i in fl]); me.update()
    o=bpy.data.objects.new(slot+mat,me); sc.collection.objects.link(o); o.data.materials.append(M[mat])
    for p in me.polygons: p.use_smooth=True
    if mat in ('skinp','eyeball'):
        ca=me.color_attributes.new('paint','FLOAT_COLOR','POINT'); col=paint_skin(BP[vs]) if mat=='skinp' else paint_eye(BP[vs])
        ca.data.foreach_set('color',np.c_[col,np.ones(len(col))].ravel())
        ra=me.attributes.new('rest','FLOAT_VECTOR','POINT'); ra.data.foreach_set('vector',BP[vs].ravel())
    sm_=o.modifiers.new('ss','SUBSURF'); sm_.levels=1; sm_.render_levels=1
    if off>0 and mat not in ('eyeball','hair'): so=o.modifiers.new('so','SOLIDIFY'); so.thickness=0.004; so.offset=1
    SLOTOBJ[slot].append(o); SKINNED.append((o,np.c_[R,np.ones(len(R))],BWT[vs]))
if SEX=='f': sph('face','hair',headP,0.05,(0,0.09,HT-0.07),(1,0.9,0.85)); _bun=bpy.context.object; _bun.parent=headP; _bun.matrix_parent_inverse=headP.matrix_world.inverted(); SLOTOBJ['face'].append(_bun)
import random
random.seed(7)
_hv=np.where(_hm)[0]; _mk=hair_mask(BP[_hv]); _cand=_hv[_mk>0.9]
XOFF=0.0
for k in range(110 if SEX=='f' else 140):
    v=int(random.choice(list(_cand))); p=Vector(BP[v]); n=Vector(BNRM[v]).normalized()
    back=Vector((0,1,0.25 if SEX=='f' else 0.6)) if (SEX=='m' or (abs(BP[v][0])<0.05 and BP[v][1]<0.0)) else Vector((0.3*np.sign(BP[v][0]),0.6,-1.0)); back=(back-n*back.dot(n)).normalized()
    L=(random.uniform(0.12,0.2) if not (abs(BP[v][0])<0.05 and BP[v][1]<0.0) else random.uniform(0.03,0.05)) if SEX=='f' else random.uniform(0.045,0.075)
    pts=[];nr=[]
    for t in np.linspace(0,1,6):
        q=p+n*((0.012 if SEX=='f' else 0.008)+0.004*math.sin(t*3))+back*L*t; q=q-n*0.003*t*t
        if SEX=='f' and back.z<-0.5:
            q=p+n*0.012+Vector((0,0.01,-L))*t
            HC=Vector((0,0.005,EYL[2]+0.01)); r_=q-HC; r_.z*=0.8
            if r_.length<0.115: q=HC+(q-HC)*(0.115/max(r_.length,1e-4))
        pts.append(tuple(q)); nr.append(tuple(n))
    if max(abs(q_[0]) for q_ in pts)>0.13 or max(q_[2] for q_ in pts)>EYL[2]+0.15: continue
    ribbon('face','hair',headP,pts,nr,random.uniform(0.012,0.02) if SEX=='f' else random.uniform(0.008,0.012),0.002,bevel=0,taper=0.85)
for V_ in EYEV:
    for sg in (1,-1):
        Q=V_[np.sign(V_[:,0])==sg]
        if len(Q)==0: continue
        C=Q.mean(0); r=float(np.linalg.norm(Q-C,axis=1).max())*1.05
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,radius=r,location=tuple(C)); o=bpy.context.object
        cs=np.array([v.co[:] for v in o.data.vertices]); d=-cs[:,1]/r
        col=np.tile([0.88,0.86,0.82],(len(cs),1)); col[d>0.875]=[0.08,0.06,0.04]; col[d>0.89]=[0.20,0.14,0.08]; col[d>0.972]=[0.03,0.03,0.03]
        ca=o.data.color_attributes.new('paint','FLOAT_COLOR','POINT'); ca.data.foreach_set('color',np.c_[col,np.ones(len(col))].ravel())
        for p in o.data.polygons: p.use_smooth=True
        finish(o,'face','eyeball',headP,0,2,0)
def skin_update():
    Ms=np.array([np.array(EMP[e].matrix_world @ REST[e].inverted()) for e in BE])   # (B,4,4)
    for o,R,Wt in SKINNED:
        X=np.einsum('bij,nj->nbi',Ms,R)[:,:,:3]; Q=(Wt[:,:,None]*X).sum(1)
        o.data.vertices.foreach_set('co',Q.ravel()); o.data.update()
skin_update()
SLOTOBJ.update({k:[(o[0] if isinstance(o,tuple) else o) for o in v] for k,v in SLOTOBJ.items()})
COSLAYERS=[]
if os.environ.get('COS'):   # cosmetic model pieces (cos3d.py): rendered as extra layers with the body as holdout
    exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'cos3d.py')).read())
ALLOBJ=[o for s in SLOTS for o in SLOTOBJ.get(s,[])]
COSOBJ={l:[o for (o,_,_) in SLOTOBJ[l]] for l in COSLAYERS}
for l in COSLAYERS: SLOTOBJ[l]=COSOBJ[l]
if os.environ.get('NOALLSH'):
    for o in ALLOBJ: o.visible_shadow=False
bpy.context.view_layer.update()
print('build done',len(ALLOBJ),'objs',sum(len(o.data.polygons) for o in ALLOBJ),'polys',round(time.time()-T0,1),'s',flush=True)
# ===================== camera / lights =====================
cam=bpy.data.cameras.new('c'); cam.type='ORTHO'; cam.ortho_scale=float(os.environ.get('ORTHO','2.65')); cam.shift_y=float(os.environ.get('SHIFT','0.40625'))
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
for o in ([] if VARIANT else SLOTOBJ['torso']):
    mn=o.active_material.name if o.active_material else ''
    if mn=='jacket': P.register(o,lambda x,y,z: sm_((1.38-z)/0.36),'jacket')
    elif mn in ('canvas','amber','glass'): P.register(o,lambda x,y,z: (0.8 if abs(x)>0.13 and y<0.12 else 0.0)*sm_((1.2-z)/0.16),'pouch')
for o in ([] if VARIANT else SLOTOBJ['face']):
    if o.active_material and o.active_material.name=='jacket': P.register(o,lambda x,y,z: sm_((y+0.02)/0.14)*sm_((hb+0.14-z)/0.2)+0.0,'hood')
elz=W(J['elL']).z
for o in ([] if VARIANT else SLOTOBJ['armL']):
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
            P.set(anim,f); bpy.context.view_layer.update(); (None if os.environ.get('NODEFORM') else P.deform(anim,f)); skin_update()
            cs={s:centroid(s) for s in SLOTS}
            order[anim][di][f]=sorted(range(len(SLOTS)),key=lambda i:-cs[SLOTS[i]].dot(viewdir))
            if os.environ.get('PREVIEW'):
                for o in ALLOBJ: o.hide_render=False; o.visible_camera=True; o.visible_shadow=True
                sc.render.use_border=False; sc.render.filepath=f'{OUT}/{anim}/all/{d}_{f}.png'; bpy.ops.render.render(write_still=True); cnt+=1; continue
            if COSLAYERS:
                for l in COSLAYERS:
                    for o in ALLOBJ: o.hide_render=False; o.visible_camera=True; o.is_holdout=True; o.visible_shadow=True
                    for ll in COSLAYERS:
                        for o in COSOBJ[ll]: o.visible_camera=(ll==l); o.visible_shadow=(ll==l); o.is_holdout=False
                    b=slot_border(l); sc.render.use_border=True; sc.render.use_crop_to_border=False; sc.render.border_min_x,sc.render.border_max_x,sc.render.border_min_y,sc.render.border_max_y=b
                    sc.render.filepath=f'{OUT}/{anim}/{l}/{d}_{f}.png'
                    try: bpy.ops.render.render(write_still=True); cnt+=1
                    except RuntimeError:
                        ei=bpy.data.images.new('e',RES,RES,alpha=True); ei.filepath_raw=sc.render.filepath; ei.file_format='PNG'; ei.save()
                print(anim,d,f,f'{cnt} renders {time.time()-T1:.0f}s',flush=True); continue
            for s in ([] if os.environ.get('ORDERONLY') else SLR):
                for o in ALLOBJ: o.hide_render=False; o.visible_camera=False; o.visible_shadow=False
                for o in SLOTOBJ[s]: o.visible_camera=True; o.visible_shadow=True
                b=slot_border(s); sc.render.use_border=True; sc.render.use_crop_to_border=False; sc.render.border_min_x,sc.render.border_max_x,sc.render.border_min_y,sc.render.border_max_y=b
                sc.render.filepath=f'{OUT}/{anim}/{s}/{d}_{f}.png'
                try: bpy.ops.render.render(write_still=True); cnt+=1
                except RuntimeError as e:
                    print('EMPTY layer',anim,d,f,s,b,flush=True); Image_empty=bpy.data.images.new('e',RES,RES,alpha=True); Image_empty.filepath_raw=sc.render.filepath; Image_empty.file_format='PNG'; Image_empty.save()
            print(anim,d,f,f'{cnt} renders {time.time()-T1:.0f}s',flush=True)
json.dump({'layers':COSLAYERS or SLOTS,'order':order,'cos':bool(COSLAYERS)},open(ofile,'w'))
print('DONE',cnt,'renders',round(time.time()-T1),'s',flush=True)

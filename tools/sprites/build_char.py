# Scavenger-mechanic base character, modular per body slot. Run: python build_char.py OUTDIR [--test]
# Rendering: Cycles CPU, ortho 2:1 iso camera, one render per slot-layer per direction per frame.
import bpy, math, sys, json, os
from mathutils import Vector, Euler
OUT=sys.argv[1]; TEST='--test' in sys.argv
TEX='/workspace/art/tex'
RES=256; SAMPLES=int(os.environ.get('SAMPLES','28'))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene

# ---------- materials ----------
def mk_mat(name,rough=0.85,metal=0.0,tile=1.6):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(f'{TEX}/{name}.png'); t.projection='BOX'; t.projection_blend=0.25; t.interpolation='Linear'
    tc=nt.nodes.new('ShaderNodeTexCoord'); mp=nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value=(tile,tile,tile)
    nt.links.new(tc.outputs['Object'],mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'],t.inputs['Vector']); nt.links.new(t.outputs['Color'],b.inputs['Base Color'])
    b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    return m
M={n:mk_mat(n,*a) for n,a in dict(jacket=(0.95,0,2.2),pants=(0.95,0,2.2),olive=(0.6,0.25,1.8),ivory=(0.35,0,2.0),skin=(0.7,0,2.0),boot=(0.8,0,2.0),canvas=(0.95,0,2.5),metal=(0.5,0.6,2.0),cloth=(0.95,0,2.0),glass=(0.12,0.2,2.0)).items()}

# ---------- rig (empties as joints) ----------
def pivot(name,parent,loc):
    e=bpy.data.objects.new(name,None); sc.collection.objects.link(e); e.parent=parent; e.location=loc; return e
root=pivot('root',None,(0,0,0)); hips=pivot('hips',root,(0,0,0.96))
torsoP=pivot('torsoP',hips,(0,0,0.06)); headP=pivot('headP',torsoP,(0,0,0.62))
J={}
for s,sx in (('L',1),('R',-1)):
    J['sh'+s]=pivot('sh'+s,torsoP,(0.285*sx,0,0.55)); J['el'+s]=pivot('el'+s,J['sh'+s],(0,0,-0.29)); J['wr'+s]=pivot('wr'+s,J['el'+s],(0,0,-0.27))
    J['hp'+s]=pivot('hp'+s,hips,(0.115*sx,0,-0.02)); J['kn'+s]=pivot('kn'+s,J['hp'+s],(0,0,-0.43)); J['an'+s]=pivot('an'+s,J['kn'+s],(0,0,-0.42))
bpy.context.view_layer.update()
SLOTOBJ={}  # slot -> [objs]
def finish(o,slot,mat,joint,bevel=0.0,smooth=True):
    bpy.context.view_layer.objects.active=o; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    if bevel>0:
        bm=o.modifiers.new('bv','BEVEL'); bm.width=bevel; bm.segments=3; bm.limit_method='ANGLE'
    o.data.materials.append(M[mat])
    if smooth: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
    o.parent=joint; o.matrix_parent_inverse=joint.matrix_world.inverted()
    SLOTOBJ.setdefault(slot,[]).append(o); return o
def box(slot,mat,joint,size,loc,bevel=0.012,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rot); o=bpy.context.object; o.scale=size; return finish(o,slot,mat,joint,bevel)
def cyl(slot,mat,joint,r1,r2,h,loc,rot=(0,0,0),v=20,bevel=0.006):
    bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=r1,radius2=r2,depth=h,location=loc,rotation=rot); o=bpy.context.object; return finish(o,slot,mat,joint,bevel)
def sph(slot,mat,joint,r,loc,scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=r,location=loc); o=bpy.context.object; o.scale=scale; return finish(o,slot,mat,joint)
def at(j,dx=0,dy=0,dz=0): w=j.matrix_world.translation; return (w.x+dx,w.y+dy,w.z+dz)

# --- torso slot: pelvis, jacket vest, collar, belt, pouches, straps, shoulder caps
T=hips.matrix_world.translation
NOSH=[]
NOSH.append(box('torso','pants',hips,(0.34,0.21,0.20),(0,0,0.95),0.03))
box('torso','jacket',torsoP,(0.42,0.25,0.52),(0,0,1.32),0.04)
box('torso','jacket',torsoP,(0.45,0.27,0.30),(0,0,1.22),0.04)       # lower skirt of jacket
box('torso','cloth',torsoP,(0.30,0.20,0.40),(0,-0.005,1.36),0.02)    # dark shirt visible at front
NOSH.append(cyl('torso','cloth',torsoP,0.075,0.085,0.10,(0,0,1.57)))
box('torso','canvas',torsoP,(0.46,0.285,0.065),(0,0,1.04),0.015)     # belt
for sx in (1,-1):
    box('torso','canvas',torsoP,(0.075,0.07,0.15),(0.17*sx,-0.15,1.0),0.015)
    for k in (-1,0,1): cyl('torso','metal' if k else 'glass',torsoP,0.016,0.016,0.14,(0.17*sx+0.028*k,-0.19,1.05),v=10)
    box('torso','canvas',torsoP,(0.05,0.12,0.012),(0.125*sx,-0.085,1.35),0.004,(0,0,0)) # strap front
    box('torso','canvas',torsoP,(0.045,0.016,0.44),(0.11*sx,-0.132,1.36),0.004)
    NOSH.append(sph('torso','jacket',torsoP,0.095,at(J['sh'+('L' if sx>0 else 'R')],0,0,0.0),(1,1,0.9)))
box('torso','canvas',torsoP,(0.14,0.02,0.16),(0,0.135,1.42),0.006)   # back patch
box('torso','canvas',torsoP,(0.20,0.06,0.08),(0,0.15,1.06),0.01)     # back pouch
# --- head slot: face, hood shell, gaiter, goggles
hz=headP.matrix_world.translation.z+0.095
NOSH.append(sph('face','skin',headP,0.098,(0,0,hz),(0.95,1.0,1.08)))
hood=sph('face','jacket',headP,0.145,(0,0.02,hz+0.012),(1.0,1.05,1.07)); NOSH.append(hood)
bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=0.095,location=(0,-0.15,hz+0.0)); cutter=bpy.context.object; cutter.scale=(0.95,1.5,1.12)
bo=hood.modifiers.new('cut','BOOLEAN'); bo.object=cutter; bo.operation='DIFFERENCE'
bpy.context.view_layer.objects.active=hood; bpy.ops.object.modifier_apply(modifier='cut'); bpy.data.objects.remove(cutter)
bpy.ops.object.select_all(action='DESELECT'); hood.select_set(True); bpy.context.view_layer.objects.active=hood; bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
cyl('face','jacket',headP,0.06,0.0,0.14,(0,0.15,hz+0.03),(math.radians(-100),0,0),v=14)   # hood tip
NOSH.append(sph('face','cloth',headP,0.085,(0,-0.025,hz-0.075),(1.05,0.95,0.7)))                              # gaiter
box('face','cloth',headP,(0.22,0.06,0.035),(0,-0.005,hz+0.02),0.01)                              # goggle strap block
for sx in (1,-1):
    cyl('face','glass',headP,0.042,0.042,0.03,(0.05*sx,-0.108,hz+0.025),(math.radians(90),0,0),v=16)
    cyl('face','metal',headP,0.05,0.05,0.016,(0.05*sx,-0.096,hz+0.025),(math.radians(90),0,0),v=16)
# --- arms: L ivory ceramic, R jacket sleeve + canvas wrap
for s,sx in (('L',1),('R',-1)):
    sh,el,wr=J['sh'+s],J['el'+s],J['wr'+s]
    shp=sh.matrix_world.translation; elp=el.matrix_world.translation; wrp=wr.matrix_world.translation
    mid1=(shp+elp)/2; mid2=(elp+wrp)/2
    if s=='L':
        cyl('armL','ivory',sh,0.058,0.05,0.27,tuple(mid1),v=20,bevel=0.004)
        sph('armL','metal',el,0.052,tuple(elp)); cyl('armL','ivory',el,0.05,0.04,0.25,tuple(mid2),v=20)
        cyl('armL','metal',wr,0.045,0.045,0.03,tuple(wrp+Vector((0,0,0.02))),v=16)
        sph('handL','ivory',wr,0.052,tuple(wrp+Vector((0,0,-0.06))),(0.8,1.0,1.4))
    else:
        cyl('armR','jacket',sh,0.07,0.058,0.27,tuple(mid1),v=20)
        sph('armR','jacket',el,0.06,tuple(elp)); cyl('armR','cloth',el,0.055,0.045,0.25,tuple(mid2),v=20)
        cyl('armR','canvas',wr,0.05,0.05,0.07,tuple(wrp+Vector((0,0,0.03))),v=16)
        sph('handR','skin',wr,0.05,tuple(wrp+Vector((0,0,-0.06))),(0.8,1.0,1.4))
# --- legs: L soot pants, R olive stamped plates; feet = boots
for s,sx in (('L',1),('R',-1)):
    hp,kn,an=J['hp'+s],J['kn'+s],J['an'+s]
    hpp=hp.matrix_world.translation; knp=kn.matrix_world.translation; anp=an.matrix_world.translation
    m1=(hpp+knp)/2; m2=(knp+anp)/2
    if s=='L':
        cyl('legL','pants',hp,0.095,0.075,0.43,tuple(m1),v=20); cyl('legL','pants',kn,0.075,0.062,0.40,tuple(m2),v=20)
        box('legL','canvas',kn,(0.11,0.07,0.12),tuple(knp+Vector((0,-0.065,0.01))),0.02)
    else:
        box('legR','olive',hp,(0.17,0.19,0.40),tuple(m1),0.03); sph('legR','metal',kn,0.075,tuple(knp),(1,0.9,1))
        box('legR','olive',kn,(0.145,0.16,0.38),tuple(m2),0.03); box('legR','olive',kn,(0.13,0.05,0.14),tuple(knp+Vector((0,-0.09,0.02))),0.02)
    box('foot'+s,'boot',an,(0.115,0.27,0.075),(anp.x,anp.y-0.045,anp.z-0.01-0.0),0.025)
    box('foot'+s,'boot',an,(0.1,0.13,0.07),(anp.x,anp.y-0.14,anp.z+0.005),0.02)
    box('foot'+s,'metal',an,(0.12,0.29,0.03),(anp.x,anp.y-0.045,anp.z-0.075),0.01)
    box('foot'+s,'boot',an,(0.1,0.1,0.12),(anp.x,anp.y+0.02,anp.z+0.08),0.02)
SLOTS=['face','torso','armL','handL','armR','handR','legL','footL','legR','footR']
for o in NOSH: o.visible_shadow=False
ALLOBJ=[o for s in SLOTS for o in SLOTOBJ[s]]
bpy.context.view_layer.update()

# ---------- camera / lights / render ----------
cam=bpy.data.cameras.new('c'); cam.type='ORTHO'; cam.ortho_scale=2.65; cam.shift_y=(116-64)/128*1.0
co=bpy.data.objects.new('cam',cam); sc.collection.objects.link(co); co.rotation_euler=(math.radians(60),0,0); co.location=(0,-0.866*12,0.5*12); sc.camera=co
cam.clip_end=40
viewdir=co.matrix_world.to_quaternion()@Vector((0,0,-1))
def sun(name,e,rot,col):
    d=bpy.data.lights.new(name,'SUN'); d.energy=e; d.color=col; d.angle=math.radians(12); o=bpy.data.objects.new(name,d); sc.collection.objects.link(o); o.rotation_euler=[math.radians(x) for x in rot]
sun('key',3.5,(52,0,-38),(1.0,0.95,0.86)); sun('fill',1.3,(70,0,140),(0.75,0.85,1.0)); sun('rim',1.4,(120,0,170),(0.85,0.9,1.0))
w=bpy.data.worlds.new('w'); w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.42,0.44,0.46,1); w.node_tree.nodes['Background'].inputs[1].default_value=0.9; sc.world=w
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=SAMPLES; sc.cycles.use_denoising=True; sc.cycles.max_bounces=3
sc.render.resolution_x=RES; sc.render.resolution_y=RES; sc.render.film_transparent=True; sc.view_settings.view_transform='Standard'
sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGBA'; sc.cycles.film_exposure=1.0
sc.render.threads=8

# ---------- poses (rotations about X: +θ swings the limb backward (+Y), -θ forward) ----------
def zero():
    for j in [hips,torsoP,headP]+list(J.values()): j.rotation_euler=(0,0,0)
    hips.location=(0,0,0.96)
def pose(anim,p):
    zero(); s=math.sin(2*math.pi*p); c=math.cos(2*math.pi*p)
    if anim=='idle':
        hips.location.z=0.96-0.012*(1-math.cos(2*math.pi*p))/2*2+0.0
        torsoP.rotation_euler=(0.03+0.015*s,0,0.02*s); headP.rotation_euler=(-0.03-0.01*s,0,-0.02*s)
        for k,sg in (('L',1),('R',-1)):
            J['sh'+k].rotation_euler=(0.08*s*sg*0+0.05+0.04*s*sg,0,0.07*sg); J['el'+k].rotation_euler=(-0.35-0.05*s,0,0)
            J['hp'+k].rotation_euler=(-0.04*sg,0,0.02*sg); J['kn'+k].rotation_euler=(0.08,0,0); J['an'+k].rotation_euler=(-0.04+0.04*sg,0,0)
        hips.rotation_euler=(0,0,0.0)
    elif anim=='run':
        hips.location.z=0.93-0.035*abs(math.sin(2*math.pi*p)) ; hips.location.z+=0.0
        torsoP.rotation_euler=(0.22,0,-0.12*s); headP.rotation_euler=(-0.2,0,0.1*s); hips.rotation_euler=(0,0,0.1*s)
        for k,ph in (('L',0.0),('R',0.5)):
            q=2*math.pi*(p+ph); ss=math.sin(q); cc=math.cos(q); sg=1 if k=='L' else -1
            J['hp'+k].rotation_euler=(-0.95*ss,0,0.04*sg)
            J['kn'+k].rotation_euler=(0.35+1.05*max(0.0,cc)**1.3+0.25*max(0.0,ss)*0,0,0)
            J['an'+k].rotation_euler=(0.95*ss*0.55-0.25*max(0,cc),0,0)
            J['sh'+k].rotation_euler=(0.95*ss,0,0.14*sg); J['el'+k].rotation_euler=(-1.15-0.35*ss,0,0)
def centroid(slot):
    pts=[]
    for o in SLOTOBJ[slot]:
        for c in o.bound_box: pts.append(o.matrix_world@Vector(c))
    return sum(pts,Vector())/len(pts)
DIRS=['S','SW','W','NW','N','NE','E','SE']
FACE={'S':(0,-1),'SW':(-1,-1),'W':(-1,0),'NW':(-1,1),'N':(0,1),'NE':(1,1),'E':(1,0),'SE':(1,-1)}
ANIMS={'idle':6,'run':8}
if TEST: ANIMS={k:min(v,2) for k,v in ANIMS.items()}
order={}
os.makedirs(OUT,exist_ok=True)
tmp=OUT+'/_t.png'
for anim,n in ANIMS.items():
    order[anim]=[]
    for d in DIRS:
        fx,fy=FACE[d]; root.rotation_euler=(0,0,math.atan2(fy,fx)+math.pi/2)
        row=[]
        for f in range(n):
            pose(anim,f/n); bpy.context.view_layer.update()
            cs={s:centroid(s) for s in SLOTS}
            # far-to-near ordering along the view direction (smaller dot(viewdir) = nearer camera)
            row.append(sorted(range(len(SLOTS)),key=lambda i:-cs[SLOTS[i]].dot(viewdir)))
            for s in SLOTS:
                for o in ALLOBJ: o.hide_render=False; o.visible_camera=False
                for o in SLOTOBJ[s]: o.visible_camera=True
                sc.render.filepath=f'{OUT}/{anim}/{s}/{d}_{f}.png'; bpy.ops.render.render(write_still=True)
            print(anim,d,f,flush=True)
        order[anim].append(row)
json.dump({'layers':SLOTS,'order':order},open(OUT+'/order.json','w'))

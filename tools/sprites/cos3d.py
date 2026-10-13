# Cosmetic model pieces (docs/SPRITE_PIPELINE.md "Cosmetic layers"). exec'd from build_char.py when env COS=<slot>:<style>,<style>.
# Each style is a real mesh parented to the rig joints, rendered as its own layer with the whole body as a HOLDOUT, so the
# body's occlusion is baked in (a crown's back rim hides behind the head, a cape behind the torso) and the layer can always be
# composited on top of the body. Materials are channel-coded so ONE render per style serves every item of that style:
#   red albedo = primary colour (item c), green = secondary (item c2), blue emission = glow (item c2, brightened).
# The game recolours at compose time (src/coslayers.ts), so item colours always match the store swatch / preview.
def cos_mat(name,col,rough=0.42,metal=0.0,emit=None,es=0.0,coat=0.25):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=col; b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    try: b.inputs['Coat Weight'].default_value=coat
    except Exception: pass
    if emit: b.inputs['Emission Color'].default_value=emit; b.inputs['Emission Strength'].default_value=es
    M[name]=m; return m
cos_mat('cA',(1,0,0,1)); cos_mat('cB',(0,1,0,1)); cos_mat('cAm',(1,0,0,1),rough=0.3,metal=0.6); cos_mat('cBm',(0,1,0,1),rough=0.3,metal=0.6)
cos_mat('cE',(0,0,0,1),emit=(0,0,1,1),es=3.0,coat=0.0)
# measured head (after the face HS scale): every piece is sized from this so it sits on the head of whichever body is built
_fp=[o.matrix_world@Vector(c) for o in SLOTOBJ['face'] for c in o.bound_box]
HX=max(abs(p.x) for p in _fp if p.z>hb+0.05); HY0=min(p.y for p in _fp if p.z>hb+0.05); HY1=max(p.y for p in _fp if p.z>hb+0.05); HT=max(p.z for p in _fp)
HC=Vector((0,0.01,hb+0.11)); HR=0.128; HY0=HC.y-HR*1.08; HY1=HC.y+HR*1.08  # skull+hood radius (the bbox includes goggle straps/hood back)
def _ring(slot,mat,joint,R,r,z,ry=1.0,yc=None,tilt=0.0):
    o=torus(slot,mat,joint,R,r,(0,HC.y if yc is None else yc,z),(tilt,0,0)); o.scale=(1,ry,1); return o
cos_mat('cAc',(1,0,0,1),rough=0.9,coat=0.0); cos_mat('cBc',(0,1,0,1),rough=0.9,coat=0.0)
def seg(slot,mat,joint,p0,p1,r0,r1=None,v=14,bevel=0.002):
    p0=Vector(p0); p1=Vector(p1); d=p1-p0; e=Vector((0,0,1)).rotation_difference(d.normalized()).to_euler()
    return cyl(slot,mat,joint,r0,r1 if r1 is not None else r0,d.length,tuple((p0+p1)/2),tuple(e),v=v,bevel=bevel)
def _arc(s,mat,j,pts,r0,r1,v=12):
    n=len(pts)-1
    for i in range(n): seg(s,mat,j,pts[i],pts[i+1],r0+(r1-r0)*i/n,r0+(r1-r0)*(i+1)/n,v=v)
def head_item(iid):
    s='cos_'+iid; j=headP; R=HR*1.12; top=HT; F=HY0; B=HY1; cy=HC.y; ez=hb+0.135
    if iid=='head_cap':
        loft(s,'cAc',j,top-0.05,top+0.035,lambda t:(0,cy,R*(1-0.3*t**3),R*1.06*(1-0.3*t**3)),nv=10,nu=36,cap=(False,True),solid=0.01,bevel=0.003)
        loft(s,'cAc',j,-0.006,0.006,lambda t:(0,0,0.085,0.075),nv=2,nu=28,origin=(0,F-0.06,top-0.045),rot=(0.18,0,0),bevel=0.003,delete=lambda x,y,z:y>0.035)
    elif iid=='head_bandana':
        _ring(s,'cAc',j,R*0.99,0.02,top-0.065,1.07,tilt=0.1)
        sph(s,'cAc',j,0.022,(0,B+0.01,top-0.08),(1.2,0.8,0.9))
        for sx in (1,-1): _arc(s,'cAc',j,[(0.01*sx,B+0.01,top-0.08),(0.05*sx,B+0.07,top-0.12),(0.07*sx,B+0.11,top-0.18)],0.016,0.004)
    elif iid=='head_goggles':
        for sx in (1,-1):
            cyl(s,'cAm',j,0.046,0.04,0.04,(0.052*sx,F+0.005,top-0.03),(math.radians(60),0,0),v=28,bevel=0.004)
            cyl(s,'cE',j,0.034,0.034,0.044,(0.052*sx,F+0.0,top-0.032),(math.radians(60),0,0),v=28,bevel=0.002)
        _ring(s,'cAc',j,R*1.0,0.012,top-0.045,1.07,tilt=0.35)
    elif iid=='head_resp':
        sph(s,'cA',j,0.07,(0,F-0.045,hb+0.05),(1.25,0.9,0.85))
        for sx in (1,-1): cyl(s,'cBm',j,0.03,0.03,0.07,(0.085*sx,F-0.04,hb+0.04),(math.radians(90),0,0.7*sx),v=20,bevel=0.004)
        _ring(s,'cAc',j,R*0.97,0.008,hb+0.06,1.08,tilt=-0.25)
    elif iid=='head_visor':
        loft(s,'cE',j,ez-0.02,ez+0.02,lambda t:(0,cy,R*1.08,R*1.32),nv=3,nu=44,cap=(False,False),solid=0.006,delete=lambda x,y,z:y>cy+0.02,bevel=0.002)
    elif iid=='pm_head_nightvisor':
        loft(s,'cE',j,ez-0.04,ez+0.05,lambda t:(0,cy-0.01*t,R*(1.08+0.05*t),R*(1.16+0.06*t)),nv=4,nu=44,cap=(False,False),solid=0.008,delete=lambda x,y,z:y>cy,bevel=0.002)
        _ring(s,'cAm',j,R*1.1,0.01,ez+0.05,1.15)
        box(s,'cAm',j,(0.012,0.2,0.07),(0,cy,top+0.02),0.004)
    elif iid=='pass_s1_visor':
        loft(s,'cE',j,ez-0.025,ez+0.025,lambda t:(0,cy,R*1.08,R*1.32),nv=3,nu=44,cap=(False,False),solid=0.006,delete=lambda x,y,z:y>cy,bevel=0.002)
        for sx in (1,-1):
            for k in range(3): box(s,'cB',j,(0.012,0.09-0.02*k,0.022),(sx*(R*1.08+0.01),cy+0.04+0.015*k,ez+0.02+0.03*k),0.004,rot=(0.6,0,0))
    elif iid=='head_horns':
        for sx in (1,-1):
            pts=[(sx*(R*0.75+0.06*math.sin(a*0.9)), cy+0.02-0.07*math.sin(a), top-0.06+0.07*math.cos(a)-0.07) for a in np.linspace(0,4.2,14)]
            pts=[(x,y,z+0.07) for x,y,z in pts]
            for i in range(13): seg(s,'cAm' if i%4 else 'cBm',j,pts[i],pts[i+1],0.032*(1-i/15)+0.006,0.032*(1-(i+1)/15)+0.006,v=14)
    elif iid=='head_mast':
        cyl(s,'cA',j,0.03,0.034,0.035,(0.075,cy+0.02,top-0.03),(0,0.4,0),v=16,bevel=0.004)
        cyl(s,'cBm',j,0.006,0.003,0.32,(0.11,cy+0.03,top+0.11),(0,0.25,0),v=8,bevel=0.001); sph(s,'cE',j,0.018,(0.15,cy+0.03,top+0.27))
    elif iid=='head_halo':
        _ring(s,'cE',j,0.11,0.008,top+0.08,1.0)
    elif iid=='pm_head_vigil':
        _ring(s,'cE',j,0.12,0.01,top+0.08,1.0)
        for k in range(12):
            a=k/12*2*math.pi; box(s,'cAm',j,(0.012,0.012,0.04 if k%3 else 0.06),(math.cos(a)*0.135,cy+math.sin(a)*0.135,top+0.08),0.003)
        box(s,'cAm',j,(0.09,0.01,0.008),(0.04,cy,top+0.08),0.002,rot=(0,0,0.6))
    elif iid=='col_hextech_halo':
        cyl(s,'cAm',j,0.12,0.12,0.012,(0,B+0.03,top-0.02),(math.radians(80),0,0),v=40,bevel=0.003)
        for k in range(16):
            a=k/16*2*math.pi; L=0.07 if k%2 else 0.11
            box(s,'cAm',j,(0.016,0.01,L),(math.cos(a)*(0.12+L/2),B+0.035,top-0.02+math.sin(a)*(0.12+L/2)),0.003,rot=(0,-a+math.pi/2,0))
        cyl(s,'cE',j,0.05,0.05,0.016,(0,B+0.022,top-0.02),(math.radians(80),0,0),v=24)
    elif iid=='head_crown':
        loft(s,'cAm',j,top-0.055,top-0.01,lambda t:(0,cy,R*0.9,R*0.98),nv=3,nu=40,cap=(False,False),solid=0.012,bevel=0.002)
        for k in range(9):
            a=k/9*2*math.pi; hh=0.03+0.02*((k*7)%3)
            box(s,'cAm',j,(0.03,0.008,hh),(math.cos(a)*R*0.92,cy+math.sin(a)*R*1.0,top-0.01+hh/2),0.003,rot=(0,0,a+math.pi/2))
        for k in range(5): bolt(s,j,(math.cos(k*1.3)*R*0.95,cy+math.sin(k*1.3)*R*1.03,top-0.035),mat='cBm')
    elif iid=='ex_world_first_gateway':
        loft(s,'cAm',j,top-0.06,top-0.02,lambda t:(0,cy,R*0.95,R*1.02),nv=3,nu=40,cap=(False,False),solid=0.01,bevel=0.002)
        box(s,'cAm',j,(0.05,0.03,0.2),(0,F+0.02,top+0.07),0.004); cyl(s,'cAm',j,0.035,0.0,0.07,(0,F+0.02,top+0.2),v=4)
        for sx in (1,-1): box(s,'cAm',j,(0.03,0.02,0.14),(0.07*sx,F+0.03,top+0.03),0.004,rot=(0,0.35*sx,0))
        sph(s,'cE',j,0.022,(0,F-0.005,top-0.04))
    elif iid=='head_cowl':
        loft(s,'cAc',j,hb-0.05,top+0.03,lambda t:(0,cy+0.02+0.03*t,R*(1.2-0.35*t**2.5),R*1.3*(1.2-0.35*t**2.5)),nv=18,nu=40,cap=(False,True),solid=0.012,delete=lambda x,y,z:y<cy-0.03 and abs(x)<0.08 and z<top-0.02,bevel=0.003,mod=lambda a,z:1+0.025*math.sin(a*7))
        cyl(s,'cAc',j,0.05,0.0,0.12,(0,B+0.05,top-0.02),(-0.9,0,0),v=12)
        box(s,'cE',j,(0.012,0.02,0.14),(0,F-0.02,top-0.03),0.003,rot=(0.5,0,0))
    else: raise SystemExit('no head art for '+iid)
COS_SLOT,_cs=os.environ['COS'].split(':'); COS_STYLES=_cs.split(',')
BUILD={'head':head_item}
for st in COS_STYLES: BUILD[COS_SLOT](st)
COSLAYERS=['cos_'+st for st in COS_STYLES]
print('cos built',COSLAYERS,'head',round(HR,3),round(HT,3),flush=True)

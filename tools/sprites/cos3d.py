# Cosmetic model pieces (docs/SPRITE_PIPELINE.md "Cosmetic layers"). exec'd from build_char.py when env COS=<slot>:<style>,<style>.
# Each style is a real mesh parented to the rig joints, rendered as its own layer with the whole body as a HOLDOUT, so the
# body's occlusion is baked in (a crown's back rim hides behind the head, a cape behind the torso) and the layer can always be
# composited on top of the body. Materials are channel-coded so ONE render per style serves every item of that style:
#   red albedo = primary colour (item c), green = secondary (item c2), blue emission = glow (item c2, brightened).
# The game recolours at compose time (src/coslayers.ts), so item colours always match the store swatch / preview.
def cos_mat(name,col,rough=0.42,metal=0.0,emit=None,es=0.0,coat=0.25):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=col; b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal; b.inputs['Specular IOR Level'].default_value=0.3
    try: b.inputs['Coat Weight'].default_value=coat
    except Exception: pass
    if emit: b.inputs['Emission Color'].default_value=emit; b.inputs['Emission Strength'].default_value=es
    M[name]=m; return m
cos_mat('cA',(1,0,0,1)); cos_mat('cB',(0,1,0,1)); cos_mat('cAm',(1,0,0,1),rough=0.5,metal=0.22,coat=0.08); cos_mat('cBm',(0,1,0,1),rough=0.5,metal=0.22,coat=0.08)  # low metal/spec: white reflections washed item colours out
cos_mat('cE',(0,0,0,1),emit=(0,0,1,1),es=3.0,coat=0.0)
# measured head (after the face HS scale): every piece is sized from this so it sits on the head of whichever body is built
hb=float(EYL[2])-0.135   # head-piece reference height, re-based on the fitted body's eye line (old rig: eyes at hb+0.135)
_hv=BP[BP[:,2]>EYL[2]-0.02]; HT=float(_hv[:,2].max())+0.012   # skull of the fitted base body (+ hair thickness)
HC=Vector((0,float(_hv[:,1].min()+_hv[:,1].max())/2,float(EYL[2])+0.02)); HR=max(float(np.abs(_hv[:,0]).max()),float(_hv[:,1].max()-_hv[:,1].min())/2)+0.012
HX=HR; HY0=HC.y-HR*1.08; HY1=HC.y+HR*1.08
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
    s='cos_'+iid; j=headP; R=HR*1.12; top=HT; F=HY0; B=HY1; cy=HC.y; ez=float(EYL[2])
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
    elif iid.startswith('col_') and iid.endswith('_halo'):   # Saint's Halo (collection reward)
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

# ===================== TORSO (worn over the jacket; parented to torsoP/hips so it follows the spine) =====================
TZ0,TZ1=1.04,1.6; TF=-0.17; TB=0.15
def _shellT(s,mat,z0,z1,rx,ry,solid=0.012,delete=None,mod=None,j=None):
    return loft(s,mat,j or torsoP,z0,z1,lambda t:(0,0,rx(t),ry(t)),nv=14,nu=40,cap=(False,False),solid=solid,delete=delete,mod=mod,bevel=0.003)
def torso_item(iid):
    s='cos_'+iid; T=torsoP
    if iid=='torso_hazard':   # long tabard: front+back cloth panels to mid-thigh, rope belt, diagonal stripe bands
        for yy,sg in ((TF-0.01,1),(TB+0.01,-1)):
            box(s,'cAc',T,(0.3,0.012,0.62),(0,yy,1.2),0.004)
            for k in range(4): box(s,'cBc',T,(0.07,0.014,0.42),(-0.1+k*0.075,yy-0.002*sg,1.22),0.002,rot=(0,0.7,0))
        torus(s,'cBc',hips,0.21,0.012,(0,0,1.04)).scale=(1,0.78,1)
    elif iid=='torso_vest':   # bulky open vest with high collar, two reflective bands, pockets
        _shellT(s,'cA',1.08,1.55,lambda t:0.235+0.01*math.sin(t*3),lambda t:0.165,delete=lambda x,y,z:y<-0.1 and abs(x)<0.05)
        for zz in (1.2,1.36): _shellT(s,'cB',zz,zz+0.035,lambda t:0.243,lambda t:0.173,delete=lambda x,y,z:y<-0.1 and abs(x)<0.05,solid=0.006)
        _shellT(s,'cA',1.55,1.66,lambda t:0.19-0.05*t,lambda t:0.15-0.03*t,delete=lambda x,y,z:y<-0.05)
        for sx in (1,-1): box(s,'cA',T,(0.08,0.03,0.07),(0.12*sx,TF-0.02,1.15),0.01)
    elif iid=='torso_chevron':   # stacked chevron chest plates (3 V-shaped plates) + shoulder bar
        for k in range(3):
            for sx in (1,-1): box(s,'cAm' if k%2==0 else 'cBm',T,(0.17,0.03,0.05),(0.07*sx,TF-0.01-0.005*k,1.48-k*0.1),0.008,rot=(0.15,0,-0.55*sx))
        box(s,'cAm',T,(0.42,0.12,0.05),(0,0,1.6),0.015)
    elif iid=='torso_lights':   # harness straps crossing the chest with a column of glowing status pods
        for sx in (1,-1): box(s,'cA',T,(0.04,0.012,0.6),(0,TF-0.012,1.32),0.003,rot=(0,0.45*sx,0)); box(s,'cA',T,(0.04,0.012,0.6),(0,TB+0.012,1.32),0.003,rot=(0,0.45*sx,0))
        for k in range(6): sph(s,'cE' if k%2==0 else 'cB',T,0.022,(0,TF-0.025,1.18+k*0.065),(1,0.6,1),seg=14,rings=8)
        box(s,'cAm',T,(0.08,0.04,0.06),(0,TF-0.02,1.33),0.01)
    elif iid=='torso_gown':   # loose wrap gown: flared hem below the hips, wide sleeves capped at shoulder, tie
        loft(s,'cAc',hips,0.6,1.62,lambda t:(0,0,0.29-0.08*t,0.21-0.05*t),nv=16,nu=40,cap=(False,False),solid=0.008,mod=lambda a,z:1+0.03*math.sin(a*9+z*6),bevel=0.002,delete=lambda x,y,z:z<0.75 and y<-0.12)
        box(s,'cBc',T,(0.02,0.015,0.5),(-0.04,TF-0.035,1.28),0.002,rot=(0,0.15,0))
    elif iid=='torso_core':   # heavy round reactor housing in the chest, glowing core, armoured ribs
        _shellT(s,'cBm',1.14,1.56,lambda t:0.23,lambda t:0.17,mod=lambda a,z:1+0.04*max(0,math.sin(z*55)))
        cyl(s,'cBm',T,0.1,0.11,0.06,(0,TF-0.03,1.4),(math.radians(90),0,0),v=32,bevel=0.006); cyl(s,'cE',T,0.07,0.07,0.07,(0,TF-0.04,1.4),(math.radians(90),0,0),v=32)
        torus(s,'cAm',T,0.1,0.012,(0,TF-0.065,1.4),(math.radians(90),0,0))
    elif iid=='torso_nova':   # cracked casing with a blazing star core and four radiating fins
        _shellT(s,'cBm',1.14,1.58,lambda t:0.235,lambda t:0.175)
        sph(s,'cE',T,0.085,(0,TF-0.04,1.4),(1,0.6,1))
        for k in range(4):
            a=k*math.pi/2+math.pi/4; box(s,'cAm',T,(0.02,0.04,0.2),(math.cos(a)*0.13,TF-0.04,1.4+math.sin(a)*0.13),0.004,rot=(0,-a+math.pi/2,0))
        for sx in (1,-1): sph(s,'cAm',T,0.09,(0.27*sx,0,1.56),(1.1,1,0.7))
    elif iid=='torso_ledger':   # tall flat ledger plate with rows of brass rivets and rolled scroll at the top
        box(s,'cA',T,(0.28,0.03,0.4),(0,TF-0.01,1.33),0.012)
        for r in range(5):
            for k in range(5): bolt(s,T,(-0.1+k*0.05,TF-0.028,1.2+r*0.065),(math.radians(90),0,0),mat='cBm')
        cyl(s,'cBm',T,0.03,0.03,0.32,(0,TF-0.02,1.55),(0,math.radians(90),0),v=20)
    elif iid=='torso_cuirass':   # stamped full breastplate with central ridge, faulds over the hips, big pauldron rims
        _shellT(s,'cAm',1.12,1.58,lambda t:0.24-0.02*t,lambda t:0.18,mod=lambda a,z:1+0.06*max(0,-math.sin(a))*math.cos(a)**8)
        for k in range(3): _shellT(s,'cBm',1.06-k*0.055,1.11-k*0.055,lambda t:0.25+0.01*k,lambda t:0.19+0.01*k,solid=0.008,j=hips)
    elif iid=='pm_torso_lattice':   # open diamond lattice cage over the chest with lit seams
        for k in range(-3,4):
            for sg in (1,-1): box(s,'cAm',T,(0.02,0.02,0.52),(k*0.06,TF-0.02,1.33),0.003,rot=(0,0.6*sg,0))
        for zz in (1.1,1.56): box(s,'cE',T,(0.36,0.025,0.02),(0,TF-0.025,zz),0.003)
    else: raise SystemExit('no torso art for '+iid)
# ===================== LEGS (per segment on hip / knee / ankle joints so they bend with the pose) =====================
def legs_item(iid):
    s='cos_'+iid
    for side,sx in (('L',1),('R',-1)):
        hp,kn,an=J['hp'+side],J['kn'+side],J['an'+side]; hz,kz,az=W(hp).z,W(kn).z,W(an).z; X=W(hp).x
        if iid=='legs_stripe':     # reflective bands on thigh + shin + ankle, little reflector tabs
            for zz,j,r in ((hz-0.18,hp,0.09),(hz-0.3,hp,0.085),(kz-0.16,kn,0.068),(kz-0.3,kn,0.064)): torus(s,'cB',j,r,0.013,(X,0,zz)).scale=(1,1.06,1)
            box(s,'cA',kn,(0.04,0.01,0.06),(X,-0.08,kz-0.23),0.003)
        elif iid=='legs_greaves':  # chunky shin plates + domed knee cops + thigh plates
            box(s,'cAm',kn,(0.13,0.05,0.3),(X,-0.07,kz-0.2),0.016,bw=3); sph(s,'cBm',kn,0.07,(X,-0.06,kz+0.01),(1,0.8,1))
            box(s,'cAm',hp,(0.14,0.05,0.22),(X,-0.075,hz-0.2),0.016)
        elif iid=='legs_rails':    # slim glowing rails on the outside of thigh and shin, small pods at knee
            cyl(s,'cE',hp,0.009,0.009,0.34,(X+0.085*sx,0,hz-0.21),v=10); cyl(s,'cE',kn,0.008,0.008,0.32,(X+0.07*sx,0,kz-0.2),v=10)
            sph(s,'cAm',kn,0.028,(X+0.075*sx,0,kz),seg=14,rings=8)
        elif iid=='legs_cargo':    # bulging cargo pockets on the thighs + big knee pads + ankle wraps
            box(s,'cAc',hp,(0.05,0.1,0.12),(X+0.08*sx,0,hz-0.25),0.02); sph(s,'cBc',kn,0.072,(X,-0.065,kz),(1,0.6,1.1))
            loft(s,'cAc',an,az+0.2,az+0.3,lambda t,X=X:(X,0,0.07,0.076),nv=4,nu=28,cap=(False,False),solid=0.01,mod=lambda a,z:1+0.03*math.sin(z*150))
        elif iid=='legs_tassets':  # overlapping armour skirt plates hanging from the hips, ringed around each thigh (front, outer side, back)
            for k,a in enumerate((0.0,0.8,1.6,2.5)):
                box(s,'cBm' if k==1 else 'cAm',hp,(0.12,0.022,0.26),(X+math.sin(a)*0.12*sx,-math.cos(a)*0.12,hz-0.1),0.01,rot=(0.1,0,-a*sx))
        elif iid=='legs_wraps':    # spiral cloth wraps from knee to ankle, open sandal straps over the boot, thigh sash
            for k in range(7): torus(s,'cAc',kn,0.066,0.012,(X,0,kz-0.05-k*0.045),(0.3*(1 if k%2 else -1),0,0))
            for k in range(3): torus(s,'cBc',an,0.07,0.009,(X,-0.02,az+0.02+k*0.06),(0.4,0,0))
            box(s,'cBc',hp,(0.03,0.02,0.4),(X,-0.085,hz-0.18),0.003,rot=(0,0.2*sx,0))
        elif iid=='legs_hydraulic':  # exposed hydraulic struts running down the back of the leg + piston at the ankle
            seg(s,'cBm',hp,(X+0.06*sx,0.07,hz-0.04),(X+0.06*sx,0.08,kz+0.06),0.022)
            seg(s,'cAm',kn,(X+0.05*sx,0.07,kz-0.02),(X+0.05*sx,0.06,az+0.12),0.02); seg(s,'cBm',kn,(X+0.05*sx,0.065,az+0.12),(X+0.04*sx,0.05,az+0.02),0.012)
            cyl(s,'cAm',kn,0.05,0.05,0.04,(X,0,kz),(0,math.radians(90),0),v=24)
        else: raise SystemExit('no legs art for '+iid)

# ===================== ARMS (upper arm on the shoulder joint, forearm on the elbow joint) =====================
def arms_item(iid):
    s='cos_'+iid
    for side,sx in (('L',1),('R',-1)):
        sh,el,wr=J['sh'+side],J['el'+side],J['wr'+side]; X=W(sh).x  # pieces sit on the fitted base-body arm (shoulder x from the rig)
        sz,ez,wz=W(sh).z,W(el).z,W(wr).z
        if iid=='arms_wraps':      # cable ties + tape spiralled round the forearms, loose cable end
            for k in range(6): torus(s,'cAc' if k%2 else 'cBc',el,0.05,0.008,(X,0,ez-0.04-k*0.035),(0.25*(1 if k%2 else -1),0,0))
            seg(s,'cA',el,(X,-0.05,ez-0.08),(X+0.03*sx,-0.09,ez-0.16),0.006)
        elif iid=='arms_sleeves':  # loose tarp sleeves flaring wide at the elbow
            loft(s,'cAc',sh,ez-0.06,sz+0.02,lambda t,X=X:(X,0,0.11-0.025*t,0.105-0.025*t),nv=10,nu=28,cap=(False,False),solid=0.008,mod=lambda a,z:1+0.06*math.sin(a*5+z*20),bevel=0.002)
        elif iid=='arms_piston':   # brass pistons along the forearm and upper arm, gauge dial at the elbow
            seg(s,'cAm',sh,(X+0.06*sx,-0.02,sz-0.04),(X+0.06*sx,-0.02,ez+0.04),0.02); seg(s,'cBm',el,(X+0.055*sx,-0.03,ez-0.02),(X+0.05*sx,-0.03,wz+0.03),0.016)
            cyl(s,'cAm',el,0.03,0.03,0.015,(X+0.06*sx,-0.03,ez),(0,math.radians(90),0),v=20); cyl(s,'cB',el,0.022,0.022,0.018,(X+0.065*sx,-0.03,ez),(0,math.radians(90),0),v=20)
        elif iid=='arms_conduit':  # slim bracer shells with a lit conduit line running elbow to wrist
            loft(s,'cA',el,wz+0.02,ez-0.03,lambda t,X=X:(X,0,0.052,0.05),nv=6,nu=28,cap=(False,False),solid=0.008,bevel=0.003)
            cyl(s,'cE',el,0.008,0.008,ez-wz-0.04,(X,-0.055,(ez+wz)/2),v=10)
        elif iid=='arms_fused':    # heavy fused plates on upper arm + forearm with glowing weld seams
            box(s,'cBm',sh,(0.12,0.13,0.22),(X+0.01*sx,0,sz-0.13),0.02); box(s,'cBm',el,(0.11,0.12,0.2),(X,0,ez-0.12),0.02)
            for zz,j in ((sz-0.13,sh),(ez-0.12,el)): box(s,'cE',j,(0.125,0.135,0.012),(X,0,zz),0.002)
        elif iid=='arms_pauldron':  # one huge layered pauldron on the left shoulder only (asymmetric), strap across
            if sx==1:
                for k in range(3): sph(s,'cAm' if k!=1 else 'cBm',sh,0.13-0.02*k,(X+0.03,0,sz+0.03-k*0.06),(1.15,1.1,0.55))
                box(s,'cBc',torsoP,(0.05,0.012,0.5),(0.05,-0.17,1.35),0.003,rot=(0,0.6,0))
        elif iid=='arms_bladed':   # forearm blades: a long curved fin along the outside of each forearm
            loft(s,'cAm',el,wz-0.05,ez+0.02,lambda t,X=X:(X+0.06*sx,0.0,0.006,0.045*(1-abs(2*t-1))+0.008),nv=10,nu=8,bevel=0.002)
            loft(s,'cA',el,wz+0.03,ez-0.03,lambda t,X=X:(X,0,0.048,0.046),nv=4,nu=24,cap=(False,False),solid=0.006)
        else: raise SystemExit('no arms art for '+iid)
# ===================== HANDS (on the wrist joint) =====================
def hands_item(iid):
    s='cos_'+iid
    for side,sx in (('L',1),('R',-1)):
        wr=J['wr'+side]; X=W(wr).x; wz=W(wr).z; hz=wz-0.06
        if iid=='hands_work':      # thick leather gloves with big flared cuffs
            sph(s,'cAc',wr,0.05,(X,0,hz),(0.9,0.7,1.2)); loft(s,'cAc',wr,wz-0.01,wz+0.07,lambda t,X=X:(X,0,0.05+0.02*t,0.048+0.02*t),nv=4,nu=24,cap=(False,False),solid=0.006)
        elif iid=='hands_nitrile':  # snug thin gloves with long cuffs up the forearm
            sph(s,'cA',wr,0.046,(X,0,hz),(0.85,0.62,1.15)); loft(s,'cA',wr,wz-0.01,wz+0.13,lambda t,X=X:(X,0,0.044,0.042),nv=4,nu=24,cap=(False,False),solid=0.004)
        elif iid=='hands_signet':   # brass knuckle bar with four rings and a crest plate
            box(s,'cAm',wr,(0.03,0.075,0.03),(X,-0.02,hz-0.03),0.008); cyl(s,'cBm',wr,0.022,0.022,0.01,(X,-0.06,hz-0.03),(math.radians(90),0,0),v=14)
        elif iid=='hands_ember':    # glowing palms inside open-backed grips
            sph(s,'cE',wr,0.035,(X,0.012,hz),(0.8,0.5,1.0)); torus(s,'cAm',wr,0.045,0.01,(X,0,wz-0.02))
        elif iid=='hands_gauntlet':  # oversized armoured fist gauntlets with knuckle spikes
            box(s,'cAm',wr,(0.09,0.1,0.12),(X,0,hz),0.02); loft(s,'cBm',wr,wz-0.01,wz+0.09,lambda t,X=X:(X,0,0.065+0.01*t,0.062+0.01*t),nv=4,nu=24,cap=(False,False),solid=0.008)
            for k in range(3): cyl(s,'cBm',wr,0.01,0.0,0.03,(X-0.025+0.025*k,-0.055,hz-0.03),(math.radians(90),0,0),v=6)
        elif iid=='hands_claws':     # three long curved claws off the back of each hand
            for k in range(3): seg(s,'cAm',wr,(X-0.02+0.02*k,-0.03,hz),(X-0.025+0.025*k,-0.09,hz-0.11),0.007,0.002,v=6)
            box(s,'cB',wr,(0.07,0.06,0.04),(X,0.0,hz+0.02),0.008)
        else: raise SystemExit('no hands art for '+iid)

# ===================== BACK (on torsoP; body holdout hides what the torso covers) =====================
def back_item(iid):
    s='cos_'+iid; T=torsoP; BY=0.19
    def wing(mat,sx,n,span,lift,feather):
        for k in range(n):
            a=0.25+k*0.28; L=span*(1-0.12*k)
            box(s,mat if k%2==0 else ('cE' if feather else 'cBm'),T,(L,0.02,0.07-0.006*k),(sx*(0.08+L/2*math.cos(a)),BY+0.05,1.5+lift+L/2*math.sin(a)-0.05*k),0.01,rot=(0,-sx*a,0))
    if iid=='back_rucksack':   # boxy rucksack with bedroll on top and side pouch
        box(s,'cAc',T,(0.3,0.16,0.34),(0,BY+0.06,1.36),0.03,bw=4); cyl(s,'cBc',T,0.055,0.055,0.36,(0,BY+0.06,1.58),(0,math.radians(90),0),v=20); box(s,'cAc',T,(0.06,0.1,0.14),(0.17,BY+0.05,1.28),0.02)
    elif iid=='back_cable':    # a thick power cable hanging from the spine in a long S-curve down to the knees
        pts=[(0.02*math.sin(t*6),BY+0.02+0.08*t,1.5-0.95*t) for t in np.linspace(0,1,12)]
        for i in range(11): seg(s,'cA',T,pts[i],pts[i+1],0.022)
        cyl(s,'cBm',T,0.04,0.04,0.06,(0,BY,1.5),(math.radians(90),0,0),v=18)
    elif iid=='back_cape':     # long tattered cape from the shoulders to the calves
        loft(s,'cAc',T,0.45,1.58,lambda t:(0,BY+0.12-0.1*t,0.3-0.06*t,0.04),nv=18,nu=40,cap=(False,False),solid=0.008,delete=lambda x,y,z:y<BY-0.02,mod=lambda a,z:1+0.06*math.sin(a*6+z*9),bevel=0.002)
    elif iid=='pm_back_hazard':  # short square cape to the waist with a stiff collar
        loft(s,'cAc',T,0.98,1.6,lambda t:(0,BY+0.06-0.04*t,0.27,0.03),nv=10,nu=40,cap=(False,False),solid=0.01,delete=lambda x,y,z:y<BY-0.02,bevel=0.002)
        box(s,'cA',T,(0.42,0.08,0.08),(0,BY-0.02,1.63),0.01)
    elif iid=='back_vents':    # two tall exhaust stacks over the shoulders with flared caps
        for sx in (1,-1): cyl(s,'cAm',T,0.04,0.045,0.5,(0.11*sx,BY+0.05,1.62),v=18,bevel=0.004); cyl(s,'cBm',T,0.06,0.05,0.05,(0.11*sx,BY+0.05,1.88),v=18)
    elif iid=='back_tank':     # one fat horizontal coolant cylinder with glass window and brackets
        cyl(s,'cA',T,0.09,0.09,0.42,(0,BY+0.09,1.4),(0,math.radians(90),0),v=28,bevel=0.01); box(s,'cE',T,(0.2,0.02,0.05),(0,BY+0.18,1.4),0.004)
        for sx in (1,-1): torus(s,'cBm',T,0.093,0.01,(0.15*sx,BY+0.09,1.4),(0,math.radians(90),0))
    elif iid=='back_array':    # three whip antennae of different heights fanning out, light at each tip
        for k,(x,h) in enumerate(((-0.1,0.45),(0.0,0.7),(0.1,0.55))):
            cyl(s,'cAm',T,0.008,0.004,h,(x+x*0.6,BY+0.04,1.55+h/2),(0,x*3,0),v=8); sph(s,'cE',T,0.016,(x+x*0.6+x*1.5*h,BY+0.04,1.55+h),seg=10,rings=6)
        box(s,'cB',T,(0.26,0.06,0.08),(0,BY+0.02,1.52),0.01)
    elif iid=='back_banner':   # tall pole with a hanging rectangular banner over one shoulder
        cyl(s,'cBm',T,0.012,0.012,1.0,(0.12,BY+0.05,1.55),v=10); box(s,'cAc',T,(0.22,0.01,0.42),(0.0,BY+0.06,1.78),0.004); box(s,'cB',T,(0.24,0.012,0.04),(0.0,BY+0.06,1.99),0.004)
    elif iid=='col_ronin_banner':  # twin narrow sashimono flags on crossed poles
        for sx in (1,-1): cyl(s,'cBm',T,0.01,0.01,0.9,(0.08*sx,BY+0.05,1.75),(0,0.18*sx,0),v=8); box(s,'cAc',T,(0.08,0.008,0.5),(0.14*sx,BY+0.055,1.95),0.003,rot=(0,0.18*sx,0))
    elif iid=='back_spine':    # bare vertebrae column rising above the head with rib spurs
        for k in range(10): sph(s,'cA',T,0.035-0.001*k,(0,BY+0.02,1.1+k*0.08),(1.3,1,0.8),seg=14,rings=8)
        for k in range(4):
            for sx in (1,-1): seg(s,'cB',T,(0,BY+0.02,1.2+k*0.1),(0.12*sx,BY-0.02,1.15+k*0.1),0.01,0.004,v=8)
    elif iid in ('back_disc','col_founder_plate'):  # disc: big flat brass disc / founder: tall shield plate with crest
        if iid=='back_disc': cyl(s,'cAm',T,0.3,0.3,0.03,(0,BY+0.08,1.5),(math.radians(90),0,0),v=48,bevel=0.006); torus(s,'cBm',T,0.27,0.012,(0,BY+0.1,1.5),(math.radians(90),0,0)); sph(s,'cE',T,0.04,(0,BY+0.1,1.5),(1,0.4,1))
        else: box(s,'cAm',T,(0.36,0.04,0.56),(0,BY+0.07,1.4),0.03,bw=4); box(s,'cBm',T,(0.12,0.05,0.2),(0,BY+0.1,1.46),0.01); cyl(s,'cBm',T,0.0,0.18,0.12,(0,BY+0.07,1.08),(math.radians(180),0,0),v=4)
    elif iid=='back_s1_halo':  # tall folded wings: narrow, upswept, crackling light edges
        for sx in (1,-1): wing('cA',sx,4,0.36,0.12,True)
    elif iid=='back_wings':    # wide ember wings: broad spread, layered feathers
        for sx in (1,-1): wing('cA',sx,5,0.5,0.0,True)
    elif iid=='pm_back_chrome':  # liquid wings: smooth curved blades sweeping down, glowing edge
        for sx in (1,-1):
            for k in range(3): loft(s,'cAm',T,0.0,1.0,lambda t,k=k,sx=sx:(sx*(0.1+0.55*t),BY+0.06+0.04*k,0.015,0.02),nv=10,nu=8,origin=(0,0,1.62-0.1*k),rot=(0,sx*(1.9+0.25*k),0),bevel=0.003)
            loft(s,'cE',T,0.0,1.0,lambda t,sx=sx:(sx*(0.1+0.6*t),BY+0.04,0.006,0.008),nv=8,nu=6,origin=(0,0,1.64),rot=(0,sx*1.85,0))
    else: raise SystemExit('no back art for '+iid)
COS_SLOT,_cs=os.environ['COS'].split(':'); COS_STYLES=_cs.split(',')
BUILD={'head':head_item,'torso':torso_item,'legs':legs_item,'arms':arms_item,'hands':hands_item,'back':back_item}
for st in COS_STYLES: BUILD[COS_SLOT](st)
COSLAYERS=['cos_'+st for st in COS_STYLES]
print('cos built',COSLAYERS,'head',round(HR,3),round(HT,3),flush=True)

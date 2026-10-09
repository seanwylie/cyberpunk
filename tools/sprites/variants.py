# Alternate full-body meshes ("radical replacement" endpoint of the art guide), built on the SAME rig / joints / slot names as the base body.
# exec'd from build_char.py when env VARIANT=<heavy|surgical|market> (optionally VSLOTS=a,b,c to replace only some slots).
# Every function builds one slot in world-space rest coordinates and parents to the rig joints, exactly like the base meshes.
PI=math.pi; R90=PI/2
M['redsteel']=mk_mat('redsteel','redsteel',tile=1.5,rough=1.0,metal=0.35,wear=(rgba('#a4a59f'),1.0),bump=1.1,bdist=0.006)
M['iron']=mk_mat('iron','iron',tile=1.8,rough=1.0,metal=0.75,wear=(rgba('#9d9e98'),0.9),bump=0.8)
M['slate']=mk_mat('slate','slate',tile=1.6,rough=1.0,bump=1.0)
M['burlap']=mk_mat('burlap','burlap',tile=1.6,rough=1.0,bump=1.0)
SX=(('L',1),('R',-1))
def jp(n): return W(J[n])
def seg(slot,mat,joint,p0,p1,r0,r1=None,v=14,bevel=0.003):
    """tapered cylinder between two world points"""
    p0=Vector(p0); p1=Vector(p1); d=p1-p0; L=d.length; mid=(p0+p1)/2
    q=Vector((0,0,1)).rotation_difference(d.normalized()); e=q.to_euler()
    return cyl(slot,mat,joint,r0,r1 if r1 is not None else r0,L,tuple(mid),tuple(e),v=v,bevel=bevel)
def rods(slot,joint,x,y,z0,z1,r=0.012,mat='metal'): return cyl(slot,mat,joint,r,r,abs(z1-z0),(x,y,(z0+z1)/2),v=10,bevel=0.0015)
def disc(slot,mat,joint,center,radius,th,axis='x',teeth=0,tooth=0.12,v=48,cap=True):
    rot=(0,R90,0) if axis=='x' else (R90,0,0)
    mod=(lambda a,z:1-tooth*((a*teeth/(2*PI))%1.0)) if teeth else None
    return loft(slot,mat,joint,-th/2,th/2,lambda t:(0,0,radius,radius),nv=2,nu=v,mod=mod,cap=(cap,cap),origin=center,rot=rot,bevel=0.003)
def bladeloft(slot,mat,joint,xc,ytop,ztop,zbot,w0,thick,curve=0.06,nu=16):
    """flat tapering blade hanging down from ztop to zbot (point at the bottom), curving forward (-y)"""
    return loft(slot,mat,joint,zbot,ztop,lambda t:(xc,ytop-curve*(1-t)**2,0.003+w0*t**0.55,thick*(0.35+0.65*t)),nv=14,nu=nu,cap=(True,True),bevel=0.002)

# ===================================================================== HEAVY INDUSTRIAL (Harrow-Brandt) =====================================================================
def hv_face():
    s='face'; z=hb+0.1
    box(s,'redsteel',headP,(0.2,0.22,0.25),(0,0.0,z+0.01),0.022,bw=3)
    box(s,'redsteel',headP,(0.17,0.18,0.04),(0,0.0,z+0.15),0.012)                                  # brow ridge / roof plate
    box(s,'rubber',headP,(0.15,0.03,0.18),(0,-0.115,z+0.01),0.004)                                      # recessed intake
    for k in range(8): box(s,'metal',headP,(0.012,0.02,0.16),(-0.07+k*0.02,-0.13,z+0.01),0.002)        # grille slats
    box(s,'iron',headP,(0.17,0.04,0.02),(0,-0.12,z+0.1),0.004); box(s,'iron',headP,(0.17,0.04,0.02),(0,-0.12,z-0.08),0.004)
    for sx in (1,-1):
        box(s,'iron',headP,(0.04,0.15,0.13),(0.108*sx,0.0,z-0.01),0.01)                              # cheek housings
        cyl(s,'iron',headP,0.013,0.013,0.28,(0.12*sx,0.07,z+0.07),(0.12,0,0),v=10,bevel=0.002)       # side exhaust pipe
        sph(s,'amber',headP,0.012,(0.07*sx,-0.103,z+0.1),seg=10,rings=6)                              # indicator lamp
    cyl(s,'iron',headP,0.055,0.065,0.12,(0,0,hb-0.03),v=16,bevel=0.004)                              # neck piston
    box(s,'redsteel',headP,(0.17,0.12,0.045),(0,-0.01,hb+0.0),0.01)                                  # jaw brace
    cyl(s,'metal',headP,0.006,0.004,0.12,(-0.05,0.05,z+0.2),(0.1,0,0.1),v=6,bevel=0.001)             # whip antenna
def hv_torso():
    s='torso'
    box(s,'iron',hips,(0.3,0.19,0.13),(0,0,0.97),0.012,bw=3); box(s,'redsteel',hips,(0.2,0.04,0.17),(0,-0.105,0.9),0.012)           # pelvis block + front guard
    loft(s,'iron',torsoP,1.0,1.22,lambda t:(0,0,0.13,0.1),nv=10,nu=32,mod=lambda a,z:1+0.08*max(0,math.sin(z*70)),cap=(True,True))   # ribbed abdomen
    loft(s,'redsteel',torsoP,1.18,1.62,prof_pts([(0,0,0,0.17,0.13),(0.45,0,0,0.255,0.155),(1,0,0,0.235,0.14)]),nv=18,nu=40,bevel=0.004,mod=lambda a,z:1+0.015*math.sin(5*a))
    box(s,'redsteel',torsoP,(0.22,0.04,0.26),(0,-0.15,1.42),0.014,bw=3)                              # breastplate
    for k in range(4): box(s,'rubber',torsoP,(0.14,0.014,0.016),(0,-0.176,1.5-k*0.05),0.002)          # vents
    for sx in (1,-1): box(s,'iron',torsoP,(0.05,0.1,0.14),(0.16*sx,-0.1,1.36),0.01)                    # flank frames
    box(s,'iron',torsoP,(0.2,0.12,0.08),(0,0.0,1.64),0.012)                                           # trapezius yoke
    for sx in (1,-1):
        cyl(s,'iron',torsoP,0.032,0.032,0.42,(0.1*sx,0.17,1.58),(0.0,0,0),v=14,bevel=0.003); cyl(s,'metal',torsoP,0.036,0.036,0.03,(0.1*sx,0.17,1.79),v=14,bevel=0.002)   # exhaust stacks
    box(s,'iron',torsoP,(0.28,0.1,0.2),(0,0.15,1.4),0.012)                                            # back engine block
    loft(s,'burlap',hips,0.5,0.98,lambda t:(0,-0.015,0.22-0.03*t,0.125-0.02*t),nv=14,nu=28,cap=(False,False),solid=0.012,delete=lambda x,y,z:y>-0.05 or abs(x)>0.19,mod=lambda a,z:1+0.04*math.sin(a*9+z*14))  # apron
    loft(s,'canvas',torsoP,1.0,1.045,lambda t:(0,0,0.205,0.15),nv=3,nu=40,cap=(False,False),solid=0.014,bevel=0.003)   # belt
    seg(s,'rubber',torsoP,(-0.16,-0.14,1.2),(0.12,0.15,1.5),0.012); seg(s,'rubber',torsoP,(0.16,-0.14,1.2),(-0.1,0.15,1.55),0.012)  # cabling
def hv_arm(sx,saw):
    s='arm'+('L' if sx==1 else 'R'); sh,el,wr=J['sh'+s[-1]],J['el'+s[-1]],J['wr'+s[-1]]; shp,elp,wrp=W(sh),W(el),W(wr); X=shp.x
    sph(s,'redsteel',sh,0.1,(X+0.035*sx,0,shp.z+0.04),(1.2,1.05,0.75))                                 # pauldron
    box(s,'iron',sh,(0.04,0.2,0.04),(X+0.1*sx,0,shp.z+0.0),0.006)
    cyl(s,'iron',sh,0.06,0.06,0.3,(X,0,(shp.z+elp.z)/2+0.02),v=18,bevel=0.004)                         # upper arm core
    box(s,'redsteel',sh,(0.13,0.15,0.17),(X+0.01*sx,0,shp.z-0.12),0.014,bw=3)                          # upper armor
    for dx in (-0.075,0.075): rods(s,sh,X+dx*sx*1.0,-0.075,shp.z-0.22,shp.z-0.02,0.011)                # hydraulic rods
    sph(s,'iron',el,0.078,(X,0,elp.z),seg=20,rings=14); cyl(s,'metal',el,0.04,0.04,0.2,(X,0,elp.z),(0,R90,0),v=16,bevel=0.003)
    box(s,'redsteel',el,(0.165,0.17,0.25),(X,0,elp.z-0.15),0.016,bw=3)                                # forearm shroud
    box(s,'iron',el,(0.18,0.19,0.04),(X,0,elp.z-0.29),0.008)
    if saw: box(s,'iron',el,(0.07,0.12,0.12),(X+0.09*sx,0,elp.z-0.16),0.01)                            # saw drive gearbox
    else:
        for dx in (-0.08,0.08): rods(s,el,X+dx,-0.1,elp.z-0.28,elp.z-0.02,0.012)
def hv_handL():
    s='handL'; wr=J['wrL']; w=W(wr); X=w.x
    box(s,'iron',wr,(0.1,0.07,0.08),(X+0.045,0,w.z-0.01),0.008)                                      # mount
    cyl(s,'iron',wr,0.065,0.065,0.1,(X+0.1,0,w.z-0.02),(0,R90,0),v=20,bevel=0.004)                     # hub motor
    disc(s,'metal',wr,(X+0.15,0,w.z-0.04),0.285,0.022,'x',teeth=18,tooth=0.17,v=72)                     # circular saw blade
    disc(s,'redsteel',wr,(X+0.138,0,w.z-0.04),0.11,0.012,'x',v=28); disc(s,'iron',wr,(X+0.172,0,w.z-0.04),0.075,0.018,'x',v=24)
    for a in range(6): bolt(s,wr,(X+0.186,0.052*math.cos(a*PI/3),w.z-0.04+0.052*math.sin(a*PI/3)),(0,R90,0),0.009,0.008)
    box(s,'metal',wr,(0.01,0.34,0.04),(X+0.175,0.0,w.z-0.04+0.0),0.002)                              # guard rim notch
def hv_handR():
    s='handR'; wr=J['wrR']; w=W(wr); X=w.x
    cyl(s,'iron',wr,0.065,0.07,0.07,(X,0,w.z-0.02),v=18,bevel=0.004); box(s,'iron',wr,(0.12,0.09,0.09),(X,0,w.z-0.09),0.01)    # wrist + palm block
    for k,dx in enumerate((-0.04,0.0,0.04)):                                                           # three heavy claw fingers
        seg(s,'metal',wr,(X+dx,-0.02,w.z-0.13),(X+dx,-0.055,w.z-0.25),0.019,0.016); seg(s,'iron',wr,(X+dx,-0.055,w.z-0.25),(X+dx,-0.03,w.z-0.35),0.016,0.008)
    seg(s,'metal',wr,(X-0.06*1,0.03,w.z-0.1),(X-0.08,0.07,w.z-0.22),0.017,0.012); seg(s,'iron',wr,(X-0.08,0.07,w.z-0.22),(X-0.06,0.05,w.z-0.3),0.012,0.006)   # opposing thumb
    box(s,'redsteel',wr,(0.1,0.03,0.05),(X,-0.055,w.z-0.07),0.008)
def hv_leg(sx):
    s='leg'+('L' if sx==1 else 'R'); hp,kn,an=J['hp'+s[-1]],J['kn'+s[-1]],J['an'+s[-1]]; hpp,knp,anp=W(hp),W(kn),W(an); X=hpp.x
    cyl(s,'iron',hp,0.075,0.062,0.46,(X,0,(hpp.z+knp.z)/2),v=18,bevel=0.004)                           # thigh core
    box(s,'redsteel',hp,(0.17,0.19,0.27),(X,-0.0,hpp.z-0.17),0.016,bw=3); box(s,'iron',hp,(0.19,0.2,0.05),(X,0,hpp.z-0.02),0.008)
    for dx in (-0.095,0.095): cyl(s,'iron',hp,0.024,0.024,0.2,(X+dx,-0.075,hpp.z-0.2),v=12,bevel=0.003); rods(s,hp,X+dx,-0.075,hpp.z-0.42,hpp.z-0.12,0.013)   # pistons
    sph(s,'iron',kn,0.085,(X,0,knp.z),seg=18,rings=12); box(s,'iron',kn,(0.19,0.17,0.13),(X,0,knp.z),0.012,bw=3); box(s,'redsteel',kn,(0.15,0.06,0.12),(X,-0.11,knp.z+0.01),0.015,rot=(0.2,0,0))  # knee
    cyl(s,'iron',kn,0.058,0.05,0.42,(X,0.0,(knp.z+anp.z)/2+0.02),v=16,bevel=0.003)                    # shin core
    box(s,'redsteel',kn,(0.14,0.06,0.28),(X,-0.085,knp.z-0.2),0.012,rot=(0.04,0,0)); box(s,'iron',kn,(0.15,0.09,0.2),(X,0.08,knp.z-0.2),0.012)
    for dx in (-0.08,0.08): rods(s,kn,X+dx,0.07,anp.z+0.06,knp.z-0.06,0.011)
def hv_foot(sx):
    s='foot'+('L' if sx==1 else 'R'); an=J['an'+s[-1]]; a=W(an); X=a.x
    box(s,'iron',an,(0.14,0.14,0.11),(X,0,a.z+0.04),0.012)                                            # ankle block
    box(s,'iron',an,(0.2,0.44,0.07),(X,-0.06,a.z-0.045),0.014,bw=3)                                   # sole stomper
    box(s,'redsteel',an,(0.17,0.32,0.05),(X,-0.05,a.z-0.0),0.014,bw=3); box(s,'redsteel',an,(0.18,0.1,0.07),(X,-0.2,a.z-0.015),0.012,rot=(-0.15,0,0))
    for k in range(6): box(s,'rubber',an,(0.205,0.02,0.016),(X,-0.24+k*0.075,a.z-0.085),0.004,bw=2)
    for dx in (-0.055,0.055): bolt(s,an,(X+dx,-0.1,a.z+0.03),(0,0,0),0.011,0.008,'metal')

# ===================================================================== PRECISION SURGICAL (Aldane) =====================================================================
def ps_face():
    s='face'; z=hb+0.11
    loft(s,'ivory',headP,hb-0.02,hb+0.3,lambda t:(0,0.004*math.sin(t*3.1),max(0.01,0.09*math.sin(min(1,(t*0.82+0.18))*PI*0.93)**0.8*(0.78+0.22*t)),max(0.012,0.108*math.sin(min(1,(t*0.82+0.18))*PI*0.93)**0.8)),nv=36,nu=40,cap=(True,True),subsurf=1)  # mouthless ceramic egg, tapering to a chin
    for sx in (1,-1):
        seg(s,'glass',headP,(0.017*sx,-0.103,z+0.07),(0.057*sx,-0.088,z+0.045),0.0065,0.0045,v=8,bevel=0.0008)   # slit eyes
    box(s,'slate',headP,(0.004,0.002,0.2),(0,-0.108,z+0.02),0.0008)                                            # centre seam
    cyl(s,'rubber',headP,0.034,0.04,0.12,(0,0,hb-0.04),v=14,bevel=0.003)                                      # slim neck
    for k in range(3): torus(s,'ivory',headP,0.042,0.008,(0,0,hb-0.07+k*0.028),(0,0,0))
    sph(s,'ivory',headP,0.014,(0.089,0.0,z-0.02),(0.5,1,1)); sph(s,'ivory',headP,0.014,(-0.089,0.0,z-0.02),(0.5,1,1))
def ps_torso():
    s='torso'
    loft(s,'ivory',hips,0.86,1.06,prof_pts([(0,0,0,0.115,0.08),(0.5,0,0,0.125,0.085),(1,0,0,0.095,0.07)]),nv=10,nu=32,bevel=0.003)   # pelvis
    for k in range(3): torus(s,'rubber',torsoP,0.088-0.0,0.01,(0,0,1.08+k*0.05),(0,0,0))                          # spinal waist rings
    loft(s,'ivory',torsoP,1.2,1.62,prof_pts([(0,0,0,0.088,0.07),(0.5,0,0,0.145,0.095),(1,0,0,0.135,0.085)]),nv=18,nu=36,bevel=0.003,subsurf=0)   # narrow chest
    for k in range(5): torus(s,'ivory',torsoP,0.115+0.006*k,0.007,(0,-0.005,1.27+0.065*k),(0,0,0))                # rib hoops
    box(s,'rubber',torsoP,(0.03,0.02,0.4),(0,-0.09,1.4),0.004); box(s,'slate',torsoP,(0.05,0.012,0.34),(0,-0.108,1.4),0.003)  # sternal strip
    cyl(s,'ivory',torsoP,0.045,0.05,0.12,(0,0,1.66),v=14,bevel=0.003)                                            # collar
    loft(s,'slate',torsoP,1.62,1.2,lambda t:(0,0.0,0.15+0.01*t,0.1),nv=3,nu=3,cap=(False,False)) if False else None
    ribbon(s,'slate',torsoP,[(-0.16,-0.09,1.6),(-0.08,-0.115,1.45),(0.0,-0.118,1.32),(0.1,-0.115,1.18),(0.15,-0.1,1.05)],[(0,-1,0.1)]*5,0.1,0.012)   # diagonal sash
    loft(s,'slate',hips,0.38,1.0,lambda t:(0,0.005,0.115+0.14*(1-t)**1.3,0.09+0.09*(1-t)**1.3),nv=24,nu=36,cap=(False,False),solid=0.01,
         mod=lambda a,z:1+0.07*math.sin(a*7+z*10)*(1-(z-0.38)/0.62*0.5)+0.03*math.sin(z*45),delete=lambda x,y,z:(abs(x)<0.05 and y<0 and z<0.88 and False)) # long draped skirt
    box(s,'ivory',hips,(0.05,0.03,0.07),(0,-0.115,1.02),0.006); sph(s,'metal',hips,0.01,(0.0,-0.14,1.02))
    seg(s,'rubber',torsoP,(0.06,-0.1,1.58),(0.02,-0.11,1.1),0.007)                                               # hydraulic line
def ps_arm(sx):
    s='arm'+('L' if sx==1 else 'R'); sh,el,wr=J['sh'+s[-1]],J['el'+s[-1]],J['wr'+s[-1]]; shp,elp,wrp=W(sh),W(el),W(wr); X=shp.x-0.03*sx
    sph(s,'ivory',sh,0.05,(X+0.03*sx,0,shp.z),seg=18,rings=12)
    loft(s,'ivory',sh,elp.z,shp.z,lambda t:(X,0,0.032+0.01*t,0.03+0.01*t),nv=12,nu=24,bevel=0.003)                 # slim upper arm
    for z in (shp.z-0.09,shp.z-0.19): torus(s,'slate',sh,0.04,0.007,(X,0,z))
    sph(s,'rubber',el,0.036,(X,0,elp.z),seg=16,rings=10); cyl(s,'ivory',el,0.034,0.034,0.014,(X+0.04,0,elp.z),(0,R90,0),v=18,bevel=0.002); cyl(s,'ivory',el,0.034,0.034,0.014,(X-0.04,0,elp.z),(0,R90,0),v=18,bevel=0.002)
    loft(s,'ivory',el,wrp.z,elp.z,lambda t:(X,0,0.026+0.014*t,0.024+0.013*t),nv=12,nu=24,bevel=0.003)                # slim forearm
    box(s,'slate',el,(0.06,0.05,0.016),(X,0,wrp.z+0.07),0.003); torus(s,'metal',el,0.032,0.006,(X,0,wrp.z+0.02))
def ps_hand(sx):
    s='hand'+('L' if sx==1 else 'R'); wr=J['wr'+s[-1]]; w=W(wr); X=w.x-0.03*sx
    cyl(s,'ivory',wr,0.03,0.026,0.06,(X,0,w.z-0.02),v=14,bevel=0.003)                                              # wrist cuff
    bladeloft(s,'ivory',wr,X,-0.012,w.z-0.04,w.z-0.62,0.036,0.008,curve=0.09)                                     # long blade forearm extension
    box(s,'slate',wr,(0.008,0.012,0.4),(X,-0.02,w.z-0.34),0.001,rot=(0.12,0,0))                                   # slate edge inlay
    for k in range(3): torus(s,'metal',wr,0.028-k*0.002,0.004,(X,-0.002,w.z-0.07-0.04*k))
def ps_leg(sx):
    s='leg'+('L' if sx==1 else 'R'); hp,kn,an=J['hp'+s[-1]],J['kn'+s[-1]],J['an'+s[-1]]; hpp,knp,anp=W(hp),W(kn),W(an); X=hpp.x-0.03*sx
    sph(s,'ivory',hp,0.052,(X,0,hpp.z),seg=16,rings=10)
    loft(s,'ivory',hp,knp.z,hpp.z-0.01,prof_pts([(0,X,0,0.034,0.036),(0.4,X,0,0.04,0.044),(1,X,0,0.056,0.06)]),nv=16,nu=28,bevel=0.003)
    box(s,'slate',hp,(0.04,0.02,0.2),(X,-0.052,hpp.z-0.2),0.004); torus(s,'rubber',hp,0.05,0.008,(X,0,hpp.z-0.14),(0,0,0))
    sph(s,'rubber',kn,0.044,(X,0,knp.z),seg=16,rings=10); box(s,'ivory',kn,(0.05,0.05,0.07),(X,-0.05,knp.z+0.01),0.008,rot=(0.3,0.0,0.0))
    for dx in (-1,1): cyl(s,'ivory',kn,0.036,0.036,0.012,(X+0.047*dx,0,knp.z),(0,R90,0),v=18,bevel=0.002)
    loft(s,'ivory',kn,anp.z+0.02,knp.z-0.03,prof_pts([(0,X,0.0,0.022,0.024),(0.5,X,0.012,0.034,0.034),(1,X,0.0,0.04,0.04)]),nv=16,nu=24,bevel=0.003)
    box(s,'slate',kn,(0.035,0.016,0.14),(X,-0.036,knp.z-0.19),0.003); torus(s,'metal',kn,0.03,0.005,(X,0.0,anp.z+0.08))
def ps_foot(sx):
    s='foot'+('L' if sx==1 else 'R'); an=J['an'+s[-1]]; a=W(an); X=a.x-0.03*sx
    sph(s,'rubber',an,0.03,(X,0,a.z+0.02),seg=12,rings=8)
    loft(s,'ivory',an,0,0.3,prof_pts([(0,0,0.03,0.03,0.034),(0.5,0,0.025,0.026,0.026),(1,0,0.012,0.012,0.012)]),nv=12,nu=20,origin=(X,a.y+0.07,a.z-0.045),rot=(R90,0,0),cap=(True,True),bevel=0.002)   # long pointed foot
    seg(s,'ivory',an,(X,a.y+0.07,a.z-0.01),(X,a.y+0.09,a.z-0.085),0.02,0.006,v=10,bevel=0.001)                     # stiletto heel
    box(s,'slate',an,(0.03,0.07,0.012),(X,a.y-0.04,a.z-0.015),0.002)

# ===================================================================== MASS-MARKET (Kestrel): repurposed, mismatched, olive =====================================================================
def mm_face():
    s='face'; z=hb+0.1
    box(s,'olive',headP,(0.19,0.2,0.2),(0,0,z),0.016,bw=3); box(s,'olive',headP,(0.16,0.17,0.04),(0,0,z+0.12),0.01)
    box(s,'rubber',headP,(0.15,0.04,0.12),(0,-0.1,z+0.01),0.006)
    cyl(s,'glass',headP,0.04,0.04,0.03,(0.0,-0.125,z+0.01),(R90,0,0),v=24,bevel=0.003); torus(s,'metal',headP,0.043,0.006,(0,-0.14,z+0.01),(R90,0,0))     # sensor lens
    sph(s,'amber',headP,0.012,(0.07,-0.122,z+0.07),seg=8,rings=6); sph(s,'amber',headP,0.012,(-0.07,-0.122,z+0.07),seg=8,rings=6)
    box(s,'metal',headP,(0.08,0.07,0.05),(0.12,0.02,z+0.12),0.006,rot=(0,0,0.2)); cyl(s,'rubber',headP,0.012,0.012,0.18,(-0.11,0.05,z-0.05),(0,0.3,0),v=8)
    box(s,'ivory',headP,(0.04,0.05,0.09),(-0.1,-0.04,z-0.02),0.005)                                              # replacement bone-white cheek panel
    cyl(s,'iron',headP,0.045,0.05,0.12,(0,0,hb-0.03),v=12,bevel=0.003)
def mm_torso():
    s='torso'
    box(s,'olive',hips,(0.26,0.17,0.12),(0,0,0.97),0.012); loft(s,'olive',torsoP,1.05,1.62,prof_pts([(0,0,0,0.15,0.11),(0.5,0,0,0.19,0.13),(1,0,0,0.2,0.12)]),nv=14,nu=32,bevel=0.006,mod=lambda a,z:1+0.02*math.sin(4*a))
    box(s,'ivory',torsoP,(0.14,0.03,0.2),(-0.04,-0.12,1.4),0.008); box(s,'canvas',torsoP,(0.12,0.05,0.14),(0.06,-0.11,1.18),0.01); box(s,'metal',torsoP,(0.2,0.04,0.04),(0,-0.14,1.55),0.004)
    loft(s,'burlap',torsoP,1.2,1.64,lambda t:(0,0.0,0.2-0.02*t,0.135),nv=10,nu=32,cap=(False,False),solid=0.012,delete=lambda x,y,z:y<-0.0 and x>-0.02,mod=lambda a,z:1+0.04*math.sin(a*8+z*12))   # draped half-cloak
    for sx in (1,-1): cyl(s,'rubber',torsoP,0.012,0.012,0.3,(0.1*sx,0.12,1.3),(0.2*sx,0,0),v=8)
    box(s,'iron',torsoP,(0.16,0.09,0.12),(0,0.13,1.35),0.01); loft(s,'canvas',torsoP,1.0,1.045,lambda t:(0,0,0.18,0.125),nv=3,nu=36,cap=(False,False),solid=0.012)
def mm_arm(sx):
    s='arm'+('L' if sx==1 else 'R'); sh,el,wr=J['sh'+s[-1]],J['el'+s[-1]],J['wr'+s[-1]]; shp,elp,wrp=W(sh),W(el),W(wr); X=shp.x
    big=(sx==1)
    sph(s,'olive',sh,0.075 if big else 0.055,(X,0,shp.z),seg=14,rings=10)
    r=0.052 if big else 0.034
    loft(s,'olive' if big else 'ivory',sh,elp.z,shp.z,lambda t:(X,0,r*(0.9+0.15*t),r*(0.9+0.15*t)),nv=10,nu=24,bevel=0.004)
    rods(s,sh,X+0.06,-0.04,elp.z+0.02,shp.z-0.04,0.01); box(s,'metal',sh,(0.08,0.06,0.04),(X,0,shp.z-0.15),0.005)
    sph(s,'rubber',el,0.05 if big else 0.038,(X,0,elp.z),seg=14,rings=8)
    loft(s,'ivory' if big else 'olive',el,wrp.z,elp.z,lambda t:(X,0,0.04*(0.9+0.2*t) if big else 0.03,0.04*(0.9+0.2*t) if big else 0.03),nv=10,nu=24,bevel=0.003)
    box(s,'metal',el,(0.1,0.1,0.03),(X,0,elp.z-0.1),0.004); box(s,'canvas',el,(0.09,0.085,0.05),(X,0,elp.z-0.2),0.006)
def mm_hand(sx):
    s='hand'+('L' if sx==1 else 'R'); wr=J['wr'+s[-1]]; w=W(wr); X=w.x
    if sx==1:   # jackhammer / drill bit
        cyl(s,'iron',wr,0.05,0.045,0.1,(X,0,w.z-0.04),v=14,bevel=0.003); seg(s,'metal',wr,(X,0,w.z-0.09),(X,0,w.z-0.36),0.032,0.004,v=12,bevel=0.001)
        for k in range(4): torus(s,'metal',wr,0.028-k*0.005,0.005,(X,0,w.z-0.13-k*0.05),(0,0,0))
    else:       # two-pronged salvage grabber
        box(s,'olive',wr,(0.09,0.07,0.08),(X,0,w.z-0.05),0.008)
        for dx in (-0.035,0.035): seg(s,'metal',wr,(X+dx,0,w.z-0.09),(X+dx*0.4,-0.05,w.z-0.24),0.014,0.008); seg(s,'iron',wr,(X+dx*0.4,-0.05,w.z-0.24),(X+dx*1.3,-0.075,w.z-0.3),0.008,0.004)
def mm_leg(sx):
    s='leg'+('L' if sx==1 else 'R'); hp,kn,an=J['hp'+s[-1]],J['kn'+s[-1]],J['an'+s[-1]]; hpp,knp,anp=W(hp),W(kn),W(an); X=hpp.x
    sph(s,'olive',hp,0.07,(X,0,hpp.z),seg=12,rings=8)
    if sx==1:    # mismatched stilt limb, thin
        seg(s,'ivory',hp,(X,0,hpp.z),(X,0,knp.z),0.04,0.034); sph(s,'rubber',kn,0.045,(X,0,knp.z),seg=12,rings=8); seg(s,'olive',kn,(X,0,knp.z),(X,0,anp.z+0.05),0.034,0.026)
        box(s,'canvas',hp,(0.09,0.09,0.14),(X,0,hpp.z-0.2),0.01)
    else:        # chunky reclaimed limb
        loft(s,'olive',hp,knp.z,hpp.z,lambda t:(X,0,0.06+0.03*t,0.065+0.03*t),nv=10,nu=26,bevel=0.006); sph(s,'iron',kn,0.07,(X,0,knp.z),seg=14,rings=10)
        loft(s,'olive',kn,anp.z+0.04,knp.z,lambda t:(X,0,0.05+0.015*t,0.052+0.012*t),nv=10,nu=26,bevel=0.005); box(s,'ivory',kn,(0.1,0.04,0.2),(X,-0.06,knp.z-0.2),0.01); rods(s,kn,X+0.07,0.03,anp.z+0.06,knp.z-0.04,0.012)
def mm_foot(sx):
    s='foot'+('L' if sx==1 else 'R'); an=J['an'+s[-1]]; a=W(an); X=a.x
    if sx==1:
        box(s,'rubber',an,(0.1,0.22,0.05),(X,-0.04,a.z-0.05),0.01); box(s,'metal',an,(0.07,0.1,0.06),(X,0.0,a.z+0.0),0.008)
    else:
        box(s,'olive',an,(0.14,0.3,0.07),(X,-0.06,a.z-0.045),0.012); box(s,'rubber',an,(0.15,0.31,0.03),(X,-0.06,a.z-0.09),0.006); box(s,'olive',an,(0.1,0.12,0.09),(X,0,a.z+0.01),0.01)

BUILD={
 'heavy':   {'face':hv_face,'torso':hv_torso,'armL':lambda:hv_arm(1,True),'armR':lambda:hv_arm(-1,False),'handL':hv_handL,'handR':hv_handR,'legL':lambda:hv_leg(1),'legR':lambda:hv_leg(-1),'footL':lambda:hv_foot(1),'footR':lambda:hv_foot(-1)},
 'surgical':{'face':ps_face,'torso':ps_torso,'armL':lambda:ps_arm(1),'armR':lambda:ps_arm(-1),'handL':lambda:ps_hand(1),'handR':lambda:ps_hand(-1),'legL':lambda:ps_leg(1),'legR':lambda:ps_leg(-1),'footL':lambda:ps_foot(1),'footR':lambda:ps_foot(-1)},
 'market':  {'face':mm_face,'torso':mm_torso,'armL':lambda:mm_arm(1),'armR':lambda:mm_arm(-1),'handL':lambda:mm_hand(1),'handR':lambda:mm_hand(-1),'legL':lambda:mm_leg(1),'legR':lambda:mm_leg(-1),'footL':lambda:mm_foot(1),'footR':lambda:mm_foot(-1)},
}
def apply_variant(name,slots):
    for sl in slots:
        for (o,mat,j) in SLOTOBJ.get(sl,[]): bpy.data.objects.remove(o,do_unlink=True)
        SLOTOBJ[sl]=[]
        BUILD[name][sl]()

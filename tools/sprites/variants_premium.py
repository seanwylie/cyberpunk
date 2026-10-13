# Premium skin-line bodies (store skins, docs/MONETIZATION.md). exec'd at the end of variants.py.
# Each premium body = an existing variant mesh set (same rig, same slots) re-materialed in a painterly, stylized palette
# (flat-ish base colour, soft spec, emissive inlays) PLUS unique silhouette pieces (crystal pauldrons, halo crest, petal fins,
# kasa hat, scabbard, founder mantle). Emission is integrated in the mesh, so the glow is baked into the frames, not overlaid.
def pm_mat(name,col,rough=0.45,metal=0.0,emit=None,es=0.0,spec=0.5,coat=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=rgba(col); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    b.inputs['Specular IOR Level'].default_value=spec
    try: b.inputs['Coat Weight'].default_value=coat
    except Exception: pass
    if emit: b.inputs['Emission Color'].default_value=rgba(emit); b.inputs['Emission Strength'].default_value=es
    M[name]=m; return m
PAL={
 'arcforge':{ # Arc-Forge Saint: ivory enamel, brushed gold, deep-blue cloth, arcforge-blue crystal
   'enamel':('#efe6cf',0.35,0.0), 'gold':('#d7a63e',0.28,0.95), 'navy':('#1d2c5a',0.7,0.0), 'gem':('#7fd8ff',0.12,0.0,'#5ac8ff',7.0), 'dark':('#2a2c33',0.5,0.3)},
 'bloom':{   # Chrome Bloom: pearl chrome, orchid biotech flesh, magenta glow veins
   'enamel':('#e9dcf0',0.25,0.6), 'gold':('#b98ad8',0.22,0.9), 'navy':('#43244f',0.65,0.0), 'gem':('#ff7ad9',0.15,0.0,'#ff5ccf',6.0), 'dark':('#2b1d33',0.45,0.2)},
 'ronin':{   # Neon Ronin: lacquered black-red armour, cyan neon edge, bone cloth
   'enamel':('#1b1b20',0.3,0.2), 'gold':('#a5302c',0.3,0.15), 'navy':('#d9d1c0',0.8,0.0), 'gem':('#6ff6ff',0.1,0.0,'#3ff0ff',7.0), 'dark':('#0f0f12',0.5,0.4)},
 'founder':{ # Founder's Mark: blackened brass, oxblood leather, warm amber filament
   'enamel':('#3a2f26',0.4,0.7), 'gold':('#b88a46',0.3,0.95), 'navy':('#5a1e1c',0.75,0.0), 'gem':('#ffc06a',0.15,0.0,'#ffb04a',5.0), 'dark':('#17130f',0.55,0.4)},
}
BASE_OF={'arcforge':'surgical','bloom':'market','ronin':'heavy','founder':'heavy'}
# old material -> role
ROLE={'ivory':'enamel','redsteel':'enamel','olive':'enamel','metal':'gold','iron':'dark','slate':'navy','burlap':'navy','canvas':'navy','cloth':'navy','jacket':'navy','pants':'navy','rubber':'dark','boot':'dark','glass':'gem','amber':'gem','skin':'skin'}
def _mats(v):
    for role,p in PAL[v].items():
        pm_mat(v+'_'+role,p[0],p[1],p[2],*(p[3:5] if len(p)>3 else (None,0.0)),coat=0.4 if role=='enamel' else 0.0)
def _remap(v,slot):
    out=[]
    for (o,mat,j) in SLOTOBJ.get(slot,[]):
        role=ROLE.get(mat,'enamel'); nm=mat if role=='skin' else v+'_'+role
        o.data.materials.clear(); o.data.materials.append(M[nm]); out.append((o,nm,j))
    SLOTOBJ[slot]=out
def _extra(v,slot):
    E=v+'_gem'; G=v+'_gold'; N=v+'_navy'; D=v+'_dark'; En=v+'_enamel'
    if v=='arcforge':
        if slot=='face':
            torus('face',G,headP,0.17,0.012,(0,0.05,hb+0.33),(0.35,0,0))                         # floating halo crest
            for k in range(5): sph('face',E,headP,0.022,(math.cos(k*1.256)*0.17,0.05+math.sin(k*1.256)*0.06,hb+0.33+math.sin(k*1.256)*0.05),(1,1,1.6),seg=6,rings=4)
        if slot=='torso':
            sph('torso',E,torsoP,0.055,(0,-0.17,1.42),(1,0.6,1.3),seg=6,rings=4)                     # chest hex core
            for sx in (1,-1): seg('torso',G,torsoP,(0.03*sx,-0.17,1.5),(0.16*sx,-0.12,1.62),0.009)
            loft('torso',N,torsoP,0.62,1.2,lambda t:(0,0.12,0.2+0.05*(1-t),0.08),nv=10,nu=24,cap=(False,False),solid=0.01,delete=lambda x,y,z:y<0.06)  # back tabard
        if slot in ('armL','armR'):
            sx=1 if slot=='armL' else -1; sh=J['sh'+slot[-1]]; p=W(sh)
            for k,(dz,r) in enumerate(((0.08,0.06),(0.15,0.045),(0.2,0.03))): sph(slot,E,sh,r,(p.x+0.05*sx,0.0+0.03*k,p.z+dz),(0.7,0.7,1.9),seg=6,rings=4)  # crystal pauldron spikes
            sph(slot,G,sh,0.095,(p.x+0.03*sx,0,p.z+0.03),(1.25,1.1,0.7))
    if v=='bloom':
        if slot=='torso':
            for k in range(5):                                                                           # petal fins on the back
                a=(k-2)*0.42; bladeloft('torso',En if k%2 else G,torsoP,math.sin(a)*0.16,0.19,1.95-abs(k-2)*0.06,1.35,0.07,0.012,curve=-0.1)
            for sx in (1,-1): seg('torso',E,torsoP,(0.06*sx,-0.16,1.25),(0.14*sx,-0.13,1.58),0.008)      # glow veins
        if slot=='face':
            for k in range(3): bladeloft('face',E if k==1 else G,headP,(k-1)*0.07,0.06,hb+0.42-abs(k-1)*0.06,hb+0.18,0.04,0.01,curve=-0.05)  # orchid crest
    if v=='ronin':
        if slot=='face':
            cyl('face',G,headP,0.34,0.02,0.14,(0,0.0,hb+0.27),v=24,bevel=0.004)                      # kasa hat (big silhouette)
            torus('face',E,headP,0.3,0.006,(0,0,hb+0.215))                                           # neon brim
        if slot=='torso':
            seg('torso',D,torsoP,(-0.22,0.17,1.0),(0.24,0.17,1.78),0.03)                             # scabbard across the back
            seg('torso',E,torsoP,(-0.215,0.2,1.0),(0.235,0.2,1.78),0.008)                           # neon edge
            box('torso',G,hips,(0.36,0.06,0.07),(0,-0.02,0.98),0.01)                                 # sash
            loft('torso',G,hips,0.4,0.95,lambda t:(0,-0.06,0.1,0.03),nv=8,nu=16,cap=(False,False),solid=0.008,delete=lambda x,y,z:y>-0.04)  # sash tails
    if v=='founder':
        if slot=='torso':
            loft('torso',N,torsoP,0.75,1.66,lambda t:(0,0.06,0.26+0.08*(1-t),0.17),nv=14,nu=32,cap=(False,False),solid=0.012,delete=lambda x,y,z:y<-0.02)  # long mantle
            sph('torso',E,torsoP,0.04,(0,-0.165,1.55),(1,0.5,1),seg=10,rings=6)                       # founder filament pin
            torus('torso',G,torsoP,0.05,0.008,(0,-0.165,1.55),(R90,0,0))
        if slot=='face': torus('face',G,headP,0.14,0.016,(0,0,hb+0.2))                              # brass circlet
for _v in PAL:
    def _mk(v):
        def build(slot):
            def f():
                BUILD[BASE_OF[v]][slot](); _remap(v,slot); _extra(v,slot)
            return f
        return {s:build(s) for s in ('face','torso','armL','armR','handL','handR','legL','legR','footL','footR')}
    BUILD[_v]=_mk(_v)
if VARIANT in PAL: _mats(VARIANT)

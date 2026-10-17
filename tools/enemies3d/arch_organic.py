# Organic bosses: bosses read as augmented HUMANS, not machines. exec'd from build_enemy.py after arch_radical.py.
# Same rig, silhouette kit (head shape, signature limbs, back unit, extra arm, pistons) and scale as the silhouette pass, but:
#  - the CC0 base body is subdivided once (smooth, weights interpolated) and given an athletic V-taper with round limbs
#    (per-bone transforms blended by skin weights, so no seams), sculpted muscle (pecs, abs, traps, delts, lats) in rest pose;
#  - torso and arms are bare skin (subsurface skin shader on stable rest coords: no texture swim between frames);
#  - grafts are conformal: ceramic / oxide / polymer plates are regions of the skin pushed out, ringed by a sunken scar seam;
#  - cables run UNDER the skin (raised ridges, neck into jaw, spine into the back unit), hoses enter through scarred ports;
#  - limbs: upper-arm / thigh skin flares over the top of each install (flesh collar + scar ring), exposed tendon strip feeding
#    a piston rod; heads keep their silhouette but the hardware is a cranial / ocular / jaw implant, the face stays human.
# Palette per style guide; nothing emissive.
import numpy as np
from mathutils import Vector, Matrix
ORG_IDS=('brannoch','teague','enforcer','surgeon','recovered','overseer','stockmgr','retrieval','reclaimer')
ORG={   # skin tone, scalp (hair/bald), harness strap, extras kept from the old spec, graft plates (raw body coords, +x = enemy R)
 'brannoch': dict(skin='#6f5a4c', hair=False, strap=True,  keep=('horns',)),
 'teague':   dict(skin='#6c5648', hair=True,  strap=False, keep=('tank',), top='leather'),
 'enforcer': dict(skin='#5e4b3f', hair=False, strap=True,  keep=()),
 'surgeon':  dict(skin='#9a8a7e', hair=False, strap=False, keep=('apron',)),
 'recovered':dict(skin='#8e8370', hair=False, strap=False, keep=(), wrap=True, incisions=True),
 'overseer': dict(skin='#715e50', hair=True,  strap=False, keep=(), top='vest'),
 'stockmgr': dict(skin='#665040', hair=True,  strap=False, keep=(), top='singlet'),
 'retrieval':dict(skin='#7c6a5a', hair=False, strap=False, keep=()),
 'reclaimer':dict(skin='#5a473b', hair=True,  strap=True,  keep=()),
}
for _k in ORG_IDS:
    if _k in SPECS: SPECS[_k]['organic']=True; SPECS[_k]['_org']=ORG[_k]
def _node(N,t,**kw):
    n=N.new(t)
    for k,v in kw.items():
        try: n.inputs[k].default_value=v
        except Exception: setattr(n,k,v)
    return n
def _pset(b,name,v):
    try: b.inputs[name].default_value=v
    except Exception: pass
def _restcoord(N):
    a=N.new('ShaderNodeAttribute'); a.attribute_name='rest'; return a.outputs['Vector']
def _skinmat(name,col,sss=.12,rough=.62,mottle=1.0):
    """Skin: warm mottling + pores on rest coords, soot grime in creases (AO), slight sheen, subsurface. No emission."""
    m=bpy.data.materials.new(name); m.use_nodes=True; N=m.node_tree.nodes; L=m.node_tree.links; b=N['Principled BSDF']; rc=_restcoord(N)
    nz=_node(N,'ShaderNodeTexNoise',Scale=7.0,Detail=6.0); L.new(rc,nz.inputs['Vector'])
    nf=_node(N,'ShaderNodeTexNoise',Scale=70.0,Detail=2.0); L.new(rc,nf.inputs['Vector'])
    ng=_node(N,'ShaderNodeTexNoise',Scale=2.2,Detail=4.0); L.new(rc,ng.inputs['Vector'])
    def mix(a,bb,fac,bl='MIX'):
        n=N.new('ShaderNodeMixRGB'); n.blend_type=bl
        if isinstance(fac,float): n.inputs[0].default_value=fac
        else: L.new(fac,n.inputs[0])
        (L.new(a,n.inputs[1]) if not isinstance(a,tuple) else setattr(n.inputs[1],'default_value',a))
        (L.new(bb,n.inputs[2]) if not isinstance(bb,tuple) else setattr(n.inputs[2],'default_value',bb))
        return n.outputs[0]
    red=(col[0]*1.1,col[1]*.9,col[2]*.86,1); pale=(col[0]*1.02,col[1]*1.04,col[2]*1.04,1)
    mr=_node(N,'ShaderNodeMapRange',clamp=True); mr.inputs[1].default_value=.38; mr.inputs[2].default_value=.68; L.new(nz.outputs['Fac'],mr.inputs[0])
    c=mix(pale,red,mr.outputs[0]) if mottle else mix(col,col,.0)
    gm=_node(N,'ShaderNodeMapRange',clamp=True); gm.inputs[1].default_value=.46; gm.inputs[2].default_value=.72; gm.inputs[4].default_value=.7; L.new(ng.outputs['Fac'],gm.inputs[0])
    c=mix(c,(col[0]*.42,col[1]*.4,col[2]*.38,1),gm.outputs[0])            # soot / grime patches
    ao=N.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value=.1; ao.samples=4; c=mix(c,ao.outputs['Color'],.55,'MULTIPLY')
    L.new(c,b.inputs['Base Color']); _pset(b,'Roughness',rough); _pset(b,'Metallic',0.0); _pset(b,'Specular IOR Level',.38)
    _pset(b,'Subsurface Weight',sss); _pset(b,'Subsurface Radius',(.8,.42,.3)); _pset(b,'Subsurface Scale',.04)
    bm=_node(N,'ShaderNodeMath',operation='ADD'); L.new(nf.outputs['Fac'],bm.inputs[0]); L.new(nz.outputs['Fac'],bm.inputs[1])
    bn=_node(N,'ShaderNodeBump',Strength=.12,Distance=.004); L.new(bm.outputs[0],bn.inputs['Height']); L.new(bn.outputs['Normal'],b.inputs['Normal'])
    return m
def _fleshmat():
    """Exposed tendon / muscle where hardware is grafted: dark, wet, fibrous (restrained: reads as sinew, not gore)."""
    m=bpy.data.materials.new('o_flesh'); m.use_nodes=True; N=m.node_tree.nodes; L=m.node_tree.links; b=N['Principled BSDF']; rc=_restcoord(N)
    wv=_node(N,'ShaderNodeTexWave',Scale=26.0,Distortion=3.0,Detail=3.0); L.new(rc,wv.inputs['Vector']); wv.bands_direction='Z'
    mx=N.new('ShaderNodeMixRGB'); mx.inputs[1].default_value=rgb('#4a2420'); mx.inputs[2].default_value=rgb('#7a4234'); L.new(wv.outputs['Fac'],mx.inputs[0])
    L.new(mx.outputs[0],b.inputs['Base Color']); _pset(b,'Roughness',.32); _pset(b,'Subsurface Weight',.2); _pset(b,'Subsurface Radius',(1.0,.25,.15)); _pset(b,'Subsurface Scale',.03)
    bn=_node(N,'ShaderNodeBump',Strength=.35,Distance=.006); L.new(wv.outputs['Fac'],bn.inputs['Height']); L.new(bn.outputs['Normal'],b.inputs['Normal'])
    return m
def _restify(m):
    """Copy of a kit material that reads the body's rest-pose coords instead of (deforming) object coords -> no texture swim."""
    m2=m.copy(); m2.name=m.name+'_r'; N=m2.node_tree.nodes; L=m2.node_tree.links
    for tc in [n for n in N if n.type=='TEX_COORD']:
        out=tc.outputs['Object']; links=[l for l in L if l.from_socket==out]; rc=_restcoord(N)
        for l in links: to=l.to_socket; L.remove(l); L.new(rc,to)
    return m2
def _rest_attr(o):
    """Stable texture coords for primitives using rest-coord materials (local coords never deform)."""
    me=o.data; a=me.attributes.new('rest','FLOAT_VECTOR','POINT'); co=np.zeros(len(me.vertices)*3); me.vertices.foreach_get('co',co); a.data.foreach_set('vector',co); return o
def _sk(parent,fn,*a,**kw): return _rest_attr(fn(parent,*a,**kw))   # primitive with a rest attribute (skin / flesh / scar parts)
def _rod(parent,p0,p1,r,m,v=8,r2=None):
    """Cylinder from p0 to p1 in parent-local coords."""
    p0=Vector(p0); p1=Vector(p1); d=p1-p0; e=d.to_track_quat('Z','Y').to_euler(); return cyl(parent,r,d.length,tuple((p0+p1)/2),m,tuple(math.degrees(x) for x in e),v=v,r2=r2,bevel=0)
# ---------------- subdivided base body (cached as numpy; interpolated skin weights) ----------------
_SUB={}
def _subbody(sex):
    if sex in _SUB: return _SUB[sex]
    BD=_bd(sex); P=BD['P']; F=[list(r[:n]) for r,n in zip(BD['F'],BD['flen'])]; BE=[str(x) for x in BD['bones']]; W=BD['W']
    me=bpy.data.meshes.new('sub0'); me.from_pydata(P.tolist(),[],F); me.update(); ob=bpy.data.objects.new('sub0',me); sc.collection.objects.link(ob)
    for bi,b in enumerate(BE):
        vg=ob.vertex_groups.new(name=b)
        for v in np.nonzero(W[:,bi]>1e-5)[0]: vg.add([int(v)],float(W[v,bi]),'REPLACE')
    md=ob.modifiers.new('s','SUBSURF'); md.levels=1; md.render_levels=1
    dg=bpy.context.evaluated_depsgraph_get(); ev=ob.evaluated_get(dg); m2=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=dg)
    n=len(m2.vertices); P1=np.zeros(n*3); m2.vertices.foreach_get('co',P1); P1=P1.reshape(-1,3); W1=np.zeros((n,len(BE)))
    for v in m2.vertices:
        for g in v.groups: W1[v.index,g.group]+=g.weight
    W1/=np.maximum(W1.sum(1,keepdims=True),1e-9); F1=[list(p.vertices) for p in m2.polygons]
    bpy.data.objects.remove(ob); bpy.data.meshes.remove(me); bpy.data.meshes.remove(m2)
    _SUB[sex]=(P1,W1,F1,BE,BD['LM']); return _SUB[sex]
def _bulk(P,W,BE,bx,by):
    """V-taper (chest/shoulders broad, waist narrower, bull neck) with round, thick limbs. Blended by skin weights -> seamless."""
    dom=W.argmax(1); cen={b:P[dom==i].mean(0) for i,b in enumerate(BE)}; z=P[:,2]; out=np.zeros_like(P)
    S=bx*1.06; H=bx*.86; th=np.sqrt(bx*by)
    tz=np.interp(z,[.95,1.08,1.4,1.56,1.67],[.84,.86,1.06,1.04,.62]); tyz=np.interp(z,[.95,1.35],[.94,1.0])
    yb=lambda y,f=1.0:(y+.045)*by*f-.045
    for i,b in enumerate(BE):
        w=W[:,i]; m=w>1e-6
        if not m.any(): continue
        Q=P[m].copy()
        if b in('hips','torsoP'): Q[:,0]*=bx*tz[m]; Q[:,1]=yb(Q[:,1],tyz[m])
        elif b=='headP': pass
        else:
            sd=b[2]; root=cen[('sh' if b[:2] in('sh','el','wr') else 'hp')+sd]; c=cen[b]
            if b[:2] in('sh','el','wr'): t=th*{'sh':.9,'el':.84,'wr':.74}[b[:2]]; G=S; yr=1.0
            else: t=th*{'hp':.8,'kn':.74,'an':.7}[b[:2]]; G=H; yr=.95
            Q[:,0]=c[0]+(Q[:,0]-c[0])*t+root[0]*(G-1); Q[:,1]=c[1]+(Q[:,1]-c[1])*t+(yb(root[1],yr)-root[1])
        out[m]+=w[m,None]*Q
    return out,S,H,th
def _ell(P,c,r): return np.sqrt((((P-np.array(c))/np.array(r))**2).sum(1))
def _snap(P,ok,pts):
    idx=np.nonzero(ok)[0]; out=[]
    for p in pts: d=((P[idx]-np.array(p))**2).sum(1); out.append(P[idx[d.argmin()]])
    return np.array(out)
def _segdist(P,pts):
    d=np.full(len(P),9.0)
    for a,b in zip(pts[:-1],pts[1:]):
        ab=b-a; t=np.clip(((P-a)@ab)/max(ab@ab,1e-9),0,1); q=a+t[:,None]*ab; d=np.minimum(d,np.sqrt(((P-q)**2).sum(1)))
    return d
MUSCLE=[  # (centre, radii, amp) raw body coords; gaussian bulges along the normal (negative = groove)
 ((.085,-.17,1.425),(.075,.07,.06),.016),((-.085,-.17,1.425),(.075,.07,.06),.016),((0,-.19,1.40),(.014,.08,.11),-.007),
 *[((sx*.034,-.18,zz),(.028,.06,.03),.0075) for sx in (-1,1) for zz in (1.14,1.205,1.27)],((0,-.19,1.2),(.009,.06,.13),-.005),
 ((.13,-.12,1.09),(.05,.08,.07),.008),((-.13,-.12,1.09),(.05,.08,.07),.008),
 ((.075,.02,1.605),(.07,.08,.05),.022),((-.075,.02,1.605),(.07,.08,.05),.022),
 ((.205,-.01,1.52),(.07,.08,.085),.014),((-.205,-.01,1.52),(.07,.08,.085),.014),
 ((.14,.06,1.35),(.05,.06,.12),.011),((-.14,.06,1.35),(.05,.06,.12),.011),
 ((.2,-.05,1.38),(.04,.05,.07),.01),((-.2,-.05,1.38),(.04,.05,.07),.01),((.2,.045,1.4),(.04,.05,.08),.009),((-.2,.045,1.4),(.04,.05,.08),.009),
 ((.085,.1,1.45),(.06,.05,.06),.007),((-.085,.1,1.45),(.06,.05,.06),.007),((0,.11,1.3),(.013,.06,.26),-.007),
]
def _plan(mfr,eid,aug):
    """Graft layout per manufacturer (plates = conformal regions of skin pushed out, ringed by scar seams), cable paths under skin."""
    a=1 if 'R' in aug else -1; plates=[]; cables=[]; ports=[]
    neck=[[(s*.03,-.13,1.5),(s*.035,-.09,1.6),(s*.04,-.07,1.68)] for s in (-1,1)]
    if mfr=='HI':
        plates+= [((a*.2,-.02,1.53),(.085,.12,.1),'k_shell'),((-a*.165,-.05,1.24),(.05,.12,.1),'k_shell')]
        cables+= neck+[[(a*.06,-.17,1.44),(a*.12,-.13,1.5),(a*.19,-.08,1.5)],[(-a*.16,-.07,1.18),(-a*.12,-.16,1.12),(-a*.05,-.18,1.06)]]
        ports+= [(-.06,.1,1.32),(.06,.1,1.32)]
    elif mfr=='PS':
        plates+= [((0,-.2,1.37),(.03,.08,.13),'k_shell'),((.09,-.12,1.555),(.075,.07,.022),'k_shell'),((-.09,-.12,1.555),(.075,.07,.022),'k_shell'),
                  ((a*.11,-.16,1.17),(.045,.08,.07),'k_shell')]+[((0,.11,zz),(.04,.06,.03),'k_shell') for zz in (1.18,1.27,1.36,1.45,1.54)]
        cables+= neck+[[(a*.02,-.2,1.25),(a*.07,-.18,1.3),(a*.14,-.13,1.38),(a*.19,-.08,1.44)]]
        ports+= [(-.07,.1,1.4),(.07,.1,1.4)]
    else:
        plates+= [((a*.15,-.13,1.47),(.065,.1,.065),'k_shell'),((-a*.16,-.05,1.2),(.05,.12,.08),'k_patch'),((-a*.2,-.02,1.5),(.07,.1,.07),'k_patch')]
        cables+= neck+[[(a*.03,-.18,1.3),(a*.1,-.16,1.24),(a*.16,-.1,1.18)]]
        ports+= [(-.06,.1,1.3),(.07,.1,1.38)]
    cables+= [[(p[0],.1,p[2]),(p[0]*1.4,.08,p[2]+.12),(p[0]*2.6,.04,1.55)] for p in ports]
    return plates,cables,ports
def orgbody(spec,bruiser=False):
    O=spec['_org']; mfr=spec.get('mfr','MM'); _kitmats(mfr,spec); P1,Wt,F,BE,LM=_subbody(spec.get('sex','m')); dom=Wt.argmax(1)
    K=KIT[mfr]; MATS['k_shell']=mat('k_shell',rgb(K['shell']),metal=.25 if mfr!='MM' else .05,rough=.5 if mfr=='PS' else .62,panel=False,scale=7,wear='#d6cfbd' if mfr!='HI' else '#9a8a78')   # no stamped-brick seams on grafts
    MATS['k_patch']=mat('k_patch',rgb('#6a6c66'),metal=.4,rough=.6,panel=False,scale=9)
    MATS['b_skin']=_skinmat('b_skin',rgb(O['skin'])); MATS['o_vein']=_skinmat('o_vein',tuple(c*.62+d for c,d in zip(rgb(O['skin']),(.012,.012,.02,0))),mottle=0,rough=.5); MATS['o_flesh']=_fleshmat()
    MATS['o_scar']=_skinmat('o_scar',rgb('#6c463c'),sss=.08,rough=.62,mottle=0); MATS['b_belt']=mat('b_belt',rgb('#3a3029'),metal=0,rough=.7,panel=False,bump=.6)
    MATS['b_apron']=mat('b_apron',rgb('#4c555a'),metal=0,rough=.42,panel=False,bump=.3); MATS['b_wrap']=mat('b_wrap',rgb('#9e978a'),metal=0,rough=.95,panel=False,bump=1.0)
    MATS['b_leather']=mat('b_leather',rgb('#4c3a2c'),metal=0,rough=.68,panel=False,bump=.7)
    for n in ('b_pants','b_boot','b_hair','b_shirt','k_shell','k_patch','k_tape','k_trim','b_leather'): MATS[n+'_r']=_restify(MATS[n])
    s=spec.get('scale',1.0); oldH=((.88+.08+.62+.1+.5) if not bruiser else (.88*.82+.08+.62*1.25+.1+.45))*s
    bx,by=spec.get('bulk',(1.95,1.62) if bruiser else (1.45,1.28)); head=dom==BE.index('headP')
    P,S,H,th=_bulk(P1,Wt,BE,bx,by); k=oldH/P[:,2].max()
    R=Rig(); R.s=s; R.org=True; R.kind='bruiser' if bruiser else 'humanoid'; R.root=joint('root'); R.hips=joint('hips',R.root,(0,0,.96*k)); R.hips.scale=(k,k,k)
    R.torso=joint('torso',R.hips,(0,0,.06)); R.head=joint('head',R.torso,(0,0,.62))
    for side,sx in (('L',-1),('R',1)):
        sh=joint('sh'+side,R.torso,(sx*.2*S,0,.55)); el=joint('el'+side,sh,(0,0,-.29)); hn=joint('hand'+side,el,(0,0,-.27))
        hp=joint('hp'+side,R.hips,(sx*.115*H,0,-.02)); kn=joint('kn'+side,hp,(0,0,-.43)); ft=joint('ft'+side,kn,(0,0,-.42))
        for nm,o in (('sh',sh),('el',el),('hand',hn),('hp',hp),('kn',kn),('ft',ft)): setattr(R,nm+side,o)
    MAPJ={'hips':'hips','torsoP':'torso','headP':'head'}
    for pb,eb in (('sh','sh'),('el','el'),('wr','hand'),('hp','hp'),('kn','kn'),('an','ft')): MAPJ[pb+'L']=eb+'R'; MAPJ[pb+'R']=eb+'L'
    R.lift={'key':1.25,'fill':2.2,'rim':2.6,'rim2':2.0}; R.hipH=.96*k; R.leg=.85*k; R.height=oldH; R.k=k; R.th=th
    aug=spec.get('aug',('R','L')); hide=set()
    for side in aug: bl='L' if side=='R' else 'R'; hide|={BE.index('wr'+bl),BE.index('el'+bl)}
    hide|={BE.index('anL'),BE.index('anR')}|{BE.index(b) for b in spec.get('hideb',())}
    # ---- per-vertex class: skin (bare torso + arms), scalp/hair, belt + strap, pants, boots; then grafts, scars, cables
    x,y,z=P1[:,0],P1[:,1],P1[:,2]; ez=LM[0][2]; bone=np.array([BE[d] for d in dom]); b2=np.array([b[:2] for b in bone])
    hairm=head&(z>ez+.035-.09*np.clip((y+.05)/.15,0,1))&~((np.abs(x)>.085)&(z<ez+.03))
    VC=np.full(len(P1),'b_skin',dtype=object); trunk=np.isin(bone,('hips','torsoP'))
    if O.get('hair'): VC[hairm]='b_hair_r'
    VC[trunk&(z<.965)]='b_pants_r'; VC[np.isin(b2,('hp','kn'))]='b_pants_r'; VC[(b2=='an')&(z<.16)]='b_boot_r'; VC[(b2=='an')&(z>=.16)]='b_pants_r'
    VC[trunk&(z>=.965)&(z<1.025)]='b_belt'
    skin=(VC=='b_skin')&~head|(head&(z<1.7)&(VC=='b_skin'))
    disp=np.zeros(len(P1)); amp=np.sqrt(bx*by)/1.6
    body=~head&(z>.97)
    for c,r,a_ in MUSCLE: disp+=np.where(body,a_*amp*np.exp(-_ell(P1,c,r)**2*1.6),0)
    if O.get('strap'):   # diagonal work-harness strap (front + back) and a shoulder buckle
        a=1 if 'R' in aug else -1; d=np.abs(z-(1.56-.95*(a*x+.17)))
        VC[trunk&(d<.027)&(z>1.02)&(z<1.6)]='b_belt'
    if spec.get('extras') and 'apron' in O.get('keep',()):   # rubber apron conformal over the front of the torso, neck strap
        ap=trunk&(y<-.03)&(z<1.47)&(z>.97)&(np.abs(x)<.17); VC[ap]='b_apron'; VC[trunk&(np.abs(np.abs(x)-.07)<.016)&(z>=1.47)&(z<1.62)&(y<0)]='b_apron'
    top=O.get('top')
    if top=='singlet': VC[trunk&(z>=1.025)&(z<1.5)]='b_shirt_r'; VC[trunk&(np.abs(np.abs(x)-.085)<.03)&(z>=1.5)&(z<1.63)]='b_shirt_r'
    elif top=='vest': VC[trunk&(z>=1.025)&(z<1.62)&((y>-.04)|(np.abs(x)>.06))]='b_shirt_r'
    elif top=='leather': VC[trunk&(y<-.035)&(z>=.97)&(z<1.48)&(np.abs(x)<.165)]='b_leather_r'; VC[trunk&(np.abs(np.abs(x)-.075)<.017)&(z>=1.48)&(z<1.63)&(y<.02)]='b_leather_r'
    plates,cables,ports=_plan(mfr,spec.get('_id',''),aug)
    L_=spec.get('look',{})
    if L_.get('donor', not L_):   # mismatched donor graft: another maker's deltoid shell over the muscle
        dn={'HI':'PS','PS':'MM','MM':'HI'}[mfr]; MATS['k_donor']=mat('k_donor',rgb(KIT[dn]['shell']),metal=.2,rough=.6,panel=False,scale=7); MATS['k_donor_r']=_restify(MATS['k_donor'])
        ds='L' if 'L' not in spec.get('_tools',{}) else 'R'; dx=1 if ds=='R' else -1; plates=[p_ for p_ in plates if not (p_[0][0]*dx>.15 and p_[0][2]>1.4)]+[((dx*.205,-.01,1.49),(.08,.11,.11),'k_donor')]
    plate_ok=~head&(VC!='b_belt')&(VC!='b_leather_r')
    for c,r,m in plates:
        e=_ell(P1,c,r); VC[plate_ok&(e<1)]=m+'_r'; ring=plate_ok&(e>=1)&(e<1.22)&(VC=='b_skin'); VC[ring]='o_scar'; disp[ring]-=.003
    for c in ports: e=_ell(P1,c,(.025,.05,.025)); VC[~head&(e<1)]='o_scar'; disp[~head&(e<1)]-=.006
    if O.get('incisions'):   # surgical incisions (dark scar lines, slightly raised)
        for path in [[(-.12,-.17,1.5),(0,-.2,1.42),(.12,-.17,1.5)],[(0,-.2,1.42),(0,-.19,1.12)],[(-.15,-.1,1.08),(-.06,-.18,1.02)]]:
            pts=_snap(P1,body,path); dd=_segdist(P1,pts); mm=body&(dd<.008)&(VC=='b_skin'); VC[mm]='o_scar'; disp+=np.where(mm,.002,0)
    ok_c=(~head|(z<1.72))&(z>1.0)
    for path in cables:
        pts=_snap(P1,ok_c&(VC!='b_belt'),path); dd=_segdist(P1,pts); rr=np.exp(-(dd/.011)**2)*.012*amp
        m=ok_c&np.isin(VC,('b_skin','o_vein')); disp+=np.where(m,rr,0); VC[m&(dd<.0085)]='o_vein'
    for side in aug:   # exposed tendon strip on the lower biceps of each augmented arm (feeds the piston rod on the install)
        sx=1 if side=='R' else -1; e=_ell(P1,(sx*.2,-.055,1.31),(.022,.04,.05)); mm=(e<1)&np.isin(b2,('sh','el')); VC[mm]='o_flesh'; disp[mm]-=.004
    for side in spec.get('piston',()):
        sx=1 if side=='R' else -1; e=_ell(P1,(sx*.12,-.08,.56),(.03,.05,.07)); mm=(e<1)&(b2=='hp'); VC[mm]='o_flesh'; disp[mm]-=.004
    OFF={'b_shirt_r':.012,'b_leather_r':.02,'k_donor_r':.014,'b_pants_r':.02,'b_boot_r':.016,'b_hair_r':.006,'b_belt':.024,'b_apron':.018,'k_shell_r':.014,'k_patch_r':.012}
    off=np.array([OFF.get(c,0.0) for c in VC])+disp
    faces=[f for f in F if not all(dom[i] in hide for i in f)]
    me=bpy.data.meshes.new('body'); me.from_pydata((P*k).tolist(),[],faces); me.update()
    nrm=np.array([v.normal[:] for v in me.vertices]); Q=P*k+nrm*(off*k)[:,None]; me.vertices.foreach_set('co',Q.ravel())
    ra=me.attributes.new('rest','FLOAT_VECTOR','POINT'); ra.data.foreach_set('vector',P1.ravel()); me.update()
    ob=bpy.data.objects.new('body',me); sc.collection.objects.link(ob); names=sorted(set(VC))
    for n in names: me.materials.append(MATS[n])
    pr={'b_leather_r':5,'b_shirt_r':4,'k_shell_r':6,'k_patch_r':6,'k_donor_r':6,'b_apron':5,'b_belt':5,'o_flesh':4,'o_scar':3,'o_vein':2}
    mi=[]
    for p in me.polygons:
        cs=[VC[i] for i in p.vertices]; best=max(set(cs),key=lambda c:(cs.count(c)*10+pr.get(c,0))); mi.append(names.index(best))
    me.polygons.foreach_set('material_index',mi); me.polygons.foreach_set('use_smooth',[True]*len(me.polygons)); me.update()
    bpy.context.view_layer.update()
    EMP={b:getattr(R,MAPJ[b]) if MAPJ[b] not in('hips','torso','head') else {'hips':R.hips,'torso':R.torso,'head':R.head}[MAPJ[b]] for b in BE}
    REST={b:EMP[b].matrix_world.copy() for b in BE}; RH=np.c_[Q,np.ones(len(Q))]
    nz=Wt>1e-4; Wc=Wt.copy()
    def skin():
        Ms=np.array([np.array(EMP[b].matrix_world@REST[b].inverted()) for b in BE]); X=np.einsum('bij,nj->nbi',Ms,RH)[:,:,:3]
        me.vertices.foreach_set('co',(Wc[:,:,None]*X).sum(1).ravel()); me.update()
    R.skin=skin
    # ---- face: eyes + brows (sprite-readable), heavy brow ridge
    hd=R.head; hz=1.64
    for E in LM[:2]:
        ex,ey,ezz=E[0],E[1],E[2]-hz; sph(hd,.016,(ex,ey+.006,ezz),'b_eye',(1,.6,.75)); sph(hd,.008,(ex,ey-.004,ezz),'b_pupil')
        box(hd,(.036,.013,.01),(ex,ey-.006,ezz+.021),'b_brow',bevel=0)
    for side in [q for q in ('L','R') if q not in spec.get('piston',())]:
        ft=getattr(R,'ft'+side); g=1.15 if bruiser else 1.0
        box(ft,(.11*g,.25*g,.05),(0,-.06,-.065),'b_boot',bevel=.015); box(ft,(.1*g,.19*g,.07),(0,-.04,-.02),'b_boot',bevel=.025)
        sph(ft,.05*g,(0,-.15*g,-.04),'b_boot',(1.05,1.0,.75)); cyl(ft,.058*g,.12,(0,.0,.04),'b_boot',v=14,r2=.052*g); box(ft,(.11*g,.26*g,.012),(0,-.06,-.092),'k_rubber',bevel=.004)
    _kits_org(R,spec,mfr,aug,bruiser)
    sp2=dict(spec); sp2['extras']=tuple(e for e in spec.get('extras',()) if e in O.get('keep',()) and e not in('apron','horns')); extras_b(R,sp2,bruiser,bx)
    if 'horns' in spec.get('extras',()) and 'horns' in O.get('keep',()): R._horns=True
    if 'apron' in O.get('keep',()): box(R.hips,(.34*bx*.8,.016,.42),(0,-.2*by*.9,-.2),'b_apron',(-4,0,0),bevel=.006)   # hanging apron skirt
    if O.get('wrap'):   # dirty sheet wrapped round the hips, knotted
        _sk(R.hips,cyl,.2*H,.36,(0,-.03,-.12),'b_wrap',v=24,r2=.17*H); _sk(R.hips,sph,.05,(.12*H,-.16,.0),'b_wrap',(1,.7,1.2))
    for side in aug: _collar(R,side,'arm',bruiser)
    for side in spec.get('piston',()): _collar(R,side,'leg',bruiser)
    for side in ('L','R'):
        wk=spec.get('weapon_'+side)
        if wk: weapon(wk,getattr(R,'hand'+side),s)
    R.ports=ports; R.bulk=(bx,by)
    return R
def _collar(R,side,kind,br):
    """Flesh grows over the top of the install: tapered skin sleeve from limb to housing, sunken scar ring, staple bolts,
    and a piston rod continuing the exposed tendon."""
    th=R.th; g=(1.6 if br else 1.25)
    if kind=='arm':
        j=getattr(R,'el'+side); rl=.047*th*.84; rh=.072*g
        _sk(j,cyl,rh*1.02,.11,(0,0,-.035),'b_skin',v=20,r2=rl*1.04); _sk(j,cyl,rh*1.07,.016,(0,0,-.09),'o_scar',v=20)
        for i in range(6): a=i/6*math.tau; cyl(j,.006,.026,(math.cos(a)*rh*1.09,math.sin(a)*rh*1.09,-.09),'k_metal',v=6,bevel=0)
        _rod(j,(0,-rl*.95,.07),(0,-rh*1.05,-.24),.011*g,'k_metal'); _sk(j,_rod,(0,-rl*.95,.075),(0,-rl*1.0,-.02),.014*g,'o_flesh')
    else:
        j=getattr(R,'kn'+side); rl=.06*th*.8; rh=.08*(1.4 if br else 1.15)
        _sk(j,cyl,rh*1.03,.1,(0,0,.0),'b_pants',v=20,r2=rl*1.05); _sk(j,cyl,rh*1.08,.016,(0,0,-.05),'o_scar',v=20)
        _rod(j,(0,-rl*.9,.12),(0,-rh*1.05,-.3),.012*g,'k_metal'); _sk(j,_rod,(0,-rl*.9,.14),(0,-rl*.95,.02),.016*g,'o_flesh')
def _kits_org(R,spec,mfr,aug,br):
    """Manufacturer forearm installs only (elbow down): the shoulder and upper arm stay muscle and skin."""
    for side in aug:
        sx=1 if side=='R' else -1; el,hn=getattr(R,'el'+side),getattr(R,'hand'+side); g=1.6 if br else 1.25
        if mfr=='HI':
            for i in range(4): cyl(el,.058*g-.003*i,.018,(0,0,.02-.022*i),'k_rubber',v=16,bevel=.004)
            cyl(el,.06*g,.18,(0,0,-.16),'k_shell',v=16,r2=.052*g); box(el,(.05*g,.03,.14),(sx*.03,-.055*g,-.15),'k_shell',bevel=.01)
            for dx in (-.03,.03): cyl(el,.009,.2,(dx*g,.05*g,-.12),'k_metal',v=8)
            _bolts(el,[(sx*.03,-.071*g,-.1),(sx*.03,-.071*g,-.2),(-sx*.03,-.06*g,-.15)])
            cyl(hn,.05*g,.08,(0,0,-.03),'k_trim',v=14)
            for dx in (-.03,0,.03): box(hn,(.022*g,.03,.07),(dx*g,-.02,-.1),'k_metal',bevel=.006)
        elif mfr=='PS':
            cyl(el,.05*g,.25,(0,0,-.13),'k_shell',v=20,r2=.028*g)
            for zz in (-.05,-.17): cyl(el,.049*g,.008,(0,0,zz),'k_trim',v=20)
            box(el,(.006,.022,.24),(sx*.05*g,.0,-.17),'k_metal',(0,sx*6,0),bevel=.002)
            for dx in (-.022,-.007,.008,.023): cyl(hn,.007,.085,(dx,-.004,-.06),'k_shell',v=8,r2=.004)
            cyl(hn,.03,.04,(0,0,-.015),'k_shell',v=14)
        else:
            cyl(el,.06*g,.11,(0,0,-.07),'k_shell',v=16,r2=.055*g); cyl(el,.056*g,.1,(0,0,-.19),'k_patch',v=16,r2=.05*g)
            cyl(el,.058*g,.03,(0,0,-.13),'k_tape',v=14,bevel=.003)
            cyl(hn,.05*g,.1,(0,0,-.05),'k_shell',v=14,r2=.045*g); cyl(hn,.045*g,.02,(0,0,-.005),'k_tape',v=12)
    if mfr=='MM':
        side='L' if 'R' in aug else 'R'; kn=getattr(R,'kn'+side)
        if side not in spec.get('piston',()): box(kn,(.11,.04,.2),(0,-.065,-.17),'k_shell',bevel=.01); cyl(kn,.064,.025,(0,-.0,-.12),'k_tape',v=14)
def _tool_org(R,side,kind,mfr,br):
    if kind=='hammer':   # pneumatic maul: round ram head on a piston, not a cube fist
        hn=getattr(R,'hand'+side); el=getattr(R,'el'+side); g=1.6 if br else 1.3
        cyl(el,.075*g,.22,(0,0,-.13),'k_shell',v=18); cyl(hn,.045*g,.12,(0,0,-.04),'k_metal',v=12)
        cyl(hn,.095*g,.19*g,(0,0,-.16*g),'k_trim',v=20,bevel=.02); cyl(hn,.1*g,.03,(0,0,-.09*g),'k_shell',v=20); cyl(hn,.08*g,.03,(0,0,-.255*g),'k_metal',v=20)
        [cyl(hn,.012,.2,(dx*g,.1*g,-.1),'k_metal',v=6) for dx in (-.06,.06)]
    else: _tool0(R,side,kind,mfr,br)
# ---------------- heads: same silhouette per id, hardware becomes an implant, the face stays human ----------------
def _head_org(R,kind,mfr,boss):
    hd=R.head
    if kind is None and mfr=='HI':   # riveted oxide cranial cap over the crown + manufactured jaw; eyes, brow, nose bare
        sph(hd,.122,(0,.025,.3),'k_shell',(1.02,1.12,.62)); _bolts(hd,[(sx*.06,-.08,.3) for sx in (-1,0,1)]+[(sx*.105,-.02,.27) for sx in (-1,1)])
        _sk(hd,cyl,.118,.018,(0,.02,.25),'o_scar',v=24)
        box(hd,(.12,.06,.05),(0,-.11,.06),'k_metal',bevel=.01); [box(hd,(.01,.02,.04),(-.04+.02*i,-.142,.065),'k_trim',bevel=0) for i in range(5)]
        if boss: [_rod(hd,(sx*.1,.06,.26),(sx*.08,.14,.0),.016,'k_rubber') for sx in (-1,1)]
    elif kind is None and mfr=='PS':   # ivory ceramic cranium graft (crown only), slate seam, one ceramic cheek plate; face bare
        sph(hd,.124,(0,.0,.31),'k_shell',(1.02,1.22,.55)); box(hd,(.005,.26,.005),(0,-.0,.378),'k_mark',bevel=0); _sk(hd,cyl,.121,.014,(0,.0,.265),'o_scar',v=24)
        sph(hd,.05,(-.075,-.1,.13),'k_shell',(.6,.9,1.0)); box(hd,(.004,.06,.004),(-.1,-.1,.13),'k_mark',bevel=0)
        if boss: cyl(hd,.012,.22,(0,.12,.42),'k_metal',(-35,0,0),v=8,r2=.003)
    elif kind is None:   # MM stamped side housing over one temple + ear, taped seam
        box(hd,(.08,.2,.16),(.1,.0,.24),'k_shell',bevel=.012); box(hd,(.09,.21,.02),(.1,.0,.2),'k_tape',bevel=0); _sk(hd,cyl,.03,.03,(.06,-.1,.2),'o_scar',(0,90,0),v=12)
    elif kind=='round':   # riveted dome grown over the back two-thirds of the skull; face forward of it
        sph(hd,.145,(0,.05,.29),'k_shell',(1,1.0,.78)); tor(hd,.136,.014,(0,.0,.27),'k_trim',(-62,0,0)); _sk(hd,cyl,.138,.016,(0,-.01,.26),'o_scar',(-62,0,0),v=24)
        _bolts(hd,[(sx*.12,-.02,.31) for sx in (-1,1)]+[(0,-.05,.42)])
    elif kind=='flat':    # flat cranial deck bolted into the scalp (kept wide for silhouette), scar ring under it
        box(hd,(.4,.22,.05),(0,.0,.34),'k_shell',bevel=.015); cyl(hd,.05,.06,(0,.0,.3),'k_trim',v=12); _sk(hd,cyl,.105,.016,(0,-.0,.3),'o_scar',v=20)
        _bolts(hd,[(sx*.17,-.1,.36) for sx in (-1,1)]+[(sx*.17,.1,.36) for sx in (-1,1)]); [box(hd,(.03,.05,.03),(sx*.17,-.12,.35),'k_mark',bevel=0) for sx in (-1,1)]
    elif kind=='crt':     # boxy cranial housing at the back + ocular block fused over one eye; mouth, jaw and other eye bare
        box(hd,(.27,.16,.24),(0,.07,.27),'k_shell',bevel=.02); box(hd,(.1,.11,.09),(.045,-.1,.2),'k_trim',bevel=.01); cyl(hd,.03,.03,(.045,-.16,.2),'k_metal',(90,0,0),v=14)
        _sk(hd,cyl,.05,.02,(.045,-.12,.2),'o_scar',(90,0,0),v=16); box(hd,(.05,.05,.12),(.12,.1,.44),'k_metal',bevel=0)
    elif kind=='periscope':   # periscope grown from the right eye socket up past the crown, cranial plate; face bare
        box(hd,(.18,.2,.05),(0,.02,.34),'k_shell',bevel=.012); cyl(hd,.035,.12,(.045,-.13,.22),'k_metal',(70,0,0),v=12); _sk(hd,cyl,.045,.02,(.045,-.115,.2),'o_scar',(70,0,0),v=14)
        _rod(hd,(.045,-.16,.25),(.06,-.06,.52),.03,'k_metal',v=10); cyl(hd,.04,.34,(.06,-.02,.6),'k_metal',v=10); box(hd,(.08,.14,.07),(.06,-.07,.78),'k_shell',bevel=.01)
    elif kind=='dome': cyl(hd,.17,.02,(0,-.02,.29),'k_trim',v=24); sph(hd,.14,(0,.02,.31),'k_shell',(1,1.1,.55))
    elif kind=='bucket': cyl(hd,.15,.12,(0,.04,.33),'k_shell',v=18,r2=.12); cyl(hd,.155,.02,(0,.04,.27),'k_trim',v=18)
def _back_org(R,kind,bx):
    """Back units stay (silhouette) but plug in: rubber hoses from the unit into scarred ports in the back skin."""
    _back0(R,kind,bx); t=R.torso; y=(.13+.045)*1.6-.045+.08; byy=R.bulk[1]
    for (px,py,pz) in getattr(R,'ports',()):
        sx=px*R.bulk[0]*1.06; sy=(py+.045)*byy-.045; sz=pz-1.02
        a=(math.copysign(.19,sx),y-.02,sz+.2); m=(math.copysign(.2,sx)*1.05,(y+sy)/2+.03,sz+.02)
        _rod(t,a,m,.024,'k_rubber',v=10); _rod(t,m,(sx,sy+.01,sz),.024,'k_rubber',v=10); cyl(t,.034,.035,(sx,sy+.012,sz),'k_metal',(90,0,0),v=12,bevel=0)
def _donor_org(R,mfr,tools,br):   # mismatched donor graft: another maker's deltoid shell over the muscle, scar seam, bolts
    donor={'HI':'PS','PS':'MM','MM':'HI'}[mfr]; MATS['k_donor']=mat('k_donor',rgb(KIT[donor]['shell']),metal=.2,rough=.6,panel=False,scale=7)
    pass   # the donor shell is a conformal plate on the deltoid, built with the body (orgbody)
def _extraarm_org(R,side,mfr,big):   # third arm roots in a fleshy shoulder socket instead of a bolted bracket
    _extraarm0(R,side,mfr,big); sx=1 if side=='R' else -1; j=getattr(R,'xa'+side) if hasattr(R,'xa'+side) else None
    t=R.torso; _sk(t,sph,.075*(1.3 if big else 1),(sx*.24,-.05,.36),'b_skin',(1,1,.8)); _sk(t,cyl,.07*(1.3 if big else 1),.016,(sx*.24,-.06,.33),'o_scar',(-50,sx*25,0),v=16)
def _horns(R):
    hd=R.head
    for sx in (-1,1):
        p=[Vector((sx*.09,-.0,.33)),Vector((sx*.17,-.03,.4)),Vector((sx*.22,-.07,.5)),Vector((sx*.22,-.12,.6))]; r=[.045,.034,.022,.008]
        for i in range(3): _rod(hd,p[i],p[i+1],r[i],'k_metal',v=10,r2=r[i+1])
        cyl(hd,.055,.05,(sx*.09,0,.32),'k_shell',(0,sx*-38,0),v=12); _sk(hd,cyl,.062,.012,(sx*.088,0,.305),'o_scar',(0,sx*-38,0),v=14)
_skull0,_head20,_back0,_extraarm0,_basehum0,_tool0=_skull,_head2,_back,_extraarm,basehum,_tool
def _tool(R,side,kind,mfr,br): return _tool_org(R,side,kind,mfr,br) if getattr(R,'org',False) else _tool0(R,side,kind,mfr,br)
def basehum(spec,bruiser=False): return orgbody(spec,bruiser) if spec.get('organic') else _basehum0(spec,bruiser)
def _skull(R,mfr,boss):
    if not getattr(R,'org',False): return _skull0(R,mfr,boss)
    _head_org(R,None,mfr,boss)
    if getattr(R,'_horns',False): _horns(R)
def _head2(R,kind):
    if not getattr(R,'org',False): return _head20(R,kind)
    _head_org(R,kind,None,True)
    if getattr(R,'_horns',False): _horns(R)
def _back(R,kind,bx): return _back_org(R,kind,bx) if getattr(R,'org',False) else _back0(R,kind,bx)
def _extraarm(R,side,mfr,big): return _extraarm_org(R,side,mfr,big) if getattr(R,'org',False) else _extraarm0(R,side,mfr,big)

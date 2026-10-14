# Fits the MakeHuman hm08 CC0 base mesh (base.obj + *-young targets, downloaded per LICENSE_NOTES.md; not committed) to the
# build_char.py joint rig and writes body_m.npz / body_f.npz. Run from a directory holding those source files.
import numpy as np, sys, re
V=[];F=[];G={};g=None;FG=[];FT=[]
for ln in open('base.obj'):
    if ln.startswith('v '): V.append([float(x) for x in ln.split()[1:4]])
    elif ln.startswith('g '): g=ln.split()[1]
    elif ln.startswith('f '):
        idx=[int(t.split('/')[0])-1 for t in ln.split()[1:]]
        G.setdefault(g,set()).update(idx)
        if g=='body': F.append(idx); FT.append(0)
        elif g in ('helper-l-eye','helper-r-eye'): F.append(idx); FT.append(1)
V=np.array(V)
def target(name,w):
    d=np.zeros_like(V)
    for ln in open(name+'.target'):
        if ln[0]=='#' or not ln.strip(): continue
        p=ln.split(); d[int(p[0])]=[float(x) for x in p[1:4]]
    return d*w
SHX=0.2
import os; SIG=float(os.environ.get("SIG","0.5"))
def build(sex,out,muscle=False):
    X=V.copy()
    g='male' if sex=='m' else 'female'
    for e in ('african','asian','caucasian'): X+=target(f'{e}-{g}-young',1/3)
    X+=target(f'universal-{g}-young-maxmuscle-averageweight',0.5 if sex=='m' else 0.3)
    # MH (x,y,z) Y-up +Z forward -> ours (x,-z,y)
    X=np.stack([X[:,0],-X[:,2],X[:,1]],1)
    J={k[6:]:X[list(v)].mean(0) for k,v in G.items() if k.startswith('joint-')}
    ground=J['ground'][2]; X[:,2]-=ground
    for k in J: J[k]=J[k]-np.array([0,0,ground])
    used=sorted(set(i for f in F for i in f)); remap={o:n for n,o in enumerate(used)}; FT_=FT
    P=X[used]; Fs=[[remap[i] for i in f] for f in F]
    top=P[:,2].max(); s0=1.86/top
    O=dict(hips=(0,0,.96),torso=(0,0,1.02),neck=(0,0,1.64),sh={1:(SHX,0,1.57),-1:(-SHX,0,1.57)},el={1:(SHX,0,1.28),-1:(-SHX,0,1.28)},wr={1:(SHX,0,1.01),-1:(-SHX,0,1.01)},
           hp={1:(.115,0,.94),-1:(-.115,0,.94)},kn={1:(.115,0,.51),-1:(-.115,0,.51)},an={1:(.115,0,.09),-1:(-.115,0,.09)})
    O={k:({s:np.array(v[s]) for s in v} if isinstance(v,dict) else np.array(v)) for k,v in O.items()}
    HEADK=1.22 if sex=='m' else 1.25
    bones=[]  # name, empty, mh_a, mh_b, our_a, our_b, thick_scale
    hl=(J['head-2']-J['neck'])
    bones.append(('pelvis','hips',J['pelvis']+np.array([0,0,-.6]),J['spine-3'],O['hips']+np.array([0,0,-.12]),O['torso']+np.array([0,0,.08]),s0*(1.12 if sex=='m' else 1.16)))
    bones.append(('spine','torsoP',J['spine-3'],J['neck'],O['torso']+np.array([0,0,.08]),O['neck'],s0*(1.22 if sex=='m' else 1.02)))
    bones.append(('head','headP',J['neck'],J['head-2'],O['neck'],O['neck']+np.array([0,0,hl[2]*s0*HEADK]),s0*HEADK))
    for sd,s in (('l',1),('r',-1)):
        S='L' if s==1 else 'R'
        def lim(nm,emp,a,b,oa,ob,k=1.0): bones.append((nm+S,emp+S,J[a],J[b],oa,ob,s0*k))
        lim('uarm','sh',f'{sd}-shoulder',f'{sd}-elbow',O['sh'][s],O['el'][s],1.28 if sex=='m' else 1.04)
        lim('farm','el',f'{sd}-elbow',f'{sd}-hand',O['el'][s],O['wr'][s],1.24 if sex=='m' else 1.02)
        hd=J[f'{sd}-hand']+(J[f'{sd}-hand']-J[f'{sd}-elbow'])*0.35
        bones.append(('hand'+S,'wr'+S,J[f'{sd}-hand'],hd,O['wr'][s],O['wr'][s]+np.array([0,0,-np.linalg.norm(hd-J[f'{sd}-hand'])*s0*1.1]),s0*1.1))
        lim('thigh','hp',f'{sd}-upper-leg',f'{sd}-knee',O['hp'][s],O['kn'][s],1.16 if sex=='m' else 1.12)
        lim('shin','kn',f'{sd}-knee',f'{sd}-ankle',O['kn'][s],O['an'][s],1.12)
        ft=J[f'{sd}-foot-2']; fl=np.linalg.norm(ft-J[f'{sd}-ankle'])*s0
        d=ft-J[f'{sd}-ankle']; d=d/np.linalg.norm(d)
        bones.append(('foot'+S,'an'+S,J[f'{sd}-ankle'],ft,O['an'][s],O['an'][s]+d*fl,s0*1.05))
    def rot(a,b):
        a=a/np.linalg.norm(a); b=b/np.linalg.norm(b); v=np.cross(a,b); c=a@b
        if np.linalg.norm(v)<1e-8: return np.eye(3)
        K=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]); return np.eye(3)+K+K@K*(1/(1+c))
    Ms=[]
    for (nm,emp,a,b,oa,ob,k) in bones:
        da=b-a; L=np.linalg.norm(da); u=da/L; R=rot(da,ob-oa); ls=np.linalg.norm(ob-oa)/L
        Sm=np.eye(3)*k+np.outer(u,u)*(ls-k)   # stretch along bone, thickness k
        Ms.append((R@Sm,a,oa))
    # weights: distance to MH bone segments, smooth softmin
    D=[]
    for (nm,emp,a,b,oa,ob,k) in bones:
        ab=b-a; t=np.clip(((P-a)@ab)/(ab@ab),0,1); D.append(np.linalg.norm(P-(a+t[:,None]*ab),axis=1))
    D=np.array(D).T
    # side gating: left bones can't own right-side verts
    for j,(nm,*_) in enumerate(bones):
        if nm.endswith('L'): D[P[:,0]<-0.15,j]+=50
        if nm.endswith('R'): D[P[:,0]>0.15,j]+=50
    shx=abs(J['l-shoulder'][0])
    for j,(nm,*_) in enumerate(bones):
        if nm[:4] in ('uarm','farm','hand'): D[np.abs(P[:,0])<shx*0.8,j]+=50; D[:,j]+=np.clip(shx*1.05-np.abs(P[:,0]),0,None)*3
    Wt=np.exp(-(D-D.min(1,keepdims=True))/SIG); Wt[Wt<0.02]=0; Wt/=Wt.sum(1,keepdims=True)
    Q=np.zeros_like(P)
    for j,(A,a,oa) in enumerate(Ms): Q+=Wt[:,j:j+1]*(((P-a)@A.T)+oa)
    # Laplacian smooth where bones blend (shoulders, armpits, hips) to kill the angular look
    nb=[set() for _ in range(len(Q))]
    for f in Fs:
        for a_,b_ in zip(f,f[1:]+f[:1]): nb[a_].add(b_); nb[b_].add(a_)
    srt=np.sort(Wt,1); blend=srt[:,-2]>0.08
    names=[b[0] for b in bones]
    armsp=np.zeros(len(Q),bool)
    for j,nm in enumerate(names):
        if nm.startswith('uarm'): armsp|=(Wt[:,j]>0.05)&(Wt[:,names.index('spine')]>0.05)
    sel=np.where(blend|armsp)[0]
    for it in range(12):
        Q2=Q.copy()
        for i in sel:
            if nb[i]: Q2[i]=Q[i]*0.5+Q[list(nb[i])].mean(0)*0.5
        Q=Q2
    hj=names.index('head'); A,a,oa=Ms[hj]
    LM={k:((J[k]-a)@A.T)+oa for k in ('l-eye','r-eye','mouth','head-2','jaw','head')}
    np.savez(out,FT=np.array(FT_),LM=np.array([LM[k] for k in ('l-eye','r-eye','mouth','head-2','jaw','head')]),P=Q,W=Wt,F=np.array([f+[f[-1]]*(4-len(f)) for f in Fs]),flen=np.array([len(f) for f in Fs]),bones=np.array([b[1] for b in bones]),names=np.array([b[0] for b in bones]))
    print(out,Q[:,2].min(),Q[:,2].max(),Q[:,0].min(),Q[:,0].max(),len(Q))
build('m','body_m.npz'); build('f','body_f.npz')

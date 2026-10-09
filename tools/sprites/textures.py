# Procedural painted-look PBR maps (numpy+PIL): per material colour (_c), roughness (_r), height/bump (_h). 1024px, tileable (FFT noise).
# Muted palette: concrete grey, soot, dirty bone, oxidised metal, olive, ivory + slate blue. Usage: textures.py OUTDIR
import numpy as np, os, sys
from PIL import Image, ImageDraw, ImageFilter
S=1024
def fnoise(beta=2.0,seed=0,size=S):
    r=np.random.default_rng(seed); w=r.standard_normal((size,size))
    fx=np.fft.fftfreq(size)[:,None]; fy=np.fft.fftfreq(size)[None,:]; f=np.sqrt(fx**2+fy**2); f[0,0]=1
    n=np.fft.ifft2(np.fft.fft2(w)/f**(beta/2)).real; n-=n.min(); return n/n.max()
def N(beta,seed): return fnoise(beta,seed)
def hexc(h): return np.array([int(h[i:i+2],16) for i in (1,3,5)],dtype='float32')/255
def blur(a,r): return np.asarray(Image.fromarray((np.clip(a,0,1)*255).astype('uint8')).filter(ImageFilter.GaussianBlur(r))).astype('float32')/255
def smooth(x,a,b): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
def lerp(a,b,t): return a+(b-a)*t[...,None] if np.ndim(t)==2 else a+(b-a)*t
def paint(fn):  # draw on L canvas -> float
    im=Image.new('L',(S,S),0); d=ImageDraw.Draw(im); fn(d); return np.asarray(im).astype('float32')/255
def save(name,c,r,h,out):
    f=lambda a:Image.fromarray((np.clip(a,0,1)*255).astype('uint8'))
    f(c).save(f'{out}/{name}_c.png'); f(r).save(f'{out}/{name}_r.png'); f(h).save(f'{out}/{name}_h.png')
def weave(freq,ang=0.0,sharp=1.0):
    y,x=np.mgrid[0:S,0:S]/S*freq*2*np.pi; a=np.sin(x)*np.sin(y); return (a*0.5+0.5)**sharp
def twill(freq):
    y,x=np.mgrid[0:S,0:S]/S*freq*2*np.pi; return 0.5+0.5*np.sin(x+y)
def stitches(d,x0,y0,x1,y1,step=14,col=255,w=3):
    L=max(abs(x1-x0),abs(y1-y0)); n=int(L/step)
    for i in range(n):
        t0=i/n; t1=(i+0.55)/n; d.line([(x0+(x1-x0)*t0,y0+(y1-y0)*t0),(x0+(x1-x0)*t1,y0+(y1-y0)*t1)],fill=col,width=w)
def grime(seed,low=0.55):
    n=N(2.6,seed); return smooth(n,low,low+0.3)
def scratches(seed,n=60,length=120,w=1):
    r=np.random.default_rng(seed)
    def f(d):
        for _ in range(n):
            x,y=r.integers(0,S,2); a=r.random()*np.pi; l=r.integers(20,length)
            d.line([(x,y),(x+np.cos(a)*l,y+np.sin(a)*l)],fill=int(120+r.integers(0,135)),width=w)
    return paint(f)
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
G=lambda s:grime(s)
# ---- jacket: faded concrete-grey heavy canvas, seams, stitching, stains, frayed wear
wv=weave(180,sharp=1.4); big=N(2.2,1); mid=N(1.6,2); fine=N(1.0,3)
col=lerp(hexc('#6b6c66'),hexc('#989a92'),smooth(big,0.3,0.75)); col=col*(0.9+0.2*(wv[...,None]*0.5+0.5*fine[...,None]))
def seam(d):
    for x in (0,256,512,768): d.line([(x,0),(x,S)],fill=255,width=5)
    for y in (0,340,680): d.line([(0,y),(S,y)],fill=255,width=4)
sm=paint(seam)
def stch(d):
    for x in (0,256,512,768):
        stitches(d,x-9,0,x-9,S,16,255,3); stitches(d,x+9,0,x+9,S,16,255,3)
    for y in (0,340,680): stitches(d,0,y-8,S,y-8,16,255,3)
st=paint(stch)
col=col*(1-0.5*blur(sm,1.5)[...,None])+0.06*st[...,None]
stain=smooth(N(2.4,4),0.62,0.8); col=col*(1-0.35*stain[...,None])*(1-0.25*grime(5,0.6)[...,None])
sc=scratches(6,90,160,1); col=lerp(col,hexc('#b6b7ae'),0.35*sc*smooth(N(2,7),0.4,0.7))
hj=0.35*wv+0.25*mid+0.6*blur(sm,1.2)*-1+0.5+0.15*st
rj=0.88-0.2*stain+0.1*fine
save('jacket',col,np.stack([rj]*3,-1),np.stack([np.clip(hj,0,1)]*3,-1),out)
# ---- pants: soot twill, dust at folds
tw=twill(220); n1=N(2.0,11); col=lerp(hexc('#45463f'),hexc('#6d6e66'),smooth(n1,0.35,0.8)); col=col*(0.88+0.24*tw[...,None])
col=lerp(col,hexc('#5a5a54'),0.35*smooth(N(2.6,12),0.64,0.85)); col=col*(1-0.3*grime(13,0.6)[...,None])
sc=scratches(14,50,100); col=lerp(col,hexc('#6b6a63'),0.25*sc)
h=0.4*tw+0.3*N(1.4,15)+0.2
save('pants',col,np.stack([0.9-0.15*n1]*3,-1),np.stack([np.clip(h,0,1)]*3,-1),out)
# ---- olive stamped armour panels
P=256
def panel(d):
    for gx in range(0,S,P):
        for gy in range(0,S,P):
            d.rectangle([gx+4,gy+4,gx+P-4,gy+P-4],outline=255,width=5)           # stamped border groove
            d.rectangle([gx+36,gy+52,gx+P-36,gy+P-52],outline=140,width=4)       # embossed inner plate
            for dx,dy in ((22,22),(P-22,22),(22,P-22),(P-22,P-22)): d.ellipse([gx+dx-9,gy+dy-9,gx+dx+9,gy+dy+9],fill=200,outline=255)
            d.line([(gx+P//2,gy+60),(gx+P//2,gy+P-60)],fill=110,width=3)
pm=paint(panel)
def sten(d):
    r=np.random.default_rng(3)
    for k in range(5):
        x=int(r.integers(0,S-80)); y=int(r.integers(0,S-30)); 
        for j in range(r.integers(3,6)): d.rectangle([x+j*14,y,x+j*14+8,y+int(r.integers(10,24))],fill=255)
stn=paint(sten)
base=lerp(hexc('#4d5230'),hexc('#6c7143'),smooth(N(2.2,21),0.3,0.75)); col=base*(0.88+0.24*N(1.2,22)[...,None])
chip=smooth(N(2.0,23),0.6,0.7)*(0.5+blur(pm,2)*0.8)+smooth(scratches(24,120,140,2),0.3,0.6)*0.7
col=lerp(col,hexc('#8f918a'),np.clip(chip,0,1)*0.9)                      # chipped paint -> bare steel
rust=smooth(N(2.8,25),0.64,0.8)*np.clip(chip,0,1)*1.5; col=lerp(col,hexc('#6b4630'),np.clip(rust,0,1)*0.6)
col=col*(1-0.55*blur(pm*(pm>0.9),1.8)[...,None])*(1-0.35*grime(26,0.55)[...,None]); col=lerp(col,hexc('#d4d2c4'),0.65*stn)
h=0.5+0.28*blur(pm,2)-0.55*blur((pm>0.95).astype('float32'),1.2)+0.1*N(1.0,27)-0.15*np.clip(chip,0,1)
r=0.55+0.25*N(1.5,28)-0.25*np.clip(chip,0,1)*-1
save('olive',col,np.stack([np.clip(r,0,1)]*3,-1),np.stack([np.clip(h,0,1)]*3,-1),out)
# ---- ivory ceramic w/ panel lines + slate-blue marks
iv=lerp(hexc('#d9d2bd'),hexc('#bdb59f'),smooth(N(2.4,31),0.35,0.8)); iv=iv*(0.94+0.1*N(1.2,32)[...,None])
def pl(d):
    for x in range(0,S,256): d.line([(x,0),(x,S)],fill=255,width=4)
    for y in (96,352,608,864): d.line([(0,y),(S,y)],fill=255,width=4); d.line([(0,y+22),(S,y+22)],fill=160,width=2)
    for y in (96,352,608,864):
        for x in range(40,S,128): d.ellipse([x-5,y+60-5,x+5,y+60+5],fill=220)
pln=paint(pl)
def marks(d):
    for y in (130,386,642,898): d.rectangle([0,y,S,y+34],fill=255); d.rectangle([0,y+44,S,y+52],fill=255)
    for x in range(100,S,256): d.rectangle([x,0,x+14,S],fill=170)
mk=paint(marks); mk=mk*(0.75+0.25*smooth(N(1.5,33),0.3,0.7))*(1-0.5*smooth(scratches(34,80,120,2),0.4,0.8))
crack=smooth(scratches(35,25,260,1),0.5,0.9)*0.5
gro=blur(pln,1.5); iv=iv*(1-0.45*gro[...,None])*(1-0.18*grime(36,0.58)[...,None])*(1-0.25*crack[...,None]); iv=lerp(iv,hexc('#4d5e74'),0.9*mk)
iv=iv*(1-0.15*smooth(N(2.6,37),0.6,0.8)[...,None])
save('ivory',iv,np.stack([np.clip(0.28+0.25*N(1.6,38)+0.2*gro,0,1)]*3,-1),np.stack([np.clip(0.6-0.45*gro-0.1*crack+0.05*N(1,39),0,1)]*3,-1),out)
# ---- skin
s=lerp(hexc('#8a6249'),hexc('#a47a5e'),smooth(N(2.5,41),0.3,0.7)); s=s*(0.95+0.1*N(0.8,42)[...,None]); s=lerp(s,hexc('#4a3a30'),0.25*smooth(N(0.6,43),0.55,0.75))
save('skin',s,np.stack([0.55+0.2*N(1.5,44)]*3,-1),np.stack([0.5+0.2*N(0.6,45)]*3,-1),out)
# ---- boots: cracked dark leather
cr=N(1.3,51); lc=lerp(hexc('#322d28'),hexc('#574f44'),smooth(N(2.4,52),0.3,0.8)); lc=lc*(0.85+0.3*cr[...,None]); crk=smooth(np.abs(N(2.0,53)-0.5)*-1+0.5,0.46,0.5)
lc=lerp(lc,hexc('#5c5347'),0.5*smooth(scratches(54,140,100,2),0.3,0.7)); lc=lc*(1-0.4*grime(55,0.5)[...,None]); lc=lerp(lc,hexc('#6e6a60'),0.18*smooth(N(2.6,56),0.62,0.8))
save('boot',lc,np.stack([0.7+0.2*N(1.2,57)]*3,-1),np.stack([np.clip(0.5+0.3*cr-0.25*crk,0,1)]*3,-1),out)
# ---- canvas webbing / pouches
wb=weave(260,sharp=1.1); cc=lerp(hexc('#47463a'),hexc('#6c6850'),smooth(N(2.3,61),0.3,0.8)); cc=cc*(0.8+0.3*wb[...,None]); cc=cc*(1-0.35*grime(62,0.5)[...,None])
def rib(d):
    for y in range(0,S,64): d.line([(0,y),(S,y)],fill=255,width=3)
    for x in range(0,S,128): stitches(d,x,0,x,S,14,255,3)
rb=paint(rib); cc=cc*(1-0.4*blur(rb,1)[...,None]); cc=lerp(cc,hexc('#8d8872'),0.25*smooth(scratches(63,90,90,2),0.3,0.7))
save('canvas',cc,np.stack([0.9-0.1*wb]*3,-1),np.stack([np.clip(0.3+0.4*wb-0.25*blur(rb,1),0,1)]*3,-1),out)
# ---- metal: gunmetal, rust, scratches
mt=lerp(hexc('#4c4f4e'),hexc('#7b7e7b'),smooth(N(2.0,71),0.3,0.8)); rs=smooth(N(2.6,72),0.6,0.78); mt=lerp(mt,hexc('#6d4a31'),rs*0.8); mt=lerp(mt,hexc('#a5a6a0'),0.5*smooth(scratches(73,200,120,1),0.3,0.7))
mt=mt*(1-0.3*grime(74,0.5)[...,None])
save('metal',mt,np.stack([np.clip(0.38+0.35*rs+0.15*N(1.2,75),0,1)]*3,-1),np.stack([np.clip(0.5+0.3*N(0.8,76)-0.3*rs,0,1)]*3,-1),out)
# ---- cloth: ribbed knit scarf/gaiter, black
kn=0.5+0.5*np.sin(np.arange(S)[None,:]/S*np.pi*2*90)*np.ones((S,1)); kc=lerp(hexc('#2a2a28'),hexc('#4a4944'),smooth(N(2.2,81),0.3,0.8)); kc=kc*(0.7+0.5*kn[...,None]); kc=kc*(1-0.3*grime(82,0.5)[...,None])
save('cloth',kc,np.stack([np.full((S,S),0.95)]*3,-1),np.stack([0.3+0.5*kn]*3,-1),out)
# ---- glass lens (dark teal) / amber vial / rubber
gl=lerp(hexc('#17262a'),hexc('#2d4a50'),smooth(N(2.0,91),0.3,0.8)); save('glass',gl,np.full((S,S,3),0.06),np.full((S,S,3),0.5),out)
am=lerp(hexc('#5d3a15'),hexc('#9a6a28'),smooth(N(2.0,92),0.3,0.8)); save('amber',am,np.full((S,S,3),0.15)+0.1*N(1,93)[...,None],np.full((S,S,3),0.5),out)
rub=lerp(hexc('#1c1c1b'),hexc('#2d2d2b'),smooth(N(2.0,94),0.3,0.8)); save('rubber',rub,np.full((S,S,3),0.85),np.stack([0.5+0.3*N(0.8,95)]*3,-1),out)

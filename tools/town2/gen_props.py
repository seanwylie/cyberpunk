#!/usr/bin/env python3
"""Harrow Reach props -> public/town2/props/*.png.
(1) h_* variants: the Rustline painted props regraded to oxide/gunmetal with forge-warm light (same silhouettes, a different town).
(2) procedural landmarks (supersampled iso boxes with noise, rivets, glow): furnace_tower, tram_platform, tram_car, smokestack, slag_cart, forge_hall, guild_counter, ladle_crane.
Drop-in replaceable by AI-generated PNGs of the same name.   usage: python3 tools/town2/gen_props.py"""
import numpy as np, os, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont
SRC='public/town/props'; OUT='public/town2/props'; os.makedirs(OUT,exist_ok=True)
FONT=None
for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
    if os.path.exists(f): FONT=f; break
def font(sz): return ImageFont.truetype(FONT,sz) if FONT else ImageFont.load_default()
# ---------- (1) regrade ----------
def regrade(name,out=None,warm=1.0,dark=.92,hue=0.0):
    im=Image.open(f'{SRC}/{name}.png').convert('RGBA'); a=np.array(im).astype(float); rgb=a[...,:3]/255; al=a[...,3:]
    lum=rgb.mean(-1,keepdims=True)
    # oxide/gunmetal split-tone: shadows toward cool gunmetal-brown, lights toward forge orange; desaturate the original teal/blue
    sat=np.clip(rgb.max(-1,keepdims=True)-rgb.min(-1,keepdims=True),0,1); grey=np.repeat(lum,3,-1)
    mix=grey*.82+rgb*.18
    sh=np.array([.78,.72,.70]); hi=np.array([1.28,.98,.74]); t=np.clip(lum*1.5,0,1)
    tone=sh*(1-t)+hi*t; out_rgb=mix*tone*dark
    # rust bloom on mid-tones, ember rim light from below
    h,w=lum.shape[:2]; yy=np.linspace(1,0,h)[:,None,None]; out_rgb+=np.array([.10,.035,0])*warm*(yy**2.2)*(al/255)
    # keep original saturated warm accents (lights/signs) a bit
    out_rgb+= (rgb-grey)*np.clip(rgb[...,0:1]-rgb[...,2:3],0,1)*.6
    res=np.concatenate([np.clip(out_rgb,0,1)*255,al],-1); Image.fromarray(res.astype(np.uint8)).save(f'{OUT}/{out or "h_"+name}.png')
for n in ['bld1','bld2','bld3','container','slab','barrier','barrier_corner','gantry','crates','barrels','lamp','cables','steam_drums','workbench','lockers','board_jobs','fixer_booth','noticeboard','stall_weapons','stall_goods','stall_vendor','gate_arch','junk','bench','banner_pole','scaffold']:
    if os.path.exists(f'{SRC}/{n}.png'): regrade(n)
# ---------- (2) procedural iso landmarks ----------
SS=2
TW=100  # px per tile at 1x (sprite space)
def iso(x,y,z,ox,oy): return (ox+(x-y)*TW/2*SS, oy+(x+y)*TW/4*SS-z*SS)
def noise_tex(w,h,seed,amt=18,scale=3):
    r=np.random.RandomState(seed); n=r.randn(h//scale+1,w//scale+1); n=np.array(Image.fromarray(((n-n.min())/(n.max()-n.min())*255).astype(np.uint8)).resize((w,h),Image.BICUBIC)).astype(float)/255-.5
    return n*amt
class Canvas:
    def __init__(s,w,h): s.w,s.h=w*SS,h*SS; s.im=Image.new('RGBA',(s.w,s.h),(0,0,0,0)); s.d=ImageDraw.Draw(s.im); s.glow=Image.new('RGBA',(s.w,s.h),(0,0,0,0)); s.gd=ImageDraw.Draw(s.glow)
    def poly(s,pts,col,tex=14,seed=0,edge=None):
        m=Image.new('L',(s.w,s.h),0); ImageDraw.Draw(m).polygon(pts,fill=255)
        bb=m.getbbox()
        if not bb: return
        x0,y0,x1,y1=bb; t=noise_tex(x1-x0,y1-y0,seed,tex,4*SS); layer=Image.new('RGB',(x1-x0,y1-y0),col); a=np.array(layer).astype(float)+t[...,None]; layer=Image.fromarray(np.clip(a,0,255).astype(np.uint8))
        s.im.paste(layer,(x0,y0),m.crop(bb))
        if edge: s.d.polygon(pts,outline=edge)
    def box(s,x,y,w,d,z0,h,ox,oy,top,left,right,seed=0,rivets=True):
        P=lambda a,b,c:iso(a,b,c,ox,oy)
        s.poly([P(x,y+d,z0),P(x,y+d,z0+h),P(x+w,y+d,z0+h),P(x+w,y+d,z0)],left,16,seed+1)      # left/front-left (south-west face)
        s.poly([P(x+w,y,z0),P(x+w,y,z0+h),P(x+w,y+d,z0+h),P(x+w,y+d,z0)],right,16,seed+2)    # right face (south-east)
        s.poly([P(x,y,z0+h),P(x+w,y,z0+h),P(x+w,y+d,z0+h),P(x,y+d,z0+h)],top,20,seed+3)         # top
        c=[ (min(max(v-30,0),255)) for v in left]
        for k,(a,b) in enumerate([(P(x,y+d,z0+h),P(x+w,y+d,z0+h)),(P(x+w,y+d,z0+h),P(x+w,y,z0+h))]): s.d.line([a,b],fill=tuple(min(255,v+40) for v in (top if k else left)),width=2*SS)
        s.d.line([P(x,y+d,z0),P(x,y+d,z0+h)],fill=(18,16,16,255),width=2*SS); s.d.line([P(x+w,y+d,z0),P(x+w,y+d,z0+h)],fill=(18,16,16,255),width=2*SS); s.d.line([P(x+w,y,z0),P(x+w,y,z0+h)],fill=(18,16,16,255),width=2*SS)
        if rivets:
            for u in np.arange(.08,.95,.12):
                for zz in (z0+h*.08,z0+h*.92):
                    for (face,(a,b)) in (('l',(P(x,y+d,zz),P(x+w,y+d,zz))),('r',(P(x+w,y+d,zz),P(x+w,y,zz)))):
                        px=a[0]+(b[0]-a[0])*u; py=a[1]+(b[1]-a[1])*u; s.d.ellipse([px-1.6*SS,py-1.6*SS,px+1.6*SS,py+1.6*SS],fill=(24,22,22,255))
    def light(s,x,y,r,col,a=200):
        s.gd.ellipse([x-r,y-r,x+r,y+r],fill=col+(a,))
    def finish(s,name,blur=14,shadow=True):
        g=s.glow.filter(ImageFilter.GaussianBlur(blur*SS*1.8)); r_,g_,b_,a_=g.split(); g=Image.merge('RGBA',(r_,g_,b_,a_.point(lambda v:int(v*.38)))); out=Image.new('RGBA',(s.w,s.h),(0,0,0,0))
        if shadow:
            sh=Image.new('RGBA',(s.w,s.h),(0,0,0,0)); alpha=s.im.split()[3].point(lambda v:int(v*.0)); 
        out=Image.alpha_composite(out,s.im); out=Image.alpha_composite(out,Image.eval(g,lambda v:v)) if False else Image.alpha_composite(out,g)
        out=Image.alpha_composite(out,s.glow.filter(ImageFilter.GaussianBlur(2*SS)).point(lambda v:v) if False else Image.new('RGBA',(s.w,s.h),(0,0,0,0)))
        out=out.resize((s.w//SS,s.h//SS),Image.LANCZOS); bb=out.getbbox(); out=out.crop(bb); out.save(f'{OUT}/{name}.png'); print(name,out.size)
def windows(c,x,y,w,d,z0,h,ox,oy,cols,rows,lit=(255,168,70),seed=1,face='l'):
    P=lambda a,b,cc:iso(a,b,cc,ox,oy); r=np.random.RandomState(seed)
    for i in range(cols):
        for j in range(rows):
            u0=(i+.2)/cols; u1=(i+.8)/cols; v0=z0+h*(j+.25)/rows; v1=z0+h*(j+.75)/rows
            if face=='l': A=P(x+w*u0,y+d,v0);B=P(x+w*u1,y+d,v0);C=P(x+w*u1,y+d,v1);D=P(x+w*u0,y+d,v1)
            else: A=P(x+w,y+d-d*u0,v0);B=P(x+w,y+d-d*u1,v0);C=P(x+w,y+d-d*u1,v1);D=P(x+w,y+d-d*u0,v1)
            on=r.rand()<.55; col=lit if on else (20,22,24)
            c.d.polygon([A,B,C,D],fill=col+(255,)); 
            if on: cx=(A[0]+C[0])/2; cy=(A[1]+C[1])/2; c.light(cx,cy,26*SS,lit,90)
def text_on(c,txt,pos,sz,col,rot_skew=-.5):
    # draw text onto a small layer and shear it onto the left (south-west) face
    f=font(sz*SS); tmp=Image.new('RGBA',(int(len(txt)*sz*SS*.8),int(sz*SS*1.4)),(0,0,0,0)); ImageDraw.Draw(tmp).text((0,0),txt,font=f,fill=col+(255,))
    tmp=tmp.transform(tmp.size,Image.AFFINE,(1,0,0,rot_skew*-1,1,0),Image.BICUBIC); c.im.alpha_composite(tmp,(int(pos[0]),int(pos[1])))
# --- furnace tower (Forge Repair): stacked brick body, glowing mouth, stack, pipes ---
c=Canvas(420,560); ox,oy=210*SS,300*SS
c.box(-1.4,-1.4,2.8,2.8,0,26,ox,oy,(84,70,66),(64,52,50),(46,38,38),seed=3)
c.box(-1.0,-1.0,2.0,2.0,26,150,ox,oy,(92,76,70),(72,58,54),(52,42,42),seed=9)
c.box(-.6,-.6,1.2,1.2,176,60,ox,oy,(88,70,64),(68,54,50),(48,38,38),seed=15)
# glowing furnace mouth on south-west face
P=lambda a,b,cc:iso(a,b,cc,ox,oy)
mouth=[P(-.55,1.0,30),P(.45,1.0,30),P(.45,1.0,100),P(-.55,1.0,100)]
c.d.polygon(mouth,fill=(255,150,40,255)); inner=[P(-.4,1.0,38),P(.3,1.0,38),P(.3,1.0,90),P(-.4,1.0,90)]; c.d.polygon(inner,fill=(255,224,150,255))
for k in range(5): a=P(-.55+k*.2,1.0,30); b=P(-.55+k*.2,1.0,100); c.d.line([a,b],fill=(30,20,18,255),width=4*SS)
c.light(*P(-.05,1.0,66),90*SS,(255,120,30),210)
# ribs + hazard band
for z in (60,110,150):
    c.d.line([P(-1,1,z),P(1,1,z)],fill=(30,26,26,255),width=3*SS); c.d.line([P(1,1,z),P(1,-1,z)],fill=(24,20,20,255),width=3*SS)
for i in range(7):
    z=120+i*6; 
# smokestack
c.box(-.28,-.28,.56,.56,236,150,ox,oy,(70,60,58),(52,44,42),(38,32,32),seed=21,rivets=False)
c.d.polygon([P(-.34,-.34,386),P(.34,-.34,386),P(.34,.34,386),P(-.34,.34,386)],fill=(40,34,34,255)); c.light(*P(0,0,392),40*SS,(255,110,30),150)
# pipes from tower to ground
c.d.line([P(1.0,.4,40),P(1.5,.4,40),P(1.5,.4,0)],fill=(60,52,50,255),width=9*SS); c.d.line([P(1.0,.4,40),P(1.5,.4,40),P(1.5,.4,0)],fill=(95,80,74,255),width=3*SS)
# steam vents glow
c.light(*P(1.5,.4,44),22*SS,(255,160,60),110)
c.finish('furnace_tower',10)

def face_text(c,text,A,B,hgt,col,fsz=64,glowc=None):
    """Text laid onto an iso wall face: A,B = bottom-left / bottom-right points (px), hgt = face height in px (drawn upward)."""
    f=font(fsz); tmp=Image.new('RGBA',(900,150),(0,0,0,0)); d=ImageDraw.Draw(tmp); bb=d.textbbox((0,0),text,font=f); d.text((450-(bb[2]-bb[0])/2,75-(bb[3]-bb[1])/2-bb[1]),text,font=f,fill=col+(255,))
    bb=tmp.getbbox(); tmp=tmp.crop(bb); w,h=tmp.size; dx,dy=B[0]-A[0],B[1]-A[1]; L=math.hypot(dx,dy); sc=min(L*.86/w,hgt*.7/h); tmp=tmp.resize((max(1,int(w*sc)),max(1,int(h*sc))),Image.LANCZOS); w,h=tmp.size
    m=(A[0]+dx*.5,A[1]+dy*.5-hgt*.5); slope=dy/dx if dx else 0
    # shear the text vertically so it follows the face's baseline slope
    sh=tmp.transform((w,int(h+abs(slope)*w)+2),Image.AFFINE,(1,0,0,-slope,1,-(slope*w if slope<0 else 0)*-1 if False else (0 if slope>=0 else -slope*w)),Image.BICUBIC)
    pos=(int(m[0]-w/2),int(m[1]-h/2-(slope*w/2)))
    c.im.alpha_composite(sh,(max(0,pos[0]),max(0,pos[1])))
    if glowc: 
        g=sh.copy(); c.glow.alpha_composite(g,(max(0,pos[0]),max(0,pos[1])))
# --- forge_hall (Heavy Works Parts): long low industrial hall with big oxide-red sign slab, loading dock, roller shutter glow ---
c=Canvas(560,380); ox,oy=250*SS,150*SS
c.box(-2.4,-1.2,4.8,2.4,0,92,ox,oy,(104,66,56),(86,52,44),(60,36,32),seed=31)
c.box(-2.6,-1.4,5.2,.4,92,12,ox,oy,(120,80,60),(94,60,46),(70,44,34),seed=33,rivets=False)  # roof lip
P=lambda a,b,cc:iso(a,b,cc,ox,oy)
for k in range(4):
    x0=-2.0+k*1.2; c.d.polygon([P(x0,1.2,6),P(x0+.9,1.2,6),P(x0+.9,1.2,56),P(x0,1.2,56)],fill=(255,170,64,255))
    for s_ in range(8): c.d.line([P(x0,1.2,6+s_*6.3),P(x0+.9,1.2,6+s_*6.3)],fill=(120,60,24,255),width=2*SS)
    c.light(*P(x0+.45,1.2,32),60*SS,(255,140,40),150)
c.d.polygon([P(-2.3,1.2,66),P(2.3,1.2,66),P(2.3,1.2,88),P(-2.3,1.2,88)],fill=(20,18,18,255))
for k in range(0,9): c.d.polygon([P(-2.3+k*.55,1.2,66),P(-2.3+k*.55+.27,1.2,66),P(-2.3+k*.55+.07,1.2,88),P(-2.3+k*.55-.2,1.2,88)],fill=(210,170,40,255)) if False else None
# polish: sign slab lettering, hazard chevrons on the dock edge, roof vents + stacks with ember glow, shutter frames
face_text(c,'HEAVY WORKS',P(-2.3,1.2,66),P(2.3,1.2,66),22*SS,(255,196,96),fsz=72,glowc=True)
c.d.line([P(-2.3,1.2,64),P(2.3,1.2,64)],fill=(230,150,50,255),width=2*SS); c.d.line([P(-2.3,1.2,90),P(2.3,1.2,90)],fill=(40,28,24,255),width=3*SS)
for k in range(10):
    a=-2.3+k*.46; c.d.polygon([P(a,1.2,0),P(a+.2,1.2,0),P(a+.3,1.2,7),P(a+.1,1.2,7)],fill=(210,160,40,255))
for k in range(4):
    x0=-2.0+k*1.2; c.d.line([P(x0-.04,1.2,58),P(x0+.94,1.2,58)],fill=(40,26,22,255),width=3*SS); c.d.line([P(x0-.04,1.2,4),P(x0+.94,1.2,4)],fill=(40,26,22,255),width=3*SS)
for vx in (-1.4,0.2,1.6):
    c.box(vx,-.6,.5,.5,104,16,ox,oy,(86,56,48),(66,42,36),(46,30,26),seed=60+int(vx*10),rivets=False); c.light(*P(vx+.25,-.35,122),14*SS,(255,140,50),150)
c.box(1.9,-.9,.45,.45,104,40,ox,oy,(70,52,46),(54,40,36),(38,28,24),seed=70,rivets=False); c.light(*P(2.12,-.68,148),20*SS,(255,120,40),160)
c.finish('forge_hall',12)
# --- guild_counter (Retirees' Guild reclaim counter): timber-and-sheet shack with hanging lamps, hooks, counter ---
c=Canvas(420,330); ox,oy=190*SS,120*SS
c.box(-1.7,-1.0,3.4,2.0,0,70,ox,oy,(86,70,54),(70,56,44),(48,38,30),seed=41)
P=lambda a,b,cc:iso(a,b,cc,ox,oy)
c.box(-1.9,.6,3.8,.8,0,26,ox,oy,(110,88,62),(90,72,50),(64,50,36),seed=45,rivets=False)  # counter
c.d.polygon([P(-1.3,1.0,34),P(1.3,1.0,34),P(1.3,1.0,64),P(-1.3,1.0,64)],fill=(24,20,18,255))
for k in range(5): c.d.ellipse([P(-1.0+k*.5,1.0,50)[0]-5*SS,P(-1.0+k*.5,1.0,50)[1]-5*SS,P(-1.0+k*.5,1.0,50)[0]+5*SS,P(-1.0+k*.5,1.0,50)[1]+5*SS],fill=(150,130,90,255))
for k in (-1,1):
    lx,ly=P(k*1.1,1.2,92); c.d.line([(lx,ly-30*SS),(lx,ly)],fill=(30,26,24,255),width=2*SS); c.d.ellipse([lx-9*SS,ly-9*SS,lx+9*SS,ly+9*SS],fill=(255,200,100,255)); c.light(lx,ly,56*SS,(255,160,60),170)
# corrugated awning
c.d.polygon([P(-2.0,1.6,86),P(2.0,1.6,86),P(2.0,.4,112),P(-2.0,.4,112)],fill=(120,52,38,255))
for k in range(12): a=-2.0+k*.333; c.d.line([P(a,1.6,86),P(a,.4,112)],fill=(86,36,26,255),width=2*SS)
# polish: painted guild board, stacked reclaim crates and a hanging scale
face_text(c,"RETIREES' GUILD",P(-1.9,1.4,0),P(1.9,1.4,0),26*SS,(236,214,150),fsz=60)
c.box(1.5,.2,.7,.7,0,22,ox,oy,(100,80,58),(80,62,44),(56,42,30),seed=47,rivets=False); c.box(1.6,.3,.5,.5,22,16,ox,oy,(110,90,64),(88,70,50),(62,48,34),seed=48,rivets=False)
c.box(-2.2,.3,.6,.6,0,18,ox,oy,(92,74,54),(74,58,42),(52,40,28),seed=49,rivets=False)
for k in range(3):
    hx=-.9+k*.9; a=P(hx,1.0,30); c.d.line([a,(a[0],a[1]+14*SS)],fill=(30,26,24,255),width=2*SS); c.d.ellipse([a[0]-5*SS,a[1]+14*SS,a[0]+5*SS,a[1]+24*SS],fill=(150,150,140,255))
c.finish('guild_counter',10)
# --- tram_platform + car (Reach Line transit) ---
c=Canvas(640,380); ox,oy=300*SS,120*SS
c.box(-3.0,-1.2,6.0,2.4,0,18,ox,oy,(88,86,84),(66,64,62),(46,44,44),seed=51)
P=lambda a,b,cc:iso(a,b,cc,ox,oy)
for k in range(12): c.d.polygon([P(-3.0+k*.5,1.2,18),P(-3.0+k*.5+.25,1.2,18),P(-3.0+k*.5+.25,1.2,2),P(-3.0+k*.5,1.2,2)],fill=(210,170,40,255)) if False else None
# yellow edge strip (dull brass hazard)
c.d.polygon([P(-3.0,1.2,18),P(3.0,1.2,18),P(3.0,1.0,18),P(-3.0,1.0,18)],fill=(190,150,48,255))
# canopy posts + roof
for xp in (-2.6,0,2.6): c.d.line([P(xp,1.0,18),P(xp,1.0,110)],fill=(34,32,32,255),width=7*SS)
c.box(-3.1,-1.3,6.2,2.7,110,12,ox,oy,(96,60,48),(74,46,38),(54,34,28),seed=57,rivets=False)
c.d.rectangle([P(-1.2,1.35,100)[0],P(-1.2,1.35,100)[1],P(1.2,1.35,100)[0],P(1.2,1.35,100)[1]+6*SS],fill=(24,22,22,255))
# tram car silhouette behind: boxy tram with lit windows
c.box(-2.6,-2.2,5.2,1.2,18,60,ox,oy,(110,92,70),(88,72,54),(62,50,38),seed=61)
windows(c,-2.6,-2.2,5.2,1.2,18,60,ox,oy,6,1,lit=(255,206,120),seed=5)
c.light(*P(0,1.1,60),120*SS,(255,170,70),90)
c.finish('tram_platform',10)
# --- ladle_crane (landmark in the plaza, overhead): gantry crane with hanging ladle glow ---
c=Canvas(420,520); ox,oy=210*SS,400*SS
P=lambda a,b,cc:iso(a,b,cc,ox,oy)
for (xp,yp) in ((-1.2,-1.2),(1.2,-1.2),(1.2,1.2),(-1.2,1.2)): c.d.line([P(xp,yp,0),P(xp,yp,230)],fill=(40,34,34,255),width=10*SS); c.d.line([P(xp,yp,0),P(xp,yp,230)],fill=(100,80,72,255),width=3*SS)
c.d.line([P(-1.2,-1.2,230),P(1.2,1.2,230)],fill=(56,46,44,255),width=12*SS); c.d.line([P(-1.2,1.2,230),P(1.2,-1.2,230)],fill=(56,46,44,255),width=12*SS)
c.d.line([P(0,0,230),P(0,0,150)],fill=(30,26,26,255),width=3*SS)
c.box(-.5,-.5,1.0,1.0,70,80,ox,oy,(130,70,46),(100,54,38),(70,38,28),seed=71)
c.d.ellipse([P(0,0,150)[0]-40*SS,P(0,0,150)[1]-14*SS,P(0,0,150)[0]+40*SS,P(0,0,150)[1]+14*SS],fill=(255,170,60,255)); c.light(*P(0,0,150),90*SS,(255,120,30),190)
c.finish('ladle_crane',12)
# --- smokestack (skyline backdrop on the perimeter) ---
c=Canvas(220,560); ox,oy=110*SS,420*SS
P=lambda a,b,cc:iso(a,b,cc,ox,oy)
c.box(-.7,-.7,1.4,1.4,0,70,ox,oy,(80,66,62),(62,50,46),(44,36,34),seed=81)
c.box(-.45,-.45,.9,.9,70,320,ox,oy,(74,62,58),(58,46,42),(40,32,30),seed=83,rivets=False)
for z in (120,190,260): c.d.line([P(-.45,.45,z),P(.45,.45,z)],fill=(26,22,22,255),width=3*SS); c.d.line([P(.45,.45,z),P(.45,-.45,z)],fill=(20,16,16,255),width=3*SS)
c.d.polygon([P(-.55,-.55,392),P(.55,-.55,392),P(.55,.55,392),P(-.55,.55,392)],fill=(36,30,30,255)); c.light(*P(0,0,398),44*SS,(255,100,28),170)
c.finish('smokestack',10)
# --- slag cart ---
c=Canvas(300,220); ox,oy=140*SS,100*SS
P=lambda a,b,cc:iso(a,b,cc,ox,oy)
c.box(-.9,-.55,1.8,1.1,14,34,ox,oy,(90,70,60),(72,56,48),(52,40,34),seed=91)
c.d.polygon([P(-.8,-.45,48),P(.8,-.45,48),P(.8,.45,48),P(-.8,.45,48)],fill=(255,126,34,255)); c.light(*P(0,0,48),60*SS,(255,110,30),170)
for (xp,yp) in ((-.6,.6),(.6,.6)): c.d.ellipse([P(xp,yp,10)[0]-12*SS,P(xp,yp,10)[1]-12*SS,P(xp,yp,10)[0]+12*SS,P(xp,yp,10)[1]+12*SS],fill=(22,20,20,255))
c.finish('slag_cart',8)
# --- h_junk polish: crisper scrap heap with ember glints and a soft contact shadow ---
def polish_junk():
    p=f'{OUT}/h_junk.png'
    if not os.path.exists(p): return
    from PIL import ImageEnhance
    im=Image.open(p).convert('RGBA'); a=im.split()[3]; rgb=im.convert('RGB'); rgb=ImageEnhance.Contrast(rgb).enhance(1.35); rgb=rgb.filter(ImageFilter.UnsharpMask(2,120,2)); rgb=ImageEnhance.Brightness(rgb).enhance(1.08)
    arr=np.array(rgb).astype(float); lum=arr.mean(-1); r=np.random.RandomState(7); mask=(lum>np.percentile(lum[np.array(a)>200],93))&(r.rand(*lum.shape)<.5)&(np.array(a)>200)
    arr[mask]=arr[mask]*.4+np.array([255,150,60])*.6
    out=Image.fromarray(np.clip(arr,0,255).astype(np.uint8)).convert('RGBA'); out.putalpha(a)
    pad=Image.new('RGBA',(out.width,out.height+10),(0,0,0,0)); sh=Image.new('RGBA',pad.size,(0,0,0,0)); ImageDraw.Draw(sh).ellipse([out.width*.08,out.height*.62,out.width*.92,out.height+8],fill=(0,0,0,110)); sh=sh.filter(ImageFilter.GaussianBlur(6))
    pad=Image.alpha_composite(pad,sh); pad.alpha_composite(out,(0,0)); pad.save(p); print('h_junk',pad.size)
polish_junk()

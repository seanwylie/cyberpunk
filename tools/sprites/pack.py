# Post-process raw Blender layer renders -> game atlas. Usage: pack.py RAW OUT
# Premultiplied-alpha downsample (no dark fringes), silhouette outline on the composite (flat sheet) and thin per-layer outline
# (layer sheets), light sharpen. Writes one flat sheet per anim (used by default in game), one sheet per layer, player.json, contact sheets.
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anim_spec import SPEC
from PIL import Image, ImageFilter
import numpy as np
RAW,OUT=sys.argv[1],sys.argv[2]
od=json.load(open(RAW+'/order.json')); LAYERS=od['layers']; DIRS=['S','SW','W','NW','N','NE','E','SE']
FPS={k:v['fps'] for k,v in SPEC.items()}; LOOP={k:v['loop'] for k,v in SPEC.items()}; HIT={k:v['hit'] for k,v in SPEC.items() if v['hit'] is not None}; BLEND={k:v['blend'] for k,v in SPEC.items()}
FMT=os.environ.get('FMT','webp'); Q=int(os.environ.get('WEBPQ','88'))
def save(im,path,q=None):
    if FMT=='webp': im.save(path+'.webp',format='WEBP',quality=q or Q,alpha_quality=100,method=5)
    else: im.save(path+'.png',optimize=True)
    return os.path.basename(path)+'.'+FMT
os.makedirs(OUT,exist_ok=True)
first=Image.open(f'{RAW}/idle/{LAYERS[0]}/S_0.png'); SRC=first.width; CELL=SRC//2
OL=(20,17,14)
def outline(im,r=5,a=0.92):
    al=im.split()[3]; ol=al.filter(ImageFilter.MaxFilter(r)).filter(ImageFilter.GaussianBlur(0.6)).point(lambda v:min(255,int(v*2.2*a)))
    dark=Image.new('RGBA',im.size,OL+(255,)); dark.putalpha(ol); return Image.alpha_composite(dark,im)
def down(im):
    out=im.convert('RGBa').resize((CELL,CELL),Image.LANCZOS).convert('RGBA')
    return out.filter(ImageFilter.UnsharpMask(radius=0.8,percent=55,threshold=2))
atlas={'version':1,'frame':{'w':CELL,'h':CELL},'anchor':{'x':CELL//2,'y':round(CELL*116/128)},'scale':float(os.environ.get('SCALE','1.0')),'layers':LAYERS,'anims':{}}
comp_all={}
for anim,rows in od['order'].items():
    n=len(rows[0]); 
    if rows[0][0] is None: continue
    sheets={l:Image.new('RGBA',(CELL*n,CELL*8)) for l in LAYERS}; comp=Image.new('RGBA',(CELL*n,CELL*8))
    for di,d in enumerate(DIRS):
        for f in range(n):
            ims={l:Image.open(f'{RAW}/{anim}/{l}/{d}_{f}.png').convert('RGBA') for l in LAYERS}
            flat=Image.new('RGBA',(SRC,SRC))
            for li in rows[di][f]: flat=Image.alpha_composite(flat,ims[LAYERS[li]])
            comp.paste(down(outline(flat,5)),(f*CELL,di*CELL))
            for l in LAYERS: sheets[l].paste(down(outline(ims[l],3,0.8)),(f*CELL,di*CELL))
    lnames={l:save(sheets[l],f'{OUT}/{anim}_{l}',82) for l in LAYERS}
    cname=save(comp,f'{OUT}/{anim}'); comp_all[anim]=comp
    ad={'image':cname,'frames':n,'fps':FPS[anim],'loop':bool(LOOP.get(anim)),'blend':bool(BLEND.get(anim)),'dirs':8,'layers':[{'name':l,'image':lnames[l]} for l in LAYERS],'order':rows}
    if anim in HIT: ad['hitFrame']=HIT[anim]
    atlas['anims'][anim]=ad
json.dump(atlas,open(OUT+'/player.json','w'),separators=(',',':'))
if os.environ.get('PREVIEWS'):
    os.makedirs(os.environ['PREVIEWS'],exist_ok=True)
    for anim,comp in comp_all.items():
        bg=Image.new('RGBA',comp.size,(52,54,56,255)); Image.alpha_composite(bg,comp).convert('RGB').save(f"{os.environ['PREVIEWS']}/contact_{anim}.jpg",quality=88)
print('packed',list(comp_all),'cell',CELL)

# ---- previews: animated GIFs (4 directions side by side, real playback fps) + frame strips
PV=os.environ.get('PREVIEWS')
if PV:
    os.makedirs(PV,exist_ok=True); BG=(52,54,56)
    for anim,comp in comp_all.items():
        n=comp.width//CELL; dirsel=[0,6,5,4]  # S,E,NE,N... choose S,SE,E,N-ish
        dirsel=[DIRS.index(x) for x in ('S','SE','E','NW')]
        frames=[]
        reps=2 if LOOP.get(anim) else 1
        for f in range(n):
            im=Image.new('RGBA',(CELL*len(dirsel),CELL),BG+(255,))
            for k,di in enumerate(dirsel): im.alpha_composite(comp.crop((f*CELL,di*CELL,(f+1)*CELL,(di+1)*CELL)),(k*CELL,0))
            frames.append(im.convert('RGB').quantize(128,dither=Image.NONE))
        dur=int(1000/FPS[anim]); frames=frames*reps
        frames[0].save(f'{PV}/{anim}.gif',save_all=True,append_images=frames[1:],duration=[dur]*(len(frames)-1)+[dur+(500 if not LOOP.get(anim) else 0)],loop=0,disposal=2)
        # strip: dir SE
        di=DIRS.index('SE'); st=Image.new('RGB',(CELL*min(n,12),CELL*((n+11)//12)),BG)
        for f in range(n): st.paste(Image.alpha_composite(Image.new('RGBA',(CELL,CELL),BG+(255,)),comp.crop((f*CELL,di*CELL,(f+1)*CELL,(di+1)*CELL))).convert('RGB'),((f%12)*CELL,(f//12)*CELL))
        st.save(f'{PV}/{anim}_strip_SE.png')

# Post-process raw Blender layer renders -> game atlas. Usage: pack.py RAW OUT
# Premultiplied-alpha downsample (no dark fringes), silhouette outline on the composite (flat sheet) and thin per-layer outline
# (layer sheets), light sharpen. Writes one flat sheet per anim (used by default in game), one sheet per layer, player.json, contact sheets.
import sys, json, os
from PIL import Image, ImageFilter
import numpy as np
RAW,OUT=sys.argv[1],sys.argv[2]
od=json.load(open(RAW+'/order.json')); LAYERS=od['layers']; DIRS=['S','SW','W','NW','N','NE','E','SE']
FPS={'idle':8,'run':14,'dodge':22,'attack':18,'cast':16,'hit':12,'down':10}; LOOP={'idle':True,'run':True}; HIT={'attack':2,'cast':3}
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
    for l in LAYERS: sheets[l].save(f'{OUT}/{anim}_{l}.png',optimize=True)
    comp.save(f'{OUT}/{anim}.png',optimize=True); comp_all[anim]=comp
    ad={'image':f'{anim}.png','frames':n,'fps':FPS[anim],'loop':bool(LOOP.get(anim)),'dirs':8,'layers':[{'name':l,'image':f'{anim}_{l}.png'} for l in LAYERS],'order':rows}
    if anim in HIT: ad['hitFrame']=HIT[anim]
    atlas['anims'][anim]=ad
json.dump(atlas,open(OUT+'/player.json','w'),separators=(',',':'))
for anim,comp in comp_all.items():
    bg=Image.new('RGBA',comp.size,(52,54,56,255)); Image.alpha_composite(bg,comp).convert('RGB').save(f'{OUT}/contact_{anim}.png')
print('packed',list(comp_all),'cell',CELL)

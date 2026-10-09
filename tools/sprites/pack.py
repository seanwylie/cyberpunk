# Post-process raw renders: per-layer dark outline, 2x supersample downsample to 128, pack sheets, composite preview, atlas json.
import sys, json, os
from PIL import Image, ImageFilter, ImageChops
import numpy as np
RAW,OUT=sys.argv[1],sys.argv[2]; CELL=128
od=json.load(open(RAW+'/order.json')); LAYERS=od['layers']; DIRS=['S','SW','W','NW','N','NE','E','SE']
FPS={'idle':8,'run':14}
os.makedirs(OUT,exist_ok=True)
def proc(im):
    a=im.split()[3]; ol=a.filter(ImageFilter.MaxFilter(5)).point(lambda v:min(255,v*2))
    dark=Image.new('RGBA',im.size,(18,16,14,255)); dark.putalpha(ol.point(lambda v:int(v*0.85)))
    out=Image.alpha_composite(dark,im)
    return out.resize((CELL,CELL),Image.LANCZOS)
atlas={'version':1,'frame':{'w':CELL,'h':CELL},'anchor':{'x':64,'y':116},'scale':1,'layers':LAYERS,'anims':{}}
comp_all={}
for anim,rows in od['order'].items():
    n=len(rows[0]); sheets={l:Image.new('RGBA',(CELL*n,CELL*8)) for l in LAYERS}; comp=Image.new('RGBA',(CELL*n,CELL*8))
    for di,d in enumerate(DIRS):
        for f in range(n):
            cell=Image.new('RGBA',(CELL,CELL))
            ims={}
            for l in LAYERS:
                im=proc(Image.open(f'{RAW}/{anim}/{l}/{d}_{f}.png').convert('RGBA')); ims[l]=im; sheets[l].paste(im,(f*CELL,di*CELL))
            for li in rows[di][f]: cell=Image.alpha_composite(cell,ims[LAYERS[li]])
            comp.paste(cell,(f*CELL,di*CELL))
    for l in LAYERS: sheets[l].save(f'{OUT}/{anim}_{l}.png',optimize=True)
    comp.save(f'{OUT}/{anim}.png',optimize=True); comp_all[anim]=comp
    atlas['anims'][anim]={'image':f'{anim}.png','frames':n,'fps':FPS[anim],'loop':True,'dirs':8,
        'layers':[{'name':l,'image':f'{anim}_{l}.png'} for l in LAYERS],'order':rows}
json.dump(atlas,open(OUT+'/player.json','w'))
# contact sheet on dark bg
for anim,comp in comp_all.items():
    bg=Image.new('RGBA',comp.size,(52,54,56,255)); Image.alpha_composite(bg,comp).save(f'{OUT}/contact_{anim}.png')

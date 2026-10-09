# Pack raw loot renders -> public/loot/{base,orange,gimbal}.webp + manifest.json. Usage: pack_loot.py RAW OUT
import sys, os, json
from PIL import Image, ImageFilter
RAW,OUT=sys.argv[1],sys.argv[2]; Q=int(os.environ.get('WEBPQ','86'))
os.makedirs(OUT,exist_ok=True)
def down(im,c):
    out=im.convert('RGBa').resize((c,c),Image.LANCZOS).convert('RGBA')
    return out.filter(ImageFilter.UnsharpMask(radius=.7,percent=45,threshold=2))
groups={'base':(96,[]),'orange':(128,[]),'gimbal':(128,[])}
for n in sorted(os.listdir(RAW)):
    g='gimbal' if n.startswith('gimbal') else 'orange' if n.startswith(('orange_','sig_')) else 'base'
    groups[g][1].append(n)
man={'version':1,'files':{},'sprites':{}}
for g,(c,names) in groups.items():
    nf=max(len(os.listdir(f'{RAW}/{n}')) for n in names)
    im=Image.new('RGBA',(c*nf,c*len(names)))
    for r,n in enumerate(names):
        fs=sorted(os.listdir(f'{RAW}/{n}'),key=lambda s:int(s.split('.')[0]))
        for i,f in enumerate(fs): im.paste(down(Image.open(f'{RAW}/{n}/{f}'),c),(i*c,r*c))
        man['sprites'][n]={'file':g,'row':r,'n':len(fs)}
    p=f'{OUT}/{g}.webp'; im.save(p,format='WEBP',quality=Q,alpha_quality=100,method=6)
    man['files'][g]={'src':g+'.webp','cell':c,'w':im.width,'h':im.height}; print(g,im.size,os.path.getsize(p)//1024,'KB')
json.dump(man,open(f'{OUT}/manifest.json','w'),separators=(',',':'))

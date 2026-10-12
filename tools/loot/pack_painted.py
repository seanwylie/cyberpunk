# Pack painted icons (gen_painted.py output) -> public/loot/painted.webp (one 128px cell per row) and merge into public/loot/manifest.json
# as sprites 'p_<item id>' (n=1). Run AFTER pack_loot.py (which rewrites the manifest). Usage: pack_painted.py RAWDIR [OUTDIR=public/loot]
import sys, os, json
from PIL import Image, ImageFilter
RAW=sys.argv[1]; OUT=sys.argv[2] if len(sys.argv)>2 else 'public/loot'; C=128; Q=int(os.environ.get('WEBPQ','84'))
P=json.load(open(os.path.join(os.path.dirname(__file__),'painted_prompts.json')))
RARS=os.environ.get('PAINT_RARS','orange,purple,blue').split(',')
names=[k for k in P if P[k][0] in RARS and os.path.exists(f'{RAW}/{k}.png')]
def cell(path):
    im=Image.open(path).convert('RGBA'); a=im.split()[3].point(lambda v:255 if v>24 else 0); bb=a.getbbox() or (0,0,im.width,im.height)
    im=im.crop(bb); s=(C*.92)/max(im.size); im=im.convert('RGBa').resize((max(1,round(im.width*s)),max(1,round(im.height*s))),Image.LANCZOS).convert('RGBA')
    im=im.filter(ImageFilter.UnsharpMask(radius=.6,percent=40,threshold=2)); o=Image.new('RGBA',(C,C)); o.paste(im,((C-im.width)//2,(C-im.height)//2)); return o
sheet=Image.new('RGBA',(C,C*len(names)))
man=json.load(open(f'{OUT}/manifest.json')); man['sprites']={k:v for k,v in man['sprites'].items() if not k.startswith('p_')}
for r,k in enumerate(names): sheet.paste(cell(f'{RAW}/{k}.png'),(0,r*C)); man['sprites']['p_'+k]={'file':'painted','row':r,'n':1}
p=f'{OUT}/painted.webp'; sheet.save(p,format='WEBP',quality=Q,alpha_quality=90,method=6)
man['files']['painted']={'src':'painted.webp','cell':C,'w':C,'h':sheet.height}
json.dump(man,open(f'{OUT}/manifest.json','w'),separators=(',',':')); print('painted',len(names),sheet.size,os.path.getsize(p)//1024,'KB')

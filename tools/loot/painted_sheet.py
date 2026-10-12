# Contact sheet of painted icons per rarity with rarity frame: painted_sheet.py RAWDIR RARITY OUT.png
import sys, json, os
from PIL import Image, ImageDraw, ImageFont
RAW,R,OUT=sys.argv[1:4]; P=json.load(open(os.path.join(os.path.dirname(__file__),'painted_prompts.json')))
COL={'orange':'#ff9a2e','purple':'#b46cff','blue':'#4a9cff'}[R]
cat=json.load(open('public/catalog/v/'+json.load(open('public/catalog/index.json'))['current']+'.json'))['items']
ks=[k for k in P if P[k][0]==R and os.path.exists(f'{RAW}/{k}.png')]
# include existing bespoke 3D oranges from atlas for consistency check
extra=[]
if R=='orange':
    man=json.load(open('public/loot/manifest.json')); im=Image.open('public/loot/orange.webp')
    for k,v in cat.items():
        sn='sig_'+k.replace('sig_','')
        if v['r']=='orange' and sn in man['sprites'] and k not in P:
            sp=man['sprites'][sn]; c=128; f=round(sp['n']*.3); extra.append((k,im.crop((f*c,sp['row']*c,f*c+c,sp['row']*c+c))))
T=200; cols=6; items=[(k,Image.open(f'{RAW}/{k}.png')) for k in ks]+extra
sh=Image.new('RGB',(cols*T,((len(items)+cols-1)//cols)*(T+30)),'#141618'); d=ImageDraw.Draw(sh)
try: fnt=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',11)
except: fnt=ImageFont.load_default()
for i,(k,im) in enumerate(items):
    x,y=(i%cols)*T,(i//cols)*(T+30); im=im.convert('RGBA'); im.thumbnail((T-24,T-24))
    d.rounded_rectangle((x+4,y+4,x+T-4,y+T-4),8,fill='#1e2124',outline=COL,width=3 if R=='orange' else 2)
    sh.paste(im,(x+(T-im.width)//2,y+(T-im.height)//2),im)
    nm=cat.get(k,{}).get('n',k)+(' [3D existing]' if any(k==e[0] for e in extra) else ''); d.text((x+6,y+T),nm[:34],fill='#ddd',font=fnt)
sh.save(OUT); print(OUT,len(items))

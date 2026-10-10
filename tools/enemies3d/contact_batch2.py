# Batch-2 mob contact sheet: one row per tier, 7 mobs each (attack frame, SE facing) from the packed atlases. usage: python contact_batch2.py [out.png]
import json,sys,re
from PIL import Image,ImageDraw
sys.path.insert(0,'tools/enemies3d')
D='public/dungeons/enemies3d'; src=open('src/content/batch2_mobs.ts').read()
rows={t:[] for t in (1,2,3,4)}
for m in re.finditer(r"id:'(\w+)', name:'([^']+)', tier:(\d), role:'(\w+)'",src): rows[int(m.group(3))].append((m.group(1),m.group(2),m.group(4)))
C=200; sh=Image.new('RGB',(7*C,4*(C+24)),(52,55,58)); d=ImageDraw.Draw(sh)
for t,mobs in rows.items():
    for c,(i,n,role) in enumerate(mobs):
        j=json.load(open(f'{D}/{i}.json')); F=j['frame']; a=Image.open(f"{D}/{j['anims']['attack']['image']}").convert('RGBA'); k=j['anims']['attack']['hit'] or 3
        tile=a.crop((k*F,7*F,k*F+F,7*F+F)).resize((C,C),Image.LANCZOS); y=(t-1)*(C+24); sh.paste(tile,(c*C,y+24),tile); d.text((c*C+4,y+4),f'T{t} {n} ({role})',fill=(255,255,255))
sh.save(sys.argv[1] if len(sys.argv)>1 else 'docs/mobs_batch2_contact.png'); print('ok')

# front/back preview GIFs (tests/enemy_gifs.mjs with SIDE=front|back) -> docs/art/dungeons/anim/<id>_front.gif, <id>_back.gif and docs/art/dungeons/enemy_contact_backs.png (front | back, mid-attack frame)
import glob,os
from PIL import Image,ImageDraw
out='docs/art/dungeons/anim'; os.makedirs(out,exist_ok=True); ids=sorted({d.split('gif_')[1].rsplit('_',1)[0] for d in glob.glob('/tmp/gif_*_back')})
tiles=[]
for id in ids:
    pair=[]
    for side in ('front','back'):
        fs=sorted(glob.glob(f'/tmp/gif_{id}_{side}/*.png'))
        if not fs: continue
        ims=[Image.open(f).convert('RGB') for f in fs]; ims=[i.resize((i.width*2//3,i.height*2//3)) for i in ims]
        ims[0].save(f'{out}/{id}_{side}.gif',save_all=True,append_images=ims[1:],duration=85,loop=0,optimize=True); pair.append(ims[12])
    tiles.append((id,pair))
cw,ch=190,180; cols=4; rows=(len(tiles)+cols-1)//cols; sheet=Image.new('RGB',(cols*cw*2,rows*ch))
d=ImageDraw.Draw(sheet)
for i,(id,pair) in enumerate(tiles):
    for j,im in enumerate(pair):
        t=im.copy(); t.thumbnail((cw,ch)); x=(i%cols)*cw*2+j*cw; y=(i//cols)*ch; sheet.paste(t,(x,y)); d.text((x+4,y+3),f'{id} {"front" if j==0 else "back"}',fill=(255,255,255))
sheet.save('docs/art/dungeons/enemy_contact_backs.png'); print(len(tiles))

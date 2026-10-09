# assemble /tmp/gif_<id>/NN.png (from tests/enemy_gifs.mjs) into docs/art/dungeons/anim/<id>.gif plus a contact sheet docs/art/dungeons/enemy_contact_v2.png
import glob,os
from PIL import Image
out='docs/art/dungeons/anim'; os.makedirs(out,exist_ok=True); tiles=[]
for d in sorted(glob.glob('/tmp/gif_*')):
    id=d.split('gif_')[1]; fs=sorted(glob.glob(d+'/*.png'))
    if not fs: continue
    ims=[Image.open(f).convert('RGB') for f in fs]; ims=[i.resize((i.width*2//3,i.height*2//3)) for i in ims]
    ims[0].save(f'{out}/{id}.gif',save_all=True,append_images=ims[1:],duration=85,loop=0,optimize=True); tiles.append((id,ims[12]))
cw,ch=200,200; cols=7; sheet=Image.new('RGB',(cols*cw,((len(tiles)+cols-1)//cols)*ch))
for i,(id,im) in enumerate(tiles):
    t=im.copy(); t.thumbnail((cw,ch)); sheet.paste(t,((i%cols)*cw,(i//cols)*ch))
sheet.save('docs/art/dungeons/enemy_contact_v2.png'); print(len(tiles))

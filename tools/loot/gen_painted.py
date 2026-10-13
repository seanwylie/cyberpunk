# Painted (painterly, stylized) loot icons via OpenAI Images. Usage: python gen_painted.py RAWDIR [--only=a,b] [--rar=orange]
# Reads tools/loot/painted_prompts.json {id:[rarity, subject, identity]}; writes RAWDIR/<id>.png (1024, transparent). Needs OPENAI_API_KEY.
import os, sys, json, base64, urllib.request, concurrent.futures as cf
RAW=sys.argv[1]; os.makedirs(RAW,exist_ok=True)
ONLY=[a[7:].split(',') for a in sys.argv if a.startswith('--only=')]; ONLY=ONLY[0] if ONLY else None
RAR=[a[6:] for a in sys.argv if a.startswith('--rar=')]; RAR=RAR[0] if RAR else None
P=json.load(open(os.path.join(os.path.dirname(__file__),'painted_prompts.json')))
STYLE={'orange':"Elaborate legendary composition: the piece shown heroic three-quarter view, strong readable silhouette, a restrained warm amber-orange rim light and a soft ember glow from its core, a few hand-painted sparks, no neon.",
       'purple':"Simpler composition than a legendary: the piece alone in clean three-quarter view, strong silhouette, a strong saturated violet-purple rim light along its whole edge and one or two glowing violet accent inlays or lenses, soft violet underglow, no sparks, no neon. Purple must clearly dominate the accent lighting.",
       'blue':"Plain utilitarian composition: the piece alone, simple shapes, strong silhouette, flat even lighting with only a faint cool blue edge, no glow, no sparks."}
def gen(k):
    r,subj,ident=P[k]; out=f'{RAW}/{k}.png'
    if os.path.exists(out): return k,'cached'
    prompt=(f"Hand-painted game item icon in a painterly, stylized splash-art style: painterly brush strokes, gritty dieselpunk-cyberpunk industrial realism, muted palette. "
            f"Subject: {subj}. {('Identity: '+ident+'. ') if ident else ''}{STYLE[r]} Single isolated object centered, filling 80% of the frame, transparent background, no text, no letters, no logos, no frame, no character, no people.")
    body=json.dumps({'model':'gpt-image-1','prompt':prompt,'size':'1024x1024','quality':'medium','background':'transparent','n':1}).encode()
    req=urllib.request.Request('https://api.openai.com/v1/images/generations',body,{'Authorization':'Bearer '+os.environ['OPENAI_API_KEY'],'Content-Type':'application/json'})
    for a in range(3):
        try:
            d=json.load(urllib.request.urlopen(req,timeout=240)); open(out,'wb').write(base64.b64decode(d['data'][0]['b64_json'])); return k,'ok'
        except Exception as e: err=str(e)[:200]
    return k,'FAIL '+err
ks=[k for k in P if (not ONLY or k in ONLY) and (not RAR or P[k][0]==RAR)]
with cf.ThreadPoolExecutor(4) as ex:
    for k,s in ex.map(gen,ks): print(k,s,flush=True)

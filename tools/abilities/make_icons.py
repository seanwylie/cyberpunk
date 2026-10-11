#!/usr/bin/env python3
"""Procedural medallion icons for every data-driven ability (public/abilities/<id>.webp, 128px), matching the riveted-rim look of the hand-made set.
Usage: python3 tools/abilities/make_icons.py [--sheet docs/abilities_icons.png]. Reads src/abilities/data.ts through esbuild (npx)."""
import json, math, subprocess, sys, os, random
from PIL import Image, ImageDraw, ImageFilter
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
subprocess.run(['npx','esbuild','src/abilities/data.ts','--bundle','--format=esm','--outfile=/tmp/abdata_icons.mjs','--log-level=error'],cwd=ROOT,check=True)
data=json.loads(subprocess.check_output(['node','-e',"import('/tmp/abdata_icons.mjs').then(m=>console.log(JSON.stringify(m.ABILITY_DATA)))"],cwd=ROOT))
S=512; C=S/2
TYPE={'attack':((120,48,38),(196,84,60)),'defense':((92,90,78),(214,208,184)),'hacking':((50,72,96),(120,160,196)),'mobility':((70,84,44),(168,184,122))}
RAR={'grey':(150,150,146),'green':(147,182,118),'blue':(130,174,210),'purple':(183,156,203),'orange':(221,141,66)}
BONE=(236,228,208,255)
# ability -> (glyph, badge)
G={'piston_jab':('fist','stun'),'rivet_burst':('rivets','slow'),'hammer_slam':('slam','stun'),'scalpel_flurry':('claws','mark'),'overcharge_shot':('bolt','pierce'),'slag_cannon':('cannon','burn'),
'frag_grenade':('grenade',None),'shock_ring':('rings','slow'),'thermite_lob':('flaskfire','burn'),'cascade_arc':('chain',None),'seismic_stomp':('stomp','expose'),'firestorm_pillar':('pillar','burn'),
'surgical_cut':('scalpel','mark'),'needle_pin':('needle','mark'),'coup_de_grace':('skull',None),'reaper_lunge':('lunge','mark'),'headshot_protocol':('crosshair','mark'),
'static_snare':('web','slow'),'flashbang':('flash','stun'),'root_spikes':('spikes','root'),'magnet_pull':('magnet','slow'),'concussion_wave':('wave','stun'),'gravity_well':('well','slow'),
'sprint_burst':('chevrons',None),'slipstream':('chevrons','wind'),'blink_step':('blink',None),'shoulder_charge':('ram','stun'),'grapple_hook':('hook',None),'phase_slip':('phase','cloak'),
'bulwark_plates':('plates',None),'ablative_shell':('shield',None),'reactive_armour':('reflect',None),'phase_barrier':('barrier',None),'stoneskin':('stone','power'),'kinetic_dampers':('springs',None),
'rally_beacon':('beacon','plus'),'shared_aegis':('aegis',None),'warcry_horn':('horn','plus'),
'shadow_veil':('eyeclosed',None),'decoy_projector':('decoy',None),'ambush_mark':('dagger','cloak'),'smoke_bomb':('smoke',None),'mirage_step':('mirage','cloak'),
'auto_turret':('turret',None),'sentry_drone':('drone',None),'shock_mine':('mine',None),'overwatch_array':('array','mark'),'virus_upload':('virus','mark'),'emp_burst':('emp',None),'repulsor_drone':('drone','push'),'neural_hijack':('brain','tether'),
'heat_sink':('thermo',None),'coolant_flush':('droplet',None),'thermal_siphon':('spiral','burn'),'overclock_core':('gear','power'),'cold_loop':('snow','power'),
'field_stitch':('stitch',None),'triage_cycle':('cross',None),'leech_blades':('fangs',None),'adrenal_surge':('pulse','plus'),
'siege_bot':('bot',None),'scrap_swarm':('swarm',None),
'orbital_strike':('orbital',None),'blackout_protocol':('moon','cloak'),'foundry_meltdown':('radiation','burn'),'legion_protocol':('legion',None),'chain_reaction':('links','burn'),'second_wind':('swirl','plus')}
def P(d,pts,fill=BONE,w=0): d.polygon([(x*S,y*S) for x,y in pts],fill=fill)
def L(d,pts,w=.035,fill=BONE): d.line([(x*S,y*S) for x,y in pts],fill=fill,width=int(w*S),joint='curve')
def E(d,cx,cy,r,fill=None,outline=BONE,w=.03): d.ellipse([(cx-r)*S,(cy-r)*S,(cx+r)*S,(cy+r)*S],fill=fill,outline=outline,width=int(w*S))
def arc(d,cx,cy,r,a0,a1,w=.04,fill=BONE): d.arc([(cx-r)*S,(cy-r)*S,(cx+r)*S,(cy+r)*S],a0,a1,fill=fill,width=int(w*S))
def star(d,cx,cy,r,n=5,fill=BONE,ir=.45):
    pts=[]
    for i in range(n*2):
        a=-math.pi/2+i*math.pi/n; rr=r if i%2==0 else r*ir; pts.append((cx+math.cos(a)*rr,cy+math.sin(a)*rr))
    P(d,pts,fill)
def flame(d,cx,cy,s,fill=BONE): P(d,[(cx,cy-s),(cx+s*.55,cy-s*.1),(cx+s*.45,cy+s*.6),(cx,cy+s*.85),(cx-s*.45,cy+s*.6),(cx-s*.55,cy-s*.1),(cx-s*.15,cy-s*.35)],fill)
def arrow(d,x0,y0,x1,y1,w=.035,head=.07):
    L(d,[(x0,y0),(x1,y1)],w); a=math.atan2(y1-y0,x1-x0)
    P(d,[(x1,y1),(x1-math.cos(a-.5)*head,y1-math.sin(a-.5)*head),(x1-math.cos(a+.5)*head,y1-math.sin(a+.5)*head)])
def glyph(d,g,cx=.5,cy=.5,k=1.0):
    # all glyphs designed in 0..1 space around (.5,.5), scaled by k about the centre
    def T(x,y): return (cx+(x-.5)*k, cy+(y-.5)*k)
    class DD:  # tiny proxy applying the transform
        def polygon(s,pts,fill=BONE): d.polygon([(T(x/S,y/S)[0]*S,T(x/S,y/S)[1]*S) for x,y in pts],fill=fill)
        def line(s,pts,fill=BONE,width=4,joint=None): d.line([(T(x/S,y/S)[0]*S,T(x/S,y/S)[1]*S) for x,y in pts],fill=fill,width=max(2,int(width*k)),joint='curve')
        def ellipse(s,box,fill=None,outline=BONE,width=4):
            x0,y0,x1,y1=box; a=T(x0/S,y0/S); b=T(x1/S,y1/S); d.ellipse([a[0]*S,a[1]*S,b[0]*S,b[1]*S],fill=fill,outline=outline,width=max(2,int(width*k)))
        def arc(s,box,a0,a1,fill=BONE,width=4):
            x0,y0,x1,y1=box; a=T(x0/S,y0/S); b=T(x1/S,y1/S); d.arc([a[0]*S,a[1]*S,b[0]*S,b[1]*S],a0,a1,fill=fill,width=max(2,int(width*k)))
    q=DD()
    if g=='cone' or g=='wave':
        for i in range(3): arc(q,.18,.5,.42+i*.12,-50,50,.04)
        P(q,[(.18,.5),(.78,.32),(.78,.68)],(236,228,208,120))
    elif g=='fist': P(q,[(.3,.42),(.62,.36),(.7,.5),(.62,.66),(.34,.66)]); L(q,[(.7,.4),(.86,.34)]); L(q,[(.72,.5),(.9,.5)]); L(q,[(.7,.6),(.86,.66)])
    elif g=='rivets':
        for i,(x,y) in enumerate([(.28,.4),(.5,.32),(.72,.42),(.38,.62),(.62,.64)]): E(q,x,y,.065,BONE); L(q,[(x+.08,y),(x+.22,y+.04)],.02)
    elif g=='slam': P(q,[(.5,.2),(.62,.5),(.5,.44),(.38,.5)]); L(q,[(.5,.6),(.5,.82)]); L(q,[(.4,.64),(.26,.8)]); L(q,[(.6,.64),(.74,.8)]); arc(q,.5,.6,.3,200,340,.035)
    elif g=='claws':
        for i in range(3): L(q,[(.3+i*.16,.22),(.52+i*.12,.8)],.04)
    elif g=='bolt': arrow(q,.18,.5,.84,.5,.05,.13); L(q,[(.18,.4),(.36,.4)],.025); L(q,[(.18,.6),(.36,.6)],.025)
    elif g=='cannon': P(q,[(.2,.4),(.62,.4),(.62,.6),(.2,.6)]); P(q,[(.62,.34),(.82,.34),(.82,.66),(.62,.66)]); E(q,.3,.7,.07,BONE); E(q,.5,.7,.07,BONE)
    elif g=='grenade': E(q,.5,.56,.22,BONE); P(q,[(.44,.28),(.56,.28),(.56,.36),(.44,.36)]); L(q,[(.56,.3),(.7,.2)],.03); E(q,.72,.18,.03,BONE)
    elif g=='flaskfire': P(q,[(.42,.22),(.58,.22),(.58,.42),(.72,.72),(.28,.72),(.42,.42)],(236,228,208,150)); flame(q,.5,.56,.16)
    elif g=='rings':
        for r in (.12,.22,.32): E(q,.5,.5,r,None)
        E(q,.5,.5,.05,BONE)
    elif g=='chain':
        pts=[(.2,.3),(.4,.48),(.34,.52),(.6,.7)]; L(q,[(.2,.3),(.42,.46),(.36,.54),(.6,.66),(.8,.5)],.04)
        for x,y in [(.2,.3),(.8,.5),(.6,.7)]: E(q,x,y,.06,BONE)
    elif g=='stomp': arrow(q,.5,.16,.5,.52,.05,.12); L(q,[(.2,.66),(.8,.66)],.045); L(q,[(.3,.66),(.22,.82)]); L(q,[(.5,.66),(.5,.84)]); L(q,[(.7,.66),(.78,.82)])
    elif g=='pillar': flame(q,.5,.46,.3); L(q,[(.28,.86),(.72,.86)],.04); L(q,[(.5,.2),(.5,.1)],.03)
    elif g=='scalpel': P(q,[(.2,.7),(.7,.24),(.74,.3),(.28,.76)]); L(q,[(.7,.24),(.82,.2)],.03); E(q,.4,.5,.04,None)
    elif g=='needle': L(q,[(.18,.8),(.8,.2)],.025); P(q,[(.8,.2),(.68,.24),(.76,.32)]); E(q,.7,.7,.05,None); L(q,[(.7,.62),(.7,.5)],.02)
    elif g=='skull': E(q,.5,.44,.22,BONE); P(q,[(.4,.6),(.6,.6),(.58,.76),(.42,.76)]); E(q,.42,.44,.06,(40,30,28,255),(40,30,28,255)); E(q,.58,.44,.06,(40,30,28,255),(40,30,28,255))
    elif g=='lunge': arrow(q,.16,.74,.72,.3,.05,.13); P(q,[(.74,.28),(.84,.3),(.8,.4)]); L(q,[(.2,.6),(.5,.3)],.02)
    elif g=='crosshair': E(q,.5,.5,.26,None); E(q,.5,.5,.05,BONE); L(q,[(.5,.12),(.5,.34)]); L(q,[(.5,.66),(.5,.88)]); L(q,[(.12,.5),(.34,.5)]); L(q,[(.66,.5),(.88,.5)])
    elif g=='web':
        for a in range(0,360,45): L(q,[(.5,.5),(.5+.3*math.cos(math.radians(a)),.5+.3*math.sin(math.radians(a)))],.02)
        for r in (.1,.2,.3): E(q,.5,.5,r,None,w=.015)
    elif g=='flash': star(q,.5,.5,.34,8,BONE,.35); E(q,.5,.5,.1,(40,30,28,255))
    elif g=='spikes':
        for i,x in enumerate([.3,.5,.7]): P(q,[(x-.07,.78),(x,.3+(i%2)*.1),(x+.07,.78)])
        L(q,[(.2,.8),(.8,.8)],.04)
    elif g=='magnet': arc(q,.5,.5,.26,0,180,.09); L(q,[(.24,.5),(.24,.3)],.09); L(q,[(.76,.5),(.76,.3)],.09)
    elif g=='well':
        for i in range(4): arc(q,.5,.5,.12+i*.07,i*70,i*70+230,.03)
        E(q,.5,.5,.04,BONE)
    elif g=='chevrons':
        for i in range(3): L(q,[(.24+i*.17,.28),(.4+i*.17,.5),(.24+i*.17,.72)],.06)
    elif g=='blink': E(q,.25,.5,.1,None); E(q,.75,.5,.1,BONE); L(q,[(.37,.5),(.62,.5)],.025); L(q,[(.42,.44),(.52,.44)],.02)
    elif g=='ram': P(q,[(.2,.36),(.55,.36),(.7,.5),(.55,.64),(.2,.64)]); arrow(q,.1,.5,.2,.5,.03,.05); L(q,[(.74,.34),(.88,.28)]); L(q,[(.76,.66),(.9,.72)])
    elif g=='hook': arc(q,.5,.52,.22,-40,230,.06); L(q,[(.5,.12),(.5,.34)],.045); E(q,.5,.12,.04,BONE)
    elif g=='phase': E(q,.5,.5,.26,None); arc(q,.5,.5,.14,40,320,.04); L(q,[(.2,.5),(.8,.5)],.02)
    elif g=='plates':
        for i in range(3): P(q,[(.22,.26+i*.18),(.78,.26+i*.18),(.74,.38+i*.18),(.26,.38+i*.18)])
    elif g=='shield' or g=='aegis' or g=='barrier':
        P(q,[(.5,.16),(.78,.26),(.74,.56),(.5,.84),(.26,.56),(.22,.26)],(236,228,208,230) if g!='barrier' else (236,228,208,110)); P(q,[(.5,.26),(.66,.32),(.64,.54),(.5,.7),(.36,.54),(.34,.32)],(40,34,30,255))
        if g=='aegis': E(q,.5,.46,.06,BONE)
    elif g=='reflect': P(q,[(.5,.18),(.76,.28),(.72,.56),(.5,.82),(.28,.56),(.24,.28)],(236,228,208,200)); arrow(q,.14,.5,.34,.5,.03,.06); arrow(q,.86,.3,.66,.3,.03,.06)
    elif g=='stone': P(q,[(.3,.3),(.6,.2),(.78,.42),(.7,.74),(.4,.82),(.24,.58)]); L(q,[(.4,.4),(.6,.6)],.02,(40,34,30,255))
    elif g=='springs':
        L(q,[(.3,.8),(.7,.7),(.3,.6),(.7,.5),(.3,.4),(.7,.3)],.04); L(q,[(.22,.82),(.78,.82)],.04)
    elif g=='beacon': L(q,[(.5,.4),(.34,.82)],.04); L(q,[(.5,.4),(.66,.82)],.04); E(q,.5,.34,.08,BONE); arc(q,.5,.34,.2,200,340,.03); arc(q,.5,.34,.3,210,330,.025)
    elif g=='horn': P(q,[(.2,.44),(.4,.44),(.8,.22),(.8,.78),(.4,.56),(.2,.56)]); L(q,[(.84,.38),(.92,.34)],.02); L(q,[(.84,.62),(.92,.66)],.02)
    elif g=='eyeclosed': arc(q,.5,.5,.28,200,340,.05); L(q,[(.24,.52),(.76,.52)],.045); L(q,[(.34,.56),(.3,.66)],.02); L(q,[(.5,.58),(.5,.7)],.02); L(q,[(.66,.56),(.7,.66)],.02)
    elif g=='decoy':
        for dx,a in ((.3,255),(.62,110)):
            E(q,dx,.34,.07,(236,228,208,a)); P(q,[(dx-.1,.46),(dx+.1,.46),(dx+.08,.78),(dx-.08,.78)],(236,228,208,a))
    elif g=='dagger': P(q,[(.5,.12),(.58,.5),(.5,.58),(.42,.5)]); L(q,[(.38,.58),(.62,.58)],.045); L(q,[(.5,.58),(.5,.84)],.05)
    elif g=='smoke':
        for x,y,r in [(.34,.56,.14),(.52,.46,.17),(.68,.58,.13),(.5,.66,.15)]: E(q,x,y,r,(236,228,208,170),None)
    elif g=='mirage': E(q,.4,.5,.2,None); E(q,.6,.5,.2,None,w=.015); L(q,[(.2,.5),(.8,.5)],.015)
    elif g=='turret': P(q,[(.28,.62),(.72,.62),(.78,.78),(.22,.78)]); E(q,.5,.5,.14,BONE); L(q,[(.5,.5),(.84,.36)],.06)
    elif g=='drone':
        E(q,.5,.52,.1,BONE); L(q,[(.28,.4),(.42,.48)],.03); L(q,[(.72,.4),(.58,.48)],.03); L(q,[(.18,.36),(.38,.36)],.03); L(q,[(.62,.36),(.82,.36)],.03); L(q,[(.5,.62),(.5,.76)],.03)
    elif g=='mine': E(q,.5,.56,.2,BONE); 
    elif g=='array':
        for i in range(3): L(q,[(.22+i*.24,.74),(.22+i*.24,.46)],.05); E(q,.22+i*.24,.4,.06,BONE)
    elif g=='virus':
        E(q,.5,.5,.16,BONE)
        for a in range(0,360,60): L(q,[(.5+.16*math.cos(math.radians(a)),.5+.16*math.sin(math.radians(a))),(.5+.3*math.cos(math.radians(a)),.5+.3*math.sin(math.radians(a)))],.03)
    elif g=='emp': E(q,.5,.5,.3,None); P(q,[(.54,.2),(.36,.54),(.5,.54),(.44,.8),(.66,.44),(.52,.44)])
    elif g=='brain':
        E(q,.4,.44,.16,None); E(q,.6,.44,.16,None); E(q,.5,.6,.14,None); L(q,[(.5,.3),(.5,.7)],.02)
    elif g=='thermo': E(q,.5,.74,.1,BONE); P(q,[(.46,.2),(.54,.2),(.54,.7),(.46,.7)]); L(q,[(.62,.3),(.7,.3)],.02); L(q,[(.62,.42),(.7,.42)],.02); L(q,[(.62,.54),(.7,.54)],.02)
    elif g=='droplet': P(q,[(.5,.16),(.68,.5),(.68,.62),(.5,.8),(.32,.62),(.32,.5)]); 
    elif g=='spiral':
        pts=[]; 
        for i in range(60):
            a=i*.3; r=.03+i*.005; pts.append((.5+math.cos(a)*r*1.0,.5+math.sin(a)*r*1.0))
        L(q,pts,.035)
    elif g=='gear':
        E(q,.5,.5,.2,None,w=.07)
        for a in range(0,360,45): L(q,[(.5+.2*math.cos(math.radians(a)),.5+.2*math.sin(math.radians(a))),(.5+.32*math.cos(math.radians(a)),.5+.32*math.sin(math.radians(a)))],.07)
    elif g=='snow':
        for a in range(0,180,60): L(q,[(.5-.3*math.cos(math.radians(a)),.5-.3*math.sin(math.radians(a))),(.5+.3*math.cos(math.radians(a)),.5+.3*math.sin(math.radians(a)))],.04)
    elif g=='stitch':
        L(q,[(.2,.5),(.8,.5)],.04)
        for x in (.3,.45,.6,.75): L(q,[(x-.04,.38),(x+.04,.62)],.03)
    elif g=='cross': P(q,[(.4,.18),(.6,.18),(.6,.4),(.82,.4),(.82,.6),(.6,.6),(.6,.82),(.4,.82),(.4,.6),(.18,.6),(.18,.4),(.4,.4)])
    elif g=='fangs': P(q,[(.22,.26),(.78,.26),(.7,.34),(.3,.34)]); P(q,[(.3,.34),(.42,.34),(.36,.7)]); P(q,[(.58,.34),(.7,.34),(.64,.7)]); E(q,.5,.8,.05,BONE)
    elif g=='pulse': L(q,[(.14,.5),(.34,.5),(.42,.3),(.52,.72),(.6,.42),(.66,.5),(.86,.5)],.045)
    elif g=='bot': P(q,[(.3,.34),(.7,.34),(.76,.6),(.24,.6)]); E(q,.4,.46,.045,(40,30,28,255),(40,30,28,255)); E(q,.6,.46,.045,(40,30,28,255),(40,30,28,255)); L(q,[(.32,.6),(.28,.82)],.06); L(q,[(.68,.6),(.72,.82)],.06); L(q,[(.5,.34),(.5,.2)],.03)
    elif g=='swarm':
        random.seed(3)
        for i in range(9): x=.26+random.random()*.5; y=.28+random.random()*.44; E(q,x,y,.045,BONE)
    elif g=='orbital': E(q,.5,.76,.2,None,w=.025); L(q,[(.5,.08),(.5,.74)],.07); star(q,.5,.76,.1,8,BONE,.4)
    elif g=='moon': E(q,.5,.5,.28,BONE); E(q,.6,.44,.26,(34,30,28,255),(34,30,28,255))
    elif g=='radiation':
        E(q,.5,.5,.06,BONE)
        for a in (90,210,330): 
            pts=[(.5,.5)]; 
            for t in range(-30,31,10): pts.append((.5+.32*math.cos(math.radians(a+t)),.5+.32*math.sin(math.radians(a+t))))
            P(q,pts,(236,228,208,255))
        E(q,.5,.5,.1,(34,30,28,255),(34,30,28,255)); E(q,.5,.5,.045,BONE)
    elif g=='legion':
        for i,(x,y) in enumerate([(.3,.36),(.5,.3),(.7,.36),(.38,.62),(.62,.62)]): E(q,x,y,.08,BONE if i<3 else (236,228,208,150)); 
    elif g=='links':
        E(q,.5,.5,.1,BONE)
        for x,y in [(.24,.3),(.76,.3),(.24,.7),(.76,.7)]: E(q,x,y,.07,BONE); L(q,[(.5,.5),(x,y)],.02)
    elif g=='swirl': arc(q,.5,.5,.28,20,330,.05); arc(q,.5,.5,.16,200,520,.04); arrow(q,.6,.22,.74,.3,.03,.06)
    elif g=='pierce': arrow(q,.15,.5,.85,.5,.04,.1)
    else: E(q,.5,.5,.2,BONE)
def badge(img,kind,rar):
    if not kind: return
    d=ImageDraw.Draw(img,'RGBA'); cx,cy=.78*S,.78*S; r=.12*S
    d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=(26,24,22,255),outline=(200,190,165,255),width=int(.012*S))
    B=(236,228,208,255); u=lambda x:x*S
    def pg(pts): d.polygon([(cx+x*r,cy+y*r) for x,y in pts],fill=B)
    if kind=='stun': 
        for i in range(5): a=-math.pi/2+i*2*math.pi/5; pass
        pg([(0,-.7),(.2,-.2),(.7,-.2),(.3,.1),(.45,.6),(0,.3),(-.45,.6),(-.3,.1),(-.7,-.2),(-.2,-.2)])
    elif kind in('slow','push'): pg([(-.6,-.1),(.2,-.1),(.2,-.5),(.7,0),(.2,.5),(.2,.1),(-.6,.1)])
    elif kind in('mark','expose'): d.line([(cx-r*.5,cy-r*.5),(cx+r*.5,cy+r*.5)],fill=B,width=int(.025*S)); d.line([(cx+r*.5,cy-r*.5),(cx-r*.5,cy+r*.5)],fill=B,width=int(.025*S))
    elif kind=='burn': pg([(0,-.75),(.5,-.1),(.4,.5),(0,.75),(-.4,.5),(-.5,-.1)])
    elif kind in('plus','power'): pg([(-.2,-.65),(.2,-.65),(.2,-.2),(.65,-.2),(.65,.2),(.2,.2),(.2,.65),(-.2,.65),(-.2,.2),(-.65,.2),(-.65,-.2),(-.2,-.2)])
    elif kind in('cloak','root','tether','wind','pierce'): d.arc([cx-r*.6,cy-r*.6,cx+r*.6,cy+r*.6],30,330,fill=B,width=int(.025*S))
def rivet_rim(img,col):
    d=ImageDraw.Draw(img,'RGBA')
    # metal rim: gradient rings
    for i,(r,c) in enumerate([(.5,(34,30,28)),(.485,(104,84,66)),(.46,(150,124,96)),(.43,(96,78,62)),(.41,(52,44,38))]):
        d.ellipse([C-r*S,C-r*S,C+r*S,C+r*S],fill=c+(255,))
    for k in range(12):
        a=k*math.pi/6+.2; x=C+math.cos(a)*.445*S; y=C+math.sin(a)*.445*S; rr=.017*S
        d.ellipse([x-rr,y-rr,x+rr,y+rr],fill=(170,146,118,255),outline=(40,34,30,255))
def make(a):
    dark,acc=TYPE[a['type']]
    img=Image.new('RGBA',(S,S),(0,0,0,0)); rivet_rim(img,acc); d=ImageDraw.Draw(img,'RGBA')
    ir=.395*S
    # inner disc with radial tint
    bg=Image.new('RGBA',(S,S),(0,0,0,0)); bd=ImageDraw.Draw(bg)
    for i in range(40,0,-1):
        t=i/40; col=tuple(int(18+(dk-18)*(1-t)*.9) for dk in dark)+(255,); bd.ellipse([C-ir*t,C-ir*t,C+ir*t,C+ir*t],fill=col)
    mask=Image.new('L',(S,S),0); ImageDraw.Draw(mask).ellipse([C-ir,C-ir,C+ir,C+ir],fill=255); img.paste(bg,(0,0),mask)
    gl=Image.new('RGBA',(S,S),(0,0,0,0)); gd=ImageDraw.Draw(gl)
    g,b=G[a['id']]; glyph(gd,g,.5,.5,.86)
    # tint glyph slightly to type accent, add glow + shadow
    tint=Image.new('RGBA',(S,S),acc+(255,)); gl2=Image.composite(Image.blend(Image.new('RGBA',(S,S),BONE),tint,.25),Image.new('RGBA',(S,S),(0,0,0,0)),gl.split()[3])
    glow=gl.split()[3].filter(ImageFilter.GaussianBlur(S*.025)); glowimg=Image.new('RGBA',(S,S),acc+(255,)); glowimg.putalpha(glow.point(lambda v:int(v*.55)))
    sh=Image.new('RGBA',(S,S),(0,0,0,0)); sh.putalpha(gl.split()[3].filter(ImageFilter.GaussianBlur(S*.012)).point(lambda v:int(v*.8)))
    layer=Image.new('RGBA',(S,S),(0,0,0,0)); layer.alpha_composite(glowimg); layer.alpha_composite(sh,(int(S*.006),int(S*.01))); layer.alpha_composite(gl2)
    clip=Image.new('RGBA',(S,S),(0,0,0,0)); clip.paste(layer,(0,0),mask); img.alpha_composite(clip)
    badge(img,b,a['rarity'])
    # rarity pip arc at top of the rim
    d=ImageDraw.Draw(img,'RGBA'); n={'grey':1,'green':2,'blue':3,'purple':4,'orange':5}[a['rarity']]; col=RAR[a['rarity']]+(255,)
    for i in range(n):
        ang=-math.pi/2+(i-(n-1)/2)*.17; x=C+math.cos(ang)*.445*S; y=C+math.sin(ang)*.445*S; r=.021*S; d.ellipse([x-r,y-r,x+r,y+r],fill=col,outline=(20,18,16,255))
    return img.resize((128,128),Image.LANCZOS)
out=os.path.join(ROOT,'public','abilities'); man=json.load(open(os.path.join(out,'manifest.json')))
missing=[a['id'] for a in data if a['id'] not in G]; assert not missing,missing
ims=[]
for a in data:
    im=make(a); im.save(os.path.join(out,a['id']+'.webp'),quality=92); man['icons'][a['id']]='abilities/'+a['id']+'.webp'; ims.append((a,im))
json.dump(man,open(os.path.join(out,'manifest.json'),'w'),indent=1)
if '--sheet' in sys.argv:
    path=sys.argv[sys.argv.index('--sheet')+1]; cols=11; rows=(len(ims)+cols-1)//cols; sheet=Image.new('RGBA',(cols*150,rows*170),(20,18,17,255)); d=ImageDraw.Draw(sheet)
    for i,(a,im) in enumerate(ims):
        x=(i%cols)*150+11; y=(i//cols)*170+6; sheet.alpha_composite(im,(x,y)); d.text((x-4,y+132),a['name'][:22],fill=(220,214,196,255))
    sheet.convert('RGB').save(os.path.join(ROOT,path))
print('icons',len(ims))

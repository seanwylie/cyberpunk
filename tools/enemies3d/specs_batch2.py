# Mob batch 2: 28 tier-progressive mobs (docs/MOBS_BATCH_2.md). New archetypes (crawler, orb, tread, stilt) + quad/humanoid extras so none read as recolours.
FND=dict(main='#5a3a2a', dark='#241b17', accent='#8a4a24', metal='#6b625c', cloth='#33241c', glow='#ff7a1e')
CLN=dict(main='#c9cdc8', dark='#2c3438', accent='#3f8a8c', metal='#8a9498', cloth='#aeb8b6', glow='#40e0d0', white='#e4e6e1')
WHS=dict(main='#b08a2a', dark='#272a30', accent='#3d5670', metal='#7c8288', cloth='#3a3f46', glow='#ffc21a', white='#d2d0c4')
RUS=dict(main='#6a5a3a', dark='#221e16', accent='#b0702a', metal='#76706a', cloth='#3a3226', glow='#ffb040', white='#b8b098')
QSH=dict(main='#3a3e50', dark='#12141c', accent='#7a86c0', metal='#585c70', cloth='#22243a', glow='#a0b0ff', white='#8a90a8')
RCL=dict(main='#4a4a56', dark='#14141a', accent='#c04646', metal='#7a7a86', cloth='#2a2a34', glow='#ff4040', white='#9a9aa6')
def P(b,**k): d=dict(b); d.update(k); return d
BATCH2 = {
 # ---- Tier I
 'cindermite':  dict(arch='crawler', palette=P(FND,main='#4a2a20',accent='#c8501e',glow='#ff6a20'), extras=('plates',), scale=.8),
 'coalheaver':  dict(arch='bruiser', palette=P(FND,main='#2e2622',dark='#141010',accent='#b05a22',glow='#ff7a1e',cloth='#241c18'), weapon_R='hammer', weapon_L='fist', extras=('tank','goggles','spikes'), scale=1.25),
 'arcflinger':  dict(arch='humanoid', palette=P(FND,main='#3a4a62',dark='#1a2030',accent='#e0c040',glow='#ffe060',metal='#808890'), weapon_R='lance', weapon_L='fist', extras=('coils','visor'), scale=1.0),
 'scrapram':    dict(arch='quad', palette=P(RUS,main='#6a4a2a',accent='#c08a30'), extras=('ram','plates'), scale=1.25),
 'fusecrawler': dict(arch='crawler', palette=P(RUS,main='#5a4a2a',accent='#d04a1a',glow='#ff3a10'), sac=True, extras=('lamp',), scale=.95),
 'barrierhand': dict(arch='humanoid', palette=P(WHS,main='#4a5560',dark='#1a1e24',accent='#d8a020',glow='#ffc21a'), weapon_R='baton', extras=('shield','hat','hivis'), scale=1.1),
 'sootwisp':    dict(arch='orb', palette=dict(main='#4a4440',dark='#14110f',accent='#a05a2a',metal='#6a625c',white='#6a625c',glow='#ff8a3a'), extras=('prongs',), scale=.85),
 # ---- Tier II
 'menderwisp':  dict(arch='orb', palette=dict(main='#d8e2dc',dark='#2a3a38',accent='#40b0a0',metal='#9aa8a4',white='#e8efec',glow='#60ffc0'), extras=('cross','halo'), scale=1.0),
 'longlens':    dict(arch='stilt', palette=P(CLN,main='#8a9aa0',dark='#1c262c',accent='#d0d8d4',glow='#ff5050'), extras=('scope','cape'), scale=1.0),
 'handler':     dict(arch='humanoid', palette=P(WHS,main='#3a6a62',dark='#14241f',accent='#e0c040',glow='#60ffd0'), weapon_R='dishgun', extras=('dishback','satchel','visor'), scale=1.05),
 'belltoller':  dict(arch='humanoid', palette=P(FND,main='#6a4a22',dark='#241a10',accent='#d0a040',glow='#ffc050',cloth='#3a2814'), weapon_R='hammer', extras=('bell','robe','hood'), scale=1.15),
 'bulwarktread':dict(arch='tread', palette=P(CLN,main='#aab4b8',dark='#1e262a',accent='#2a8a8a',glow='#40e0c0'), extras=('plow','shieldfront'), scale=1.0),
 'sedabloom':   dict(arch='orb', palette=dict(main='#8ab89a',dark='#1a2a22',accent='#c8a0d8',metal='#7a9a88',white='#a8d0b8',glow='#c880ff'), extras=('bloom','eye'), scale=1.05),
 'dustroach':   dict(arch='crawler', palette=P(RUS,main='#5a5030',accent='#8a8a40',glow='#c0d040'), extras=('stinger',), scale=.9),
 # ---- Tier III
 'shiftstalker':dict(arch='humanoid', palette=P(QSH,main='#2a2e40',accent='#6a74b0'), weapon_R='scalpel', weapon_L='claws', extras=('hood','cape','visor'), scale=1.1),
 'mortartread': dict(arch='tread', palette=P(RUS,main='#5a5238',dark='#1c1a14',accent='#c08a30',glow='#ffb040'), extras=('mortar',), scale=1.15),
 'leechorderly':dict(arch='humanoid', palette=P(CLN,main='#8a4a54',dark='#2a1a1e',accent='#d8d0cc',glow='#ff4a6a',cloth='#5a3036'), weapon_R='syringe', weapon_L='claws', extras=('apron','syringes','mask'), scale=1.1),
 'packmule':    dict(arch='quad', palette=P(WHS,main='#8a7a46',dark='#201c10',accent='#d03a1a',glow='#ff3a1a'), extras=('crates','coat'), scale=1.35),
 'relaynode':   dict(arch='orb', palette=dict(main='#505a78',dark='#12141c',accent='#a0b0ff',metal='#6a7090',white='#7a82a0',glow='#a0b8ff'), extras=('spikes','halo'), scale=1.15),
 'rebarcrusher':dict(arch='quad', palette=P(FND,main='#4a3a34',dark='#1a1412',accent='#e06a30',glow='#ff7a30',metal='#7a6a62'), extras=('ram','plates','plates'), scale=1.65),
 'staticpup':   dict(arch='quad', palette=P(QSH,main='#3a4060',accent='#a0b0ff'), extras=('coat',), scale=.7),
 # ---- Tier IV
 'recalltrooper':dict(arch='humanoid', palette=P(RCL,main='#4a4a56',accent='#c04646'), weapon_R='rifle', weapon_L='fist', extras=('shield','visor','plate'), scale=1.15),
 'tagcarrier':  dict(arch='tread', palette=P(RCL,main='#4a4a56',accent='#c04646'), extras=('carrier','beacon'), scale=1.25),
 'reclaimwalker':dict(arch='stilt', palette=P(RCL,main='#5a5a66',accent='#d05050',glow='#ff3030'), extras=('scope',), scale=1.2),
 'purgebeacon': dict(arch='orb', palette=dict(main='#3a3a46',dark='#101016',accent='#d04646',metal='#6a6a76',white='#5a5a68',glow='#ff3a3a'), extras=('eye','spikes','prongs'), scale=1.3),
 'sweepertread':dict(arch='tread', palette=P(RCL,main='#3a3a44',dark='#101014',accent='#e05a3a',glow='#ff5a3a'), extras=('mortar','plow','beacon'), scale=1.5),
 'repocrawler': dict(arch='crawler', palette=P(RCL,main='#4a3a44',accent='#c04646',glow='#ff4040'), extras=('stinger','plates','lamp'), scale=1.3),
 'triagewarden':dict(arch='humanoid', palette=P(RCL,main='#6a6a74',dark='#1c1c22',accent='#e0e0e0',glow='#ff6060',cloth='#4a4a54'), weapon_R='syringe', weapon_L='baton', extras=('apron','cross','halo','satchel'), scale=1.3),
}

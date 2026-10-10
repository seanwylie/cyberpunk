# Content batch 1: 20 new bosses. Same archetypes as specs.py; silhouettes differ by archetype + scale + weapons + extras (see docs/CONTENT_BATCH_1.md).
FND=dict(main='#5a3a2a', dark='#241b17', accent='#8a4a24', metal='#6b625c', cloth='#33241c', glow='#ff7a1e')
CLN=dict(main='#c9cdc8', dark='#2c3438', accent='#3f8a8c', metal='#8a9498', cloth='#aeb8b6', glow='#40e0d0', white='#e4e6e1')
WHS=dict(main='#b08a2a', dark='#272a30', accent='#3d5670', metal='#7c8288', cloth='#3a3f46', glow='#ffc21a', white='#d2d0c4')
def P(b,**k): d=dict(b); d.update(k); return d
BATCH1 = {
 'voss':        dict(arch='bruiser', palette=P(FND,main='#4a2c20',accent='#d0561e',glow='#ff5a1a'), weapon_R='ladle', weapon_L='gauntlet', extras=('tank','goggles','chains'), scale=1.8),
 'lineman':     dict(arch='humanoid', palette=P(FND,main='#3a4a62',dark='#1a2030',accent='#e0c040',glow='#ffe060',metal='#808890'), weapon_R='lance', weapon_L='fist', extras=('coils','hat','hivis'), scale=1.75),
 'gantrymother':dict(arch='bruiser', palette=P(WHS,main='#6a5a2a',dark='#22201a',accent='#c9a02a',glow='#ffb020'), weapon_R='claws', weapon_L='slab', extras=('crates','pauldrons','hat'), scale=1.85),
 'pitboss':     dict(arch='bruiser', palette=P(FND,main='#6a5a3a',dark='#2a2418',accent='#a08a40',glow='#d0a030',cloth='#3a3020'), weapon_R='hammer', weapon_L='slab', extras=('plate','horns','spikes'), scale=2.05),
 'bellfounder': dict(arch='humanoid', palette=P(FND,main='#6a4a22',dark='#241a10',accent='#d0a040',glow='#ffc050',cloth='#3a2814'), weapon_R='hammer', weapon_L='fist', extras=('bell','robe','crown'), scale=1.9),
 'cryo':        dict(arch='humanoid', palette=P(CLN,main='#9ac0d8',dark='#1c2a38',accent='#e8f4ff',glow='#80e0ff',cloth='#7aa0c0'), weapon_R='syringe', weapon_L='fist', extras=('robe','halo','mask'), scale=1.7),
 'auditor':     dict(arch='humanoid', palette=P(CLN,main='#aab4b8',dark='#1e262a',accent='#2a8a8a',glow='#40e0c0',metal='#9aa4a8'), weapon_R='baton', weapon_L='scalpel', extras=('cape','visor','crown'), scale=1.65),
 'mirrorpt':    dict(arch='bruiser', palette=P(CLN,main='#d8c8cc',dark='#2a2226',accent='#c06a82',glow='#ff90b0',metal='#b0a8ac',cloth='#e8dcdf'), weapon_R='claws', weapon_L='claws', extras=('robe','wings','halo'), scale=1.8),
 'apothecary':  dict(arch='humanoid', palette=P(CLN,main='#6a9a82',dark='#1a2a22',accent='#a0e0b0',glow='#60ff90',cloth='#4a7a62'), weapon_R='syringe', weapon_L='scalpel', extras=('apparatus','apron','mask'), scale=1.7),
 'resonance':   dict(arch='hover', palette=dict(main='#5a5e66',dark='#16181c',accent='#78a8d0',metal='#7a8088',white='#8a9098',glow='#80c0ff'), extras=('fins','halo'), scale=1.9),
 'clearance':   dict(arch='humanoid', palette=P(WHS,main='#8a3a5a',dark='#241a20',accent='#e0b020',glow='#ff4a8a',cloth='#4a2030'), weapon_R='dishgun', weapon_L='fist', extras=('banner','hivis','hat'), scale=1.7),
 'liquidator':  dict(arch='bruiser', palette=P(WHS,main='#7a2a26',dark='#1e1a1a',accent='#d03a2a',glow='#ff4a3a',metal='#8a8480'), weapon_R='cleaver', weapon_L='slab', extras=('plate','visor','pauldrons'), scale=1.95),
 'courier':     dict(arch='cart', palette=P(WHS,main='#a07a30',dark='#2a2418',accent='#e0a020',glow='#ffd040'), fork=True, scale=1.8),
 'dispatcher':  dict(arch='hover', palette=dict(main='#4a6a5a',dark='#141c18',accent='#e0c040',metal='#7a8a82',white='#98a8a0',glow='#ffe060'), extras=('dish','banks'), scale=1.85),
 'warrantor':   dict(arch='humanoid', palette=P(WHS,main='#8a7a46',dark='#201c10',accent='#d8b040',glow='#ffd860',cloth='#4a4020'), weapon_R='scalpel', weapon_L='slab', extras=('cape','plate','crown'), scale=1.85),
 'tidewarden':  dict(arch='bruiser', palette=P(CLN,main='#3a6a72',dark='#12242a',accent='#50b0b0',glow='#60e8e0',metal='#5a7a80',cloth='#2a4a50'), weapon_R='lance', weapon_L='gauntlet', extras=('tank','spikes','visor'), scale=1.9),
 'rattle':      dict(arch='humanoid', palette=dict(main='#3a3e50',dark='#12141c',accent='#7a86c0',metal='#585c70',cloth='#22243a',glow='#a0b0ff'), weapon_R='whip', weapon_L='claws', extras=('goggles','chains','cape'), scale=1.6),
 'breaker':     dict(arch='bruiser', palette=P(FND,main='#6a3022',dark='#1e1210',accent='#e06a30',glow='#ff7a30',metal='#7a6a62'), weapon_R='saw', weapon_L='hammer', extras=('pauldrons','chains','spikes'), scale=2.15),
 'widow':       dict(arch='hover', palette=dict(main='#6a5a78',dark='#18141e',accent='#d0a060',metal='#8a8090',white='#a098a8',glow='#ffb070'), extras=('mast','coils','crown'), scale=1.75),
 'recall':      dict(arch='bruiser', palette=dict(main='#4a4a56',dark='#14141a',accent='#c04646',metal='#7a7a86',cloth='#2a2a34',glow='#ff4040'), weapon_R='scythe', weapon_L='cleaver', extras=('plate','wings','halo','spikes'), scale=2.35),
}

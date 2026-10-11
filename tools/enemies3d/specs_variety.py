# Variety pass: alternate-silhouette atlases for the most repeated mobs. Each <id>_b is a SECOND body for the same enemy type (same stats/hitbox): different
# weapon / headgear / pack / palette, so a pack of pickers or orderlies is no longer N copies of one model. Selected per enemy id at runtime (src/variety.ts).
FND=dict(main='#5a3a2a', dark='#241b17', accent='#8a4a24', metal='#6b625c', cloth='#33241c', glow='#ff7a1e')
CLN=dict(main='#c9cdc8', dark='#2c3438', accent='#3f8a8c', metal='#8a9498', cloth='#aeb8b6', glow='#40e0d0', white='#e4e6e1')
WHS=dict(main='#b08a2a', dark='#272a30', accent='#3d5670', metal='#7c8288', cloth='#3a3f46', glow='#ffc21a', white='#d2d0c4')
OLIVE=dict(main='#4a4d34', dark='#262820', accent='#5d6141', metal='#6d6f68', cloth='#3b3e2a')
def P(b,**k): d=dict(b); d.update(k); return d
VARIETY = {
 'picker_b':      dict(arch='humanoid', palette=P(WHS,main='#4f6a50',accent='#d8a020'), weapon_R='lance', extras=('hat','satchel'), scale=.95, swing=1.1),
 'slaghauler_b':  dict(arch='bruiser', palette=P(FND,main='#3c3434',accent='#a8461e',glow='#ff5a1a'), weapon_R='hammer', weapon_L='fist', extras=('tank','goggles'), scale=1.12),
 'nursebot_b':    dict(arch='humanoid', palette=P(CLN,main='#9db6b8',accent='#a03a4a'), weapon_R='syringe', extras=('mask','robe'), scale=1.02, swing=.9),
 'orderly_b':     dict(arch='humanoid', palette=P(CLN,main='#b4bcc4',accent='#2a5a80',dark='#20282e'), weapon_R='cleaver', weapon_L='fist', extras=('visor','pauldrons'), scale=1.08),
 'scanner_b':     dict(arch='hover', palette=dict(main='#8f9a94', dark='#202428', accent='#b8481e', metal='#6c7480', white='#bcc0b8', glow='#ff5030'), extras=('halo',), scale=.85),
 'forkbot_b':     dict(arch='cart', palette=P(WHS,main='#5a6870',accent='#c9a02a'), fork=True, extras=('crates',), scale=1.05),
 'loader_b':      dict(arch='bruiser', palette=P(WHS,main='#7a4a2a',accent='#272a30'), weapon_R='hammer', weapon_L='slab', extras=('hivis','tank'), scale=1.08),
 'shooter_b':     dict(arch='humanoid', palette=P(OLIVE,main='#5a5a44',accent='#8a7a40'), weapon_R='dishgun', extras=('hat','cape'), scale=1.05),
 'worker_b':      dict(arch='humanoid', palette=P(OLIVE,main='#5e4a38',accent='#6a5030'), weapon_R='hammer', extras=('goggles','tank'), scale=1.0),
 'camgun_b':      dict(arch='turret', palette=dict(WHS, main='#6a7a72', accent='#b8481e'), scale=.95),
 'sentry_b':      dict(arch='turret', palette=dict(CLN, main='#aab4b8', accent='#a03a4a', dark='#262c32'), scale=1.05),
}

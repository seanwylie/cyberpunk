# Regular (non-elite, non-boss) humanoid/bruiser mobs on the sculpted CC0 base body (arch_base.py), by manufacturer (src content mfr).
BASE_MOBS = {
  'worker':'MM','shooter':'MM','picker':'MM','loader':'MM','barrierhand':'MM','handler':'MM','recalltrooper':'MM',
  'slaghauler':'HI','ladlecrew':'HI','coalheaver':'HI','arcflinger':'HI','belltoller':'HI',
  'orderly':'PS','nursebot':'PS','shiftstalker':'PS','leechorderly':'PS','triagewarden':'PS',
  'worker_b':'MM','shooter_b':'MM','picker_b':'MM','loader_b':'MM','slaghauler_b':'HI','nursebot_b':'PS','orderly_b':'PS',
}
def apply(SPECS):
    for k,m in BASE_MOBS.items():
        s=SPECS.get(k)
        if s and s['arch'] in ('humanoid','bruiser'): s.update(arch='bhum' if s['arch']=='humanoid' else 'bbru', mfr=m)

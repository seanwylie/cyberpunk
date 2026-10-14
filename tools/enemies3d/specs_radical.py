# Stage 3: elite/boss humanoid+bruiser mobs -> radical replacement on the base body (arch_radical.py). mfr + boss from src content.
RADICAL = {
  'sawhand':('HI',0),'brakeman':('HI',0),'quenchpriest':('HI',0),'enforcer':('HI',1),'teague':('HI',1),'brannoch':('HI',1),
  'matron':('PS',0),'anesthetist':('PS',0),'surgeon':('PS',1),'recovered':('PS',1),
  'foreman':('MM',0),'shiftlead':('MM',0),'hobbs':('MM',0),'overseer':('MM',1),'stockmgr':('MM',1),'retrieval':('MM',1),'reclaimer':('MM',1),
}
def apply(SPECS):
    for k,(m,b) in RADICAL.items():
        s=SPECS.get(k)
        if s and s['arch'] in ('humanoid','bruiser'): s.update(arch='rhum' if s['arch']=='humanoid' else 'rbru', mfr=m, boss=bool(b))

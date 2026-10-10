"""
Valores aceitos em `users.gender`.

O app grava o rótulo em PT da opção do onboarding ('Masculino', 'Feminino',
'Outro' — GENDER_OPTIONS em onboardingDomain.ts) e o sync push manda o
valor cru. O backend aceitava só os valores em inglês e devolvia 500 em
todo push de quem completava o onboarding. Aceitar os dois conjuntos mantém
o valor idêntico no round-trip push → pull, sem tradução em nenhum lado.
"""

ACCEPTED_GENDERS: frozenset[str] = frozenset(
    {"male", "female", "other", "Masculino", "Feminino", "Outro"}
)

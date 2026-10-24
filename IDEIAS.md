# Ideias de melhoria (não implementadas)

Levantadas durante a sessão overnight de 2026-10-24. Prioridade: **P0** corrige risco real, **P1** alto valor, **P2** desejável. Esforço: **S** ≤ 0,5 dia, **M** 1–2 dias, **L** > 2 dias.

## Dívida técnica / segurança
| Prioridade | Esforço | Item |
|---|---|---|
| P0 | S | **`birth_date` incompatível**: o cliente guarda epoch ms (`@date`), o backend valida string `YYYY-MM-DD`; o primeiro push com data de nascimento daria 500. Converter nas duas pontas (push e pull) e testar. |
| P0 | S | **`gymnight/backend/.env` versionado** e `ADMIN_SECRET` com default `"changeme"` (já apontado em PARIDADE-06 §4). Remover do git, rotacionar segredos, falhar o boot se `ADMIN_SECRET` estiver no default em produção. |
| P1 | S | **`.pytest_cache` versionado** em `gymnight/backend`; remover do índice e ignorar. |
| P1 | M | **Sync: registros "quarentena"/403 sem retorno ao usuário.** Um 403 coloca o lote inteiro em quarentena sem avisar; expor estado de sync na UI e permitir reenvio. |
| P1 | M | **Sync push em 500 rejeita o lote inteiro** (rollback total). Isolar por tabela/registro para um registro inválido não travar o resto. |
| P2 | S | README desatualizado (diz que não há navegação e que o bug de `email` está aberto); atualizar e remover `models_old.py.bak`, `app/routers/sync.py` morto e `src/config.ts` legado. |
| P2 | S | `render.yaml` e `main.py` da raiz do backend apontam caminhos antigos. |
| P2 | M | Testes de integração do backend rodarem sempre no CI via `docker-compose.test.yml`; hoje, sem `TEST_DATABASE_URL`, são pulados e foi assim que os bugs de 403 e `training_time` passaram. |

## Funcionalidades
| Prioridade | Esforço | Item |
|---|---|---|
| P1 | M | **Tela do GymAI** sobre o `GymAiClient` já pronto (histórico em memória, estados offline/rate limit, aviso de que exige conexão). |
| P1 | M | **Cota por usuário no GymAI** (hoje só 10/min por rota): custo recorrente no provedor, ver PARIDADE-06 §2.2. |
| P2 | M | Heatmap muscular (Wave 10, adiado). |
| P2 | M | Timer de descanso entre séries (o componente existe no desktop). |
| P2 | L | Google OAuth (adiado). |
| P2 | M | Exportar/importar histórico (CSV/JSON). |

## UX
| Prioridade | Esforço | Item |
|---|---|---|
| P1 | S | Indicador visível de "sincronizado / pendente / offline" no dashboard. |
| P2 | S | Desfazer ao apagar treino (hoje apaga direto; a sessão fica no histórico, mas o modelo some). |
| P2 | M | Acessibilidade: rótulos e áreas de toque nas abas e na grade de séries. |

## Performance
| Prioridade | Esforço | Item |
|---|---|---|
| P2 | M | `observeAllLoggedSets` assina um observable por sessão; com histórico longo vira N assinaturas. Trocar por uma query com `Q.on`/join. |
| P2 | S | Catálogo de 500 exercícios: paginar/virtualizar a lista de busca do criador. |
| P2 | M | `loadPendingRecords` faz `query().fetch()` das 7 tabelas inteiras a cada ciclo; usar `Q.where('_status', ...)`. |

## Testes
| Prioridade | Esforço | Item |
|---|---|---|
| P1 | M | Testes de renderização das telas dentro do `AppNavigator` com os containers reais (hoje são dublês) usando o WatermelonDB em memória. |
| P2 | S | Fixar a seed dos testes de propriedade em CI ou registrar contraexemplos; um deles (property20) era instável por gerar a coluna `id`. |
| P2 | S | O `docker-compose.test.yml` usa `--forceExit` para o frontend; já não é necessário (o aviso de worker foi eliminado), remover para não esconder vazamentos futuros. |

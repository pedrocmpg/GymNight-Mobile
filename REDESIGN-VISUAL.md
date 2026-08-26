# Redesign Visual — Portar a identidade do GymNight-Desktop para o Mobile

> **Documento índice.** Leia este primeiro, depois execute as waves na ordem.
> Escrito em 2026-08-26. Nenhuma linha de código foi alterada ainda — isto é a especificação completa.

## Arquivos desta especificação

| Arquivo | Conteúdo |
|---|---|
| **`REDESIGN-VISUAL.md`** (este) | Contexto, De→Para, decisões, ordem de execução, verificação, pendências |
| [`REDESIGN-01-FUNDACAO.md`](REDESIGN-01-FUNDACAO.md) | **Wave 0** — `tokens.ts` completo, fonte Inter, ícones, assets, `app.json` |
| [`REDESIGN-02-COMPONENTES.md`](REDESIGN-02-COMPONENTES.md) | **Wave 1** — biblioteca de componentes do design system |
| [`REDESIGN-03-TELAS.md`](REDESIGN-03-TELAS.md) | **Waves 2–5** — navegação/SafeArea + spec de cada uma das 5 telas |

Cada arquivo é autossuficiente: quem executar não precisa reabrir o `GymNight-Desktop` nem o vault do segundo cérebro. Todos os valores relevantes estão citados verbatim, com o arquivo e a linha de origem no desktop indicados.

---

## 1. Por que este redesign

O **GymNight-Desktop** (`c:\Users\User\Documents\Projetos\GymNight-Desktop` — Python 3.12 + PySide6/Qt6, estilizado com QSS) já tem uma identidade visual madura e decidida:

- Preto puro `#0a0a0a` como fundo.
- Verde-limão ácido `#a2ff00` como acento, com **glow neon** aplicado em praticamente todo card, stat card e botão de navegação ativo.
- Cards `#1a1a1a` com **borda visível** `#2a2a2a` de 1–2px.
- Fonte **Inter** (fallback Segoe UI) em pesos pesados: 700 / 800 / 900.
- Títulos em **CAIXA ALTA**.
- Ícones FontAwesome 5 Solid (via `qtawesome`) em toda parte.
- Um **hero banner com imagem de fundo** e degradês pretos nas bordas.

O **GymNight-Mobile** (Expo SDK 52 / React Native 0.76.9) foi construído com um design system deliberadamente minimalista e plano — paleta azulada, sem bordas, sem ícones, sem fonte customizada, sem glow. Funciona bem, mas **não parece o mesmo produto**.

O objetivo é fazer o mobile parecer o desktop: mesma paleta, mesma tipografia, mesma linguagem de card/glow/ícone, e a mesma estrutura de tela.

### O que existe hoje no mobile (baseline)

- **Monorepo**: `gymnight/frontend` (Expo, bare workflow com pasta `android/`) + `gymnight/backend` (FastAPI + Postgres/Supabase).
- **Offline-first**: WatermelonDB local, sync via protocolo do WatermelonDB (`/api/v1/sync/pull` e `/push`).
- **5 telas**: `AuthScreen`, `DashboardScreen` (aba "Treinos"), `WorkoutCreatorScreen`, `ActiveSessionScreen`, `ProgressScreen` (aba "Progresso").
- **Navegação**: `native-stack` raiz com `headerShown: false` global + `MainTabNavigator` (bottom tabs). `WorkoutCreator` e `ActiveSession` são irmãos do Tab.Navigator, de propósito, para não mostrar a tab bar.
- **Arquitetura estrita**: cada tela é _lógica pura em arquivo separado_ + _componente burro apresentacional_ + _container_ em `src/navigation/containers/`. Estado de domínio vem **exclusivamente** de observables do WatermelonDB — `zustand` está no `package.json` mas não é usado em nenhum arquivo de `src/`.
- **Testes**: baseline de **106 suites / 530 testes, 100% verdes**. Muito teste de propriedade (`fast-check`).
- **Design system atual**: `src/designSystem/tokens.ts` (dark-only) + apenas 3 componentes (`Card`, `Chip`, `StatRow`).

---

## 2. De → Para

| | Mobile hoje | Desktop (alvo) |
|---|---|---|
| Fundo | `#0B0E11` | `#0a0a0a` |
| Superfície | `#151A21` | `#0f0f0f` |
| Card | — (usa surface) | `#1a1a1a` |
| Input dentro de card | — | `#222222` |
| Borda | ausente (só `rgba(154,165,177,0.2)` opcional) | `#2a2a2a`, 1–2px, em **todo** card |
| Acento | `#39FF14` | `#a2ff00` (+ hover `#b5f542`, dark `#65a30d`, bg `#1a2e0a`) |
| Texto primário | `#F5F7FA` | `#ffffff` |
| Texto secundário | `#9AA5B1` | `#6b7280` |
| Erro | `#FF3B5C` | `#ef4444` |
| Raios | 4 / 8 / 16 | 6 / 10 / 16 |
| Fonte | sistema | Inter 400/500/700/800/900 |
| Escala tipográfica | heading 24/700, metric 28/700 | h1 36/800, h2 26/700, h3 18/700, stat 36/800 |
| Assinatura visual | nenhuma | **glow neon verde**, CAIXA ALTA, ícones fa5s, hero com imagem |
| Ícones | 2 SVGs inline na tab bar | FontAwesome 5 Solid em toda parte |

---

## 3. Decisões já tomadas

Confirmadas com o usuário antes de escrever esta spec:

1. **Adotar a paleta do Desktop integralmente** — `#0a0a0a` / `#a2ff00` / bordas `#2a2a2a`, incluindo o fundo preto puro.
2. **Adicionar a fonte Inter** via `@expo-google-fonts/inter`. ⚠️ Isso **revoga** uma decisão anterior registrada no vault (`Log de Mudanças.md`, 2026-08-19: _"mantido system font (sem Google Fonts/expo-font) — alinhado ao pedido de minimalismo"_). O vault precisa ser atualizado ao final.
3. **Reestilizar as 5 telas**, não só as duas abas. Isso também revoga a política atual do repo de aplicar os componentes do design system só em Dashboard/Progress.
4. **Incluir as correções de UX que fazem parte do visual**: SafeArea, header com botão voltar, e botão de criar treino sempre acessível.
5. **Não mexer no SyncEngine** nesta rodada — ver §6.

---

## 4. Ordem de execução

As waves têm dependência estrita: cada uma depende da anterior.

```
Wave 0  Fundação          → REDESIGN-01-FUNDACAO.md
        tokens.ts, Inter, ícones, assets, app.json
        ↓
Wave 1  Componentes       → REDESIGN-02-COMPONENTES.md
        Button, Input, ScreenHeader, StatCard, DayDot, HeroBanner...
        ↓
Wave 2  Navegação/SafeArea → REDESIGN-03-TELAS.md §1
        ↓
Wave 3  DashboardScreen    → REDESIGN-03-TELAS.md §2   (a tela mais transformada)
        ↓
Wave 4  ActiveSessionScreen → REDESIGN-03-TELAS.md §3  (⚠️ muda comportamento — ver abaixo)
        ↓
Wave 5  WorkoutCreator + Auth + Progress → REDESIGN-03-TELAS.md §4-6
```

Rodar `npx tsc --noEmit` e `npm test` ao fim de **cada** wave, não só no final. As waves 0 e 1 quebram testes existentes de propósito (mudança de tokens e de default do `Card`) — corrigir antes de seguir.

### ⚠️ A única decisão que muda comportamento

Na **Wave 4**, a `ActiveSessionScreen` deixa de ser "escolher exercício num chip → digitar peso/reps → botão Registrar Série" e passa a ser a **grade de séries pré-montada** do desktop, onde marcar o check verde grava a série. Está detalhado e justificado em [`REDESIGN-03-TELAS.md` §3](REDESIGN-03-TELAS.md). Se na hora de executar você preferir só reestilizar o fluxo atual, **o resto do plano não muda** — é uma escolha isolada.

---

## 5. Verificação

1. **Tipos**: `cd gymnight/frontend && npx tsc --noEmit` — zero erros.
2. **Testes**: `npm test`. Baseline **106 suites / 530 testes**. Suites que necessariamente mudam junto com o código:
   - `src/designSystem/tokens.test.ts`
   - `src/designSystem/components/__tests__/Card.component.test.tsx`
   - `DashboardScreen.*.test.tsx`, `ActiveSessionScreen.*.test.tsx`, `WorkoutCreatorScreen.*.test.tsx`, `AuthScreen.*.test.tsx`, `ProgressScreen.*.test.tsx`
   - novos testes de componente (um por item da Wave 1) e das funções puras novas (`reorderWeekMondayFirst`, agregações do dashboard)
3. **Lint**: `npx eslint src` — existe uma dívida pré-existente de ~286 erros (`no-explicit-any` em arquivos legados de sync/auth). Não aumentar esse número.
4. **Device físico** — a única forma de validar de verdade. O projeto **não usa emulador** (decisão registrada, commit `44f3ab2`).

   ```bash
   # 1. gerar o .env do device
   cd gymnight/frontend
   scripts/setup-device.cmd <IP_DA_MAQUINA> <SUPABASE_URL> <SUPABASE_ANON_KEY>

   # 2. backend acessível na rede
   cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8000

   # 3. rebuild nativo — OBRIGATÓRIO por causa da fonte nova
   cd ../frontend && npx expo run:android --clean
   ```

   Checklist visual no device:
   - [ ] Hero banner renderiza a imagem com os degradês nas bordas
   - [ ] Glow verde visível nos cards e nos stat cards
   - [ ] Inter carregou (comparar o peso 800 do "BOM TREINO" com a fonte de sistema)
   - [ ] Nada colide com a status bar nem com a barra de navegação do Android
   - [ ] Botão "+ Novo" leva ao WorkoutCreator mesmo com treinos já existentes
   - [ ] "← Voltar" funciona no WorkoutCreator e no ActiveSession
   - [ ] Marcar o check verde grava a série (se a Wave 4 for feita com a grade)
   - [ ] Gráfico de 1RM ocupa a largura da tela sem cortar

---

## 6. Fora de escopo — problemas conhecidos, não corrigidos aqui

Encontrados durante a análise. Documentados aqui para não se perderem.

### 🔴 Bloqueia o teste em device

- **O SyncEngine nunca é disparado.** `SyncEngine.requestSyncCycle()` não tem nenhum call site fora do próprio arquivo e dos testes. Os gatilhos documentados (NetInfo offline→online com debounce de 2s, timer de 30s em foreground) **não estão ligados**. Consequência prática: em instalação nova nada faz push nem pull, o **catálogo de exercícios fica vazio para sempre**, e o `WorkoutCreatorScreen` mostra "Catálogo de exercícios vazio" eternamente. Foi excluído desta rodada a pedido, mas precisa ser resolvido antes ou durante o teste no celular.
- **`lastPulledAt` é só em memória** (`src/sync/lastPulledAt.ts`, com comentário admitindo isso). Re-pull completo a cada abertura do app.

### 🟡 Risco de runtime

- `src/sync/SyncStatusIndicator.ts` importa `@/designSystem/tokens`, mas o alias `@/` só existe no `moduleNameMapper` do `jest.config.js`. O Babel não tem `module-resolver`. Funciona em teste, pode quebrar no Metro. Verificar `tsconfig.json`/`metro.config.js` ou trocar por caminho relativo.

### 🟡 Código morto / inconsistências

- `syncStatus` é passado como prop ao `DashboardScreen` e **nunca renderizado**. `getSyncStatusColor` não tem consumidor de UI.
- `src/config.ts` é legado da era `REACT_APP_*` (Expo nunca injeta essas vars). Nada importa. Superado por `src/config/env.ts`.
- `app/routers/sync.py` no backend é um router duplicado que não está registrado no `main.py`.
- `app/database/models_old.py.bak` — arquivo morto.
- Comentários desatualizados em `app/api/v1/endpoints/sync.py:101` e `:664` ainda dizem "stubs — retornam not implemented"; está tudo implementado.
- `AuthScreen` só tem "Entrar" — não há cadastro nem "esqueci a senha", apesar do docstring dizer "login/sign-up form".

### 🔴 Segurança

- **`gymnight/backend/.env` está commitado no repositório** (não só o `.env.example`). `ADMIN_SECRET` tem default `"changeme"`.

### 📓 Atualizar o vault ao terminar

Em `c:\Users\User\Documents\Projetos\segundo-cerebro\Projetos\GymNight-Mobile\`:

- `Log de Mudanças.md` — registrar a nova paleta e a **revogação explícita** da decisão "sem Google Fonts / system font" de 2026-08-19.
- `Arquitetura.md` — atualizar a seção do `designSystem/` com os componentes novos e a política nova (design system aplicado em todas as telas).
- **Criar `Decisões.md`** — é a única nota do template padrão que falta nesse projeto; todos os outros projetos do vault têm.
- `Bem-vindo.md` (raiz do vault) — o GymNight-Mobile **não está no índice**; adicionar.

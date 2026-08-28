# Waves 2–5 — Navegação e telas

> Parte de [`REDESIGN-VISUAL.md`](REDESIGN-VISUAL.md). Depende das waves [0](REDESIGN-01-FUNDACAO.md) e [1](REDESIGN-02-COMPONENTES.md).
> Caminhos relativos a `gymnight/frontend/`.

---

# Wave 2 — Navegação, SafeArea e correções de casca

## ✅ Concluída em 2026-08-28

Resultado: **122 suites / 648 testes**, 100% verde (a Wave 1 terminou em 119/616). `eslint` sem nenhum problema novo (97 pré-existentes antes e depois, idênticos).

Entregue conforme especificado nas seções 2.1–2.4 abaixo. Três notas de execução:

1. **`src/test/mocks/reactNativeSafeAreaContext.ts`** — extra não previsto. O `react-native-safe-area-context` toca o TurboModule nativo já no `import` (via `InitialWindow.native.ts`), então bastava uma tela importá-lo para derrubar toda suíte que a renderizasse. Mesmo padrão do `expoVectorIcons.ts` da Wave 1.
2. **9 raízes convertidas, não 5.** Além da raiz principal de cada tela, `DashboardScreen`, `ProgressScreen` e `WorkoutCreatorScreen` têm raízes de early-return (loading, catálogo vazio) que também colidiam com a status bar.
3. **`StartupErrorScreen` deliberadamente não usa `SafeAreaView`** — ele renderiza *fora* do `SafeAreaProvider`, já que o `App.tsx` só monta o provider depois da validação de env passar. O conteúdo é centralizado verticalmente, então não encosta na status bar de qualquer forma.

Testes novos (inspeção estática, seguindo a convenção do repo para invariantes que não dão para renderizar — ver `bootstrapWiring.test.ts`): `safeAreaWiring.test.ts`, `MainTabNavigator.style.test.ts`, `containerBanners.test.ts`. Verificados contra a árvore anterior via `git stash`: **26 dos 32 falham** sem as mudanças desta wave.

---

## 2.1 `src/navigation/MainTabNavigator.tsx`

Hoje:

```tsx
tabBarStyle: { backgroundColor: colors.surface, borderTopColor: 'rgba(154, 165, 177, 0.2)' },
tabBarActiveTintColor: colors.primary,
tabBarInactiveTintColor: colors.secondaryText,
```

Alvo:

```tsx
screenOptions={{
  headerShown: false,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 62,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.secondaryText,
  tabBarLabelStyle: { ...typography.caption },
}}
```

Trocar os dois `Svg`/`Path` desenhados à mão (`TreinosIcon`, `ProgressoIcon`) por `FontAwesome5` — `home` e `chart-line`, os mesmos nomes que o desktop usa na navegação. O ícone da aba ativa recebe `glow(colors.primary, 14, 0.5)`.

**Manter as bottom tabs.** O desktop usa pílulas horizontais no topo (`window.py:331`), mas a decisão de usar tab bar inferior no mobile já está registrada no vault como deliberada ("mais próximo do padrão de app fitness"). O que muda é só a estética das abas.

## 2.2 SafeArea — corrigir em todo lugar

`react-native-safe-area-context@4.12.0` está instalado e **não é importado em nenhum arquivo de `src/` nem no `App.tsx`**. Sem isso, o conteúdo colide com a status bar e com a barra de navegação do Android.

1. Envolver o `NavigationContainer` em `<SafeAreaProvider>` (em `App.tsx`).
2. Em cada tela, trocar o `<View style={styles.container}>` raiz por `<SafeAreaView style={styles.container} edges={['top']}>`.
   Nas telas com rodapé fixo (`ActiveSessionScreen`), usar `edges={['top', 'bottom']}`.

## 2.3 Telas de borda

- **`src/navigation/StartupErrorScreen.tsx`** — aplicar os tokens novos (heading vermelho + lista de vars `EXPO_PUBLIC_*` faltantes).
- **"Sessão não encontrada"** em `src/navigation/containers/ActiveSessionScreenContainer.tsx:101-125` — hoje tem estilos inline soltos dentro do container. Trocar pelo `EmptyState` + `Button`.

## 2.4 Banners de erro invisíveis

Em `DashboardScreenContainer.tsx` (e nos outros containers), os banners de erro renderizam assim:

```tsx
<View testID="logout-error-banner"><Text>{error}</Text></View>
```

Sem `style` nenhum: o `Text` sai na cor padrão (preto) sobre fundo preto — **invisível**. Além disso ficam fora do padding do `container`. Trocar todos pelo `<Banner variant="error" />` da Wave 1.

---

# Wave 3 — DashboardScreen (a tela mais transformada)

**Arquivos**: `src/screens/DashboardScreen/DashboardScreen.tsx`, `computeDashboardUIState.ts`, `src/hooks/useObserveDashboard.ts`, `src/hooks/domainUtils.ts`
**Origem**: `dashboard.py`, método `_build` (linhas 267–361)

## 3.1 O que existe hoje

```
[banner offline?]
[7 barrinhas planas de 8px = streak semanal]
[ou empty state com CTA, ou ScrollView de cards de treino]
[botão "Sair"]
```

Sem título, sem saudação, sem métricas. E **um bug**: o botão "Criar primeiro treino" está dentro do bloco `{!hasData && ...}` — com um treino ou mais criado, **não existe mais nenhuma rota para o `WorkoutCreator`**.

## 3.2 Estrutura alvo

Um `ScrollView` com `padding: spacing.lg` e `gap: spacing.lg`:

```
┌──────────────────────────────────────┐
│  HeroBanner (imagem + degradês)      │  180px
│  BOM TREINO, PEDRO                   │  h1 36/800, nome em #a2ff00
│  78kg · 180cm                        │  13/500 #9ca3af, letterSpacing 1
└──────────────────────────────────────┘
┌────────────────┐ ┌───────────────────┐
│ 🏋 Treinos      │ │ 🏋 Volume total    │   grid 2×2 de StatCard
│ 4 dias         │ │ 12.4k kg          │
└────────────────┘ └───────────────────┘
┌────────────────┐ ┌───────────────────┐
│ ▤ Séries       │ │ 📈 Streak          │
│ 86 séries      │ │ 3 sem             │
└────────────────┘ └───────────────────┘
┌──────────────────────────────────────┐
│  ATIVIDADE SEMANAL                   │  Card
│  ⚡  —  ⚡  —  ⚡  —  —                │  7 × DayDot 48px
│ SEG TER QUA QUI SEX SÁB DOM          │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  SEUS TREINOS            [+ Novo]    │  Card + SectionTitle com slot right
│  Treino A — Peito                    │  linha tocável → inicia a sessão
│  5 exercícios · média 52 min      ›  │
│  ──────────────────────────────────  │  separador 1px #2a2a2a
│  Treino B — Costas                   │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  TREINOS RECENTES                    │  Card
│  Treino A — Peito         4.2k kg    │
│  Hoje                                │
│  ──────────────────────────────────  │
│  Treino livre               38 min   │
│  há 3 dias                           │
└──────────────────────────────────────┘
[  Sair  ]                               Button variant="danger"
```

## 3.3 Detalhes por bloco

### HeroBanner

Saudação, de `dashboard.py:261`:
```python
self.banner_label.setText(f"BOM TREINO, <span style='color:#a2ff00'>{name}</span>")
```
Em RN: `<Text style={typography.h1}>BOM TREINO, <Text style={{color: colors.primary}}>{nome.toUpperCase()}</Text></Text>`

Subtítulo, de `dashboard.py:265`:
```python
self._sub_label.setText(f"{int(weight)}kg · {height}cm · Meta: {goal}")
```
⚠️ **A tabela `users` do mobile não tem coluna `goal`** (tem `name`, `email`, `weight`, `height`, `birth_date`, `gender`). Renderizar só `{peso}kg · {altura}cm`. Se algum campo estiver nulo, omitir o separador em vez de mostrar "nullkg".

### Grid 2×2 de StatCard

O desktop usa uma linha de 4 (`dashboard.py:305-318`); em tela de celular o equivalente é 2×2.

⚠️ **O desktop exibe "Calorias queimadas"**, calculado com a fórmula MET a partir da tabela `exercise_met_values` (`dashboard.py:434-454`). **Essa tabela não existe no backend do mobile** — os modelos são `users`, `exercises`, `workouts`, `workout_exercises`, `workout_sessions`, `logged_sets`, `deleted_records`. Substituir por **Séries**.

| Card | Ícone | Unidade | Cálculo |
|---|---|---|---|
| Treinos esta semana | `dumbbell` | `dias` | `workout_sessions` com `started_at` nos últimos 7 dias |
| Volume total | `weight-hanging` | `kg` | `Σ(weight × repetitions)` de `logged_sets` |
| Séries | `layer-group` | `séries` | `count(logged_sets)` |
| Streak | `chart-line` | `sem` | semanas consecutivas com ≥1 treino |

**Formatação do volume** (`dashboard.py:405`): acima de 1000 → `f"{vol/1000:.1f}k"`, senão o número inteiro.

**Streak** — portar a lógica de `_calculate_streak` (`dashboard.py:460-510`): agrupa as datas de treino por semana (início na segunda), ordena decrescente, e conta semanas consecutivas. Retorna 0 se a semana mais recente com treino for anterior à semana passada. Deve virar uma **função pura testável** em `domainUtils.ts`.

### Card "ATIVIDADE SEMANAL"

7 × `DayDot`, com labels `Seg Ter Qua Qui Sex Sáb Dom`.

⚠️ **Bug de ordenação a resolver**: o `weeklyStreak` que o app produz hoje é indexado com **domingo em 0** (documentado no próprio docstring do `DashboardScreen`), mas o desktop exibe **segunda→domingo** (`dashboard.py:383`: `loop_to_dow = [1, 2, 3, 4, 5, 6, 0]`).

Criar uma função pura em `src/hooks/domainUtils.ts`, com teste:

```ts
/** Reordena um array de 7 posições indexado por domingo=0 para segunda→domingo. */
export function reorderWeekMondayFirst<T>(week: T[]): T[] {
  return [...week.slice(1), week[0]];
}
```

Regra de negócio a preservar: o streak semanal conta **apenas sessões finalizadas** (`ended_at != null`) — decisão já registrada no vault.

### Card "SEUS TREINOS"

`SectionTitle` com slot `right` = `<Button variant="outlineAccent" icon="plus" label="Novo" />`.
**É isto que corrige o bug da rota inacessível para o WorkoutCreator.**

Cada treino é uma linha tocável no padrão `_WorkoutItem` (`dashboard.py:202-226`):
- coluna esquerda: nome em `typography.bodyBold` branco; subtítulo em `typography.sub` `#6b7280`
- `flex: 1` de respiro
- coluna direita: valor em `typography.sub` `#6b7280`
- separador `borderBottomWidth: 1, borderBottomColor: colors.border` entre itens (não depois do último)
- `paddingVertical: 16` (`dashboard.py:207`)

**Manter o comportamento atual**: tocar no treino **inicia a sessão direto**, sem CTA nem modal intermediário — decisão registrada no vault.

Os dados já existem em `DashboardWorkout`: `exerciseCount`, `avgSessionDurationMs`, `lastTrainedDaysAgo`. Compor o subtítulo como `"5 exercícios · média 52 min"` e o valor da direita como `formatLastTrained(...)`, que já existe no arquivo.

### Card "TREINOS RECENTES"

Últimas 5 sessões finalizadas (`dashboard.py:512-563`). Nome = `workoutName ?? 'Treino livre'`. Subtítulo pelo padrão do desktop (`dashboard.py:529`):

```python
when = "Hoje" if diff == 0 else "Ontem" if diff == 1 else f"{diff} dias atrás"
```

Valor à direita: volume em kg se > 0, senão a duração em min. Vazio → `EmptyState` com "Nenhum treino registrado ainda."

`src/hooks/historyDomainUtils.ts` já faz esse trabalho para o `ProgressScreen` (sessões recentes + volume) — **reutilizar em vez de reimplementar**.

### Sair

Sair do fluxo principal. `<Button variant="danger" label="Sair" />` discreto no fim do scroll.

## 3.4 Dados novos necessários

Estender `src/hooks/useObserveDashboard.ts` com: perfil do usuário (`name`, `weight`, `height`), volume total, contagem de séries, streak em semanas, sessões recentes.

⚠️ **Regra arquitetural do projeto, não violar**: estado de domínio vem **exclusivamente** de observables do WatermelonDB. Nada é copiado para Zustand nem para Context (está no header do `useObserveDashboard.ts`: _"Nenhum dado de domínio é copiado para Zustand/Context (Requirement 1.2, 1.3)"_).

Toda agregação vai como **função pura** em `domainUtils.ts` / `computeDashboardUIState.ts`, com teste próprio — é o padrão do repo e o que mantém as telas testáveis sem mock nativo.

Outra convenção documentada: consultas cruzando tabelas são feitas com **join do lado do cliente**, não com `Q.on()` do WatermelonDB.

---

# Wave 4 — ActiveSessionScreen

**Arquivos**: `src/screens/ActiveSessionScreen/ActiveSessionScreen.tsx`, `sessionLifecycle.ts`, `startSessionWithPersistence.ts`, `endSessionWithPersistence.ts`
**Origem**: `active_workout.py`, `_build_workout_page` (65–197) e `_create_exercise_card` (544–652)

## 4.1 ⚠️ Decisão que muda comportamento — ler antes de executar

**Fluxo atual do mobile**: cronômetro grande → caixa "Volume Total" → lista de séries registradas → formulário no rodapé (chips de exercício + peso + reps + botão "Registrar Série") → "Finalizar treino".

**Fluxo do desktop**: uma **grade de séries pré-montada**. Para cada exercício do treino, já aparecem N linhas vazias (N = `series_target`), com campos de peso e reps e um check verde. Marcar o check **grava a série**.

A grade é o que faz a tela *parecer* o desktop — e os dados já existem: o `WorkoutCreatorScreen` já captura `series_target`, `reps_target` e `weight_target` em `workout_exercises`.

**Consequências de adotar a grade:**
- A gravação passa a acontecer no toggle do check, com a validação do desktop (`active_workout.py:665`): se peso ou reps estiverem vazios, desmarca o check, pinta as bordas dos campos vazios de vermelho e mostra um aviso.
- O `finish` continua salvando as séries **preenchidas mas não marcadas** (`active_workout.py:890-905`), com uma flag `saved` por série para não duplicar.
- Reescreve `sessionLifecycle.ts` e as suítes de teste de `ActiveSessionScreen`.

**Se preferir só reestilizar o fluxo atual, o resto deste documento não muda.** É uma escolha isolada desta tela.

## 4.2 Estrutura alvo

```
┌──────────────────────────────────────┐
│ [← Voltar]              12/20 séries │  ScreenHeader
│                                      │
│ TREINO A — PEITO                     │  h1 36/800 maiúsculo
│                                      │
│ [+ Adicionar Exercício]              │  Button outlineAccent
│ ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░             │  ProgressBar 4px
│                                      │
│ ┌──────────────────────────────────┐ │  Card com glow (gap 32 entre cards)
│ │ ◈  SUPINO RETO              3/4  │ │  IconBadge 44px + h2 + verde 18/800
│ │                                  │ │
│ │ Série   Peso (kg)   Reps         │ │  typography.sub
│ │   1     [ 80    ]   [ 10   ]  ✓  │ │  nº verde 20/900 · UnderlineInput · check 52px
│ │   2     [ 80    ]   [ 10   ]  ✓  │ │
│ │   3     [ 80    ]   [  8   ]  ✓  │ │
│ │   4     [  0    ]   [10-12 ]  ☐  │ │
│ └──────────────────────────────────┘ │
│              ...                     │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐  faixa FIXA fora do scroll
│      🏁  Finalizar Treino            │  bg #1a1a1a, borderTop 1px #2a2a2a
└──────────────────────────────────────┘  Button primary, 48px
```

## 4.3 Especificações

- **Header** (`active_workout.py:81`): `ScreenHeader` com "← Voltar" à esquerda, e à direita o contador `{feitas}/{total} séries` em `typography.sub`.
- **Título**: nome do treino em `typography.h1`, **caixa alta** (`routine.name.upper()`, linha 519).
- **Card de exercício** (`_create_exercise_card`): `padding: 20`, `gap: 14`, `glow(colors.primary, 24, 0.30)`. Header do card = `IconBadge` com `◈` + nome em `typography.h2` maiúsculo + `{feitas}/{total}` em `colors.primary` 18px ExtraBold. Gap de **32** entre cards (`active_workout.py:132`).
- **Cabeçalho de colunas** (`active_workout.py:579`): `Série` (flex 1) · `Peso (kg)` (flex 4) · `Reps` (flex 4) · vazio (flex 1), em `typography.sub`.
- **Linha de série** (`active_workout.py:605-648`): gap 16. Número em `typography.setNumber` `colors.primary`, largura fixa 40, centralizado. Dois `UnderlineInput` (`flex: 5` cada) com placeholders `0` e `10-12`, altura 44, `keyboardType="numeric"`. `SetCheckButton` 52×52 no fim.
- **Rodapé fixo** (`active_workout.py:171-195`): fora do `ScrollView`. Faixa `backgroundColor: colors.card`, `borderTopWidth: 1`, `borderTopColor: colors.border`, `paddingHorizontal: 24`, `paddingVertical: 10`. Dentro, `Button variant="primary" icon="flag-checkered" label="Finalizar Treino"` com `minHeight: 48`.
- **"+ Adicionar Exercício"** (`active_workout.py:100`): `Button variant="outlineAccent" icon="plus"`, altura 40. Abre um seletor com busca no catálogo (a tela já tem `exerciseOptions` disponível; reaproveitar).

## 4.4 Overlay de confirmação de saída

De `_confirm_back` (`active_workout.py:960-1059`). Um `Modal` transparente:

- Fundo `colors.overlay` (`rgba(0,0,0,0.85)`), cobrindo a tela toda.
- Card centralizado: `backgroundColor: colors.card`, **sem borda**, `borderRadius: radii.lg`, `padding: 32`, largura ~85% da tela.
- Linha ícone+texto: `question-circle` verde 48px + "Abandonar o treino atual?" em 18px Bold branco.
- Botões lado a lado, altura 48, gap 12: `ghost` "Não" · `primary` "Sim".

## 4.5 Tela de resumo pós-treino

De `_build_summary_page` (`active_workout.py:778-855`). No mobile, o mais simples é uma rota nova no stack ou um estado local da própria tela.

```
        🏆                      64px, centralizado
  TREINO CONCLUÍDO!             28px Black, colors.primary, centralizado
  ──────────────────            separador 2px colors.border
┌────────┐┌────────┐┌────────┐  3 metric cards, gap 16
│  🏋    ││  🕐    ││  ▤     │  ícone verde 28px centralizado
│ 4200kg ││ 52:14  ││   24   │  22px ExtraBold branco
│ Volume ││Duração ││ Séries │  typography.sub
└────────┘└────────┘└────────┘
  [ 🏠 Voltar para Treinos ]     Button primary 48px
```

⚠️ O desktop também mostra um **heatmap muscular** ("MÚSCULOS TRABALHADOS"), que depende da tabela de mapeamento músculo↔exercício e do `PerformanceAnalyzer`. **Nada disso existe no mobile** — omitir. O terceiro card do desktop é "Cardio", que também não tem equivalente; substituído por "Séries".

## 4.6 Cronômetro

O mobile tem um cronômetro `HH:MM:SS` grande em verde no topo, com `setInterval` de 1s. O desktop **não tem** cronômetro visível durante o treino (só mostra a duração no resumo).

Recomendação: **manter o cronômetro**, mas movê-lo para o slot `right` do `ScreenHeader`, em `typography.bodyBold` verde, dividindo espaço com o contador de séries. É informação útil no celular e não conflita com a linguagem visual.

---

# Wave 5 — WorkoutCreator, Auth e Progress

## 5.1 WorkoutCreatorScreen

**Origem**: `workouts.py`, `_build_create_page` (714+)

- **`ScreenHeader` com voltar.** Hoje **não há saída da tela** exceto salvando — a rota roda com `headerShown: false` e não existe botão de cancelar.
- Título `CRIAR TREINO` em `typography.h2` (`workouts.py:757`) + subtítulo "Monte seu treino personalizado com exercícios, séries e repetições." em `typography.sub` (`workouts.py:760`).
- Label "Nome do treino" em `typography.label` branco + `Input` com placeholder `Ex: Treino D — Ombro` (`workouts.py:773`).
- Cada exercício vira um `Card` com `backgroundColor: colors.cardAlt`: header `space-between` com o nome + `Switch` (`trackColor={{ true: colors.primary }}`, `thumbColor={colors.primaryText}`).
- Quando ligado, revela a linha de alvos: cabeçalhos de coluna em 11px Bold `#666` (`workouts.py:938`) + três campos numéricos `Séries` / `Reps` / `Peso (kg)`.
- `Button variant="primary" label="Salvar"`; desabilitado → `colors.cardAlt` (comportamento já existe, só reapontar tokens).
- Estados alternativos: spinner de carregamento; catálogo vazio → `EmptyState` com "Catálogo de exercícios vazio. Conecte-se à rede para sincronizar."

⚠️ **Armadilha de teste já documentada no vault**: o `Switch` mockado exige `fireEvent(element, 'valueChange', true)` — `fireEvent.press` não funciona. E o `disabled` do `TouchableOpacity` mockado é inerte, então o guard `if (!canSave) return` precisa continuar existindo no handler.

## 5.2 AuthScreen

Tela minimalista hoje: dois inputs centralizados e um botão, sem identidade nenhuma.

- **Lockup da marca** no topo, portado da titlebar (`window.py:94-106`):
  ```
  ⚡ GYMNight
  ```
  Raio em `colors.primary`, 18px Black. "GYMNight" em branco 15px ExtraBold com `letterSpacing: 1`.
- `Input` para Email e Senha (`secureTextEntry`), `Button variant="primary" label="Entrar"` com estado `loading`.
- Banners offline e de erro pelo `Banner` da Wave 1 (borda esquerda 4px — verde para offline, vermelha para erro).
- Manter o layout centralizado vertical (`justifyContent: 'center'`).

_(Não há cadastro nem "esqueci a senha" na tela — está listado como pendência em `REDESIGN-VISUAL.md` §6, fora do escopo deste redesign.)_

## 5.3 ProgressScreen

Já é a tela mais próxima do alvo — é a única que usa `Card`, `Chip` e `StatRow` juntos. Ajustes pontuais:

- Título "PROGRESSO" em `typography.h1`, **caixa alta**.
- `Card` com borda + glow (vem de graça pelo novo default do `Card`).
- `Chip` de exercícios com o estilo novo.
- **`OneRmChart.tsx`**: trocar o literal hardcoded `#232B35` das gridlines por `colors.border`. É o único literal de cor fora dos tokens em toda a camada de telas.
- **Tornar o gráfico responsivo**: hoje é `width={300} height={120}` **fixo**, ignorando a largura do device. Usar `useWindowDimensions()` menos o padding horizontal do container.
- Estado de carregamento: hoje é um `<Text>Carregando...</Text>` solto — trocar por `ActivityIndicator` com `color={colors.primary}`, como nas outras telas.
- Manter o gráfico de 1RM como **SVG desenhado à mão** (decisão registrada no vault: "mantém controle fino do visual minimalista"). Não trocar por biblioteca de gráficos.

---

# Checklist final das waves 2–5

- [ ] `SafeAreaProvider` no `App.tsx` e `SafeAreaView` nas 5 telas
- [ ] Tab bar restilizada com ícones FontAwesome5
- [ ] Banners de erro dos containers visíveis (bug corrigido)
- [ ] Dashboard: hero, 4 stat cards, atividade semanal, seus treinos, treinos recentes
- [ ] Botão "+ Novo" acessível com treinos já existentes (bug corrigido)
- [ ] `reorderWeekMondayFirst` + agregações do dashboard como funções puras testadas
- [ ] ActiveSession com cards de exercício, grade de séries e rodapé fixo
- [ ] Overlay de confirmação de saída e tela de resumo
- [ ] "← Voltar" funcional no WorkoutCreator e no ActiveSession (bug corrigido)
- [ ] `OneRmChart` responsivo e sem literal de cor
- [ ] Zero literais de cor fora de `tokens.ts` em `src/screens/` e `src/navigation/`
- [ ] Zero `fontWeight` remanescente (a Inter usa família por peso)
- [ ] `npx tsc --noEmit` limpo e `npm test` verde

# REDESIGN-04: identidade minimal premium

> Supera a identidade "neon" das waves 0–5 ([`REDESIGN-VISUAL.md`](REDESIGN-VISUAL.md)).
> Executado em 2026-10-04. Caminhos são relativos a `gymnight/frontend/`.

## Status

✅ **Concluído.** A suíte tem **172 suites / 1034 testes**, todos verdes.
- `tsc`: só os 10 erros que já existiam (testes de auth/sync).
- ESLint: 289 problemas, abaixo da baseline de 291.

| Commit | Escopo |
|---|---|
| `26e92ab` | `expo-haptics` e mocks de teste (Animated, LayoutAnimation, AccessibilityInfo, haptics) |
| `b2adddd` | Tokens, `motion.ts`, `haptics.ts`, primitivos novos, componentes reestilizados, tab bar e tema de navegação |
| `814aa26` | Dashboard |
| `af12f77` | ActiveSession, Cardio e CardioForm |
| `1a04c4c` | WorkoutCreator |
| `785ddbf` | Progress e OneRmChart |
| `377123e` | Statistics e RadarChart |
| `f82aecc` | Auth |
| `e1dc665` | Onboarding |
| _(este)_ | Limpeza: aliases, fontes 800/900, StartupError e docs |

⚠️ **O `expo-haptics` é módulo nativo.** Depois de atualizar, é preciso rebuild (`npx expo run:android`); só recarregar o Metro não basta. Num build antigo, o `haptic()` engole o erro e o app segue sem vibrar.

## Princípios

1. **Preto em camadas, sem sombra.** A profundidade vem dos degraus `background → surface → card → cardAlt` e de uma única hairline de 1px. O `glow()` foi removido.
2. **Lima como acento raro.** O lima aparece em três situações:
   - no máximo **um CTA primário por tela**;
   - em estado ativo ou selecionado (chip, switch, check de série, dia treinado);
   - em destaque de dado (linha do gráfico, delta positivo, recorde pessoal).

   Ele **nunca** aparece em ícone decorativo, título, timer ou tint da tab bar.
3. **Sentence case.** Nada de `toUpperCase()` na UI. Títulos e nomes aparecem como o usuário digitou.
4. **Ritmo fixo.** Toda tela tem gutter de 20, 32 entre blocos e 12 entre o título de seção e o conteúdo.
5. **Ação principal na zona do polegar.** Fica num rodapé fixo (`Screen footer`). Ações destrutivas saem dali e vão para o header ou para um sheet de confirmação.
6. **Feedback contido.** Press com escala de 0.97, haptics por intenção e animações curtas (≤ 300ms). Tudo respeita "Reduzir movimento".

## Tokens (`src/designSystem/tokens.ts`)

### Cores

| Token | Valor | Contraste | Uso |
|---|---|---|---|
| `background` | `#0a0a0a` | — | Fundo |
| `surface` | `#111113` | — | Tab bar, rodapés, sheets |
| `card` | `#18181b` | — | Cards |
| `cardAlt` | `#222226` | — | Inputs, chips, controles |
| `border` / `divider` | `#2a2a2e` / `rgba(255,255,255,.06)` | — | Hairline / separador em lista |
| `primaryText` | `#f4f4f5` | ~18:1 | Texto principal |
| `secondaryText` | `#a1a1aa` | ~7.7:1 | Subtítulos, labels |
| `tertiaryText` | `#71717a` | ~4:1 | Unidades, placeholders, inativos (nunca corpo de texto) |
| `primary` | `#a2ff00` | — | Lima, ver regras acima |
| `success` / `error` | `#84cc16` / `#f87171` | AA | Deltas, erros |

O contraste é travado em teste: `tokens.test.ts` › "contraste WCAG".

### Escalas e medidas

- **Spacing:** `xxs 4 · xs 8 · sm 12 · md 16 · ml 20 · lg 24 · xl 32 · xxl 40 · xxxl 56`.
- **Radii:** `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · pill`.
- **`layout`:**
  - `gutter 20`, `sectionGap 32`, `blockGap 12`, `cardPadding 16`
  - `rowMinHeight 56`, `controlHeight {sm 36, md 52}`, `hitTarget 44`, `hairline 1`
- **Tipografia** (Inter 300/400/500/600/700):

  | Token | Tamanho | Peso | Uso |
  |---|---|---|---|
  | `display` | 32 | Semi | |
  | `title` | 28 | Semi | |
  | `h2` | 22 | Semi | |
  | `h3` | 17 | Semi | |
  | `body` / `bodyMedium` / `bodyStrong` | 15 | Reg / Med / Semi | |
  | `footnote` / `label` | 13 | Reg / Med | |
  | `caption` / `captionStrong` | 12 | Med / Semi | |
  | `tab` | 11 | Med | |
  | `metricXL` | 44 | Light | `tabular-nums` |
  | `stat` | 28 | Med | `tabular-nums` |
  | `numeric` | 15 | Med | `tabular-nums` |

- **`motion`:** `duration {fast 120, base 200, slow 300}`, `pressScale 0.97`, `sheetOffset 32`.

### Haptics (`src/designSystem/haptics.ts`)

| Intenção | Onde |
|---|---|
| `selection` | Aba, chip, PSE, option row, switch, tipo de série |
| `light` | Botão primário (padrão do `Button primary`) |
| `medium` | Check de série, "Registrar série" |
| `success` | Resumo do treino, "Salvar treino" |
| `warning` | Abertura de confirmação destrutiva, check com campo inválido |

## Componentes

**Novos:**
- `Touchable`: base de todo pressionável.
- `IconButton`: alvo de 44px.
- `Screen`: casca com SafeArea, gutter, título, header e footer fixos.
- `ListRow`
- `Sheet`: o único `Modal` do app.
- `ConfirmSheet`
- `DeltaBadge`
- `LoadingState`

**Alterados:**
- `Button`: ganhou `secondary` e `size="sm"`; o `outlineAccent` saiu.
- `Card`: sem borda por padrão, `padding none|md|lg`.
- `UnderlineInput` virou `CellInput`.
- `Banner`: tint + ícone, mais a variante `success`.
- `DayDot`: círculo, prop `isToday`.
- `SectionTitle`: prop `meta`, sem caixa alta.
- `EmptyState`: props `icon`, `title`, `messageTestID`.
- `ScreenHeader`: prop `title`.
- `Chip`, `StatCard`, `SetCheckButton`, `SetTypeBadge`, `IconBadge`, `ProgressBar`, `Input`: só estilo.

**Removidos:** `HeroBanner` (e `assets/hero-header.png`), `StatRow`, `glow()`.

## Telas: o que mudou de UX

**Dashboard**
- O hero com foto virou um cabeçalho tipográfico: data, "Bom treino, Pedro" e avatar.
- **"Sair" saiu do fim do scroll** e foi para o sheet da conta, junto do status de sync.
- "Novo" e "Cardio" viraram botões `sm` alinhados.

**ActiveSession**
- O timer e o progresso ficam sempre visíveis num header fixo.
- A grade tem colunas de largura fixa.
- No modo livre, "Registrar série" é secundário, para que "Finalizar treino" seja o único lima.
- A saída pede confirmação num sheet ("a sessão continua aberta").
- O resumo não tem mais emoji.

**CardioForm**
- PSE num trilho segmentado de 10 células, com legenda em texto (sem emoji).
- Ações: Cancelar (flex 1) e Adicionar (flex 2).

**WorkoutCreator**
- Tocar na linha inteira alterna o exercício.
- "Apagar" virou ícone no header.
- "Salvar treino" fica no rodapé fixo.

**Progress**
- O 1RM aparece como número protagonista.
- Os chips vão de borda a borda.
- O recorde virou `Banner success`.

**Statistics**
- O período ficou explícito no subtítulo.
- Seções nomeadas.

**Auth**
- O título diz o que a tela faz; os campos têm label e autofill.
- A troca de modo é um link ghost.

**Onboarding**
- Uma pergunta por passo.
- As escolhas viraram linhas grandes (`OptionRow`).
- Rodapé: Voltar (1) · Próximo (2).

**Navegação**
- A tab bar é monocromática, sem altura fixa (respeita gesture nav e 3 botões), com fade e haptic.
- O tema escuro do React Navigation elimina o flash branco.
- A ActiveSession sobe de baixo.

## Convenções de teste

- No mock do RN, os componentes são strings. O `Touchable` usa `Animated.createAnimatedComponent(Pressable)`, que vira o host `Pressable`. testID, style, `disabled` e `accessibilityState` ficam **no mesmo nó**.
- Não use style-função em `Pressable`, porque o mock nunca a chama.
- O `Modal` do mock renderiza os filhos mesmo com `visible={false}`. Para testar um sheet, cheque `getByTestId('<id>').props.visible`.
- `safeAreaWiring.test.ts` exige que toda tela use `<Screen edges={[…]}>`.
- `MainTabNavigator.style.test.ts` proíbe `glow(` e `height:` na tab bar.
- Para inspecionar haptics em teste: `import * as Haptics from 'expo-haptics'`. Esse import é o mock do `moduleNameMapper`. O `jest.requireMock` devolve outra instância.

## Validação no device (pendente, fazer manualmente)

Rodar `npx expo run:android` (rebuild obrigatório) e conferir:

- [ ] Haptics: check de série (médio), troca de aba (seleção), resumo (sucesso).
- [ ] Press-scale e slide dos sheets (conta, cardio, confirmações).
- [ ] Sem flash branco nas transições.
- [ ] Inter 300 (1RM) e 600 (títulos) renderizando, e não o fallback.
- [ ] Timer tabular sem tremer.
- [ ] Rodapés fixos com o teclado aberto (WorkoutCreator, modo livre, Onboarding).
- [ ] Altura da tab bar em gesture nav e em 3 botões.
- [ ] Contraste de `tertiaryText` sob luz forte.
- [ ] Fluxo conta → Sair, com o banner de erro visível se falhar.

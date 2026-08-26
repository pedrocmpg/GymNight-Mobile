# Wave 1 — Biblioteca de componentes do design system

> Parte de [`REDESIGN-VISUAL.md`](REDESIGN-VISUAL.md). Depende da [Wave 0](REDESIGN-01-FUNDACAO.md).
> Local: `gymnight/frontend/src/designSystem/components/`

## Estado atual

A biblioteca inteira são **3 componentes**: `Card.tsx`, `Chip.tsx`, `StatRow.tsx`. Todo o resto (botões, inputs, banners, cabeçalhos, estados vazios) está copiado e colado nas 5 telas. Esta wave transforma esses padrões repetidos em componentes reais e adiciona os que a linguagem do desktop exige.

**Convenção do repo a seguir**: cada componente é um arquivo, com um teste irmão em `__tests__/<Nome>.component.test.tsx`. Props tipadas e exportadas (`export interface XProps`). `testID` e `accessibilityLabel` como props opcionais em tudo que é interativo — as suítes existentes dependem disso.

---

## 1. `Card.tsx` — **alterar** (já existe)

Hoje: `bordered` default `false`, borda `rgba(154,165,177,0.2)`, bg `surface`, `radii.md`.
Alvo (`theme.py:194`, `QFrame#card`):

```css
QFrame#card {
    background: #1a1a1a;
    border: 2px solid #2a2a2a;
    border-radius: 16px;
}
```
Com `shadow(blur=24, opacity=140, offset_y=4)` aplicado por padrão (`theme.py:219`).

```ts
export interface CardProps {
  children: React.ReactNode;
  /** Borda de 2px. Default agora é TRUE — no desktop todo card tem borda. */
  bordered?: boolean;
  /** Glow neon verde. Default false; ligar em stat cards e cards de exercício. */
  glow?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}
```

Estilo base: `backgroundColor: colors.card`, `borderRadius: radii.lg`, `padding: spacing.lg`, e quando `bordered` → `borderWidth: 2, borderColor: colors.border`. Quando `glow` → espalhar `glow(colors.primary, 16, 0.22)`.

Comportamento que já existe e deve ser mantido: sem `onPress` renderiza `View`, com `onPress` renderiza `TouchableOpacity` com `activeOpacity={0.8}`.

⚠️ **`Card.component.test.tsx` vai quebrar** pela inversão do default de `bordered`. Atualizar.

---

## 2. `Button.tsx` — novo

Cobre os quatro estilos de botão do desktop (`theme.py:91-127` + os inline em `active_workout.py`).

```ts
export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'outlineAccent';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;       // default 'primary'
  icon?: string;                 // nome FontAwesome5, opcional
  disabled?: boolean;
  loading?: boolean;             // renderiza ActivityIndicator no lugar do label
  fullWidth?: boolean;           // default true
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}
```

| Variante | Origem | Estilo |
|---|---|---|
| `primary` | `QPushButton` (`theme.py:91`) | bg `colors.primary`, texto e ícone `colors.onPrimary`, `typography.bodyBold`, `radii.md`, `paddingVertical: 12`, `paddingHorizontal: 27`, `minHeight: 48` |
| `ghost` | `QPushButton#ghost` (`theme.py:106`) | transparente, `borderWidth: 2` `colors.border`, texto `colors.secondaryText`, `radii.md` |
| `danger` | `QPushButton#danger` (`theme.py:118`) | transparente, `borderWidth: 2` `colors.error`, texto `colors.error`, `radii.md` |
| `outlineAccent` | `add_ex_btn` (`active_workout.py:103`) | transparente, `borderWidth: 1` `colors.primary`, texto e ícone `colors.primary`, `radii.md`, `fontSize: 13` bold |

Estado `disabled` (`theme.py:104`): `backgroundColor: colors.cardAlt`, texto `colors.secondaryText`, sem borda.
Estado pressed no `primary`: `colors.primaryDark` (via `activeOpacity` ou `pressed` style).

⚠️ Nos testes, o `TouchableOpacity` mockado **ignora a prop `disabled`** (armadilha já documentada no vault). Guardar explicitamente dentro do handler:

```tsx
const handlePress = () => {
  if (disabled || loading) return;
  onPress();
};
```

---

## 3. `Input.tsx` — novo

Origem: `QLineEdit` (`theme.py:130-140`).

```css
QLineEdit { background: #1a1a1a; color: #ffffff; border: 2px solid #2a2a2a;
            border-radius: 10px; padding: 12px 18px; font-size: 15px; }
QLineEdit:focus { border-color: #a2ff00; }
```

```ts
export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;          // renderiza acima do campo em typography.label, branco
  error?: string;          // borda vermelha + mensagem em colors.error abaixo
  testID?: string;
}
```

Precisa de estado local `isFocused` para trocar `borderColor` entre `colors.border` e `colors.primary`. Cor do placeholder: `colors.secondaryText`. `selectionColor`: `colors.primary`.

---

## 4. `UnderlineInput.tsx` — novo

Origem: os campos de peso/reps das séries (`active_workout.py:589-604`).

```css
QLineEdit { background: transparent; color: #ffffff; border: none;
            border-bottom: 1px solid #2a2a2a; border-radius: 0;
            padding: 10px 8px; font-size: 15px; }
QLineEdit:focus { border-bottom: 2px solid #a2ff00; }
```

Mesma API do `Input`, mas sem `label`. `height: 44`. No estado de erro (`active_workout.py:678`) a linha vira `borderBottomWidth: 2, borderBottomColor: colors.error`.

---

## 5. `ScreenHeader.tsx` — novo

Origem: header do treino ativo (`active_workout.py:81-91`) — botão ghost "← Voltar" de 90px à esquerda, `addStretch()`, e um label `sub` à direita.

```ts
export interface ScreenHeaderProps {
  onBack?: () => void;          // se ausente, o botão não é renderizado
  backLabel?: string;           // default 'Voltar'
  right?: React.ReactNode;      // slot livre à direita
  testID?: string;
}
```

**Este componente resolve um bug real**: o stack raiz roda com `headerShown: false` global, então hoje `WorkoutCreatorScreen` e `ActiveSessionScreen` **não têm nenhuma forma de voltar** a não ser salvando/finalizando.

---

## 6. `SectionTitle.tsx` — novo

Origem: `QLabel#h3` e os títulos `ATIVIDADE SEMANAL` / `TREINOS RECENTES` (`dashboard.py:329,351`) — 15px/700 branco, sempre em caixa alta.

```ts
export interface SectionTitleProps {
  children: string;
  right?: React.ReactNode;   // botão de ação à direita (ex.: "+ Novo")
  testID?: string;
}
```

Aplicar `.toUpperCase()` no próprio componente, para que ninguém precise lembrar. `typography.h3`, `color: colors.primaryText`. Quando há `right`, vira `flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'`.

---

## 7. `StatCard.tsx` — novo

Origem: `_StatCard` (`dashboard.py:68-118`).

```
┌─────────────────────────┐   card #1a1a1a, borda 1px #2a2a2a
│ 🏋 Treinos esta semana   │   ícone verde 16px + título 13/500 #6b7280
│                         │   gap 12
│ 4 dias                  │   valor 36/800 #fff  +  unidade 25/500 #9ca3af
└─────────────────────────┘   padding 16, glow verde suave
```

```ts
export interface StatCardProps {
  icon: string;        // nome FontAwesome5
  title: string;
  value: string;
  unit?: string;
  testID?: string;
}
```

Valor e unidade num `View` `flexDirection: 'row'` com `alignItems: 'baseline'` e `gap: spacing.xs` — é o que faz a unidade "assentar" na linha de base do número, como no desktop.

Ignorar o `adjust_font_size()` do desktop (lógica responsiva de janela redimensionável, sem equivalente em celular).

---

## 8. `IconBadge.tsx` — novo

Origem: `ex_icon` do card de exercício (`active_workout.py:555-558`) — 44×44, bg `#1a2e0a`, `border-radius: 10px`, glifo `◈` centralizado em 20px.

```ts
export interface IconBadgeProps {
  icon?: string;        // FontAwesome5; se ausente usa `glyph`
  glyph?: string;       // fallback textual, ex.: '◈'
  size?: number;        // default 44
  testID?: string;
}
```

---

## 9. `ProgressBar.tsx` — novo

Origem: `_prog_bar` / `_prog_fill` (`active_workout.py:121-128`) — trilho de 4px `#2a2a2a` `radii.sm`, preenchimento `#a2ff00` de largura proporcional.

```ts
export interface ProgressBarProps {
  value: number;   // 0..1 — CLAMPAR no componente
  testID?: string;
}
```

Preenchimento via `width: `${clamped * 100}%`` — no desktop é pixel calculado porque Qt não tem percentual; em RN o percentual é mais simples e já é responsivo.

---

## 10. `SetCheckButton.tsx` — novo

Origem: `_style_check` (`active_workout.py:654-660`).

```python
if done:  icon=check color #000000; background:#a2ff00; border-radius:10px; border:none
else:     icon=check color #6b7280; background:#222222; border-radius:10px; border:1px solid #2a2a2a
```

52×52 (`active_workout.py:636`).

```ts
export interface SetCheckButtonProps {
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;   // ex.: 'Marcar série 3 como concluída'
}
```

Passar `accessibilityState={{ checked }}` — as suítes de teste usam esse padrão (ver `Chip.tsx`, que já faz `accessibilityState={{ selected }}`).

---

## 11. `DayDot.tsx` — novo

Origem: `_WeekDayIcon` (`dashboard.py:171-199`).

```python
# ativo
icon.setPixmap(qta.icon("fa5s.bolt", color="#1a1a1a").pixmap(24, 24))
icon.setStyleSheet("background:#a2ff00; border-radius:12px;")
neon_glow(icon, "#a2ff00", blur=60, opacity=400)     # glow FORTE

# inativo
icon.setText("—")
icon.setStyleSheet("background:#1a1a1a; color:#3a3a3a; border:1px solid #2a2a2a; border-radius:12px; font-size:20px;")

# label abaixo, sempre
day_lbl -> color:#6b7280; font-size:12px; font-weight:500  (texto em .upper())
```

Quadrado de 48×48, `borderRadius: 12`, gap 8 até o label.

```ts
export interface DayDotProps {
  day: string;        // 'Seg' — o componente faz .toUpperCase()
  active: boolean;
  testID?: string;
}
```

Este componente **substitui a faixa de 7 barrinhas planas** que existe hoje no `DashboardScreen` (`streakBar`, altura 8px).

---

## 12. `HeroBanner.tsx` — novo

Origem: `_HeroBanner` (`dashboard.py:21-65`). É a peça visual mais característica do desktop.

Estrutura: imagem de fundo escalada com `KeepAspectRatioByExpanding` (equivale a `resizeMode="cover"`), cantos arredondados em 16px, e **quatro degradês pretos** por cima para garantir legibilidade do texto:

```python
((0, 0, 100, 0),                            (0, 0, 100, self.height())),          # esquerda, 100px
((self.width(), 0, self.width()-100, 0),    (self.width()-100, 0, 100, h)),       # direita, 100px
((0, 0, 0, 80),                             (0, 0, self.width(), 80)),            # topo, 80px
((0, self.height(), 0, self.height()-80),   (0, h-80, self.width(), 80)),         # base, 80px
# cada um: de rgba(0,0,0,180) na borda até rgba(0,0,0,0) para dentro
```

```ts
export interface HeroBannerProps {
  children: React.ReactNode;   // conteúdo sobreposto (saudação + subtítulo)
  height?: number;             // default 180
  testID?: string;
}
```

Implementar com `ImageBackground` + `require('../../assets/hero-header.png')`, `borderRadius: radii.lg`, `overflow: 'hidden'`, e os degradês com **`react-native-svg`** (`LinearGradient` + `Rect` posicionados absolutamente).

⚠️ **Usar `react-native-svg`, que já é dependência (15.8.0) e já tem mock de teste** (`src/test/mocks/reactNativeSvg.ts`). **Não introduzir `expo-linear-gradient`** só para isso — seria uma dependência nova sem mock.

Padding interno do conteúdo, do desktop (`dashboard.py:290`): `32, 28, 32, 28`.

---

## 13. `Banner.tsx` — novo

Padrão de banner offline/erro copiado hoje em `AuthScreen` e `DashboardScreen`: superfície com **borda esquerda de 4px** colorida.

```ts
export interface BannerProps {
  message: string;
  variant?: 'info' | 'error';   // default 'info' → borda verde; 'error' → vermelha
  testID?: string;
}
```

**Resolve um bug real**: os banners de erro dos containers (`DashboardScreenContainer`, testID `logout-error-banner`) renderizam `<View><Text>{...}</Text></View>` **sem estilo nenhum** — texto preto padrão sobre fundo preto, ou seja, invisível. Trocar por este componente em todos os containers.

---

## 14. `EmptyState.tsx` — novo

Padrão repetido em 4 telas ("Nenhum treino encontrado.", "Catálogo de exercícios vazio...", "Nenhum treino registrado ainda.", "Sessão não encontrada.").

```ts
export interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}
```

Texto centralizado em `colors.secondaryText` / `typography.sub`, e quando há ação, um `Button variant="primary"` abaixo.

---

## 15. `Chip.tsx` e `StatRow.tsx` — **alterar** (já existem)

Só realinhar aos tokens novos:

- **`Chip`**: não selecionado → bg `colors.card` + `borderWidth: 1` `colors.border` (hoje é `surface` sem borda); selecionado → bg `colors.primary`, texto `colors.onPrimary`. `borderRadius: radii.pill`.
- **`StatRow`**: valor em `typography.bodyBold` / `colors.primaryText`, label em `typography.caption` / `colors.secondaryText`. **Remover o `fontWeight: '600'` hardcoded** — no Android ele não faz nada com Inter e no iOS conflita com a família.

Aproveitar esta wave para **eliminar a duplicação de chips** do `ActiveSessionScreen`, que tem estilos próprios (`exerciseChip`, `exerciseChipSelected`) em vez de usar o `Chip`. O docstring do próprio `Chip.tsx` documenta essa duplicação como dívida deliberada — agora dá para pagar.

---

## Checklist de conclusão da Wave 1

- [ ] 11 componentes novos criados: `Button`, `Input`, `UnderlineInput`, `ScreenHeader`, `SectionTitle`, `StatCard`, `IconBadge`, `ProgressBar`, `SetCheckButton`, `DayDot`, `HeroBanner`, `Banner`, `EmptyState`
- [ ] 3 componentes existentes atualizados: `Card` (default `bordered`), `Chip`, `StatRow`
- [ ] Um `__tests__/<Nome>.component.test.tsx` por componente novo, no padrão dos existentes
- [ ] `Card.component.test.tsx` atualizado para o novo default
- [ ] `npx tsc --noEmit` limpo
- [ ] Nenhum literal de cor fora de `tokens.ts` nos componentes novos

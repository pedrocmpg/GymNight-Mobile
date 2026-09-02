# Wave 7 — Tela de Estatísticas: radar muscular, métricas e sobrecarga

> Parte de [`PARIDADE-00-INDICE.md`](PARIDADE-00-INDICE.md). Depende da [Wave 6](PARIDADE-02-CATALOGO-MUSCULAR.md).
> Origem: `GymNight-Desktop/src/ui/screens/statistics.py` (505 linhas) e `src/core/performance.py`.
> Caminhos relativos a `gymnight/frontend/`.

**Nenhuma mudança de schema.** Esta wave é puramente consumidora do que a Wave 6 criou.

O mobile tem 2 abas (Treinos, Progresso); o desktop tem 4 destinos. Esta é a terceira.

---

## 1. Estrutura alvo

```
┌──────────────────────────────────────┐
│ ESTATÍSTICAS                         │  h1 maiúsculo
│                                      │
│         ╱╲  Peito                    │
│    Core╱  ╲Costas                    │  radar de 6 eixos
│       │ ▓▓ │                         │  polígono verde + grid
│  Pernas╲  ╱Ombros                    │
│         ╲╱  Braços                   │
│                                      │
│ ┌──────────┐  ┌──────────┐           │
│ │ Treinos  │  │ Duração  │           │  grid 2×2 com delta
│ │    12    │  │  8h 20m  │           │  período vs. período
│ │  ▲ +20%  │  │  ▲ +12%  │           │
│ └──────────┘  └──────────┘           │
│ ┌──────────┐  ┌──────────┐           │
│ │ Volume   │  │ Séries   │           │
│ │  42.5k   │  │   186    │           │
│ │  ▼ -5%   │  │  ▲ +8%   │           │
│ └──────────┘  └──────────┘           │
└──────────────────────────────────────┘
```

---

## 2. Gráfico radar

### 2.1 As 6 categorias — agrupamento do desktop

`statistics.py:120-131` agrupa os **7 grupos musculares** do banco em **6 categorias** de exibição:

```python
categories = ['Peito', 'Costas', 'Ombros', 'Braços', 'Pernas', 'Core']
# Braços = Bíceps + Tríceps (somados)
# Core   = Abdômen (renomeado)
```

Portar exatamente esse agrupamento. Não são os mesmos 7 do banco — quem implementar direto de `muscle_groups` vai gerar um gráfico diferente do desktop.

### 2.2 Janela de tempo

**Últimos 30 dias, fixo.** O desktop tem um `_get_period_days()` que sempre retorna 30 — parece um seletor de período que nunca foi implementado. Replicar o comportamento real (30 dias), não a intenção aparente.

### 2.3 Normalização

Valores normalizados **0–100% do máximo entre as categorias**, não do total. A categoria mais trabalhada sempre encosta na borda; as outras são relativas a ela.

### 2.4 ⚠️ Nada de biblioteca de gráfico

O desktop usa matplotlib, o que assusta — mas o resultado é só **um polígono de 6 vértices sobre anéis concêntricos**. Em RN isso é geometria pura mais `<Polygon>`.

- `react-native-svg@15.8.0` **já é dependência** (`package.json:34`).
- **`src/screens/ProgressScreen/computeChartGeometry.ts` já é o molde exato**: função pura que converte dados em coordenadas e path SVG, *sem importar `react-native-svg`*, "para ser testável com property-based tests sem precisar de mock de módulo nativo". Tem property test próprio (`computeChartGeometry.property56.test.ts`).
- A decisão de manter gráficos desenhados à mão já está registrada no vault e repetida em `REDESIGN-03-TELAS.md` §5.3.

**Não trazer `victory-native` nem `react-native-chart-kit`.**

### 2.5 O que escrever

`src/screens/StatisticsScreen/computeRadarGeometry.ts`, espelhando o molde:

```ts
export interface RadarSlice { label: string; value: number; }
export interface RadarGeometry {
  points: Array<{ x: number; y: number }>;   // vértices do polígono
  polygonPath: string;                        // path SVG fechado
  gridRings: string[];                        // anéis concêntricos (25/50/75/100%)
  axisLines: string[];                        // 6 raios do centro à borda
  labelPositions: Array<{ x: number; y: number; label: string }>;
}
```

Matemática: para o eixo `i` de `n`, ângulo = `-π/2 + 2πi/n` (começando no topo, sentido horário). Raio = `(value / max) × raioMax`.

⚠️ Casos de borda que o property test tem que cobrir: **todas as categorias zeradas** (max = 0, não pode dividir por zero — degenera para o centro) e **uma só categoria com valor** (polígono degenerado, tem que continuar sendo um path SVG válido).

---

## 3. Grid 2×2 de métricas

### 3.1 As quatro

`statistics.py`: **Treinamentos** (contagem de sessões), **Duração** (horas/minutos totais), **Volume** (kg levantados), **Séries** (total de séries).

Todas **excluindo aquecimento** (`set_type != 'W'`) — a Wave 6 já deixou isso pronto no `computeVolume`.

### 3.2 Delta período-contra-período

Cada card mostra a variação contra o **período imediatamente anterior de mesma duração**: os últimos 30 dias comparados com os 30 dias antes desses. Não é "vs. mês passado" no calendário — é janela móvel.

`delta_pct = (atual − anterior) / anterior × 100`, e **0 quando o anterior é 0** (senão divide por zero no primeiro mês de uso).

### 3.3 Reaproveitar

O `StatCard` já existe e o layout 2×2 do Dashboard já é o alvo visual (`DashboardScreen.tsx`, `statsGrid`/`statsCell` com `flexBasis: '48%'`). Boa parte da matemática também já existe em `src/hooks/historyDomainUtils.ts`: `computeAverageSessionDuration`, `formatVolume`, `daysSince`, `buildRecentSessionSummaries`.

O `StatCard` precisa ganhar um slot de delta (seta + percentual, verde/vermelho) — é a única mudança de componente da wave.

---

## 4. Delta de sobrecarga progressiva

### 4.1 A fórmula, verbatim

De `GymNight-Desktop/src/core/performance.py`, `_compute_performance_delta`:

```python
current_volume = volume do exercício NESTA sessão
sma_volumes    = volumes das últimas N sessões, EXCLUINDO a atual

if not sma_volumes:
    historical_avg = 0.0
    delta_pct      = 0.0
else:
    historical_avg = sum(sma_volumes) / len(sma_volumes)
    delta_pct = (current_volume - historical_avg) / historical_avg * 100 if historical_avg > 0 else 0.0
```

⚠️ **A sessão atual é excluída da própria média.** O comentário no desktop marca isso como "correção do bug" — incluí-la diluiria o sinal e é erro fácil de repetir.

Dois guardas: histórico vazio ⇒ delta 0; média histórica 0 ⇒ delta 0.

### 4.2 Onde vive

Função pura em `historyDomainUtils.ts`. Não depende de nada da Wave 6 — poderia até ter sido feita antes, mas o lugar natural de exibição é a tela de Estatísticas.

`N` (janela do SMA) é parâmetro com default 5, como no desktop.

---

## 5. Navegação — a terceira aba

`src/navigation/MainTabNavigator.tsx` ganha `Estatísticas`. Ícone FontAwesome5 sugerido: `chart-pie` ou `chart-bar` (o desktop usa `chart-line` na aba de progresso, então evitar repetir).

A tab bar já está estilizada desde a Wave 2 (altura 62, borda superior, glow no ativo) — o item novo herda tudo.

⚠️ Com 3 abas o espaço horizontal aperta. Conferir que os rótulos não quebram em telas estreitas; `typography.caption` já é o menor token.

---

## 6. Dados

Novo hook `useObserveStatistics`, no molde de `useObserveHistory` / `useObserveDashboard`: combina observables e faz **join client-side** (nunca `Q.on()` — convenção do repo).

Precisa de: `workout_sessions`, `logged_sets`, `exercises`, `exercise_muscle_map`, `muscle_groups`.

⚠️ São 5 fontes. O `combineObservables` do repo é **binário** — o `useObserveDashboard` já aninha 5 fontes assim (`useObserveDashboard.ts:218`), com o custo de indexação feia (`data[0][0][0]`). Vale considerar um `combineMany` genérico aqui em vez de aninhar mais fundo.

Toda agregação em função pura, fora do hook.

---

## 7. Testes

Property tests a partir do **69**:

| Nº | Assunto | O que prova |
|---|---|---|
| 69 | `computeRadarGeometry` | Todos os pontos dentro do viewport; `n` vértices para `n` categorias |
| 70 | `computeRadarGeometry` | Tudo zerado ⇒ não quebra, não divide por zero |
| 71 | `computeRadarGeometry` | Escala é relativa ao máximo: a maior categoria encosta na borda |
| 72 | agrupamento | Bíceps + Tríceps ⇒ Braços; Abdômen ⇒ Core; nada se perde na soma |
| 73 | delta período | `(atual − anterior)/anterior × 100`; anterior 0 ⇒ 0 |
| 74 | janela de 30 dias | Sessão de 31 dias atrás não entra; a de 29 entra |
| 75 | `computeSmaDelta` | Sessão atual **excluída** da própria média |
| 76 | `computeSmaDelta` | Histórico vazio ⇒ 0; média 0 ⇒ 0 |

Mais testes de componente para a tela e para o `StatCard` com delta.

---

## 8. Verificação

**Tudo roda em Docker** (ver [`PARIDADE-00-INDICE.md`](PARIDADE-00-INDICE.md) §Verificação):

```bash
docker compose -f docker-compose.test.yml run --rm frontend-tsc    # 16 erros pré-existentes, nem um a mais
docker compose -f docker-compose.test.yml run --rm frontend-test   # nenhuma regressão
docker compose -f docker-compose.test.yml run --rm frontend-lint   # nenhum problema novo
```
Depois disso: suítes novas validadas contra a árvore anterior via `git stash`
5. Conferir que o radar renderiza com: catálogo cheio e zero sessões; uma sessão só; e um usuário que só treina um grupo muscular

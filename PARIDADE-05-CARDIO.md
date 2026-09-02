# Wave 9 — Cardio

> Parte de [`PARIDADE-00-INDICE.md`](PARIDADE-00-INDICE.md). Depende da [Wave 6](PARIDADE-02-CATALOGO-MUSCULAR.md).
> Origem: `GymNight-Desktop/src/ui/screens/cardio_widget.py` (1243 linhas) e `docs/tipo_cardios.md`.
> Caminhos relativos a `gymnight/frontend/`.

**Nenhuma migration.** A tabela `cardio_logs` já foi criada na v2 pela Wave 6.

---

## 1. O que existe no desktop

Duas formas de registrar cardio:

1. **Avulso** — de dentro da aba Treinos. Cria uma `workout_session` **sem rotina** (`routine_id` nulo) mais uma linha em `cardio_logs`, e grava a duração na sessão.
2. **Dentro do treino** — botão "+ Cardio" no treino ativo. As entradas aparecem como cards removíveis e são persistidas ao finalizar.

Campos: tipo (com busca), duração em minutos, distância em km (opcional), PSE de 1 a 10. Mais uma **estimativa de calorias ao vivo**, que recalcula enquanto o usuário mexe na duração ou no PSE.

---

## 2. Os tipos de cardio

Fonte: `GymNight-Desktop/docs/tipo_cardios.md` — 30 linhas, tabela markdown com 4 colunas: tipo, intensidade, PSE médio, descrição do esforço.

Duas seções: **Máquinas (Academia)** e **Peso Corporal / Outdoor**. Exemplos:

```
Esteira (Caminhada Plana)      Baixa      2-3    Respiração normal, dá para cantar uma música.
Elíptico (Ritmo constante)     Moderada   4-5    Respiração mais funda, mas consegue conversar.
Corrida Contínua (Trote)       Alta       6-8    Foco na respiração, impossível conversar.
Air Bike (Tiros)               Máxima     9-10   Respiração ofegante, dor muscular.
```

A descrição do esforço é o que torna o PSE utilizável — sem ela o usuário não sabe diferenciar 6 de 7. **Portar as descrições junto**, não só os nomes.

Como são só 30 linhas e não mudam, converter para uma constante TypeScript versionada no repo. **Não precisa de tabela nem de sync** — é dado estático, diferente do catálogo de exercícios.

---

## 3. Calorias de cardio

### 3.1 A fórmula, verbatim

`cardio_widget.py:69-86`:

```python
if   pse <= 3:  met = 3.0
elif pse <= 6:  met = 6.0
elif pse <= 8:  met = 9.0
else:           met = 12.0

hours    = duration_min / 60.0
calories = met * weight_kg * hours
return int(calories)   # trunca, não arredonda
```

`weight_kg` default 75 (note: **diferente do default 70 da musculação** — mais uma inconsistência do desktop).

### 3.2 ⚠️ Duas fórmulas de caloria incompatíveis

O desktop calcula caloria de **dois jeitos diferentes**:

| | Musculação | Cardio |
|---|---|---|
| MET | tabela por exercício (`exercise_met_values`) | bucket de PSE |
| Tempo | `reps × 4s` | duração informada |
| Peso default | 70 kg | 75 kg |
| Onde | `core/routine.py` | `cardio_widget.py` |

Somar os dois numa métrica única de "calorias do dia" mistura metodologias — e os defaults de peso divergentes garantem inconsistência mesmo para o mesmo usuário.

**Recomendação:** replicar as duas fórmulas como estão (paridade é o objetivo desta série), mas **unificar o peso default em 70 kg** nas duas, e registrar a divergência metodológica num comentário. Com o onboarding da Wave 8 preenchendo o peso real, o default deixa de importar na prática.

Se o usuário preferir fidelidade total ao desktop, manter 75 — mas então documentar que é intencional, senão parece bug.

---

## 4. Telas

### 4.1 Formulário de cardio

Campos, na ordem do desktop: tipo (busca com autocomplete), duração (min), distância (km, opcional), PSE (1–10) e a estimativa de calorias ao vivo.

Para o PSE, o desktop usa slider com rótulos **Leve / Moderado / Intenso / Máximo**, casando com os buckets de MET. Reaproveitar o `Chip` do design system para os níveis, ou um slider — o importante é mostrar a **descrição do esforço** do tipo selecionado, que é o que ancora a escala.

Reaproveitar: `UnderlineInput` (campos numéricos, mesmo padrão da grade de séries da Wave 4), `Card`, `Button`, `IconBadge`, e o `filterExercises` da Wave 8 como molde para a busca de tipo.

### 4.2 Cardio dentro do treino ativo

Botão "+ Cardio" no `ActiveSessionScreen`, abaixo dos cards de exercício. As entradas viram cards removíveis (`CardioRow` no desktop: ícone, nome, duração, distância, PSE, badge de calorias, botão remover).

⚠️ O `ActiveSessionScreen` já tem **dois modos** (grade e livre) desde a Wave 4. O cardio é uma seção que aparece nos dois — cuidar para não empurrar mais complexidade para dentro do componente. Se ele começar a ficar grande demais, extrair a seção de cardio como componente próprio.

O contador do header (`X/Y séries`) e a `ProgressBar` contam **só séries de musculação**. Cardio não entra no denominador — senão o progresso do treino nunca fecha em 100%.

### 4.3 Cardio avulso

Cria uma `workout_session` sem `workout_id`. **Isso já é suportado**: `workout_sessions.workout_id` é opcional no schema, e a Wave 4 já tratou o modo livre.

Entrada pelo Dashboard, ao lado do "+ Novo". A sessão criada aparece no histórico como "Treino livre" (rótulo que a Wave 3 já definiu para sessão sem treino).

### 4.4 No resumo pós-treino

A tela de resumo da Wave 4 mostra Volume / Duração / Séries. Com cardio, acrescentar minutos totais e PSE médio, como o desktop.

---

## 5. Distância — escopo deliberadamente limitado

`distance_km` é **campo numérico manual e opcional**. Nada de GPS.

Rastrear distância de verdade implica permissão de localização, localização em background, consumo de bateria e uma política de privacidade — uma expansão de escopo enorme para um campo que o desktop preenche digitando. **Igualar o desktop, não superá-lo.**

---

## 6. Testes

Property tests a partir do **85**:

| Nº | Assunto | O que prova |
|---|---|---|
| 85 | calorias de cardio | Buckets exatos: PSE 3→3 MET, 4→6, 7→9, 9→12; fronteiras (3/4, 6/7, 8/9) |
| 86 | calorias de cardio | Monotonicidade: mais duração ⇒ nunca menos calorias; resultado truncado, não arredondado |
| 87 | validação | Duração > 0; PSE em 1–10; distância opcional aceita ausente |
| 88 | parsing dos tipos | 30 linhas viram N tipos com nome, intensidade, PSE e descrição |
| 89 | progresso do treino | Cardio **não** entra no contador `X/Y séries` nem na ProgressBar |
| 90 | sessão avulsa | Cardio avulso cria sessão com `workout_id` nulo e a encerra |

---

## 7. Verificação

**Tudo roda em Docker** (ver [`PARIDADE-00-INDICE.md`](PARIDADE-00-INDICE.md) §Verificação):

```bash
docker compose -f docker-compose.test.yml run --rm frontend-tsc    # 16 erros pré-existentes, nem um a mais
docker compose -f docker-compose.test.yml run --rm frontend-test   # nenhuma regressão
docker compose -f docker-compose.test.yml run --rm frontend-lint   # nenhum problema novo
docker compose -f docker-compose.test.yml run --rm backend-test    # sync de `cardio_logs` contra o Postgres real
```
Depois disso: suítes novas validadas contra a árvore anterior via `git stash`
5. Fluxo manual: cardio avulso → aparece no histórico; cardio dentro do treino → aparece no resumo e **não** altera o contador de séries

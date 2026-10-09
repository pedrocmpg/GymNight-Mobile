# Wave 10 — Adiados: heatmap muscular e GymAI

> Parte de [`PARIDADE-00-INDICE.md`](PARIDADE-00-INDICE.md).
> ⚠️ **NÃO EXECUTAR.** Esta spec existe para registrar o que foi adiado, por quê, e o que seria preciso caso um dia se decida fazer.

Nenhuma das duas features é pré-requisito de nada. Ambas podem ser retomadas em qualquer momento, ou nunca.

---

## 1. Heatmap muscular

### 1.1 O que é no desktop

`GymNight-Desktop/src/ui/widgets/muscle_heatmap.py` — duas silhuetas corporais (frente e costas) em SVG inline, com regiões musculares recoloridas por intensidade conforme o volume proporcional daquele grupo na sessão. Aparece no resumo pós-treino.

Recebe o resultado de `PerformanceAnalyzer.get_muscle_volume_breakdown(session_id)` e recolore os elementos SVG **via regex sobre o markup**, mapeando volume relativo para lightness em HSL.

### 1.2 Por que foi adiado

**O bloqueio não é código — é arte.**

O dado já vai existir (a Wave 6 traz `exercise_muscle_map`), e o cálculo de volume por músculo é a mesma função pura que a Wave 7 usa para o radar. Recolorir SVG em React Native é trivial: `react-native-svg` já é dependência e permite mudar `fill` por elemento sem regex nenhum — mais limpo que a solução do desktop.

O que falta é o **SVG da silhueta corporal com cada músculo como elemento individualmente endereçável**. O do desktop tem os IDs necessários, mas:

- É preciso conferir a licença antes de copiar entre projetos.
- Se não puder ser reaproveitado, é tarefa de design de prazo indefinido — e desenhar anatomia dá muito mais trabalho do que parece.

### 1.3 Por que não é perda grande

**O radar da Wave 7 entrega quase a mesma informação:** distribuição de volume entre grupos musculares, mostrando o que está sendo negligenciado. A diferença é estética — o heatmap é mais bonito e mais imediato, mas não responde nenhuma pergunta que o radar não responda.

É polimento, não paridade funcional.

### 1.4 Se um dia for feito

1. Conferir a licença do SVG do desktop; se ok, copiar para `assets/`.
2. Reaproveitar a agregação de volume muscular da Wave 7 — nada novo de dado.
3. Colorir por `fill` no `react-native-svg`, **não** por regex no markup.
4. Exibir no resumo pós-treino da `ActiveSessionScreen` (Wave 4), que já é o lugar equivalente ao do desktop.

Custo estimado, com o SVG em mãos: pequeno. Sem o SVG: indefinido.

---

## 2. GymAI

### 2.1 O que é no desktop

`GymNight-Desktop/src/ui/screens/gym_ai.py` (603 linhas) — quarta aba, chat com o Google Gemini via `google-genai`. Persona de personal trainer, resposta em streaming re-emitida palavra a palavra com 15 ms de atraso para simular digitação, histórico em memória, fallback entre três modelos (`gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-flash-latest`), tratamento específico de 503 (sobrecarga) e 429 (rate limit).

Chave lida de `GEMINI_API_KEY` no ambiente (`gym_ai.py:293`).

### 2.2 Por que foi adiado — três motivos independentes

**1. Segurança.** No desktop a chave fica no ambiente da máquina do usuário. **Num app mobile, qualquer chave embutida no bundle é extraível** — basta descompactar o APK. Não é risco teórico: é vazamento de credencial de API paga, cobrada por uso, atribuída à conta de quem publicou.

A forma correta é um **proxy no backend**: o app fala com o FastAPI, o FastAPI guarda a chave e fala com o Gemini, com rate limit por usuário. Isso não é portar uma tela — é um projeto de backend, com autenticação, cota, custo e monitoramento.

**2. Arquitetura.** O app inteiro é offline-first: WatermelonDB local, sync em background, tudo funciona sem rede. Uma tela de chat é **inútil sem conexão** e não tem nada para persistir localmente (o desktop nem guarda o histórico — some ao fechar). É um corpo estranho na arquitetura.

**3. Custo.** É a única feature da série que gera **custo recorrente por uso**, proporcional ao número de usuários. Sem cota por usuário, um único usuário entediado pode gerar conta relevante.

### 2.3 Se um dia for feito

Pré-requisitos, em ordem:

1. Endpoint proxy no backend (`POST /api/v1/chat`), com a chave só no servidor.
2. Rate limit por usuário — o backend já usa `slowapi` (60/min nos endpoints de sync), então a infraestrutura existe.
3. Definir a política de custo: cota diária, ou feature paga, ou só para conta própria.
4. Só então a tela no mobile.

O prompt de sistema e o tratamento de erro do desktop portam bem. O streaming palavra-a-palavra artificial de 15 ms **não vale portar** — é enfeite que atrasa a leitura; o streaming real do SDK já basta.

### 2.4 Decisão

Adiada pelo usuário na definição do escopo, e a análise reforçou. **Sem data.** Não bloqueia nada.

---

## 3. Outras coisas conscientemente fora

Registradas aqui para não se perderem:

| Item | Onde está | Por quê fora |
|---|---|---|
| `NormalizationEngine` completo (trigram Jaccard + `get_or_create`) | `src/core/normalization.py` | Existe para resolver **texto livre** em nome canônico. O mobile escolhe de catálogo fechado. A parte útil (busca por substring normalizada) entrou na Wave 8. |
| Dias da semana da rotina | `workouts.py` | No desktop os toggles **não são persistidos** — só alimentam um rótulo de resumo. Não há dado a portar. |
| `set_indicator.py`, `rest_timer.py` | `src/ui/widgets/` | Componentes que existem no desktop mas **não estão ligados** em nenhuma tela ativa. Portar código morto não faz sentido. |
| `CreateWorkoutDialog`, `CardioPickerDialog` | `src/ui/dialogs.py`, `cardio_widget.py` | Versões modais legadas, superadas pelos fluxos inline. O desktop mantém as duas; o mobile porta só a viva. |
| Distância de cardio por GPS | — | Ver `PARIDADE-05` §5. Escopo deliberadamente limitado a entrada manual. |

---

## 4. Débito técnico do mobile, não coberto por nenhuma wave

Encontrado durante a análise. Não é paridade com o desktop — é dívida própria do mobile.

### 🔴 Segurança

- **`gymnight/backend/.env` está commitado no repositório** (não só o `.env.example`), e `ADMIN_SECRET` tem default `"changeme"`. Deveria ser resolvido antes de qualquer deploy.

### 🟡 Risco de runtime

- `src/sync/SyncStatusIndicator.ts` importa `@/designSystem/tokens`, mas o alias `@/` só existe no `moduleNameMapper` do `jest.config.js` — o Babel não tem `module-resolver`. **Funciona em teste, pode quebrar no Metro.** A Wave 4.5 toca esse arquivo e deve trocar por caminho relativo.

### 🟡 Código morto

- `app/routers/sync.py` — router de sync duplicado, **nunca registrado no `main.py`**. É onde vive o `SHARED_TABLES`, que portanto também está morto. Fácil de editar por engano achando que é o vivo (o vivo é `app/api/v1/endpoints/sync.py`).
- `src/config.ts` — legado da era `REACT_APP_*`, que o Expo nunca injeta. Nada importa. Superado por `src/config/env.ts`.
- `app/database/models_old.py.bak`.
- Comentários desatualizados em `app/api/v1/endpoints/sync.py:101` e `:664` ainda dizem "stubs — retornam not implemented"; está tudo implementado.

### 🟡 Dívida de tipos

- Os **16 erros de `tsc --noEmit`** em 6 arquivos de teste, herdados de um `npm install` que atualizou tipos transitivos. Não afetam execução (o Babel não faz type-check). Detalhados em `Armadilhas e Débito Técnico.md` no vault.
- `src/navigation/watermelonProviders.ts` é quase todo `any` porque o WatermelonDB tipa `observe()` como `Model[]`, não como a linha crua. Contorno documentado: converter no limite da subscrição.
